const PLACA_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/
const PLACA_ANTIGA = /^[A-Z]{3}-?\d{4}$/

/** Remove tudo que não é letra ou dígito e deixa maiúsculo — é assim que a placa é
 * guardada e comparada, independente de o fiscal digitar hífen, espaço ou minúsculo. */
export function normalizarPlaca(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function placaValida(v: string): boolean {
  const p = normalizarPlaca(v)
  return PLACA_MERCOSUL.test(p) || PLACA_ANTIGA.test(p)
}
