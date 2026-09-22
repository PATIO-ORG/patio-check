import { useEffect, useRef, useState } from 'react'

/*
 * Andaime temporário: existe só enquanto a paleta está em avaliação. Por isso usa
 * cores neutras próprias (neutral-*), fora dos tokens do produto — tem que ficar
 * legível em cima de qualquer uma das três paletas, inclusive da barra laranja.
 */

const CHAVE = 'patio-check:paleta'

const PALETAS = [
  { id: 'a', nome: 'Asfalto + laranja', frase: 'Barras escuras do pátio, laranja da marca como acento.' },
  { id: 'b', nome: 'Marketplace', frase: 'Tudo claro, barras laranja: o visual dos sistemas da marca.' },
  { id: 'c', nome: 'Navy + laranja', frase: 'Barras navy, tom corporativo de logística.' },
] as const

type IdPaleta = (typeof PALETAS)[number]['id']

function lerPaleta(): IdPaleta {
  try {
    const salva = localStorage.getItem(CHAVE)
    if (PALETAS.some((p) => p.id === salva)) return salva as IdPaleta
  } catch {
    // storage indisponível: fica na padrão
  }
  return 'a'
}

export function SeletorPaleta() {
  const [atual, setAtual] = useState<IdPaleta>(lerPaleta)
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.dataset.paleta = atual
  }, [atual])

  // Fiscal e analista lado a lado trocam juntos.
  useEffect(() => {
    const aoMudar = (e: StorageEvent) => {
      if (e.key === CHAVE) setAtual(lerPaleta())
    }
    window.addEventListener('storage', aoMudar)
    return () => window.removeEventListener('storage', aoMudar)
  }, [])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  function escolher(id: IdPaleta) {
    setAtual(id)
    try {
      localStorage.setItem(CHAVE, id)
    } catch {
      // sem storage, vale só nesta aba
    }
  }

  return (
    <div ref={raiz} className="fixed top-1/2 left-0 z-50 flex -translate-y-1/2 items-center">
      <button
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls="seletor-paleta"
        aria-label={`Paleta de cores: ${atual.toUpperCase()}. Trocar`}
        // No celular a aba cabe inteira na margem lateral de 16px da página, para
        // não cobrir a borda de status dos cartões.
        className="flex w-4 flex-col items-center gap-1 rounded-r-md bg-neutral-900 py-2 text-white shadow-lg ring-1 ring-white/25 sm:w-6 sm:gap-1.5 sm:py-2.5"
      >
        <span className="font-mono text-[8px] font-bold tracking-[0.16em] [writing-mode:vertical-rl] rotate-180 sm:text-[9px]">
          PALETA
        </span>
        <span className="font-mono text-[11px] leading-none font-bold sm:grid sm:size-[18px] sm:place-items-center sm:rounded-sm sm:bg-white sm:text-neutral-900">
          {atual.toUpperCase()}
        </span>
      </button>

      {aberto && (
        <div
          id="seletor-paleta"
          role="radiogroup"
          aria-label="Paleta de cores"
          className="ml-2 w-[272px] rounded-lg bg-neutral-900 p-2 text-white shadow-2xl ring-1 ring-white/20"
        >
          <p className="px-2 pt-1 pb-2 font-mono text-[10px] font-bold tracking-[0.14em] text-neutral-400">
            PALETA EM AVALIAÇÃO
          </p>
          {PALETAS.map((p) => {
            const marcada = atual === p.id
            return (
              <button
                key={p.id}
                role="radio"
                aria-checked={marcada}
                onClick={() => escolher(p.id)}
                className={`flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors ${
                  marcada ? 'bg-white/12 ring-1 ring-white/40' : 'hover:bg-white/6'
                }`}
              >
                {/* As amostras herdam a paleta pelo data-paleta: nenhuma cor repetida aqui. */}
                <span
                  data-paleta={p.id}
                  className="flex h-9 w-12 shrink-0 overflow-hidden rounded ring-1 ring-white/20"
                  aria-hidden="true"
                >
                  <span className="w-1/3 bg-barra" />
                  <span className="w-1/3 bg-destaque" />
                  <span className="w-1/3 bg-fundo" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold">
                    {p.id.toUpperCase()} · {p.nome}
                  </span>
                  <span className="block text-[11px] leading-snug text-neutral-400">{p.frase}</span>
                </span>
              </button>
            )
          })}
          <p className="px-2 pt-2 pb-1 text-[10px] leading-snug text-neutral-500">
            A escolha fica salva neste navegador e vale para todas as abas abertas.
          </p>
        </div>
      )}
    </div>
  )
}
