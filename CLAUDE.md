# CLAUDE.md

Sistema web de fiscalização de pátio de uma transportadora. Substitui a folha de papel
que o fiscal usa hoje para conferir driver, veículo e placa na chegada.

**Estado atual: protótipo de demonstração.** Tudo roda contra um mock em memória,
sem backend, sem autenticação real. A fase 2 é Supabase (Postgres + Auth + RLS +
Realtime).

## Comandos

- `npm run dev` — Vite dev server (`npm run dev -- --host` para abrir no celular)
- `npm run build` — `tsc -b` + build de produção
- `npm test` — Vitest uma vez (`npm run test:watch` para observar)
- `npx vitest run src/domain/status.test.ts` — um arquivo só
- `npm run lint` — oxlint
- `npm run verify:demo` — percorre o roteiro de demonstração inteiro num navegador
  real, em duas abas (analista + fiscal). Precisa do dev server na porta 5199
  (`npm run dev -- --port 5199`) e, uma vez por máquina, de `npx playwright install chromium`.

## Arquitetura

Três camadas, com dependência em uma direção só: `features/` → `data/` → `domain/`.

- **`src/domain/`** — tipos e regra de negócio puros, sem React e sem acesso a
  dados. `status.ts` é a máquina de estados do item de escala e a única fonte de
  verdade sobre quem pode fazer o quê. É o que sobrevive intacto à troca de
  backend, e é testado primeiro (TDD).
- **`src/data/DataSource.ts`** — interface única de acesso a dados. **Nenhum
  componente fala com o mock (ou, depois, com o Supabase) diretamente.** É essa
  interface que permite vários devs trabalharem em paralelo e que torna a fase 2
  uma substituição de implementação, não uma reescrita de telas.
- **`src/data/mock/`** — `MockDataSource` implementa a interface sobre um estado em
  memória; `seed.ts` gera 14 dias de histórico determinístico (PRNG com semente
  fixa, então todo mundo vê os mesmos dados); `simulator.ts` gera check-ins
  fictícios durante a demonstração para o painel se mover sozinho.
- **`src/data/provider.tsx`** — contexto do `DataSource` e o hook `useLiveData`,
  que refaz a consulta sempre que `DataSource.subscribe` avisa de uma mutação. Com
  Supabase, esse `subscribe` vira a subscription de realtime e as telas não mudam.
- **`src/data/mock/persistencia.ts`** — o protótipo não tem servidor, mas a
  demonstração depende de a janela do analista receber na hora o que o fiscal fez na
  janela ao lado. O estado mora em `localStorage` (compartilhado pela origem) e um
  `BroadcastChannel` avisa as outras abas. Por isso **ids criados em runtime usam
  `crypto.randomUUID`**, nunca um contador: um contador por aba geraria o mesmo id em
  duas janelas. A sessão, ao contrário, fica em `sessionStorage`, para cada aba ter
  o seu perfil.
- **`src/features/fiscal/`** — mobile-first, botões grandes. `src/features/analista/`
  — desktop. `src/features/shared/` — componentes comuns.

### Máquina de estados

```
aguardando ──conforme──▶ liberado
     │
     └──irregular──▶ bloqueado ──analista libera──▶ liberado_com_ressalva
                          │
                          └──analista mantém──▶ bloqueado
```

Fiscal registra check-in; nunca desbloqueia. **Só o analista resolve bloqueio**, e
sempre com justificativa (mínimo 10 caracteres). Líder acompanha painel e
relatórios: não edita escala nem resolve bloqueio. Toda transição grava `AuditLog`
com autor e horário.

Quem pode liberar um bloqueio ainda é pergunta aberta para a diretoria (qualquer
analista? só líder?). A regra vive inteira em `podeResolverBloqueio`/`resolverBloqueio`
em `src/domain/status.ts` — mudar de ideia é mudar ali e ajustar o teste.

Ao mexer em `src/domain/` ou `src/data/DataSource.ts`, avise o time: são contratos
compartilhados por todas as telas.

## Design

Identidade ancorada nos materiais do pátio, com tokens em `src/index.css` sob
`@theme` (Tailwind v4, configuração em CSS — não existe `tailwind.config.js`).
Paleta: `asfalto`/`concreto` (superfícies), `demarcacao` (amarelo viário, o único
acento), `sinal` (vermelho de sinalização), `liberado`, `ressalva`. Fontes: Archivo
(display), Public Sans (corpo), JetBrains Mono (placas, IDs, rotas, horários),
carregadas por `<link>` no `index.html`.

**Elemento-assinatura:** a placa aparece sempre renderizada como placa Mercosul
(`src/features/shared/Placa.tsx`), nunca como texto solto. Em uma divergência,
`PlacaComparada` põe as duas lado a lado e destaca em vermelho só os caracteres que
não batem — é o que o fiscal precisa enxergar de relance. Não substitua por texto.

Verde e vermelho nos gráficos são cores de **estado** (conforme / irregular), com
significado fixo em todo o sistema; o par foi validado para daltonismo e sempre vem
com legenda ou rótulo, nunca só pela cor. Não reaproveite essas cores como paleta
categórica.

Tema único e claro, de propósito: o fiscal opera no sol.

## Testes

Vitest + jsdom. `src/domain/status.test.ts` cobre a máquina de estados;
`src/data/mock/MockDataSource.test.ts` cobre validação de planilha, fluxo de
check-in, bloqueio, auditoria e histórico. Regra de negócio nova em `domain/` ou
`data/` ganha teste antes da implementação.

## Fase 2 (não fazer ainda)

Implementar `src/data/supabase/SupabaseDataSource.ts` contra a mesma interface,
trocar o provider, substituir a seleção de perfil por Supabase Auth, aplicar RLS
por papel e remover o simulador. Nada em `features/` deve precisar mudar.

## Lint

`npm run lint` fica em zero erros. Sobram avisos de `react(only-export-components)`
em `provider.tsx`, `sessao.tsx`, `ui.tsx` e `graficos.tsx`: são arquivos que, de
propósito, colocam o contexto/os tokens ao lado dos componentes. O aviso é só sobre
Fast Refresh, não sobre correção — não vale fragmentar esses kits para silenciá-lo.
