// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, PATCH, POST } from './colaboradores.ts'

// A função de servidor usa o cliente administrador do Supabase. Aqui ele é trocado
// por uma versão em memória, para testar as regras de autorização sem rede.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => (globalThis as unknown as { __admin: unknown }).__admin,
}))

interface Perfil {
  id: string
  nome: string
  email: string
  papel: string
  ativo: boolean
}

const ID = {
  lider: '00000000-0000-4000-8000-000000000001',
  outroLider: '00000000-0000-4000-8000-000000000002',
  fiscal: '00000000-0000-4000-8000-000000000003',
  analista: '00000000-0000-4000-8000-000000000004',
  novo: '00000000-0000-4000-8000-000000000099',
}

interface Estado {
  perfis: Perfil[]
  tokens: Record<string, string>
  convites: { email: string; opcoes: { data: { nome: string }; redirectTo: string } }[]
  banimentos: { id: string; ban_duration: string }[]
  removidos: string[]
  falhaPapel: boolean
  falhaBanimento: boolean
  emailJaExiste: boolean
}

let estado: Estado

class Consulta {
  private operacao: 'select' | 'update' = 'select'
  private mudanca: Partial<Perfil> = {}
  private filtros: ((p: Perfil) => boolean)[] = []
  private readonly e: Estado

  constructor(e: Estado) {
    this.e = e
  }

  select() {
    return this
  }
  order() {
    return this
  }
  update(mudanca: Partial<Perfil>) {
    this.operacao = 'update'
    this.mudanca = mudanca
    return this
  }
  eq(coluna: keyof Perfil, valor: unknown) {
    this.filtros.push((p) => p[coluna] === valor)
    return this
  }
  ilike(coluna: keyof Perfil, valor: string) {
    this.filtros.push((p) => String(p[coluna]).toLowerCase() === valor.toLowerCase())
    return this
  }
  private executar() {
    const linhas = this.e.perfis.filter((p) => this.filtros.every((f) => f(p)))
    if (this.operacao === 'update') {
      if (this.e.falhaPapel) return { data: null, error: { message: 'falha simulada' } }
      linhas.forEach((p) => Object.assign(p, this.mudanca))
    }
    return { data: linhas.map((p) => ({ ...p })), error: null }
  }
  maybeSingle() {
    const r = this.executar()
    return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error })
  }
  then<T>(resolve: (valor: ReturnType<Consulta['executar']>) => T) {
    return Promise.resolve(this.executar()).then(resolve)
  }
}

function criarAdminFalso(e: Estado) {
  return {
    from: () => new Consulta(e),
    auth: {
      getUser: async (token: string) => {
        const id = e.tokens[token]
        return id
          ? { data: { user: { id } }, error: null }
          : { data: { user: null }, error: { message: 'jwt inválido' } }
      },
      admin: {
        listUsers: async () => ({
          data: {
            users: e.perfis.map((p) => ({
              id: p.id,
              last_sign_in_at: p.id === ID.analista ? null : '2026-10-20T10:00:00Z',
            })),
          },
          error: null,
        }),
        inviteUserByEmail: async (email: string, opcoes: { data: { nome: string }; redirectTo: string }) => {
          if (e.emailJaExiste) return { data: { user: null }, error: { code: 'email_exists', message: 'exists' } }
          e.convites.push({ email, opcoes })
          // O gatilho do banco cria o perfil como fiscal.
          e.perfis.push({ id: ID.novo, nome: opcoes.data.nome, email, papel: 'fiscal', ativo: true })
          return { data: { user: { id: ID.novo } }, error: null }
        },
        deleteUser: async (id: string) => {
          e.removidos.push(id)
          e.perfis = e.perfis.filter((p) => p.id !== id)
          return { error: null }
        },
        updateUserById: async (id: string, atributos: { ban_duration: string }) => {
          if (e.falhaBanimento) return { error: { message: 'falha simulada' } }
          e.banimentos.push({ id, ban_duration: atributos.ban_duration })
          return { error: null }
        },
      },
    },
  }
}

function chamar(
  metodo: typeof GET,
  { token, corpo }: { token?: string; corpo?: unknown } = {},
) {
  return metodo(
    new Request('https://exemplo.test/api/colaboradores', {
      method: metodo.name,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'content-type': 'application/json',
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    }),
  )
}

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://projeto.supabase.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-servidor'
  process.env.APP_URL = 'https://patio.exemplo.test/'
  estado = {
    perfis: [
      { id: ID.lider, nome: 'Lia Líder', email: 'lia@empresa.com', papel: 'lider', ativo: true },
      { id: ID.outroLider, nome: 'Leo Líder', email: 'leo@empresa.com', papel: 'lider', ativo: true },
      { id: ID.fiscal, nome: 'Fábio Fiscal', email: 'fabio@empresa.com', papel: 'fiscal', ativo: true },
      { id: ID.analista, nome: 'Ana Analista', email: 'ana@empresa.com', papel: 'analista', ativo: true },
    ],
    tokens: {
      'token-lider': ID.lider,
      'token-fiscal': ID.fiscal,
      'token-analista': ID.analista,
    },
    convites: [],
    banimentos: [],
    removidos: [],
    falhaPapel: false,
    falhaBanimento: false,
    emailJaExiste: false,
  }
  ;(globalThis as unknown as { __admin: unknown }).__admin = criarAdminFalso(estado)
})

describe('autorização', () => {
  it('recusa quem não enviou sessão', async () => {
    expect((await chamar(GET)).status).toBe(401)
  })

  it('recusa token inválido', async () => {
    expect((await chamar(GET, { token: 'qualquer' })).status).toBe(401)
  })

  it('recusa fiscal e analista, mesmo com sessão válida', async () => {
    expect((await chamar(GET, { token: 'token-fiscal' })).status).toBe(403)
    expect((await chamar(GET, { token: 'token-analista' })).status).toBe(403)
    const r = await chamar(POST, {
      token: 'token-analista',
      corpo: { nome: 'Fulano', email: 'fulano@empresa.com', papel: 'fiscal' },
    })
    expect(r.status).toBe(403)
    expect(estado.convites).toHaveLength(0)
  })

  it('recusa líder desativado', async () => {
    estado.perfis[0].ativo = false
    expect((await chamar(GET, { token: 'token-lider' })).status).toBe(403)
  })

  it('avisa quando o servidor está sem a chave de administrador', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect((await chamar(GET, { token: 'token-lider' })).status).toBe(500)
  })
})

describe('GET: listagem', () => {
  it('lista a equipe e marca convites pendentes e contas gerenciáveis', async () => {
    const r = await chamar(GET, { token: 'token-lider' })
    expect(r.status).toBe(200)
    const { colaboradores } = (await r.json()) as {
      colaboradores: { id: string; convitePendente: boolean; gerenciavel: boolean }[]
    }
    expect(colaboradores).toHaveLength(4)
    const ana = colaboradores.find((c) => c.id === ID.analista)
    expect(ana?.convitePendente).toBe(true)
    expect(ana?.gerenciavel).toBe(true)
    expect(colaboradores.find((c) => c.id === ID.outroLider)?.gerenciavel).toBe(false)
  })
})

describe('POST: cadastrar colaborador', () => {
  it('cadastra um analista, envia o convite e ajusta o papel', async () => {
    const r = await chamar(POST, {
      token: 'token-lider',
      corpo: { nome: ' Nova Pessoa ', email: 'Nova@Empresa.com', papel: 'analista' },
    })
    expect(r.status).toBe(201)
    expect(estado.convites).toHaveLength(1)
    expect(estado.convites[0].email).toBe('nova@empresa.com')
    expect(estado.convites[0].opcoes.redirectTo).toBe('https://patio.exemplo.test/definir-senha')
    const perfil = estado.perfis.find((p) => p.id === ID.novo)
    expect(perfil?.papel).toBe('analista')
    expect(perfil?.nome).toBe('Nova Pessoa')
  })

  it('nunca cria líder por essa rota', async () => {
    const r = await chamar(POST, {
      token: 'token-lider',
      corpo: { nome: 'Fulano', email: 'fulano@empresa.com', papel: 'lider' },
    })
    expect(r.status).toBe(403)
    expect(estado.convites).toHaveLength(0)
  })

  it('valida nome e e-mail', async () => {
    const semNome = await chamar(POST, {
      token: 'token-lider',
      corpo: { nome: ' ', email: 'a@b.com', papel: 'fiscal' },
    })
    const emailRuim = await chamar(POST, {
      token: 'token-lider',
      corpo: { nome: 'Fulano', email: 'sem-arroba', papel: 'fiscal' },
    })
    expect(semNome.status).toBe(400)
    expect(emailRuim.status).toBe(400)
  })

  it('recusa e-mail que já tem colaborador', async () => {
    const r = await chamar(POST, {
      token: 'token-lider',
      corpo: { nome: 'Outro Fábio', email: 'FABIO@empresa.com', papel: 'fiscal' },
    })
    expect(r.status).toBe(409)
    expect(estado.convites).toHaveLength(0)
  })

  it('recusa e-mail que já existe no Supabase Auth', async () => {
    estado.emailJaExiste = true
    const r = await chamar(POST, {
      token: 'token-lider',
      corpo: { nome: 'Fulano', email: 'fulano@empresa.com', papel: 'fiscal' },
    })
    expect(r.status).toBe(409)
  })

  it('desfaz a conta se não conseguir gravar o papel', async () => {
    estado.falhaPapel = true
    const r = await chamar(POST, {
      token: 'token-lider',
      corpo: { nome: 'Fulano', email: 'fulano@empresa.com', papel: 'analista' },
    })
    expect(r.status).toBe(500)
    expect(estado.removidos).toEqual([ID.novo])
  })
})

describe('PATCH: ativar e desativar', () => {
  it('desativa um fiscal e bloqueia o login dele', async () => {
    const r = await chamar(PATCH, { token: 'token-lider', corpo: { id: ID.fiscal, ativo: false } })
    expect(r.status).toBe(200)
    expect(estado.perfis.find((p) => p.id === ID.fiscal)?.ativo).toBe(false)
    expect(estado.banimentos).toEqual([{ id: ID.fiscal, ban_duration: '876000h' }])
  })

  it('reativa um colaborador e libera o login', async () => {
    estado.perfis[2].ativo = false
    const r = await chamar(PATCH, { token: 'token-lider', corpo: { id: ID.fiscal, ativo: true } })
    expect(r.status).toBe(200)
    expect(estado.perfis.find((p) => p.id === ID.fiscal)?.ativo).toBe(true)
    expect(estado.banimentos).toEqual([{ id: ID.fiscal, ban_duration: 'none' }])
  })

  it('não deixa o líder desativar a si mesmo', async () => {
    const r = await chamar(PATCH, { token: 'token-lider', corpo: { id: ID.lider, ativo: false } })
    expect(r.status).toBe(400)
    expect(estado.perfis[0].ativo).toBe(true)
  })

  it('não mexe em outro líder', async () => {
    const r = await chamar(PATCH, { token: 'token-lider', corpo: { id: ID.outroLider, ativo: false } })
    expect(r.status).toBe(403)
    expect(estado.perfis[1].ativo).toBe(true)
  })

  it('trata id inválido e colaborador inexistente', async () => {
    const invalido = await chamar(PATCH, { token: 'token-lider', corpo: { id: 'abc', ativo: false } })
    const inexistente = await chamar(PATCH, {
      token: 'token-lider',
      corpo: { id: '00000000-0000-4000-8000-0000000000aa', ativo: false },
    })
    expect(invalido.status).toBe(400)
    expect(inexistente.status).toBe(404)
  })

  it('informa quando o perfil foi desativado mas o login não pôde ser bloqueado', async () => {
    estado.falhaBanimento = true
    const r = await chamar(PATCH, { token: 'token-lider', corpo: { id: ID.fiscal, ativo: false } })
    expect(r.status).toBe(502)
    expect(estado.perfis.find((p) => p.id === ID.fiscal)?.ativo).toBe(false)
  })
})
