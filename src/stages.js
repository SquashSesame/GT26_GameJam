// ステージテーブル（ステージ定義データ）。
// game.js より前に読み込むこと。グローバルの STAGES / STAGES_BY_NUMBER を参照する。
//
// 各エントリのフィールド:
//   stage: ステージ番号（数字）
//   name:  ステージ名（文字列）
//   image: 背景に使う画像ファイル名（res/img 内 / PNG）
//   bgm:   ステージ中に流すBGMファイル名（res/snd 内 / OGG）
const STAGES = [
  { stage: 1, name: 'USA',    image: 'bg_street_usa.png',    bgm: 'bgm_game2.ogg' },
  { stage: 2, name: 'RUSSIA', image: 'bg_street_russia.png', bgm: 'bgm_game3.ogg' },
  { stage: 3, name: 'Space',  image: 'bg_street_space.png',  bgm: 'bgm_space.ogg' }
];

// ステージ番号からステージ定義を引くためのマップ。
const STAGES_BY_NUMBER = {};
for (const s of STAGES) {
  STAGES_BY_NUMBER[s.stage] = s;
}

// Electron / CommonJS 環境からも読み込めるようにする（ブラウザ単体では無視される）。
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STAGES, STAGES_BY_NUMBER };
}
