import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useSessao } from '../../auth/sessao'
import { HOJE, MODO_DEMONSTRACAO, reiniciarDemonstracao, useLiveData, useSimulador } from '../../data/provider'
import { podeEditarEscala } from '../../domain/status'
import { dataExtensa } from '../shared/ui'

type Tema = 'claro' | 'escuro'

const CHAVE_TEMA = 'patio-check:tema'

function lerTemaSalvo(): Tema {
  try {
    return localStorage.getItem(CHAVE_TEMA) === 'escuro' ? 'escuro' : 'claro'
  } catch {
    return 'claro'
  }
}

export function LayoutAnalista() {
  const { usuario, sair } = useSessao()
  const { dados: alertas } = useLiveData((ds) => ds.listarAlertasAbertos(HOJE))
  const { rodando, alternar } = useSimulador()
  const [tema, setTema] = useState<Tema>(lerTemaSalvo)

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_TEMA, tema)
    } catch {
      // armazenamento indisponível (modo privado, quota) — tema só não persiste entre sessões
    }
  }, [tema])

  const podeEditar = usuario ? podeEditarEscala(usuario.papel) : false
  const links = [
    { to: '/painel', rotulo: 'Painel' },
    ...(podeEditar ? [{ to: '/escala', rotulo: 'Escala' }] : []),
    { to: '/alertas', rotulo: 'Alertas', badge: alertas?.length },
    { to: '/relatorios', rotulo: 'Relatórios' },
    { to: '/auditoria', rotulo: 'Histórico' },
  ]

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <nav className="flex shrink-0 flex-col bg-asfalto text-concreto lg:w-60">
        <div className="px-5 pt-5 pb-4">
          <p className="rotulo text-demarcacao">Controle de Pátio</p>
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
                      ? 'bg-demarcacao text-asfalto'
                      : 'text-brita-2 hover:bg-asfalto-2 hover:text-concreto'
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

        <div className="mt-auto hidden lg:block">
          {MODO_DEMONSTRACAO && (
            <div className="border-t border-asfalto-3 p-4">
              <button
                onClick={alternar}
                className={`rotulo flex w-full items-center justify-between gap-2 rounded-chip border px-3 py-2.5 transition-colors ${
                  rodando
                    ? 'border-demarcacao text-demarcacao'
                    : 'border-asfalto-3 text-brita-2 hover:border-brita'
                }`}
              >
                <span>Simulador</span>
                <span className={rodando ? 'anim-pulso' : ''}>{rodando ? 'ligado' : 'desligado'}</span>
              </button>
              <p className="mt-2 text-[11px] leading-snug text-brita">
                Gera check-ins fictícios para a demonstração. Não existe na versão com backend.
              </p>
              <button
                onClick={() => {
                  if (confirm('Voltar a demonstração ao estado inicial?')) reiniciarDemonstracao()
                }}
                className="rotulo mt-3 text-brita hover:text-concreto"
              >
                Reiniciar demonstração
              </button>
            </div>
          )}

          <div className="border-t border-asfalto-3 p-4">
            <button
              type="button"
              onClick={() => setTema((t) => (t === 'escuro' ? 'claro' : 'escuro'))}
              aria-pressed={tema === 'escuro'}
              className="rotulo flex w-full items-center justify-between gap-2 rounded-chip border border-asfalto-3 px-3 py-2.5 text-brita-2 transition-colors hover:border-brita hover:text-concreto"
            >
              <span className="flex items-center gap-2">
                {tema === 'escuro' ? <IconeLua /> : <IconeSol />}
                Tema
              </span>
              <span>{tema === 'escuro' ? 'Escuro' : 'Claro'}</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="pc-analista min-w-0 flex-1 bg-concreto" data-tema={tema}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-linha bg-concreto-2 px-5 py-3">
          <p className="rotulo text-brita">{dataExtensa(HOJE)}</p>
          <div className="flex items-center gap-3">
            {MODO_DEMONSTRACAO && (
              <button
                onClick={alternar}
                className={`rotulo rounded-chip border px-3 py-1.5 lg:hidden ${
                  rodando ? 'border-demarcacao text-demarcacao-escura-ink' : 'border-linha text-brita'
                }`}
              >
                Simulador {rodando ? 'ligado' : 'desligado'}
              </button>
            )}
            <span className="text-sm font-semibold">{usuario?.nome}</span>
            <button onClick={sair} className="rotulo text-brita hover:text-ink">
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

function IconeSol() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" />
    </svg>
  )
}

function IconeLua() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
    </svg>
  )
}
