import { useState } from 'react'
import { useSessao } from '../../auth/sessao'
import { HOJE, useData, useLiveData } from '../../data/provider'
import { podeResolverBloqueio } from '../../domain/status'
import type { AlertaAberto } from '../../data/DataSource'
import { Placa, PlacaComparada } from '../shared/Placa'
import { Botao, Cartao, ROTULO_TIPO, Rota, TituloSecao, Vazio, dataHora } from '../shared/ui'

export function Alertas() {
  const { dados: alertas } = useLiveData((ds) => ds.listarAlertasAbertos(HOJE))

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4">
        <h1 className="font-display text-2xl font-extrabold">Alertas abertos</h1>
        <p className="mt-1 text-sm text-brita">
          Cada driver aqui está bloqueado e não pode carregar até alguém decidir.
        </p>
      </header>

      {!alertas ? (
        <p className="text-brita">Carregando…</p>
      ) : alertas.length === 0 ? (
        <Cartao>
          <Vazio
            titulo="Nenhum alerta aberto"
            acao="Quando um fiscal reportar divergência, ela aparece aqui na hora."
          />
        </Cartao>
      ) : (
        <ul className="flex flex-col gap-3">
          {alertas.map((a) => (
            <li key={a.irregularidadeId}>
              <CartaoAlerta alerta={a} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CartaoAlerta({ alerta }: { alerta: AlertaAberto }) {
  const { usuario } = useSessao()
  const ds = useData()
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const pode = usuario ? podeResolverBloqueio(usuario.papel) : false

  async function resolver(decisao: 'liberado' | 'mantido_bloqueado') {
    if (!usuario) return
    setErro('')
    setEnviando(true)
    try {
      const r = await ds.resolverBloqueio({
        irregularidadeId: alerta.irregularidadeId,
        usuarioId: usuario.id,
        decisao,
        justificativa,
      })
      if (!r.ok) setErro(r.erro)
    } catch (error) {
      setErro(`Não foi possível resolver o alerta: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Cartao className="overflow-hidden border-l-4 border-l-sinal">
      <TituloSecao
        acao={<span className="font-mono text-xs text-brita">{dataHora(alerta.em)}</span>}
      >
        <span className="flex items-center gap-2">
          <span className="rotulo rounded-full bg-sinal-fraca px-2 py-0.5 text-sinal">
            {ROTULO_TIPO[alerta.tipo]}
          </span>
          {alerta.motorista.nome}
        </span>
      </TituloSecao>

      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <Rota valor={alerta.rota} />
            <span className="font-mono text-sm text-brita">{alerta.motorista.driverId}</span>
          </div>
          <p className="mt-2 text-sm text-brita">
            {alerta.motorista.veiculoModelo} {alerta.motorista.veiculoCor}
          </p>
          <p className="mt-1 text-[13px] text-brita">Reportado por {alerta.fiscalNome}</p>
        </div>

        {alerta.tipo === 'placa' ? (
          <PlacaComparada esperado={alerta.esperado} encontrado={alerta.encontrado} />
        ) : (
          <div className="flex items-center gap-3">
            <div>
              <p className="rotulo text-brita">Escala</p>
              <p className="mt-1 text-sm font-semibold">{alerta.esperado}</p>
            </div>
            <span className="font-display text-xl font-bold text-sinal" aria-hidden="true">
              ≠
            </span>
            <div>
              <p className="rotulo text-sinal">No pátio</p>
              <p className="mt-1 text-sm font-semibold text-sinal">{alerta.encontrado}</p>
            </div>
          </div>
        )}
      </div>

      {alerta.tipo !== 'placa' && (
        <div className="border-t border-linha px-5 py-3">
          <p className="rotulo mb-1.5 text-brita">Placa na escala</p>
          <Placa valor={alerta.motorista.placa} tamanho="sm" />
        </div>
      )}

      {pode ? (
        <div className="border-t border-linha bg-concreto-2 p-5">
          <label className="rotulo block text-brita" htmlFor={`just-${alerta.irregularidadeId}`}>
            Justificativa da decisão
          </label>
          <textarea
            id={`just-${alerta.irregularidadeId}`}
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            rows={2}
            placeholder="O que foi verificado e por que você está decidindo assim."
            className="mt-1.5 w-full resize-none rounded-chip border border-linha bg-white px-3 py-2.5 text-sm"
          />
          <p className="mt-1 text-xs text-brita">
            Fica registrada com seu nome e horário. Mínimo de 10 caracteres.
          </p>

          {erro && (
            <p role="alert" className="mt-2 text-sm font-semibold text-sinal">
              {erro}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Botao onClick={() => resolver('liberado')} disabled={enviando}>
              Liberar com ressalva
            </Botao>
            <Botao variante="perigo" onClick={() => resolver('mantido_bloqueado')} disabled={enviando}>
              Manter bloqueado
            </Botao>
          </div>
        </div>
      ) : (
        <p className="border-t border-linha bg-concreto-2 px-5 py-3 text-sm text-brita">
          Somente analistas resolvem bloqueio. Você acompanha o andamento.
        </p>
      )}
    </Cartao>
  )
}
