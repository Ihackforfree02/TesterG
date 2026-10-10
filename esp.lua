
-- Player ESP for your own Roblox game
-- For Roblox Studio: use a LocalScript in StarterPlayerScripts
-- Toggle ESP with Right Shift

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local localPlayer = Players.LocalPlayer
local enabled = false
local tracked = {}

local function cleanup(player)
    local data = tracked[player]
    if not data then return end

    for _, object in ipairs(data.objects) do
        object:Destroy()
    end

    tracked[player] = nil
end

local function createESP(player, character)
    cleanup(player)
    if player == localPlayer then return end

    local humanoid = character:WaitForChild("Humanoid", 5)
    local root = character:WaitForChild("HumanoidRootPart", 5)
    local head = character:WaitForChild("Head", 5)

    if not humanoid or not root or not head then return end

    local objects = {}

    local highlight = Instance.new("Highlight")
    highlight.Adornee = character
    highlight.FillColor = Color3.fromRGB(255, 50, 80)
    highlight.OutlineColor = Color3.fromRGB(255, 255, 255)
    highlight.FillTransparency = 0.65
    highlight.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
    highlight.Enabled = enabled
    highlight.Parent = character
    table.insert(objects, highlight)

    local box = Instance.new("BoxHandleAdornment")
    box.Adornee = root
    box.Size = Vector3.new(4, 6, 2)
    box.Color3 = Color3.fromRGB(0, 220, 255)
    box.Transparency = 0.25
    box.AlwaysOnTop = true
    box.ZIndex = 5
    box.Visible = enabled
    box.Parent = root
    table.insert(objects, box)

    local gui = Instance.new("BillboardGui")
    gui.Adornee = head
    gui.Size = UDim2.fromOffset(160, 55)
    gui.StudsOffset = Vector3.new(0, 3, 0)
    gui.AlwaysOnTop = true
    gui.Enabled = enabled
    gui.Parent = head
    table.insert(objects, gui)

    local name = Instance.new("TextLabel")
    name.Size = UDim2.new(1, 0, 0, 18)
    name.BackgroundTransparency = 1
    name.Text = player.Name
    name.TextColor3 = Color3.new(1, 1, 1)
    name.TextStrokeTransparency = 0.2
    name.Font = Enum.Font.GothamBold
    name.TextSize = 13
    name.Parent = gui

    local distance = Instance.new("TextLabel")
    distance.Position = UDim2.fromOffset(0, 18)
    distance.Size = UDim2.new(1, 0, 0, 16)
    distance.BackgroundTransparency = 1
    distance.TextColor3 = Color3.fromRGB(0, 220, 255)
    distance.TextStrokeTransparency = 0.2
    distance.Font = Enum.Font.Gotham
    distance.TextSize = 11
    distance.Parent = gui

    local background = Instance.new("Frame")
    background.Position = UDim2.fromOffset(25, 39)
    background.Size = UDim2.new(1, -50, 0, 8)
    background.BackgroundColor3 = Color3.fromRGB(55, 55, 55)
    background.BorderSizePixel = 0
    background.Parent = gui

    local healthBar = Instance.new("Frame")
    healthBar.Size = UDim2.fromScale(1, 1)
    healthBar.BackgroundColor3 = Color3.fromRGB(50, 255, 80)
    healthBar.BorderSizePixel = 0
    healthBar.Parent = background

    tracked[player] = {
        objects = objects,
        highlight = highlight,
        box = box,
        gui = gui,
        root = root,
        humanoid = humanoid,
        character = character,
        distance = distance,
        healthBar = healthBar,
    }
end

local function setupPlayer(player)
    if player == localPlayer then return end

    player.CharacterAdded:Connect(function(character)
        task.wait(0.2)
        createESP(player, character)
    end)

    player.CharacterRemoving:Connect(function()
        cleanup(player)
    end)

    if player.Character then
        task.spawn(createESP, player, player.Character)
    end
end

for _, player in ipairs(Players:GetPlayers()) do
    setupPlayer(player)
end

Players.PlayerAdded:Connect(setupPlayer)
Players.PlayerRemoving:Connect(cleanup)

UserInputService.InputBegan:Connect(function(input, processed)
    if processed then return end

    if input.KeyCode == Enum.KeyCode.RightShift then
        enabled = not enabled

        for _, data in pairs(tracked) do
            data.highlight.Enabled = enabled
            data.box.Visible = enabled
            data.gui.Enabled = enabled
        end
    end
end)

RunService.RenderStepped:Connect(function()
    local character = localPlayer.Character
    local myRoot = character and character:FindFirstChild("HumanoidRootPart")

    for player, data in pairs(tracked) do
        if not data.character.Parent then
            cleanup(player)
        else
            if myRoot then
                local distance =
                    (myRoot.Position - data.root.Position).Magnitude
                data.distance.Text =
                    string.format("%d studs", math.floor(distance))
            end

            local health = data.humanoid.Health
            local maxHealth = math.max(data.humanoid.MaxHealth, 1)
            local ratio = math.clamp(health / maxHealth, 0, 1)

            data.healthBar.Size = UDim2.fromScale(ratio, 1)
            data.healthBar.BackgroundColor3 = Color3.fromRGB(
                255 * (1 - ratio),
                255 * ratio,
                50
            )
        end
    end
end)

print("Player ESP loaded. Press Right Shift to toggle.")
