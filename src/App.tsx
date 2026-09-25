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
    return (
      <main className="flex min-h-dvh items-center justify-center bg-asfalto text-concreto">
        <div className="anim-entrada-app text-center">
          <p className="rotulo text-demarcacao">Fiscalização de pátio</p>
          <p className="mt-3 font-display text-xl font-bold">Abrindo seu pátio...</p>
        </div>
      </main>
    )
  }

  if (!usuario) return <Login />

  if (usuario.papel === 'fiscal') {
    return (
      <div key={usuario.id} className="anim-entrada-app">
        <Routes>
          <Route element={<LayoutFiscal />}>
            <Route path="/patio" element={<ListaDoDia />} />
            <Route path="/patio/:itemId" element={<DetalheDriver />} />
            <Route path="/patio/:itemId/divergencia" element={<ReportarDivergencia />} />
          </Route>
          <Route path="*" element={<Navigate to="/patio" replace />} />
        </Routes>
      </div>
    )
  }

  return (
    <div key={usuario.id} className="anim-entrada-app">
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
    </div>
  )
}
