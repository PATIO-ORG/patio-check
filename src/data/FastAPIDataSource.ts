import type {
  AuditLog,
  Escala,
  ItemDetalhado,
  Motorista,
  ResultadoCheckin,
  StatusItem,
  Turno,
  Usuario,
} from '../domain/types'
import type {
  AlertaAberto,
  ContagemTipo,
  DataSource,
  DivergenciaReportada,
  EventoDados,
  LinhaValidada,
  PontoHora,
  PreviaImportacao,
  ResumoDiario,
} from './DataSource'
import { supabase } from '../lib/supabase'

interface ApiResultado {
  ok: true
  status: StatusItem
}

interface ApiErro {
  ok: false
  erro: string
}

/** Implementação HTTP do contrato usado pelas telas do sistema. */
export class FastAPIDataSource implements DataSource {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = supabase
      ? (await supabase.auth.getSession()).data.session?.access_token
      : undefined
    const headers = new Headers(init?.headers)
    headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const resposta = await fetch(`${this.baseUrl}${path}`, { ...init, headers })
    if (!resposta.ok) {
      const detalhe = await resposta.text()
      throw new Error(detalhe || `Erro HTTP ${resposta.status}`)
    }
    if (resposta.status === 204) return undefined as T
    return resposta.json() as Promise<T>
  }

  private json(input: unknown): RequestInit {
    return { method: 'POST', body: JSON.stringify(input) }
  }

  listarUsuarios() {
    return this.request<Usuario[]>('/usuarios')
  }

  obterEscala(data: string) {
    return this.request<Escala | undefined>(`/escalas/${data}`)
  }

  listarItens(data: string) {
    return this.request<ItemDetalhado[]>(`/escalas/${data}/itens`)
  }

  previsualizarPlanilha(csv: string) {
    return this.request<PreviaImportacao>('/planilhas/previa', this.json({ csv }))
  }

  async importarPlanilha(input: { data: string; linhas: LinhaValidada[]; usuarioId: string }) {
    await this.request<void>('/planilhas/importar', this.json(input))
  }

  async adicionarItemAvulso(input: {
    data: string
    usuarioId: string
    motorista: Omit<Motorista, 'id'>
    rota: string
    turno: Turno
  }) {
    await this.request<void>('/escalas/itens', this.json(input))
  }

  async editarItem(input: {
    usuarioId: string
    escalaItemId: string
    motorista: Partial<Omit<Motorista, 'id'>>
    rota?: string
    turno?: Turno
  }) {
    await this.request<void>(`/escalas/itens/${input.escalaItemId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  }

  async removerItem(input: { usuarioId: string; escalaItemId: string }) {
    await this.request<void>(`/escalas/itens/${input.escalaItemId}`, {
      method: 'DELETE',
      body: JSON.stringify({ usuarioId: input.usuarioId }),
    })
  }

  registrarCheckin(input: {
    escalaItemId: string
    fiscalId: string
    resultado: ResultadoCheckin
    observacao?: string
    divergencias?: DivergenciaReportada[]
  }): Promise<ApiResultado | ApiErro> {
    return this.request<ApiResultado | ApiErro>('/checkins', this.json(input))
  }

  resolverBloqueio(input: {
    irregularidadeId: string
    usuarioId: string
    decisao: 'liberado' | 'mantido_bloqueado'
    justificativa: string
  }): Promise<ApiResultado | ApiErro> {
    return this.request<ApiResultado | ApiErro>('/bloqueios/resolver', this.json(input))
  }

  listarAlertasAbertos(data: string) {
    return this.request<AlertaAberto[]>(`/alertas?data=${encodeURIComponent(data)}`)
  }

  resumoDiario(data: string) {
    return this.request<ResumoDiario>(`/relatorios/resumo?data=${encodeURIComponent(data)}`)
  }

  conformidadePorHora(data: string) {
    return this.request<PontoHora[]>(`/relatorios/conformidade-hora?data=${encodeURIComponent(data)}`)
  }

  irregularidadesPorTipo(data: string) {
    return this.request<ContagemTipo[]>(`/relatorios/irregularidades?data=${encodeURIComponent(data)}`)
  }

  historico(dias: number, ate: string) {
    return this.request<ResumoDiario[]>(
      `/relatorios/historico?dias=${dias}&ate=${encodeURIComponent(ate)}`,
    )
  }

  listarAuditoria(filtro?: { data?: string; usuarioId?: string }) {
    const parametros = new URLSearchParams()
    if (filtro?.data) parametros.set('data', filtro.data)
    if (filtro?.usuarioId) parametros.set('usuarioId', filtro.usuarioId)
    const query = parametros.toString()
    return this.request<(AuditLog & { usuarioNome: string })[]>(
      `/auditoria${query ? `?${query}` : ''}`,
    )
  }

  subscribe(listener: (evento: EventoDados) => void) {
    const intervalo = window.setInterval(
      () => listener({ tipo: 'mudanca', em: new Date().toISOString() }),
      5000,
    )
    return () => window.clearInterval(intervalo)
  }
}
