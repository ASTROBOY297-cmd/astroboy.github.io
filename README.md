# 家計在庫アプリ（Web版）

Excel 版の「買い物入力 → 在庫自動反映 → 発注点で買い物リスト」を**GitHub Pages**で動く静的Webアプリに移植しました。

## 追加仕様（重複入力のマージ）
- 同名の名称が入力された場合、**同じ日付・同じ区分（購入/使用）**であれば、**履歴の既存行に数量を加算**します（新規行は増えません）。
- 例：同日に「牛乳・購入・1」を3回入れると、履歴は1行で数量=3になります。

## デプロイ（GitHub Pages）
1. このリポジトリを作成し、`index.html` `styles.css` `app.js` をコミット。
2. GitHub → **Settings → Pages** → Branch: `main` / Folder: `/(root)` → Save。
3. 公開URL（`https://<your-account>.github.io/<repo>/`）でアクセスできます。

## 保存
- データはブラウザの `localStorage` に保存します。JSONの**エクスポート/インポート**に対応。

© 2026 家計在庫アプリ（Web版）
