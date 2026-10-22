import { useCallback, useEffect, useState } from 'react'
import { MODO_DEMONSTRACAO } from '../../data/provider'
import { Botao, Cartao, TituloSecao, Vazio } from '../shared/ui'
import {
  alterarAcesso,
  convidarColaborador,
  excluirColaborador,
  listarColaboradores,
} from './colaboradoresApi'
import type { Colaborador, PapelColaborador } from './colaboradoresApi'

const ROTULO_PAPEL = {
  fiscal: 'Fiscal',
  analista: 'Analista',
  lider: 'Líder',
  super_admin: 'Super Admin',
} as const

function IconeReativar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  )
}

function situacao(c: Colaborador) {
  if (!c.ativo) return { texto: 'Desativado', classe: 'bg-sinal-fraca text-sinal-ink' }
  if (c.convitePendente) return { texto: 'Convite pendente', classe: 'bg-ressalva-fraca text-ressalva-ink' }
  return { texto: 'Ativo', classe: 'bg-liberado-fraca text-liberado-ink' }
}

export function Colaboradores() {
  const [lista, setLista] = useState<Colaborador[] | null>(null)
  const [erroLista, setErroLista] = useState('')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<PapelColaborador>('fiscal')
  const [enviando, setEnviando] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const carregar = useCallback(async () => {
    try {
      setLista((await listarColaboradores()).colaboradores)
      setErroLista('')
    } catch (erro) {
      setErroLista(erro instanceof Error ? erro.message : String(erro))
    }
  }, [])

  useEffect(() => {
    if (MODO_DEMONSTRACAO) return
    void carregar()
  }, [carregar])

  if (MODO_DEMONSTRACAO) {
    return (
      <Cartao className="mx-auto max-w-3xl">
        <Vazio
          titulo="Disponível apenas com o Supabase configurado"
          acao="No modo demonstração não há contas reais para gerenciar."
        />
      </Cartao>
    )
  }

  async function convidar(evento: React.FormEvent) {
    evento.preventDefault()
    setAviso(null)
    setEnviando(true)
    try {
      await convidarColaborador({ nome: nome.trim(), email: email.trim(), papel })
      setAviso({ tipo: 'ok', texto: `Convite enviado para ${email.trim()}. A pessoa define a própria senha pelo link do e-mail.` })
      setNome('')
      setEmail('')
      setPapel('fiscal')
      await carregar()
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: erro instanceof Error ? erro.message : String(erro) })
    } finally {
      setEnviando(false)
    }
  }

  async function alternar(c: Colaborador) {
    const desativar = c.ativo
    if (desativar && !confirm(`Desativar ${c.nome}? A pessoa perde o acesso agora, mas o histórico dela é mantido.`)) {
      return
    }
    setAviso(null)
    setOcupado(c.id)
    try {
      await alterarAcesso(c.id, !c.ativo)
      setAviso({ tipo: 'ok', texto: desativar ? `${c.nome} foi desativado.` : `${c.nome} foi reativado.` })
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: erro instanceof Error ? erro.message : String(erro) })
    } finally {
      setOcupado(null)
      await carregar()
    }
  }

  async function excluir(c: Colaborador) {
    const aviso =
      `Excluir ${c.nome} (${c.email}) definitivamente? A conta é apagada e não dá para desfazer.\n\n` +
      'Só é possível excluir quem nunca usou o sistema; quem já tem histórico deve ser desativado.'
    if (!confirm(aviso)) return
    setAviso(null)
    setOcupado(c.id)
    try {
      await excluirColaborador(c.id)
      setAviso({ tipo: 'ok', texto: `${c.nome} foi excluído.` })
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: erro instanceof Error ? erro.message : String(erro) })
    } finally {
      setOcupado(null)
      await carregar()
    }
  }

  const campo = 'rounded-chip border border-linha bg-superficie px-3 py-2.5 text-sm'

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Colaboradores</h1>
        <p className="mt-1 text-sm text-brita">
          Cadastre Líderes, Fiscais e Analistas e controle quem tem acesso. Cada pessoa recebe um convite por
          e-mail e cria a própria senha.
        </p>
      </header>

      <Cartao>
        <TituloSecao>Novo colaborador</TituloSecao>
        <form onSubmit={(e) => void convidar(e)} className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="rotulo text-brita">Nome</span>
            <input required minLength={2} maxLength={100} value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="rotulo text-brita">E-mail</span>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="rotulo text-brita">Função</span>
            <select value={papel} onChange={(e) => setPapel(e.target.value as PapelColaborador)} className={campo}>
              <option value="fiscal">Fiscal de pátio</option>
              <option value="analista">Analista</option>
              <option value="lider">Líder</option>
            </select>
          </label>
          <div className="flex items-end">
            <Botao type="submit" disabled={enviando} className="w-full sm:w-auto">
              {enviando ? 'Enviando…' : 'Enviar convite'}
            </Botao>
          </div>
        </form>
        {aviso && (
          <p
            role={aviso.tipo === 'erro' ? 'alert' : 'status'}
            className={`border-t border-linha px-5 py-3 text-sm font-semibold ${aviso.tipo === 'erro' ? 'text-sinal-ink' : 'text-liberado-ink'}`}
          >
            {aviso.texto}
          </p>
        )}
      </Cartao>

      <Cartao>
        <TituloSecao>Equipe</TituloSecao>
        {erroLista ? (
          <p role="alert" className="px-5 py-6 text-sm font-semibold text-sinal-ink">{erroLista}</p>
        ) : !lista ? (
          <p className="px-5 py-6 text-sm text-brita">Carregando…</p>
        ) : lista.length === 0 ? (
          <Vazio titulo="Nenhum colaborador cadastrado" />
        ) : (
          <ul className="divide-y divide-linha">
            {lista.map((c) => {
              const s = situacao(c)
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[15px] font-bold">{c.nome}</p>
                    <p className="truncate text-[13px] text-brita">{c.email}</p>
                  </div>
                  <span className="rotulo rounded-full bg-concreto px-2.5 py-1 text-ink">{ROTULO_PAPEL[c.papel]}</span>
                  <span className={`rotulo rounded-full px-2.5 py-1 ${s.classe}`}>{s.texto}</span>
                  <div className="flex w-full items-center justify-end gap-2 sm:w-[212px]">
                    {c.gerenciavel && (
                      <>
                        {c.ativo ? (
                          <Botao variante="neutro" disabled={ocupado === c.id} onClick={() => void alternar(c)}>
                            Desativar
                          </Botao>
                        ) : (
                          <Botao variante="sucesso" disabled={ocupado === c.id} onClick={() => void alternar(c)}>
                            <span className="inline-flex items-center gap-1.5">
                              <IconeReativar />
                              Reativar
                            </span>
                          </Botao>
                        )}
                        <Botao
                          variante="perigo-suave"
                          disabled={ocupado === c.id}
                          onClick={() => void excluir(c)}
                          aria-label={`Excluir ${c.nome}`}
                        >
                          Excluir
                        </Botao>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Cartao>
    </div>
  )
}
