import { linhasParaCsv, type Celula } from '../../domain/planilha'

const EXTENSAO_EXCEL = /\.xlsx$/i

export function ehExcel(arquivo: File): boolean {
  return EXTENSAO_EXCEL.test(arquivo.name)
}

export async function lerPlanilhaComoCsv(arquivo: File): Promise<string> {
  if (!ehExcel(arquivo)) return arquivo.text()
  const { readSheet } = await import('read-excel-file/browser')
  return linhasParaCsv((await readSheet(arquivo)) as Celula[][])
}
