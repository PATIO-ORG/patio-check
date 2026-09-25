create type public.papel_usuario as enum ('fiscal', 'analista', 'lider');
create type public.origem_escala as enum ('planilha', 'manual');
create type public.status_item as enum ('aguardando', 'liberado', 'bloqueado', 'liberado_com_ressalva');
create type public.turno as enum ('manha', 'tarde', 'noite');
create type public.resultado_checkin as enum ('conforme', 'irregular');
create type public.tipo_irregularidade as enum ('placa', 'veiculo', 'nome', 'id', 'ocupante');

create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  papel public.papel_usuario not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.motoristas (
  id uuid primary key default gen_random_uuid(),
  driver_id text not null unique,
  nome text not null,
  veiculo_modelo text not null,
  veiculo_cor text not null,
  placa text not null,
  telefone text
);

create table public.escalas (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  criada_por uuid not null references public.usuarios(id),
  origem public.origem_escala not null,
  criada_em timestamptz not null default now()
);

create table public.itens_escala (
  id uuid primary key default gen_random_uuid(),
  escala_id uuid not null references public.escalas(id) on delete cascade,
  motorista_id uuid not null references public.motoristas(id),
  rota text not null,
  turno public.turno not null,
  status public.status_item not null default 'aguardando',
  adicionado_em timestamptz not null default now(),
  adicionado_por uuid not null references public.usuarios(id),
  avulso boolean not null default false,
  unique (escala_id, motorista_id)
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  escala_item_id uuid not null references public.itens_escala(id) on delete cascade,
  fiscal_id uuid not null references public.usuarios(id),
  em timestamptz not null default now(),
  resultado public.resultado_checkin not null,
  observacao text
);

create table public.irregularidades (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  escala_item_id uuid not null references public.itens_escala(id) on delete cascade,
  tipo public.tipo_irregularidade not null,
  esperado text not null,
  encontrado text not null,
  foto_url text
);

create table public.liberacoes (
  id uuid primary key default gen_random_uuid(),
  irregularidade_id uuid not null references public.irregularidades(id) on delete cascade,
  analista_id uuid not null references public.usuarios(id),
  em timestamptz not null default now(),
  justificativa text not null check (char_length(trim(justificativa)) >= 10),
  decisao text not null check (decisao in ('liberado', 'mantido_bloqueado'))
);

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id),
  acao text not null,
  entidade text not null,
  entidade_id uuid not null,
  antes jsonb,
  depois jsonb,
  em timestamptz not null default now()
);

create or replace function public.meu_papel()
returns public.papel_usuario
language sql
stable
security definer
set search_path = public
as $$
  select papel from public.usuarios where id = auth.uid() and ativo = true;
$$;

create or replace function public.tem_papel(papeis public.papel_usuario[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.meu_papel() = any(papeis);
$$;

alter table public.usuarios enable row level security;
alter table public.motoristas enable row level security;
alter table public.escalas enable row level security;
alter table public.itens_escala enable row level security;
alter table public.checkins enable row level security;
alter table public.irregularidades enable row level security;
alter table public.liberacoes enable row level security;
alter table public.auditoria enable row level security;

create policy usuarios_leitura on public.usuarios
  for select to authenticated using (ativo = true);
create policy motoristas_leitura on public.motoristas
  for select to authenticated using (true);
create policy escalas_leitura on public.escalas
  for select to authenticated using (true);
create policy escalas_escrita_analista on public.escalas
  for all to authenticated using (public.tem_papel(array['analista']::public.papel_usuario[])) with check (public.tem_papel(array['analista']::public.papel_usuario[]));
create policy itens_leitura on public.itens_escala
  for select to authenticated using (true);
create policy itens_escrita_analista on public.itens_escala
  for all to authenticated using (public.tem_papel(array['analista']::public.papel_usuario[])) with check (public.tem_papel(array['analista']::public.papel_usuario[]));
create policy checkins_leitura on public.checkins
  for select to authenticated using (true);
create policy checkins_fiscal on public.checkins
  for insert to authenticated with check (public.tem_papel(array['fiscal']::public.papel_usuario[]) and fiscal_id = auth.uid());
create policy irregularidades_leitura on public.irregularidades
  for select to authenticated using (true);
create policy irregularidades_fiscal on public.irregularidades
  for insert to authenticated with check (public.tem_papel(array['fiscal']::public.papel_usuario[]));
create policy liberacoes_leitura on public.liberacoes
  for select to authenticated using (true);
create policy liberacoes_analista on public.liberacoes
  for insert to authenticated with check (public.tem_papel(array['analista']::public.papel_usuario[]) and analista_id = auth.uid());
create policy auditoria_leitura on public.auditoria
  for select to authenticated using (public.tem_papel(array['analista', 'lider']::public.papel_usuario[]));

alter table public.escalas replica identity full;
alter table public.itens_escala replica identity full;
alter table public.checkins replica identity full;
alter table public.irregularidades replica identity full;
alter table public.liberacoes replica identity full;
alter publication supabase_realtime add table public.escalas, public.itens_escala, public.checkins, public.irregularidades, public.liberacoes;
