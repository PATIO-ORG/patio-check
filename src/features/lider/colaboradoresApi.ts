import { supabase } from '../../data/supabase/client'

export type PapelColaborador = 'fiscal' | 'analista' | 'lider'

export interface Colaborador {
  id: string
  nome: string
  email: string
  papel: 'fiscal' | 'analista' | 'lider' | 'super_admin'
  ativo: boolean
  aguardandoSenha: boolean
  gerenciavel: boolean
}

async function chamar<T>(metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT', corpo?: unknown): Promise<T> {
  if (!supabase) throw new Error('Autenticação não configurada.')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada. Entre novamente.')

  let resposta: Response
  try {
    resposta = await fetch('/api/colaboradores', {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    })
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.')
  }

  const json: unknown = await resposta.json().catch(() => null)
  if (!resposta.ok) {
    const erro = (json as { erro?: unknown } | null)?.erro
    throw new Error(
      typeof erro === 'string'
        ? erro
        : 'O servidor de gestão de colaboradores não respondeu. Em desenvolvimento local use "vercel dev".',
    )
  }
  return json as T
}

export async function listarColaboradores() {
  return chamar<{ colaboradores: Colaborador[]; meuPapel: 'lider' | 'super_admin' }>('GET')
}

export function convidarColaborador(dados: { nome: string; email: string; papel: PapelColaborador }) {
  return chamar<{ id: string }>('POST', dados)
}

export function alterarAcesso(id: string, ativo: boolean) {
  return chamar<{ id: string; ativo: boolean }>('PATCH', { id, ativo })
}

export function excluirColaborador(id: string) {
  return chamar<{ id: string }>('DELETE', { id })
}

export function redefinirSenha(id: string) {
  return chamar<{ id: string }>('PUT', { id })
}
