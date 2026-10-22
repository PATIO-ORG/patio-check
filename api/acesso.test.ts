// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as entrarSemSenha } from './entrar-sem-senha.ts'
import { POST as minhaSenha } from './minha-senha.ts'

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => (globalThis as unknown as { __admin: unknown }).__admin,
}))

interface Perfil { id: string; email: string; ativo: boolean; precisa_senha: boolean }
const A = '00000000-0000-4000-8000-0000000000a1'
const B = '00000000-0000-4000-8000-0000000000b2'
const C = '00000000-0000-4000-8000-0000000000c3'
let perfis: Perfil[]
let senhas: Record<string, string>
let links: string[]

function admin() {
  return {
    from: () => {
      let filtro: (p: Perfil) => boolean = () => true
      let mudanca: Partial<Perfil> | null = null
      const q = {
        select: () => q,
        update: (m: Partial<Perfil>) => { mudanca = m; return q },
        ilike: (_c: string, v: string) => { filtro = (p) => p.email.toLowerCase() === v.toLowerCase(); return q },
        eq: (_c: string, v: string) => { filtro = (p) => p.id === v; return q },
        maybeSingle: () => Promise.resolve({ data: perfis.find(filtro) ?? null, error: null }),
        then: (resolve: (v: unknown) => unknown) => {
          const linhas = perfis.filter(filtro)
          if (mudanca) linhas.forEach((p) => Object.assign(p, mudanca))
          return Promise.resolve({ data: linhas, error: null }).then(resolve)
        },
      }
      return q
    },
    auth: {
      getUser: async (token: string) => (token === 'tk-b' ? { data: { user: { id: B } }, error: null } : token === 'tk-c' ? { data: { user: { id: C } }, error: null } : { data: { user: null }, error: { message: 'x' } }),
      admin: {
        generateLink: async ({ email }: { email: string }) => { links.push(email); return { data: { properties: { hashed_token: 'hash-' + email } }, error: null } },
        updateUserById: async (id: string, a: { password: string }) => { senhas[id] = a.password; return { error: null } },
      },
    },
  }
}

function req(corpo: unknown, token?: string) {
  return new Request('https://x.test/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo),
  })
}

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://p.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'k'
  perfis = [
    { id: A, email: 'ativa@e.com', ativo: true, precisa_senha: false },
    { id: B, email: 'nova@e.com', ativo: true, precisa_senha: true },
    { id: C, email: 'off@e.com', ativo: false, precisa_senha: true },
  ]
  senhas = {}
  links = []
  ;(globalThis as unknown as { __admin: unknown }).__admin = admin()
})

describe('entrar sem senha', () => {
  it('libera quem está marcado para primeiro acesso, sem enviar e-mail', async () => {
    const r = await entrarSemSenha(req({ email: ' Nova@E.com ' }))
    expect(r.status).toBe(200)
    expect(((await r.json()) as { token_hash: string }).token_hash).toBe('hash-nova@e.com')
  })
  it('recusa quem já tem senha, desativado, desconhecido ou e-mail inválido', async () => {
    expect((await entrarSemSenha(req({ email: 'ativa@e.com' }))).status).toBe(403)
    expect((await entrarSemSenha(req({ email: 'off@e.com' }))).status).toBe(403)
    expect((await entrarSemSenha(req({ email: 'zzz@e.com' }))).status).toBe(403)
    expect((await entrarSemSenha(req({ email: 'sem-arroba' }))).status).toBe(400)
    expect(links).toEqual([])
  })
})

describe('definir a própria senha', () => {
  it('salva a senha e desliga a marca de primeiro acesso', async () => {
    const r = await minhaSenha(req({ senha: 'umasenhaboa1' }, 'tk-b'))
    expect(r.status).toBe(200)
    expect(senhas[B]).toBe('umasenhaboa1')
    expect(perfis[1].precisa_senha).toBe(false)
  })
  it('só funciona uma vez: depois exige outro fluxo', async () => {
    perfis[1].precisa_senha = false
    expect((await minhaSenha(req({ senha: 'umasenhaboa1' }, 'tk-b'))).status).toBe(409)
    expect(senhas[B]).toBe(undefined)
  })
  it('valida sessão, senha curta e conta inativa', async () => {
    expect((await minhaSenha(req({ senha: 'umasenhaboa1' }))).status).toBe(401)
    expect((await minhaSenha(req({ senha: 'umasenhaboa1' }, 'tk-zz'))).status).toBe(401)
    expect((await minhaSenha(req({ senha: 'curta' }, 'tk-b'))).status).toBe(400)
    expect((await minhaSenha(req({ senha: 'umasenhaboa1' }, 'tk-c'))).status).toBe(403)
  })
})
