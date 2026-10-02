# Controle de Pátio

Sistema web de fiscalização de pátio: substitui a folha impressa de conferência de
drivers por uma lista que atualiza em tempo real, com bloqueio de driver adulterado,
alerta imediato para o analista e histórico do dia inteiro.

O projeto oferece modo demonstração local e modo de produção com Supabase para
compartilhar dados e autenticação entre dispositivos.

Frontend em Vite, pronto para publicação na Vercel. O deploy requer a configuração
do projeto Supabase descrita abaixo.

## Rodar

```bash
npm install
npm run dev              # http://localhost:5173
npm run dev -- --host    # abrir no celular, na mesma rede
```

Para que o celular e o computador compartilhem os dados nesse modo, configure
`.env.local` com a URL e a chave pública do Supabase, usando [.env.example](./.env.example)
como modelo. Sem essa configuração, o modo demonstração mantém os dados separados
em cada navegador.

Sem Supabase, a tela de entrada oferece perfis fictícios para demonstração. Com as
variáveis configuradas, use o e-mail e a senha de uma conta cadastrada no Supabase.

| Perfil | O que faz |
|---|---|
| **Fiscal de pátio** | Confere drivers na chegada e reporta divergência (celular) |
| **Analista** | Sobe a escala, resolve bloqueios, acompanha painel e relatórios |
| **Líder** | Acompanha painel e relatórios, sem editar escala |

## Publicar na Vercel com dados compartilhados

1. Crie um projeto no Supabase e execute a migração
   [20260927134000_patio_persistence.sql](./supabase/migrations/20260927134000_patio_persistence.sql)
   no SQL Editor do projeto.
2. Cadastre as contas em **Authentication → Users**. O banco cria os perfis
   automaticamente como fiscais; altere os papéis necessários no SQL Editor,
   por exemplo:
   `update public.profiles set papel = 'analista' where email = 'analista@empresa.com';`
3. Em **Authentication → URL Configuration**, configure a URL de produção da Vercel
   como **Site URL**. Adicione os endereços locais/de preview que serão usados aos
   **Redirect URLs**.
4. Importe o repositório na Vercel. O projeto detecta Vite automaticamente; use
   `npm run build` como comando e `dist` como diretório de saída.
5. Nas variáveis de ambiente da Vercel, configure `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` com os valores do painel Supabase. Faça um novo deploy.
6. Use os e-mails e senhas criados no Supabase para entrar. A escala, check-ins,
   alertas e auditoria passam a ser compartilhados em celulares e computadores.

Nunca configure `service_role` no frontend ou na Vercel como variável `VITE_*`.
O banco aplica as permissões por perfil. Para testar o modo local sem Supabase,
rode `npm run dev` sem as variáveis de ambiente.

## Como apresentar

Abra uma sessão como **analista** e outra como **fiscal** (reduza a largura para
simular o celular). Com Supabase configurado, elas podem estar em máquinas diferentes:
os dados compartilhados se atualizam sozinhos.

No modo de demonstração local, os dados ficam no navegador. Com Supabase configurado,
os dados operacionais são compartilhados entre dispositivos e atualizados em tempo real.

## Roteiro de demonstração

1. Entre como **analista** → **Escala** → *Baixar modelo*, depois suba o mesmo
   arquivo: a importação reconhece o cabeçalho CSV após as linhas de instrução e
   recusa a linha inválida antes de gravar qualquer coisa.
2. Abra outra janela como **fiscal** → confira um driver com **Tudo certo**.
3. Volte ao **Painel**: os KPIs e o gráfico já refletem o check-in.
4. Como fiscal, abra outro driver → **Reportar divergência** → digite uma placa
   trocando um caractere. As duas placas aparecem lado a lado com a diferença marcada.
5. No painel do analista o alerta entra no feed em segundos, e o driver consta como
   bloqueado.
6. **Alertas** → tente liberar sem justificativa (é recusado), depois libere com
   justificativa.
7. **Escala** → *Driver que entrou no meio do turno* → adicione um driver: ele
   aparece na lista do fiscal marcado como **Novo**, sem reimprimir nada.
8. Em **Escala**, use **Remover todos** para limpar a escala do dia após confirmar.
9. **Histórico** → tudo o que você acabou de fazer está registrado, com autor e horário.
10. **Relatórios** → 14 dias de histórico, gráficos e exportação em CSV.

No modo de demonstração local, o painel do analista oferece **Simulador** (liga check-ins
fictícios a cada 6 segundos) e **Reiniciar demonstração**. Esses controles não aparecem
com o backend Supabase ativo.

## Verificar antes de apresentar

```bash
npm test                              # regra de negócio
npm run build                         # tipos + build
npx playwright install chromium       # uma vez por máquina
npm run dev -- --port 5199            # em outro terminal
npm run verify:demo                   # percorre o roteiro acima num navegador real
```

## Como contribuir

As tarefas ficam no **[quadro do projeto](https://github.com/users/ViniciusLN1/projects/4)**.

1. Escolha uma issue em **Todo**. Para começar, prefira as marcadas com
   `good first issue`: são pequenas, independentes e têm critério de pronto.
2. Atribua a issue a você, para ninguém pegar a mesma.
3. Crie a branch com o número da issue: `git checkout -b 12-busca-placa-hifen`.
4. Abra o PR pelo modelo, com `Closes #12`. A palavra precisa estar em inglês: é ela que
   fecha a issue no merge. O CI roda testes e build e precisa ficar
   verde. Ao mergear, a issue fecha e o cartão vai para **Done** sozinho.
5. **`src/domain/` e `src/data/DataSource.ts` são contratos compartilhados** por todas
   as telas. Precisou mexer ali? Avise o grupo antes e abra um PR só para isso.
6. Regra de negócio nova ganha teste antes da implementação.

Issues com `aguarda diretoria` dependem de uma decisão da empresa e ficam com o
Vinícius.

Depois de conectar o repositório à Vercel, cada merge na branch de produção gera um deploy.

| Fatia | Onde mora |
|---|---|
| Fiscal | `src/features/fiscal/` |
| Painel | `src/features/analista/Dashboard.tsx` |
| Escala e auditoria | `src/features/analista/Escala.tsx`, `Auditoria.tsx` |
| Alertas e relatórios | `src/features/analista/Alertas.tsx`, `Relatorios.tsx` |

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · Supabase · React Router · Recharts · Vitest

Arquitetura, convenções e o que entra na fase 2 estão em [CLAUDE.md](CLAUDE.md).
