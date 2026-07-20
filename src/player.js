// プレイヤー関連のソース（ステートマシンと生成ロジック）。
// game.js より前に読み込むこと。グローバルの PlayerStateMachine / createPlayer を参照する。

// プレイヤーの状態を表す基底クラス。
class PlayerState {
  constructor(player, stateMachine) {
    this.player = player;
    this.stateMachine = stateMachine;
  }

  enter() {}
  exit() {}
  update(dt) {}
}

// 通常状態。キー・マウス入力にしたがって移動する。
class PlayerNormalState extends PlayerState {
  update(dt) {
    this.player.applyMovement(dt);
  }
}

// 被弾直後の無敵状態。一定時間で通常状態へ戻る。
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

// プレイヤーの状態遷移を管理するステートマシン。
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

// プレイヤーオブジェクトを生成し、ステートマシンを紐付けて返す。
// 入力（game.keys / game.mouse）と画面サイズ（game.canvas）を参照する。
function createPlayer(game) {
  const canvas = game.canvas;
  const player = {
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

      // マウス位置へ滑らかに追従する（カーソルへ向かって線形補間）。
      if (game.mouse.x !== undefined) {
        const follow = Math.min(1, dt * 16);
        player.x += (game.mouse.x - player.x) * follow;
        player.y += (game.mouse.y - player.y) * follow;
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

  player.stateMachine = new PlayerStateMachine(player);
  return player;
}
