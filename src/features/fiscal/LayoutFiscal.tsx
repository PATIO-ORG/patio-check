import { Outlet } from 'react-router-dom'
import { useSessao } from '../../auth/sessao'
import { HOJE, useLiveData } from '../../data/provider'
import { dataCompacta } from '../shared/ui'

export function LayoutFiscal() {
  const { usuario, sair } = useSessao()
  const { dados: resumo } = useLiveData((ds) => ds.resumoDiario(HOJE))

  return (
    <div className="min-h-dvh bg-concreto pb-8">
      <header className="sticky top-0 z-20 bg-asfalto text-concreto">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pt-3 pb-2">
          <div className="min-w-0">
            <p className="rotulo text-demarcacao">Fiscal de pátio</p>
            <p className="truncate font-display text-[15px] font-bold">{usuario?.nome}</p>
          </div>
          <button
            onClick={sair}
            className="rotulo shrink-0 rounded-chip border border-asfalto-3 px-3 py-1.5 text-brita-2 transition-colors hover:border-demarcacao hover:text-demarcacao"
          >
            Sair
          </button>
        </div>

        <div className="mx-auto flex max-w-2xl items-center gap-3 border-t border-asfalto-3 px-4 py-2">
          <span className="rotulo text-brita-2">{dataCompacta(HOJE)}</span>
          {resumo && (
            <span className="rotulo ml-auto flex items-center gap-2">
              <span className="text-demarcacao">{resumo.pendentes} pendentes</span>
              <span className="text-brita">·</span>
              <span className="text-concreto">{resumo.conferidos} ok</span>
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4">
        <Outlet />
      </main>
    </div>
  )
}
