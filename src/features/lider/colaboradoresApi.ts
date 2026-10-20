import { supabase } from '../../data/supabase/client'

export type PapelColaborador = 'fiscal' | 'analista'

export interface Colaborador {
  id: string
  nome: string
  email: string
  papel: 'fiscal' | 'analista' | 'lider'
  ativo: boolean
  convitePendente: boolean
  gerenciavel: boolean
}

async function chamar<T>(metodo: 'GET' | 'POST' | 'PATCH', corpo?: unknown): Promise<T> {
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

export async function listarColaboradores(): Promise<Colaborador[]> {
  const { colaboradores } = await chamar<{ colaboradores: Colaborador[] }>('GET')
  return colaboradores
}

export function convidarColaborador(dados: { nome: string; email: string; papel: PapelColaborador }) {
  return chamar<{ id: string }>('POST', dados)
}

export function alterarAcesso(id: string, ativo: boolean) {
  return chamar<{ id: string; ativo: boolean }>('PATCH', { id, ativo })
}
