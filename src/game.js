const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const stageEl = document.getElementById('stage');
const hpEl = document.getElementById('hp');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMessage = document.getElementById('overlayMessage');
const restartButton = document.getElementById('restartButton');

class BaseState {
  constructor(game) {
    this.game = game;
  }

  enter() {}
  exit() {}
  update() {}
  render() {}
  handleKeyDown() {}
  handleKeyUp() {}
  handleMouseMove() {}
  handleClick() {}
}

class PlayerState {
  constructor(player, stateMachine) {
    this.player = player;
    this.stateMachine = stateMachine;
  }

  enter() {}
  exit() {}
  update(dt) {}
}

class PlayerNormalState extends PlayerState {
  update(dt) {
    this.player.applyMovement(dt);
  }
}

class PlayerInvulnerableState extends PlayerState {
  constructor(player, stateMachine, duration = 1.2) {
    super(player, stateMachine);
    this.duration = duration;
    this.elapsed = 0;
  }

  enter() {
    this.elapsed = 0;
    this.player.invulnerable = true;
  }

  exit() {
    this.player.invulnerable = false;
  }

  update(dt) {
    this.player.applyMovement(dt);
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.stateMachine.transitionTo('normal');
    }
  }
}

class PlayerStateMachine {
  constructor(player) {
    this.player = player;
    this.states = {
      normal: new PlayerNormalState(player, this),
      invulnerable: new PlayerInvulnerableState(player, this)
    };
    this.currentState = null;
  }

  transitionTo(stateName) {
    if (this.currentState && this.currentState.exit) {
      this.currentState.exit();
    }

    this.currentState = this.states[stateName] || this.states.normal;
    if (this.currentState && this.currentState.enter) {
      this.currentState.enter();
    }
  }

  update(dt) {
    if (this.currentState && this.currentState.update) {
      this.currentState.update(dt);
    }
  }
}

class TitleState extends BaseState {
  enter() {
    this.game.showOverlay('GKT Shooter', 'Press Enter to start', true);
    this.game.playTitleBgm();
  }

  handleKeyDown(event) {
    if (event.key === 'Enter') {
      this.game.transitionTo('playing', { stage: 1 });
    }
  }

  handleClick() {
    this.game.transitionTo('playing', { stage: 1 });
  }
}

class PlayingState extends BaseState {
  enter(options = {}) {
    this.game.hideOverlay();
    this.game.stage = options.stage || this.game.stage;
    this.game.startStage(this.game.stage);
    this.game.playBgm();
  }

  update(dt) {
    if (this.game.playerHp <= 0) {
      this.game.transitionTo('gameover');
      return;
    }

    this.game.player.update(dt);
    this.game.shotCooldown -= dt;
    if (this.game.shotCooldown <= 0) {
      this.game.fireBullet();
      this.game.shotCooldown = 0.05;
    }

    this.game.updatePlayerBullets(dt);
    this.game.updateEnemyBullets(dt);
    this.game.updatePowerUps(dt);
    this.game.updateEnemies(dt);
    this.game.updateBoss(dt);
    this.game.updateParticles(dt);
    this.game.checkPlayerHit();
  }

  handleKeyDown(event) {
    if (event.key === 'Escape') {
      this.game.transitionTo('title');
    }
  }
}

class GameOverState extends BaseState {
  enter() {
    this.game.fadeOutBgm();
    this.game.showOverlay('Game Over', 'Press Enter to return to title');
  }

  handleKeyDown(event) {
    if (event.key === 'Enter') {
      this.game.transitionTo('title');
    }
  }

  handleClick() {
    this.game.transitionTo('title');
  }
}

class StageClearState extends BaseState {
  enter() {
    const message = this.game.stage >= this.game.maxStages
      ? 'Final stage cleared!'
      : 'Press Enter for the next stage';
    this.game.showOverlay(`Stage ${this.game.stage} Clear`, message);
  }

  handleKeyDown(event) {
    if (event.key === 'Enter') {
      if (this.game.stage >= this.game.maxStages) {
        this.game.transitionTo('gameclear');
      } else {
        this.game.transitionTo('playing', { stage: this.game.stage + 1 });
      }
    }
  }

  handleClick() {
    if (this.game.stage >= this.game.maxStages) {
      this.game.transitionTo('gameclear');
    } else {
      this.game.transitionTo('playing', { stage: this.game.stage + 1 });
    }
  }
}

class GameClearState extends BaseState {
  enter() {
    this.game.fadeOutBgm();
    this.game.showOverlay('Game Clear', 'Press Enter to return to title');
  }

  handleKeyDown(event) {
    if (event.key === 'Enter') {
      this.game.transitionTo('title');
    }
  }

  handleClick() {
    this.game.transitionTo('title');
  }
}

class GameStateMachine {
  constructor(game) {
    this.game = game;
    this.states = {
      title: new TitleState(game),
      playing: new PlayingState(game),
      gameover: new GameOverState(game),
      stageClear: new StageClearState(game),
      gameclear: new GameClearState(game)
    };
    this.currentState = null;
  }

  transitionTo(stateName, options = {}) {
    if (this.currentState && this.currentState.exit) {
      this.currentState.exit();
    }

    this.currentState = this.states[stateName];
    if (this.currentState && this.currentState.enter) {
      this.currentState.enter(options);
    }
  }

  update(dt) {
    if (this.currentState && this.currentState.update) {
      this.currentState.update(dt);
    }
  }

  handleKeyDown(event) {
    if (this.currentState && this.currentState.handleKeyDown) {
      this.currentState.handleKeyDown(event);
    }
  }

  handleKeyUp(event) {
    if (this.currentState && this.currentState.handleKeyUp) {
      this.currentState.handleKeyUp(event);
    }
  }

  handleMouseMove(event) {
    if (this.currentState && this.currentState.handleMouseMove) {
      this.currentState.handleMouseMove(event);
    }
  }

  handleClick() {
    if (this.currentState && this.currentState.handleClick) {
      this.currentState.handleClick();
    }
  }
}

class GameEngine {
  constructor() {
    const game = this;
    this.canvas = canvas;
    this.ctx = ctx;
    this.scoreEl = scoreEl;
    this.stageEl = stageEl;
    this.hpEl = hpEl;
    this.overlay = overlay;
    this.overlayTitle = document.getElementById('overlayTitle');
    this.overlayMessage = document.getElementById('overlayMessage');
    this.overlayLogo = document.getElementById('overlayLogo');
    this.restartButton = restartButton;
    this.keys = {}; 
    this.mouse = { x: canvas.width / 2, y: canvas.height - 120 };
    this.backgroundImage = new Image();
    this.backgroundImage.src = '../res/img/street.png';
    this.playerImage = new Image();
    this.playerImage.src = '../res/img/cat.png';
    this.bulletImage = new Image();
    this.bulletImage.src = '../res/img/btama.png';
    this.bgm = new Audio('../res/snd/bgm_street.ogg');
    this.bgm.loop = true;
    this.bgm.volume = 1;
    this.titleBgm = new Audio('../res/snd/bgm_title.ogg');
    this.titleBgm.loop = true;
    this.titleBgm.volume = 1;
    this.crossfadeDuration = 500;
    this.backgroundScrollV = 0;
    this.backgroundScrollSpeed = 90;
    this.score = 0;
    this.stage = 1;
    this.playerHp = 100;
    this.maxStages = 3;
    this.player = {
      x: canvas.width / 2,
      y: canvas.height - 110,
      width: 112,
      height: 136,
      speed: 280,
      invulnerable: false,
      stateMachine: null,
      transitionTo: (stateName) => {
        player.stateMachine.transitionTo(stateName);
      },
      applyMovement: (dt) => {
        let dx = 0;
        let dy = 0;

        if (game.keys['ArrowLeft'] || game.keys['a']) dx -= 1;
        if (game.keys['ArrowRight'] || game.keys['d']) dx += 1;
        if (game.keys['ArrowUp'] || game.keys['w']) dy -= 1;
        if (game.keys['ArrowDown'] || game.keys['s']) dy += 1;

        if (game.mouse.x !== undefined) {
          const tx = game.mouse.x - player.x;
          const ty = game.mouse.y - player.y;
          const dist = Math.hypot(tx, ty) || 1;
          const moveScale = Math.min(1, dt * 3.8);
          player.x += (tx / dist) * Math.min(player.speed * dt * moveScale, 220) * 0.65;
          player.y += (ty / dist) * Math.min(player.speed * dt * moveScale, 220) * 0.65;
        }

        if (dx || dy) {
          const len = Math.hypot(dx, dy) || 1;
          player.x += (dx / len) * player.speed * dt;
          player.y += (dy / len) * player.speed * dt;
        }

        const xMargin = player.width / 2 + 8;
        const yMargin = player.height / 2 + 8;
        player.x = Math.max(xMargin, Math.min(game.canvas.width - xMargin, player.x));
        player.y = Math.max(yMargin, Math.min(game.canvas.height - yMargin, player.y));
      },
      update: (dt) => {
        player.stateMachine.update(dt);
      }
    };

    const player = this.player;
    this.playerStateMachine = new PlayerStateMachine(player);
    player.stateMachine = this.playerStateMachine;

    this.playerBullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.boss = null;
    this.particles = [];
    this.shotCooldown = 0;
    this.lastFrame = performance.now();
    this.stageState = 'wave';
    this.weaponLevel = 0;
    this.powerUps = [];

    this.stateMachine = new GameStateMachine(this);
    this.currentState = null;
  }

  init() {
    this.playerStateMachine.transitionTo('normal');
    this.stateMachine.transitionTo('title');
    this.updateHud();
    requestAnimationFrame((now) => this.gameLoop(now));
  }

  transitionTo(stateName, options = {}) {
    this.stateMachine.transitionTo(stateName, options);
  }

  resetGame() {
    this.score = 0;
    this.stage = 1;
    this.playerHp = 100;
    this.player.x = this.canvas.width / 2;
    this.player.y = this.canvas.height - 110;
    this.playerBullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.boss = null;
    this.particles = [];
    this.shotCooldown = 0;
    this.stageState = 'wave';
    this.weaponLevel = 0;
    this.powerUps = [];
    this.player.transitionTo('normal');
    this.updateHud();
  }

  startAudio(audio, volume = 1) {
    audio.loop = true;
    audio.volume = Math.max(0, Math.min(1, volume));
    if (audio.paused) {
      audio.currentTime = 0;
    }
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  }

  fadeAudio(audio, targetVolume, duration = 500, pauseAtEnd = false) {
    if (audio._fadeTimer) {
      clearInterval(audio._fadeTimer);
      audio._fadeTimer = null;
    }
    const stepMs = 25;
    const startVolume = audio.volume;
    const target = Math.max(0, Math.min(1, targetVolume));
    const steps = Math.max(1, Math.round(duration / stepMs));
    let step = 0;
    audio._fadeTimer = setInterval(() => {
      step += 1;
      const t = step / steps;
      audio.volume = Math.max(0, Math.min(1, startVolume + (target - startVolume) * t));
      if (step >= steps) {
        clearInterval(audio._fadeTimer);
        audio._fadeTimer = null;
        audio.volume = target;
        if (pauseAtEnd && target <= 0) {
          audio.pause();
          audio.currentTime = 0;
        }
      }
    }, stepMs);
  }

  playTitleBgm() {
    if (this.bgm._fadeTimer) {
      clearInterval(this.bgm._fadeTimer);
      this.bgm._fadeTimer = null;
    }
    this.bgm.pause();
    this.bgm.currentTime = 0;
    this.startAudio(this.titleBgm, 1);
  }

  playBgm() {
    const titlePlaying = this.titleBgm && !this.titleBgm.paused;

    if (this.bgm.paused) {
      // Start the game BGM. If the title BGM is playing, begin silent and fade in.
      this.startAudio(this.bgm, titlePlaying ? 0 : 1);
      if (titlePlaying) {
        this.fadeAudio(this.bgm, 1, this.crossfadeDuration);
      }
    } else {
      // Already playing (e.g. stage transition): keep it going at full volume.
      if (this.bgm._fadeTimer) {
        clearInterval(this.bgm._fadeTimer);
        this.bgm._fadeTimer = null;
      }
      this.bgm.volume = 1;
    }

    if (titlePlaying) {
      // Crossfade: fade the title BGM out while the game BGM fades in.
      this.fadeAudio(this.titleBgm, 0, this.crossfadeDuration, true);
    }
  }

  fadeOutBgm(duration = 1500) {
    if (!this.bgm.paused) {
      this.fadeAudio(this.bgm, 0, duration, true);
    }
  }

  updateHud() {
    this.scoreEl.textContent = this.score;
    this.stageEl.textContent = this.stage;
    this.hpEl.textContent = this.playerHp;
  }

  showOverlay(title, message, showLogo = false) {
    this.overlayTitle.textContent = title;
    this.overlayMessage.textContent = message;
    this.overlay.classList.remove('hidden');
    if (showLogo) {
      this.overlayLogo.classList.remove('hidden');
    } else {
      this.overlayLogo.classList.add('hidden');
    }
  }

  hideOverlay() {
    this.overlay.classList.add('hidden');
    this.overlayLogo.classList.add('hidden');
  }

  startStage(newStage) {
    this.stage = newStage;
    this.stageState = 'wave';
    this.playerBullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.boss = null;
    this.particles = [];
    this.shotCooldown = 0;
    this.powerUps = [];
    this.updateHud();
    this.spawnWave();
  }

  startGame() {
    this.resetGame();
    this.transitionTo('playing', { stage: 1 });
  }

  spawnWave() {
    this.enemies = [];
    const count = 5 + this.stage * 2;
    const cols = Math.min(7, Math.max(5, Math.floor((this.canvas.width - 160) / 90)));
    const spacingX = cols > 1 ? (this.canvas.width - 160) / (cols - 1) : 0;
    const startX = 80;
    const startY = 90;
    const rowSpacing = 70;

    for (let i = 0; i < count; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      this.enemies.push({
        x: startX + col * spacingX,
        y: startY + row * rowSpacing,
        width: 26,
        height: 26,
        vx: 90 + this.stage * 20,
        vy: 22 + this.stage * 2,
        hp: 1 + Math.floor(this.stage / 3),
        alive: true
      });
    }
  }

  spawnBoss() {
    this.boss = {
      x: this.canvas.width / 2,
      y: 120,
      width: 72,
      height: 72,
      hp: 26 + this.stage * 4,
      alive: true,
      phase: 0
    };
  }

  createParticles(x, y, color) {
    for (let i = 0; i < 12; i += 1) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 30 + Math.random() * 20,
        color
      });
    }
  }

  spawnPowerUp(x, y) {
    const spawnY = -24 - Math.random() * 60;
    const spawnX = Math.max(24, Math.min(this.canvas.width - 24, x));
    this.powerUps.push({
      x: spawnX,
      y: spawnY,
      width: 16,
      height: 16,
      vy: 120 + Math.random() * 40,
      vx: (Math.random() - 0.5) * 30,
      kind: ['two', 'three', 'five'][Math.floor(Math.random() * 3)]
    });
  }

  fireBullet() {
    if (this.stateMachine.currentState !== this.stateMachine.states.playing) return;

    const patterns = {
      0: [[0]],
      1: [[-0.28, -1], [0.28, -1]],
      2: [[-0.45, -1], [0, -1], [0.45, -1]],
      3: [
        [-0.7, -1],
        [-0.28, -1],
        [0, -1],
        [0.28, 1],
        [0.7, 1]
      ]
    };
    const pattern = patterns[Math.min(this.weaponLevel, 3)] || patterns[3];

    pattern.forEach(([dx, dy = -1]) => {
      const bullet = {
        x: this.player.x,
        y: this.player.y - this.player.height / 2 - 10,
        width: 56,
        height: 56,
        vx: (dx || 0) * 180,
        vy: 560 * (dy || 1),
        rotation: Math.random() * Math.PI * 2
      };
      this.playerBullets.push(bullet);
    });
  }

  updatePlayerBullets(dt) {
    this.playerBullets = this.playerBullets.filter((bullet) => {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      return bullet.y > -20 && bullet.y < this.canvas.height + 20 && bullet.x > -20 && bullet.x < this.canvas.width + 20;
    });
  }

  updateEnemyBullets(dt) {
    this.enemyBullets = this.enemyBullets.filter((bullet) => {
      bullet.y += bullet.vy * dt;
      return bullet.y > -20 && bullet.y < this.canvas.height + 20;
    });
  }

  updatePowerUps(dt) {
    this.powerUps = this.powerUps.filter((item) => {
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vx *= 0.98;
      if (item.y > this.canvas.height + 20) {
        return false;
      }

      const playerRect = {
        x: this.player.x - this.player.width / 2,
        y: this.player.y - this.player.height / 2,
        width: this.player.width,
        height: this.player.height
      };

      if (item.x < playerRect.x + playerRect.width && item.x + item.width > playerRect.x && item.y < playerRect.y + playerRect.height && item.y + item.height > playerRect.y) {
        this.weaponLevel = Math.min(this.weaponLevel + 1, 3);
        this.createParticles(this.player.x, this.player.y, '#7dff9a');
        return false;
      }

      return true;
    });
  }

  updateEnemies(dt) {
    this.enemies = this.enemies.filter((enemy) => {
      if (!enemy.alive) return false;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      if (enemy.x < 20 || enemy.x > this.canvas.width - 20) {
        enemy.vx *= -1;
        enemy.x = Math.max(20, Math.min(this.canvas.width - 20, enemy.x));
      }

      if (enemy.y > this.canvas.height - 120) {
        enemy.y = this.canvas.height - 120;
        enemy.vy *= -1;
      }

      for (const bullet of this.playerBullets) {
        if (bullet.x < enemy.x + enemy.width && bullet.x + bullet.width > enemy.x && bullet.y < enemy.y + enemy.height && bullet.y + bullet.height > enemy.y) {
          enemy.hp -= 1;
          bullet.y = -999;
          if (enemy.hp <= 0) {
            this.score += 100;
            this.createParticles(enemy.x, enemy.y, '#ff6b6b');
            if (Math.random() < 0.22) {
              this.spawnPowerUp(enemy.x, enemy.y);
            }
            this.updateHud();
            return false;
          }
        }
      }

      return true;
    });

    if (this.enemies.length === 0 && this.boss === null && this.stateMachine.currentState === this.stateMachine.states.playing && this.stageState === 'wave') {
      this.stageState = 'boss';
      this.showOverlay(`Stage ${this.stage}`, 'Boss incoming!');
      setTimeout(() => {
        this.hideOverlay();
        this.spawnBoss();
      }, 1000);
    }
  }

  updateBoss(dt) {
    if (!this.boss || !this.boss.alive) return;
    this.boss.phase = (this.boss.phase + dt * 0.8) % (Math.PI * 2);
    this.boss.x += Math.sin(this.boss.phase) * 110 * dt;
    this.boss.y = 120 + Math.sin(this.boss.phase * 2) * 24;

    for (const bullet of this.playerBullets) {
      if (bullet.x < this.boss.x + this.boss.width && bullet.x + bullet.width > this.boss.x && bullet.y < this.boss.y + this.boss.height && bullet.y + bullet.height > this.boss.y) {
        this.boss.hp -= 1;
        bullet.y = -999;
        this.createParticles(this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, '#ffd166');
        if (this.boss.hp <= 0) {
          this.boss.alive = false;
          this.score += 1000;
          this.updateHud();
          this.createParticles(this.boss.x, this.boss.y, '#7dff9a');
          if (this.stage >= this.maxStages) {
            this.transitionTo('gameclear');
          } else {
            this.transitionTo('stageClear');
          }
        }
      }
    }

    if (this.boss.alive && Math.random() < 0.022) {
      this.enemyBullets.push({
        x: this.boss.x + this.boss.width / 2,
        y: this.boss.y + this.boss.height,
        width: 8,
        height: 18,
        vy: 320
      });
    }
  }

  updateParticles(dt) {
    this.particles = this.particles.filter((particle) => {
      particle.x += particle.vx * 10 * dt;
      particle.y += particle.vy * 10 * dt;
      particle.life -= 1;
      return particle.life > 0;
    });
  }

  checkPlayerHit() {
    const playerRect = {
      x: this.player.x - this.player.width / 2,
      y: this.player.y - this.player.height / 2,
      width: this.player.width,
      height: this.player.height
    };

    for (const bullet of this.enemyBullets) {
      if (bullet.vy > 0 && bullet.x < playerRect.x + playerRect.width && bullet.x + bullet.width > playerRect.x && bullet.y < playerRect.y + playerRect.height && bullet.y + bullet.height > playerRect.y) {
        if (this.player.invulnerable) {
          bullet.y = -999;
          return;
        }

        this.playerHp -= 10;
        this.player.transitionTo('invulnerable');
        bullet.y = -999;
        this.createParticles(this.player.x, this.player.y, '#5cf2ff');
        if (this.playerHp <= 0) {
          this.transitionTo('gameover');
        }
        return;
      }
    }
  }

  drawBackground(dt) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#02040d');
    gradient.addColorStop(1, '#0b1024');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.backgroundImage.complete && this.backgroundImage.naturalWidth) {
      const img = this.backgroundImage;
      const imageHeight = img.naturalHeight || img.height || this.canvas.height;
      const imageWidth = img.naturalWidth || img.width || this.canvas.width;
      this.backgroundScrollV = (this.backgroundScrollV + dt * this.backgroundScrollSpeed + imageHeight) % imageHeight;

      this.ctx.save();
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.translate(0, this.backgroundScrollV);

      const tileCount = Math.ceil(this.canvas.height / imageHeight) + 3;
      for (let i = 0; i < tileCount; i += 1) {
        const y = i * imageHeight - imageHeight;
        this.ctx.drawImage(img, 0, 0, imageWidth, imageHeight, 0, y, this.canvas.width, imageHeight);
      }
      this.ctx.restore();
      return;
    }

    this.ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 60; i += 1) {
      const x = (i * 97) % this.canvas.width;
      const y = 40 + Math.sin(i * 0.7) * 18 + (i * 37) % this.canvas.height;
      this.ctx.fillRect(x, y, 2, 2);
    }
  }

  drawPlayer() {
    if (this.player.invulnerable && Math.floor(performance.now() / 100) % 2 === 0) {
      return;
    }

    const img = this.playerImage;
    if (img.complete && img.naturalWidth) {
      this.ctx.save();
      this.ctx.translate(this.player.x, this.player.y);
      this.ctx.drawImage(img, -this.player.width / 2, -this.player.height / 2, this.player.width, this.player.height);
      this.ctx.restore();
      return;
    }

    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);
    this.ctx.fillStyle = '#59f2ff';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -18);
    this.ctx.lineTo(12, 14);
    this.ctx.lineTo(0, 10);
    this.ctx.lineTo(-12, 14);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.fillRect(-4, 8, 8, 12);
    this.ctx.restore();
  }

  drawPlayerBullets() {
    const img = this.bulletImage;
    for (const bullet of this.playerBullets) {
      if (img.complete && img.naturalWidth) {
        this.ctx.save();
        this.ctx.translate(bullet.x, bullet.y);
        this.ctx.rotate(bullet.rotation);
        this.ctx.drawImage(img, -bullet.width / 2, -bullet.height / 2, bullet.width, bullet.height);
        this.ctx.restore();
      } else {
        this.ctx.fillStyle = '#ffe66d';
        this.ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
      }
    }
  }

  drawPowerUps() {
    for (const item of this.powerUps) {
      this.ctx.fillStyle = item.kind === 'two' ? '#7dff9a' : item.kind === 'three' ? '#5cf2ff' : '#ffd166';
      this.ctx.fillRect(item.x - item.width / 2, item.y - item.height / 2, item.width, item.height);
    }
  }

  drawEnemyBullets() {
    this.ctx.fillStyle = '#ff9f1c';
    for (const bullet of this.enemyBullets) {
      this.ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
    }
  }

  drawEnemies() {
    this.ctx.fillStyle = '#ff6b6b';
    for (const enemy of this.enemies) {
      this.ctx.fillRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2, enemy.width, enemy.height);
    }
  }

  drawBoss() {
    if (!this.boss || !this.boss.alive) return;
    this.ctx.save();
    this.ctx.translate(this.boss.x, this.boss.y);
    this.ctx.fillStyle = '#ff5d8f';
    this.ctx.fillRect(-this.boss.width / 2, -this.boss.height / 2, this.boss.width, this.boss.height);
    this.ctx.fillStyle = '#7dff9a';
    this.ctx.fillRect(-this.boss.width / 2 + 10, -this.boss.height / 2 + 10, this.boss.width - 20, this.boss.height - 20);
    this.ctx.restore();
  }

  drawParticles() {
    for (const particle of this.particles) {
      this.ctx.fillStyle = particle.color;
      this.ctx.fillRect(particle.x, particle.y, 2, 2);
    }
  }

  gameLoop(now) {
    const dt = Math.min(0.033, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    this.stateMachine.update(dt);

    this.drawBackground(dt);
    this.drawParticles();
    this.drawPowerUps();
    this.drawEnemies();
    this.drawBoss();
    this.drawEnemyBullets();
    this.drawPlayerBullets();
    this.drawPlayer();

    requestAnimationFrame((nextTime) => this.gameLoop(nextTime));
  }

  handleKeyDown(event) {
    this.keys[event.key] = true;
    this.stateMachine.handleKeyDown(event);
  }

  handleKeyUp(event) {
    this.keys[event.key] = false;
    this.stateMachine.handleKeyUp(event);
  }

  handleMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = event.clientX - rect.left;
    this.mouse.y = event.clientY - rect.top;
  }

  handleClick() {
    this.stateMachine.handleClick();
  }
}

const game = new GameEngine();
window.addEventListener('keydown', (event) => game.handleKeyDown(event));
window.addEventListener('keyup', (event) => game.handleKeyUp(event));
canvas.addEventListener('mousemove', (event) => game.handleMouseMove(event));
canvas.addEventListener('mouseleave', () => {
  game.mouse.x = canvas.width / 2;
  game.mouse.y = canvas.height - 120;
});
restartButton.addEventListener('click', (event) => {
  event.stopPropagation();
  game.handleClick();
});
overlay.addEventListener('click', (event) => {
  if (event.target === overlay) {
    game.handleClick();
  }
});
game.init();
