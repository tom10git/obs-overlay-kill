# セキュリティポリシー

## サポート対象

| バージョン | サポート |
| ---------- | -------- |
| 最新の `main` / タグ付きリリース | ✅ |
| それ以前の未メンテナンス版 | ❌ |

バージョン番号は `package.json` の `version` を参照してください。

## 脆弱性の報告（非公開）

本プロジェクトは [調整された開示（Coordinated Disclosure）](https://docs.github.com/ja/code-security/concepts/vulnerability-reporting-and-management/about-coordinated-disclosure-of-security-vulnerabilities) に従います。

- **公開 Issue に脆弱性の詳細を書かないでください**（悪用される前に修正するため）。
- 報告は GitHub の **Security Advisories → Report a vulnerability**（プライベート脆弱性レポートが有効な場合）、またはリポジトリオーナーへの非公開連絡でお願いします。
- 可能であれば、再現手順・影響範囲・想定される修正案を含めてください。

### 報告者に期待できること

- 受領の確認（可能な限り早く）
- 調査結果と修正方針の共有
- 修正リリース後のクレジット（希望がある場合）

### 報告者にお願いしたいこと

- 修正の公開前に脆弱性を公表しないこと
- 許可なく本番データや第三者アカウントへアクセスしないこと

## サプライチェーン・開発者向け対策

依存関係と CI の防御設定の概要は [docs/SUPPLY-CHAIN-SECURITY.md](docs/SUPPLY-CHAIN-SECURITY.md) を参照してください。

### ローカル（Windows）で守ること

- **`install.bat` / `build.bat` は信頼できる公式クローンからのみ実行**する（改ざんされたバッチや lockfile は任意コード実行につながります）。
- 依存関係の追加・更新後は **`package-lock.json` をコミット**し、再インストールは `npm ci`（`scripts\npm-ci-deps.bat`）を使う。
- `.npmrc` の **`ignore-scripts=true`** を維持する（悪意ある `postinstall` 対策）。

### GitHub 上で有効にすること（リポジトリ設定）

- **Settings → Code security and analysis**: Dependabot alerts / security updates を有効化（プライベートリポジトリの場合）
- **Branch protection**: CI ワークフロー（lint / build / audit / dependency-review）をマージ必須にする

## 参考

- [GitHub Actions サプライチェーン対策（2026）](https://zenn.dev/shineos/articles/github-actions-supply-chain-security-2026)
- [GitHub: 今日できる 4 つの防御策](https://github.blog/changelog/2026-04-01-securing-the-open-source-supply-chain-across-github/)
