import { describe, expect, it } from 'vitest'
import { registrarCheckin, resolverBloqueio, podeEditarEscala } from './status'

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
