import type { Papel, ResultadoCheckin, StatusItem } from './types'

export type Resultado =
  | { ok: true; status: StatusItem }
  | { ok: false; erro: string }

const JUSTIFICATIVA_MINIMA = 10

export const TOLERANCIA_ATRASO_MIN = 15

function minutosDoHorario(horario: string): number | undefined {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(horario)
  if (!m || Number(m[1]) > 23) return undefined
  return Number(m[1]) * 60 + Number(m[2])
}

export function normalizarHorario(horario: string): string | undefined {
  const minutos = minutosDoHorario(horario.trim())
  if (minutos === undefined) return undefined
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

function minutosEmBrasilia(instante: Date): number {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante)
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value)
  return valor('hour') * 60 + valor('minute')
}

export function horaEmBrasilia(instante: Date): string {
  const minutos = minutosEmBrasilia(instante)
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

/** Só atraso conta: chegar antes da onda escalada não é irregularidade. */
export function chegouForaDaOnda(horario: string, chegada: Date): boolean {
  const onda = minutosDoHorario(horario)
  if (onda === undefined) return false
  return minutosEmBrasilia(chegada) - onda > TOLERANCIA_ATRASO_MIN
}

export const ROTULO_STATUS: Record<StatusItem, string> = {
  aguardando: 'Aguardando',
  liberado: 'Liberado',
  bloqueado: 'Bloqueado',
  liberado_com_ressalva: 'Liberado com ressalva',
}

export function registrarCheckin(
  status: StatusItem,
  resultado: ResultadoCheckin,
): Resultado {
  if (status === 'bloqueado') {
    return {
      ok: false,
      erro: 'Item bloqueado: só um analista ou líder pode resolver o bloqueio.',
    }
  }
  return {
    ok: true,
    status: resultado === 'conforme' ? 'liberado' : 'bloqueado',
  }
}

export function resolverBloqueio(input: {
  status: StatusItem
  papel: Papel
  decisao: 'liberado' | 'mantido_bloqueado'
  justificativa: string
}): Resultado {
  const { status, papel, decisao, justificativa } = input

  if (papel !== 'analista') {
    return {
      ok: false,
      erro:
        papel === 'fiscal'
          ? 'Fiscal de pátio não pode resolver bloqueio. Acione um analista.'
          : 'Liderança acompanha o pátio, mas quem resolve bloqueio é o analista.',
    }
  }
  if (status !== 'bloqueado') {
    return { ok: false, erro: 'Este item não está bloqueado.' }
  }
  if (justificativa.trim().length < JUSTIFICATIVA_MINIMA) {
    return {
      ok: false,
      erro: `Justificativa obrigatória, com pelo menos ${JUSTIFICATIVA_MINIMA} caracteres.`,
    }
  }

  return {
    ok: true,
    status: decisao === 'liberado' ? 'liberado_com_ressalva' : 'bloqueado',
  }
}

export function podeEditarEscala(papel: Papel): boolean {
  return papel === 'analista'
}

export function podeResolverBloqueio(papel: Papel): boolean {
  return papel === 'analista'
}

export function podeRegistrarCheckin(papel: Papel): boolean {
  return papel === 'fiscal'
}
