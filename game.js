import * as THREE from 'three';

// --- CONFIGURATION ---
const SETTINGS = {
    speed: 60,
    turnSpeed: 1.2,
    laserSpeed: 400,
    enemySpeed: 30,
    spawnRate: 2000
};

// --- STATE ---
let state = {
    running: false,
    score: 0,
    wave: 1,
    shield: 100,
    mouseX: 0,
    mouseY: 0,
    lastTime: 0
};

// --- SCENE GLOBALS ---
let scene, camera, renderer;
let ship;
let lasers = [];
let enemies = [];
let stars = [];
let explosions = [];

// --- ELEMENTS ---
const ui = {
    score: document.getElementById('score'),
    shieldBar: document.getElementById('shield-bar'),
    startScreen: document.getElementById('start-screen'),
    gameOverScreen: document.getElementById('game-over'),
    finalScore: document.getElementById('final-score'),
    warning: document.getElementById('warning-msg')
};

// --- INITIALIZATION ---
function init() {
    // Scene Setup
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0015);

    // Camera (The Player's Eyes)
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(100, 100, 50);
    scene.add(sunLight);

    // Create Player Ship (Invisible container for logic, visible models added inside)
    createShip();

    // Create Starfield
    createStars();

    // Events
    window.addEventListener('resize', onResize);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', fireLaser);
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('retry-btn').addEventListener('click', () => location.reload());

    // Loop
    requestAnimationFrame(loop);
}

function createShip() {
    ship = new THREE.Group();
    scene.add(ship);

    // Add 3D Ship Model (Procedural Shapes)
    const hullGeo = new THREE.ConeGeometry(1, 4, 8);
    hullGeo.rotateX(Math.PI / 2);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4 });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    ship.add(hull);

    // Wings
    const wingGeo = new THREE.BoxGeometry(6, 0.2, 1.5);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.set(0, 0, 1);
    ship.add(wing);

    // Engine Glow
    const engineGeo = new THREE.SphereGeometry(0.5);
    const engineMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const engine = new THREE.Mesh(engineGeo, engineMat);
    engine.position.z = 2.2;
    ship.add(engine);

    // Camera positioned slightly behind ship
    ship.add(camera);
    camera.position.set(0, 1.5, 6);
    camera.lookAt(0, 0, -20);
}

function createStars() {
    const starGeo = new THREE.BufferGeometry();
    const starCount = 3000;
    const posArray = new Float32Array(starCount * 3);

    for(let i = 0; i < starCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 2000;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starMat = new THREE.PointsMaterial({color: 0xffffff, size: 2});
    const starMesh = new THREE.Points(starGeo, starMat);
    scene.add(starMesh);
    stars.push(starMesh);
}

// --- GAME LOGIC ---

function startGame() {
    ui.startScreen.classList.add('hidden');
    state.running = true;
    state.lastTime = performance.now();
    
    // Enemy Spawner
    setInterval(() => {
        if(state.running) spawnEnemy();
    }, SETTINGS.spawnRate);
}

function spawnEnemy() {
    const enemy = new THREE.Group();
    
    // Enemy Shape
    const geo = new THREE.OctahedronGeometry(1.5);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff3333, wireframe: false });
    const mesh = new THREE.Mesh(geo, mat);
    enemy.add(mesh);

    // Random Spawn Position in front of player
    const angle = Math.random() * Math.PI * 2;
    const radius = 50 + Math.random() * 50;
    
    // Spawn far ahead relative to ship rotation
    const spawnPos = new THREE.Vector3(
        (Math.random() - 0.5) * 100, 
        (Math.random() - 0.5) * 50, 
        -200 // Ahead
    );
    spawnPos.applyEuler(ship.rotation); // Align to ship direction
    spawnPos.add(ship.position); // Add ship world pos

    enemy.position.copy(spawnPos);
    enemy.userData = { health: 2 };
    
    scene.add(enemy);
    enemies.push(enemy);
}

function fireLaser() {
    if(!state.running) return;

    const laserGeo = new THREE.BoxGeometry(0.2, 0.2, 4);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const laser = new THREE.Mesh(laserGeo, laserMat);

    // Start at ship position
    laser.position.copy(ship.position);
    laser.quaternion.copy(ship.quaternion);
    
    // Offset slightly forward
    laser.translateZ(-2);

    scene.add(laser);
    lasers.push({
        mesh: laser,
        life: 2.0 // Seconds
    });
}

function createExplosion(pos, color) {
    // Simple particle burst
    const pCount = 8;
    for(let i=0; i<pCount; i++) {
        const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        
        // Random velocity
        const vel = new THREE.Vector3(
            (Math.random()-0.5)*10,
            (Math.random()-0.5)*10,
            (Math.random()-0.5)*10
        );

        scene.add(mesh);
        explosions.push({ mesh, vel, life: 1.0 });
    }
}

// --- MAIN LOOP ---

function loop(time) {
    requestAnimationFrame(loop);
    const dt = (time - state.lastTime) / 1000;
    state.lastTime = time;

    if(!state.running) {
        renderer.render(scene, camera);
        return;
    }

    // 1. Ship Movement (Always flying forward)
    ship.translateZ(-SETTINGS.speed * dt);

    // 2. Steering (Mouse Follow)
    // Smoothly interpolate rotation based on mouse position from center
    ship.rotation.y -= state.mouseX * SETTINGS.turnSpeed * dt;
    ship.rotation.x -= state.mouseY * SETTINGS.turnSpeed * dt;
    
    // Bank (Roll) effect when turning
    ship.rotation.z = -state.mouseX * 0.5;

    // 3. Update Lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
        const l = lasers[i];
        l.mesh.translateZ(-SETTINGS.laserSpeed * dt);
        l.life -= dt;

        // Collision Check vs Enemies
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (l.mesh.position.distanceTo(e.position) < 4) {
                createExplosion(e.position, 0xff3333);
                scene.remove(e);
                enemies.splice(j, 1);
                state.score += 100;
                ui.score.innerText = state.score;
                hit = true;
                break;
            }
        }

        if (l.life <= 0 || hit) {
            scene.remove(l.mesh);
            lasers.splice(i, 1);
        }
    }

    // 4. Update Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        
        // Fly towards player
        const dir = new THREE.Vector3().subVectors(ship.position, e.position).normalize();
        e.position.addScaledVector(dir, SETTINGS.enemySpeed * dt);
        e.lookAt(ship.position);

        // Check if they crashed into player
        if (e.position.distanceTo(ship.position) < 3) {
            createExplosion(ship.position, 0xff0000);
            scene.remove(e);
            enemies.splice(i, 1);
            takeDamage(20);
        }
    }

    // 5. Update Explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        ex.mesh.position.addScaledVector(ex.vel, dt);
        ex.life -= dt;
        ex.mesh.scale.setScalar(ex.life); // Shrink over time
        if (ex.life <= 0) {
            scene.remove(ex.mesh);
            explosions.splice(i, 1);
        }
    }

    // 6. Infinite Starfield (Teleport stars forward to create illusion)
    // We actually just move the ship, so we don't need to loop stars unless optimizing for float precision.
    // For this simple demo, moving the ship is fine.

    renderer.render(scene, camera);
}

function takeDamage(amount) {
    state.shield -= amount;
    ui.shieldBar.style.width = state.shield + "%";
    
    // Screen shake
    const shake = 1;
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;

    if (state.shield <= 0) {
        endGame();
    }
}

function endGame() {
    state.running = false;
    ui.gameOverScreen.classList.remove('hidden');
    ui.finalScore.innerText = state.score;
}

// --- INPUT HANDLERS ---
function onMouseMove(e) {
    // Normalize -1 to 1
    state.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Run
init();
