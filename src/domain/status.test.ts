import { describe, expect, it } from 'vitest'
import { chegouForaDaOnda, registrarCheckin, resolverBloqueio, podeEditarEscala } from './status'

describe('registrarCheckin', () => {
  it('libera o item quando o fiscal confirma que está tudo conforme', () => {
    expect(registrarCheckin('aguardando', 'conforme')).toEqual({
      ok: true,
      status: 'liberado',
    })
  })

  it('bloqueia o item quando o fiscal reporta irregularidade', () => {
    expect(registrarCheckin('aguardando', 'irregular')).toEqual({
      ok: true,
      status: 'bloqueado',
    })
  })

  it('permite reconferir um item já liberado', () => {
    expect(registrarCheckin('liberado', 'irregular')).toEqual({
      ok: true,
      status: 'bloqueado',
    })
  })

  it('permite reconferir um item liberado com ressalva', () => {
    expect(registrarCheckin('liberado_com_ressalva', 'conforme')).toEqual({
      ok: true,
      status: 'liberado',
    })
  })

  it('recusa check-in em item bloqueado — só analista tira do bloqueio', () => {
    const r = registrarCheckin('bloqueado', 'conforme')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/bloqueado/i)
  })
})

describe('resolverBloqueio', () => {
  const base = {
    status: 'bloqueado',
    papel: 'analista',
    decisao: 'liberado',
    justificativa: 'Placa conferida no documento do veículo, erro de digitação na escala.',
  } as const

  it('libera com ressalva quando o analista justifica', () => {
    expect(resolverBloqueio(base)).toEqual({
      ok: true,
      status: 'liberado_com_ressalva',
    })
  })

  it('mantém bloqueado quando o analista decide manter', () => {
    expect(resolverBloqueio({ ...base, decisao: 'mantido_bloqueado' })).toEqual({
      ok: true,
      status: 'bloqueado',
    })
  })

  it('recusa liberação feita por fiscal', () => {
    const r = resolverBloqueio({ ...base, papel: 'fiscal' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/fiscal/i)
  })

  it('recusa liberação feita por líder, que só acompanha', () => {
    const r = resolverBloqueio({ ...base, papel: 'lider' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/analista/i)
  })

  it('recusa liberação sem justificativa', () => {
    const r = resolverBloqueio({ ...base, justificativa: '   ' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/justificativa/i)
  })

  it('recusa justificativa curta demais para servir de registro', () => {
    const r = resolverBloqueio({ ...base, justificativa: 'ok' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/justificativa/i)
  })

  it('recusa resolver item que não está bloqueado', () => {
    const r = resolverBloqueio({ ...base, status: 'aguardando' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/não está bloqueado/i)
  })
})

describe('podeEditarEscala', () => {
  it('permite ao analista', () => {
    expect(podeEditarEscala('analista')).toBe(true)
  })

  it('nega ao líder, que só acompanha', () => {
    expect(podeEditarEscala('lider')).toBe(false)
  })

  it('nega ao fiscal', () => {
    expect(podeEditarEscala('fiscal')).toBe(false)
  })
})

describe('chegouForaDaOnda', () => {
  // Brasília é UTC-3: 09:00Z = 06:00 BRT.
  const chegada = (hhmmBrasilia: string) => {
    const [h, m] = hhmmBrasilia.split(':').map(Number)
    return new Date(Date.UTC(2026, 9, 2, h + 3, m))
  }

  it('dentro da janela: na hora exata da onda', () => {
    expect(chegouForaDaOnda('06:00', chegada('06:00'))).toBe(false)
  })

  it('dentro da janela: no limite da tolerância', () => {
    expect(chegouForaDaOnda('06:00', chegada('06:15'))).toBe(false)
  })

  it('um pouco fora: logo depois da tolerância', () => {
    expect(chegouForaDaOnda('06:00', chegada('06:16'))).toBe(true)
    expect(chegouForaDaOnda('06:00', chegada('06:20'))).toBe(true)
  })

  it('muito fora: três horas depois', () => {
    expect(chegouForaDaOnda('06:00', chegada('09:00'))).toBe(true)
  })

  it('chegar antes da onda não é irregularidade', () => {
    expect(chegouForaDaOnda('06:00', chegada('05:30'))).toBe(false)
    expect(chegouForaDaOnda('06:00', chegada('04:00'))).toBe(false)
  })

  it('usa o horário de Brasília, não o UTC', () => {
    expect(chegouForaDaOnda('06:00', new Date(Date.UTC(2026, 9, 2, 9, 5)))).toBe(false)
    expect(chegouForaDaOnda('06:00', new Date(Date.UTC(2026, 9, 2, 12, 0)))).toBe(true)
  })

  it('horário escalado ausente ou inválido não bloqueia ninguém', () => {
    expect(chegouForaDaOnda('', chegada('12:00'))).toBe(false)
    expect(chegouForaDaOnda('manhã', chegada('12:00'))).toBe(false)
    expect(chegouForaDaOnda('25:00', chegada('12:00'))).toBe(false)
  })
})
