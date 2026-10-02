export type Papel = 'fiscal' | 'analista' | 'lider'

export interface Usuario {
  id: string
  nome: string
  email: string
  papel: Papel
  ativo: boolean
}

export interface Motorista {
  id: string
  driverId: string
  nome: string
  veiculoModelo: string
  veiculoCor: string
  placa: string
  telefone?: string
}

export type OrigemEscala = 'planilha' | 'manual'

export interface Escala {
  id: string
  data: string
  criadaPor: string
  origem: OrigemEscala
  criadaEm: string
}

export type StatusItem =
  | 'aguardando'
  | 'liberado'
  | 'bloqueado'
  | 'liberado_com_ressalva'

export type Turno = 'manha' | 'tarde' | 'noite'

export interface EscalaItem {
  id: string
  escalaId: string
  motoristaId: string
  rota: string
  turno: Turno
  /** Onda de chegada (HH:MM). Sem ela, o item não é checado por horário. */
  horario?: string
  status: StatusItem
  adicionadoEm: string
  adicionadoPor: string
  avulso: boolean
}

export type ResultadoCheckin = 'conforme' | 'irregular'

export interface Checkin {
  id: string
  escalaItemId: string
  fiscalId: string
  em: string
  resultado: ResultadoCheckin
  observacao?: string
}

export type TipoIrregularidade =
  | 'placa'
  | 'veiculo'
  | 'nome'
  | 'id'
  | 'ocupante'
  | 'horario'

export interface Irregularidade {
  id: string
  checkinId: string
  escalaItemId: string
  tipo: TipoIrregularidade
  esperado: string
  encontrado: string
}

export interface Liberacao {
  id: string
  irregularidadeId: string
  analistaId: string
  em: string
  justificativa: string
  decisao: 'liberado' | 'mantido_bloqueado'
}

export type AcaoAuditavel =
  | 'escala.importada'
  | 'escala.item_adicionado'
  | 'escala.item_editado'
  | 'escala.item_removido'
  | 'checkin.registrado'
  | 'irregularidade.reportada'
  | 'bloqueio.liberado'
  | 'bloqueio.mantido'

export interface AuditLog {
  id: string
  usuarioId: string
  acao: AcaoAuditavel
  entidade: string
  entidadeId: string
  antes?: unknown
  depois?: unknown
  em: string
}

/** Item de escala com o motorista já resolvido — formato consumido pelas telas. */
export interface ItemDetalhado {
  item: EscalaItem
  motorista: Motorista
  ultimoCheckin?: Checkin
  irregularidades: Irregularidade[]
}
