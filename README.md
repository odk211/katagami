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

## ビルド

```bash
npm run build
npm run preview
```

## テスト

```bash
npm test
```

## 技術スタック

- React 19 + TypeScript + Vite
- Konva (キャンバス)
- Dexie.js (IndexedDB)
- Tailwind CSS + PWA
