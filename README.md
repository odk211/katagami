# 型紙チェック (Katagami)

裁縫本の型紙ページをスマホで撮影し、トレースしたパーツが手持ちの生地に収まるかを確認するPWA。

## 機能

- 裁縫本の型紙ページの撮影・保存（オリジナル解像度）
- 既知寸法によるスケール校正
- 手動多角形トレース
- 自動ネスティング + 手動調整
- 足りる/足りない判定、使用率、不足量の表示

## 開発

```bash
npm install
npm run dev
```

## 公開

https://odk211.github.io/katagami/

`main` に push すると GitHub Actions（`.github/workflows/deploy.yml`）が lint・テスト・ビルドを行い、GitHub Pages にデプロイする。Actions タブから手動実行もできる。

初回のみ、リポジトリの Settings → Pages → Build and deployment の Source を「GitHub Actions」にする。

ローカルで本番ビルドを確認するときは `npm run build && npm run preview` を実行し、`/katagami/` を開く。

## テスト

```bash
npm test
```

## 技術スタック

- React 19 + TypeScript + Vite
- Konva (キャンバス)
- Dexie.js (IndexedDB)
- Tailwind CSS + PWA
