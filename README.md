# Controle de Pátio

## API FastAPI + Supabase

O frontend usa o mock quando `VITE_API_URL` não está configurada. A integração com
Supabase usa o banco, RLS e autenticação do projeto; o FastAPI valida os JWTs antes
de aceitar chamadas protegidas.

1. Crie um projeto no Supabase.
2. Copie `.env.example` para `.env` e preencha as chaves do projeto.
3. No SQL Editor do Supabase, execute [`supabase/migrations/202609240001_schema.sql`](supabase/migrations/202609240001_schema.sql).
4. Crie usuários em Authentication → Users e cadastre o mesmo UUID em `public.usuarios`, por exemplo:

```sql
insert into public.usuarios (id, nome, email, papel)
values ('UUID_DO_USUARIO_AUTH', 'Nome do usuário', 'email@empresa.com', 'analista');
```

Não coloque `SUPABASE_JWT_SECRET` ou uma service role key no frontend.

Para executar com a API local:

```bash
npm run api:install
npm run api:dev
```

Em outro terminal, inicie o frontend apontando para a API:

```bash
npm run dev
```

Com `.env` preenchido, a tela de login usa email e senha do Supabase e as chamadas
enviam o access token automaticamente. Sem as variáveis Supabase, o login demo e
o armazenamento em memória continuam disponíveis para apresentação local.

Teste a API em `http://localhost:8000/docs` e a saúde em `http://localhost:8000/health`.

> A migration define tabelas e RLS. O FastAPI usa a service role key apenas no
> servidor para persistir operações no Supabase; a autorização de cada operação
> continua sendo validada pelo JWT e pelo papel registrado em `public.usuarios`.
> Nunca exponha essa chave no frontend.

Sistema web de fiscalização de pátio: substitui a folha impressa de conferência de
drivers por uma lista que atualiza em tempo real, com bloqueio de driver adulterado,
alerta imediato para o analista e histórico do dia inteiro.

**Protótipo de demonstração** — dados fictícios, sem backend e sem senha.

### → [Abrir a demonstração](https://viniciusln1.github.io/patio-check/)

Funciona no navegador e no celular, sem instalar nada.

## Rodar

```bash
npm install
npm run dev              # http://localhost:5173
npm run dev -- --host    # abrir no celular, na mesma rede
```

Na tela de entrada, escolha um perfil:

| Perfil | O que faz |
|---|---|
| **Fiscal de pátio** | Confere drivers na chegada e reporta divergência (celular) |
| **Analista** | Sobe a escala, resolve bloqueios, acompanha painel e relatórios |
| **Líder** | Acompanha painel e relatórios, sem editar escala |

## Como apresentar

Abra **duas janelas** do navegador lado a lado, na mesma máquina: uma como
**analista**, outra como **fiscal** (reduza essa para largura de celular). As duas
compartilham os dados e se atualizam sozinhas — é assim que a diretoria vê a
divergência subir na hora.

> **Os dados ficam no navegador de cada um.** Quem abre o link ganha a própria cópia
> da demonstração: ninguém vê o que o outro fez, e ninguém estraga a demo de
> ninguém. Por isso o momento "o fiscal reporta, o analista vê na hora" se apresenta
> em duas janelas do **mesmo computador** — não em dois celulares. Sincronizar
> dispositivos diferentes é o servidor da fase 2.

## Roteiro de demonstração

1. Entre como **analista** → **Escala** → *Baixar modelo*, depois suba o mesmo
   arquivo: a pré-visualização recusa a linha inválida antes de gravar qualquer coisa.
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
8. **Auditoria** → tudo o que você acabou de fazer está registrado, com autor e horário.
9. **Relatórios** → 14 dias de histórico, gráficos e exportação em CSV.

No painel do analista, na barra lateral, há **Simulador** (liga check-ins fictícios a
cada 6 segundos, para a tela se mover sozinha durante a apresentação) e **Reiniciar
demonstração** (volta tudo ao estado inicial, para apresentar de novo do zero).

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
Vinícius. As com `fase 2` começam depois de definida a hospedagem.

Cada merge na `master` republica a demonstração sozinho, em 1 ou 2 minutos.

| Fatia | Onde mora |
|---|---|
| Fiscal | `src/features/fiscal/` |
| Painel | `src/features/analista/Dashboard.tsx` |
| Escala e auditoria | `src/features/analista/Escala.tsx`, `Auditoria.tsx` |
| Alertas e relatórios | `src/features/analista/Alertas.tsx`, `Relatorios.tsx` |

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · React Router · Recharts · Vitest

Arquitetura, convenções e o que entra na fase 2 estão em [CLAUDE.md](CLAUDE.md).
