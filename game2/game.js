(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const overlay = document.querySelector("#overlay");
  const startButton = document.querySelector("#start-button");
  const pauseButton = document.querySelector("#pause-button");
  const soundToggle = document.querySelector("#sound-toggle");
  const keys = new Set();
  const touch = new Set();

  const WIDTH = 520;
  const HEIGHT = 640;
  const storeKey = "sky-raid-best";
  let state = "ready";
  let lastTime = 0;
  let elapsed = 0;
  let scroll = 0;
  let score = 0;
  let level = 1;
  let bombCount = 3;
  let fireTimer = 0;
  let spawnTimer = 0;
  let groundTimer = 0;
  let altitudeTimer = 0;
  let best = Number(localStorage.getItem(storeKey)) || 0;
  let enemies = [];
  let bullets = [];
  let bombs = [];
  let particles = [];
  let groundTargets = [];
  let scenery = [];
  let altitude = 42;
  let pointerActive = false;
  let audioContext = null;
  let soundEnabled = true;

  const player = { x: WIDTH / 2, y: HEIGHT - 105, w: 30, h: 38, speed: 245, lives: 3, invulnerable: 0, bank: 0 };
  const random = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function activateAudio() {
    if (!soundEnabled) return;
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") audioContext.resume();
  }

  function playTone(startFrequency, endFrequency, duration, type, volume) {
    if (!soundEnabled || !audioContext || audioContext.state !== "running") return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function playExplosion(duration = .2, volume = .08) {
    if (!soundEnabled || !audioContext || audioContext.state !== "running") return;
    const length = Math.floor(audioContext.sampleRate * duration);
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    source.start();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
  }

  function updateHud() {
    document.querySelector("#score").textContent = String(score).padStart(6, "0");
    document.querySelector("#best-score").textContent = String(best).padStart(6, "0");
    document.querySelector("#lives").textContent = `${"◆ ".repeat(Math.max(0, player.lives)).trim()}${player.lives ? "" : "—"}`;
    document.querySelector("#level").textContent = String(level).padStart(2, "0");
    document.querySelector("#bomb-count").textContent = `${"● ".repeat(bombCount)}${"○ ".repeat(3 - bombCount)}`.trim();
    document.querySelector("#altitude").textContent = `ALT ${String(altitude).padStart(4, "0")}`;
  }

  function showOverlay(kicker, title, copy, button) {
    document.querySelector("#overlay-kicker").textContent = kicker;
    document.querySelector("#overlay-title").textContent = title;
    document.querySelector("#overlay-copy").textContent = copy;
    startButton.innerHTML = `${button} <span>→</span>`;
    overlay.classList.remove("hidden");
  }

  function reset() {
    elapsed = 0;
    scroll = 0;
    score = 0;
    level = 1;
    bombCount = 3;
    fireTimer = 0;
    spawnTimer = .7;
    groundTimer = 1.2;
    altitudeTimer = 0;
    altitude = 42;
    enemies = [];
    bullets = [];
    bombs = [];
    particles = [];
    groundTargets = [];
    player.x = WIDTH / 2;
    player.y = HEIGHT - 105;
    player.lives = 3;
    player.invulnerable = 1.5;
    updateHud();
  }

  function start() {
    activateAudio();
    reset();
    state = "playing";
    overlay.classList.add("hidden");
    lastTime = performance.now();
  }

  function pause() {
    if (state === "playing") {
      state = "paused";
      showOverlay("SORTIE PAUSED", "작전 일시정지", "잠시 숨을 고르세요. 준비가 되면 작전을 재개할 수 있습니다.", "계속하기");
    } else if (state === "paused") {
      state = "playing";
      overlay.classList.add("hidden");
      lastTime = performance.now();
    }
  }

  function finish() {
    state = "gameover";
    if (score > best) {
      best = score;
      localStorage.setItem(storeKey, String(best));
    }
    updateHud();
    showOverlay("SORTIE COMPLETE", "작전 종료", `최종 점수 ${String(score).padStart(6, "0")}점 — 다시 출격해 기록에 도전하세요.`, "다시 출격");
  }

  function addScenery() {
    for (let i = 0; i < 24; i++) {
      scenery.push({ x: random(15, WIDTH - 15), y: random(0, HEIGHT), r: random(1, 3), shade: random(.08, .3) });
    }
  }

  function spawnEnemy() {
    const type = Math.random() < .72 ? "scout" : "fighter";
    const x = random(32, WIDTH - 32);
    enemies.push({
      type, x, y: -35, homeX: x, age: 0,
      fruit: ["apple", "orange", "pear", "strawberry", "lemon"][Math.floor(random(0, 5))],
      speed: type === "scout" ? random(85, 125) : random(65, 92),
      hp: type === "scout" ? 1 : 2,
      shoot: random(1.3, 2.8), phase: random(0, Math.PI * 2)
    });
  }

  function spawnGroundTarget() {
    const x = random(50, WIDTH - 50);
    groundTargets.push({ x, y: -35, hp: 1, type: Math.random() < .5 ? "radar" : "base" });
  }

  function shoot() {
    bullets.push({ x: player.x - 7, y: player.y - 20, vy: -470, kind: "air" });
    bullets.push({ x: player.x + 7, y: player.y - 20, vy: -470, kind: "air" });
    playTone(720, 280, .075, "square", .025);
  }

  function dropBomb() {
    if (bombCount <= 0) return;
    bombCount--;
    bombs.push({ x: player.x, y: player.y - 10, radius: 5, age: 0 });
    playTone(260, 100, .24, "sawtooth", .055);
    updateHud();
  }

  function burst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = random(0, Math.PI * 2);
      const speed = random(35, 150);
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: random(.25, .65), max: .65, color });
    }
  }

  function hitPlayer() {
    if (player.invulnerable > 0) return;
    player.lives--;
    player.invulnerable = 1.8;
    burst(player.x, player.y, "#a7f27c", 22);
    playExplosion(.32, .12);
    playTone(180, 55, .28, "sawtooth", .055);
    updateHud();
    if (player.lives <= 0) finish();
  }

  function overlaps(a, b, aw, ah, bw, bh) {
    return Math.abs(a.x - b.x) < (aw + bw) / 2 && Math.abs(a.y - b.y) < (ah + bh) / 2;
  }

  function update(dt) {
    elapsed += dt;
    scroll = (scroll + dt * (80 + level * 8)) % 80;
    altitudeTimer += dt;
    if (altitudeTimer >= .18) {
      altitude = (altitude + 1) % 10000;
      altitudeTimer = 0;
    }
    level = Math.min(9, 1 + Math.floor(score / 1200));

    let dx = 0;
    let dy = 0;
    if (keys.has("arrowleft") || keys.has("a") || touch.has("left")) dx--;
    if (keys.has("arrowright") || keys.has("d") || touch.has("right")) dx++;
    if (keys.has("arrowup") || keys.has("w") || touch.has("up")) dy--;
    if (keys.has("arrowdown") || keys.has("s") || touch.has("down")) dy++;
    const magnitude = dx && dy ? Math.SQRT1_2 : 1;
    player.x = clamp(player.x + dx * player.speed * magnitude * dt, 22, WIDTH - 22);
    player.y = clamp(player.y + dy * player.speed * magnitude * dt, HEIGHT * .48, HEIGHT - 38);
    player.bank += (dx * .13 - player.bank) * Math.min(1, dt * 8);

    player.invulnerable = Math.max(0, player.invulnerable - dt);
    fireTimer -= dt;
    if ((keys.has(" ") || touch.has("fire")) && fireTimer <= 0) {
      shoot();
      fireTimer = .17;
    }
    if (keys.has("x") || touch.has("bomb")) {
      if (!keys.has("x") || !touch.has("bomb")) dropBomb();
      keys.delete("x");
      touch.delete("bomb");
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnEnemy();
      spawnTimer = Math.max(.45, random(1.05, 1.55) - level * .055);
    }
    groundTimer -= dt;
    if (groundTimer <= 0) {
      spawnGroundTarget();
      groundTimer = random(2.4, 3.8);
    }

    for (const enemy of enemies) {
      enemy.age += dt;
      enemy.y += enemy.speed * dt;
      enemy.x = enemy.homeX + Math.sin(enemy.age * 2.2 + enemy.phase) * (enemy.type === "scout" ? 38 : 65);
      enemy.shoot -= dt;
      if (enemy.shoot <= 0 && enemy.y < player.y - 45) {
        bullets.push({ x: enemy.x, y: enemy.y + 13, vy: 170 + level * 8, kind: "enemy" });
        enemy.shoot = random(1.8, 3);
      }
      if (overlaps(player, enemy, player.w * .7, player.h * .7, 27, 24)) {
        enemy.dead = true;
        burst(enemy.x, enemy.y, "#ff9a54", 12);
        hitPlayer();
      }
    }
    enemies = enemies.filter(enemy => !enemy.dead && enemy.y < HEIGHT + 40);

    for (const bullet of bullets) {
      bullet.y += bullet.vy * dt;
      if (bullet.kind === "air") {
        for (const enemy of enemies) {
          if (!enemy.dead && overlaps(bullet, enemy, 5, 12, 24, 22)) {
            bullet.dead = true;
            enemy.hp--;
            if (enemy.hp <= 0) {
              enemy.dead = true;
              score += enemy.type === "scout" ? 100 : 180;
              burst(enemy.x, enemy.y, "#ffad69", 12);
              playTone(390, 150, .16, "triangle", .045);
              playExplosion(.14, .035);
            }
            break;
          }
        }
      } else if (overlaps(bullet, player, 7, 13, player.w * .65, player.h * .65)) {
        bullet.dead = true;
        hitPlayer();
      }
    }
    bullets = bullets.filter(bullet => !bullet.dead && bullet.y > -20 && bullet.y < HEIGHT + 20);

    for (const bomb of bombs) {
      bomb.age += dt;
      bomb.y -= 200 * dt;
      if (bomb.age > .42 && !bomb.exploded) {
        bomb.exploded = true;
        bomb.radius = 105;
        playExplosion(.4, .11);
        playTone(125, 35, .36, "sawtooth", .06);
        for (const target of groundTargets) {
          if (!target.dead && Math.abs(target.x - bomb.x) < bomb.radius && Math.abs(target.y - bomb.y) < bomb.radius) {
            target.dead = true;
            score += 250;
            burst(target.x, target.y, "#ff9a54", 15);
          }
        }
      }
      if (bomb.exploded) bomb.radius = Math.max(0, bomb.radius - 210 * dt);
    }
    bombs = bombs.filter(bomb => bomb.y > -20 && (!bomb.exploded || bomb.radius > 0));

    for (const target of groundTargets) target.y += (80 + level * 8) * dt;
    groundTargets = groundTargets.filter(target => !target.dead && target.y < HEIGHT + 40);
    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    particles = particles.filter(particle => particle.life > 0);
    for (const item of scenery) {
      item.y += (80 + level * 8) * dt;
      if (item.y > HEIGHT) { item.y = -4; item.x = random(15, WIDTH - 15); }
    }
    updateHud();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "#183728");
    gradient.addColorStop(.52, "#142d21");
    gradient.addColorStop(1, "#10271d");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#183b28";
    ctx.beginPath();
    ctx.moveTo(0, 80 - scroll);
    for (let y = -80 + (scroll % 80); y < HEIGHT + 80; y += 80) {
      ctx.lineTo(0, y + 40);
      ctx.lineTo(110, y);
      ctx.lineTo(260, y + 27);
      ctx.lineTo(390, y - 10);
      ctx.lineTo(WIDTH, y + 20);
      ctx.lineTo(WIDTH, y + 80);
    }
    ctx.lineTo(0, HEIGHT);
    ctx.closePath();
    ctx.globalAlpha = .42;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(181, 227, 159, .075)";
    ctx.lineWidth = 1;
    for (let x = 35; x < WIDTH; x += 65) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
    for (let y = scroll % 80; y < HEIGHT; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    for (const item of scenery) {
      ctx.fillStyle = `rgba(174, 218, 145, ${item.shade})`;
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer() {
    if (player.invulnerable > 0 && Math.floor(elapsed * 12) % 2 === 0) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.bank);
    ctx.fillStyle = "rgba(0, 0, 0, .3)";
    ctx.beginPath();
    ctx.ellipse(3, 10, 25, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    const wingGradient = ctx.createLinearGradient(-24, -2, 24, 14);
    wingGradient.addColorStop(0, "#56b9a2");
    wingGradient.addColorStop(.48, "#d0ff9a");
    wingGradient.addColorStop(1, "#70d7a7");
    ctx.fillStyle = "#ffae6a";
    ctx.beginPath();
    ctx.moveTo(-10, 18);
    ctx.lineTo(-5, 31 + Math.sin(elapsed * 28) * 3);
    ctx.lineTo(0, 19);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2, 19);
    ctx.lineTo(7, 30 + Math.sin(elapsed * 28 + 1) * 3);
    ctx.lineTo(11, 17);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#24483d";
    ctx.beginPath();
    ctx.moveTo(0, -27);
    ctx.lineTo(5, -12);
    ctx.lineTo(25, 2);
    ctx.lineTo(24, 9);
    ctx.lineTo(9, 6);
    ctx.lineTo(13, 19);
    ctx.lineTo(6, 17);
    ctx.lineTo(0, 12);
    ctx.lineTo(-6, 17);
    ctx.lineTo(-13, 19);
    ctx.lineTo(-9, 6);
    ctx.lineTo(-24, 9);
    ctx.lineTo(-25, 2);
    ctx.lineTo(-5, -12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = wingGradient;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.quadraticCurveTo(4, -28, 7, -11);
    ctx.lineTo(21, 3);
    ctx.lineTo(20, 6);
    ctx.lineTo(7, 3);
    ctx.lineTo(5, 17);
    ctx.lineTo(0, 13);
    ctx.lineTo(-5, 17);
    ctx.lineTo(-7, 3);
    ctx.lineTo(-20, 6);
    ctx.lineTo(-21, 3);
    ctx.lineTo(-7, -11);
    ctx.quadraticCurveTo(-4, -28, 0, -30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f3ffd9";
    ctx.beginPath();
    ctx.moveTo(-2, -17);
    ctx.quadraticCurveTo(-7, -8, -3, -1);
    ctx.lineTo(0, 2);
    ctx.lineTo(3, -1);
    ctx.quadraticCurveTo(7, -8, 2, -17);
    ctx.quadraticCurveTo(0, -20, -2, -17);
    ctx.fill();
    ctx.fillStyle = "#72baa0";
    ctx.fillRect(-16, 2, 7, 2);
    ctx.fillRect(9, 2, 7, 2);
    ctx.fillStyle = "#dffff0";
    ctx.fillRect(-1, -24, 2, 7);
    ctx.fillStyle = "#efffbc";
    ctx.beginPath();
    ctx.arc(0, -29, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = "rgba(0, 0, 0, .25)";
    ctx.beginPath();
    ctx.ellipse(2, 5, 23, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d88554";
    ctx.beginPath();
    ctx.moveTo(-11, -7);
    ctx.lineTo(-25, -13);
    ctx.lineTo(-21, -2);
    ctx.lineTo(-12, 1);
    ctx.moveTo(11, -7);
    ctx.lineTo(25, -13);
    ctx.lineTo(21, -2);
    ctx.lineTo(12, 1);
    ctx.fill();

    const fruitColors = {
      apple: ["#ff554e", "#c91f39"],
      orange: ["#ffc14f", "#f4772e"],
      pear: ["#d9ef67", "#83bd48"],
      strawberry: ["#ff6584", "#d92352"],
      lemon: ["#fff078", "#e7ae35"]
    };
    const [light, dark] = fruitColors[enemy.fruit];
    const fruitGradient = ctx.createRadialGradient(-7, -9, 2, 0, 1, 25);
    fruitGradient.addColorStop(0, light);
    fruitGradient.addColorStop(1, dark);
    ctx.fillStyle = fruitGradient;
    ctx.beginPath();
    if (enemy.fruit === "pear") {
      ctx.moveTo(0, -17);
      ctx.bezierCurveTo(4, -14, 5, -10, 9, -5);
      ctx.bezierCurveTo(20, 8, 12, 19, 0, 18);
      ctx.bezierCurveTo(-12, 19, -20, 8, -9, -5);
      ctx.bezierCurveTo(-5, -10, -4, -14, 0, -17);
    } else if (enemy.fruit === "strawberry") {
      ctx.moveTo(0, -15);
      ctx.bezierCurveTo(5, -20, 17, -15, 16, -5);
      ctx.bezierCurveTo(15, 4, 5, 14, 0, 19);
      ctx.bezierCurveTo(-5, 14, -15, 4, -16, -5);
      ctx.bezierCurveTo(-17, -15, -5, -20, 0, -15);
    } else if (enemy.fruit === "lemon") {
      ctx.moveTo(-19, 0);
      ctx.quadraticCurveTo(-10, -16, 0, -15);
      ctx.quadraticCurveTo(10, -16, 19, 0);
      ctx.quadraticCurveTo(10, 16, 0, 15);
      ctx.quadraticCurveTo(-10, 16, -19, 0);
    } else if (enemy.fruit === "apple") {
      ctx.moveTo(0, -15);
      ctx.bezierCurveTo(8, -22, 19, -12, 17, -3);
      ctx.bezierCurveTo(17, 9, 8, 17, 0, 16);
      ctx.bezierCurveTo(-8, 17, -17, 9, -17, -3);
      ctx.bezierCurveTo(-19, -12, -8, -22, 0, -15);
    } else {
      ctx.ellipse(0, 0, 16, 16, 0, 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 241, 190, .4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (enemy.fruit === "strawberry") {
      ctx.fillStyle = "#ffe6a3";
      for (const [x, y] of [[-8, -8], [0, -10], [8, -7], [-10, 0], [8, 1], [-5, 7], [4, 8]]) {
        ctx.beginPath();
        ctx.ellipse(x, y, 1, 2, -.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.strokeStyle = "#674532";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -18);
    ctx.quadraticCurveTo(-2, -23, 1, -20);
    ctx.stroke();
    ctx.fillStyle = "#72c66b";
    ctx.beginPath();
    ctx.ellipse(7, -17, 7, 3, -.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#498747";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, -17);
    ctx.lineTo(11, -18);
    ctx.stroke();

    ctx.fillStyle = "#fff8dc";
    ctx.beginPath();
    ctx.ellipse(-5, -1, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.ellipse(5, -1, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#422d37";
    ctx.beginPath();
    ctx.arc(-4, 0, 1.7, 0, Math.PI * 2);
    ctx.arc(6, 0, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#713b3d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, -7);
    ctx.lineTo(-3, -5);
    ctx.moveTo(3, -5);
    ctx.lineTo(9, -7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 5, 3, .15, Math.PI - .15);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 220, 180, .55)";
    ctx.beginPath();
    ctx.ellipse(-11, 4, 3, 1.5, 0, 0, Math.PI * 2);
    ctx.ellipse(11, 4, 3, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGroundTarget(target) {
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.fillStyle = "rgba(0, 0, 0, .25)";
    ctx.beginPath();
    ctx.ellipse(0, 3, 21, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    if (target.type === "radar") {
      ctx.strokeStyle = "#c5a56d";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -2, 10, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#b58e56";
      ctx.fillRect(-2, -1, 4, 13);
    } else {
      ctx.fillStyle = "#ad8052";
      ctx.fillRect(-13, -10, 26, 20);
      ctx.fillStyle = "#d1a26a";
      ctx.fillRect(-8, -5, 16, 10);
      ctx.fillStyle = "#69513a";
      ctx.fillRect(-3, -3, 6, 6);
    }
    ctx.restore();
  }

  function draw() {
    drawBackground();
    for (const target of groundTargets) drawGroundTarget(target);
    for (const bullet of bullets) {
      ctx.fillStyle = bullet.kind === "air" ? "#d9ffad" : "#ff7659";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 9;
      ctx.fillRect(bullet.x - 2, bullet.y - 6, 4, 12);
      ctx.shadowBlur = 0;
    }
    for (const bomb of bombs) {
      ctx.strokeStyle = "#ffb36c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bomb.x, bomb.y, Math.max(4, bomb.radius), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#fff0ce";
      ctx.beginPath();
      ctx.arc(bomb.x, bomb.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const enemy of enemies) drawEnemy(enemy);
    for (const particle of particles) {
      ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    if (state !== "gameover") drawPlayer();
    ctx.fillStyle = "rgba(4, 12, 8, .14)";
    for (let y = 0; y < HEIGHT; y += 4) ctx.fillRect(0, y, WIDTH, 1);
  }

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000 || 0, .04);
    lastTime = now;
    if (state === "playing") update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function pointerMove(event) {
    if (!pointerActive || state !== "playing") return;
    const rect = canvas.getBoundingClientRect();
    player.x = clamp((event.clientX - rect.left) / rect.width * WIDTH, 22, WIDTH - 22);
    player.y = clamp((event.clientY - rect.top) / rect.height * HEIGHT, HEIGHT * .48, HEIGHT - 38);
  }

  startButton.addEventListener("click", () => {
    if (state === "paused") pause();
    else start();
  });
  pauseButton.addEventListener("click", pause);
  soundToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    soundToggle.classList.toggle("muted", !soundEnabled);
    soundToggle.setAttribute("aria-label", soundEnabled ? "효과음 끄기" : "효과음 켜기");
    if (soundEnabled) activateAudio();
  });
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
    if (key === "escape" || key === "p") { pause(); return; }
    keys.add(key);
  });
  window.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
  canvas.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse") {
      pointerActive = true;
      canvas.setPointerCapture(event.pointerId);
      pointerMove(event);
    }
  });
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", () => { pointerActive = false; });
  document.querySelectorAll("[data-move]").forEach(button => {
    const direction = button.dataset.move;
    button.addEventListener("pointerdown", event => { event.preventDefault(); touch.add(direction); });
    for (const name of ["pointerup", "pointercancel", "pointerleave"]) {
      button.addEventListener(name, () => touch.delete(direction));
    }
  });
  document.querySelectorAll("[data-action]").forEach(button => {
    const action = button.dataset.action;
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      if (action === "fire") touch.add("fire");
      else touch.add("bomb");
    });
    for (const name of ["pointerup", "pointercancel", "pointerleave"]) {
      button.addEventListener(name, () => touch.delete(action));
    }
  });

  addScenery();
  resize();
  updateHud();
  requestAnimationFrame(loop);
})();
