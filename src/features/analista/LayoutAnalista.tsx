import { NavLink, Outlet } from 'react-router-dom'
import { useSessao } from '../../auth/sessao'
import { HOJE, reiniciarDemonstracao, useLiveData, useSimulador } from '../../data/provider'
import { podeEditarEscala } from '../../domain/status'
import { dataExtensa } from '../shared/ui'

export function LayoutAnalista() {
  const { usuario, sair } = useSessao()
  const { dados: alertas } = useLiveData((ds) => ds.listarAlertasAbertos(HOJE))
  const { rodando, alternar } = useSimulador()

  const podeEditar = usuario ? podeEditarEscala(usuario.papel) : false
  const links = [
    { to: '/painel', rotulo: 'Painel' },
    ...(podeEditar ? [{ to: '/escala', rotulo: 'Escala' }] : []),
    { to: '/alertas', rotulo: 'Alertas', badge: alertas?.length },
    { to: '/relatorios', rotulo: 'Relatórios' },
    { to: '/auditoria', rotulo: 'Auditoria' },
  ]

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <nav className="flex shrink-0 flex-col bg-barra text-sobre-barra lg:w-60">
        <div className="px-5 pt-5 pb-4">
          <p className="rotulo text-destaque-barra">Controle de Pátio</p>
          <p className="mt-1 font-display text-lg leading-tight font-extrabold">
            {usuario?.papel === 'lider' ? 'Liderança' : 'Analista'}
          </p>
        </div>

        <ul className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-3">
          {links.map((l) => (
            <li key={l.to} className="shrink-0 lg:shrink">
              <NavLink
                to={l.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-chip px-3 py-2.5 font-display text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-destaque-barra text-barra'
                      : 'text-sobre-barra-2 hover:bg-barra-2 hover:text-sobre-barra'
                  }`
                }
              >
                {l.rotulo}
                {l.badge ? (
                  <span className="rounded-full bg-sinal px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">
                    {l.badge}
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-auto hidden border-t border-barra-3 p-4 lg:block">
          <button
            onClick={alternar}
            className={`rotulo flex w-full items-center justify-between gap-2 rounded-chip border px-3 py-2.5 transition-colors ${
              rodando
                ? 'border-destaque-barra text-destaque-barra'
                : 'border-barra-3 text-sobre-barra-2 hover:border-sobre-barra-3'
            }`}
          >
            <span>Simulador</span>
            <span className={rodando ? 'anim-pulso' : ''}>{rodando ? 'ligado' : 'desligado'}</span>
          </button>
          <p className="mt-2 text-[11px] leading-snug text-sobre-barra-3">
            Gera check-ins fictícios para a demonstração. Não existe na versão com backend.
          </p>
          <button
            onClick={() => {
              if (confirm('Voltar a demonstração ao estado inicial?')) reiniciarDemonstracao()
            }}
            className="rotulo mt-3 text-sobre-barra-3 hover:text-sobre-barra"
          >
            Reiniciar demonstração
          </button>
        </div>
      </nav>

      <div className="min-w-0 flex-1 bg-fundo">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-linha bg-superficie-2 px-5 py-3">
          <p className="rotulo text-brita">{dataExtensa(HOJE)}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={alternar}
              className={`rotulo rounded-chip border px-3 py-1.5 lg:hidden ${
                rodando ? 'border-destaque text-destaque-texto' : 'border-linha text-brita'
              }`}
            >
              Simulador {rodando ? 'ligado' : 'desligado'}
            </button>
            <span className="text-sm font-semibold">{usuario?.nome}</span>
            <button onClick={sair} className="rotulo text-brita hover:text-tinta">
              Sair
            </button>
          </div>
        </header>

        <main className="px-5 py-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
