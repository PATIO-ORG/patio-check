import { Navigate, Route, Routes } from 'react-router-dom'
import { useSessao } from './auth/sessao'
import { Login } from './features/shared/Login'
import { LayoutFiscal } from './features/fiscal/LayoutFiscal'
import { ListaDoDia } from './features/fiscal/ListaDoDia'
import { DetalheDriver } from './features/fiscal/DetalheDriver'
import { ReportarDivergencia } from './features/fiscal/ReportarDivergencia'
import { LayoutAnalista } from './features/analista/LayoutAnalista'
import { Dashboard } from './features/analista/Dashboard'
import { Escala } from './features/analista/Escala'
import { Alertas } from './features/analista/Alertas'
import { Relatorios } from './features/analista/Relatorios'
import { Auditoria } from './features/analista/Auditoria'

export function App() {
  const { usuario, carregando } = useSessao()

  if (carregando) {
    return <main className="grid min-h-dvh place-items-center bg-concreto text-brita">Carregando sessão…</main>
  }
  if (!usuario) return <Login />

  if (usuario.papel === 'fiscal') {
    return (
      <Routes>
        <Route element={<LayoutFiscal />}>
          <Route path="/patio" element={<ListaDoDia />} />
          <Route path="/patio/:itemId" element={<DetalheDriver />} />
          <Route path="/patio/:itemId/divergencia" element={<ReportarDivergencia />} />
        </Route>
        <Route path="*" element={<Navigate to="/patio" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<LayoutAnalista />}>
        <Route path="/painel" element={<Dashboard />} />
        <Route path="/escala" element={<Escala />} />
        <Route path="/alertas" element={<Alertas />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/auditoria" element={<Auditoria />} />
      </Route>
      <Route path="*" element={<Navigate to="/painel" replace />} />
    </Routes>
  )
}
