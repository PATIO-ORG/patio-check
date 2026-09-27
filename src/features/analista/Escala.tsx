import { useState } from 'react'
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

export function Escala() {
  const { dados: itens, erro, recarregar } = useLiveData((ds) => ds.listarItens(HOJE))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Escala de hoje</h1>
        <p className="mt-1 text-sm text-brita">
          O fiscal de pátio vê estas alterações na hora, sem reimprimir nada.
        </p>
      </header>

      <Importador aoSalvar={recarregar} />
      <DriverAvulso aoSalvar={recarregar} />

      <Cartao>
        <TituloSecao
          acao={<span className="font-mono text-sm text-brita">{itens?.length ?? 0} drivers</span>}
        >
          Drivers escalados
        </TituloSecao>
        {erro ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-sinal">
            <span>Não foi possível carregar a escala: {erro}</span>
            <Botao variante="neutro" onClick={recarregar}>Tentar novamente</Botao>
          </div>
        ) : !itens || itens.length === 0 ? (
          <Vazio titulo="Escala vazia" acao="Suba a planilha do dia para começar." />
        ) : (
          <Tabela itens={itens} />
        )}
      </Cartao>
    </div>
  )
}

function Importador({ aoSalvar }: { aoSalvar: () => void }) {
  const ds = useData()
  const { usuario } = useSessao()
  const [previa, setPrevia] = useState<PreviaImportacao>()
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [erroImportacao, setErroImportacao] = useState(false)
  const [importando, setImportando] = useState(false)

  async function lerArquivo(arquivo: File) {
    setMensagem('')
    setErroImportacao(false)
    setNomeArquivo(arquivo.name)
    try {
      setPrevia(await ds.previsualizarPlanilha(await arquivo.text()))
    } catch (erro) {
      setErroImportacao(true)
      setMensagem(erro instanceof Error ? erro.message : 'Não foi possível ler a planilha.')
      setPrevia(undefined)
    }
  }

  async function confirmar(linhas: LinhaValidada[]) {
    if (!usuario) return
    setImportando(true)
    setMensagem('')
    setErroImportacao(false)
    try {
      await ds.importarPlanilha({ data: HOJE, linhas, usuarioId: usuario.id })
      setPrevia(undefined)
      setMensagem(`${linhas.length} drivers importados de ${nomeArquivo}.`)
      aoSalvar()
    } catch (erro) {
      setErroImportacao(true)
      setMensagem(erro instanceof Error ? erro.message : 'Não foi possível importar a escala.')
    } finally {
      setImportando(false)
    }
  }

  return (
    <Cartao>
      <TituloSecao
        acao={
          <a href={`${import.meta.env.BASE_URL}escala-exemplo.csv`} download className="rotulo text-brita underline hover:text-asfalto">
            Baixar modelo
          </a>
        }
      >
        Subir planilha
      </TituloSecao>

      <div className="p-5">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-chip border-2 border-dashed border-brita-2 px-4 py-5 transition-colors hover:border-asfalto">
          <span>
            <span className="block font-display text-[15px] font-bold">
              Escolher arquivo CSV da escala
            </span>
            <span className="mt-0.5 block text-[13px] text-brita">
              Aceita o modelo padrão ou a planilha JDF de impressão. Nada é gravado antes da conferência.
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
          <p className={`mt-3 rounded-chip px-4 py-2.5 text-sm ${
            erroImportacao ? 'bg-sinal-fraca text-sinal' : 'bg-liberado-fraca text-liberado'
          }`}>
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
                disabled={previa.validas.length === 0 || importando}
              >
                {importando ? 'Importando...' : `Importar ${previa.validas.length} drivers`}
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

function DriverAvulso({ aoSalvar }: { aoSalvar: () => void }) {
  const ds = useData()
  const { usuario } = useSessao()
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState('')

  const campo = (k: keyof typeof VAZIO) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value })),
    className: 'w-full rounded-chip border border-linha bg-white px-3 py-2.5 text-sm',
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
    aoSalvar()
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
              <input {...campo('placa')} placeholder="ABC1D23" className="w-full rounded-chip border border-linha bg-white px-3 py-2.5 font-mono text-sm uppercase" />
            </Rotulado>
            <Rotulado texto="Rota">
              <input {...campo('rota')} placeholder="A-15" className="w-full rounded-chip border border-linha bg-white px-3 py-2.5 font-mono text-sm uppercase" />
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
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const idsSelecionados = itens
    .map(({ item }) => item.id)
    .filter((id) => selecionados.has(id))
  const todosSelecionados = itens.length > 0 && idsSelecionados.length === itens.length

  function alternarItem(itemId: string) {
    setSelecionados((atuais) => {
      const novos = new Set(atuais)
      if (novos.has(itemId)) novos.delete(itemId)
      else novos.add(itemId)
      return novos
    })
  }

  function alternarTodos() {
    setSelecionados(todosSelecionados ? new Set() : new Set(itens.map(({ item }) => item.id)))
  }

  async function removerSelecionados(removerTodos: boolean) {
    if (!usuario) return
    const ids = removerTodos ? itens.map(({ item }) => item.id) : idsSelecionados
    if (ids.length === 0) return
    const descricao = removerTodos
      ? 'Remover todos os drivers da escala de hoje?'
      : `Remover ${ids.length} driver${ids.length === 1 ? '' : 's'} selecionado${ids.length === 1 ? '' : 's'}?`
    if (!confirm(`${descricao} Esta ação não pode ser desfeita.`)) return

    await Promise.all(
      ids.map((escalaItemId) => ds.removerItem({ usuarioId: usuario.id, escalaItemId })),
    )
    setSelecionados(new Set())
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha bg-concreto-2 px-4 py-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={todosSelecionados}
            onChange={alternarTodos}
            disabled={itens.length === 0}
            className="h-4 w-4 accent-asfalto"
            aria-label="Selecionar todos os drivers"
          />
          Selecionar todos
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {idsSelecionados.length > 0 && (
            <Botao
              variante="perigo"
              onClick={() => void removerSelecionados(false)}
            >
              Remover selecionados ({idsSelecionados.length})
            </Botao>
          )}
          <Botao
            variante="fantasma"
            onClick={() => void removerSelecionados(true)}
            disabled={itens.length === 0}
          >
            Remover todos
          </Botao>
        </div>
      </div>
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-linha bg-concreto-2">
          <tr className="rotulo text-brita">
            <th className="w-10 px-4 py-2.5">
              <span className="sr-only">Selecionar</span>
            </th>
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
            <tr key={item.id} className={item.avulso ? 'bg-demarcacao/8' : undefined}>
              <td className="px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={selecionados.has(item.id)}
                  onChange={() => alternarItem(item.id)}
                  className="h-4 w-4 accent-asfalto"
                  aria-label={`Selecionar ${motorista.nome}`}
                />
              </td>
              <td className="px-4 py-2.5">
                <Rota valor={item.rota} />
              </td>
              <td className="px-4 py-2.5">
                <span className="font-semibold">{motorista.nome}</span>
                <span className="ml-2 font-mono text-xs text-brita">{motorista.driverId}</span>
                {item.avulso && (
                  <span className="rotulo ml-2 rounded-full bg-demarcacao px-1.5 py-0.5 text-asfalto">
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
