import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { DataSource } from './DataSource'
import { FastAPIDataSource } from './FastAPIDataSource'
import { MockDataSource } from './mock/MockDataSource'
import { SimuladorPatio } from './mock/simulator'
import { isoDia } from './mock/seed'
import { limparEstado } from './mock/persistencia'

export const HOJE = isoDia(0)

const mock = new MockDataSource()
const simulador = new SimuladorPatio(mock, HOJE)
const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
const dataSource: DataSource = apiUrl ? new FastAPIDataSource(apiUrl) : mock

const Ctx = createContext<DataSource>(dataSource)

export function DataProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={dataSource}>{children}</Ctx.Provider>
}

export function useData(): DataSource {
  return useContext(Ctx)
}

/** Volta a demonstração ao estado inicial, para apresentar de novo do zero. */
export function reiniciarDemonstracao() {
  simulador.parar()
  limparEstado()
  location.reload()
}

export function useSimulador() {
  const [rodando, setRodando] = useState(simulador.rodando)
  return {
    rodando,
    alternar() {
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
  const [dados, setDados] = useState<T>()
  const consultaRef = useRef(consulta)
  consultaRef.current = consulta

  const [gatilho, setGatilho] = useState(0)

  useEffect(() => {
    let vivo = true
    void consultaRef.current(ds).then((r) => {
      if (vivo) setDados(r)
    })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds, gatilho, ...deps])

  useEffect(() => ds.subscribe(() => setGatilho((g) => g + 1)), [ds])

  return { dados, recarregar: () => setGatilho((g) => g + 1) }
}
