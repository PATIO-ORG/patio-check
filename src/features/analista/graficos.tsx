import type { ReactNode } from 'react'

/**
 * Verde e vinho aqui são cores de estado (conforme / irregular), não paleta
 * categórica: o significado é fixo em todo o sistema e igual em qualquer paleta.
 * O par foi validado para daltonismo (ΔE deutan 9,8) e sempre vem com legenda e
 * rótulo, nunca só pela cor. O verde das barras é mais claro que o token
 * `liberado` de propósito: o verde escuro de texto cola no vinho para daltônicos.
 * Eixo, grade e rótulos seguem os tokens da paleta.
 */
export const COR = {
  conforme: '#1f8a5b',
  irregular: '#9f1239',
  eixo: 'var(--color-brita)',
  grade: 'var(--color-linha)',
  tinta: 'var(--color-tinta)',
} as const

export function Legenda({ itens }: { itens: { cor: string; rotulo: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-4">
      {itens.map((i) => (
        <li key={i.rotulo} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-[2px]"
            style={{ background: i.cor }}
            aria-hidden="true"
          />
          <span className="rotulo text-brita">{i.rotulo}</span>
        </li>
      ))}
    </ul>
  )
}

export function Dica({
  ativo,
  titulo,
  linhas,
}: {
  ativo?: boolean
  titulo?: ReactNode
  linhas: { cor?: string; rotulo: string; valor: ReactNode }[]
}) {
  if (!ativo) return null
  return (
    <div className="rounded-chip border border-linha bg-white px-3 py-2 shadow-sm">
      {titulo && <p className="rotulo mb-1.5 text-brita">{titulo}</p>}
      <ul className="flex flex-col gap-1">
        {linhas.map((l) => (
          <li key={l.rotulo} className="flex items-center gap-2 text-[13px]">
            {l.cor && (
              <span
                className="size-2 rounded-[2px]"
                style={{ background: l.cor }}
                aria-hidden="true"
              />
            )}
            <span className="text-brita">{l.rotulo}</span>
            <span className="ml-auto font-mono font-bold">{l.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const EIXO = {
  tick: { fill: COR.eixo, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
  axisLine: false,
  tickLine: false,
} as const
