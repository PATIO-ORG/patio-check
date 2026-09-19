import type { Papel, ResultadoCheckin, StatusItem } from './types'

export type Resultado =
  | { ok: true; status: StatusItem }
  | { ok: false; erro: string }

const JUSTIFICATIVA_MINIMA = 10

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
