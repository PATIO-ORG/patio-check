// Define a senha de quem acabou de entrar pelo primeiro acesso (ou após redefinição
// pelo Líder). Só funciona enquanto o perfil estiver marcado como `precisa_senha`:
// depois disso a flag é desligada e a troca de senha passa a exigir outro fluxo.
//
// Arquivo isolado de propósito (a Vercel compila cada arquivo de /api separadamente).

import { createClient } from '@supabase/supabase-js'

const SENHA_MINIMA = 8
const SENHA_MAXIMA = 72

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

    const cabecalho = request.headers.get('authorization') ?? ''
    const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : ''
    if (!token) return resposta({ erro: 'Sessão ausente. Entre novamente.' }, 401)
    const { data: sessao, error: erroSessao } = await admin.auth.getUser(token)
    if (erroSessao || !sessao.user) return resposta({ erro: 'Sessão inválida ou expirada. Entre novamente.' }, 401)

    const corpo: unknown = await request.json().catch(() => null)
    const bruta = corpo && typeof corpo === 'object' ? (corpo as Record<string, unknown>).senha : undefined
    const senha = typeof bruta === 'string' ? bruta : ''
    if (senha.length < SENHA_MINIMA || senha.length > SENHA_MAXIMA) {
      return resposta({ erro: `A senha precisa ter entre ${SENHA_MINIMA} e ${SENHA_MAXIMA} caracteres.` }, 400)
    }

    const { data: perfil, error: erroPerfil } = await admin
      .from('profiles')
      .select('id, ativo, precisa_senha')
      .eq('id', sessao.user.id)
      .maybeSingle()
    if (erroPerfil) return resposta({ erro: 'Não foi possível verificar seu perfil.' }, 500)
    if (!perfil || !perfil.ativo) return resposta({ erro: 'Conta inativa.' }, 403)
    if (!perfil.precisa_senha) return resposta({ erro: 'Sua senha já foi definida.' }, 409)

    const { error: erroSenha } = await admin.auth.admin.updateUserById(perfil.id as string, { password: senha })
    if (erroSenha) return resposta({ erro: 'Não foi possível salvar a senha. Tente outra senha.' }, 502)
    const { data: atualizados, error: erroFlag } = await admin
      .from('profiles')
      .update({ precisa_senha: false })
      .eq('id', perfil.id)
      .select('id')
    if (erroFlag || !atualizados || atualizados.length !== 1) {
      return resposta({ erro: 'A senha foi salva, mas não foi possível concluir. Tente de novo.' }, 500)
    }
    return resposta({ ok: true })
  } catch (erro) {
    console.error('minha-senha: erro inesperado', erro)
    return resposta({ erro: 'Erro inesperado no servidor.' }, 500)
  }
}
