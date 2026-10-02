import type { ReactNode } from 'react'

/**
 * Verde e vermelho aqui são cores de estado (conforme / irregular), não paleta
 * categórica: o significado é fixo em todo o sistema. O par foi validado para
 * daltonismo (ΔE deutan 8.8) e sempre vem acompanhado de legenda e rótulo, nunca
 * só pela cor.
 */
export const COR = {
  conforme: '#1f8a5b',
  irregular: '#d92d20',
  eixo: 'var(--color-brita)',
  grade: 'var(--color-linha)',
  tinta: 'var(--color-ink)',
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
    <div className="rounded-chip border border-linha bg-superficie px-3 py-2 shadow-sm">
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
            <span className="ml-auto font-display font-bold">{l.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const EIXO = {
  tick: { fill: COR.eixo, fontSize: 11, fontFamily: 'Archivo, sans-serif' },
  axisLine: false,
  tickLine: false,
} as const
