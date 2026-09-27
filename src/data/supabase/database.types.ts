import type {
  AcaoAuditavel,
  Papel,
  ResultadoCheckin,
  StatusItem,
  TipoIrregularidade,
  Turno,
} from '../../domain/types'

type Table<Row> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: Table<{
        id: string
        nome: string
        email: string
        papel: Papel
        ativo: boolean
        criado_em: string
      }>
      motoristas: Table<{
        id: string
        driver_id: string
        nome: string
        veiculo_modelo: string
        veiculo_cor: string
        placa: string
        telefone: string | null
        criado_em: string
        atualizado_em: string
      }>
      escalas: Table<{
        id: string
        data: string
        criada_por: string
        origem: 'planilha' | 'manual'
        criada_em: string
      }>
      escala_itens: Table<{
        id: string
        escala_id: string
        motorista_id: string
        rota: string
        turno: Turno
        status: StatusItem
        adicionado_em: string
        adicionado_por: string
        avulso: boolean
        removido_em: string | null
      }>
      checkins: Table<{
        id: string
        escala_item_id: string
        fiscal_id: string
        em: string
        resultado: ResultadoCheckin
        observacao: string | null
      }>
      irregularidades: Table<{
        id: string
        checkin_id: string
        escala_item_id: string
        tipo: TipoIrregularidade
        esperado: string
        encontrado: string
        foto_url: string | null
      }>
      liberacoes: Table<{
        id: string
        irregularidade_id: string
        analista_id: string
        em: string
        justificativa: string
        decisao: 'liberado' | 'mantido_bloqueado'
      }>
      auditoria: Table<{
        id: string
        usuario_id: string
        acao: AcaoAuditavel
        entidade: string
        entidade_id: string
        antes: unknown
        depois: unknown
        em: string
      }>
    }
    Views: Record<string, never>
    Functions: {
      importar_escala: {
        Args: { p_id: string; p_data: string; p_usuario_id: string; p_linhas: unknown }
        Returns: undefined
      }
      registrar_checkin: {
        Args: {
          p_id: string
          p_escala_item_id: string
          p_fiscal_id: string
          p_resultado: ResultadoCheckin
          p_observacao: string | null
          p_divergencias: unknown
        }
        Returns: unknown
      }
      resolver_bloqueio: {
        Args: {
          p_id: string
          p_irregularidade_id: string
          p_usuario_id: string
          p_decisao: 'liberado' | 'mantido_bloqueado'
          p_justificativa: string
        }
        Returns: unknown
      }
      adicionar_item_avulso: {
        Args: {
          p_escala_id: string
          p_escala_data: string
          p_usuario_id: string
          p_item_id: string
          p_motorista_id: string
          p_motorista: unknown
          p_rota: string
          p_turno: Turno
        }
        Returns: undefined
      }
      editar_item: {
        Args: {
          p_escala_item_id: string
          p_usuario_id: string
          p_motorista: unknown
          p_rota: string | null
          p_turno: Turno | null
        }
        Returns: undefined
      }
      remover_item: {
        Args: { p_escala_item_id: string; p_usuario_id: string }
        Returns: boolean
      }
      remover_itens_do_dia: {
        Args: { p_data: string; p_usuario_id: string }
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
