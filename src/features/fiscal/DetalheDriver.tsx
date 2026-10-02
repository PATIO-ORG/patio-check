import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSessao } from '../../auth/sessao'
import { HOJE, useData, useLiveData } from '../../data/provider'
import { Placa, PlacaComparada } from '../shared/Placa'
import { Botao, CORES_STATUS, LinkVoltar, ROTULO_TIPO, ROTULO_TURNO, Rota, StatusPill, hora } from '../shared/ui'

export function DetalheDriver() {
  const { itemId } = useParams()
  const { usuario } = useSessao()
  const ds = useData()
  const navegar = useNavigate()
  const { dados: itens } = useLiveData((d) => d.listarItens(HOJE))
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const detalhe = itens?.find((d) => d.item.id === itemId)
  if (!itens) return <p className="py-10 text-center text-brita">Carregando…</p>
  if (!detalhe) {
    return (
      <div className="py-10 text-center">
        <p className="font-display text-base font-semibold">Driver não está na escala de hoje.</p>
        <Link to="/patio" className="mt-2 inline-block text-sm underline">
          Voltar para a lista
        </Link>
      </div>
    )
  }

  const { item, motorista, irregularidades } = detalhe
  const cor = CORES_STATUS[item.status]
  const bloqueado = item.status === 'bloqueado'

  async function confirmar() {
    if (!usuario) return
    setEnviando(true)
    try {
      const r = await ds.registrarCheckin({
        escalaItemId: item.id,
        fiscalId: usuario.id,
        resultado: 'conforme',
      })
      if (!r.ok) setErro(r.erro)
      else navegar('/patio')
    } catch (error) {
      setErro(`Não foi possível registrar o check-in: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pb-40">
      <LinkVoltar para="/patio">Lista do dia</LinkVoltar>

      <div className={`mt-3 overflow-hidden rounded-lg border border-linha bg-white`}>
        <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${cor.fundo}`}>
          <StatusPill status={item.status} />
          {detalhe.ultimoCheckin && (
            <span className="font-mono text-xs text-brita">
              Conferido {hora(detalhe.ultimoCheckin.em)}
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-4 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Rota valor={item.rota} />
              <span className="rotulo text-brita">{ROTULO_TURNO[item.turno]}</span>
              {item.avulso && (
                <span className="rotulo rounded-full bg-demarcacao px-2 py-0.5 text-asfalto">
                  Novo
                </span>
              )}
            </div>
            <h1 className="mt-2 font-display text-2xl leading-tight font-extrabold">{motorista.nome}</h1>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px border-t border-linha bg-linha">
          <Campo rotulo="ID do driver" valor={motorista.driverId} mono />
          <Campo rotulo="Telefone" valor={motorista.telefone ?? '—'} mono />
          <Campo rotulo="Veículo" valor={motorista.veiculoModelo} />
          <Campo rotulo="Cor" valor={motorista.veiculoCor} />
        </dl>

        <div className="flex items-center justify-between gap-4 border-t border-linha p-4">
          <div>
            <p className="rotulo text-brita">Placa na escala</p>
            <p className="mt-1 text-[13px] text-brita">Confira antes de liberar.</p>
          </div>
          <Placa valor={motorista.placa} tamanho="lg" />
        </div>
      </div>

      {irregularidades.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border-2 border-sinal bg-white">
          <p className="rotulo bg-sinal px-4 py-2 text-white">
            Divergência reportada · aguarda analista
          </p>
          <ul className="divide-y divide-linha">
            {irregularidades.map((irr) => (
              <li key={irr.id} className="p-4">
                <p className="rotulo text-brita">{ROTULO_TIPO[irr.tipo]}</p>
                {irr.tipo === 'placa' ? (
                  <div className="mt-2">
                    <PlacaComparada esperado={irr.esperado} encontrado={irr.encontrado} tamanho="sm" />
                  </div>
                ) : (
                  <p className="mt-1 text-sm">
                    <span className="text-brita line-through">{irr.esperado}</span>{' '}
                    <span className="font-semibold text-sinal">→ {irr.encontrado}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-3 rounded-chip bg-sinal-fraca px-4 py-3 text-sm text-sinal">
          {erro}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-linha bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {bloqueado ? (
            <p className="rounded-chip bg-sinal-fraca px-4 py-3 text-center text-sm text-sinal">
              Bloqueado. Só um analista libera este driver.
            </p>
          ) : (
            <>
              <button
                onClick={confirmar}
                disabled={enviando}
                className="w-full rounded-chip bg-liberado py-4 font-display text-lg font-extrabold text-white transition-[filter] hover:brightness-110 disabled:opacity-60"
              >
                Tudo certo
              </button>
              <Botao
                variante="neutro"
                onClick={() => navegar(`/patio/${item.id}/divergencia`)}
                className="w-full border-2 border-sinal py-3.5 text-sinal hover:border-sinal"
              >
                Reportar divergência
              </Botao>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Campo({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className="rotulo text-brita">{rotulo}</dt>
      <dd className={`mt-1 text-[15px] font-semibold ${mono ? 'font-mono' : ''}`}>{valor}</dd>
    </div>
  )
}
