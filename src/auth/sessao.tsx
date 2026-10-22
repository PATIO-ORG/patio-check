import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Usuario } from '../domain/types'
import { USUARIOS } from '../data/mock/seed'
import { MODO_DEMONSTRACAO } from '../data/provider'
import { supabase, supabaseConfigurado } from '../data/supabase/client'

const CHAVE = 'patio-check:usuario'

interface Sessao {
  usuario: Usuario | null
  carregando: boolean
  erro: string
  entrar: (identificador: string, senha?: string) => Promise<void>
  entrarSemSenha: (email: string) => Promise<void>
  sair: () => void
}

const Ctx = createContext<Sessao>({
  usuario: null,
  carregando: true,
  erro: '',
  entrar: async () => {},
  entrarSemSenha: async () => {},
  sair: () => {},
})

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    if (!MODO_DEMONSTRACAO) return null
    const salvo = sessionStorage.getItem(CHAVE)
    return USUARIOS.find((u) => u.id === salvo) ?? null
  })
  const [carregando, setCarregando] = useState(supabaseConfigurado)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (MODO_DEMONSTRACAO) return
    if (!supabase) return

    let ativo = true
    async function carregarUsuario(userId: string | undefined) {
      if (!userId) {
        if (ativo) {
          setUsuario(null)
          setCarregando(false)
        }
        return
      }

      let data
      let erroPerfil
      try {
        const resultado = await supabase!
          .from('profiles')
          .select('id, nome, email, papel, ativo, precisa_senha')
          .eq('id', userId)
          .maybeSingle()
        data = resultado.data
        erroPerfil = resultado.error
      } catch (error) {
        if (ativo) {
          setErro(`Não foi possível carregar seu perfil: ${error instanceof Error ? error.message : String(error)}`)
          setUsuario(null)
          setCarregando(false)
        }
        return
      }

      if (!ativo) return
      if (erroPerfil) {
        setErro(`Não foi possível carregar seu perfil: ${erroPerfil.message}`)
        setUsuario(null)
      } else if (!data || !data.ativo) {
        setErro('Seu usuário não tem um perfil ativo. Peça ao administrador para configurar seu acesso.')
        setUsuario(null)
      } else {
        setErro('')
        setUsuario({
          id: data.id,
          nome: data.nome,
          email: data.email,
          papel: data.papel,
          ativo: data.ativo,
          precisaSenha: data.precisa_senha,
        })
      }
      setCarregando(false)
    }

    void supabase.auth.getSession()
      .then(({ data, error: erroSessao }) => {
        if (erroSessao) setErro(`Não foi possível verificar a sessão: ${erroSessao.message}`)
        return carregarUsuario(data.session?.user.id)
      })
      .catch((error: unknown) => {
        if (ativo) {
          setErro(`Não foi possível verificar a sessão: ${error instanceof Error ? error.message : String(error)}`)
          setCarregando(false)
        }
      })
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setCarregando(true)
      void carregarUsuario(sessao?.user.id)
    })

    return () => {
      ativo = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return (
    <Ctx.Provider
      value={{
        usuario,
        carregando,
        erro,
        entrar: async (identificador, senha) => {
          setErro('')
          if (MODO_DEMONSTRACAO) {
            const conta = USUARIOS.find((u) => u.id === identificador)
            if (!conta) {
              setErro('Perfil de demonstração não encontrado.')
              return
            }
            sessionStorage.setItem(CHAVE, conta.id)
            setUsuario(conta)
            return
          }
          if (!supabase || !senha) {
            setErro('Autenticação não configurada. Verifique as variáveis do Supabase.')
            return
          }
          try {
            const { error: erroLogin } = await supabase.auth.signInWithPassword({
              email: identificador,
              password: senha,
            })
            if (erroLogin) setErro(`Não foi possível entrar: ${erroLogin.message}`)
          } catch (error) {
            setErro(`Não foi possível entrar: ${error instanceof Error ? error.message : String(error)}`)
          }
        },
        // Primeiro acesso / senha redefinida: o servidor confere se a conta está liberada
        // e devolve um token de uso único (sem enviar e-mail) que abre a sessão.
        entrarSemSenha: async (emailInformado) => {
          setErro('')
          if (!supabase) {
            setErro('Autenticação não configurada. Verifique as variáveis do Supabase.')
            return
          }
          try {
            const resposta = await fetch('/api/entrar-sem-senha', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: emailInformado }),
            })
            const json = (await resposta.json().catch(() => null)) as { token_hash?: string; erro?: string } | null
            if (!resposta.ok || !json?.token_hash) {
              setErro(json?.erro ?? 'Não foi possível entrar. Tente de novo.')
              return
            }
            const { error: erroToken } = await supabase.auth.verifyOtp({ token_hash: json.token_hash, type: 'magiclink' })
            if (erroToken) setErro(`Não foi possível entrar: ${erroToken.message}`)
          } catch {
            setErro('Sem conexão com o servidor. Verifique a internet e tente de novo.')
          }
        },
        sair: () => {
          if (MODO_DEMONSTRACAO) {
            sessionStorage.removeItem(CHAVE)
            setUsuario(null)
          } else if (supabase) {
            void supabase.auth.signOut()
              .then(({ error: erroLogout }) => {
                if (erroLogout) setErro(`Não foi possível sair: ${erroLogout.message}`)
              })
              .catch((error: unknown) => {
                setErro(`Não foi possível sair: ${error instanceof Error ? error.message : String(error)}`)
              })
          }
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
