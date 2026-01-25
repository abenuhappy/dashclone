
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 450;

const GAME_WIDTH = 800;
const GAME_HEIGHT = 450;
const BASE_GROUND_Y = 380; // Renamed from GROUND_Y
const CEILING_Y = 70;

// Game Constants
const GRAVITY = 0.6;
const JUMP_FORCE = -10.5;
const BASE_SPEED = 5;
const OBSTACLE_LIMIT = 500;

// Colors
const COLORS = {
    player: '#FACC15', // Yellow-400
    ground: '#1f2937',
    triangle: '#FFFFFF',
    pentagon: '#FFFFFF',
    crack: '#FFFFFF',
    star: '#FFFFFF',
    shield: '#10B981', // Emerald-500
    coin: '#FCD34D',
    portal: '#8B5CF6', // Violet
    firework: ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6']
};

// Utils
function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

function checkRectCollide(r1, r2) {
    return (
        r1.x < r2.x + r2.w &&
        r1.x + r1.w > r2.x &&
        r1.y < r2.y + r2.h &&
        r1.y + r1.h > r2.y
    );
}

// Circle collision for Coin/Shield
function checkCircleRectCollide(circle, rect) {
    let distX = Math.abs(circle.x - rect.x - rect.w / 2);
    let distY = Math.abs(circle.y - rect.y - rect.h / 2);

    if (distX > (rect.w / 2 + circle.r)) { return false; }
    if (distY > (rect.h / 2 + circle.r)) { return false; }

    if (distX <= (rect.w / 2)) { return true; }
    if (distY <= (rect.h / 2)) { return true; }

    let dx = distX - rect.w / 2;
    let dy = distY - rect.h / 2;
    return (dx * dx + dy * dy <= (circle.r * circle.r));
}

// Classes

class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
        this.bgmOscs = [];
        this.bgmGain = null;
        this.isBGMPlaying = false;
        this.bgmInterval = null;
        this.noteIndex = 0;
        // Simple loop: C3, C3, Eb3, Eb3, F3, F3, G3, G3 (Techno-ish)
        // Frequencies: C3=130.81, Eb3=155.56, F3=174.61, G3=196.00
        this.melody = [130.81, 130.81, 155.56, 155.56, 174.61, 174.61, 196.00, 196.00];
    }

    startBGM() {
        if (!this.enabled || this.isBGMPlaying) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.isBGMPlaying = true;

        this.noteIndex = 0;
        this.playBGMNote();
        this.bgmInterval = setInterval(() => this.playBGMNote(), 250); // 240 BPM eighth notes roughly
    }

    stopBGM() {
        this.isBGMPlaying = false;
        if (this.bgmInterval) clearInterval(this.bgmInterval);
        this.bgmOscs.forEach(o => {
            try { o.stop(); } catch (e) { }
        });
        this.bgmOscs = [];
    }

    playBGMNote() {
        if (!this.isBGMPlaying) return;

        const now = this.ctx.currentTime;
        const freq = this.melody[this.noteIndex % this.melody.length];
        this.noteIndex++;

        // Bass/Lead synth
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.05, now); // Low volume
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.2);

        // Keep track to stop if needed (though these stop auto)
        // For distinct stop, we might not need to track all, just long running ones.
    }

    play(type) {
        if (!this.enabled) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const now = this.ctx.currentTime;

        if (type === 'jump') {
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'coin') {
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.setValueAtTime(1600, now + 0.05);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'die') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'shield') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.1);
            osc.frequency.linearRampToValueAtTime(400, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'portal') {
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.linearRampToValueAtTime(400, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'win') {
            this.playNote(523.25, now, 0.1);
            this.playNote(659.25, now + 0.1, 0.1);
            this.playNote(783.99, now + 0.2, 0.2);
            this.playNote(1046.50, now + 0.4, 0.6);
        }
    }

    playNote(freq, time, duration) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        osc.start(time);
        osc.stop(time + duration);
    }
}

class Background {
    constructor() {
        this.image = new Image();
        this.image.src = 'image.png'; // Using the requested image
        this.x = 0;
        this.speedFactor = 0.5; // Parallax effect
        this.loaded = false;
        this.image.onload = () => { this.loaded = true; };
    }

    update(speed) {
        this.x -= speed * this.speedFactor;
        if (this.x <= -GAME_WIDTH) {
            this.x = 0;
        }
    }

    draw(ctx) {
        if (!this.loaded) {
            // Fallback background
            let gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
            gradient.addColorStop(0, '#111827');
            gradient.addColorStop(1, '#374151');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            return;
        }
        // Draw two images for seamless scrolling
        ctx.drawImage(this.image, this.x, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.drawImage(this.image, this.x + GAME_WIDTH, 0, GAME_WIDTH, GAME_HEIGHT);
    }
}

class Player {
    constructor() {
        this.w = 30;
        this.h = 30;
        this.x = 100;
        this.y = BASE_GROUND_Y - this.h;
        this.vy = 0;
        this.isGrounded = true;
        this.rotation = 0;
        this.jumpCount = 0;
        this.shieldCount = 0;
        this.shieldTimer = 0;
        this.dead = false;
    }

    jump(inverted) {
        if (this.isGrounded) {
            this.vy = inverted ? -JUMP_FORCE : JUMP_FORCE;
            this.isGrounded = false;
            this.jumpCount = 1;
            return true;
        } else if (this.jumpCount < 2) {
            this.vy = inverted ? -JUMP_FORCE : JUMP_FORCE;
            this.jumpCount++;
            return true;
            // Optional: Reset rotation to look cool or spin faster
            // this.rotation = 0; 
        }
        return false;
    }

    update(inverted, groundYAtPlayer, ceilingYAtPlayer = CEILING_Y) {
        if (this.dead) return;

        // Gravity
        if (inverted) {
            this.vy -= GRAVITY;
        } else {
            this.vy += GRAVITY;
        }
        this.y += this.vy;

        // Ground/Ceiling check
        if (inverted) {
            // Ceiling logic remains mostly simple for now, unless we want variable ceiling too?
            // For now, let's keep ceiling flat or use the passed value if we want.
            if (this.y <= CEILING_Y) {
                this.y = CEILING_Y;
                this.vy = 0;
                this.isGrounded = true;
                this.rotation = Math.round(this.rotation / 90) * 90;
            } else {
                this.rotation -= 5;
            }
        } else {
            // Check landing on ground
            if (this.y >= groundYAtPlayer - this.h) {
                // If we were falling and now we are lower than ground, snap to ground.
                // BUT, if the ground went UP abruptly (stairs), and we were physically below the top edge horizontally...
                // That side-collision check needs to happen outside or carefully here.
                // For this simple update loop, we snap if close enough or falling.

                // If we are significantly below ground, it implies we hit a wall or fell through?
                // For a runner, usually we test: if (y + vy > groundY) -> land.

                this.y = groundYAtPlayer - this.h;
                this.vy = 0;
                this.isGrounded = true;
                this.rotation = Math.round(this.rotation / 90) * 90;
            } else {
                this.rotation += 5;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
        ctx.rotate(this.rotation * Math.PI / 180);

        // Draw Player (Square)
        ctx.fillStyle = COLORS.player;
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLORS.player;
        ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);

        // Eye (to make it look like a character)
        ctx.fillStyle = '#000';
        ctx.fillRect(2, -8, 6, 6);

        ctx.restore();

        // Draw Shield
        if (this.shieldCount > 0) {
            ctx.strokeStyle = COLORS.shield;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 25, 0, Math.PI * 2);
            ctx.stroke();

            // Draw Count
            ctx.fillStyle = COLORS.shield;
            ctx.font = '12px Outfit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Show count at top right of shield or center
            ctx.fillText(this.shieldCount, this.x + this.w / 2 + 15, this.y + this.h / 2 - 15);

            ctx.shadowBlur = 0;
        }
    }
}

class Obstacle {
    constructor(type, x, yGround = BASE_GROUND_Y, speedMultiplier = 1, isCeiling = false) {
        this.type = type;
        this.x = x;
        this.isCeiling = isCeiling;
        this.w = 30;
        this.h = 30;
        this.y = isCeiling ? CEILING_Y : yGround - this.h;
        this.marked = false; // To count score only once
        this.speedMultiplier = speedMultiplier; // For stars

        // Setup specific dimensions
        if (type === 'pentagon' || type === 'pentagon2x') {
            this.w = 35; this.h = 35;
            this.y = isCeiling ? CEILING_Y : yGround - this.h;
        }
        if (type === 'triangle2x') {
            this.w = 50; this.h = 50;
            this.y = isCeiling ? CEILING_Y : yGround - this.h;
        }
        if (type === 'pentagon2x') {
            this.w = 60; this.h = 60;
            this.y = isCeiling ? CEILING_Y : yGround - this.h;
        }
        if (type === 'crack') {
            this.w = 40; this.h = 10;
            this.y = isCeiling ? CEILING_Y - 10 : yGround; // On the ground/ceiling
        }
        if (type === 'star') {
            this.w = 30; this.h = 30;
            this.y = isCeiling ? CEILING_Y + 80 : yGround - 80;
        }
    }

    update(speed) {
        let moveSpeed = speed;
        // Stars come from right, maybe faster? 
        // "Right flying star" -> Usually means it moves towards player.
        // If it's a static obstacle relative to world, it moves at world speed.
        // If it "flies from right", it might be faster than world.
        if (this.type === 'star') {
            moveSpeed = speed * 1.5;
        }

        this.x -= moveSpeed;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.w / 2, this.y + this.h / 2);

        if (this.type.includes('triangle')) {
            ctx.fillStyle = COLORS.triangle;
            ctx.beginPath();
            ctx.moveTo(0, -this.h / 2);
            ctx.lineTo(this.w / 2, this.h / 2);
            ctx.lineTo(-this.w / 2, this.h / 2);
            ctx.closePath();
            ctx.fill();
        }
        else if (this.type.includes('pentagon')) {
            ctx.fillStyle = COLORS.pentagon;
            // Simple pentagon approx
            ctx.beginPath();
            ctx.moveTo(0, -this.h / 2);
            ctx.lineTo(this.w / 2, -this.h / 6);
            ctx.lineTo(this.w / 3, this.h / 2);
            ctx.lineTo(-this.w / 3, this.h / 2);
            ctx.lineTo(-this.w / 2, -this.h / 6);
            ctx.closePath();
            ctx.fill();
        }
        else if (this.type === 'crack') {
            ctx.fillStyle = COLORS.crack;
            ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
        }
        else if (this.type === 'star') {
            ctx.fillStyle = COLORS.star;
            // Draw Star
            let rot = Math.PI / 2 * 3;
            let cx = 0; let cy = 0;
            let spikes = 5; let outerRadius = 15; let innerRadius = 7;
            let x = 0; let y = 0;
            ctx.beginPath();
            ctx.moveTo(0, -outerRadius);
            for (let i = 0; i < spikes; i++) {
                x = cx + Math.cos(rot) * outerRadius;
                y = cy + Math.sin(rot) * outerRadius;
                ctx.lineTo(x, y);
                rot += Math.PI / spikes;
                x = cx + Math.cos(rot) * innerRadius;
                y = cy + Math.sin(rot) * innerRadius;
                ctx.lineTo(x, y);
                rot += Math.PI / spikes;
            }
            ctx.lineTo(0, -outerRadius);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    // Custom collision box for precision
    getRect() {
        if (this.type === 'crack') return { x: -999, y: -999, w: 0, h: 0 }; // Cracks don't kill separate from pits? 
        // Wait, "Ground Crack" is an obstacle. Usually means a spike or pit. 
        // Assuming spike-like behavior.

        // Shrink hitboxes slightly for fairness
        return {
            x: this.x + 5,
            y: this.y + 5,
            w: this.w - 10,
            h: this.h - 10
        };
    }
}

class Item {
    constructor(type, x, yGround = BASE_GROUND_Y) {
        this.type = type; // 'shield', 'coin'
        this.x = x;
        this.y = randomRange(yGround - 120, yGround - 40);
        this.r = 15;
        this.collected = false;
        this.w = 30; this.h = 30; // for rect collision compat
    }

    update(speed) {
        this.x -= speed;
    }

    draw(ctx) {
        if (this.collected) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.type === 'shield') {
            ctx.fillStyle = COLORS.shield;
            ctx.beginPath();
            ctx.arc(0, 0, this.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '12px Outfit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('S', 0, 0);
        } else if (this.type === 'coin') {
            ctx.fillStyle = COLORS.coin;
            ctx.beginPath();
            ctx.arc(0, 0, this.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#B45309';
            ctx.fillText('C', 0, 0);
        }

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = randomRange(-5, 5);
        this.vy = randomRange(-5, 5);
        this.life = 100;
        this.alpha = 1;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 2;
        this.alpha = this.life / 100;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 4, 4);
        ctx.restore();
    }
}

class Portal {
    constructor(type, x) {
        this.type = type; // 'flip', 'normal'
        this.x = x;
        this.w = 40;
        this.h = 80;
        this.y = BASE_GROUND_Y - this.h - 20; // Float slightly
        if (type === 'normal') this.y = CEILING_Y + 20; // If restoring from ceiling run
        this.collected = false;
        this.pulse = 0;
    }

    update(speed) {
        this.x -= speed;
        this.pulse += 0.1;
    }

    draw(ctx) {
        if (this.collected) return;
        ctx.save();
        ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
        let scale = 1 + Math.sin(this.pulse) * 0.1;
        ctx.scale(scale, scale);

        ctx.fillStyle = COLORS.portal;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLORS.portal;
        ctx.beginPath();
        // Ellipse shape
        ctx.ellipse(0, 0, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner swirl/detail
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.w / 4, this.h / 4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class FloorSegment {
    constructor(x, y, w) {
        this.x = x;
        this.y = y;
        this.w = w;
    }

    draw(ctx) {
        ctx.fillStyle = COLORS.ground;
        ctx.fillRect(this.x, this.y, this.w, GAME_HEIGHT - this.y);

        // Optional: Highlight top edge
        ctx.fillStyle = '#374151'; // Lighter gray
        ctx.fillRect(this.x, this.y, this.w, 4);
    }
}

// Game Manager
class Game {
    constructor() {
        this.state = 'start'; // start, countdown, playing, gameover, victory
        this.score = 0; // Obstacles passed
        this.coins = 0;
        this.speed = 1.1 * BASE_SPEED;
        this.speedLevel = 1.1;

        this.player = new Player();
        this.background = new Background();
        this.obstacles = [];
        this.items = [];
        this.particles = [];
        this.soundManager = new SoundManager();

        this.gravityInverted = false;
        this.portals = [];
        this.spawned80Portal = false;
        this.spawned100Portal = false;

        // Floor Management
        this.floorSegments = [];
        this.initFloor();

        // Floor Generation State
        this.floorState = 'flat'; // flat, bumpy, stairs
        this.floorStateTimer = 0;
        this.currentFloorY = BASE_GROUND_Y;
        this.lastFloorX = 0; // Track the end of the last segment

        this.frameCount = 0;
        this.failedAttempts = 0;

        this.lastSpawnX = GAME_WIDTH;
        this.obstacleCount = 0;
        this.lastSpeedIncreaseAt = 0;
        this.pendingShields = 0;

        // Initialize irregular gap
        this.nextGap = randomRange(200, 400);

        // Progression flags
        this.unlocked = {
            basic: true,
            star: false,
            tri2x: false,
            pent2x: false,
            doubleStar: false
        };

        // Elements
        this.uiScore = document.getElementById('score');
        this.uiCoins = document.getElementById('coins');
        this.finalScore = document.getElementById('final-score');
        this.startScreen = document.getElementById('start-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.victoryScreen = document.getElementById('victory-screen');
        this.countdownOverlay = document.getElementById('countdown-overlay');

        // Bindings
        this.handleInput = this.handleInput.bind(this);
        this.reset = this.reset.bind(this);
        this.loop = this.loop.bind(this);

        // Input Handling - Bind to container to catch clicks on UI layers too
        const container = document.getElementById('game-container');

        const handleInteraction = (e) => {
            if (e.target.closest('button')) return; // Ignore button clicks
            if (e.type === 'touchstart') e.preventDefault(); // Prevent scrolling

            // Mobile Audio Unlock
            if (this.soundManager.ctx.state === 'suspended') {
                this.soundManager.ctx.resume().then(() => {
                    // Force a silent note to wake up the audio engine fully (iOS fix)
                    const osc = this.soundManager.ctx.createOscillator();
                    const gain = this.soundManager.ctx.createGain();
                    gain.gain.value = 0;
                    osc.connect(gain);
                    gain.connect(this.soundManager.ctx.destination);
                    osc.start();
                    osc.stop(this.soundManager.ctx.currentTime + 0.01);
                });
            }

            this.handleInput();
        };

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') this.handleInput();
        });

        // Mouse & Touch
        container.addEventListener('mousedown', handleInteraction);
        container.addEventListener('touchstart', handleInteraction, { passive: false });

        document.getElementById('btn-restart').addEventListener('click', this.reset);
        document.getElementById('btn-restart-victory').addEventListener('click', this.reset);

        requestAnimationFrame(this.loop);
    }

    reset() {
        location.reload();
    }

    initFloor() {
        // Initial flat floor
        this.floorSegments.push(new FloorSegment(0, BASE_GROUND_Y, GAME_WIDTH * 2));
        this.lastFloorX = GAME_WIDTH * 2;
        this.currentFloorY = BASE_GROUND_Y;
    }

    updateFloor(speed) {
        // Move segments
        for (let i = this.floorSegments.length - 1; i >= 0; i--) {
            this.floorSegments[i].x -= speed;
            if (this.floorSegments[i].x + this.floorSegments[i].w < -100) {
                this.floorSegments.splice(i, 1);
            }
        }
        this.lastFloorX -= speed;

        // Generate new segments if needed
        while (this.lastFloorX < GAME_WIDTH + 800) {
            this.generateNextFloorSegment();
        }
    }

    generateNextFloorSegment() {
        let segW = 100; // default segment width

        // Determine State
        if (this.score > 40 && this.floorStateTimer <= 0) {
            // Randomly pick a new state
            let rand = Math.random();
            if (rand < 0.4) {
                this.floorState = 'flat';
                this.floorStateTimer = randomRange(5, 10); // Segments
            } else if (rand < 0.7) {
                this.floorState = 'bumpy'; // Small fluctuations
                this.floorStateTimer = randomRange(5, 15);
            } else {
                this.floorState = 'stairs'; // Bigger steps up/down
                this.floorStateTimer = randomRange(5, 10);
            }
        } else {
            this.floorStateTimer--;
        }

        // Logic
        let nextY = this.currentFloorY;

        if (this.score <= 40) {
            this.floorState = 'flat'; // Force flat early on
        }

        if (this.floorState === 'flat') {
            // Slowly return to base if not
            if (nextY > BASE_GROUND_Y) nextY -= 10;
            else if (nextY < BASE_GROUND_Y) nextY += 10;
            if (Math.abs(nextY - BASE_GROUND_Y) < 10) nextY = BASE_GROUND_Y;
            segW = randomRange(200, 400);
        } else if (this.floorState === 'bumpy') {
            segW = randomRange(50, 150);
            // Random small height change
            let change = randomRange(-20, 20);
            nextY += change;
        } else if (this.floorState === 'stairs') {
            segW = randomRange(100, 200);
            // Big step
            let step = Math.random() < 0.5 ? -40 : 40;
            nextY += step;
        }

        // Clamp
        if (nextY > BASE_GROUND_Y + 50) nextY = BASE_GROUND_Y; // Don't go too low (deep pit)
        if (nextY < BASE_GROUND_Y - 150) nextY = BASE_GROUND_Y - 150; // Don't go too high

        // Create Segment
        this.floorSegments.push(new FloorSegment(this.lastFloorX, nextY, segW));
        this.lastFloorX += segW;
        this.currentFloorY = nextY;
    }

    getGroundYAt(x) {
        // Find segment under x
        // x in world coords? 
        // Players x is static (100). But logic uses player.x.
        // The segments move, so we check against segment.x

        for (let seg of this.floorSegments) {
            if (x >= seg.x && x < seg.x + seg.w) {
                return seg.y;
            }
        }
        return GAME_HEIGHT + 100; // Fall to death if no ground (gap)
    }

    handleInput() {
        if (this.state === 'start' || this.state === 'gameover' || this.state === 'victory') {
            if (this.state === 'start') this.startCountdown();
        } else if (this.state === 'playing') {
            if (this.player.jump(this.gravityInverted)) {
                this.soundManager.play('jump');
            }
        }
    }

    startCountdown() {
        this.soundManager.startBGM();
        this.state = 'countdown';
        this.startScreen.classList.remove('active');
        this.gameOverScreen.classList.remove('active');
        this.victoryScreen.classList.remove('active');

        let count = 3;
        const tick = () => {
            if (count > 0) {
                // this.soundManager.play('coin'); // tick sound? maybe annoying
                this.countdownOverlay.innerText = count;
                this.countdownOverlay.classList.remove('animate');
                void this.countdownOverlay.offsetWidth; // Trigger reflow
                this.countdownOverlay.classList.add('animate');
                setTimeout(() => {
                    count--;
                    tick();
                }, 1000);
            } else {
                this.countdownOverlay.innerText = 'GO!';
                this.countdownOverlay.classList.remove('animate');
                void this.countdownOverlay.offsetWidth;
                this.countdownOverlay.classList.add('animate');
                setTimeout(() => {
                    this.state = 'playing';
                    this.countdownOverlay.innerText = '';
                }, 500);
            }
        };
        tick();
    }

    reset() {
        location.reload();
    }

    spawnObstacle() {
        // Use pre-calculated gap for irregular intervals
        if (this.lastSpawnX < GAME_WIDTH - this.nextGap) {
            let currentGap = this.nextGap;

            // 80 -> Flip
            if (this.score >= 80 && !this.spawned80Portal) {
                this.spawned80Portal = true;
                let p = new Portal('flip', GAME_WIDTH + 50);
                this.portals.push(p);
                this.lastSpawnX = GAME_WIDTH + 150;
                return;
            }

            // 100 -> Normal
            if (this.score >= 100 && !this.spawned100Portal) {
                this.spawned100Portal = true;
                let p = new Portal('normal', GAME_WIDTH + 50);
                this.portals.push(p);
                this.lastSpawnX = GAME_WIDTH + 150;
                return;
            }

            // --- Advanced Logic for Score 200-500 ---
            if (this.score >= 200 && this.score <= 500) {
                let isStarRun = Math.random() < 0.3; // 30% chance for stars

                if (isStarRun) {
                    // Random star count (1 to 3)
                    let count = Math.floor(randomRange(1, 4));
                    let startX = GAME_WIDTH + 50;
                    for (let i = 0; i < count; i++) {
                        let sx = startX + (i * 100); // 100px spacing
                        let sy = this.getGroundYAt(sx);
                        let s = new Obstacle('star', sx, sy, 1, this.gravityInverted);
                        // Randomize Y offset for flight variety
                        if (this.gravityInverted) s.y += randomRange(0, 50);
                        else s.y -= randomRange(0, 50);

                        this.obstacles.push(s);
                    }
                    this.lastSpawnX = startX + (count * 100);
                } else {
                    // Ground Cluster (2 or 3)
                    let count = Math.floor(randomRange(2, 4)); // 2 or 3
                    // Choose type
                    let types = ['triangle', 'pentagon'];
                    // Add 2x variants purely randomly
                    if (Math.random() < 0.3) types.push('triangle2x');
                    if (Math.random() < 0.3) types.push('pentagon2x');

                    let chosenType = types[Math.floor(Math.random() * types.length)];

                    let startX = GAME_WIDTH + 50;
                    let spacing = 35; // Tight cluster
                    if (chosenType.includes('2x')) spacing = 65; // Bigger spacing for big ones

                    for (let i = 0; i < count; i++) {
                        let ox = startX + (i * spacing);
                        let oy = this.getGroundYAt(ox);
                        let obs = new Obstacle(chosenType, ox, oy, 1, this.gravityInverted);
                        this.obstacles.push(obs);
                    }
                    this.lastSpawnX = startX + (count * spacing) + 50;
                }

                // Set Gap for next
                this.nextGap = randomRange(300, 600); // More time to recover
                return;
            }
            // ----------------------------------------

            let type = 'triangle';

            // Normal Logic (< 200 or > 500)
            let types = ['triangle', 'pentagon'];
            if (this.unlocked.tri2x) types.push('triangle2x');
            if (this.unlocked.pent2x) types.push('pentagon2x');

            // Randomly choose from available
            let choice = types[Math.floor(Math.random() * types.length)];

            // Special: Star
            if (this.unlocked.star && Math.random() < 0.3) {
                choice = 'star';
            }

            // Calculate next gap
            let minGap = 200 + (this.speedLevel * 50);
            this.nextGap = randomRange(minGap, minGap + 350);

            // Double stars at 150 (legacy logic somewhat superseded by 200+ block but good for 150-199)
            if (this.unlocked.doubleStar && choice === 'star') {
                // Spawn 2 stars
                let y1 = this.getGroundYAt(GAME_WIDTH + 50);
                let star1 = new Obstacle('star', GAME_WIDTH + 50, y1, 1, this.gravityInverted);
                if (this.gravityInverted) star1.y += 30; else star1.y -= 30;

                this.obstacles.push(star1);

                let y2 = this.getGroundYAt(GAME_WIDTH + 150);
                let star2 = new Obstacle('star', GAME_WIDTH + 150, y2, 1, this.gravityInverted);
                this.obstacles.push(star2);

                this.lastSpawnX = GAME_WIDTH + 150;
                return;
            }

            // Normal Obstacle Spawn
            let currentFloorY = this.getGroundYAt(GAME_WIDTH + 50);
            let obs = new Obstacle(choice, GAME_WIDTH + 50, currentFloorY, 1, this.gravityInverted);
            this.obstacles.push(obs);
            this.lastSpawnX = GAME_WIDTH + 50;

            // Spawn Coin between obstacles?
            if (Math.random() > 0.5) {
                let coinX = GAME_WIDTH - currentGap / 2;
                this.items.push(new Item('coin', coinX, this.getGroundYAt(coinX)));
            }

            // Spawn Shield Item?
            this.spawnedCount = (this.spawnedCount || 0) + 1;

            let spawnShield = false;
            if (this.spawnedCount % 50 === 0) spawnShield = true;
            if (this.pendingShields > 0) {
                spawnShield = true;
                this.pendingShields--;
            }

            if (spawnShield) {
                let sX = GAME_WIDTH + 150;
                this.items.push(new Item('shield', sX, this.getGroundYAt(sX))); // After current obs
            }
        }
    }

    checkProgression() {
        // Unlock Logic based on Passed Obstacles (this.score)
        let s = this.score;
        let prevUnlocks = { ...this.unlocked };

        if (s >= 60) this.unlocked.star = true;
        if (s >= 100) this.unlocked.tri2x = true;
        if (s >= 120) this.unlocked.pent2x = true;
        if (s >= 150) this.unlocked.doubleStar = true;

        // Check if new unlock happened
        let newUnlock = (
            (!prevUnlocks.star && this.unlocked.star) ||
            (!prevUnlocks.tri2x && this.unlocked.tri2x) ||
            (!prevUnlocks.pent2x && this.unlocked.pent2x) ||
            (!prevUnlocks.doubleStar && this.unlocked.doubleStar)
        );

        if (newUnlock) {
            this.recentlyUnlocked = true;
            // "Speed increase delayed once in section where new obstacle appears"
            // We set a flag to skip NEXT speed increase.
        }

        // Speed Logic
        // "Speed increases by 0.1 every 50"
        let speedMilestone = Math.floor(s / 50);
        if (speedMilestone > (this.lastSpeedIncreaseAt || 0)) {
            // Milestone reached.
            if (this.recentlyUnlocked) {
                // Skip increase
                this.recentlyUnlocked = false; // Consumed the skip
                console.log("Speed increase skipped due to new content");
            } else {
                this.speedLevel += 0.1;
                this.speed = this.speedLevel * BASE_SPEED;
                console.log("Speed increased to", this.speedLevel);
            }
            this.lastSpeedIncreaseAt = speedMilestone;
        }
    }

    createFireworks() {
        for (let i = 0; i < 100; i++) {
            this.particles.push(new Particle(GAME_WIDTH / 2, GAME_HEIGHT / 2, COLORS.firework[Math.floor(Math.random() * COLORS.firework.length)]));
        }
    }

    update() {
        this.background.update(this.speed);
        this.updateFloor(this.speed);

        // Get floor height at player center
        let playerCenterX = this.player.x + this.player.w / 2;
        let groundY = this.getGroundYAt(playerCenterX);

        // Check Horizontal Collision with Wall (Step Up)
        // If player is below ground level of the segment they are entering
        // We need to check roughly ahead of the player
        let frontX = this.player.x + this.player.w;
        let groundYAtFront = this.getGroundYAt(frontX);

        if (!this.gravityInverted && !this.player.dead) {
            if (this.player.y + this.player.h > groundYAtFront + 5) {
                // We are hitting the side of a step!
                // Using +5 as tolerance
                // But only if we are moving forward relative to the ground? 
                // Ground is moving left. Player is static X. effectively player moves right relative to ground.

                // If the ground at Front is higher than Player Bottom, and we are close...
                // Ideally this check happens continuously.

                // Simple version: if we overlap with a "wall" formed by the step.
            }
        }

        this.player.update(this.gravityInverted, groundY);

        // Post-update collision check: Did we get stuck inside a floor?
        // Or did we hit a wall?
        if (!this.player.dead) {
            let pRight = this.player.x + this.player.w - 5;
            let pBottom = this.player.y + this.player.h - 5;
            let gFront = this.getGroundYAt(pRight);

            // If player's bottom is significantly lower than the ground height at their front face -> crash
            if (!this.gravityInverted && pBottom > gFront + 5 && this.player.y < gFront) {
                // Hit a wall
                this.soundManager.play('die');
                this.gameOver();
            }
            if (this.gravityInverted) {
                // Cieling collision if needed
                // For now, let's assume flat ceiling or reuse logic inverted
            }

            // Also check falling into pit (too deep)
            if (this.player.y > GAME_HEIGHT) {
                this.soundManager.play('die');
                this.gameOver();
            }
        }

        // Spawn
        this.lastSpawnX -= this.speed;
        this.spawnObstacle();

        // Obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i];
            obs.update(this.speed);

            // Bounds
            if (obs.x + obs.w < 0) {
                this.obstacles.splice(i, 1);
                continue;
            }

            // Pass count
            if (!obs.marked && obs.x + obs.w < this.player.x) {
                obs.marked = true;
                this.score++;
                this.uiScore.innerText = this.score;
                this.checkProgression();

                if (this.score >= OBSTACLE_LIMIT) {
                    this.winGame();
                }
            }

            // Collision
            // checkRectCollide is simple.
            // Player vs Obstacle
            let pRect = { x: this.player.x, y: this.player.y, w: this.player.w, h: this.player.h };
            let oRect = obs.getRect();

            if (checkRectCollide(pRect, oRect)) {
                if (this.player.shieldCount > 0) {
                    this.player.shieldCount--;
                    // Visual feedback for shield break?
                    this.soundManager.play('shield');
                    this.obstacles.splice(i, 1); // Remove obstacle "ignored"
                } else {
                    this.soundManager.play('die');
                    this.gameOver();
                }
            }
        }

        // Items
        for (let i = this.items.length - 1; i >= 0; i--) {
            let item = this.items[i];
            item.update(this.speed);

            if (item.x + 30 < 0) {
                this.items.splice(i, 1);
                continue;
            }

            // Collision
            let pRect = { x: this.player.x, y: this.player.y, w: this.player.w, h: this.player.h };
            if (checkCircleRectCollide({ x: item.x, y: item.y, r: item.r }, pRect)) {
                if (item.type === 'shield') {
                    this.soundManager.play('shield');
                    this.player.shieldCount++;
                } else if (item.type === 'coin') {
                    this.soundManager.play('coin');
                    this.coins++;
                    if (this.coins % 30 === 0) {
                        this.pendingShields++;
                    }
                    this.uiCoins.innerText = this.coins;
                }
                this.items.splice(i, 1);
            }
        }

        // Portals
        for (let i = this.portals.length - 1; i >= 0; i--) {
            let p = this.portals[i];
            p.update(this.speed);

            if (p.x + p.w < 0) {
                this.portals.splice(i, 1);
                continue;
            }
            p.draw(ctx);

            if (!p.collected) {
                let pRect = { x: this.player.x, y: this.player.y, w: this.player.w, h: this.player.h };
                let portalRect = { x: p.x + 10, y: p.y, w: p.w - 20, h: p.h }; // Narrower hit box
                if (checkRectCollide(pRect, portalRect)) {
                    p.collected = true;
                    this.soundManager.play('portal');
                    if (p.type === 'flip') {
                        this.gravityInverted = true;
                        // Push player slightly to ensure they don't get stuck if mid-air transition
                    } else if (p.type === 'normal') {
                        this.gravityInverted = false;
                    }
                }
            }
        }

        // Particles
        this.particles.forEach((p, index) => {
            p.update();
            if (p.life <= 0) this.particles.splice(index, 1);
        });
    }

    winGame() {
        this.state = 'victory';
        this.soundManager.stopBGM();
        this.soundManager.play('win');
        this.victoryScreen.classList.add('active');
        this.createFireworks();
    }

    gameOver() {
        this.state = 'gameover';
        this.soundManager.stopBGM();
        this.player.dead = true;
        this.finalScore.innerText = this.score;
        this.gameOverScreen.classList.add('active');
    }

    draw() {
        // Clear
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Draw World
        this.background.draw(ctx);

        // Ground
        // ctx.fillStyle = COLORS.ground;
        // ctx.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
        this.floorSegments.forEach(seg => seg.draw(ctx));

        this.items.forEach(i => i.draw(ctx));
        this.obstacles.forEach(o => o.draw(ctx));
        this.player.draw(ctx);
        this.particles.forEach(p => p.draw(ctx));
    }

    loop() {
        if (this.state === 'playing') {
            this.update();
        }
        if (this.state === 'victory') {
            // Still draw particles
            this.particles.forEach((p, index) => {
                p.update();
                if (p.life <= 0) this.particles.splice(index, 1);
            });
        }
        this.draw();
        requestAnimationFrame(this.loop);
    }
}

// Start
const game = new Game();
