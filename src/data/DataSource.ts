import type {
  AuditLog,
  Escala,
  ItemDetalhado,
  Motorista,
  ResultadoCheckin,
  StatusItem,
  TipoIrregularidade,
  Turno,
  Usuario,
} from '../domain/types'

/** Uma linha crua vinda da planilha do analista, antes de virar escala. */
export interface LinhaPlanilha {
  linha: number
  driverId: string
  nome: string
  veiculoModelo: string
  veiculoCor: string
  placa: string
  rota: string
  turno: string
}

export interface LinhaValidada extends LinhaPlanilha {
  erros: string[]
}

export interface PreviaImportacao {
  validas: LinhaValidada[]
  invalidas: LinhaValidada[]
  erro?: string
}

export interface DivergenciaReportada {
  tipo: TipoIrregularidade
  encontrado: string
}

export interface ResumoDiario {
  data: string
  escalados: number
  conferidos: number
  pendentes: number
  bloqueados: number
  liberadosComRessalva: number
  taxaConformidade: number
}

export interface PontoHora {
  hora: string
  conformes: number
  irregulares: number
}

export interface ContagemTipo {
  tipo: TipoIrregularidade
  total: number
}

export interface AlertaAberto {
  irregularidadeId: string
  escalaItemId: string
  tipo: TipoIrregularidade
  esperado: string
  encontrado: string
  em: string
  fiscalNome: string
  motorista: Motorista
  rota: string
}

export type EventoDados = { tipo: 'mudanca'; em: string }

/**
 * Único ponto de acesso a dados do sistema. Nenhum componente fala com o
 * banco (ou com o mock) diretamente — tudo passa por esta interface, para que
 * trocar o mock por Supabase seja substituir a implementação, não reescrever
 * as telas.
 */
export interface DataSource {
  listarUsuarios(): Promise<Usuario[]>

  obterEscala(data: string): Promise<Escala | undefined>
  listarItens(data: string): Promise<ItemDetalhado[]>

  previsualizarPlanilha(csv: string): Promise<PreviaImportacao>
  importarPlanilha(input: {
    data: string
    linhas: LinhaValidada[]
    usuarioId: string
  }): Promise<void>

  adicionarItemAvulso(input: {
    data: string
    usuarioId: string
    motorista: Omit<Motorista, 'id'>
    rota: string
    turno: Turno
  }): Promise<void>

  editarItem(input: {
    usuarioId: string
    escalaItemId: string
    motorista: Partial<Omit<Motorista, 'id'>>
    rota?: string
    turno?: Turno
  }): Promise<void>

  removerItem(input: { usuarioId: string; escalaItemId: string }): Promise<void>
  removerItensDoDia(input: { usuarioId: string; data: string }): Promise<number>

  registrarCheckin(input: {
    escalaItemId: string
    fiscalId: string
    resultado: ResultadoCheckin
    observacao?: string
    divergencias?: DivergenciaReportada[]
  }): Promise<{ ok: true; status: StatusItem } | { ok: false; erro: string }>

  resolverBloqueio(input: {
    irregularidadeId: string
    usuarioId: string
    decisao: 'liberado' | 'mantido_bloqueado'
    justificativa: string
  }): Promise<{ ok: true; status: StatusItem } | { ok: false; erro: string }>

  listarAlertasAbertos(data: string): Promise<AlertaAberto[]>
  resumoDiario(data: string): Promise<ResumoDiario>
  conformidadePorHora(data: string): Promise<PontoHora[]>
  irregularidadesPorTipo(data: string): Promise<ContagemTipo[]>
  historico(dias: number, ate: string): Promise<ResumoDiario[]>

  listarAuditoria(filtro?: {
    data?: string
    usuarioId?: string
  }): Promise<(AuditLog & { usuarioNome: string })[]>

  /** Notifica qualquer mutação. Devolve a função de cancelamento. */
  subscribe(listener: (e: EventoDados) => void): () => void
}
