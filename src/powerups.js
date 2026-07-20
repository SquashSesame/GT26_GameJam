// パワーアップ（強化アイテム）テーブル。取得するとプレイヤーの発射方向と攻撃力が変わる。
// game.js より前に読み込むこと。グローバルの POWERUPS / POWERUPS_BY_ID を参照する。
//
// 各エントリのフィールド:
//   id:       パワーアップの識別子（文字列 / 出現テーブルの指定に使う）
//   image:    アイテムの描画に使う画像ファイル名（res/img 内 / PNG）
//             ※未配置の画像は色付き矩形でフォールバック描画される。
//   power:    攻撃力（数字 / 取得後のプレイヤー弾1発のダメージ）
//   category: 発射方向のカテゴリ（文字列 / game.js の FIRE_PATTERNS のキー）
//             1way … 単発 / 2way / 3way / 5way … 前方への拡散数
const POWERUPS = [
  { id: 'spread2', image: 'chocolate.png',    power: 1, category: '2way' },
  { id: 'spread3', image: 'glass_bottle.png', power: 2, category: '3way' },
  { id: 'spread5', image: 'brick.png',        power: 3, category: '5way' }
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
