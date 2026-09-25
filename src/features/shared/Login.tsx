import { useState, type FormEvent } from 'react'
import { useSessao } from '../../auth/sessao'
import { USUARIOS } from '../../data/mock/seed'
import { supabaseConfigurado } from '../../lib/supabase'
import { Placa } from './Placa'

const DESCRICAO: Record<string, string> = {
  fiscal: 'Confere drivers na chegada e reporta divergência.',
  analista: 'Sobe a escala, resolve bloqueios e acompanha o painel.',
  lider: 'Acompanha painel e relatórios, sem editar escala.',
}

export function Login() {
  const { entrar, entrarComSenha } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function entrarComSupabase(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setCarregando(true)
    setErro(await entrarComSenha(email, senha))
    setCarregando(false)
  }

  return (
    <main className="min-h-dvh bg-asfalto text-concreto">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-4 py-12 sm:px-8">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="rotulo text-demarcacao">Fiscalização de pátio</p>
            <h1 className="mt-2 font-display text-4xl leading-[1.05] font-extrabold sm:text-5xl">
              Controle
              <br />
              de Pátio
            </h1>
            <p className="mt-4 max-w-md text-sm text-brita-2">
              Substitui a folha impressa de conferência: a escala atualiza em tempo real, a
              divergência sobe na hora para o analista e o dia inteiro fica registrado.
            </p>
          </div>
          <Placa valor="RJK4E12" tamanho="lg" />
        </div>

        {supabaseConfigurado ? (
          <form onSubmit={entrarComSupabase} className="max-w-md space-y-3">
            <label className="block text-sm font-semibold" htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              className="w-full rounded-lg border border-asfalto-3 bg-asfalto-2 px-3 py-2 text-concreto outline-none focus:border-demarcacao"
            />
            <label className="block text-sm font-semibold" htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              required
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              className="w-full rounded-lg border border-asfalto-3 bg-asfalto-2 px-3 py-2 text-concreto outline-none focus:border-demarcacao"
            />
            {erro && <p className="text-sm text-sinal">{erro}</p>}
            <button
              type="submit"
              disabled={carregando}
              className="rounded-lg bg-demarcacao px-4 py-2 font-display font-bold text-asfalto disabled:opacity-50"
            >
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : null}

        {!supabaseConfigurado && <div className="mb-3 flex items-center gap-3">
          <p className="rotulo text-brita-2">Entrar como</p>
          <span className="h-px flex-1 bg-asfalto-3" />
        </div>}

        {!supabaseConfigurado && <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {USUARIOS.map((u) => (
            <li key={u.id}>
              <button
                onClick={() => entrar(u.id)}
                className="group flex w-full flex-col items-start gap-1 rounded-lg border border-asfalto-3 bg-asfalto-2 p-4 text-left transition-colors hover:border-demarcacao"
              >
                <span className="rotulo text-demarcacao">{u.papel}</span>
                <span className="font-display text-lg font-bold">{u.nome}</span>
                <span className="text-[13px] leading-snug text-brita-2">
                  {DESCRICAO[u.papel]}
                </span>
              </button>
            </li>
          ))}
        </ul>}

        <aside className="mt-10 overflow-hidden rounded-chip border border-asfalto-3">
          <span className="zebra-alerta block h-2" aria-hidden="true" />
          <p className="bg-asfalto-2 px-4 py-3 text-[13px] text-brita-2">
            {supabaseConfigurado ? (
              'Autenticação fornecida pelo Supabase. Seu acesso e permissões são definidos no servidor.'
            ) : (
              <><strong className="font-display font-bold text-concreto">Protótipo de demonstração.</strong>{' '}
              Os dados são fictícios e não há senha — o login serve só para escolher o perfil.</>
            )}
          </p>
        </aside>
      </div>
    </main>
  )
}
