import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Usuario } from '../domain/types'
import { USUARIOS } from '../data/mock/seed'
import { supabase } from '../lib/supabase'

// sessionStorage, não localStorage: na demonstração, a janela do fiscal e a do
// analista ficam abertas lado a lado, cada uma com o seu perfil.
const CHAVE = 'patio-check:usuario'

interface Sessao {
  usuario: Usuario | null
  carregando: boolean
  entrar: (id: string) => void
  entrarComSenha: (email: string, senha: string) => Promise<string | null>
  sair: () => void
}

const Ctx = createContext<Sessao>({
  usuario: null,
  carregando: false,
  entrar: () => {},
  entrarComSenha: async () => 'Sessão não configurada.',
  sair: () => {},
})

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    if (supabase) return null
    const salvo = sessionStorage.getItem(CHAVE)
    return USUARIOS.find((u) => u.id === salvo) ?? null
  })
  const [carregando, setCarregando] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    const cliente = supabase
    let ativo = true

    async function atualizarUsuario(usuarioId: string | undefined) {
      if (!usuarioId) {
        if (ativo) setUsuario(null)
        return
      }
      const { data: perfil } = await cliente
        .from('usuarios')
        .select('id, nome, email, papel, ativo')
        .eq('id', usuarioId)
        .eq('ativo', true)
        .single()
      if (ativo) setUsuario(perfil as Usuario | null)
    }

    void cliente.auth.getSession().then(async ({ data }) => {
      await atualizarUsuario(data.session?.user.id)
      if (ativo) setCarregando(false)
    })
    const { data: listener } = cliente.auth.onAuthStateChange((_evento, sessao) => {
      void atualizarUsuario(sessao?.user.id).finally(() => {
        if (ativo) setCarregando(false)
      })
    })
    return () => {
      ativo = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (usuario) sessionStorage.setItem(CHAVE, usuario.id)
    else sessionStorage.removeItem(CHAVE)
  }, [usuario])

  return (
    <Ctx.Provider
      value={{
        usuario,
        carregando,
        entrar: (id) => setUsuario(USUARIOS.find((u) => u.id === id) ?? null),
        entrarComSenha: async (email, senha) => {
          if (!supabase) return 'Supabase não configurado.'
          const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
          return error?.message ?? null
        },
        sair: () => {
          if (supabase) void supabase.auth.signOut()
          setUsuario(null)
        },
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useSessao() {
  return useContext(Ctx)
}
