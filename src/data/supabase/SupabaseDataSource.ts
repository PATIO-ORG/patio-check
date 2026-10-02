import { type SupabaseClient } from '@supabase/supabase-js'
import type {
  AuditLog,
  Escala,
  EscalaItem,
  ItemDetalhado,
  Motorista,
  TipoIrregularidade,
  Turno,
  Usuario,
} from '../../domain/types'
import { type Resultado } from '../../domain/status'
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
} from '../DataSource'
import { supabase } from './client'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>
type DbEscala = Database['public']['Tables']['escalas']['Row']
type DbItem = Database['public']['Tables']['escala_itens']['Row']
type DbMotorista = Database['public']['Tables']['motoristas']['Row']
type DbCheckin = Database['public']['Tables']['checkins']['Row']
type DbIrregularidade = Database['public']['Tables']['irregularidades']['Row']
type DbAuditoria = Database['public']['Tables']['auditoria']['Row']

const TURNOS: Record<string, Turno> = {
  manha: 'manha',
  manhã: 'manha',
  tarde: 'tarde',
  noite: 'noite',
}
const CSV_ROUTE = /^[A-Z]-\d{1,2}$/
const CSV_PLATE = /^(?:[A-Z]{3}\d[A-Z]\d{2}|[A-Z]{3}-?\d{4})$/
const CSV_HEADER_ALIASES: Record<string, string> = {
  driver: 'driverId', driver_id: 'driverId', id: 'driverId', id_do_driver: 'driverId',
  codigo: 'driverId', nome: 'nome', nome_do_motorista: 'nome', driver_escalado: 'nome',
  motorista: 'nome', veiculo: 'veiculoModelo', veiculo_modelo: 'veiculoModelo',
  modelo: 'veiculoModelo', tipo: 'veiculoModelo', cor: 'veiculoCor',
  veiculo_cor: 'veiculoCor', placa: 'placa', rota: 'rota', letra: 'rota',
  turno: 'turno', horario: 'horario', hora: 'horario',
}

const novoId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 14)}`

function obrigar<T>(data: T | null, error: { message: string; code?: string } | null): T {
  if (error) {
    const code = error.code ? ` (${error.code})` : ''
    throw new Error(`Supabase${code}: ${error.message}`)
  }
  if (data === null) throw new Error('Supabase não retornou os dados esperados.')
  return data
}

function mapEscala(row: DbEscala): Escala {
  return { id: row.id, data: row.data, criadaPor: row.criada_por, origem: row.origem, criadaEm: row.criada_em }
}

function mapMotorista(row: DbMotorista): Motorista {
  return {
    id: row.id,
    driverId: row.driver_id,
    nome: row.nome,
    veiculoModelo: row.veiculo_modelo,
    veiculoCor: row.veiculo_cor,
    placa: row.placa,
    ...(row.telefone ? { telefone: row.telefone } : {}),
  }
}

function mapItem(row: DbItem): EscalaItem {
  return {
    id: row.id, escalaId: row.escala_id, motoristaId: row.motorista_id, rota: row.rota,
    turno: row.turno, status: row.status, adicionadoEm: row.adicionado_em,
    adicionadoPor: row.adicionado_por, avulso: row.avulso,
  }
}

function mapCheckin(row: DbCheckin) {
  return {
    id: row.id, escalaItemId: row.escala_item_id, fiscalId: row.fiscal_id, em: row.em,
    resultado: row.resultado, ...(row.observacao ? { observacao: row.observacao } : {}),
  }
}

function mapIrregularidade(row: DbIrregularidade) {
  return {
    id: row.id, checkinId: row.checkin_id, escalaItemId: row.escala_item_id,
    tipo: row.tipo, esperado: row.esperado, encontrado: row.encontrado,
  }
}

function mapAuditoria(row: DbAuditoria): AuditLog {
  return {
    id: row.id, usuarioId: row.usuario_id, acao: row.acao, entidade: row.entidade,
    entidadeId: row.entidade_id, antes: row.antes ?? undefined, depois: row.depois ?? undefined,
    em: row.em,
  }
}

function csvColumns(line: string, delimiter: string): string[] {
  const result: string[] = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++ }
      else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      result.push(value.trim())
      value = ''
    } else value += char
  }
  result.push(value.trim())
  return result
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function csvTurnFromTime(value: string): Turno | undefined {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value)
  if (!match || Number(match[1]) > 23) return undefined
  const hour = Number(match[1])
  return hour < 12 ? 'manha' : hour < 18 ? 'tarde' : 'noite'
}

function dataResult(data: unknown): Resultado {
  if (!data || typeof data !== 'object' || !('ok' in data)) {
    throw new Error('Resposta inválida do RPC do Supabase.')
  }
  return data as Resultado
}

export class SupabaseDataSource implements DataSource {
  private readonly client: Client | null
  private readonly channels = new Set<ReturnType<Client['channel']>>()

  constructor(client: Client | null = supabase) {
    this.client = client
  }

  private db(): Client {
    if (!this.client) {
      throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
    }
    return this.client
  }

  async listarUsuarios(): Promise<Usuario[]> {
    const { data, error } = await this.db().from('profiles').select('*').order('nome')
    return obrigar(data, error).map((row) => ({
      id: row.id, nome: row.nome, email: row.email, papel: row.papel, ativo: row.ativo,
    }))
  }

  async obterEscala(data: string): Promise<Escala | undefined> {
    const { data: row, error } = await this.db().from('escalas').select('*').eq('data', data).maybeSingle()
    if (error) throw new Error(`Supabase: ${error.message}`)
    return row ? mapEscala(row) : undefined
  }

  async listarItens(data: string): Promise<ItemDetalhado[]> {
    const escala = await this.obterEscala(data)
    if (!escala) return []
    const { data: itemRows, error: itemError } = await this.db().from('escala_itens')
      .select('*').eq('escala_id', escala.id).is('removido_em', null).order('adicionado_em')
    const items = obrigar(itemRows, itemError)
    if (!items.length) return []
    const itemIds = items.map((row) => row.id)
    const motoristaIds = [...new Set(items.map((row) => row.motorista_id))]
    const [motoristaResult, checkinResult, irregularidadeResult] = await Promise.all([
      this.db().from('motoristas').select('*').in('id', motoristaIds),
      this.db().from('checkins').select('*').in('escala_item_id', itemIds).order('em'),
      this.db().from('irregularidades').select('*').in('escala_item_id', itemIds),
    ])
    const motoristas = new Map(obrigar(motoristaResult.data, motoristaResult.error).map((row) => [row.id, mapMotorista(row)]))
    const checkins = obrigar(checkinResult.data, checkinResult.error).map(mapCheckin)
    const irregularidades = obrigar(irregularidadeResult.data, irregularidadeResult.error).map(mapIrregularidade)
    return items.map((row) => {
      const item = mapItem(row)
      const associated = checkins.filter((checkin) => checkin.escalaItemId === row.id)
      const motorista = motoristas.get(row.motorista_id)
      if (!motorista) throw new Error(`Motorista ${row.motorista_id} não encontrado para item ${row.id}.`)
      return {
        item,
        motorista,
        ...(associated.at(-1) ? { ultimoCheckin: associated.at(-1) } : {}),
        irregularidades: irregularidades.filter((irr) => irr.escalaItemId === row.id),
      }
    })
  }

  async previsualizarPlanilha(csv: string): Promise<PreviaImportacao> {
    const lines = csv.split(/\r?\n/)
    let delimiter: string | undefined
    let indexes: Record<string, number> | undefined
    let headerLine = -1
    for (let lineNumber = 0; lineNumber < lines.length && !indexes; lineNumber++) {
      for (const candidate of [',', ';', '\t']) {
        const fields: Record<string, number> = {}
        csvColumns(lines[lineNumber], candidate).forEach((field, index) => {
          const key = CSV_HEADER_ALIASES[normalizeHeader(field)]
          if (key && fields[key] === undefined) fields[key] = index
        })
        if (fields.driverId !== undefined && fields.nome !== undefined &&
          fields.veiculoModelo !== undefined && fields.placa !== undefined &&
          fields.rota !== undefined && (fields.turno !== undefined || fields.horario !== undefined)) {
          delimiter = candidate
          indexes = fields
          headerLine = lineNumber
          break
        }
      }
    }
    const badFormat = 'Formato CSV não reconhecido. O cabeçalho deve conter ID do driver, nome, veículo, placa, rota e turno.'
    if (!indexes || !delimiter) return { validas: [], invalidas: [], erro: badFormat }

    const seen = new Set<string>()
    const validated: LinhaValidada[] = []
    for (let index = headerLine + 1; index < lines.length; index++) {
      if (!lines[index].trim()) continue
      const columns = csvColumns(lines[index], delimiter)
      const get = (key: string) => columns[indexes![key]] ?? ''
      const driverId = get('driverId')
      const nome = get('nome')
      const veiculoModelo = get('veiculoModelo')
      const veiculoCor = get('veiculoCor')
      const placa = get('placa')
      const rota = get('rota')
      if (![driverId, nome, veiculoModelo, veiculoCor, placa, rota].some(Boolean)) continue
      const errors: string[] = []
      if (!/^(?:SPX\d{4,6}|\d{4,10})$/i.test(driverId)) errors.push('ID do driver inválido')
      if (nome.length < 3) errors.push('Nome ausente ou curto demais')
      if (!veiculoModelo) errors.push('Modelo do veículo ausente')
      if (!CSV_PLATE.test(placa.toUpperCase().replace(/[^A-Z0-9]/g, ''))) errors.push('Placa inválida')
      if (!CSV_ROUTE.test(rota.toUpperCase())) errors.push('Rota fora do padrão (ex: A-15)')
      const turno = get('turno') ? TURNOS[get('turno').toLowerCase()] : csvTurnFromTime(get('horario'))
      if (!turno) errors.push('Turno inválido: informe manha, tarde ou noite, ou um horário válido')
      const duplicateKey = driverId.toUpperCase()
      if (duplicateKey && seen.has(duplicateKey)) errors.push('ID do driver repetido na planilha')
      seen.add(duplicateKey)
      validated.push({
        linha: index + 1, driverId: duplicateKey, nome, veiculoModelo, veiculoCor,
        placa: placa.toUpperCase().replace(/[^A-Z0-9]/g, ''), rota: rota.toUpperCase(),
        turno: turno ?? '', erros: errors,
      })
    }
    if (!validated.length) return { validas: [], invalidas: [], erro: 'Nenhum motorista foi encontrado após o cabeçalho da planilha.' }
    return {
      validas: validated.filter((line) => !line.erros.length),
      invalidas: validated.filter((line) => line.erros.length > 0),
    }
  }

  async importarPlanilha(input: { data: string; linhas: LinhaValidada[]; usuarioId: string }): Promise<void> {
    const linhas = input.linhas.map((line) => ({
      id: novoId('m'), driverId: line.driverId, nome: line.nome, veiculoModelo: line.veiculoModelo,
      veiculoCor: line.veiculoCor, placa: line.placa, rota: line.rota, turno: TURNOS[line.turno],
      itemId: novoId('it'),
    }))
    const { error } = await this.db().rpc('importar_escala', {
      p_id: novoId('esc'), p_data: input.data, p_usuario_id: input.usuarioId, p_linhas: linhas,
    })
    if (error) throw new Error(`Supabase: ${error.message}`)
  }

  async adicionarItemAvulso(input: {
    data: string; usuarioId: string; motorista: Omit<Motorista, 'id'>; rota: string; turno: Turno
  }): Promise<void> {
    const { error } = await this.db().rpc('adicionar_item_avulso', {
      p_escala_id: novoId('esc'), p_escala_data: input.data, p_usuario_id: input.usuarioId,
      p_item_id: novoId('it'), p_motorista_id: novoId('m'),
      p_motorista: input.motorista, p_rota: input.rota.toUpperCase(), p_turno: input.turno,
    })
    if (error) throw new Error(`Supabase: ${error.message}`)
  }

  async editarItem(input: {
    usuarioId: string; escalaItemId: string; motorista: Partial<Omit<Motorista, 'id'>>;
    rota?: string; turno?: Turno
  }): Promise<void> {
    const { error } = await this.db().rpc('editar_item', {
      p_escala_item_id: input.escalaItemId, p_usuario_id: input.usuarioId,
      p_motorista: input.motorista, p_rota: input.rota?.toUpperCase() ?? null, p_turno: input.turno ?? null,
    })
    if (error) throw new Error(`Supabase: ${error.message}`)
  }

  async removerItem(input: { usuarioId: string; escalaItemId: string }): Promise<void> {
    const { error } = await this.db().rpc('remover_item', {
      p_escala_item_id: input.escalaItemId, p_usuario_id: input.usuarioId,
    })
    if (error) throw new Error(`Supabase: ${error.message}`)
  }

  async removerItensDoDia(input: { usuarioId: string; data: string }): Promise<number> {
    const { data, error } = await this.db().rpc('remover_itens_do_dia', {
      p_usuario_id: input.usuarioId, p_data: input.data,
    })
    return obrigar(data, error)
  }

  async registrarCheckin(input: {
    escalaItemId: string; fiscalId: string; resultado: 'conforme' | 'irregular';
    observacao?: string; divergencias?: DivergenciaReportada[]
  }): Promise<{ ok: true; status: import('../../domain/types').StatusItem } | { ok: false; erro: string }> {
    const { data, error } = await this.db().rpc('registrar_checkin', {
      p_id: novoId('chk'), p_escala_item_id: input.escalaItemId, p_fiscal_id: input.fiscalId,
      p_resultado: input.resultado, p_observacao: input.observacao ?? null,
      p_divergencias: (input.divergencias ?? []).map((divergencia) => ({
        id: novoId('irr'), tipo: divergencia.tipo, encontrado: divergencia.encontrado,
      })),
    })
    if (error) throw new Error(`Supabase: ${error.message}`)
    return dataResult(data) as ReturnType<DataSource['registrarCheckin']> extends Promise<infer R> ? R : never
  }

  async resolverBloqueio(input: {
    irregularidadeId: string; usuarioId: string; decisao: 'liberado' | 'mantido_bloqueado'; justificativa: string
  }): Promise<{ ok: true; status: import('../../domain/types').StatusItem } | { ok: false; erro: string }> {
    const { data, error } = await this.db().rpc('resolver_bloqueio', {
      p_id: novoId('lib'), p_irregularidade_id: input.irregularidadeId, p_usuario_id: input.usuarioId,
      p_decisao: input.decisao, p_justificativa: input.justificativa,
    })
    if (error) throw new Error(`Supabase: ${error.message}`)
    return dataResult(data) as ReturnType<DataSource['resolverBloqueio']> extends Promise<infer R> ? R : never
  }

  async listarAlertasAbertos(data: string): Promise<AlertaAberto[]> {
    const escala = await this.obterEscala(data)
    if (!escala) return []
    const { data: itemRows, error: itemError } = await this.db().from('escala_itens')
      .select('*').eq('escala_id', escala.id).is('removido_em', null)
    const items = obrigar(itemRows, itemError)
    if (!items.length) return []
    const itemIds = items.map((item) => item.id)
    const irrResult = await this.db().from('irregularidades').select('*').in('escala_item_id', itemIds)
    const irregularities = obrigar(irrResult.data, irrResult.error)
    if (!irregularities.length) return []
    const irregularityIds = irregularities.map((row) => row.id)
    const [releaseResult, checkinResult, driverResult] = await Promise.all([
      this.db().from('liberacoes').select('irregularidade_id').in('irregularidade_id', irregularityIds),
      this.db().from('checkins').select('*').in('escala_item_id', itemIds),
      this.db().from('motoristas').select('*').in('id', [...new Set(items.map((item) => item.motorista_id))]),
    ])
    const releasedIds = new Set(obrigar(releaseResult.data, releaseResult.error).map((row) => row.irregularidade_id))
    const checkins = new Map(obrigar(checkinResult.data, checkinResult.error).map((row) => [row.id, row]))
    const drivers = new Map(obrigar(driverResult.data, driverResult.error).map((row) => [row.id, mapMotorista(row)]))
    const profileIds = [...new Set([...checkins.values()].map((row) => row.fiscal_id))]
    const profileResult = profileIds.length
      ? await this.db().from('profiles').select('id,nome').in('id', profileIds)
      : { data: [], error: null }
    const profiles = new Map(obrigar(profileResult.data, profileResult.error).map((row) => [row.id, row.nome]))
    const itemMap = new Map(items.map((row) => [row.id, row]))
    const alerts = irregularities.filter((row) => !releasedIds.has(row.id)).map((row) => {
      const item = itemMap.get(row.escala_item_id)
      const checkin = checkins.get(row.checkin_id)
      const motorista = item ? drivers.get(item.motorista_id) : undefined
      if (!item || !checkin || !motorista) throw new Error(`Dados relacionados incompletos para alerta ${row.id}.`)
      return {
        irregularidadeId: row.id, escalaItemId: item.id, tipo: row.tipo, esperado: row.esperado,
        encontrado: row.encontrado, em: checkin.em, fiscalNome: profiles.get(checkin.fiscal_id) ?? 'Desconhecido',
        motorista, rota: item.rota,
      }
    })
    return alerts.sort((a, b) => b.em.localeCompare(a.em))
  }

  async resumoDiario(data: string): Promise<ResumoDiario> {
    const items = (await this.listarItens(data)).map(({ item }) => item)
    const count = (status: EscalaItem['status']) => items.filter((item) => item.status === status).length
    const escalados = items.length
    const pendentes = count('aguardando')
    const conferidos = escalados - pendentes
    const liberados = count('liberado')
    return {
      data, escalados, conferidos, pendentes, bloqueados: count('bloqueado'),
      liberadosComRessalva: count('liberado_com_ressalva'),
      taxaConformidade: conferidos ? Math.round(liberados / conferidos * 100) : 0,
    }
  }

  async conformidadePorHora(data: string): Promise<PontoHora[]> {
    const items = await this.listarItens(data)
    const ids = items.map(({ item }) => item.id)
    const result = new Map<string, PontoHora>()
    for (let hour = 5; hour <= 14; hour++) {
      const key = `${String(hour).padStart(2, '0')}h`
      result.set(key, { hora: key, conformes: 0, irregulares: 0 })
    }
    if (!ids.length) return [...result.values()]
    const { data: rows, error } = await this.db().from('checkins').select('*').in('escala_item_id', ids)
    for (const checkin of obrigar(rows, error)) {
      const key = `${String(new Date(checkin.em).getHours()).padStart(2, '0')}h`
      const bucket = result.get(key)
      if (!bucket) continue
      if (checkin.resultado === 'conforme') bucket.conformes++
      else bucket.irregulares++
    }
    return [...result.values()]
  }

  async irregularidadesPorTipo(data: string): Promise<ContagemTipo[]> {
    const items = await this.listarItens(data)
    const ids = items.map(({ item }) => item.id)
    if (!ids.length) return []
    const { data: rows, error } = await this.db().from('irregularidades').select('tipo').in('escala_item_id', ids)
    const counts = new Map<TipoIrregularidade, number>()
    for (const row of obrigar(rows, error)) counts.set(row.tipo, (counts.get(row.tipo) ?? 0) + 1)
    return [...counts].map(([tipo, total]) => ({ tipo, total })).sort((a, b) => b.total - a.total)
  }

  async historico(dias: number, ate: string): Promise<ResumoDiario[]> {
    const base = new Date(`${ate}T12:00:00`)
    const dates: string[] = []
    for (let offset = dias - 1; offset >= 0; offset--) {
      const date = new Date(base)
      date.setDate(date.getDate() - offset)
      dates.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`)
    }
    return Promise.all(dates.map((date) => this.resumoDiario(date)))
  }

  async listarAuditoria(filtro?: { data?: string; usuarioId?: string }): Promise<(AuditLog & { usuarioNome: string })[]> {
    const rows: DbAuditoria[] = []
    for (let offset = 0; ; offset += 1000) {
      let query = this.db().from('auditoria').select('*').order('em', { ascending: false })
        .range(offset, offset + 999)
      if (filtro?.usuarioId) query = query.eq('usuario_id', filtro.usuarioId)
      if (filtro?.data) {
        const start = `${filtro.data}T00:00:00.000Z`
        const end = `${filtro.data}T23:59:59.999Z`
        query = query.gte('em', start).lte('em', end)
      }
      const { data, error } = await query
      const batch = obrigar(data, error)
      rows.push(...batch)
      if (batch.length < 1000) break
    }
    const logs = rows.map(mapAuditoria)
    if (!logs.length) return []
    const profileIds = [...new Set(logs.map((log) => log.usuarioId))]
    const { data: profiles, error: profileError } = await this.db().from('profiles').select('id,nome').in('id', profileIds)
    const names = new Map(obrigar(profiles, profileError).map((profile) => [profile.id, profile.nome]))
    return logs.map((log) => ({ ...log, usuarioNome: names.get(log.usuarioId) ?? 'Desconhecido' }))
  }

  subscribe(listener: (event: EventoDados) => void): () => void {
    const client = this.db()
    const channel = client.channel(`patio-dados-${novoId('sub')}`)
    const tables = ['profiles', 'motoristas', 'escalas', 'escala_itens', 'checkins', 'irregularidades', 'liberacoes', 'auditoria'] as const
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        listener({ tipo: 'mudanca', em: new Date().toISOString() })
      })
    }
    this.channels.add(channel)
    channel.subscribe()
    return () => {
      this.channels.delete(channel)
      void client.removeChannel(channel)
    }
  }
}
