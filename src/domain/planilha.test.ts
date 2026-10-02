import { describe, expect, it } from 'vitest'
import { linhasParaCsv } from './planilha'

describe('linhasParaCsv', () => {
  it('junta as células com vírgula e as linhas com quebra de linha', () => {
    expect(linhasParaCsv([['ID', 'DRIVER'], ['123', 'Ana']])).toBe('ID,DRIVER\n123,Ana')
  })

  it('converte número em texto sem notação científica', () => {
    expect(linhasParaCsv([[1234567, 12.5]])).toBe('1234567,12.5')
  })

  it('deixa células vazias em branco', () => {
    expect(linhasParaCsv([['a', null, undefined, 'b']])).toBe('a,,,b')
  })

  it('coloca entre aspas o que tem vírgula, aspas ou quebra de linha', () => {
    expect(linhasParaCsv([['Silva, Ana', 'diz "oi"', 'a\nb']])).toBe('"Silva, Ana","diz ""oi""","a\nb"')
  })

  it('lê hora de célula formatada como hora (Date) como HH:MM', () => {
    expect(linhasParaCsv([[new Date(Date.UTC(1899, 11, 30, 6, 45))]])).toBe('06:45')
  })

  it('escreve booleano como texto', () => {
    expect(linhasParaCsv([[true, false]])).toBe('true,false')
  })

  it('devolve texto vazio para planilha sem linhas', () => {
    expect(linhasParaCsv([])).toBe('')
  })
})
