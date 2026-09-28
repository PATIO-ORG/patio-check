import { describe, expect, it } from 'vitest'
import { normalizarPlaca, placaValida } from './placa'

describe('normalizarPlaca', () => {
  it('remove hífen', () => expect(normalizarPlaca('RJK-4E12')).toBe('RJK4E12'))
  it('remove espaço', () => expect(normalizarPlaca('rjk 4e12')).toBe('RJK4E12'))
  it('deixa maiúsculo', () => expect(normalizarPlaca('rjk4e12')).toBe('RJK4E12'))
  it('já normalizada fica igual', () => expect(normalizarPlaca('RJK4E12')).toBe('RJK4E12'))
})

describe('placaValida', () => {
  it('aceita padrão Mercosul', () => expect(placaValida('RJK4E12')).toBe(true))
  it('aceita padrão antigo com hífen', () => expect(placaValida('ABC-1234')).toBe(true))
  it('recusa lixo', () => expect(placaValida('12AB')).toBe(false))
})
