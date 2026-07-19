// 敵関連のソース（種類定義・移動アルゴリズム・敵本体・出現制御）。
// game.js より前に読み込むこと。
// グローバルの ENEMY_TYPES / createMovement / Enemy / SpawnController を参照する。

// 敵の表示・当たり判定サイズの倍率（基準サイズに対する拡大率）。
const ENEMY_SIZE_SCALE = 5;

// 敵の下降速度（縦方向 vy）の倍率。デフォルト値・テーブルの speedY 指定の両方に効く。
const ENEMY_DESCENT_SCALE = 3;

// 敵の種類の定義（見た目・耐久・スコア）。width/height には ENEMY_SIZE_SCALE を掛けたサイズを用いる。
const ENEMY_TYPES = {
  grunt: { width: 26 * ENEMY_SIZE_SCALE, height: 26 * ENEMY_SIZE_SCALE, hp: 1, color: '#ff6b6b', score: 100 },
  diver: { width: 30 * ENEMY_SIZE_SCALE, height: 30 * ENEMY_SIZE_SCALE, hp: 2, color: '#ffa94d', score: 150 },
  tank: { width: 40 * ENEMY_SIZE_SCALE, height: 40 * ENEMY_SIZE_SCALE, hp: 5, color: '#c77dff', score: 300 }
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
    enemy.vy = (p.speedY != null ? p.speedY : 140 + game.stage * 2) * ENEMY_DESCENT_SCALE;
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
      enemy.vy *= -3;
    }
  }
}

// まっすぐ下降する（画面外に出たら消える）。
class StraightMovement extends EnemyMovement {
  init(enemy, game) {
    const p = this.params;
    enemy.vx = p.speedX != null ? p.speedX : 0;
    enemy.vy = (p.speedY != null ? p.speedY : 70 + game.stage * 10) * ENEMY_DESCENT_SCALE;
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
    enemy.vy = (p.speedY != null ? p.speedY : 60 + game.stage * 8) * ENEMY_DESCENT_SCALE;
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
    enemy.vy = (p.speedY != null ? p.speedY : 140 + game.stage * 6) * ENEMY_DESCENT_SCALE;
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
    // 出現テーブルで指定された敵画像（未指定なら null。その場合は単色矩形で描画）。
    this.image = config.image || null;
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

// エントリ内で敵を1体ずつ生成する際の間隔（秒）。count 体をこの間隔でずらして出す。
const SPAWN_STAGGER = 0.02;

// 出現テーブルを時間経過にあわせて処理し、敵をスポーンさせる。
// テーブルの各エントリ: { delay, type, count, algorithm, params?, ...formation }
// 各エントリの count 体は、delay 経過後に SPAWN_STAGGER 秒ずつ間隔を空けて1体ずつ生成する。
class SpawnController {
  constructor(game) {
    this.game = game;
    this.reset([]);
  }

  reset(table) {
    // spawnedCount: そのエントリで既に生成した敵の数。
    this.table = (table || []).map((entry) => ({ ...entry, spawnedCount: 0 }));
    this.elapsed = 0;
  }

  update(dt) {
    this.elapsed += dt;
    for (const entry of this.table) {
      const count = entry.count != null ? entry.count : 1;
      const delay = entry.delay || 0;
      // 経過時間に達したぶんだけ、index 順に1体ずつ生成する。
      // （1フレームで複数体ぶんの時間が経過していれば while で追いつく。）
      while (entry.spawnedCount < count &&
             this.elapsed >= delay + entry.spawnedCount * SPAWN_STAGGER) {
        this.game.spawnEnemyAt(entry, entry.spawnedCount, count);
        entry.spawnedCount += 1;
      }
    }
  }

  // テーブルの全エントリを最後まで生成し切ったか（＝ボス出現の前提）。
  isFinished() {
    return this.table.every((entry) => {
      const count = entry.count != null ? entry.count : 1;
      return entry.spawnedCount >= count;
    });
  }
}
