// パワーアップ（強化アイテム）テーブル。取得するとプレイヤーの発射方向（way）が変わる。
// 攻撃力はウェポン側（weapons.js の power）で管理する。
// game.js より前に読み込むこと。グローバルの POWERUPS / POWERUPS_BY_ID を参照する。
//
// 各エントリのフィールド:
//   id:       パワーアップの識別子（文字列 / 出現テーブルの指定に使う）
//   category: 発射方向のカテゴリ（文字列 / game.js の FIRE_PATTERNS のキー）
//             1way … 単発 / 2way / 3way / 4way / 5way … 前方への拡散数
const POWERUPS = [
  { id: 'spread1', category: '1way' },
  { id: 'spread2', category: '2way' },
  { id: 'spread3', category: '3way' },
  { id: 'spread4', category: '4way' },
  { id: 'spread5', category: '5way' }
];

// id からパワーアップ定義を引くためのマップ。
const POWERUPS_BY_ID = {};
for (const p of POWERUPS) {
  POWERUPS_BY_ID[p.id] = p;
}

// Electron / CommonJS 環境からも読み込めるようにする（ブラウザ単体では無視される）。
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { POWERUPS, POWERUPS_BY_ID };
}
