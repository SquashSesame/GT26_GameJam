const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const stageEl = document.getElementById('stage');
const livesEl = document.getElementById('lives');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMessage = document.getElementById('overlayMessage');
const restartButton = document.getElementById('restartButton');

// ゲーム全体の画面状態（ステート）の基底クラス。
// 各画面はこれを継承し、必要なハンドラ（enter/update/handleKeyDown など）だけを上書きする。
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

// 起動直後にロゴを表示する画面。フェードイン→表示→フェードアウトの後にタイトルへ遷移する。
// customRender = true のため、共通の描画ループではなく自前の render() で全画面を描画する。
class CompanyLogoState extends BaseState {
  constructor(game) {
    super(game);
    this.customRender = true;
    this.fadeInDuration = 0.6;
    this.holdDuration = 2.0;
    this.fadeOutDuration = 0.6;
    this.elapsed = 0;
    this.alpha = 0;
    this.done = false;
  }

  enter() {
    this.game.hideOverlay();
    this.elapsed = 0;
    this.alpha = 0;
    this.done = false;
  }

  update(dt) {
    if (this.done) {
      return;
    }
    this.elapsed += dt;
    const fadeInEnd = this.fadeInDuration;
    const holdEnd = fadeInEnd + this.holdDuration;
    const fadeOutEnd = holdEnd + this.fadeOutDuration;

    if (this.elapsed < fadeInEnd) {
      this.alpha = this.elapsed / this.fadeInDuration;
    } else if (this.elapsed < holdEnd) {
      this.alpha = 1;
    } else if (this.elapsed < fadeOutEnd) {
      this.alpha = 1 - (this.elapsed - holdEnd) / this.fadeOutDuration;
    } else {
      this.alpha = 0;
      this.done = true;
      this.game.transitionTo('title');
    }
  }

  render() {
    const ctx = this.game.ctx;
    const canvas = this.game.canvas;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = this.game.companyLogoImage;
    if (img.complete && img.naturalWidth) {
      const maxWidth = canvas.width * 0.6;
      const scale = Math.min(maxWidth / img.naturalWidth, 1);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, this.alpha));
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      ctx.restore();
    }
  }
}

// タイトル画面。ゲーム状態をリセットし、Enter またはクリックでプレイ開始へ遷移する。
class TitleState extends BaseState {
  enter() {
    // 敵・弾・ボス・パーティクルなどゲーム中のオブジェクトを全てリセットする。
    this.game.resetGame();
    this.game.showOverlay('GKT Shooter', 'Press Enter to start', true, true);
    this.game.playTitleBgm();
  }

  handleKeyDown(event) {
    if (event.key === 'Enter') {
      this.game.transitionToScreen('playing', { stage: 1 });
    }
  }

  handleClick() {
    this.game.transitionToScreen('playing', { stage: 1 });
  }
}

// ゲームプレイ中の画面。毎フレーム、自機・弾・アイテム・敵・ボス・当たり判定を更新する。
// 残機が尽きるとゲームオーバーへ、Escape でタイトルへ遷移する。
class PlayingState extends BaseState {
  enter(options = {}) {
    this.game.hideOverlay();
    this.game.stage = options.stage || this.game.stage;
    this.game.startStage(this.game.stage);
    this.game.playBgm();
  }

  update(dt) {
    if (this.game.lives <= 0) {
      this.game.transitionTo('gameover');
      return;
    }

    this.game.player.update(dt);
    this.game.shotCooldown -= dt;
    if (this.game.shotCooldown <= 0) {
      this.game.fireBullet();
      this.game.shotCooldown = 0.2;
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
      this.game.fadeOutBgm();
      this.game.transitionToScreen('title');
    }
  }
}

// ゲームオーバー画面。BGMをフェードアウトし、Enter またはクリックでタイトルへ戻る。
class GameOverState extends BaseState {
  enter() {
    this.game.fadeOutBgm();
    this.game.showOverlay('Game Over', 'Press Enter to return to title');
  }

  handleKeyDown(event) {
    if (event.key === 'Enter') {
      this.game.transitionToScreen('title');
    }
  }

  handleClick() {
    this.game.transitionToScreen('title');
  }
}

// ステージクリア画面。最終ステージなら全クリアへ、そうでなければ次ステージへ分岐する。
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

// 全ステージクリア（エンディング）画面。Enter またはクリックでタイトルへ戻る。
class GameClearState extends BaseState {
  enter() {
    this.game.fadeOutBgm();
    this.game.showOverlay('Game Clear', 'Press Enter to return to title');
  }

  handleKeyDown(event) {
    if (event.key === 'Enter') {
      this.game.transitionToScreen('title');
    }
  }

  handleClick() {
    this.game.transitionToScreen('title');
  }
}

// ゲーム全体の画面遷移を管理するステートマシン。
// 全画面インスタンスを保持し、入力・更新・描画イベントを現在の画面へ委譲する。
class GameStateMachine {
  constructor(game) {
    this.game = game;
    this.states = {
      companyLogo: new CompanyLogoState(game),
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

// ゲーム本体。キャンバス描画・入力・BGM・スコア/ステージ/残機を統括し、
// メインループ（gameLoop）を回してゲーム全体を駆動する中心クラス。
class GameEngine {
  constructor() {
    this.canvas = canvas;
    this.ctx = ctx;
    this.scoreEl = scoreEl;
    this.stageEl = stageEl;
    this.livesEl = livesEl;
    this.overlay = overlay;
    this.overlayTitle = document.getElementById('overlayTitle');
    this.overlayMessage = document.getElementById('overlayMessage');
    this.overlayLogo = document.getElementById('overlayLogo');
    this.titleCharacter = document.getElementById('titleCharacter');
    this.screenTransition = document.getElementById('screenTransition');
    this.isTransitioning = false;
    this.restartButton = restartButton;
    this.keys = {}; 
    this.mouse = { x: canvas.width / 2, y: canvas.height - 120 };
    this.backgroundImage = new Image();
    this.backgroundImage.src = '../res/img/street.png';
    this.playerImage = new Image();
    this.playerImage.src = '../res/img/cat.png';
    this.bulletImage = new Image();
    this.bulletImage.src = '../res/img/btama.png';
    this.companyLogoImage = new Image();
    this.companyLogoImage.src = '../res/img/logo_gamejam.png';
    this.bgm = new Audio('../res/snd/bgm_game2.ogg');
    this.bgm.loop = true;
    this.bgm.volume = 1;
    this.titleBgm = new Audio('../res/snd/bgm_title.ogg');
    this.titleBgm.loop = true;
    this.titleBgm.volume = 1;
    this.bossBgm = new Audio('../res/snd/bgm_boss.ogg');
    this.bossBgm.loop = true;
    this.bossBgm.volume = 1;
    this.crossfadeDuration = 500;
    this.backgroundScrollV = 0;
    this.backgroundScrollSpeed = 90;
    this.score = 0;
    this.stage = 1;
    this.maxLives = 3;
    this.lives = this.maxLives;
    this.maxStages = 3;
    // プレイヤーの生成・移動・状態管理は player.js に分離している。
    this.player = createPlayer(this);
    this.playerStateMachine = this.player.stateMachine;

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

    // 出現テーブルは spawnTables.js で定義（グローバルの SPAWN_TABLES）。
    this.spawnTables = typeof SPAWN_TABLES !== 'undefined' ? SPAWN_TABLES : {};
    this.spawnController = new SpawnController(this);

    this.stateMachine = new GameStateMachine(this);
    this.currentState = null;
  }

  init() {
    this.playerStateMachine.transitionTo('normal');
    this.stateMachine.transitionTo('companyLogo');
    this.updateHud();
    requestAnimationFrame((now) => this.gameLoop(now));
  }

  transitionTo(stateName, options = {}) {
    this.stateMachine.transitionTo(stateName, options);
  }

  transitionToScreen(stateName, options = {}, { fadeOut = 400, fadeIn = 400 } = {}) {
    if (this.isTransitioning) {
      return;
    }
    this.isTransitioning = true;

    const el = this.screenTransition;
    el.classList.remove('hidden');
    el.style.transitionDuration = `${fadeOut}ms`;
    // Force a reflow so the browser registers opacity 0 before fading to black.
    void el.offsetWidth;
    el.style.opacity = '1';

    setTimeout(() => {
      // Switch to the new screen while fully black, then fade back in.
      this.transitionTo(stateName, options);
      el.style.transitionDuration = `${fadeIn}ms`;
      void el.offsetWidth;
      el.style.opacity = '0';

      setTimeout(() => {
        el.classList.add('hidden');
        this.isTransitioning = false;
      }, fadeIn);
    }, fadeOut);
  }

  resetGame() {
    this.score = 0;
    this.stage = 1;
    this.lives = this.maxLives;
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
    if (this.spawnController) {
      this.spawnController.reset([]);
    }
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

  // 指定したBGMへ音量をクロスフェードで切り替える。
  // 他のBGMは同時にフェードアウトして停止する。
  crossfadeTo(target, duration = this.crossfadeDuration) {
    const tracks = [this.bgm, this.titleBgm, this.bossBgm];
    for (const track of tracks) {
      if (track === target) continue;
      if (!track.paused) {
        this.fadeAudio(track, 0, duration, true);
      }
    }

    if (target.paused) {
      // 停止中なら音量0から開始してフェードイン。
      this.startAudio(target, 0);
    } else if (target._fadeTimer) {
      // すでに再生中（フェード中）ならフェードをやり直す。
      clearInterval(target._fadeTimer);
      target._fadeTimer = null;
    }
    this.fadeAudio(target, 1, duration);
  }

  playTitleBgm() {
    this.crossfadeTo(this.titleBgm);
  }

  playBgm() {
    this.crossfadeTo(this.bgm);
  }

  // ボス出現時にボスBGMへクロスフェードする。
  playBossBgm() {
    this.crossfadeTo(this.bossBgm);
  }

  fadeOutBgm(duration = 1500) {
    const tracks = [this.bgm, this.titleBgm, this.bossBgm];
    for (const track of tracks) {
      if (!track.paused) {
        this.fadeAudio(track, 0, duration, true);
      }
    }
  }

  updateHud() {
    this.scoreEl.textContent = this.score;
    this.stageEl.textContent = this.stage;
    this.livesEl.textContent = this.lives;
  }

  showOverlay(title, message, showLogo = false, fadeIn = false) {
    this.overlayTitle.textContent = title;
    this.overlayMessage.textContent = message;
    this.overlay.classList.remove('hidden');
    if (showLogo) {
      this.overlayLogo.classList.remove('hidden');
      this.titleCharacter.classList.remove('hidden');
    } else {
      this.overlayLogo.classList.add('hidden');
      this.titleCharacter.classList.add('hidden');
    }

    if (fadeIn) {
      // Start transparent, then transition to opaque on the next frame.
      this.overlay.classList.add('overlay-fade');
      void this.overlay.offsetWidth;
      this.overlay.classList.remove('overlay-fade');
    } else {
      this.overlay.classList.remove('overlay-fade');
    }
  }

  hideOverlay() {
    this.overlay.classList.add('hidden');
    this.overlayLogo.classList.add('hidden');
    this.titleCharacter.classList.add('hidden');
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
    this.spawnController.reset(this.getSpawnTable(newStage));
  }

  startGame() {
    this.resetGame();
    this.transitionTo('playing', { stage: 1 });
  }

  // ステージの出現テーブルを返す。未定義のステージは自動生成のフォールバック。
  getSpawnTable(stage) {
    if (this.spawnTables[stage]) {
      return this.spawnTables[stage];
    }
    return [
      { delay: 0.8, type: 'grunt', count: 5 + stage * 2, algorithm: 'bounce' },
      { delay: 6.0, type: 'diver', count: 4 + stage, algorithm: 'sine' }
    ];
  }

  // 画面上部に敵を横並び（複数行）で配置する座標を返す。
  buildFormation(count, entry) {
    const positions = [];
    const cols = Math.min(7, Math.max(1, entry.columns || Math.min(count, 6)));
    const usableWidth = this.canvas.width - 160;
    const spacingX = cols > 1 ? usableWidth / (cols - 1) : 0;
    const startX = 80;
    const startY = entry.startY != null ? entry.startY : -40;
    const rowSpacing = entry.rowSpacing != null ? entry.rowSpacing : 60;

    for (let i = 0; i < count; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push({
        x: cols > 1 ? startX + col * spacingX : this.canvas.width / 2,
        y: startY - row * rowSpacing
      });
    }
    return positions;
  }

  // 出現テーブルの1エントリぶんの敵を生成する。
  spawnEntry(entry) {
    const typeDef = ENEMY_TYPES[entry.type] || ENEMY_TYPES.grunt;
    const count = entry.count != null ? entry.count : 1;
    const hp = typeDef.hp + Math.floor(this.stage / 3);
    const positions = this.buildFormation(count, entry);

    positions.forEach((pos, i) => {
      const params = { ...(entry.params || {}) };
      // 個体ごとに動きへ変化を付ける（向き・サインの位相）。
      if (params.dir === undefined) {
        params.dir = i % 2 === 0 ? 1 : -1;
      }
      if (entry.algorithm === 'sine' && params.phase === undefined) {
        params.phase = i * 0.6;
      }

      const enemy = new Enemy({
        x: pos.x,
        y: pos.y,
        width: typeDef.width,
        height: typeDef.height,
        hp,
        type: entry.type,
        color: typeDef.color,
        score: typeDef.score
      }, createMovement(entry.algorithm, params));
      enemy.init(this);
      this.enemies.push(enemy);
    });
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

  // 中心 (x, y) から四方八方へ弾を放つ（弾幕用の全方位バースト）。
  fireEnemyRadial(x, y, count, speed, angleOffset = 0) {
    for (let i = 0; i < count; i += 1) {
      const angle = angleOffset + (Math.PI * 2 * i) / count;
      this.enemyBullets.push({
        x,
        y,
        width: 10,
        height: 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed
      });
    }
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
      bullet.x += (bullet.vx || 0) * dt;
      bullet.y += bullet.vy * dt;
      return bullet.y > -30 && bullet.y < this.canvas.height + 30 && bullet.x > -30 && bullet.x < this.canvas.width + 30;
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
    // 出現テーブルにしたがって敵をスポーンさせる（ウェーブ中のみ）。
    if (this.stageState === 'wave') {
      this.spawnController.update(dt);
    }

    this.enemies = this.enemies.filter((enemy) => {
      if (!enemy.alive) return false;

      // 移動は各敵の movement クラスに委譲する。
      enemy.update(dt, this);

      // 画面下に抜けた敵は退場させる（まっすぐ下降するタイプなど）。
      if (enemy.y > this.canvas.height + 60) {
        return false;
      }

      for (const bullet of this.playerBullets) {
        if (bullet.x < enemy.x + enemy.width && bullet.x + bullet.width > enemy.x && bullet.y < enemy.y + enemy.height && bullet.y + bullet.height > enemy.y) {
          enemy.hp -= 1;
          bullet.y = -999;
          if (enemy.hp <= 0) {
            this.score += enemy.score || 100;
            this.createParticles(enemy.x, enemy.y, enemy.color || '#ff6b6b');
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

    // 出現テーブルを消化し切り、かつ敵が全滅したらボスへ移行する。
    if (this.spawnController.isFinished() && this.enemies.length === 0 && this.boss === null && this.stateMachine.currentState === this.stateMachine.states.playing && this.stageState === 'wave') {
      this.stageState = 'boss';
      this.showOverlay(`Stage ${this.stage}`, 'Boss incoming!');
      // ボス出現の予告と同時にボスBGMへクロスフェードする。
      this.playBossBgm();
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
      // 四方八方へ放つ全方位バースト。1回あたり14発（従来の約10倍の弾量）。
      this.boss.spiralAngle = (this.boss.spiralAngle || 0) + 0.3;
      this.fireEnemyRadial(
        this.boss.x + this.boss.width / 2,
        this.boss.y + this.boss.height / 2,
        14,
        300,
        this.boss.spiralAngle
      );
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

  // プレイヤーにダメージを与える（無敵中は無効）。1回のダメージで残機を1減らす。
  damagePlayer() {
    if (this.player.invulnerable) return;

    this.lives -= 1;
    this.player.transitionTo('invulnerable');
    this.createParticles(this.player.x, this.player.y, '#5cf2ff');
    this.updateHud();
    if (this.lives <= 0) {
      this.transitionTo('gameover');
    }
  }

  checkPlayerHit() {
    const playerRect = {
      x: this.player.x - this.player.width / 2,
      y: this.player.y - this.player.height / 2,
      width: this.player.width,
      height: this.player.height
    };

    const overlaps = (rect, x, y, width, height) =>
      x < rect.x + rect.width &&
      x + width > rect.x &&
      y < rect.y + rect.height &&
      y + height > rect.y;

    // 敵の弾に当たる範囲は本体の半分（中心基準）に縮小する。
    const bulletHitRect = {
      x: this.player.x - this.player.width / 4,
      y: this.player.y - this.player.height / 4,
      width: this.player.width / 2,
      height: this.player.height / 2
    };

    // 敵の弾との接触。
    for (const bullet of this.enemyBullets) {
      if (overlaps(bulletHitRect, bullet.x, bullet.y, bullet.width, bullet.height)) {
        bullet.y = -999;
        this.damagePlayer();
        return;
      }
    }

    // 敵本体との接触。
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (overlaps(playerRect, enemy.x - enemy.width / 2, enemy.y - enemy.height / 2, enemy.width, enemy.height)) {
        this.damagePlayer();
        return;
      }
    }

    // ボス本体との接触。
    if (this.boss && this.boss.alive) {
      if (overlaps(playerRect, this.boss.x - this.boss.width / 2, this.boss.y - this.boss.height / 2, this.boss.width, this.boss.height)) {
        this.damagePlayer();
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

  // 残機を画面右下にプレイヤーアイコン（64x64）で表示する。
  drawLives() {
    const img = this.playerImage;
    const size = 64;
    const gap = 8;
    const margin = 16;
    const y = this.canvas.height - margin - size;

    for (let i = 0; i < this.lives; i += 1) {
      // 右詰めで左方向へ並べる。
      const x = this.canvas.width - margin - size - i * (size + gap);
      if (img.complete && img.naturalWidth) {
        this.ctx.drawImage(img, x, y, size, size);
      } else {
        this.ctx.fillStyle = '#59f2ff';
        this.ctx.fillRect(x, y, size, size);
      }
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
    for (const enemy of this.enemies) {
      this.ctx.fillStyle = enemy.color || '#ff6b6b';
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

    const state = this.stateMachine.currentState;
    if (state && state.customRender) {
      state.render(dt);
    } else {
      this.drawBackground(dt);
      this.drawParticles();
      this.drawPowerUps();
      this.drawEnemies();
      this.drawBoss();
      this.drawEnemyBullets();
      this.drawPlayerBullets();
      this.drawPlayer();

      // ゲーム中のみ残機アイコンを表示する。
      if (state === this.stateMachine.states.playing) {
        this.drawLives();
      }
    }

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
