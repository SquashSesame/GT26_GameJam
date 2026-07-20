// 敵の出現テーブル（ステージ設計データ）。
// game.js より前に読み込むこと。グローバル変数 SPAWN_TABLES として参照される。
//
// キー: ステージ番号
// 値  : そのステージの出現エントリ配列
//
// 各エントリのフィールド:
//   delay:     ステージ開始からの待ち時間（秒）
//   type:      出現させる敵（game.js の ENEMY_TYPES のキー: grunt / diver / tank）
//   count:     敵の数
//   hp:        敵1体の体力（省略可 / 省略時は type 既定値＋ステージ補正）
//   algorithm: 移動アルゴリズム（game.js の ENEMY_MOVEMENTS のキー: bounce / straight / sine / zigzag）
//   params:    アルゴリズムへの任意パラメータ（省略可 / 例: { speedY: 130, amplitude: 90 }）
//   startY / rowSpacing / columns: 隊形の指定（省略可）
//   image:     敵の描画に使う画像ファイル名（res/img 内 / 省略可 / 例: 'hotdog_stand.png'）
//              省略した場合は type ごとの単色矩形で描画される。
//
// ボス出現エントリ（任意 / 1ステージに1つ）:
//   { delay: <秒>, boss: true, hp?: <体力>, image?: <ファイル名> }
//   hp: ボスの体力（省略可 / 省略時は 26 + ステージ×4）。
//   ステージ開始から delay 秒後にボス戦へ移行する（予告表示 → 1秒後にボス出現）。
//   image: ボスの描画に使う画像ファイル名（res/img 内 / 省略可 / 例: 'cat_2.png'）。
//          省略した場合はボスは矩形で描画される。
//   このエントリを置かない場合は、出現テーブルを全て消化し敵を全滅させた時点で
//   ボスが出現する（従来動作のフォールバック）。
//
// アイテム出現エントリ（任意 / 好きな数だけ置ける）:
//   { delay: <秒>, item: 'weapon',  id: <weapons.js の id: ball / car / building / nuclear> }
//   { delay: <秒>, item: 'powerup', id: <powerups.js の id: spread2 / spread3 / spread5> }
//   x: 横位置（px / 省略時は横位置ランダム）。
//   ステージ開始から delay 秒後に、指定アイテムが画面上から1つ落下する。
const SPAWN_TABLES = {
  1: [
    { delay: 0.8, type: 'grunt', count: 10, hp: 2, algorithm: 'bounce', image: 'enemy_hotdog_stand.png' },
    { delay: 4.0, type: 'grunt', count: 10, hp: 2, algorithm: 'sine', image: 'enemy_hotdog_stand.png' },
    { delay: 5.0, item: 'powerup', id: 'spread3' },
    { delay: 8.0, type: 'diver', count: 10, hp: 3, algorithm: 'zigzag', image: 'enemy_hotdog_stand.png' },
    { delay: 10.0, item: 'weapon', id: 'car' },
    { delay: 12.8, type: 'grunt', count: 10, hp: 2, algorithm: 'bounce', image: 'enemy_hotdog_stand.png' },
    { delay: 14.0, type: 'grunt', count: 10, hp: 2, algorithm: 'sine', image: 'enemy_hotdog_stand.png' },
    { delay: 16.0, type: 'diver', count: 10, hp: 3, algorithm: 'zigzag', image: 'enemy_hotdog_stand.png' },
    { delay: 18.0, boss: true, hp: 100, image: 'boss_trump_robot.png' }
  ],
  2: [
    { delay: 0.8, type: 'grunt', count: 7, hp: 2, algorithm: 'sine', image: 'enemy_hotdog_stand.png' },
    { delay: 3.0, item: 'powerup', id: 'spread5' },
    { delay: 4.0, type: 'diver', count: 5, hp: 3, algorithm: 'zigzag', image: 'enemy_hotdog_stand.png' },
    { delay: 8.0, type: 'diver', count: 5, hp: 3, algorithm: 'straight', params: { speedY: 130 }, image: 'enemy_hotdog_stand.png' },
    { delay: 9.0, item: 'weapon', id: 'building' },
    { delay: 11.0, type: 'tank', count: 2, hp: 6, algorithm: 'bounce', image: 'enemy_hotdog_stand.png' },
    { delay: 16.0, boss: true, hp: 200, image: 'boss_russia.png' }
  ],
  3: [
    { delay: 0.6, type: 'diver', count: 8, hp: 3, algorithm: 'sine', image: 'enemy_hotdog_stand.png' },
    { delay: 3.0, item: 'weapon', id: 'nuclear' },
    { delay: 4.0, type: 'tank', count: 3, hp: 5, algorithm: 'bounce', image: 'enemy_hotdog_stand.png' },
    { delay: 8.0, type: 'diver', count: 6, hp: 3, algorithm: 'zigzag', image: 'enemy_hotdog_stand.png' },
    { delay: 10.0, item: 'powerup', id: 'spread5' },
    { delay: 12.0, type: 'tank', count: 3, hp: 5, algorithm: 'straight', params: { speedY: 150 }, image: 'enemy_hotdog_stand.png' },
    { delay: 18.0, boss: true, hp: 400, image: 'boss_lastboss_spaceship.png' }
  ]
};

// Electron / CommonJS 環境からも読み込めるようにする（ブラウザ単体では無視される）。
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SPAWN_TABLES;
}
