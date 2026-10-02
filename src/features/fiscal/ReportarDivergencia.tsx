import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSessao } from '../../auth/sessao'
import { HOJE, useData, useLiveData } from '../../data/provider'
import type { TipoIrregularidade } from '../../domain/types'
import { normalizarPlaca } from '../../domain/placa'
import { Placa, PlacaComparada } from '../shared/Placa'
import { Botao, ROTULO_TIPO } from '../shared/ui'

const OUTROS: { tipo: TipoIrregularidade; dica: string }[] = [
  { tipo: 'veiculo', dica: 'Modelo ou cor diferente do cadastrado' },
  { tipo: 'nome', dica: 'Quem está dirigindo não é o driver da escala' },
  { tipo: 'id', dica: 'ID apresentado não bate com a escala' },
  { tipo: 'ocupante', dica: 'Há alguém no veículo além do driver' },
]

export function ReportarDivergencia() {
  const { itemId } = useParams()
  const { usuario } = useSessao()
  const ds = useData()
  const navegar = useNavigate()
  const { dados: itens } = useLiveData((d) => d.listarItens(HOJE))

  const [placaEncontrada, setPlacaEncontrada] = useState('')
  const [outros, setOutros] = useState<Partial<Record<TipoIrregularidade, string>>>({})
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const detalhe = itens?.find((d) => d.item.id === itemId)
  if (!detalhe) return <p className="py-10 text-center text-brita">Carregando…</p>

  const { item, motorista } = detalhe
  const placaDiverge =
    placaEncontrada.length >= 7 && normalizarPlaca(placaEncontrada) !== motorista.placa
  const divergencias = [
    ...(placaDiverge
      ? [{ tipo: 'placa' as const, encontrado: normalizarPlaca(placaEncontrada) }]
      : []),
    ...Object.entries(outros)
      .filter(([, v]) => v && v.trim())
      .map(([tipo, v]) => ({ tipo: tipo as TipoIrregularidade, encontrado: v!.trim() })),
  ]

  async function enviar() {
    if (!usuario) return
    if (divergencias.length === 0) {
      setErro('Aponte pelo menos uma divergência antes de reportar.')
      return
    }
    setEnviando(true)
    try {
      const r = await ds.registrarCheckin({
        escalaItemId: item.id,
        fiscalId: usuario.id,
        resultado: 'irregular',
        observacao: observacao.trim() || undefined,
        divergencias,
      })
      if (!r.ok) setErro(r.erro)
      else navegar('/patio')
    } catch (error) {
      setErro(`Não foi possível enviar a divergência: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setEnviando(false)
    }
  }

  function alternarOutro(tipo: TipoIrregularidade) {
    setOutros((o) => {
      const copia = { ...o }
      if (tipo in copia) delete copia[tipo]
      else copia[tipo] = ''
      return copia
    })
  }

  return (
    <div className="pb-36">
      <Link to={`/patio/${item.id}`} className="rotulo mt-4 inline-block text-brita hover:text-asfalto">
        ← {motorista.nome}
      </Link>

      <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight">
        O que está diferente?
      </h1>
      <p className="mt-1 text-sm text-brita">
        O driver fica bloqueado e o analista é avisado na hora.
      </p>

      {/* Placa é o caso mais comum no pátio, então ganha a tela inteira primeiro. */}
      <section className="mt-4 overflow-hidden rounded-lg border-2 border-asfalto bg-white">
        <h2 className="rotulo bg-asfalto px-4 py-2.5 text-demarcacao">Placa</h2>
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="rotulo text-brita">Na escala</span>
            <Placa valor={motorista.placa} tamanho="md" />
          </div>

          <label className="rotulo mt-4 block text-brita" htmlFor="placa-encontrada">
            Placa que está no veículo
          </label>
          <input
            id="placa-encontrada"
            value={placaEncontrada}
            onChange={(e) => setPlacaEncontrada(e.target.value.toUpperCase().slice(0, 8))}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABC1D23"
            className="mt-1.5 w-full rounded-chip border-2 border-asfalto bg-concreto-2 px-4 py-4 text-center font-mono text-3xl font-bold tracking-[0.2em] uppercase placeholder:text-brita-2"
          />

          {placaDiverge && (
            <div className="mt-4 rounded-chip bg-sinal-fraca p-3">
              <PlacaComparada
                esperado={motorista.placa}
                encontrado={normalizarPlaca(placaEncontrada)}
                tamanho="sm"
              />
            </div>
          )}
          {placaEncontrada.length >= 7 && !placaDiverge && (
            <p className="mt-3 rounded-chip bg-liberado-fraca px-3 py-2 text-sm text-liberado">
              Esta placa bate com a escala.
            </p>
          )}
        </div>
      </section>

      <section className="mt-3">
        <h2 className="rotulo mb-2 text-brita">Outros itens</h2>
        <ul className="flex flex-col gap-2">
          {OUTROS.map(({ tipo, dica }) => {
            const ativo = tipo in outros
            return (
              <li key={tipo} className="overflow-hidden rounded-lg border border-linha bg-white">
                <button
                  onClick={() => alternarOutro(tipo)}
                  aria-expanded={ativo}
                  className="flex w-full items-center gap-3 p-3.5 text-left"
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-[4px] border-2 ${
                      ativo ? 'border-sinal bg-sinal text-white' : 'border-brita-2'
                    }`}
                    aria-hidden="true"
                  >
                    {ativo && '✓'}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-[15px] font-bold">
                      {ROTULO_TIPO[tipo]}
                    </span>
                    <span className="block text-[13px] leading-snug text-brita">{dica}</span>
                  </span>
                </button>
                {ativo && (
                  <div className="border-t border-linha p-3.5">
                    <label className="rotulo block text-brita" htmlFor={`campo-${tipo}`}>
                      O que você encontrou
                    </label>
                    <input
                      id={`campo-${tipo}`}
                      value={outros[tipo] ?? ''}
                      onChange={(e) => setOutros((o) => ({ ...o, [tipo]: e.target.value }))}
                      placeholder={
                        tipo === 'ocupante' ? 'Ex.: driver + 1 acompanhante' : 'Descreva'
                      }
                      className="mt-1.5 w-full rounded-chip border border-linha bg-concreto-2 px-3 py-3 text-[15px]"
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mt-3 rounded-lg border border-linha bg-white p-3.5">
        <label className="rotulo block text-brita" htmlFor="obs">
          Observação (opcional)
        </label>
        <textarea
          id="obs"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={2}
          className="mt-1.5 w-full resize-none rounded-chip border border-linha bg-concreto-2 px-3 py-2.5 text-[15px]"
        />
      </section>

      {erro && (
        <p role="alert" className="mt-3 rounded-chip bg-sinal-fraca px-4 py-3 text-sm text-sinal">
          {erro}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-linha bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Botao variante="fantasma" onClick={() => navegar(`/patio/${item.id}`)}>
            Cancelar
          </Botao>
          <button
            onClick={enviar}
            disabled={enviando || divergencias.length === 0}
            className="flex-1 rounded-chip bg-sinal py-4 font-display text-lg font-extrabold text-white transition-[filter] hover:brightness-110 disabled:bg-brita-2"
          >
            Reportar e bloquear
          </button>
        </div>
      </div>
    </div>
  )
}
