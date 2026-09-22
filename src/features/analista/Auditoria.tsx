import { useState } from 'react'
import { HOJE, useLiveData } from '../../data/provider'
import type { AcaoAuditavel } from '../../domain/types'
import { USUARIOS } from '../../data/mock/seed'
import { Cartao, TituloSecao, Vazio, dataHora } from '../shared/ui'

const ROTULO_ACAO: Record<AcaoAuditavel, { texto: string; cor: string }> = {
  'escala.importada': { texto: 'Importou escala', cor: 'bg-fundo text-tinta' },
  'escala.item_adicionado': { texto: 'Adicionou driver', cor: 'bg-destaque text-sobre-destaque' },
  'escala.item_editado': { texto: 'Editou driver', cor: 'bg-fundo text-tinta' },
  'escala.item_removido': { texto: 'Removeu driver', cor: 'bg-fundo text-tinta' },
  'checkin.registrado': { texto: 'Conferiu driver', cor: 'bg-liberado-fraca text-liberado' },
  'irregularidade.reportada': { texto: 'Reportou divergência', cor: 'bg-sinal-fraca text-sinal' },
  'bloqueio.liberado': { texto: 'Liberou bloqueio', cor: 'bg-ressalva-fraca text-ressalva' },
  'bloqueio.mantido': { texto: 'Manteve bloqueio', cor: 'bg-sinal-fraca text-sinal' },
}

export function Auditoria() {
  const [usuarioId, setUsuarioId] = useState('')
  const [data, setData] = useState(HOJE)
  const { dados: logs } = useLiveData(
    (ds) => ds.listarAuditoria({ data, usuarioId: usuarioId || undefined }),
    [data, usuarioId],
  )

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Auditoria</h1>
        <p className="mt-1 text-sm text-brita">
          Quem fez o quê, quando. Com vários analistas e vários fiscais, é o que fecha a conta.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <label className="block">
          <span className="rotulo mb-1 block text-brita">Data</span>
          <input
            type="date"
            value={data}
            max={HOJE}
            onChange={(e) => setData(e.target.value)}
            className="rounded-chip border border-linha bg-white px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block">
          <span className="rotulo mb-1 block text-brita">Usuário</span>
          <select
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            className="rounded-chip border border-linha bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {USUARIOS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Cartao>
        <TituloSecao
          acao={<span className="font-mono text-sm text-brita">{logs?.length ?? 0} registros</span>}
        >
          Linha do tempo
        </TituloSecao>

        {!logs || logs.length === 0 ? (
          <Vazio titulo="Nenhum registro nesse filtro" acao="Escolha outra data ou outro usuário." />
        ) : (
          <ul className="divide-y divide-linha">
            {logs.map((l) => {
              const a = ROTULO_ACAO[l.acao]
              return (
                <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                  <span className="font-mono text-xs text-brita">{dataHora(l.em)}</span>
                  <span className={`rotulo rounded-full px-2 py-0.5 ${a.cor}`}>{a.texto}</span>
                  <span className="text-sm font-semibold">{l.usuarioNome}</span>
                  <span className="w-full font-mono text-xs text-brita sm:ml-auto sm:w-auto">
                    {resumirAlvo(l.depois) || l.entidadeId}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Cartao>
    </div>
  )
}

function resumirAlvo(depois: unknown): string {
  if (!depois || typeof depois !== 'object') return ''
  const d = depois as Record<string, unknown>
  const partes = ['driverId', 'nome', 'rota', 'tipo', 'resultado', 'status', 'linhas']
    .filter((k) => d[k] !== undefined)
    .map((k) => String(d[k]))
  return partes.join(' · ')
}
