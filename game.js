import * as THREE from 'three';

// --- ⚙️ GAME CONFIGURATION ---
const CONFIG = {
    speed: 80,              // Forward velocity
    turnSpeed: 45,          // Handling sensitivity
    bankAngle: 0.6,         // How much the plane tilts
    fireRate: 0.15,         // Seconds between shots
    enemySpawnRate: 1500,   // Milliseconds
    colors: {
        sky: 0x87CEEB,      // Sky Blue
        ocean: 0x1E90FF,    // Deep Blue
        grid: 0xffffff,
        player: 0xD1D5DB,   // Silver/Grey Hull
        cockpit: 0xFCD34D,  // Gold tint canopy
        enemy: 0xEF4444     // Red Hostiles
    }
};

// --- 🎮 STATE MANAGEMENT ---
const state = {
    running: false,
    score: 0,
    health: 100,
    time: 0,
    lastShot: 0,
    keys: {
        up: false, down: false, left: false, right: false, fire: false
    }
};

// --- 🌍 GLOBAL OBJECTS ---
let scene, camera, renderer, clock;
let player, oceanGrid;
let enemies = [];
let bullets = [];
let particles = [];

// --- 🖥️ DOM ELEMENTS (Cache these) ---
const ui = {
    score: document.getElementById('score'),
    healthBar: document.getElementById('shield-bar'), // Assuming you kept the bar from previous HTML
    startScreen: document.getElementById('start-screen'),
    gameOverScreen: document.getElementById('game-over') || document.getElementById('gameover-screen'),
    finalScore: document.getElementById('final-score')
};

// =========================================
// 🚀 INITIALIZATION & SETUP
// =========================================
function init() {
    // 1. Scene Setup (Sky Atmosphere)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.sky);
    scene.fog = new THREE.Fog(CONFIG.colors.sky, 20, 150);

    // 2. Camera Setup (Third Person)
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(0, 5, 12);
    clock = new THREE.Clock();

    // 3. Renderer Setup (High Quality)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; // Enable shadows
    document.body.appendChild(renderer.domElement);

    // 4. Lighting (Sun + Ambient)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
    sunLight.position.set(50, 100, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048; // High res shadows
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // 5. Build World
    createPlayer();
    createOcean();

    // 6. Input Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));
    
    // Bind Start Buttons
    const startBtns = document.querySelectorAll('button');
    startBtns.forEach(btn => btn.addEventListener('click', startGame));

    // Start Loop
    animate();
}

// =========================================
// ✈️ PLAYER & ASSETS
// =========================================
function createPlayer() {
    player = new THREE.Group();

    // -- Fuselage (Body) --
    const bodyGeo = new THREE.ConeGeometry(0.8, 4, 16);
    bodyGeo.rotateX(Math.PI / 2); // Point forward
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: CONFIG.colors.player, 
        roughness: 0.3,
        metalness: 0.8 
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    player.add(body);

    // -- Cockpit --
    const cockpitGeo = new THREE.BoxGeometry(0.7, 0.5, 1.5);
    // Smooth the box slightly
    cockpitGeo.translate(0, 0.5, 0);
    const cockpitMat = new THREE.MeshStandardMaterial({ 
        color: CONFIG.colors.cockpit, 
        roughness: 0.1, 
        metalness: 0.9,
        emissive: 0xaa6600,
        emissiveIntensity: 0.2
    });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 0.2, 0.5);
    player.add(cockpit);

    // -- Wings --
    const wingGeo = new THREE.BufferGeometry();
    // Custom triangle shape for swept-back wings
    const wingVertices = new Float32Array([
        0, 0, 0.5,   // Center Front
        4, 0, 1.5,   // Tip
        0, 0, 2.0,   // Center Back
        -4, 0, 1.5,  // Tip Left
        0, 0, 0.5,   // Close Loop
        0, 0, 2.0
    ]);
    wingGeo.setAttribute('position', new THREE.BufferAttribute(wingVertices, 3));
    wingGeo.computeVertexNormals();
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x9CA3AF, side: THREE.DoubleSide });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.castShadow = true;
    player.add(wings);

    // -- Tail Fins --
    const tailGeo = new THREE.BoxGeometry(2.5, 0.1, 1);
    const tail = new THREE.Mesh(tailGeo, wingMat);
    tail.position.set(0, 0, 1.8);
    player.add(tail);

    const rudderGeo = new THREE.BoxGeometry(0.1, 1.2, 1);
    const rudder = new THREE.Mesh(rudderGeo, wingMat);
    rudder.position.set(0, 0.6, 1.8);
    player.add(rudder);

    // -- Engine Glow --
    const engineGeo = new THREE.CylinderGeometry(0.4, 0.1, 0.5, 8);
    engineGeo.rotateX(Math.PI / 2);
    const engineMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF });
    const engine = new THREE.Mesh(engineGeo, engineMat);
    engine.position.z = 2.2;
    player.add(engine);

    scene.add(player);
}

function createOcean() {
    // An infinite grid floor that moves with the player
    oceanGrid = new THREE.GridHelper(2000, 100, CONFIG.colors.grid, 0x1E3A8A);
    oceanGrid.position.y = -15;
    scene.add(oceanGrid);
}

function spawnEnemy() {
    if (!state.running) return;

    const enemy = new THREE.Group();

    // Drone Body
    const geo = new THREE.DodecahedronGeometry(1.5);
    const mat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.enemy, roughness: 0.4 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    enemy.add(mesh);

    // Spikes/Antenna
    const spikeGeo = new THREE.TetrahedronGeometry(2);
    const spikeMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true });
    const spike = new THREE.Mesh(spikeGeo, spikeMat);
    spike.rotation.set(Math.random(), Math.random(), Math.random());
    enemy.add(spike);

    // Random Spawn Position (Ahead of player)
    // We spawn them far ahead in Z, and random X/Y
    const spawnDistance = 120;
    const spawnX = (Math.random() - 0.5) * 80;
    const spawnY = (Math.random() - 0.5) * 40;

    enemy.position.set(
        player.position.x + spawnX,
        player.position.y + spawnY,
        player.position.z - spawnDistance
    );

    enemies.push({ mesh: enemy, active: true });
    scene.add(enemy);
}

// =========================================
// 🕹️ INPUT & LOGIC
// =========================================
function handleKey(event, isPressed) {
    const code = event.code;
    
    // Support W,A,S,D AND Arrow Keys
    if (code === 'KeyW' || code === 'ArrowUp') state.keys.up = isPressed;
    if (code === 'KeyS' || code === 'ArrowDown') state.keys.down = isPressed;
    if (code === 'KeyA' || code === 'ArrowLeft') state.keys.left = isPressed;
    if (code === 'KeyD' || code === 'ArrowRight') state.keys.right = isPressed;
    if (code === 'Space' || code === 'Enter') state.keys.fire = isPressed;
}

function fireBullet() {
    const now = clock.getElapsedTime();
    if (now - state.lastShot < CONFIG.fireRate) return;
    
    state.lastShot = now;

    // Create Bolt
    const geo = new THREE.CapsuleGeometry(0.1, 2, 4, 8);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
    const bullet = new THREE.Mesh(geo, mat);
    
    // Align with player
    bullet.position.copy(player.position);
    // Move slightly forward so it doesn't clip inside player
    bullet.translateZ(-2); 

    bullets.push({ mesh: bullet, life: 2.0 });
    scene.add(bullet);
}

function createExplosion(position) {
    // Spawn particles
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
        const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const mat = new THREE.MeshBasicMaterial({ color: 0xF59E0B });
        const p = new THREE.Mesh(geo, mat);
        p.position.copy(position);
        
        // Random explosion velocity
        const vel = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );

        particles.push({ mesh: p, velocity: vel, life: 1.0 });
        scene.add(p);
    }
}

// =========================================
// 🔄 GAME LOOP
// =========================================
function startGame() {
    // Reset State
    state.score = 0;
    state.health = 100;
    state.running = true;
    player.position.set(0, 0, 0);
    player.rotation.set(0, 0, 0);
    
    // Clear old entities
    enemies.forEach(e => scene.remove(e.mesh));
    bullets.forEach(b => scene.remove(b.mesh));
    enemies = [];
    bullets = [];

    // UI Updates
    ui.score.innerText = '0';
    if(ui.healthBar) ui.healthBar.style.width = '100%';
    ui.startScreen.classList.add('hidden');
    ui.gameOverScreen.classList.add('hidden');

    // Start Spawner
    setInterval(spawnEnemy, CONFIG.enemySpawnRate);
}

function gameOver() {
    state.running = false;
    ui.finalScore.innerText = state.score;
    ui.gameOverScreen.classList.remove('hidden');
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (state.running) {
        // --- 1. PLAYER MOVEMENT ---
        // Constant forward speed
        player.translateZ(-CONFIG.speed * delta);

        // Steering (Inverted Y for flight controls? No, standard arcade: Up=Up)
        const moveSpeed = 25 * delta;
        if (state.keys.up) player.position.y += moveSpeed;
        if (state.keys.down) player.position.y -= moveSpeed;
        if (state.keys.left) player.position.x -= moveSpeed;
        if (state.keys.right) player.position.x += moveSpeed;

        // Banking Visuals (Rotate mesh based on input)
        let targetRotZ = 0;
        let targetRotX = 0;

        if (state.keys.left) targetRotZ = CONFIG.bankAngle;
        if (state.keys.right) targetRotZ = -CONFIG.bankAngle;
        if (state.keys.up) targetRotX = 0.3;
        if (state.keys.down) targetRotX = -0.3;

        // Smooth Lerp Rotation
        player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, targetRotZ, 0.1);
        player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, targetRotX, 0.1);

        // Fire Weapons
        if (state.keys.fire) fireBullet();

        // Sync Ocean Grid to Player X/Z (Infinite illusion)
        oceanGrid.position.x = player.position.x;
        oceanGrid.position.z = player.position.z;


        // --- 2. BULLET LOGIC ---
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.mesh.translateZ(-150 * delta); // Bullet speed
            b.life -= delta;

            // Collision Check vs Enemies
            let hit = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                const dist = b.mesh.position.distanceTo(e.mesh.position);
                
                if (dist < 3.5) { // Hit radius
                    createExplosion(e.mesh.position);
                    scene.remove(e.mesh);
                    enemies.splice(j, 1);
                    hit = true;
                    state.score += 50;
                    ui.score.innerText = state.score;
                    break;
                }
            }

            if (b.life <= 0 || hit) {
                scene.remove(b.mesh);
                bullets.splice(i, 1);
            }
        }

        // --- 3. ENEMY LOGIC ---
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            // Enemies fly slowly towards player? Or just static obstacles? 
            // Let's make them fly slowly towards Z+ (towards player start)
            e.mesh.position.z += 20 * delta; 
            
            // Rotate enemy
            e.mesh.rotation.x += delta;
            e.mesh.rotation.y += delta;

            // Player Collision Check
            if (e.mesh.position.distanceTo(player.position) < 3.0) {
                createExplosion(player.position);
                scene.remove(e.mesh);
                enemies.splice(i, 1);
                state.health -= 25;
                if(ui.healthBar) ui.healthBar.style.width = state.health + '%';
                
                if (state.health <= 0) gameOver();
            }

            // Cleanup behind player
            if (e.mesh.position.z > player.position.z + 20) {
                scene.remove(e.mesh);
                enemies.splice(i, 1);
            }
        }

        // --- 4. CAMERA TRACKING ---
        // Smoothly follow player
        const targetCamPos = player.position.clone();
        targetCamPos.y += 4;
        targetCamPos.z += 12;
        camera.position.lerp(targetCamPos, 0.1);
        camera.lookAt(player.position);
    }

    // --- 5. PARTICLE ANIMATION ---
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.position.addScaledVector(p.velocity, delta);
        p.mesh.scale.multiplyScalar(0.95); // Shrink
        p.life -= delta;
        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        }
    }

    renderer.render(scene, camera);
}

// Resizing
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start Engine
init();
