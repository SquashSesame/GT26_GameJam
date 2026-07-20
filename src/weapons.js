// ウェポン（武器）テーブル。ウェポンアイテムで切り替わるプレイヤーの武器を定義する。
// game.js より前に読み込むこと。グローバルの WEAPONS / WEAPONS_BY_ID を参照する。
//
// 各エントリのフィールド:
//   id:    ウェポンの識別子（文字列 / アイテムのドロップ・切替に使う）
//   image: 弾とアイテムの描画に使う画像ファイル名（res/img 内 / PNG）
//          ※未配置の画像はタイプ別の色付き矩形でフォールバック描画される。
//   type:  発射パターンの種類（文字列 / game.js の fireWeapon が解釈する）
//          straight … 直進弾を2発 / spread … 5way拡散 / heavy … 大型・低速・高威力 /
//          bomb      … 広範囲の大量弾
const WEAPONS = [
  { id: 'ball',     image: 'baseball.png', type: 'straight' },
  { id: 'car',      image: 'car.png',      type: 'spread' },
  { id: 'billding', image: 'building.png', type: 'heavy' },
  { id: 'atmbom',   image: 'atmbom.png',   type: 'bomb' }
];

// id からウェポン定義を引くためのマップ。
const WEAPONS_BY_ID = {};
for (const w of WEAPONS) {
  WEAPONS_BY_ID[w.id] = w;
}

// Electron / CommonJS 環境からも読み込めるようにする（ブラウザ単体では無視される）。
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WEAPONS, WEAPONS_BY_ID };
}
