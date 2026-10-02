export type Celula = string | number | boolean | Date | null | undefined

function celulaParaTexto(celula: Celula): string {
  if (celula === null || celula === undefined) return ''
  if (celula instanceof Date) {
    const hh = String(celula.getUTCHours()).padStart(2, '0')
    const mm = String(celula.getUTCMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }
  const texto = String(celula)
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function linhasParaCsv(linhas: Celula[][]): string {
  return linhas.map((linha) => linha.map(celulaParaTexto).join(',')).join('\n')
}
