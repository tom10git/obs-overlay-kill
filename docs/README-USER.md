## OBS Overlay Kill（一般ユーザー向け）

開発環境は不要です。**配布された `OBS-Overlay-Kill.exe` を実行して OBS に取り込む**だけで使えます。

> このリポジトリにある `.bat`（バッチファイル）は主に**開発者向け**です。配布 exe を使うだけなら基本的に不要です。

### 使い方（最短）

- **起動**: 配布物を展開 → `OBS-Overlay-Kill.exe` を起動
- **表示**: ブラウザで `http://localhost:4173/overlay` を開く（既定ポート）
- **OBSに取り込み**: OBS で「ブラウザソース」または「ウィンドウキャプチャー」で上記ページを取り込む
- **設定**: `/overlay` 内の設定パネルで HP / 攻撃 / 回復 / 効果音 などを調整
- **保存**: 設定パネルの「保存」を押す（自動で保存されます）
- **終了**: 起動した黒いウィンドウで `Ctrl + C`

### 保存先（触ってよい範囲）

初回起動時、exe 内の設定・素材がここへコピーされます。

- `%LOCALAPPDATA%\OBS-Overlay-Kill\data\`
  - 効果音: `data\src\sounds\`
  - 画像・WebM: `data\src\images\`
  - 設定: `data\config\overlay-config.json`
  - カスタム技名（任意）: `data\config\customTechniqueNames.ts`

### 設定を初期化したい

- `data\config\overlay-config.json` を削除して exe を再起動すると初期設定に戻ります。

### ポート変更

PowerShell 例:

```powershell
$env:OVERLAY_PORT=8080
.\OBS-Overlay-Kill.exe
```

### 困ったとき

同梱の [`docs/README-配布.txt`](README-配布.txt) を参照してください（同内容のテキスト版）。

