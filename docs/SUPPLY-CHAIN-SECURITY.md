# サプライチェーン・セキュリティ

GitHub Actions / npm を中心に、このリポジトリで採用している防御策の一覧です。

## リポジトリ内の設定

| 対策 | ファイル | 内容 |
| ---- | -------- | ---- |
| lockfile 厳守 | `package-lock.json` + `scripts/npm-ci-deps.bat` | `npm ci` のみ（`npm install` は lock 更新用に手動で） |
| install スクリプト無効化 | `.npmrc` | `ignore-scripts=true` |
| 監査しきい値 | `.npmrc` / CI | `audit-level=high` |
| Dependabot | `.github/dependabot.yml` | npm・GitHub Actions の週次更新 |
| CI | `.github/workflows/ci.yml` | lint / build / `npm audit` |
| PR 依存レビュー | `.github/workflows/ci.yml` | Dependency Review（high 以上で失敗） |
| CodeQL | `.github/workflows/codeql.yml` | TypeScript / ワークフロー解析 |
| 脆弱性報告 | `SECURITY.md` | 非公開報告・調整開示 |

## install.bat の設計

1. **信頼できるクローンのみ** — 冒頭で注意表示。
2. **Node.js** — 未導入時は `winget install --id OpenJS.NodeJS.LTS --source winget`（公式 winget ソース指定）。
3. **依存関係** — `scripts\npm-ci-deps.bat` → `npm ci` + 任意の `npm audit`。
4. **`.env`** — 初回のみ `.env.example` からコピー（シークレットは Git に含めない）。

### 環境変数（バッチ）

| 変数 | 効果 |
| ---- | ---- |
| `OBS_OVERLAY_KILL_SKIP_AUDIT=1` | `npm audit` をスキップ |
| `OBS_OVERLAY_KILL_STRICT_AUDIT=1` | high 以上の audit でインストール失敗 |
| `OBS_OVERLAY_KILL_NON_INTERACTIVE=1` | `build.bat` 等の `pause` を省略 |

## GitHub Actions の原則

- ワークフロー全体の **`permissions` を最小化**（`contents: read` など）。
- サードパーティ Action は **コミット SHA でピン留め**（`checkout` / `setup-node`）。Dependabot の `github-actions` 更新 PR は **Dependabot 由来か確認**してからマージ。
- **`pull_request_target` は使用しない**（フォーク PR からのシークレット窃取リスク）。
- 外部入力を `run:` に直接展開しない（スクリプトインジェクション対策）。

## npm / パッケージ

- **axios 等の侵害バージョン** — Advisory / Dependabot を確認。怪しいバージョンは即削除・lock 更新。
- **手動で依存を足すとき** — パッケージ名のタイポに注意。可能なら PR で Dependency Review を通す。
- **`npm audit fix --force`** — CI では使わず、互換性を確認してから lock を更新。

## まだリポジトリ外で必要なこと

1. GitHub **Dependabot alerts** を有効化（プライベートの場合）。
2. **Branch protection** で CI を必須チェックにする。
3. 組織利用時は **Allowed actions** の許可リストを検討。
4. 本番シークレットは **OIDC / 環境シークレット** を優先（長期トークンを Actions に置かない）。

## 参考リンク

- [Zenn: GitHub Actions サプライチェーン 2026](https://zenn.dev/shineos/articles/github-actions-supply-chain-security-2026)
- [@IT: GitHub が推奨する 4 つの対策](https://news.yahoo.co.jp/articles/597e12e69b5cea0fe8dbb50947251206946f5f8f)
- [Qiita: GitHub と npm の防御設定 8 選](https://qiita.com/miruky/items/fcab851c5351f79b481d)
- [GitHub Docs: 調整された開示](https://docs.github.com/ja/code-security/concepts/vulnerability-reporting-and-management/about-coordinated-disclosure-of-security-vulnerabilities)
