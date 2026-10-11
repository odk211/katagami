import { Card } from './ui/Card'

export function PhotoGuide() {
  return (
    <Card className="mb-4 bg-violet-50 border-violet-100">
      <h3 className="mb-2 font-semibold text-violet-900">撮影のコツ</h3>
      <ul className="space-y-1 text-sm text-violet-800">
        <li>・本のページを平らに開いて、真上から撮影</li>
        <li>・明るい場所で、影が型紙にかからないように</li>
        <li>・本に書かれた寸法ラベルが読めるように</li>
        <li>・ページ全体が画面に収まる距離で</li>
      </ul>
    </Card>
  )
}
