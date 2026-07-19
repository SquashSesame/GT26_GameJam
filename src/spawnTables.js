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
//   algorithm: 移動アルゴリズム（game.js の ENEMY_MOVEMENTS のキー: bounce / straight / sine / zigzag）
//   params:    アルゴリズムへの任意パラメータ（省略可 / 例: { speedY: 130, amplitude: 90 }）
//   startY / rowSpacing / columns: 隊形の指定（省略可）
const SPAWN_TABLES = {
  1: [
    { delay: 0.8, type: 'grunt', count: 6, algorithm: 'bounce' },
    { delay: 5.0, type: 'grunt', count: 5, algorithm: 'sine' },
    { delay: 9.0, type: 'diver', count: 4, algorithm: 'zigzag' }
  ],
  2: [
    { delay: 0.8, type: 'grunt', count: 7, algorithm: 'sine' },
    { delay: 4.0, type: 'diver', count: 5, algorithm: 'zigzag' },
    { delay: 8.0, type: 'diver', count: 5, algorithm: 'straight', params: { speedY: 130 } },
    { delay: 11.0, type: 'tank', count: 2, algorithm: 'bounce' }
  ],
  3: [
    { delay: 0.6, type: 'diver', count: 8, algorithm: 'sine' },
    { delay: 4.0, type: 'tank', count: 3, algorithm: 'bounce' },
    { delay: 8.0, type: 'diver', count: 6, algorithm: 'zigzag' },
    { delay: 12.0, type: 'tank', count: 3, algorithm: 'straight', params: { speedY: 150 } }
  ]
};

// Electron / CommonJS 環境からも読み込めるようにする（ブラウザ単体では無視される）。
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SPAWN_TABLES;
}
