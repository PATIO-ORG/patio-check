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

### Executar com API local e acessar pelo celular

O celular e o computador precisam estar na mesma rede Wi-Fi. A API e o frontend
rodam no computador; no celular, `localhost` aponta para o próprio celular, então
use o IPv4 do computador nos endereços abaixo.

1. Instale as dependências uma vez e configure o `.env` com as credenciais do
   Supabase e o endereço local do backend:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon
VITE_API_URL=http://192.168.3.207:8000

SUPABASE_JWT_SECRET=seu_jwt_secret
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
CORS_ORIGINS=http://localhost:5173,http://localhost:4173,http://192.168.3.207:5173
```

Substitua `192.168.3.207` pelo endereço IPv4 atual do computador (no Windows,
rode `ipconfig` e procure o IPv4 do adaptador Wi-Fi). O endereço do frontend em
`CORS_ORIGINS` deve ser exatamente o usado no navegador, sem barra no final.
Nunca compartilhe o `.env` nem publique `SUPABASE_JWT_SECRET` ou
`SUPABASE_SERVICE_ROLE_KEY`.

2. Abra **dois terminais** na pasta do projeto. No primeiro, inicie a API:

```bash
npm run api:install
npm run api:dev
```

O comando inicia o FastAPI na porta `8000` aceitando conexões da rede local. No
segundo terminal, inicie o frontend:

```bash
npm run dev -- --host
```

No computador, abra `http://localhost:5173`. No celular conectado à mesma rede
Wi-Fi, abra `http://192.168.3.207:5173`, substituindo o IP pelo IPv4 do computador.
Se o Windows Defender Firewall perguntar, permita Node/Python nas redes privadas.
Se o celular ainda não conectar, confira se ambos estão na mesma rede e se a rede
não tem isolamento de dispositivos.

Com `.env` preenchido, entre com email e senha cadastrados no Supabase. O frontend
envia o access token ao FastAPI, que grava os dados no banco compartilhado.
Reinicie os dois comandos depois de alterar o `.env`.

Teste a API no computador em `http://localhost:8000/docs` e a saúde em
`http://localhost:8000/health`; no celular, use `http://192.168.3.207:8000/health`.

> Abrir o link do GitHub Pages não usa o backend local. A demonstração pública usa
> dados locais no navegador e não sincroniza analista e fiscal entre dispositivos.
> Para usar de lugares/redes diferentes, publique o FastAPI em um endereço HTTPS,
> configure `VITE_API_URL` com essa URL e inclua a origem do frontend em
> `CORS_ORIGINS`. Não exponha a porta local da API diretamente à internet.

> A migration define tabelas e RLS. O FastAPI usa a service role key apenas no
> servidor para persistir operações no Supabase; a autorização de cada operação
> continua sendo validada pelo JWT e pelo papel registrado em `public.usuarios`.
> Nunca exponha essa chave no frontend.

Sistema web de fiscalização de pátio: substitui a folha impressa de conferência de
drivers por uma lista que atualiza em tempo real, com bloqueio de driver adulterado,
alerta imediato para o analista e histórico do dia inteiro.

**Demonstração pública** — dados locais de exemplo, sem backend e sem senha.

### → [Abrir a demonstração](https://viniciusln1.github.io/patio-check/)

Abre no navegador e no celular, sem instalar nada. Essa demonstração pública é
isolada por dispositivo; para compartilhar a escala entre analista e fiscal, siga
as instruções de **API local** acima.

## Rodar

```bash
npm install
npm run dev              # http://localhost:5173
npm run dev -- --host    # disponibiliza o frontend na rede local
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
