import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { HOJE, useLiveData } from '../../data/provider'
import type { ResumoDiario } from '../../data/DataSource'
import { Botao, Cartao, TituloSecao, Vazio, diaCurto } from '../shared/ui'
import { COR, Dica, EIXO } from './graficos'

const PERIODOS = [7, 14, 30] as const

export function Relatorios() {
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(14)
  const { dados: historico } = useLiveData((ds) => ds.historico(dias, HOJE), [dias])

  const serie = (historico ?? []).map((d) => ({ ...d, rotulo: diaCurto(d.data) }))
  const total = serie.reduce(
    (acc, d) => ({
      escalados: acc.escalados + d.escalados,
      bloqueados: acc.bloqueados + d.bloqueados,
      ressalvas: acc.ressalvas + d.liberadosComRessalva,
    }),
    { escalados: 0, bloqueados: 0, ressalvas: 0 },
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Relatórios</h1>
          <p className="mt-1 text-sm text-brita">
            O que antes era descartado com a folha de papel no fim do dia.
          </p>
        </div>
        <div className="flex gap-1.5">
          {PERIODOS.map((p) => (
            <button
              key={p}
              onClick={() => setDias(p)}
              aria-pressed={dias === p}
              className={`rotulo rounded-chip px-3 py-2 transition-colors ${
                dias === p ? 'bg-chip text-sobre-chip' : 'bg-white text-brita ring-1 ring-linha'
              }`}
            >
              {p} dias
            </button>
          ))}
          <Botao variante="neutro" onClick={() => exportarCsv(historico ?? [])}>
            Exportar CSV
          </Botao>
        </div>
      </header>

      <Cartao className="grid gap-5 p-5 sm:grid-cols-3">
        <Total rotulo="Drivers conferidos no período" valor={total.escalados} />
        <Total rotulo="Bloqueios registrados" valor={total.bloqueados + total.ressalvas} destaque />
        <Total
          rotulo="Ainda bloqueados ao fim do dia"
          valor={total.bloqueados}
          destaque
        />
      </Cartao>

      <Cartao>
        <TituloSecao
          acao={<span className="rotulo text-brita">eixo começa em 50%</span>}
        >
          Taxa de conformidade por dia (%)
        </TituloSecao>
        {serie.length === 0 ? (
          <Vazio titulo="Sem histórico no período" />
        ) : (
          <div className="h-60 px-2 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ right: 12 }}>
                <CartesianGrid stroke={COR.grade} vertical={false} />
                <XAxis dataKey="rotulo" {...EIXO} interval="preserveStartEnd" />
                <YAxis {...EIXO} width={38} domain={[50, 100]} ticks={[50, 60, 70, 80, 90, 100]} unit="%" />
                <Tooltip
                  cursor={{ stroke: COR.eixo, strokeDasharray: '3 3' }}
                  content={({ active, payload, label }) => (
                    <Dica
                      ativo={active}
                      titulo={String(label)}
                      linhas={[
                        {
                          cor: COR.conforme,
                          rotulo: 'Conformidade',
                          valor: `${payload?.[0]?.value ?? 0}%`,
                        },
                      ]}
                    />
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="taxaConformidade"
                  stroke={COR.conforme}
                  strokeWidth={2}
                  dot={{ r: 3, fill: COR.conforme, strokeWidth: 0 }}
                  activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Cartao>

      <Cartao>
        <TituloSecao>Drivers bloqueados por dia</TituloSecao>
        <div className="h-52 px-2 py-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie} barCategoryGap="30%">
              <CartesianGrid stroke={COR.grade} vertical={false} />
              <XAxis dataKey="rotulo" {...EIXO} interval="preserveStartEnd" />
              <YAxis {...EIXO} width={28} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'rgba(27,30,36,0.04)' }}
                content={({ active, payload, label }) => (
                  <Dica
                    ativo={active}
                    titulo={String(label)}
                    linhas={[
                      {
                        cor: COR.irregular,
                        rotulo: 'Bloqueados',
                        valor: (payload?.[0]?.value as number) ?? 0,
                      },
                    ]}
                  />
                )}
              />
              <Bar dataKey="bloqueados" fill={COR.irregular} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Cartao>

      <Cartao>
        <TituloSecao>Detalhamento</TituloSecao>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-linha bg-superficie-2">
              <tr className="rotulo text-brita">
                <th className="px-4 py-2.5">Data</th>
                <th className="px-4 py-2.5 text-right">Escalados</th>
                <th className="px-4 py-2.5 text-right">Conferidos</th>
                <th className="px-4 py-2.5 text-right">Bloqueados</th>
                <th className="px-4 py-2.5 text-right">Ressalvas</th>
                <th className="px-4 py-2.5 text-right">Conformidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha font-mono tabular-nums">
              {[...serie].reverse().map((d) => (
                <tr key={d.data}>
                  <td className="px-4 py-2">{d.rotulo}</td>
                  <td className="px-4 py-2 text-right">{d.escalados}</td>
                  <td className="px-4 py-2 text-right">{d.conferidos}</td>
                  <td className="px-4 py-2 text-right text-sinal">{d.bloqueados}</td>
                  <td className="px-4 py-2 text-right text-ressalva">{d.liberadosComRessalva}</td>
                  <td className="px-4 py-2 text-right font-bold">{d.taxaConformidade}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    </div>
  )
}

function Total({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string
  valor: number
  destaque?: boolean
}) {
  return (
    <div>
      <p className="rotulo text-brita">{rotulo}</p>
      <p
        className={`mt-1 font-display text-4xl font-extrabold tabular-nums ${destaque ? 'text-sinal' : ''}`}
      >
        {valor}
      </p>
    </div>
  )
}

function exportarCsv(linhas: ResumoDiario[]) {
  const cabecalho = 'data;escalados;conferidos;pendentes;bloqueados;ressalvas;conformidade_pct'
  const corpo = linhas.map((d) =>
    [
      d.data,
      d.escalados,
      d.conferidos,
      d.pendentes,
      d.bloqueados,
      d.liberadosComRessalva,
      d.taxaConformidade,
    ].join(';'),
  )
  const blob = new Blob([[cabecalho, ...corpo].join('\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `patio-relatorio-${HOJE}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
