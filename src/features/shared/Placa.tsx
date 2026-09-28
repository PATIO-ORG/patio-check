const TAMANHOS = {
  sm: { caixa: 'w-[88px]', banda: 'h-[7px]', texto: 'text-[13px] py-[3px]' },
  md: { caixa: 'w-[116px]', banda: 'h-[9px]', texto: 'text-[17px] py-[4px]' },
  lg: { caixa: 'w-[168px]', banda: 'h-[12px]', texto: 'text-[26px] py-[6px]' },
} as const

export type TamanhoPlaca = keyof typeof TAMANHOS

/**
 * Elemento-assinatura do sistema: a placa aparece sempre como placa, nunca como
 * texto solto. Na comparação de divergência, isso deixa o caractere trocado
 * visível de relance — que é exatamente o que o fiscal precisa enxergar.
 */
export function Placa({
  valor,
  tamanho = 'md',
  diferenteDe,
  tom = 'normal',
}: {
  valor: string
  tamanho?: TamanhoPlaca
  /** Compara caractere a caractere e destaca os que não batem. */
  diferenteDe?: string
  tom?: 'normal' | 'alerta'
}) {
  const t = TAMANHOS[tamanho]
  const chars = valor.split('')
  const alerta = tom === 'alerta'

  return (
    <span
      className={`inline-flex flex-col overflow-hidden rounded-chip border-2 bg-white leading-none ${t.caixa} ${
        alerta ? 'border-sinal' : 'border-asfalto'
      }`}
      aria-label={`Placa ${valor}`}
    >
      <span
        className={`${t.banda} w-full ${alerta ? 'bg-sinal' : 'bg-placa-banda'}`}
        aria-hidden="true"
      />
      <span
        className={`w-full text-center font-mono font-bold tracking-[0.08em] text-asfalto ${t.texto}`}
      >
        {chars.map((c, i) => {
          const divergente = diferenteDe !== undefined && diferenteDe[i] !== c
          return (
            <span
              key={i}
              className={divergente ? 'rounded-[2px] bg-sinal px-[1px] text-white' : undefined}
            >
              {c}
            </span>
          )
        })}
      </span>
    </span>
  )
}

export function PlacaComparada({
  esperado,
  encontrado,
  tamanho = 'md',
}: {
  esperado: string
  encontrado: string
  tamanho?: TamanhoPlaca
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="rotulo text-brita">Escala</span>
        <Placa valor={esperado} tamanho={tamanho} />
      </div>
      <span className="self-end pb-2 font-display text-2xl font-bold text-sinal-ink" aria-hidden="true">
        ≠
      </span>
      <div className="flex flex-col gap-1.5">
        <span className="rotulo text-sinal-ink">No pátio</span>
        <Placa valor={encontrado} tamanho={tamanho} diferenteDe={esperado} tom="alerta" />
      </div>
    </div>
  )
}
