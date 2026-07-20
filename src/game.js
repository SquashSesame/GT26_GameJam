const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const stageEl = document.getElementById('stage');
const livesEl = document.getElementById('lives');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMessage = document.getElementById('overlayMessage');
const restartButton = document.getElementById('restartButton');

// ダメージを受けたときの白フラッシュの継続時間（秒）。1（真っ白）→0（通常）へ減衰する。
const DAMAGE_FLASH_DURATION = 0.2;

// 既定武器の発射方向カテゴリ → 弾の左右オフセット（前方拡散）。
// パワーアップの category（powerups.js）でこのキーを指定する。
const FIRE_PATTERNS = {
  '1way': [0],
  '2way': [-0.28, 0.28],
  '3way': [-0.45, 0, 0.45],
  '4way': [-0.6, -0.2, 0.2, 0.6],
  '5way': [-0.7, -0.35, 0, 0.35, 0.7]
};

// パワーアップアイテム共通のアイコン画像。
const POWERUP_ICON_IMAGE = 'wep_bills.png';

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

    // プレイヤーの被弾フラッシュを時間で減衰させる。
    if (this.game.playerFlash > 0) {
      this.game.playerFlash = Math.max(0, this.game.playerFlash - dt / DAMAGE_FLASH_DURATION);
    }

    this.game.shotCooldown -= dt;
    if (this.game.shotCooldown <= 0) {
      this.game.fireBullet();
      this.game.shotCooldown = 0.2;
    }

    this.game.updatePlayerBullets(dt);
    this.game.updateEnemyBullets(dt);
    this.game.updatePowerUps(dt);
    this.game.updateWeaponItems(dt);
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
    this.bossWarning = document.getElementById('bossWarning');
    this.isTransitioning = false;
    this.restartButton = restartButton;
    this.keys = {}; 
    this.mouse = { x: canvas.width / 2, y: canvas.height - 120 };
    this.backgroundImage = new Image();
    this.backgroundImage.src = 'res/img/bg_street.png';
    this.playerImage = new Image();
    this.playerImage.src = 'res/img/player_top.png';
    this.bulletImage = new Image();
    this.bulletImage.src = 'res/img/wep_btama.png';
    this.enemyBulletImage = new Image();
    this.enemyBulletImage.src = 'res/img/wep_btama.png';
    this.companyLogoImage = new Image();
    this.companyLogoImage.src = 'res/img/logo_gamejam.png';
    // 出現テーブルで image 指定された画像（敵・ボス）を、ファイル名ごとにキャッシュして使い回す。
    this.images = {};
    this.bgm = new Audio('res/snd/bgm_game2.ogg');
    this.bgm.loop = true;
    this.bgm.volume = 1;
    this.titleBgm = new Audio('res/snd/bgm_title.ogg');
    this.titleBgm.loop = true;
    this.titleBgm.volume = 1;
    this.bossBgm = new Audio('res/snd/bgm_boss.ogg');
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
    // プレイヤーのダメージ時白フラッシュ量（1=真っ白 → 0=通常）。
    this.playerFlash = 0;

    this.playerBullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.boss = null;
    this.particles = [];
    this.shotCooldown = 0;
    this.lastFrame = performance.now();
    this.stageState = 'wave';
    // 武器レベル（POWERUPS の添字 / パワーアップ取得で増え、被弾で減る）。
    // 発射方向カテゴリはこのレベルから決まる。攻撃力はウェポンで変化（既定1）。
    this.weaponLevel = 0;
    this.playerCategory = '1way';
    this.playerPower = 1;
    this.powerUps = [];
    // 取得中のウェポン（WEAPONS のエントリ / null なら既定武器）と、落下中のウェポンアイテム。
    this.currentWeapon = null;
    this.weaponItems = [];

    // 出現テーブルは spawnTables.js で定義（グローバルの SPAWN_TABLES）。
    this.spawnTables = typeof SPAWN_TABLES !== 'undefined' ? SPAWN_TABLES : {};
    this.spawnController = new SpawnController(this);

    // ステージテーブルは stages.js で定義（グローバルの STAGES_BY_NUMBER）。
    this.stages = typeof STAGES_BY_NUMBER !== 'undefined' ? STAGES_BY_NUMBER : {};
    this.stageName = '';

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
    this.playerFlash = 0;
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
    this.playerCategory = '1way';
    this.playerPower = 1;
    this.powerUps = [];
    this.currentWeapon = null;
    this.weaponItems = [];
    this.hideBossWarning();
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
    this.weaponItems = [];
    // ステージテーブルにしたがい、背景画像とステージ名を設定する。
    this.applyStage(newStage);
    this.hideBossWarning();
    this.updateHud();
    this.spawnController.reset(this.getSpawnTable(newStage));
  }

  // ステージ番号に対応するステージ定義を返す（未定義なら既定値でフォールバック）。
  getStageDef(stage) {
    return this.stages[stage] || { stage, name: `Stage ${stage}`, image: 'street.png' };
  }

  // ステージ開始時：背景画像とステージ名を反映する。
  applyStage(stage) {
    const def = this.getStageDef(stage);
    this.stageName = def.name || `Stage ${stage}`;
    if (def.image) {
      const src = `res/img/${def.image}`;
      // 同じ画像なら再ロードしない（読み込み中の背景チラつきを避ける）。
      if (!this.backgroundImage.src.endsWith(src)) {
        this.backgroundImage = new Image();
        this.backgroundImage.src = src;
      }
    }
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

  // 画像を res/img 内のファイル名で取得する。生成した Image はキャッシュして使い回す。
  getImage(name) {
    if (!name) {
      return null;
    }
    if (!this.images[name]) {
      const img = new Image();
      img.src = `res/img/${name}`;
      this.images[name] = img;
    }
    return this.images[name];
  }

  // 出現テーブルの1エントリのうち、index 番目の敵を1体だけ生成する。
  // count はエントリの総数（隊形の座標計算に使う）。
  spawnEnemyAt(entry, index, count) {
    const typeDef = ENEMY_TYPES[entry.type] || ENEMY_TYPES.grunt;
    // テーブルで hp が指定されていればそれを使う。未指定なら type 既定値＋ステージ補正。
    const hp = entry.hp != null ? entry.hp : typeDef.hp + Math.floor(this.stage / 3);
    const positions = this.buildFormation(count, entry);
    const pos = positions[index];
    if (!pos) {
      return;
    }
    // テーブルで image が指定されていれば、その画像で敵を描画する。
    const image = this.getImage(entry.image);

    const params = { ...(entry.params || {}) };
    // 個体ごとに動きへ変化を付ける（向き・サインの位相）。
    if (params.dir === undefined) {
      params.dir = index % 2 === 0 ? 1 : -1;
    }
    if (entry.algorithm === 'sine' && params.phase === undefined) {
      params.phase = index * 0.6;
    }

    const enemy = new Enemy({
      x: pos.x,
      y: pos.y,
      width: typeDef.width,
      height: typeDef.height,
      hp,
      type: entry.type,
      color: typeDef.color,
      score: typeDef.score,
      image
    }, createMovement(entry.algorithm, params));
    enemy.init(this);
    this.enemies.push(enemy);
  }

  spawnBoss(image = null, hp = null) {
    // ボスの表示・当たり判定サイズ（基準 72px の 4 倍）。
    const size = 72 * 4;
    this.boss = {
      x: this.canvas.width / 2,
      y: 120,
      width: size,
      height: size,
      // テーブルで hp が指定されていればそれを使う。未指定なら従来の計算式。
      hp: hp != null ? hp : 26 + this.stage * 4,
      alive: true,
      phase: 0,
      // ダメージ時の白フラッシュ量（1=真っ白 → 0=通常）。
      flash: 0,
      // 出現テーブルで指定されたボス画像（未指定なら null。その場合は矩形で描画）。
      image
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

  // 出現テーブルのアイテムエントリからアイテムを1つ落下させる。
  // entry: { item: 'weapon'|'powerup', id?: <文字列>, x?: <px / 省略時は横位置ランダム> }
  // powerup はレベル制のため id は不要（どれを取っても武器レベルが1上がる）。
  spawnItemEntry(entry) {
    const x = entry.x != null ? entry.x : 60 + Math.random() * (this.canvas.width - 120);
    if (entry.item === 'weapon') {
      this.spawnWeaponItem(x, entry.id);
    } else if (entry.item === 'powerup') {
      this.spawnPowerUpItem(x);
    }
  }

  // パワーアップアイテムを画面上から落下させる（共通アイコンで描画）。
  spawnPowerUpItem(x) {
    const spawnX = Math.max(30, Math.min(this.canvas.width - 30, x));
    this.powerUps.push({
      x: spawnX,
      y: -30 - Math.random() * 40,
      width: 48,
      height: 48,
      vy: 110 + Math.random() * 30,
      vx: (Math.random() - 0.5) * 20,
      image: this.getImage(POWERUP_ICON_IMAGE)
    });
  }

  // 指定した id のウェポンアイテムを画面上から落下させる。
  spawnWeaponItem(x, weaponId) {
    const weapon = WEAPONS_BY_ID[weaponId];
    if (!weapon) {
      return;
    }
    const spawnX = Math.max(30, Math.min(this.canvas.width - 30, x));
    this.weaponItems.push({
      x: spawnX,
      y: -30 - Math.random() * 40,
      width: 56,
      height: 56,
      vy: 110 + Math.random() * 30,
      vx: (Math.random() - 0.5) * 20,
      weaponId,
      type: weapon.type,
      image: this.getImage(weapon.image)
    });
  }

  // 武器レベル（POWERUPS の添字）から発射方向カテゴリを決定する。
  // レベルは 0（1つ目 / 最低）〜 POWERUPS.length-1（テーブル最大値）に丸める。
  applyWeaponLevel() {
    const maxLevel = Math.max(0, POWERUPS.length - 1);
    this.weaponLevel = Math.max(0, Math.min(maxLevel, this.weaponLevel));
    const def = POWERUPS[this.weaponLevel];
    this.playerCategory = def ? def.category : '1way';
  }

  // パワーアップ取得時：武器レベルを1上げる（最大はテーブルの最大値）。
  gainWeaponLevel() {
    this.weaponLevel += 1;
    this.applyWeaponLevel();
    this.createParticles(this.player.x, this.player.y, '#7dff9a');
  }

  // 被弾時：武器レベルを1下げる（最低は1つ目）。
  loseWeaponLevel() {
    this.weaponLevel -= 1;
    this.applyWeaponLevel();
  }

  // ウェポンアイテム取得時：プレイヤーの武器を切り替え、攻撃力を反映する。
  setWeapon(weaponId) {
    const weapon = WEAPONS_BY_ID[weaponId];
    if (!weapon) {
      return;
    }
    this.currentWeapon = weapon;
    this.playerPower = weapon.power != null ? weapon.power : 1;
    this.createParticles(this.player.x, this.player.y, '#ffd166');
  }

  // プレイヤーの弾を1発追加する。image を指定するとその画像で描画する。
  // ダメージは現在の攻撃力（playerPower / ウェポンで変化）を用いる。
  pushPlayerBullet(x, y, vx, vy, size, image = null) {
    this.playerBullets.push({
      x,
      y,
      width: size,
      height: size,
      vx,
      vy,
      rotation: Math.random() * Math.PI * 2,
      image,
      damage: this.playerPower
    });
  }

  fireBullet() {
    if (this.stateMachine.currentState !== this.stateMachine.states.playing) return;

    // ウェポンアイテムを取得している場合は、その武器タイプで発射する。
    if (this.currentWeapon) {
      this.fireWeapon(this.currentWeapon);
      return;
    }

    // 既定武器（btama）：パワーアップの category に応じた前方拡散で発射する。
    const offsets = FIRE_PATTERNS[this.playerCategory] || FIRE_PATTERNS['1way'];
    const originY = this.player.y - this.player.height / 2 - 10;
    offsets.forEach((dx) => {
      this.pushPlayerBullet(this.player.x, originY, dx * 180, -560, 56, null);
    });
  }

  // 取得中のウェポンのタイプに応じて弾を発射する。弾には武器画像を持たせる。
  fireWeapon(weapon) {
    const img = this.getImage(weapon.image);
    const x = this.player.x;
    const y = this.player.y - this.player.height / 2 - 10;

    switch (weapon.type) {
      case 'straight':
        // ball：速い直進弾を2発。
        this.pushPlayerBullet(x - 16, y, 0, -640, 48, img);
        this.pushPlayerBullet(x + 16, y, 0, -640, 48, img);
        break;
      case 'spread':
        // car：5way 拡散。
        [-0.5, -0.25, 0, 0.25, 0.5].forEach((a) => {
          this.pushPlayerBullet(x, y, a * 280, -520, 56, img);
        });
        break;
      case 'heavy':
        // building：大型・低速の1発。
        this.pushPlayerBullet(x, y, 0, -380, 128, img);
        break;
      case 'bomb':
        // nuclear：広範囲の大量弾。
        for (let i = -4; i <= 4; i += 1) {
          this.pushPlayerBullet(x, y, i * 70, -500, 72, img);
        }
        break;
      default:
        this.pushPlayerBullet(x, y, 0, -560, 56, img);
    }
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

  // 指定位置 (x, y) から現在のプレイヤー位置へ向けて敵弾を1発放つ。
  fireEnemyAimed(x, y, speed = 260) {
    const dx = this.player.x - x;
    const dy = this.player.y - y;
    const dist = Math.hypot(dx, dy) || 1;
    this.enemyBullets.push({
      x,
      y,
      width: 10,
      height: 10,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed
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

      // 取得したら発射方向カテゴリと攻撃力を反映する。
      if (item.x < playerRect.x + playerRect.width && item.x + item.width > playerRect.x && item.y < playerRect.y + playerRect.height && item.y + item.height > playerRect.y) {
        this.gainWeaponLevel();
        return false;
      }

      return true;
    });
  }

  updateWeaponItems(dt) {
    this.weaponItems = this.weaponItems.filter((item) => {
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vx *= 0.98;
      if (item.y > this.canvas.height + 30) {
        return false;
      }

      const playerRect = {
        x: this.player.x - this.player.width / 2,
        y: this.player.y - this.player.height / 2,
        width: this.player.width,
        height: this.player.height
      };

      // 取得したらプレイヤーの武器を切り替える。
      if (item.x < playerRect.x + playerRect.width && item.x + item.width > playerRect.x && item.y < playerRect.y + playerRect.height && item.y + item.height > playerRect.y) {
        this.setWeapon(item.weaponId);
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

      // 被弾フラッシュを時間で減衰させる。
      if (enemy.flash > 0) {
        enemy.flash = Math.max(0, enemy.flash - dt / DAMAGE_FLASH_DURATION);
      }

      // 画面外まで大きく外れた敵は退場させる。
      // 上端だけは、出現直後（画面上から降りてくる敵）を誤って消さないよう、
      // 上向きに移動している敵（vy < 0：bounce が下端で跳ね返って上へ抜けたもの）に限定する。
      const cullMargin = 80;
      if (
        enemy.y > this.canvas.height + cullMargin ||
        enemy.x < -cullMargin ||
        enemy.x > this.canvas.width + cullMargin ||
        (enemy.vy < 0 && enemy.y < -cullMargin)
      ) {
        return false;
      }

      // 画面内にいる間、ランダムな間隔でプレイヤーへ向けて弾を1発撃つ。
      if (enemy.y > 0 && enemy.y < this.canvas.height) {
        enemy.shootCooldown -= dt;
        if (enemy.shootCooldown <= 0) {
          this.fireEnemyAimed(enemy.x, enemy.y);
          enemy.shootCooldown = randomShotInterval();
        }
      }

      for (const bullet of this.playerBullets) {
        // 弾・敵ともに x/y は中心座標。中心基準で重なりを判定する。
        if (
          Math.abs(bullet.x - enemy.x) < (bullet.width + enemy.width) / 2 &&
          Math.abs(bullet.y - enemy.y) < (bullet.height + enemy.height) / 2
        ) {
          enemy.hp -= bullet.damage || 1;
          enemy.flash = 1;
          bullet.y = -999;
          if (enemy.hp <= 0) {
            this.score += enemy.score || 100;
            this.createParticles(enemy.x, enemy.y, enemy.color || '#ff6b6b');
            // アイテムのドロップは出現テーブル（item エントリ）で管理する（ランダムドロップは廃止）。
            this.updateHud();
            return false;
          }
        }
      }

      return true;
    });

    // 出現テーブルにボス出現エントリがある場合は、その時間指定に任せる（SpawnController が発火）。
    // ボスエントリが無いテーブルのみ、従来どおり「全消化＋敵全滅」でボスへ移行する（後方互換）。
    if (!this.spawnController.hasBossEntry() &&
        this.spawnController.isFinished() && this.enemies.length === 0 &&
        this.boss === null && this.stateMachine.currentState === this.stateMachine.states.playing &&
        this.stageState === 'wave') {
      this.startBossPhase();
    }
  }

  // ボス戦フェーズへ移行する（予告表示 → ボスBGMへ切替 → 1秒後にボス出現）。
  // 出現テーブルのボスエントリ（image 等の設定を持つ）、または「敵全滅」フォールバックから呼ばれる。
  startBossPhase(entry = {}) {
    // 二重発火防止（既にボス戦、またはボス出現済み、プレイ中でない場合は無視）。
    if (this.stageState === 'boss' || this.boss) {
      return;
    }
    if (this.stateMachine.currentState !== this.stateMachine.states.playing) {
      return;
    }
    this.stageState = 'boss';
    // テーブルで image が指定されていれば、その画像でボスを描画する。
    const image = this.getImage(entry.image);
    // テーブルで hp が指定されていればそれをボスに反映する（未指定なら null）。
    const bossHp = entry.hp != null ? entry.hp : null;
    // ボス出現前は「WARNING」の帯テロップを画面中央に表示する（背景の暗転はしない）。
    this.showBossWarning();
    // ボス出現の予告と同時にボスBGMへクロスフェードする。
    this.playBossBgm();
    setTimeout(() => {
      this.hideBossWarning();
      this.spawnBoss(image, bossHp);
    }, 1000);
  }

  // ボス出現前の「WARNING」帯テロップの表示／非表示。
  showBossWarning() {
    this.bossWarning.classList.remove('hidden');
  }

  hideBossWarning() {
    this.bossWarning.classList.add('hidden');
  }

  updateBoss(dt) {
    if (!this.boss || !this.boss.alive) return;

    // 被弾フラッシュを時間で減衰させる。
    if (this.boss.flash > 0) {
      this.boss.flash = Math.max(0, this.boss.flash - dt / DAMAGE_FLASH_DURATION);
    }

    this.boss.phase = (this.boss.phase + dt * 0.8) % (Math.PI * 2);
    this.boss.x += Math.sin(this.boss.phase) * 110 * dt;
    this.boss.y = 120 + Math.sin(this.boss.phase * 2) * 24;

    for (const bullet of this.playerBullets) {
      // 弾・ボスともに x/y は中心座標。中心基準で重なりを判定する。
      if (
        Math.abs(bullet.x - this.boss.x) < (bullet.width + this.boss.width) / 2 &&
        Math.abs(bullet.y - this.boss.y) < (bullet.height + this.boss.height) / 2
      ) {
        this.boss.hp -= bullet.damage || 1;
        this.boss.flash = 1;
        bullet.y = -999;
        this.createParticles(this.boss.x, this.boss.y, '#ffd166');
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
      // boss.x/y はボス画像の中心。弾も中心から放つ。
      this.boss.spiralAngle = (this.boss.spiralAngle || 0) + 0.3;
      this.fireEnemyRadial(
        this.boss.x,
        this.boss.y,
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
    // 被弾で武器レベルが1下がる（最低は1つ目）。
    this.loseWeaponLevel();
    this.playerFlash = 1;
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
      this.drawImageFlash(img, -this.player.width / 2, -this.player.height / 2, this.player.width, this.player.height, this.playerFlash);
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
    for (const bullet of this.playerBullets) {
      // 弾ごとの画像（ウェポン弾）があればそれを、なければ既定の弾画像を使う。
      const img = bullet.image || this.bulletImage;
      if (img && img.complete && img.naturalWidth) {
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
      const img = item.image;
      const x = item.x - item.width / 2;
      const y = item.y - item.height / 2;
      if (img && img.complete && img.naturalWidth) {
        this.ctx.drawImage(img, x, y, item.width, item.height);
      } else {
        this.ctx.fillStyle = '#7dff9a';
        this.ctx.fillRect(x, y, item.width, item.height);
        this.ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, item.width, item.height);
      }
    }
  }

  // ウェポンアイテムを描画する。画像が未ロードならタイプ別の色付き矩形でフォールバックする。
  drawWeaponItems() {
    const fallbackColors = { straight: '#ffd166', spread: '#5cf2ff', heavy: '#c77dff', bomb: '#ff6b6b' };
    for (const item of this.weaponItems) {
      const img = item.image;
      const x = item.x - item.width / 2;
      const y = item.y - item.height / 2;
      if (img && img.complete && img.naturalWidth) {
        this.ctx.drawImage(img, x, y, item.width, item.height);
      } else {
        this.ctx.fillStyle = fallbackColors[item.type] || '#ffd166';
        this.ctx.fillRect(x, y, item.width, item.height);
        this.ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, item.width, item.height);
      }
    }
  }

  drawEnemyBullets() {
    const img = this.enemyBulletImage;
    // 表示サイズは当たり判定サイズの4倍（見た目のみ拡大。ヒットボックスは据え置き）。
    const displayScale = 4;
    for (const bullet of this.enemyBullets) {
      if (img && img.complete && img.naturalWidth) {
        const w = bullet.width * displayScale;
        const h = bullet.height * displayScale;
        this.ctx.drawImage(img, bullet.x - w / 2, bullet.y - h / 2, w, h);
      } else {
        this.ctx.fillStyle = '#ff9f1c';
        this.ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
      }
    }
  }

  // 画像を白フラッシュ付きで描画する。amount(0..1) の分だけ画像の形のまま白く上塗りする。
  drawImageFlash(img, x, y, w, h, amount) {
    this.ctx.drawImage(img, x, y, w, h);
    if (amount > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, Math.min(1, amount));
      // brightness(0)→真っ黒 → invert(1)→真っ白。アルファ（形）は保たれる。
      this.ctx.filter = 'brightness(0) invert(1)';
      this.ctx.drawImage(img, x, y, w, h);
      this.ctx.restore();
    }
  }

  drawEnemies() {
    for (const enemy of this.enemies) {
      // 画像が指定され読み込み済みなら画像で、そうでなければ従来の単色矩形で描画する。
      const img = enemy.image;
      if (img && img.complete && img.naturalWidth) {
        this.drawImageFlash(img, enemy.x - enemy.width / 2, enemy.y - enemy.height / 2, enemy.width, enemy.height, enemy.flash);
      } else {
        this.ctx.fillStyle = enemy.color || '#ff6b6b';
        this.ctx.fillRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2, enemy.width, enemy.height);
      }
    }
  }

  drawBoss() {
    if (!this.boss || !this.boss.alive) return;
    this.ctx.save();
    this.ctx.translate(this.boss.x, this.boss.y);
    // 画像が指定され読み込み済みなら画像で、そうでなければ従来の矩形で描画する。
    const img = this.boss.image;
    if (img && img.complete && img.naturalWidth) {
      this.drawImageFlash(img, -this.boss.width / 2, -this.boss.height / 2, this.boss.width, this.boss.height, this.boss.flash);
    } else {
      this.ctx.fillStyle = '#ff5d8f';
      this.ctx.fillRect(-this.boss.width / 2, -this.boss.height / 2, this.boss.width, this.boss.height);
      this.ctx.fillStyle = '#7dff9a';
      this.ctx.fillRect(-this.boss.width / 2 + 10, -this.boss.height / 2 + 10, this.boss.width - 20, this.boss.height - 20);
    }
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
      this.drawWeaponItems();
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
