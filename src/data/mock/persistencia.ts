import { criarEstadoInicial, isoDia, type EstadoMock } from './seed'

const CHAVE = 'patio-check:estado'
const CANAL = 'patio-check:mudancas'

interface Envelope {
  gerado: string
  estado: EstadoMock
}

/**
 * O protótipo não tem servidor, mas a demonstração depende de o painel do analista
 * receber na hora o que o fiscal acabou de fazer em outra janela. localStorage
 * guarda o estado compartilhado da origem e o BroadcastChannel avisa as outras
 * abas — é o que, na fase 2, vira o realtime do Supabase.
 */
export function carregarEstado(): EstadoMock {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (bruto) {
      const envelope = JSON.parse(bruto) as Envelope
      // Estado de outro dia não tem escala para hoje: começa de novo.
      if (envelope.gerado === isoDia(0)) return envelope.estado
    }
  } catch {
    // Storage indisponível (janela anônima, cota): segue com estado só em memória.
  }
  const novo = criarEstadoInicial()
  salvarEstado(novo)
  return novo
}

export function salvarEstado(estado: EstadoMock) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ gerado: isoDia(0), estado } satisfies Envelope))
  } catch {
    // Sem persistência, o estado vive só nesta aba.
  }
}

export function limparEstado() {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // nada a fazer
  }
}

export function abrirCanal(): BroadcastChannel | undefined {
  try {
    return new BroadcastChannel(CANAL)
  } catch {
    return undefined
  }
}
