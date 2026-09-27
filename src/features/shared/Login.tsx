import { useState } from 'react'
import { useSessao } from '../../auth/sessao'
import { USUARIOS } from '../../data/mock/seed'
import { MODO_DEMONSTRACAO } from '../../data/provider'
import { supabaseConfigurado } from '../../data/supabase/client'
import { Placa } from './Placa'

const DESCRICAO: Record<string, string> = {
  fiscal: 'Confere drivers na chegada e reporta divergência.',
  analista: 'Sobe a escala, resolve bloqueios e acompanha o painel.',
  lider: 'Acompanha painel e relatórios, sem editar escala.',
}

export function Login() {
  const { entrar, erro } = useSessao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  if (!MODO_DEMONSTRACAO && !supabaseConfigurado) {
    return (
      <main className="grid min-h-dvh place-items-center bg-asfalto px-5 text-concreto">
        <div className="max-w-lg rounded-lg border border-asfalto-3 bg-asfalto-2 p-6">
          <h1 className="font-display text-2xl font-extrabold">Sistema ainda não configurado</h1>
          <p className="mt-3 text-sm text-brita-2">
            Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente da Vercel e execute o
            script de configuração do banco Supabase.
          </p>
        </div>
      </main>
    )
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

        <div className="mb-3 flex items-center gap-3">
          <p className="rotulo text-brita-2">{MODO_DEMONSTRACAO ? 'Entrar como' : 'Entrar'}</p>
          <span className="h-px flex-1 bg-asfalto-3" />
        </div>

        {MODO_DEMONSTRACAO ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {USUARIOS.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => void entrar(u.id)}
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
          </ul>
        ) : (
          <form
            className="grid max-w-md gap-4 rounded-lg border border-asfalto-3 bg-asfalto-2 p-5"
            onSubmit={(event) => {
              event.preventDefault()
              void entrar(email, senha)
            }}
          >
            <label className="grid gap-1.5 text-sm">
              E-mail
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-chip border border-asfalto-3 bg-asfalto px-3 py-2.5 text-concreto"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              Senha
              <input
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                className="rounded-chip border border-asfalto-3 bg-asfalto px-3 py-2.5 text-concreto"
              />
            </label>
            {erro && <p role="alert" className="text-sm font-semibold text-demarcacao">{erro}</p>}
            <button
              type="submit"
              className="rounded-chip bg-demarcacao px-4 py-3 font-display font-bold text-asfalto"
            >
              Entrar
            </button>
          </form>
        )}

        <aside className="mt-10 overflow-hidden rounded-chip border border-asfalto-3">
          <span className="zebra-alerta block h-2" aria-hidden="true" />
          <p className="bg-asfalto-2 px-4 py-3 text-[13px] text-brita-2">
            {MODO_DEMONSTRACAO ? (
              <>
                <strong className="font-display font-bold text-concreto">Modo demonstração.</strong>{' '}
                Os dados ficam neste navegador e os perfis não usam senha.
              </>
            ) : (
              <>
                <strong className="font-display font-bold text-concreto">Acesso protegido.</strong>{' '}
                Use as credenciais fornecidas pelo administrador do sistema.
              </>
            )}
          </p>
        </aside>
      </div>
    </main>
  )
}
