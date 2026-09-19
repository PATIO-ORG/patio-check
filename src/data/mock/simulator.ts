import type { TipoIrregularidade } from '../../domain/types'
import type { MockDataSource } from './MockDataSource'

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const FISCAIS = ['u-fiscal-1', 'u-fiscal-2']
const TIPOS: TipoIrregularidade[] = ['placa', 'placa', 'placa', 'veiculo', 'ocupante', 'id']

/**
 * Gera check-ins de fiscais fictícios enquanto a demonstração está aberta, para
 * que o painel do analista se mova sozinho na frente da diretoria. Não existe
 * na versão com backend real.
 */
export class SimuladorPatio {
  private timer?: ReturnType<typeof setInterval>
  private readonly ds: MockDataSource
  private readonly data: string
  private readonly intervaloMs: number

  constructor(ds: MockDataSource, data: string, intervaloMs = 6000) {
    this.ds = ds
    this.data = data
    this.intervaloMs = intervaloMs
  }

  get rodando() {
    return this.timer !== undefined
  }

  iniciar() {
    if (this.timer) return
    this.timer = setInterval(() => void this.tick(), this.intervaloMs)
  }

  parar() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = undefined
  }

  private async tick() {
    const pendentes = this.ds.itensAguardando(this.data)
    if (pendentes.length === 0) {
      this.parar()
      return
    }

    const item = pendentes[Math.floor(Math.random() * pendentes.length)]
    const fiscalId = FISCAIS[Math.floor(Math.random() * FISCAIS.length)]
    const irregular = Math.random() < 0.22

    if (!irregular) {
      await this.ds.registrarCheckin({ escalaItemId: item.id, fiscalId, resultado: 'conforme' })
      return
    }

    const motorista = this.ds.motoristaDe(item)
    const tipo = TIPOS[Math.floor(Math.random() * TIPOS.length)]
    const encontrado =
      tipo === 'placa'
        ? motorista.placa.slice(0, 4) + LETRAS[Math.floor(Math.random() * 26)] + motorista.placa.slice(5)
        : tipo === 'veiculo'
          ? 'Fiat Fiorino Branco'
          : tipo === 'id'
            ? `SPX${Math.floor(10000 + Math.random() * 89999)}`
            : 'Driver + 1 acompanhante não cadastrado'

    await this.ds.registrarCheckin({
      escalaItemId: item.id,
      fiscalId,
      resultado: 'irregular',
      observacao: 'Registrado pelo simulador de demonstração.',
      divergencias: [{ tipo, encontrado }],
    })
  }
}
