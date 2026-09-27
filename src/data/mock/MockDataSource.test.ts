import { beforeEach, describe, expect, it } from 'vitest'
import { MockDataSource, placaValida } from './MockDataSource'
import { criarEstadoInicial, isoDia } from './seed'

const HOJE = isoDia(0)

function novo() {
  return new MockDataSource(criarEstadoInicial())
}

describe('placaValida', () => {
  it('aceita padrão Mercosul', () => expect(placaValida('RJK4E12')).toBe(true))
  it('aceita padrão antigo com hífen', () => expect(placaValida('ABC-1234')).toBe(true))
  it('recusa lixo', () => expect(placaValida('12AB')).toBe(false))
})

describe('previsualizarPlanilha', () => {
  const ds = novo()

  it('ignora as linhas iniciais e lê um CSV comum separado por ponto e vírgula', async () => {
    const csv = [
      'DIVISÃO DE TAREFAS,,,,,,,,',
      'FISCAL DE PÁTIO,,,,,,,,',
      'driver_id;nome;veiculo;cor;placa;rota;turno',
      'SPX90001;"Ana; Paula Ribeiro";Fiat Fiorino;Branco;RJK4E12;A-07;manha',
      'SPX90002;Bruno Tavares Lima;Renault Kangoo;Prata;PQD7H45;B-03;tarde',
      ';Motorista sem ID;Moto;Branco;FGH5J21;C-04;noite',
    ].join('\n')

    const previa = await ds.previsualizarPlanilha(csv)
    expect(previa.erro).toBeUndefined()
    expect(previa.validas).toHaveLength(2)
    expect(previa.invalidas).toHaveLength(1)
    expect(previa.invalidas[0].erros.length).toBeGreaterThan(0)
    expect(previa.invalidas[0].linha).toBe(6)
    expect(previa.validas[0]).toMatchObject({
      driverId: 'SPX90001',
      nome: 'Ana; Paula Ribeiro',
      veiculoModelo: 'Fiat Fiorino',
      veiculoCor: 'Branco',
      rota: 'A-07',
      turno: 'manha',
    })
  })

  it('lê CSV separado por vírgulas com cabeçalho e turno derivados do horário', async () => {
    const previa = await ds.previsualizarPlanilha([
      'DIVISÃO DE TAREFAS,,,,',
      'Horário,Letra,ID,Driver Escalado,Tipo,Placa',
      '06:00,A-1,1324707,Ana Paula Ribeiro,MOTO,RJK4E12',
      '13:00,B-3,1324708,"Bruno Tavares, Lima",CARRO,PQD7H45',
    ].join('\n'))

    expect(previa.erro).toBeUndefined()
    expect(previa.validas).toHaveLength(2)
    expect(previa.validas[0]).toMatchObject({
      driverId: '1324707',
      nome: 'Ana Paula Ribeiro',
      veiculoModelo: 'MOTO',
      rota: 'A-1',
      turno: 'manha',
    })
    expect(previa.validas[1]).toMatchObject({
      nome: 'Bruno Tavares, Lima',
      turno: 'tarde',
    })
  })

  it('ignora linhas de horário sem dados de motorista na planilha de impressão', async () => {
    const previa = await ds.previsualizarPlanilha([
      'informação inicial,,,,,,,,',
      'HORÁRIO,LETRA,ID,DRIVER ESCALADO,TIPO,PLACA,Validação,Column 9,Column 1',
      '06:00,A-1,1324707,Ana Paula Ribeiro,MOTO,RJK4E12,,,Não chegou',
      '08:15,,,,,,,,Não chegou',
      '08:15,,,,,,,,Não chegou',
    ].join('\n'))

    expect(previa.erro).toBeUndefined()
    expect(previa.validas).toHaveLength(1)
    expect(previa.invalidas).toHaveLength(0)
  })

  it('recusa arquivos sem cabeçalho CSV de motoristas reconhecível', async () => {
    const previa = await ds.previsualizarPlanilha([
      'instruções;planilha;sem;colunas reconhecidas',
      'apenas dados sem cabeçalho',
    ].join('\n'))

    expect(previa.erro).toMatch(/Formato CSV não reconhecido/)
    expect(previa.validas).toHaveLength(0)
    expect(previa.invalidas).toHaveLength(0)
  })

  it('aponta ID de driver repetido dentro do arquivo', async () => {
    const linha = 'SPX90001,Ana Paula Ribeiro,Fiat Fiorino,Branco,RJK4E12,A-07,manha'
    const previa = await ds.previsualizarPlanilha([
      'driver_id,nome,veiculo,cor,placa,rota,turno',
      linha,
      linha,
    ].join('\n'))
    expect(previa.invalidas[0].erros).toContain('ID do driver repetido na planilha')
  })
})

describe('fluxo de check-in e bloqueio', () => {
  let ds: MockDataSource

  beforeEach(() => {
    ds = novo()
  })

  it('conforme libera o item', async () => {
    const [pendente] = ds.itensAguardando(HOJE)
    const r = await ds.registrarCheckin({
      escalaItemId: pendente.id,
      fiscalId: 'u-fiscal-1',
      resultado: 'conforme',
    })
    expect(r).toEqual({ ok: true, status: 'liberado' })
  })

  it('irregularidade bloqueia o item e abre alerta para o analista', async () => {
    const [pendente] = ds.itensAguardando(HOJE)
    const motorista = ds.motoristaDe(pendente)
    await ds.registrarCheckin({
      escalaItemId: pendente.id,
      fiscalId: 'u-fiscal-1',
      resultado: 'irregular',
      divergencias: [{ tipo: 'placa', encontrado: 'XXX0X00' }],
    })

    const alertas = await ds.listarAlertasAbertos(HOJE)
    const alerta = alertas.find((a) => a.escalaItemId === pendente.id)
    expect(alerta).toBeDefined()
    expect(alerta!.esperado).toBe(motorista.placa)
    expect(alerta!.encontrado).toBe('XXX0X00')
  })

  it('fiscal não consegue reconferir item bloqueado', async () => {
    const [pendente] = ds.itensAguardando(HOJE)
    await ds.registrarCheckin({
      escalaItemId: pendente.id,
      fiscalId: 'u-fiscal-1',
      resultado: 'irregular',
      divergencias: [{ tipo: 'placa', encontrado: 'XXX0X00' }],
    })
    const r = await ds.registrarCheckin({
      escalaItemId: pendente.id,
      fiscalId: 'u-fiscal-1',
      resultado: 'conforme',
    })
    expect(r.ok).toBe(false)
  })

  it('analista libera com justificativa e o alerta sai da fila', async () => {
    const [pendente] = ds.itensAguardando(HOJE)
    await ds.registrarCheckin({
      escalaItemId: pendente.id,
      fiscalId: 'u-fiscal-1',
      resultado: 'irregular',
      divergencias: [{ tipo: 'placa', encontrado: 'XXX0X00' }],
    })
    const alerta = (await ds.listarAlertasAbertos(HOJE)).find(
      (a) => a.escalaItemId === pendente.id,
    )!

    const r = await ds.resolverBloqueio({
      irregularidadeId: alerta.irregularidadeId,
      usuarioId: 'u-analista-1',
      decisao: 'liberado',
      justificativa: 'Placa confere com o documento apresentado; escala desatualizada.',
    })
    expect(r).toEqual({ ok: true, status: 'liberado_com_ressalva' })

    const restantes = await ds.listarAlertasAbertos(HOJE)
    expect(restantes.some((a) => a.irregularidadeId === alerta.irregularidadeId)).toBe(false)
  })

  it('recusa liberação sem justificativa', async () => {
    const [pendente] = ds.itensAguardando(HOJE)
    await ds.registrarCheckin({
      escalaItemId: pendente.id,
      fiscalId: 'u-fiscal-1',
      resultado: 'irregular',
      divergencias: [{ tipo: 'placa', encontrado: 'XXX0X00' }],
    })
    const alerta = (await ds.listarAlertasAbertos(HOJE)).find(
      (a) => a.escalaItemId === pendente.id,
    )!
    const r = await ds.resolverBloqueio({
      irregularidadeId: alerta.irregularidadeId,
      usuarioId: 'u-analista-1',
      decisao: 'liberado',
      justificativa: '',
    })
    expect(r.ok).toBe(false)
  })

  it('fiscal não consegue liberar bloqueio', async () => {
    const [pendente] = ds.itensAguardando(HOJE)
    await ds.registrarCheckin({
      escalaItemId: pendente.id,
      fiscalId: 'u-fiscal-1',
      resultado: 'irregular',
      divergencias: [{ tipo: 'placa', encontrado: 'XXX0X00' }],
    })
    const alerta = (await ds.listarAlertasAbertos(HOJE)).find(
      (a) => a.escalaItemId === pendente.id,
    )!
    const r = await ds.resolverBloqueio({
      irregularidadeId: alerta.irregularidadeId,
      usuarioId: 'u-fiscal-1',
      decisao: 'liberado',
      justificativa: 'Achei que estava tudo certo.',
    })
    expect(r.ok).toBe(false)
  })
})

describe('escala', () => {
  it('driver avulso entra na lista do fiscal marcado como avulso', async () => {
    const ds = novo()
    const antes = (await ds.listarItens(HOJE)).length
    await ds.adicionarItemAvulso({
      data: HOJE,
      usuarioId: 'u-analista-1',
      motorista: {
        driverId: 'SPX99999',
        nome: 'Motorista Adicionado No Turno',
        veiculoModelo: 'Renault Kangoo',
        veiculoCor: 'Branco',
        placa: 'QQQ1Q23',
      },
      rota: 'C-04',
      turno: 'tarde',
    })
    const depois = await ds.listarItens(HOJE)
    expect(depois).toHaveLength(antes + 1)
    expect(depois.at(-1)!.item.avulso).toBe(true)
    expect(depois.at(-1)!.item.status).toBe('aguardando')
  })

  it('remove todos os itens do dia de uma vez e registra cada remoção', async () => {
    const estado = criarEstadoInicial()
    const ds = new MockDataSource(estado)
    const quantidade = (await ds.listarItens(HOJE)).length
    const motoristasAntes = estado.motoristas.length
    const checkinsAntes = estado.checkins.length

    const removidos = await ds.removerItensDoDia({
      usuarioId: 'u-analista-1',
      data: HOJE,
    })

    expect(removidos).toBe(quantidade)
    expect(await ds.listarItens(HOJE)).toHaveLength(0)
    expect(estado.motoristas).toHaveLength(motoristasAntes)
    expect(estado.checkins).toHaveLength(checkinsAntes)
    expect(
      estado.auditoria.filter((log) => log.acao === 'escala.item_removido'),
    ).toHaveLength(quantidade)
  })

  it('toda ação relevante gera registro de auditoria com autor', async () => {
    const ds = novo()
    const [pendente] = ds.itensAguardando(HOJE)
    await ds.registrarCheckin({
      escalaItemId: pendente.id,
      fiscalId: 'u-fiscal-2',
      resultado: 'conforme',
    })
    const logs = await ds.listarAuditoria({ data: HOJE })
    const ultimo = logs[0]
    expect(ultimo.acao).toBe('checkin.registrado')
    expect(ultimo.usuarioNome).toBe('Juliana Prado')
  })
})

describe('resumo e histórico', () => {
  it('resumo do dia fecha a conta de escalados', async () => {
    const ds = novo()
    const r = await ds.resumoDiario(HOJE)
    expect(r.escalados).toBe(r.pendentes + r.conferidos)
    expect(r.taxaConformidade).toBeGreaterThanOrEqual(0)
    expect(r.taxaConformidade).toBeLessThanOrEqual(100)
  })

  it('histórico devolve um ponto por dia, em ordem cronológica', async () => {
    const ds = novo()
    const h = await ds.historico(14, HOJE)
    expect(h).toHaveLength(14)
    expect(h.at(-1)!.data).toBe(HOJE)
    expect(h[0].data < h[1].data).toBe(true)
  })
})

describe('subscribe', () => {
  it('avisa os assinantes a cada mutação', async () => {
    const ds = novo()
    let n = 0
    const off = ds.subscribe(() => n++)
    const [pendente] = ds.itensAguardando(HOJE)
    await ds.registrarCheckin({
      escalaItemId: pendente.id,
      fiscalId: 'u-fiscal-1',
      resultado: 'conforme',
    })
    expect(n).toBe(1)
    off()
    const [outro] = ds.itensAguardando(HOJE)
    await ds.registrarCheckin({
      escalaItemId: outro.id,
      fiscalId: 'u-fiscal-1',
      resultado: 'conforme',
    })
    expect(n).toBe(1)
  })
})
