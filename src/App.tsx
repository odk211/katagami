import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProjectList } from './features/project/ProjectList'
import { PatternProjectPage } from './pages/PatternProjectPage'
import { LayoutProjectPage } from './pages/LayoutProjectPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ProjectList />} />
          <Route path="/patterns/:projectId" element={<PatternProjectPage />} />
          <Route path="/layouts/:projectId" element={<LayoutProjectPage />} />
          <Route path="/projects/:projectId" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
