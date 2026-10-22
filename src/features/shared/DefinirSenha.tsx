import { useState } from 'react'
import { useSessao } from '../../auth/sessao'
import { supabase } from '../../data/supabase/client'

const SENHA_MINIMA = 8

// Tela obrigatória do primeiro acesso (ou de senha redefinida pelo Líder): a pessoa
// já entrou só com o e-mail e aqui escolhe a própria senha antes de usar o sistema.
export function DefinirSenha() {
  const { usuario, sair } = useSessao()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro('')
    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
      return
    }
    if (senha !== confirmacao) {
      setErro('As senhas não conferem.')
      return
    }
    if (!supabase) return
    setSalvando(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Sessão expirada. Entre novamente.')
      const resposta = await fetch('/api/minha-senha', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      })
      const json = (await resposta.json().catch(() => null)) as { erro?: string } | null
      if (!resposta.ok) throw new Error(json?.erro ?? 'Não foi possível salvar a senha.')
      // Recarrega: a sessão continua válida e o app abre direto no painel certo.
      window.location.replace(import.meta.env.BASE_URL)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      setSalvando(false)
    }
  }

  const campo = 'rounded-chip border border-asfalto-3 bg-asfalto px-3 py-2.5 text-concreto'

  return (
    <main className="grid min-h-dvh place-items-center bg-asfalto px-5 text-concreto">
      <div className="w-full max-w-md rounded-lg border border-asfalto-3 bg-asfalto-2 p-6">
        <p className="rotulo text-demarcacao">Controle de Pátio</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold">Crie sua senha</h1>
        <p className="mt-2 text-sm text-brita-2">
          {usuario ? `Olá, ${usuario.nome}. ` : ''}Antes de continuar, escolha uma senha. Nas próximas vezes
          você entra com e-mail e senha.
        </p>

        <form onSubmit={(e) => void salvar(e)} className="mt-4 grid gap-4">
          <label className="grid gap-1.5 text-sm">
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={SENHA_MINIMA}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={campo}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            Confirme a senha
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              className={campo}
            />
          </label>
          {erro && <p role="alert" className="text-sm font-semibold text-demarcacao">{erro}</p>}
          <button
            type="submit"
            disabled={salvando}
            className="rounded-chip bg-demarcacao px-4 py-3 font-display font-bold text-asfalto disabled:opacity-60"
          >
            {salvando ? 'Salvando…' : 'Salvar senha e entrar'}
          </button>
          <button type="button" onClick={sair} className="text-sm font-semibold text-brita-2 underline">
            Sair
          </button>
        </form>
      </div>
    </main>
  )
}
