import type { ReactNode } from 'react'
import type { StatusItem, TipoIrregularidade, Turno } from '../../domain/types'

export const CORES_STATUS: Record<
  StatusItem,
  { barra: string; fundo: string; texto: string; rotulo: string }
> = {
  aguardando: {
    barra: 'bg-brita-2',
    fundo: 'bg-concreto-2',
    texto: 'text-brita',
    rotulo: 'Aguardando',
  },
  liberado: {
    barra: 'bg-liberado',
    fundo: 'bg-liberado-fraca',
    texto: 'text-liberado',
    rotulo: 'Liberado',
  },
  bloqueado: {
    barra: 'bg-sinal',
    fundo: 'bg-sinal-fraca',
    texto: 'text-sinal',
    rotulo: 'Bloqueado',
  },
  liberado_com_ressalva: {
    barra: 'bg-ressalva',
    fundo: 'bg-ressalva-fraca',
    texto: 'text-ressalva',
    rotulo: 'Ressalva',
  },
}

export const ROTULO_TIPO: Record<TipoIrregularidade, string> = {
  placa: 'Placa',
  veiculo: 'Veículo',
  nome: 'Nome',
  id: 'ID do driver',
  ocupante: 'Ocupante',
}

export const ROTULO_TURNO: Record<Turno, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
}

export function StatusPill({ status }: { status: StatusItem }) {
  const c = CORES_STATUS[status]
  return (
    <span className={`rotulo inline-block rounded-full px-2.5 py-1 ${c.fundo} ${c.texto}`}>
      {c.rotulo}
    </span>
  )
}

export function Rota({ valor }: { valor: string }) {
  return (
    <span className="inline-block rounded-chip bg-asfalto px-2 py-1 font-mono text-[13px] font-bold tracking-[0.08em] text-demarcacao">
      {valor}
    </span>
  )
}

export function Botao({
  children,
  variante = 'primario',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'perigo' | 'neutro' | 'fantasma'
}) {
  const estilos = {
    primario: 'bg-asfalto text-concreto hover:bg-asfalto-2 disabled:bg-brita-2',
    perigo: 'bg-sinal text-white hover:brightness-110 disabled:bg-brita-2',
    neutro: 'bg-white text-asfalto border border-linha hover:border-asfalto',
    fantasma: 'text-brita hover:text-asfalto',
  }[variante]

  return (
    <button
      {...props}
      className={`rounded-chip px-4 py-2.5 font-display text-sm font-bold transition-colors disabled:cursor-not-allowed ${estilos} ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function Cartao({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-lg border border-linha bg-white ${className}`}>
      {children}
    </section>
  )
}

export function TituloSecao({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-linha px-5 py-3.5">
      <h2 className="font-display text-[15px] font-bold tracking-[-0.01em]">{children}</h2>
      {acao}
    </header>
  )
}

export function Vazio({ titulo, acao }: { titulo: string; acao?: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="font-display text-base font-semibold text-asfalto">{titulo}</p>
      {acao && <p className="mt-1.5 text-sm text-brita">{acao}</p>}
    </div>
  )
}

export function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function dataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function dataExtensa(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

export function dataCompacta(iso: string) {
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
    .replace(/\./g, '')
}

export function diaCurto(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}
