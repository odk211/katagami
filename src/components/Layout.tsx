import { Link, Outlet, useLocation } from 'react-router-dom'

export function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-1">
          {!isHome && (
            <Link to=".." className="-ml-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-primary">
              ← 戻る
            </Link>
          )}
          <h1 className="text-lg font-bold text-gray-900">型紙チェック</h1>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4">
        <Outlet />
      </main>
    </div>
  )
}
