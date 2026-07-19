// 敵関連のソース（種類定義・移動アルゴリズム・敵本体・出現制御）。
// game.js より前に読み込むこと。
// グローバルの ENEMY_TYPES / createMovement / Enemy / SpawnController を参照する。

// 敵の種類の定義（見た目・耐久・スコア）。
const ENEMY_TYPES = {
  grunt: { width: 26, height: 26, hp: 1, color: '#ff6b6b', score: 100 },
  diver: { width: 30, height: 30, hp: 2, color: '#ffa94d', score: 150 },
  tank: { width: 40, height: 40, hp: 5, color: '#c77dff', score: 300 }
};

// 敵の移動アルゴリズムを表す基底クラス。
class EnemyMovement {
  constructor(params = {}) {
    this.params = params;
  }

  // 敵がスポーンした直後に一度だけ呼ばれ、移動用の初期状態を設定する。
  init(enemy, game) {}

  // 毎フレーム呼ばれ、敵を移動させる。
  update(enemy, dt, game) {}
}

// 左右の壁と下端で跳ね返りながら降りてくる（従来の動き）。
class BounceMovement extends EnemyMovement {
  init(enemy, game) {
    const p = this.params;
    enemy.vx = (p.speedX != null ? p.speedX : 90 + game.stage * 20) * (p.dir != null ? p.dir : 1);
    enemy.vy = p.speedY != null ? p.speedY : 22 + game.stage * 2;
  }

  update(enemy, dt, game) {
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;

    const margin = 20;
    if (enemy.x < margin || enemy.x > game.canvas.width - margin) {
      enemy.vx *= -1;
      enemy.x = Math.max(margin, Math.min(game.canvas.width - margin, enemy.x));
    }

    const bottom = game.canvas.height - 120;
    if (enemy.y > bottom) {
      enemy.y = bottom;
      enemy.vy *= -1;
    }
  }
}

// まっすぐ下降する（画面外に出たら消える）。
class StraightMovement extends EnemyMovement {
  init(enemy, game) {
    const p = this.params;
    enemy.vx = p.speedX != null ? p.speedX : 0;
    enemy.vy = p.speedY != null ? p.speedY : 70 + game.stage * 10;
  }

  update(enemy, dt, game) {
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
  }
}

// 左右にサイン波で揺れながら下降する。
class SineMovement extends EnemyMovement {
  init(enemy, game) {
    const p = this.params;
    enemy.baseX = enemy.x;
    enemy.phase = p.phase != null ? p.phase : 0;
    enemy.vy = p.speedY != null ? p.speedY : 60 + game.stage * 8;
    enemy.amplitude = p.amplitude != null ? p.amplitude : 90;
    enemy.frequency = p.frequency != null ? p.frequency : 2.2;
  }

  update(enemy, dt, game) {
    enemy.phase += dt * enemy.frequency;
    enemy.y += enemy.vy * dt;
    const margin = 20;
    const x = enemy.baseX + Math.sin(enemy.phase) * enemy.amplitude;
    enemy.x = Math.max(margin, Math.min(game.canvas.width - margin, x));
  }
}

// 斜めに進み、左右の壁で反射しながら下降する（ジグザグ）。
class ZigzagMovement extends EnemyMovement {
  init(enemy, game) {
    const p = this.params;
    enemy.vx = (p.speedX != null ? p.speedX : 140 + game.stage * 10) * (p.dir != null ? p.dir : 1);
    enemy.vy = p.speedY != null ? p.speedY : 50 + game.stage * 6;
  }

  update(enemy, dt, game) {
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;

    const margin = 20;
    if (enemy.x < margin || enemy.x > game.canvas.width - margin) {
      enemy.vx *= -1;
      enemy.x = Math.max(margin, Math.min(game.canvas.width - margin, enemy.x));
    }
  }
}

// アルゴリズムタイプ名 → 移動クラス。出現テーブルの algorithm で指定する。
const ENEMY_MOVEMENTS = {
  bounce: BounceMovement,
  straight: StraightMovement,
  sine: SineMovement,
  zigzag: ZigzagMovement
};

function createMovement(algorithm, params) {
  const MovementClass = ENEMY_MOVEMENTS[algorithm] || BounceMovement;
  return new MovementClass(params);
}

// 個々の敵。移動は movement（EnemyMovement）に委譲する。
class Enemy {
  constructor(config, movement) {
    this.x = config.x;
    this.y = config.y;
    this.width = config.width;
    this.height = config.height;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.alive = true;
    this.type = config.type;
    this.color = config.color;
    this.score = config.score;
    this.movement = movement;
  }

  init(game) {
    if (this.movement && this.movement.init) {
      this.movement.init(this, game);
    }
  }

  update(dt, game) {
    if (this.movement && this.movement.update) {
      this.movement.update(this, dt, game);
    }
  }
}

// 出現テーブルを時間経過にあわせて処理し、敵をスポーンさせる。
// テーブルの各エントリ: { delay, type, count, algorithm, params?, ...formation }
class SpawnController {
  constructor(game) {
    this.game = game;
    this.reset([]);
  }

  reset(table) {
    this.table = (table || []).map((entry) => ({ ...entry, spawned: false }));
    this.elapsed = 0;
  }

  update(dt) {
    this.elapsed += dt;
    for (const entry of this.table) {
      if (!entry.spawned && this.elapsed >= (entry.delay || 0)) {
        entry.spawned = true;
        this.game.spawnEntry(entry);
      }
    }
  }

  // テーブルの全エントリがスポーン済みか（＝ボス出現の前提）。
  isFinished() {
    return this.table.every((entry) => entry.spawned);
  }
}
