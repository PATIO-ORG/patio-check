import { useEffect, useState } from 'react'
import { useSessao } from '../../auth/sessao'
import { HOJE, useData, useLiveData } from '../../data/provider'
import type { LinhaValidada, PreviaImportacao } from '../../data/DataSource'
import type { ItemDetalhado, Turno } from '../../domain/types'
import { placaValida } from '../../data/mock/MockDataSource'
import { Placa } from '../shared/Placa'
import {
  Botao,
  Cartao,
  ROTULO_TURNO,
  Rota,
  StatusPill,
  TituloSecao,
  Vazio,
} from '../shared/ui'

type EstadoImportacao = { alvo: number; inicio: number; nomeArquivo: string } | null
type Tema = 'claro' | 'escuro'

export function Escala() {
  const { dados: itens } = useLiveData((ds) => ds.listarItens(HOJE))
  const [importacao, setImportacao] = useState<EstadoImportacao>(null)
  const [tema, setTema] = useState<Tema>('claro')

  return (
    <div
      data-tema={tema}
      className="pc-escala mx-auto flex max-w-5xl flex-col gap-4 rounded-2xl bg-concreto p-5 text-[var(--pc-ink)] transition-colors"
    >
      {importacao && <BarraImportacao estado={importacao} />}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-asfalto text-demarcacao">
            <IconePrancheta />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold">Escala de hoje</h1>
            <p className="mt-0.5 text-sm text-brita">
              O fiscal de pátio vê estas alterações na hora, sem reimprimir nada.
            </p>
          </div>
        </div>
        <SeletorTema tema={tema} onMudar={setTema} />
      </header>

      <Importador
        onIniciarImportacao={(alvo, nomeArquivo) => setImportacao({ alvo, inicio: Date.now(), nomeArquivo })}
        onImportacaoConcluida={() => setImportacao(null)}
      />
      <DriverAvulso />

      <Cartao>
        <TituloSecao
          icone={<IconeCaminhoes />}
          acao={<ContadorDrivers total={itens?.length ?? 0} importacao={importacao} />}
        >
          Drivers escalados
        </TituloSecao>
        {!itens || itens.length === 0 ? (
          <Vazio titulo="Escala vazia" acao="Suba a planilha do dia para começar." />
        ) : (
          <Tabela itens={itens} />
        )}
      </Cartao>
    </div>
  )
}

function SeletorTema({ tema, onMudar }: { tema: Tema; onMudar: (t: Tema) => void }) {
  const opcoes: { valor: Tema; rotulo: string; icone: React.ReactNode }[] = [
    { valor: 'claro', rotulo: 'Claro', icone: <IconeSol /> },
    { valor: 'escuro', rotulo: 'Escuro', icone: <IconeLua /> },
  ]
  return (
    <div className="inline-flex shrink-0 rounded-chip border border-linha bg-concreto-2 p-1">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          onClick={() => onMudar(o.valor)}
          className={`flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 font-display text-[13px] font-bold transition-colors ${
            tema === o.valor ? 'bg-asfalto text-demarcacao' : 'text-brita hover:text-asfalto'
          }`}
        >
          {o.icone}
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

/** Contador ao vivo de drivers escalados. Durante uma importação, substitui o
 * número final por uma contagem crescente + cronômetro, para o analista ver
 * o progresso sem precisar atualizar a página. */
function ContadorDrivers({ total, importacao }: { total: number; importacao: EstadoImportacao }) {
  const [decorrido, setDecorrido] = useState(0)

  useEffect(() => {
    if (!importacao) return
    setDecorrido(0)
    const id = window.setInterval(() => {
      setDecorrido(Date.now() - importacao.inicio)
    }, 60)
    return () => window.clearInterval(id)
  }, [importacao])

  if (importacao) {
    const progresso = Math.min(1, decorrido / 900)
    const exibido = Math.min(importacao.alvo, Math.round(importacao.alvo * progresso))
    return (
      <div className="flex items-center gap-2.5 rounded-chip bg-asfalto/12 px-3 py-1.5">
        <span className="anim-girar text-asfalto">
          <IconeCarregando />
        </span>
        <span className="font-mono text-sm font-bold text-asfalto">
          {exibido}/{importacao.alvo} drivers
        </span>
        <span className="rotulo text-brita">{(decorrido / 1000).toFixed(1)}s</span>
      </div>
    )
  }

  return (
    <span key={total} className="anim-numero font-mono text-sm font-bold text-brita">
      {total} drivers
    </span>
  )
}

/** Banner grande e fixo no topo da página: aparece assim que a importação
 * começa, para deixar claro que a planilha já está subindo — o analista
 * não precisa esperar nem recarregar a página, ela se atualiza sozinha. */
function BarraImportacao({ estado }: { estado: NonNullable<EstadoImportacao> }) {
  const [decorrido, setDecorrido] = useState(0)

  useEffect(() => {
    setDecorrido(0)
    const id = window.setInterval(() => setDecorrido(Date.now() - estado.inicio), 60)
    return () => window.clearInterval(id)
  }, [estado])

  const progresso = Math.min(1, decorrido / 900)
  const exibido = Math.min(estado.alvo, Math.round(estado.alvo * progresso))
  const pct = Math.round(progresso * 100)

  return (
    <div className="anim-numero sombra-cartao-hover sticky top-3 z-20 overflow-hidden rounded-lg bg-asfalto text-concreto">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="anim-girar shrink-0 text-demarcacao">
            <IconeCarregando />
          </span>
          <div>
            <p className="font-display text-[15px] font-bold">
              Subindo {estado.nomeArquivo} — {exibido}/{estado.alvo} drivers
            </p>
            <p className="mt-0.5 text-[13px] text-brita-2">
              Não precisa esperar nem atualizar a página, a escala aparece aqui sozinha.
            </p>
          </div>
        </div>
        <span className="rotulo shrink-0 text-demarcacao">{(decorrido / 1000).toFixed(1)}s</span>
      </div>
      <div className="h-1.5 w-full bg-black/15">
        <div
          className="h-full bg-white transition-[width] duration-150 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Importador({
  onIniciarImportacao,
  onImportacaoConcluida,
}: {
  onIniciarImportacao: (alvo: number, nomeArquivo: string) => void
  onImportacaoConcluida: () => void
}) {
  const ds = useData()
  const { usuario } = useSessao()
  const [previa, setPrevia] = useState<PreviaImportacao>()
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [arrastando, setArrastando] = useState(false)
  const [lendo, setLendo] = useState(false)

  async function lerArquivo(arquivo: File) {
    setMensagem('')
    setNomeArquivo(arquivo.name)
    setLendo(true)
    try {
      setPrevia(await ds.previsualizarPlanilha(await arquivo.text()))
    } finally {
      setLendo(false)
    }
  }

  async function confirmar(linhas: LinhaValidada[]) {
    if (!usuario) return
    onIniciarImportacao(linhas.length, nomeArquivo)
    const tempoMinimo = new Promise((resolve) => setTimeout(resolve, 700))
    await Promise.all([
      ds.importarPlanilha({ data: HOJE, linhas, usuarioId: usuario.id }),
      tempoMinimo,
    ])
    onImportacaoConcluida()
    setPrevia(undefined)
    setMensagem(`${linhas.length} drivers importados de ${nomeArquivo}.`)
  }

  return (
    <Cartao>
      <TituloSecao
        icone={<IconeUpload />}
        acao={
          <a
            href={`${import.meta.env.BASE_URL}escala-exemplo.csv`}
            download
            className="rotulo flex items-center gap-1.5 text-brita underline decoration-linha underline-offset-2 hover:text-asfalto hover:decoration-asfalto"
          >
            <IconeDownload />
            Baixar modelo
          </a>
        }
      >
        Subir planilha
      </TituloSecao>

      <div className="p-5">
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setArrastando(true)
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault()
            setArrastando(false)
            const f = e.dataTransfer.files?.[0]
            if (f) void lerArquivo(f)
          }}
          className={`flex cursor-pointer items-center justify-between gap-4 rounded-chip border-2 border-dashed px-4 py-5 transition-all ${
            arrastando
              ? 'border-demarcacao bg-demarcacao/10'
              : 'border-brita-2 hover:border-asfalto hover:bg-concreto-2'
          }`}
        >
          <span className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip bg-concreto-2 text-brita">
              {lendo ? (
                <span className="anim-girar block">
                  <IconeCarregando />
                </span>
              ) : (
                <IconePlanilha />
              )}
            </span>
            <span>
              <span className="block font-display text-[15px] font-bold">
                {lendo ? 'Lendo arquivo…' : 'Escolher arquivo CSV da escala'}
              </span>
              <span className="mt-0.5 block text-[13px] text-brita">
                Colunas: ID, nome, veículo, cor, placa, rota, turno. Nada é gravado antes da conferência.
              </span>
            </span>
          </span>
          <span className="rotulo shrink-0 rounded-chip bg-asfalto px-3 py-2 text-demarcacao">
            Selecionar
          </span>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void lerArquivo(f)
              e.target.value = ''
            }}
          />
        </label>

        {mensagem && (
          <p className="anim-numero mt-3 flex items-center gap-2 rounded-chip bg-liberado-fraca px-4 py-2.5 text-sm font-semibold text-liberado">
            <IconeCheck />
            {mensagem}
          </p>
        )}

        {previa && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <p className="font-display text-[15px] font-bold">Conferência de {nomeArquivo}</p>
              <span className="rotulo text-liberado">{previa.validas.length} prontas</span>
              {previa.invalidas.length > 0 && (
                <span className="rotulo text-sinal">{previa.invalidas.length} com erro</span>
              )}
            </div>

            {previa.invalidas.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-chip border border-sinal">
                <p className="rotulo bg-sinal px-3 py-2 text-white">
                  Linhas recusadas — corrija na planilha e suba de novo
                </p>
                <ul className="divide-y divide-linha">
                  {previa.invalidas.map((l) => (
                    <li key={l.linha} className="flex flex-wrap gap-x-3 gap-y-1 bg-sinal-fraca px-3 py-2 text-[13px]">
                      <span className="font-mono font-bold">linha {l.linha}</span>
                      <span className="text-brita">{l.nome || l.driverId || '(vazia)'}</span>
                      <span className="text-sinal">{l.erros.join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {previa.validas.length > 0 && (
              <div className="mt-3 max-h-64 overflow-auto rounded-chip border border-linha">
                <table className="w-full text-left text-[13px]">
                  <thead className="sticky top-0 bg-concreto-2">
                    <tr className="rotulo text-brita">
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Nome</th>
                      <th className="px-3 py-2">Veículo</th>
                      <th className="px-3 py-2">Placa</th>
                      <th className="px-3 py-2">Rota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linha">
                    {previa.validas.map((l) => (
                      <tr key={l.linha}>
                        <td className="px-3 py-2 font-mono">{l.driverId}</td>
                        <td className="px-3 py-2">{l.nome}</td>
                        <td className="px-3 py-2 text-brita">
                          {l.veiculoModelo} {l.veiculoCor}
                        </td>
                        <td className="px-3 py-2 font-mono">{l.placa}</td>
                        <td className="px-3 py-2 font-mono">{l.rota}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <Botao
                onClick={() => confirmar(previa.validas)}
                disabled={previa.validas.length === 0}
              >
                Importar {previa.validas.length} drivers
              </Botao>
              <Botao variante="fantasma" onClick={() => setPrevia(undefined)}>
                Descartar
              </Botao>
            </div>
          </div>
        )}
      </div>
    </Cartao>
  )
}

const VAZIO = {
  driverId: '',
  nome: '',
  veiculoModelo: '',
  veiculoCor: '',
  placa: '',
  rota: '',
  turno: 'manha' as Turno,
}

function DriverAvulso() {
  const ds = useData()
  const { usuario } = useSessao()
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState('')

  const campo = (k: keyof typeof VAZIO) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value })),
    className: 'w-full rounded-chip border border-linha bg-concreto-2 px-3 py-2.5 text-sm',
  })

  async function salvar() {
    if (!usuario) return
    if (!/^SPX\d{4,6}$/i.test(form.driverId)) return setErro('ID do driver fora do padrão SPXxxxxx.')
    if (form.nome.trim().length < 3) return setErro('Informe o nome do driver.')
    if (!placaValida(form.placa)) return setErro('Placa inválida.')
    if (!/^[A-Za-z]-\d{2}$/.test(form.rota)) return setErro('Rota fora do padrão (ex.: A-15).')

    setErro('')
    await ds.adicionarItemAvulso({
      data: HOJE,
      usuarioId: usuario.id,
      motorista: {
        driverId: form.driverId.toUpperCase(),
        nome: form.nome.trim(),
        veiculoModelo: form.veiculoModelo || 'Não informado',
        veiculoCor: form.veiculoCor || '—',
        placa: form.placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
      },
      rota: form.rota,
      turno: form.turno,
    })
    setForm(VAZIO)
    setAberto(false)
  }

  return (
    <Cartao>
      <TituloSecao
        acao={
          <Botao variante="fantasma" onClick={() => setAberto((a) => !a)}>
            {aberto ? 'Fechar' : 'Adicionar'}
          </Botao>
        }
      >
        Driver que entrou no meio do turno
      </TituloSecao>

      {aberto && (
        <div className="p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Rotulado texto="ID do driver">
              <input {...campo('driverId')} placeholder="SPX48231" />
            </Rotulado>
            <Rotulado texto="Nome">
              <input {...campo('nome')} placeholder="Nome completo" />
            </Rotulado>
            <Rotulado texto="Veículo">
              <input {...campo('veiculoModelo')} placeholder="Fiat Fiorino" />
            </Rotulado>
            <Rotulado texto="Cor">
              <input {...campo('veiculoCor')} placeholder="Branco" />
            </Rotulado>
            <Rotulado texto="Placa">
              <input {...campo('placa')} placeholder="ABC1D23" className="w-full rounded-chip border border-linha bg-concreto-2 px-3 py-2.5 font-mono text-sm uppercase" />
            </Rotulado>
            <Rotulado texto="Rota">
              <input {...campo('rota')} placeholder="A-15" className="w-full rounded-chip border border-linha bg-concreto-2 px-3 py-2.5 font-mono text-sm uppercase" />
            </Rotulado>
            <Rotulado texto="Turno">
              <select {...campo('turno')}>
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
              </select>
            </Rotulado>
          </div>

          {erro && (
            <p role="alert" className="mt-3 text-sm font-semibold text-sinal">
              {erro}
            </p>
          )}

          <div className="mt-4">
            <Botao onClick={salvar}>Adicionar à escala</Botao>
          </div>
        </div>
      )}
    </Cartao>
  )
}

function Rotulado({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="rotulo mb-1 block text-brita">{texto}</span>
      {children}
    </label>
  )
}

function Tabela({ itens }: { itens: ItemDetalhado[] }) {
  const ds = useData()
  const { usuario } = useSessao()

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-linha bg-concreto-2">
          <tr className="rotulo text-brita">
            <th className="px-4 py-2.5">Rota</th>
            <th className="px-4 py-2.5">Driver</th>
            <th className="px-4 py-2.5">Veículo</th>
            <th className="px-4 py-2.5">Placa</th>
            <th className="px-4 py-2.5">Turno</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linha">
          {itens.map(({ item, motorista }) => (
            <tr key={item.id} className={item.avulso ? 'bg-asfalto/6' : undefined}>
              <td className="px-4 py-2.5">
                <Rota valor={item.rota} />
              </td>
              <td className="px-4 py-2.5">
                <span className="font-semibold">{motorista.nome}</span>
                <span className="ml-2 font-mono text-xs text-brita">{motorista.driverId}</span>
                {item.avulso && (
                  <span className="rotulo ml-2 rounded-full bg-asfalto px-1.5 py-0.5 text-demarcacao">
                    Novo
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-brita">
                {motorista.veiculoModelo} {motorista.veiculoCor}
              </td>
              <td className="px-4 py-2.5">
                <Placa valor={motorista.placa} tamanho="sm" />
              </td>
              <td className="px-4 py-2.5 text-brita">{ROTULO_TURNO[item.turno]}</td>
              <td className="px-4 py-2.5">
                <StatusPill status={item.status} />
              </td>
              <td className="px-4 py-2.5 text-right">
                <button
                  onClick={() => {
                    if (!usuario) return
                    if (confirm(`Remover ${motorista.nome} da escala de hoje?`)) {
                      void ds.removerItem({ usuarioId: usuario.id, escalaItemId: item.id })
                    }
                  }}
                  className="rotulo text-brita hover:text-sinal"
                >
                  Remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IconePrancheta() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M8.5 11h7M8.5 15h5" />
    </svg>
  )
}

function IconeCaminhoes() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="11" height="9" rx="1" />
      <path d="M13 10h4l4 3v3h-8z" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  )
}

function IconeUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

function IconeDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v12M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  )
}

function IconePlanilha() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M3 9h18M9 9v12" />
    </svg>
  )
}

function IconeCarregando() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 3a9 9 0 1 1-6.36 2.64" />
    </svg>
  )
}

function IconeCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function IconeSol() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" />
    </svg>
  )
}

function IconeLua() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />
    </svg>
  )
}
