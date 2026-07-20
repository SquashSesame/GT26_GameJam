// ポータルテーブル。出現テーブルから id 指定で出現させるポータルの種類を定義する。
// game.js より前に読み込むこと。グローバルの PORTALS / PORTALS_BY_ID を参照する。
//
// 各エントリのフィールド:
//   id:    ポータルの識別子（文字列 / 出現テーブルの指定に使う）
//   name:  ポータルの名前（文字列）
//   image: アイコンの描画に使う画像ファイル名（res/img 内 / PNG）
//   stage: 取得したときに移動する先のステージ番号（数字）。
//          maxStages を超える番号を指定するとゲームクリアになる。
const PORTALS = [
  { id: 'japan',  name: 'Japan',  image: 'portal_japan.png', stage: 1 },
  { id: 'usa',    name: 'USA',    image: 'portal_usa.png',    stage: 1 },
  { id: 'russia', name: 'Russia', image: 'portal_russia.png', stage: 2 },
  { id: 'uk',     name: 'UK',     image: 'portal_uk.png',     stage: 2 },
  { id: 'france', name: 'France', image: 'portal_france.png', stage: 3 },
  { id: 'italy',  name: 'Italy',  image: 'portal_italy.png',  stage: 3 },
  { id: 'china',  name: 'China',  image: 'portal_china.png',  stage: 3 },
  { id: 'gate',   name: 'Warp Gate', image: 'portal_gate.png', stage: 99 }
];

// id からポータル定義を引くためのマップ。
const PORTALS_BY_ID = {};
for (const p of PORTALS) {
  PORTALS_BY_ID[p.id] = p;
}

// Electron / CommonJS 環境からも読み込めるようにする（ブラウザ単体では無視される）。
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PORTALS, PORTALS_BY_ID };
}
