import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Usuario } from '../domain/types'
import { USUARIOS } from '../data/mock/seed'

// sessionStorage, não localStorage: na demonstração, a janela do fiscal e a do
// analista ficam abertas lado a lado, cada uma com o seu perfil.
const CHAVE = 'patio-check:usuario'

interface Sessao {
  usuario: Usuario | null
  entrar: (id: string) => void
  sair: () => void
}

const Ctx = createContext<Sessao>({ usuario: null, entrar: () => {}, sair: () => {} })

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const salvo = sessionStorage.getItem(CHAVE)
    return USUARIOS.find((u) => u.id === salvo) ?? null
  })

  useEffect(() => {
    if (usuario) sessionStorage.setItem(CHAVE, usuario.id)
    else sessionStorage.removeItem(CHAVE)
  }, [usuario])

  return (
    <Ctx.Provider
      value={{
        usuario,
        entrar: (id) => setUsuario(USUARIOS.find((u) => u.id === id) ?? null),
        sair: () => setUsuario(null),
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useSessao() {
  return useContext(Ctx)
}
