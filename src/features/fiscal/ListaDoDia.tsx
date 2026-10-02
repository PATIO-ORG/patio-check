import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HOJE, useLiveData } from '../../data/provider'
import type { ItemDetalhado, StatusItem } from '../../domain/types'
import { Placa } from '../shared/Placa'
import { CORES_STATUS, Rota, StatusPill, Vazio } from '../shared/ui'

type Filtro = 'pendentes' | 'conferidos' | 'bloqueados' | 'todos'

/** Ignora hífen e espaço na busca — é o que muda entre "RJK-4E12" e "RJK4E12". */
function normalizarBusca(s: string): string {
  return s.toLowerCase().replace(/[-\s]/g, '')
}

const FILTROS: { chave: Filtro; rotulo: string; status?: StatusItem[] }[] = [
  { chave: 'pendentes', rotulo: 'Pendentes', status: ['aguardando'] },
  { chave: 'bloqueados', rotulo: 'Bloqueados', status: ['bloqueado'] },
  { chave: 'conferidos', rotulo: 'Conferidos', status: ['liberado', 'liberado_com_ressalva'] },
  { chave: 'todos', rotulo: 'Todos' },
]

export function ListaDoDia() {
  const { dados: itens } = useLiveData((ds) => ds.listarItens(HOJE))
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('pendentes')

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { pendentes: 0, conferidos: 0, bloqueados: 0, todos: 0 }
    for (const d of itens ?? []) {
      c.todos++
      if (d.item.status === 'aguardando') c.pendentes++
      else if (d.item.status === 'bloqueado') c.bloqueados++
      else c.conferidos++
    }
    return c
  }, [itens])

  const visiveis = useMemo(() => {
    // Hífen e espaço somem dos dois lados: o fiscal digita a placa como está no
    // veículo ("RJK-4E12", "rjk 4e12") e ela precisa achar o mesmo driver.
    const termo = normalizarBusca(busca.trim())
    const status = FILTROS.find((f) => f.chave === filtro)?.status
    return (itens ?? [])
      .filter((d) => (status ? status.includes(d.item.status) : true))
      .filter((d) =>
        termo
          ? normalizarBusca(
              [d.motorista.driverId, d.motorista.nome, d.motorista.placa, d.item.rota].join(' '),
            ).includes(termo)
          : true,
      )
      .sort((a, b) => Number(b.item.avulso) - Number(a.item.avulso))
  }, [itens, busca, filtro])

  return (
    <>
      <div className="sticky top-[92px] z-10 -mx-4 bg-concreto px-4 pt-4 pb-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          inputMode="search"
          placeholder="Buscar por placa, ID, nome ou rota"
          aria-label="Buscar driver"
          className="w-full rounded-chip border-2 border-asfalto bg-white px-4 py-3.5 font-display text-base tracking-wide placeholder:tracking-normal placeholder:text-brita-2"
        />

        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
          {FILTROS.map((f) => (
            <button
              key={f.chave}
              onClick={() => setFiltro(f.chave)}
              aria-pressed={filtro === f.chave}
              className={`rotulo shrink-0 rounded-full px-3 py-2 transition-colors ${
                filtro === f.chave
                  ? 'bg-asfalto text-demarcacao'
                  : 'bg-white text-brita ring-1 ring-linha'
              }`}
            >
              {f.rotulo} {contagem[f.chave]}
            </button>
          ))}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <Vazio
          titulo={busca ? 'Nenhum driver bate com essa busca' : 'Nada nesta aba'}
          acao={busca ? 'Confira a placa ou o ID digitado.' : 'Troque o filtro acima.'}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((d) => (
            <li key={d.item.id}>
              <CartaoDriver detalhe={d} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function CartaoDriver({ detalhe }: { detalhe: ItemDetalhado }) {
  const { item, motorista } = detalhe
  const cor = CORES_STATUS[item.status]

  return (
    <Link
      to={`/patio/${item.id}`}
      className="flex overflow-hidden rounded-lg border border-linha bg-white transition-colors hover:border-asfalto"
    >
      <span className={`w-1.5 shrink-0 ${cor.barra}`} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Rota valor={item.rota} />
            {item.avulso && (
              <span className="rotulo rounded-full bg-demarcacao px-2 py-0.5 text-asfalto">
                Novo
              </span>
            )}
            {item.status !== 'aguardando' && <StatusPill status={item.status} />}
          </div>
          <p className="mt-1.5 truncate font-display text-[15px] font-bold leading-tight">
            {motorista.nome}
          </p>
          <p className="mt-0.5 truncate font-display text-xs text-brita">
            {motorista.driverId} · {motorista.veiculoModelo} {motorista.veiculoCor}
          </p>
        </div>
        <Placa valor={motorista.placa} tamanho="sm" />
      </div>
    </Link>
  )
}
