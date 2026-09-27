import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { DataSource } from './DataSource'
import { MockDataSource } from './mock/MockDataSource'
import { SimuladorPatio } from './mock/simulator'
import { isoDia } from './mock/seed'
import { limparEstado } from './mock/persistencia'
import { supabase, supabaseConfigurado } from './supabase/client'
import { SupabaseDataSource } from './supabase/SupabaseDataSource'

export const HOJE = isoDia(0)

const mock = new MockDataSource()
const simulador = new SimuladorPatio(mock, HOJE)
export const MODO_DEMONSTRACAO = import.meta.env.DEV && !supabaseConfigurado
const dataSource: DataSource =
  supabase && supabaseConfigurado ? new SupabaseDataSource(supabase) : mock

const Ctx = createContext<DataSource>(dataSource)
const ErroDadosCtx = createContext<(erro: unknown) => void>(() => {})

export function DataProvider({ children }: { children: ReactNode }) {
  const [erro, setErro] = useState('')
  const reportarErro = useCallback((erro: unknown) => {
    setErro(erro instanceof Error ? erro.message : String(erro))
  }, [])

  return (
    <ErroDadosCtx.Provider value={reportarErro}>
      <Ctx.Provider value={dataSource}>
        {erro && (
          <div
            role="alert"
            className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-2xl items-start justify-between gap-4 rounded-lg border border-sinal bg-white px-4 py-3 text-sm text-sinal shadow-lg"
          >
            <span>Erro ao carregar ou salvar dados: {erro}</span>
            <button type="button" onClick={() => setErro('')} aria-label="Fechar aviso">
              ×
            </button>
          </div>
        )}
        {children}
      </Ctx.Provider>
    </ErroDadosCtx.Provider>
  )
}

export function useData(): DataSource {
  return useContext(Ctx)
}

export function useReportarErroDados() {
  return useContext(ErroDadosCtx)
}

/** Volta a demonstração ao estado inicial, para apresentar de novo do zero. */
export function reiniciarDemonstracao() {
  if (!MODO_DEMONSTRACAO) return
  simulador.parar()
  limparEstado()
  location.reload()
}

export function useSimulador() {
  const [rodando, setRodando] = useState(MODO_DEMONSTRACAO && simulador.rodando)
  return {
    rodando,
    alternar() {
      if (!MODO_DEMONSTRACAO) return
      if (simulador.rodando) simulador.parar()
      else simulador.iniciar()
      setRodando(simulador.rodando)
    },
  }
}

/**
 * Executa uma consulta e a repete sempre que os dados mudam, para que qualquer
 * tela reflita na hora o que outro usuário acabou de fazer. Com Supabase, o
 * `subscribe` do DataSource passa a ser a subscription de realtime — as telas
 * não mudam.
 */
export function useLiveData<T>(
  consulta: (ds: DataSource) => Promise<T>,
  deps: unknown[] = [],
): { dados: T | undefined; recarregar: () => void } {
  const ds = useData()
  const reportarErro = useReportarErroDados()
  const [dados, setDados] = useState<T>()
  const consultaRef = useRef(consulta)
  consultaRef.current = consulta

  const [gatilho, setGatilho] = useState(0)

  useEffect(() => {
    let vivo = true
    void consultaRef.current(ds)
      .then((r) => {
        if (vivo) setDados(r)
      })
      .catch((erro: unknown) => {
        if (vivo) reportarErro(erro)
      })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds, gatilho, reportarErro, ...deps])

  useEffect(() => ds.subscribe(() => setGatilho((g) => g + 1)), [ds])

  return { dados, recarregar: () => setGatilho((g) => g + 1) }
}
