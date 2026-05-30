# Security Policy

## 報告

脆弱性の報告は、公開 Issue ではなく開発者（Adelaide）へ直接連絡してください。内容・再現手順・影響範囲を含めてください。

## サポート対象

| 範囲 | サポート |
| --- | --- |
| リポジトリの最新 `main` / 直近リリースタグ | 対応 |
| それより古いタグ・第三者による改変ビルド | 対象外 |

## 依存関係のセキュリティ

このリポジトリでは次を採用しています。

- **`.npmrc`**: `ignore-scripts=true`（ライフサイクルスクリプト無効）、`min-release-age=7`（公開直後バージョンの拒否、npm 11.10+）
- **`package-lock.json` + `npm ci`**: lockfile に記載された依存のみを再現インストール
- **Dependabot**: 週次更新 PR に 7 日（major は 14 日）の cooldown（[設定](.github/dependabot.yml)）
- **GitHub Actions**: `npm audit` と PR 時の dependency review（[workflow](.github/workflows/npm-security.yml)）

ローカルでの確認:

```bash
npm run security:audit
npm run security:outdated
```

`ignore-scripts=true` のため、macOS で `fsevents` などが必要な場合のみ `npm rebuild fsevents` を実行してください（本プロジェクトの Windows 開発では通常不要）。

npm を 11.10 未満にしている場合は `min-release-age` が効かないため、npm の更新を推奨します。

## 参考

- [npmサプライチェーン攻撃対策の最初の一歩（Qiita）](https://qiita.com/masato_makino/items/516ca6f8a8b497131602)
