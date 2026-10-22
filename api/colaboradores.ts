// Função de servidor (Vercel) para o Líder gerenciar colaboradores.
//
// Criar contas e bloquear acessos exige a chave `service_role` do Supabase, que
// jamais pode ir para o navegador. Por isso o frontend chama esta função, e ela:
//   1. valida o token de sessão de quem chamou;
//   2. confere no banco se essa pessoa é um Líder ativo;
//   3. só então usa a chave de administrador.
//
// Hierarquia: Super Admin > Líder > Fiscal/Analista. O Líder cria, desativa, reativa
// e exclui Fiscais, Analistas e outros Líderes; o Super Admin faz o mesmo com todos.
// Ninguém gerencia a si mesmo. O Super Admin não aparece na lista e nunca é alterado
// por aqui (não há ninguém acima dele — essa conta só é criada/alterada direto no
// banco, pelos desenvolvedores).
//
// Mantido em um único arquivo de propósito: a Vercel compila cada arquivo de /api
// de forma isolada, então evitamos imports relativos entre eles.

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

type Papel = 'fiscal' | 'analista' | 'lider' | 'super_admin'
const NIVEL: Record<Papel, number> = { fiscal: 1, analista: 1, lider: 2, super_admin: 3 }

function nivel(papel: unknown): number {
  return typeof papel === 'string' && papel in NIVEL ? NIVEL[papel as Papel] : Infinity
}
// Papéis que `ator` pode atribuir/gerenciar: até o próprio nível, e nunca o Super Admin.
function podeGerenciar(ator: Papel, alvo: unknown): boolean {
  return alvo !== 'super_admin' && nivel(alvo) <= NIVEL[ator]
}

// Tabelas que guardam quem fez o quê. Quem aparece nelas não pode ser excluído:
// apagar a conta quebraria o histórico e a auditoria (nesses casos, desative).
const TABELAS_DE_HISTORICO = [
  ['escalas', 'criada_por'],
  ['escala_itens', 'adicionado_por'],
  ['checkins', 'fiscal_id'],
  ['liberacoes', 'analista_id'],
  ['auditoria', 'usuario_id'],
] as const

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// ~100 anos: o Supabase não tem "banir para sempre", só duração.
const BANIMENTO_LONGO = '876000h'

class ErroHttp extends Error {
  status: number
  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.status = status
  }
}

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function criarAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) {
    throw new ErroHttp(
      500,
      'Servidor sem configuração: defina SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente da Vercel.',
    )
  }
  return createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } })
}

interface Ator {
  id: string
  papel: Papel
}

async function exigirGestor(admin: SupabaseClient, request: Request): Promise<Ator> {
  const cabecalho = request.headers.get('authorization') ?? ''
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : ''
  if (!token) throw new ErroHttp(401, 'Sessão ausente. Entre novamente.')

  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new ErroHttp(401, 'Sessão inválida ou expirada. Entre novamente.')

  const { data: perfil, error: erroPerfil } = await admin
    .from('profiles')
    .select('id, papel, ativo')
    .eq('id', data.user.id)
    .maybeSingle()
  if (erroPerfil) throw new ErroHttp(500, 'Não foi possível verificar suas permissões.')
  if (!perfil || !perfil.ativo || (perfil.papel !== 'lider' && perfil.papel !== 'super_admin')) {
    throw new ErroHttp(403, 'Apenas Líderes e Super Admins ativos podem gerenciar colaboradores.')
  }
  return { id: perfil.id as string, papel: perfil.papel as Papel }
}

async function lerJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const corpo: unknown = await request.json()
    if (corpo && typeof corpo === 'object' && !Array.isArray(corpo)) {
      return corpo as Record<string, unknown>
    }
  } catch {
    // cai no erro abaixo
  }
  throw new ErroHttp(400, 'Corpo da requisição inválido.')
}

function enderecoDoApp(request: Request): string {
  const configurado = process.env.APP_URL?.trim()
  if (configurado) return configurado.replace(/\/+$/, '')
  return request.headers.get('origin') ?? new URL(request.url).origin
}

async function tratar(request: Request, acao: (admin: SupabaseClient, ator: Ator) => Promise<Response>) {
  try {
    const admin = criarAdmin()
    const ator = await exigirGestor(admin, request)
    return await acao(admin, ator)
  } catch (erro) {
    if (erro instanceof ErroHttp) return resposta({ erro: erro.message }, erro.status)
    console.error('colaboradores: erro inesperado', erro)
    return resposta({ erro: 'Erro inesperado no servidor.' }, 500)
  }
}

// Lista todos os perfis, indicando quem ainda não aceitou o convite.
export function GET(request: Request) {
  return tratar(request, async (admin, ator) => {
    const { data: perfis, error } = await admin
      .from('profiles')
      .select('id, nome, email, papel, ativo')
      .neq('papel', 'super_admin') // Super Admin é invisível na lista de colaboradores
      .order('nome', { ascending: true })
    if (error) throw new ErroHttp(500, 'Não foi possível listar os colaboradores.')

    const { data: contas, error: erroContas } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (erroContas) throw new ErroHttp(500, 'Não foi possível listar os colaboradores.')
    const ultimoAcesso = new Map<string, string | null>(
      contas.users.map((u) => [u.id, u.last_sign_in_at ?? null]),
    )

    return resposta({
      meuPapel: ator.papel,
      colaboradores: (perfis ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        email: p.email,
        papel: p.papel,
        ativo: p.ativo,
        convitePendente: !ultimoAcesso.get(p.id),
        gerenciavel: p.id !== ator.id && podeGerenciar(ator.papel, p.papel),
      })),
    })
  })
}

// Cadastra um Fiscal ou Analista e envia o convite por e-mail.
export function POST(request: Request) {
  return tratar(request, async (admin, ator) => {
    const corpo = await lerJson(request)
    const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : ''
    const email = typeof corpo.email === 'string' ? corpo.email.trim().toLowerCase() : ''
    const papel = corpo.papel

    if (nome.length < 2 || nome.length > 100) throw new ErroHttp(400, 'Informe o nome (2 a 100 caracteres).')
    if (!EMAIL_VALIDO.test(email) || email.length > 254) throw new ErroHttp(400, 'Informe um e-mail válido.')
    if (!podeGerenciar(ator.papel, papel)) {
      throw new ErroHttp(
        403,
        'Só é possível cadastrar Líderes, Fiscais e Analistas.',
      )
    }

    const { data: existente, error: erroBusca } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle()
    if (erroBusca) throw new ErroHttp(500, 'Não foi possível verificar o e-mail informado.')
    if (existente) throw new ErroHttp(409, 'Já existe um colaborador com este e-mail.')

    const { data: convite, error: erroConvite } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome },
      redirectTo: `${enderecoDoApp(request)}/definir-senha`,
    })
    if (erroConvite || !convite.user) {
      const jaExiste = erroConvite?.code === 'email_exists' || /already.*registered/i.test(erroConvite?.message ?? '')
      if (jaExiste) throw new ErroHttp(409, 'Já existe uma conta com este e-mail.')
      const limite = erroConvite?.code === 'over_email_send_rate_limit' || /rate limit/i.test(erroConvite?.message ?? '')
      if (limite) {
        throw new ErroHttp(
          429,
          'Limite de e-mails do Supabase atingido. Aguarde cerca de 1 hora ou configure um SMTP próprio no Supabase (Authentication → Emails → SMTP Settings).',
        )
      }
      throw new ErroHttp(502, `Não foi possível enviar o convite: ${erroConvite?.message ?? 'erro desconhecido'}`)
    }

    // O banco cria o perfil como "fiscal" ao nascer a conta; aqui ajustamos o papel.
    const { data: atualizados, error: erroPapel } = await admin
      .from('profiles')
      .update({ papel, nome })
      .eq('id', convite.user.id)
      .select('id')
    if (erroPapel || !atualizados || atualizados.length !== 1) {
      // Sem o papel certo a conta não pode ficar: desfaz para não deixar um acesso errado.
      await admin.auth.admin.deleteUser(convite.user.id)
      throw new ErroHttp(500, 'Não foi possível definir o papel do colaborador. Nada foi cadastrado.')
    }

    return resposta({ id: convite.user.id, email, nome, papel }, 201)
  })
}

// Ativa ou desativa um colaborador. O histórico dele é preservado.
export function PATCH(request: Request) {
  return tratar(request, async (admin, ator) => {
    const corpo = await lerJson(request)
    const id = typeof corpo.id === 'string' ? corpo.id : ''
    const ativo = corpo.ativo
    if (!UUID_VALIDO.test(id) || typeof ativo !== 'boolean') throw new ErroHttp(400, 'Requisição inválida.')
    if (id === ator.id) throw new ErroHttp(400, 'Você não pode desativar o próprio acesso.')

    const { data: alvo, error: erroAlvo } = await admin
      .from('profiles')
      .select('id, papel, ativo')
      .eq('id', id)
      .maybeSingle()
    if (erroAlvo) throw new ErroHttp(500, 'Não foi possível localizar o colaborador.')
    if (!alvo) throw new ErroHttp(404, 'Colaborador não encontrado.')
    if (!podeGerenciar(ator.papel, alvo.papel)) {
      throw new ErroHttp(403, 'Você não tem permissão para alterar esta conta.')
    }
    if (alvo.ativo === ativo) return resposta({ id, ativo })

    async function gravarPerfil() {
      const { data, error } = await admin.from('profiles').update({ ativo }).eq('id', id).select('id')
      if (error || !data || data.length !== 1) {
        throw new ErroHttp(500, 'Não foi possível atualizar o colaborador.')
      }
    }
    async function ajustarBanimento() {
      const { error } = await admin.auth.admin.updateUserById(id, {
        ban_duration: ativo ? 'none' : BANIMENTO_LONGO,
      })
      return error
    }

    if (ativo) {
      // Reativar: libera o login antes de marcar o perfil como ativo.
      if (await ajustarBanimento()) throw new ErroHttp(502, 'Não foi possível reativar o acesso. Tente novamente.')
      await gravarPerfil()
    } else {
      // Desativar: o perfil inativo já bloqueia dados na hora; o banimento impede novos logins.
      await gravarPerfil()
      if (await ajustarBanimento()) {
        throw new ErroHttp(
          502,
          'O colaborador foi desativado e não vê mais os dados, mas não foi possível bloquear o login. Tente desativar de novo.',
        )
      }
    }
    return resposta({ id, ativo })
  })
}

// Exclui definitivamente a conta de um colaborador que nunca teve atividade no
// sistema (ex.: convite enviado por engano). Quem já tem histórico só pode ser
// desativado, para não quebrar check-ins e auditoria.
export function DELETE(request: Request) {
  return tratar(request, async (admin, ator) => {
    const corpo = await lerJson(request)
    const id = typeof corpo.id === 'string' ? corpo.id : ''
    if (!UUID_VALIDO.test(id)) throw new ErroHttp(400, 'Requisição inválida.')
    if (id === ator.id) throw new ErroHttp(400, 'Você não pode excluir a própria conta.')

    const { data: alvo, error: erroAlvo } = await admin
      .from('profiles')
      .select('id, papel')
      .eq('id', id)
      .maybeSingle()
    if (erroAlvo) throw new ErroHttp(500, 'Não foi possível localizar o colaborador.')
    if (!alvo) throw new ErroHttp(404, 'Colaborador não encontrado.')
    if (!podeGerenciar(ator.papel, alvo.papel)) {
      throw new ErroHttp(403, 'Você não tem permissão para excluir esta conta.')
    }

    for (const [tabela, coluna] of TABELAS_DE_HISTORICO) {
      const { count, error } = await admin
        .from(tabela)
        .select('id', { count: 'exact', head: true })
        .eq(coluna, id)
      if (error) throw new ErroHttp(500, 'Não foi possível verificar o histórico do colaborador.')
      if (count) {
        throw new ErroHttp(
          409,
          'Este colaborador tem histórico no sistema e não pode ser excluído. Desative o acesso em vez disso.',
        )
      }
    }

    const { error: erroExclusao } = await admin.auth.admin.deleteUser(id)
    if (erroExclusao) throw new ErroHttp(502, 'Não foi possível excluir a conta. Tente novamente.')
    return resposta({ id })
  })
}
