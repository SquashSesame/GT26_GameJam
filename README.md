# GKT Shooter

HTML/CSS/JavaScript で作成した縦スクロール風シューティングゲームです。Electron で実行でき、macOS 向けのディストリビューション用ビルドにも対応しています。

## 仕様
- 矢印キーまたは WASD で移動
- マウスでも移動可能
- 自動連射で上方向へ弾を発射
- 敵に当たると倒せてスコア加算
- ステージの最後にボスが出現
- ボスを倒すとステージクリア、次のステージに進む

## 実行方法
```bash
npm install
npm start
```


macOS では dmg 形式のインストーラーが生成されます。

### Windows x64 用ビルド
```bash
npm run dist:win
```

このコマンドは Windows x64 向けの NSIS インストーラーを生成します。

### macOS 用ビルド
```bash
npm run dist:mac
```


# Clone 
- git clone https://github.com/SquashSesame/GT26_GameJam.git
