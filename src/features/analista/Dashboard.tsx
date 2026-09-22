import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Link } from 'react-router-dom'
import { HOJE, useLiveData } from '../../data/provider'
import { Cartao, ROTULO_TIPO, TituloSecao, Vazio, hora } from '../shared/ui'
import { Placa } from '../shared/Placa'
import { COR, Dica, EIXO, Legenda } from './graficos'

export function Dashboard() {
  const { dados: resumo } = useLiveData((ds) => ds.resumoDiario(HOJE))
  const { dados: alertas } = useLiveData((ds) => ds.listarAlertasAbertos(HOJE))
  const { dados: porHora } = useLiveData((ds) => ds.conformidadePorHora(HOJE))
  const { dados: porTipo } = useLiveData((ds) => ds.irregularidadesPorTipo(HOJE))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <Cartao className="p-5">
            <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
              <div>
                <p className="rotulo text-brita">Conformidade do dia</p>
                <p className="mt-1 font-display text-[64px] leading-[0.9] font-extrabold tabular-nums">
                  {resumo?.taxaConformidade ?? 0}
                  <span className="text-3xl text-brita">%</span>
                </p>
                <p className="mt-1.5 text-[13px] text-brita">
                  dos drivers conferidos saíram sem nenhuma divergência
                </p>
              </div>

              <dl className="flex flex-wrap gap-x-8 gap-y-4">
                <Kpi rotulo="Escalados" valor={resumo?.escalados} />
                <Kpi rotulo="Conferidos" valor={resumo?.conferidos} />
                <Kpi rotulo="Pendentes" valor={resumo?.pendentes} destaque="atencao" />
                <Kpi rotulo="Bloqueados" valor={resumo?.bloqueados} destaque="sinal" />
                <Kpi rotulo="Com ressalva" valor={resumo?.liberadosComRessalva} />
              </dl>
            </div>
          </Cartao>

          <Cartao>
            <TituloSecao
              acao={
                <Legenda
                  itens={[
                    { cor: COR.conforme, rotulo: 'Conformes' },
                    { cor: COR.irregular, rotulo: 'Irregulares' },
                  ]}
                />
              }
            >
              Conferências por hora
            </TituloSecao>
            <div className="h-56 px-2 py-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porHora ?? []} barCategoryGap="28%">
                  <CartesianGrid stroke={COR.grade} vertical={false} />
                  <XAxis dataKey="hora" {...EIXO} interval={0} />
                  <YAxis {...EIXO} width={28} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(27,30,36,0.04)' }}
                    content={({ active, payload, label }) => (
                      <Dica
                        ativo={active}
                        titulo={String(label)}
                        linhas={(payload ?? []).map((p) => ({
                          cor: p.color,
                          rotulo: p.name === 'conformes' ? 'Conformes' : 'Irregulares',
                          valor: p.value as number,
                        }))}
                      />
                    )}
                  />
                  <Bar
                    dataKey="conformes"
                    stackId="a"
                    fill={COR.conforme}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  <Bar
                    dataKey="irregulares"
                    stackId="a"
                    fill={COR.irregular}
                    stroke="#fff"
                    strokeWidth={2}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Cartao>

          <Cartao>
            <TituloSecao>Divergências por tipo</TituloSecao>
            {porTipo && porTipo.length > 0 ? (
              <div
                className="px-2 py-4"
                style={{ height: Math.max(140, porTipo.length * 46 + 56) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={porTipo}
                    layout="vertical"
                    margin={{ left: 8, right: 28 }}
                    barCategoryGap="30%"
                  >
                    <CartesianGrid stroke={COR.grade} horizontal={false} />
                    <XAxis type="number" {...EIXO} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="tipo"
                      {...EIXO}
                      width={92}
                      tickFormatter={(t: keyof typeof ROTULO_TIPO) => ROTULO_TIPO[t]}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(27,30,36,0.04)' }}
                      content={({ active, payload }) => (
                        <Dica
                          ativo={active}
                          linhas={(payload ?? []).map((p) => ({
                            cor: COR.irregular,
                            rotulo: ROTULO_TIPO[
                              (p.payload as { tipo: keyof typeof ROTULO_TIPO }).tipo
                            ],
                            valor: p.value as number,
                          }))}
                        />
                      )}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: COR.tinta, fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
                      {porTipo.map((d) => (
                        <Cell key={d.tipo} fill={COR.irregular} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Vazio titulo="Nenhuma divergência hoje" acao="O pátio está limpo até agora." />
            )}
          </Cartao>
        </div>

        <FeedAlertas alertas={alertas} />
      </div>
    </div>
  )
}

function Kpi({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string
  valor?: number
  destaque?: 'atencao' | 'sinal'
}) {
  const cor =
    destaque === 'sinal' ? 'text-sinal' : destaque === 'atencao' ? 'text-demarcacao-escura' : ''
  return (
    <div>
      <dt className="rotulo text-brita">{rotulo}</dt>
      <dd className={`font-display text-3xl font-bold tabular-nums ${cor}`}>{valor ?? '—'}</dd>
    </div>
  )
}

function FeedAlertas({
  alertas,
}: {
  alertas: Awaited<ReturnType<import('../../data/DataSource').DataSource['listarAlertasAbertos']>> | undefined
}) {
  return (
    <Cartao className="flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden xl:sticky xl:top-5">
      <TituloSecao
        acao={
          <Link to="/alertas" className="rotulo text-brita underline hover:text-asfalto">
            Resolver
          </Link>
        }
      >
        <span className="flex items-center gap-2">
          {alertas && alertas.length > 0 && (
            <span className="anim-pulso size-2 rounded-full bg-sinal" aria-hidden="true" />
          )}
          Alertas abertos
          {alertas && (
            <span className="font-mono text-sinal">{alertas.length}</span>
          )}
        </span>
      </TituloSecao>

      {!alertas || alertas.length === 0 ? (
        <Vazio titulo="Nenhum alerta aberto" acao="Tudo que foi reportado já foi resolvido." />
      ) : (
        <ul className="divide-y divide-linha overflow-y-auto">
          {alertas.map((a) => (
            <li key={a.irregularidadeId} className="anim-alerta p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="rotulo rounded-full bg-sinal-fraca px-2 py-0.5 text-sinal">
                  {ROTULO_TIPO[a.tipo]}
                </span>
                <span className="font-mono text-xs text-brita">{hora(a.em)}</span>
              </div>
              <p className="mt-2 font-display text-sm font-bold leading-tight">{a.motorista.nome}</p>
              <p className="mt-0.5 font-mono text-xs text-brita">
                {a.motorista.driverId} · rota {a.rota} · {a.fiscalNome}
              </p>

              {a.tipo === 'placa' ? (
                <div className="mt-2.5 flex items-center gap-2">
                  <Placa valor={a.esperado} tamanho="sm" />
                  <span className="font-display font-bold text-sinal" aria-hidden="true">
                    ≠
                  </span>
                  <Placa valor={a.encontrado} tamanho="sm" diferenteDe={a.esperado} tom="alerta" />
                </div>
              ) : (
                <p className="mt-2 text-[13px]">
                  <span className="text-brita line-through">{a.esperado}</span>{' '}
                  <span className="font-semibold text-sinal">→ {a.encontrado}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  )
}
