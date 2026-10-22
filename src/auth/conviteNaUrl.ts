// Detecta o link de convite/recuperação do Supabase, em qualquer endereço do app.
//
// O e-mail leva a pessoa para o endereço configurado no Supabase (Site URL ou
// Redirect URLs). Se `/definir-senha` não estiver liberado lá, o Supabase manda para
// a raiz do site, e o app abria o login ou o painel sem pedir senha. Aqui o convite é
// reconhecido pelos parâmetros do link (#access_token=...&type=invite) onde quer que
// ele chegue, e a pessoa é levada para a tela de criar senha.
//
// Este módulo precisa ser importado ANTES do cliente do Supabase: o cliente apaga os
// parâmetros da URL assim que lê a sessão, e por isso o resultado é guardado aqui.

const CHAVE = 'patio-check:definir-senha'
const TIPOS = ['invite', 'recovery', 'signup', 'magiclink']

function parametros(): URLSearchParams {
  const todos = new URLSearchParams(window.location.search)
  new URLSearchParams(window.location.hash.replace(/^#/, '')).forEach((valor, nome) => todos.set(nome, valor))
  return todos
}

function detectar(): boolean {
  try {
    const p = parametros()
    const tipo = p.get('type') ?? ''
    const veioDoSupabase = p.has('access_token') || p.has('token_hash') || p.has('code') || p.has('error_code')
    if (veioDoSupabase && (TIPOS.includes(tipo) || p.has('error_code'))) {
      sessionStorage.setItem(CHAVE, '1')
      return true
    }
    return sessionStorage.getItem(CHAVE) === '1'
  } catch {
    return false
  }
}

const pendente = detectar()

/** Há um convite/recuperação de senha em andamento nesta aba. */
export function conviteEmAndamento(): boolean {
  if (!pendente) return false
  try {
    return sessionStorage.getItem(CHAVE) === '1'
  } catch {
    return pendente
  }
}

/** Chamar depois que a senha foi definida (ou o link foi descartado). */
export function encerrarConvite(): void {
  try {
    sessionStorage.removeItem(CHAVE)
  } catch {
    // sem armazenamento: nada a limpar
  }
}
