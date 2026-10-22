// Primeiro acesso sem e-mail. Se a conta está ativa e marcada como `precisa_senha`
// (conta nova, ou senha redefinida pelo Líder), devolve um token de uso único que o
// navegador troca por uma sessão (supabase.auth.verifyOtp). Nenhum e-mail é enviado.
// Depois de entrar, o app obriga a criar uma senha (ver api/minha-senha.ts).
//
// Arquivo isolado de propósito (a Vercel compila cada arquivo de /api separadamente).

import { createClient } from '@supabase/supabase-js'

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NEGADO = 'Este e-mail não está liberado para entrar sem senha. Use e-mail e senha, ou peça ao seu Líder para redefinir.'

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export async function POST(request: Request) {
  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !chave) return resposta({ erro: 'Servidor sem configuração: defina SUPABASE_SERVICE_ROLE_KEY na Vercel.' }, 500)
    const admin = createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } })

    const corpo: unknown = await request.json().catch(() => null)
    const bruto = corpo && typeof corpo === 'object' ? (corpo as Record<string, unknown>).email : undefined
    const email = typeof bruto === 'string' ? bruto.trim().toLowerCase() : ''
    if (!EMAIL_VALIDO.test(email) || email.length > 254) return resposta({ erro: 'Informe um e-mail válido.' }, 400)

    const { data: perfil, error } = await admin
      .from('profiles')
      .select('id, ativo, precisa_senha')
      .ilike('email', email)
      .maybeSingle()
    if (error) return resposta({ erro: 'Não foi possível verificar o e-mail.' }, 500)
    if (!perfil || !perfil.ativo || !perfil.precisa_senha) return resposta({ erro: NEGADO }, 403)

    const { data: link, error: erroLink } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const token = link?.properties?.hashed_token
    if (erroLink || !token) return resposta({ erro: 'Não foi possível liberar o acesso. Tente de novo.' }, 502)
    return resposta({ token_hash: token })
  } catch (erro) {
    console.error('entrar-sem-senha: erro inesperado', erro)
    return resposta({ erro: 'Erro inesperado no servidor.' }, 500)
  }
}
