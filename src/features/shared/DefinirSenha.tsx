import { useEffect, useState } from 'react'
import { supabase } from '../../data/supabase/client'
import { encerrarConvite } from '../../auth/conviteNaUrl'

type Etapa = 'verificando' | 'pronto' | 'invalido'

const SENHA_MINIMA = 8

// Página de destino do link de convite: o Supabase abre uma sessão temporária e
// aqui a pessoa escolhe a própria senha.
export function DefinirSenha() {
  const [etapa, setEtapa] = useState<Etapa>('verificando')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setEtapa('invalido')
      return
    }
    let ativo = true
    // getSession aguarda o Supabase terminar de ler o link da URL.
    void supabase.auth.getSession().then(({ data }) => {
      if (ativo) setEtapa(data.session ? 'pronto' : 'invalido')
    })
    return () => {
      ativo = false
    }
  }, [])

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
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) {
      setErro(`Não foi possível salvar a senha: ${error.message}`)
      return
    }
    encerrarConvite()
    // Recarrega na raiz: a sessão já está salva e o app abre direto no painel certo.
    window.location.replace(import.meta.env.BASE_URL)
  }

  const campo = 'rounded-chip border border-asfalto-3 bg-asfalto px-3 py-2.5 text-concreto'

  return (
    <main className="grid min-h-dvh place-items-center bg-asfalto px-5 text-concreto">
      <div className="w-full max-w-md rounded-lg border border-asfalto-3 bg-asfalto-2 p-6">
        <p className="rotulo text-demarcacao">Controle de Pátio</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold">Crie sua senha</h1>

        {etapa === 'verificando' && <p className="mt-4 text-sm text-brita-2">Verificando seu convite…</p>}

        {etapa === 'invalido' && (
          <>
            <p role="alert" className="mt-4 text-sm font-semibold text-demarcacao">
              Este link de convite é inválido ou expirou.
            </p>
            <p className="mt-2 text-sm text-brita-2">Peça ao seu Líder para enviar um novo convite.</p>
            <a href="/" onClick={encerrarConvite} className="mt-4 inline-block text-sm font-semibold text-demarcacao underline">
              Ir para o login
            </a>
          </>
        )}

        {etapa === 'pronto' && (
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
          </form>
        )}
      </div>
    </main>
  )
}
