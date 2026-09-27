import {
  registrarCheckin as aplicarCheckin,
  resolverBloqueio as aplicarResolucao,
} from '../../domain/status'
import type {
  AcaoAuditavel,
  AuditLog,
  Escala,
  EscalaItem,
  ItemDetalhado,
  Motorista,
  Turno,
} from '../../domain/types'
import type {
  AlertaAberto,
  ContagemTipo,
  DataSource,
  EventoDados,
  LinhaValidada,
  PontoHora,
  PreviaImportacao,
  ResumoDiario,
} from '../DataSource'
import { isoDia, type EstadoMock } from './seed'
import { abrirCanal, carregarEstado, salvarEstado } from './persistencia'

const TURNOS_VALIDOS: Record<string, Turno> = {
  manha: 'manha',
  'manhã': 'manha',
  tarde: 'tarde',
  noite: 'noite',
}

const PLACA_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/
const PLACA_ANTIGA = /^[A-Z]{3}-?\d{4}$/
function turnoDoHorario(horario: string): Turno {
  const hora = Number(horario.split(':')[0])
  if (hora >= 6 && hora < 12) return 'manha'
  if (hora >= 12 && hora < 18) return 'tarde'
  return 'noite'
}

export function normalizarPlaca(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function placaValida(v: string): boolean {
  const p = normalizarPlaca(v)
  return PLACA_MERCOSUL.test(p) || PLACA_ANTIGA.test(p)
}

/**
 * Ids precisam ser únicos entre abas: o estado é compartilhado, então um contador
 * por aba geraria o mesmo id em duas janelas e uma sobrescreveria a outra.
 */
const novoId = (p: string) =>
  `${p}-${crypto.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`

export class MockDataSource implements DataSource {
  private estado: EstadoMock
  private listeners = new Set<(e: EventoDados) => void>()
  private canal?: BroadcastChannel

  /**
   * Sem estado explícito, carrega o compartilhado da origem e passa a ouvir as
   * outras abas — é assim que a janela do analista vê o que o fiscal fez na
   * janela ao lado durante a demonstração.
   */
  constructor(estado?: EstadoMock) {
    if (estado) {
      this.estado = estado
      return
    }
    this.estado = carregarEstado()
    this.canal = abrirCanal()
    if (this.canal) {
      this.canal.onmessage = () => {
        this.estado = carregarEstado()
        this.avisarListeners()
      }
    }
  }

  subscribe(listener: (e: EventoDados) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private avisarListeners() {
    const e: EventoDados = { tipo: 'mudanca', em: new Date().toISOString() }
    for (const l of this.listeners) l(e)
  }

  private notificar() {
    salvarEstado(this.estado)
    if (this.canal) {
      this.canal.postMessage('mudanca')
    }
    this.avisarListeners()
  }

  private log(
    usuarioId: string,
    acao: AcaoAuditavel,
    entidade: string,
    entidadeId: string,
    antes?: unknown,
    depois?: unknown,
  ) {
    const registro: AuditLog = {
      id: novoId('log'),
      usuarioId,
      acao,
      entidade,
      entidadeId,
      antes,
      depois,
      em: new Date().toISOString(),
    }
    this.estado.auditoria.push(registro)
  }

  private escalaDoDia(data: string): Escala | undefined {
    return this.estado.escalas.find((e) => e.data === data)
  }

  private itensDoDia(data: string): EscalaItem[] {
    const escala = this.escalaDoDia(data)
    if (!escala) return []
    return this.estado.itens.filter((i) => i.escalaId === escala.id)
  }

  private detalhar(item: EscalaItem): ItemDetalhado {
    const motorista = this.estado.motoristas.find((m) => m.id === item.motoristaId)!
    const checkinsDoItem = this.estado.checkins
      .filter((c) => c.escalaItemId === item.id)
      .sort((a, b) => a.em.localeCompare(b.em))
    return {
      item,
      motorista,
      ultimoCheckin: checkinsDoItem.at(-1),
      irregularidades: this.estado.irregularidades.filter(
        (i) => i.escalaItemId === item.id,
      ),
    }
  }

  async listarUsuarios() {
    return this.estado.usuarios
  }

  async obterEscala(data: string) {
    return this.escalaDoDia(data)
  }

  async listarItens(data: string): Promise<ItemDetalhado[]> {
    return this.itensDoDia(data).map((i) => this.detalhar(i))
  }

  async previsualizarPlanilha(csv: string): Promise<PreviaImportacao> {
    const linhas = csv.split(/\r?\n/)
    const indiceJdf = linhas.findIndex((l) => {
      const cabecalho = l.toLowerCase()
      return cabecalho.includes('horário') && cabecalho.includes('driver escalado')
    })
    const formatoJdf = indiceJdf >= 0
    const inicio = formatoJdf ? indiceJdf + 1 : 0
    const primeiraLinha = linhas[inicio]?.trim().toLowerCase() ?? ''
    const temCabecalho = !formatoJdf && (primeiraLinha.includes('driver') || primeiraLinha.includes('placa'))
    const corpo = (temCabecalho ? linhas.slice(inicio + 1) : linhas.slice(inicio))
      .map((texto, indice) => ({ texto: texto.trim(), linha: inicio + indice + (temCabecalho ? 2 : 1) }))
      .filter(({ texto }) => texto.length > 0)
    if (corpo.length === 0) return { validas: [], invalidas: [] }

    const vistos = new Set<string>()
    const validadas = corpo.flatMap(({ texto: linhaTexto, linha }) => {
      const col = linhaTexto.split(/[;,\t]/).map((c) => c.trim())
      const [horario = '', letra = '', id = '', nomeJdf = '', tipo = '', placaJdf = ''] = col
      if (formatoJdf && !id && !nomeJdf && !placaJdf) return []
      const driverId = formatoJdf ? id : col[0] ?? ''
      const nome = formatoJdf ? nomeJdf : col[1] ?? ''
      const veiculoModelo = formatoJdf ? tipo : col[2] ?? ''
      const veiculoCor = formatoJdf ? '' : col[3] ?? ''
      const placa = formatoJdf ? placaJdf : col[4] ?? ''
      const rota = formatoJdf ? letra : col[5] ?? ''
      const turno = formatoJdf ? turnoDoHorario(horario) : col[6] ?? ''
      const erros: string[] = []

      if (col.length < 6) erros.push(`Esperadas 7 colunas, encontradas ${col.length}`)
      if (!/^(?:SPX\d{4,6}|\d{3,10})$/i.test(driverId)) erros.push('ID do driver fora do padrão')
      if (nome.length < 3) erros.push('Nome ausente ou curto demais')
      if (!veiculoModelo) erros.push('Modelo do veículo ausente')
      if (!placaValida(placa)) erros.push('Placa inválida')
      if (!/^[A-Z]-\d{1,2}$/.test(rota.toUpperCase())) erros.push('Rota fora do padrão (ex: A-15)')
      if (!TURNOS_VALIDOS[turno.toLowerCase()]) erros.push('Turno deve ser manha, tarde ou noite')

      const chave = driverId.toUpperCase()
      if (chave && vistos.has(chave)) erros.push('ID do driver repetido na planilha')
      vistos.add(chave)

      return {
        linha,
        driverId: driverId.toUpperCase(),
        nome,
        veiculoModelo,
        veiculoCor,
        placa: normalizarPlaca(placa),
        rota: rota.toUpperCase(),
        turno: turno.toLowerCase(),
        erros,
      }
    })

    return {
      validas: validadas.filter((l) => l.erros.length === 0),
      invalidas: validadas.filter((l) => l.erros.length > 0),
    }
  }

  private garantirMotorista(dados: Omit<Motorista, 'id'>): Motorista {
    const existente = this.estado.motoristas.find(
      (m) => m.driverId.toUpperCase() === dados.driverId.toUpperCase(),
    )
    if (existente) {
      Object.assign(existente, dados, { id: existente.id })
      return existente
    }
    const novo: Motorista = { ...dados, id: novoId('m') }
    this.estado.motoristas.push(novo)
    return novo
  }

  private garantirEscala(data: string, usuarioId: string, origem: Escala['origem']): Escala {
    const existente = this.escalaDoDia(data)
    if (existente) return existente
    const nova: Escala = {
      id: novoId('esc'),
      data,
      criadaPor: usuarioId,
      origem,
      criadaEm: new Date().toISOString(),
    }
    this.estado.escalas.push(nova)
    return nova
  }

  async importarPlanilha(input: { data: string; linhas: LinhaValidada[]; usuarioId: string }) {
    const escala = this.garantirEscala(input.data, input.usuarioId, 'planilha')
    const agora = new Date().toISOString()

    for (const l of input.linhas) {
      const motorista = this.garantirMotorista({
        driverId: l.driverId,
        nome: l.nome,
        veiculoModelo: l.veiculoModelo,
        veiculoCor: l.veiculoCor,
        placa: l.placa,
      })
      const jaNaEscala = this.estado.itens.find(
        (i) => i.escalaId === escala.id && i.motoristaId === motorista.id,
      )
      if (jaNaEscala) {
        jaNaEscala.rota = l.rota
        jaNaEscala.turno = TURNOS_VALIDOS[l.turno]
        continue
      }
      this.estado.itens.push({
        id: novoId('it'),
        escalaId: escala.id,
        motoristaId: motorista.id,
        rota: l.rota,
        turno: TURNOS_VALIDOS[l.turno],
        status: 'aguardando',
        adicionadoEm: agora,
        adicionadoPor: input.usuarioId,
        avulso: false,
      })
    }

    this.log(input.usuarioId, 'escala.importada', 'escala', escala.id, undefined, {
      data: input.data,
      linhas: input.linhas.length,
    })
    this.notificar()
  }

  async adicionarItemAvulso(input: {
    data: string
    usuarioId: string
    motorista: Omit<Motorista, 'id'>
    rota: string
    turno: Turno
  }) {
    const escala = this.garantirEscala(input.data, input.usuarioId, 'manual')
    const motorista = this.garantirMotorista(input.motorista)
    const item: EscalaItem = {
      id: novoId('it'),
      escalaId: escala.id,
      motoristaId: motorista.id,
      rota: input.rota.toUpperCase(),
      turno: input.turno,
      status: 'aguardando',
      adicionadoEm: new Date().toISOString(),
      adicionadoPor: input.usuarioId,
      avulso: true,
    }
    this.estado.itens.push(item)
    this.log(input.usuarioId, 'escala.item_adicionado', 'escala_item', item.id, undefined, {
      driverId: motorista.driverId,
      nome: motorista.nome,
      rota: item.rota,
    })
    this.notificar()
  }

  async editarItem(input: {
    usuarioId: string
    escalaItemId: string
    motorista: Partial<Omit<Motorista, 'id'>>
    rota?: string
    turno?: Turno
  }) {
    const item = this.estado.itens.find((i) => i.id === input.escalaItemId)
    if (!item) return
    const motorista = this.estado.motoristas.find((m) => m.id === item.motoristaId)!
    const antes = { ...motorista, rota: item.rota, turno: item.turno }

    Object.assign(motorista, input.motorista)
    if (input.rota) item.rota = input.rota.toUpperCase()
    if (input.turno) item.turno = input.turno

    this.log(input.usuarioId, 'escala.item_editado', 'escala_item', item.id, antes, {
      ...motorista,
      rota: item.rota,
      turno: item.turno,
    })
    this.notificar()
  }

  async removerItem(input: { usuarioId: string; escalaItemId: string }) {
    const idx = this.estado.itens.findIndex((i) => i.id === input.escalaItemId)
    if (idx < 0) return
    const [removido] = this.estado.itens.splice(idx, 1)
    const motorista = this.estado.motoristas.find((m) => m.id === removido.motoristaId)
    this.log(input.usuarioId, 'escala.item_removido', 'escala_item', removido.id, {
      driverId: motorista?.driverId,
      nome: motorista?.nome,
      rota: removido.rota,
    })
    this.notificar()
  }

  async registrarCheckin(input: {
    escalaItemId: string
    fiscalId: string
    resultado: 'conforme' | 'irregular'
    observacao?: string
    divergencias?: { tipo: import('../../domain/types').TipoIrregularidade; encontrado: string }[]
  }) {
    const item = this.estado.itens.find((i) => i.id === input.escalaItemId)
    if (!item) return { ok: false as const, erro: 'Item de escala não encontrado.' }

    const transicao = aplicarCheckin(item.status, input.resultado)
    if (!transicao.ok) return transicao

    const motorista = this.estado.motoristas.find((m) => m.id === item.motoristaId)!
    const agora = new Date().toISOString()
    const checkinId = novoId('chk')

    this.estado.checkins.push({
      id: checkinId,
      escalaItemId: item.id,
      fiscalId: input.fiscalId,
      em: agora,
      resultado: input.resultado,
      observacao: input.observacao,
    })
    this.log(input.fiscalId, 'checkin.registrado', 'escala_item', item.id, { status: item.status }, {
      resultado: input.resultado,
      status: transicao.status,
    })

    for (const d of input.divergencias ?? []) {
      const esperado =
        d.tipo === 'placa' ? motorista.placa
        : d.tipo === 'veiculo' ? `${motorista.veiculoModelo} ${motorista.veiculoCor}`
        : d.tipo === 'nome' ? motorista.nome
        : d.tipo === 'id' ? motorista.driverId
        : 'Somente o driver'
      const irregId = novoId('irr')
      this.estado.irregularidades.push({
        id: irregId,
        checkinId,
        escalaItemId: item.id,
        tipo: d.tipo,
        esperado,
        encontrado: d.encontrado,
      })
      this.log(input.fiscalId, 'irregularidade.reportada', 'irregularidade', irregId, undefined, {
        tipo: d.tipo,
        esperado,
        encontrado: d.encontrado,
      })
    }

    item.status = transicao.status
    this.notificar()
    return transicao
  }

  async resolverBloqueio(input: {
    irregularidadeId: string
    usuarioId: string
    decisao: 'liberado' | 'mantido_bloqueado'
    justificativa: string
  }) {
    const irreg = this.estado.irregularidades.find((i) => i.id === input.irregularidadeId)
    if (!irreg) return { ok: false as const, erro: 'Irregularidade não encontrada.' }
    const item = this.estado.itens.find((i) => i.id === irreg.escalaItemId)
    if (!item) return { ok: false as const, erro: 'Item de escala não encontrado.' }
    const usuario = this.estado.usuarios.find((u) => u.id === input.usuarioId)
    if (!usuario) return { ok: false as const, erro: 'Usuário não encontrado.' }

    const transicao = aplicarResolucao({
      status: item.status,
      papel: usuario.papel,
      decisao: input.decisao,
      justificativa: input.justificativa,
    })
    if (!transicao.ok) return transicao

    this.estado.liberacoes.push({
      id: novoId('lib'),
      irregularidadeId: irreg.id,
      analistaId: usuario.id,
      em: new Date().toISOString(),
      justificativa: input.justificativa,
      decisao: input.decisao,
    })
    this.log(
      usuario.id,
      input.decisao === 'liberado' ? 'bloqueio.liberado' : 'bloqueio.mantido',
      'irregularidade',
      irreg.id,
      { status: item.status },
      { status: transicao.status, justificativa: input.justificativa },
    )

    item.status = transicao.status
    this.notificar()
    return transicao
  }

  async listarAlertasAbertos(data: string): Promise<AlertaAberto[]> {
    const itens = this.itensDoDia(data)
    const resolvidas = new Set(this.estado.liberacoes.map((l) => l.irregularidadeId))

    return this.estado.irregularidades
      .filter((irr) => !resolvidas.has(irr.id))
      .filter((irr) => itens.some((i) => i.id === irr.escalaItemId))
      .map((irr) => {
        const item = itens.find((i) => i.id === irr.escalaItemId)!
        const checkin = this.estado.checkins.find((c) => c.id === irr.checkinId)!
        const fiscal = this.estado.usuarios.find((u) => u.id === checkin.fiscalId)
        return {
          irregularidadeId: irr.id,
          escalaItemId: item.id,
          tipo: irr.tipo,
          esperado: irr.esperado,
          encontrado: irr.encontrado,
          em: checkin.em,
          fiscalNome: fiscal?.nome ?? 'Desconhecido',
          motorista: this.estado.motoristas.find((m) => m.id === item.motoristaId)!,
          rota: item.rota,
        }
      })
      .sort((a, b) => b.em.localeCompare(a.em))
  }

  async resumoDiario(data: string): Promise<ResumoDiario> {
    const itens = this.itensDoDia(data)
    const por = (s: EscalaItem['status']) => itens.filter((i) => i.status === s).length
    const escalados = itens.length
    const pendentes = por('aguardando')
    const conferidos = escalados - pendentes
    const liberados = por('liberado')
    return {
      data,
      escalados,
      conferidos,
      pendentes,
      bloqueados: por('bloqueado'),
      liberadosComRessalva: por('liberado_com_ressalva'),
      taxaConformidade: conferidos === 0 ? 0 : Math.round((liberados / conferidos) * 100),
    }
  }

  async conformidadePorHora(data: string): Promise<PontoHora[]> {
    const itens = new Set(this.itensDoDia(data).map((i) => i.id))
    const balde = new Map<string, PontoHora>()
    for (let h = 5; h <= 14; h++) {
      const hora = `${String(h).padStart(2, '0')}h`
      balde.set(hora, { hora, conformes: 0, irregulares: 0 })
    }
    for (const c of this.estado.checkins) {
      if (!itens.has(c.escalaItemId)) continue
      const hora = `${new Date(c.em).getHours().toString().padStart(2, '0')}h`
      const p = balde.get(hora)
      if (!p) continue
      if (c.resultado === 'conforme') p.conformes++
      else p.irregulares++
    }
    return [...balde.values()]
  }

  async irregularidadesPorTipo(data: string): Promise<ContagemTipo[]> {
    const itens = new Set(this.itensDoDia(data).map((i) => i.id))
    const contagem = new Map<ContagemTipo['tipo'], number>()
    for (const irr of this.estado.irregularidades) {
      if (!itens.has(irr.escalaItemId)) continue
      contagem.set(irr.tipo, (contagem.get(irr.tipo) ?? 0) + 1)
    }
    return [...contagem.entries()]
      .map(([tipo, total]) => ({ tipo, total }))
      .sort((a, b) => b.total - a.total)
  }

  async historico(dias: number, ate: string): Promise<ResumoDiario[]> {
    const base = new Date(`${ate}T12:00:00`)
    const out: ResumoDiario[] = []
    for (let i = dias - 1; i >= 0; i--) {
      out.push(await this.resumoDiario(isoDia(i, base)))
    }
    return out
  }

  async listarAuditoria(filtro?: { data?: string; usuarioId?: string }) {
    return this.estado.auditoria
      .filter((l) => (filtro?.data ? l.em.slice(0, 10) === filtro.data : true))
      .filter((l) => (filtro?.usuarioId ? l.usuarioId === filtro.usuarioId : true))
      .map((l) => ({
        ...l,
        usuarioNome:
          this.estado.usuarios.find((u) => u.id === l.usuarioId)?.nome ?? 'Desconhecido',
      }))
      .sort((a, b) => b.em.localeCompare(a.em))
  }

  /** Usado apenas pelo simulador de demonstração. */
  itensAguardando(data: string): EscalaItem[] {
    return this.itensDoDia(data).filter((i) => i.status === 'aguardando')
  }

  motoristaDe(item: EscalaItem): Motorista {
    return this.estado.motoristas.find((m) => m.id === item.motoristaId)!
  }
}
