-- Patio Check persistence schema. Apply in the Supabase SQL Editor, or run
-- `supabase db push` after linking this project. Set VITE_SUPABASE_URL and
-- VITE_SUPABASE_ANON_KEY in the frontend environment; never use a service-role
-- key in the browser. Create users through Supabase Auth; new profiles default
-- to fiscal, then an operator assigns analista/lider in `profiles`.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  papel text not null default 'fiscal' check (papel in ('fiscal', 'analista', 'lider')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.motoristas (
  id text primary key,
  driver_id text not null unique,
  nome text not null,
  veiculo_modelo text not null,
  veiculo_cor text not null default '',
  placa text not null,
  telefone text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.escalas (
  id text primary key,
  data date not null unique,
  criada_por uuid not null references public.profiles(id),
  origem text not null check (origem in ('planilha', 'manual')),
  criada_em timestamptz not null default now()
);

create table if not exists public.escala_itens (
  id text primary key,
  escala_id text not null references public.escalas(id),
  motorista_id text not null references public.motoristas(id),
  rota text not null,
  turno text not null check (turno in ('manha', 'tarde', 'noite')),
  status text not null default 'aguardando'
    check (status in ('aguardando', 'liberado', 'bloqueado', 'liberado_com_ressalva')),
  adicionado_em timestamptz not null default now(),
  adicionado_por uuid not null references public.profiles(id),
  avulso boolean not null default false,
  removido_em timestamptz
);

create table if not exists public.checkins (
  id text primary key,
  escala_item_id text not null references public.escala_itens(id),
  fiscal_id uuid not null references public.profiles(id),
  em timestamptz not null default now(),
  resultado text not null check (resultado in ('conforme', 'irregular')),
  observacao text
);

create table if not exists public.irregularidades (
  id text primary key,
  checkin_id text not null references public.checkins(id),
  escala_item_id text not null references public.escala_itens(id),
  tipo text not null check (tipo in ('placa', 'veiculo', 'nome', 'id', 'ocupante')),
  esperado text not null,
  encontrado text not null,
  foto_url text
);

create table if not exists public.liberacoes (
  id text primary key,
  irregularidade_id text not null references public.irregularidades(id),
  analista_id uuid not null references public.profiles(id),
  em timestamptz not null default now(),
  justificativa text not null,
  decisao text not null check (decisao in ('liberado', 'mantido_bloqueado'))
);

create table if not exists public.auditoria (
  id text primary key,
  usuario_id uuid not null references public.profiles(id),
  acao text not null check (acao in (
    'escala.importada', 'escala.item_adicionado', 'escala.item_editado',
    'escala.item_removido', 'checkin.registrado', 'irregularidade.reportada',
    'bloqueio.liberado', 'bloqueio.mantido'
  )),
  entidade text not null,
  entidade_id text not null,
  antes jsonb,
  depois jsonb,
  em timestamptz not null default now()
);

create index if not exists escala_itens_escala_idx on public.escala_itens(escala_id) where removido_em is null;
create index if not exists checkins_item_em_idx on public.checkins(escala_item_id, em desc);
create index if not exists irregularidades_item_idx on public.irregularidades(escala_item_id);
create index if not exists auditoria_em_idx on public.auditoria(em desc);
create index if not exists auditoria_usuario_em_idx on public.auditoria(usuario_id, em desc);

create or replace function public.patio_perfil_ativo()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.ativo
  );
$$;

create or replace function public.patio_tem_papel(papeis text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.ativo and p.papel = any (papeis)
  );
$$;

revoke all on function public.patio_perfil_ativo() from public, anon;
revoke all on function public.patio_tem_papel(text[]) from public, anon;
grant execute on function public.patio_perfil_ativo() to authenticated;
grant execute on function public.patio_tem_papel(text[]) to authenticated;

create or replace function public.patio_criar_perfil()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists patio_auth_user_created on auth.users;
create trigger patio_auth_user_created
  after insert on auth.users
  for each row execute function public.patio_criar_perfil();
revoke all on function public.patio_criar_perfil() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.motoristas enable row level security;
alter table public.escalas enable row level security;
alter table public.escala_itens enable row level security;
alter table public.checkins enable row level security;
alter table public.irregularidades enable row level security;
alter table public.liberacoes enable row level security;
alter table public.auditoria enable row level security;

drop policy if exists profiles_read_active on public.profiles;
create policy profiles_read_active on public.profiles for select to authenticated
  using (public.patio_perfil_ativo());

drop policy if exists motoristas_read_active on public.motoristas;
create policy motoristas_read_active on public.motoristas for select to authenticated
  using (public.patio_perfil_ativo());
drop policy if exists motoristas_analyst_write on public.motoristas;
create policy motoristas_analyst_write on public.motoristas for all to authenticated
  using (public.patio_tem_papel(array['analista'])) with check (public.patio_tem_papel(array['analista']));

drop policy if exists escalas_read_active on public.escalas;
create policy escalas_read_active on public.escalas for select to authenticated
  using (public.patio_perfil_ativo());
drop policy if exists escalas_analyst_write on public.escalas;
create policy escalas_analyst_write on public.escalas for all to authenticated
  using (public.patio_tem_papel(array['analista'])) with check (public.patio_tem_papel(array['analista']));

drop policy if exists escala_itens_read_active on public.escala_itens;
create policy escala_itens_read_active on public.escala_itens for select to authenticated
  using (public.patio_perfil_ativo());
drop policy if exists escala_itens_analyst_write on public.escala_itens;
create policy escala_itens_analyst_write on public.escala_itens for all to authenticated
  using (public.patio_tem_papel(array['analista'])) with check (public.patio_tem_papel(array['analista']));

drop policy if exists checkins_read_active on public.checkins;
create policy checkins_read_active on public.checkins for select to authenticated
  using (public.patio_perfil_ativo());
drop policy if exists irregularidades_read_active on public.irregularidades;
create policy irregularidades_read_active on public.irregularidades for select to authenticated
  using (public.patio_perfil_ativo());
drop policy if exists liberacoes_read_active on public.liberacoes;
create policy liberacoes_read_active on public.liberacoes for select to authenticated
  using (public.patio_perfil_ativo());
drop policy if exists auditoria_read_active on public.auditoria;
create policy auditoria_read_active on public.auditoria for select to authenticated
  using (public.patio_perfil_ativo());

-- Only the auth-user trigger may create profiles. Roles cannot self-promote.
revoke all on public.profiles, public.motoristas, public.escalas, public.escala_itens,
  public.checkins, public.irregularidades, public.liberacoes, public.auditoria from anon, authenticated;
grant select on public.profiles, public.motoristas, public.escalas, public.escala_itens,
  public.checkins, public.irregularidades, public.liberacoes, public.auditoria to authenticated;
-- Mutations go through security-definer RPCs, so the authorization check and
-- related audit/state changes cannot be split across client requests.

create or replace function public.patio_registrar_auditoria(
  p_id text, p_usuario uuid, p_acao text, p_entidade text, p_entidade_id text,
  p_antes jsonb default null, p_depois jsonb default null
)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.auditoria (id, usuario_id, acao, entidade, entidade_id, antes, depois)
  values (p_id, p_usuario, p_acao, p_entidade, p_entidade_id, p_antes, p_depois);
$$;

revoke all on function public.patio_registrar_auditoria(text, uuid, text, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.patio_auditar_item()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  driver public.motoristas%rowtype;
  before_json jsonb;
  after_json jsonb;
  action text;
  target_id text;
begin
  if current_setting('patio.silenciar_auditoria_item', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if actor is null then
    raise exception 'Sessão autenticada obrigatória para auditoria.';
  end if;

  if tg_op = 'DELETE' then
    target_id := old.id;
    select * into driver from public.motoristas where id = old.motorista_id;
  else
    target_id := new.id;
    select * into driver from public.motoristas where id = new.motorista_id;
  end if;

  if tg_op <> 'INSERT' then
    before_json := jsonb_build_object(
      'driverId', driver.driver_id, 'nome', driver.nome, 'veiculoModelo', driver.veiculo_modelo,
      'veiculoCor', driver.veiculo_cor, 'placa', driver.placa, 'rota', old.rota, 'turno', old.turno
    );
  end if;
  if tg_op <> 'DELETE' then
    after_json := jsonb_build_object(
      'driverId', driver.driver_id, 'nome', driver.nome, 'veiculoModelo', driver.veiculo_modelo,
      'veiculoCor', driver.veiculo_cor, 'placa', driver.placa, 'rota', new.rota, 'turno', new.turno
    );
  end if;
  if tg_op = 'INSERT' then action := 'escala.item_adicionado';
  elsif tg_op = 'DELETE' then
    action := 'escala.item_removido';
    after_json := null;
  elsif old.removido_em is null and new.removido_em is not null then
    action := 'escala.item_removido';
    after_json := null;
  else action := 'escala.item_editado';
  end if;
  perform public.patio_registrar_auditoria(
    'log-' || gen_random_uuid()::text, actor, action, 'escala_item', target_id, before_json, after_json
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists escala_item_auditoria on public.escala_itens;
create trigger escala_item_auditoria after insert or update or delete on public.escala_itens
  for each row execute function public.patio_auditar_item();
revoke all on function public.patio_auditar_item() from public, anon, authenticated;

create or replace function public.importar_escala(
  p_id text, p_data date, p_usuario_id uuid, p_linhas jsonb
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  line_data jsonb;
  v_escala_id text;
  v_motorista_id text;
  existing_item_id text;
  total integer := 0;
begin
  if auth.uid() is distinct from p_usuario_id or not public.patio_tem_papel(array['analista']) then
    raise exception 'Somente analistas podem importar escalas para a própria sessão.' using errcode = '42501';
  end if;
  insert into public.escalas (id, data, criada_por, origem)
  values (p_id, p_data, p_usuario_id, 'planilha')
  on conflict (data) do nothing;
  select e.id into v_escala_id from public.escalas e where e.data = p_data for update;
  perform set_config('patio.silenciar_auditoria_item', 'on', true);
  for line_data in select value from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb))
  loop
    insert into public.motoristas (id, driver_id, nome, veiculo_modelo, veiculo_cor, placa)
    values (
      line_data ->> 'id', upper(line_data ->> 'driverId'), line_data ->> 'nome', line_data ->> 'veiculoModelo',
      coalesce(line_data ->> 'veiculoCor', ''), line_data ->> 'placa'
    )
    on conflict (driver_id) do update set
      nome = excluded.nome, veiculo_modelo = excluded.veiculo_modelo,
      veiculo_cor = excluded.veiculo_cor, placa = excluded.placa, atualizado_em = now()
    returning id into v_motorista_id;
    select i.id into existing_item_id from public.escala_itens i
    where i.escala_id = v_escala_id and i.motorista_id = v_motorista_id and i.removido_em is null
    limit 1;
    if existing_item_id is null then
      insert into public.escala_itens (
        id, escala_id, motorista_id, rota, turno, status, adicionado_por, avulso
      ) values (
        line_data ->> 'itemId', v_escala_id, v_motorista_id, upper(line_data ->> 'rota'),
        line_data ->> 'turno', 'aguardando', p_usuario_id, false
      );
    else
      update public.escala_itens set rota = upper(line_data ->> 'rota'), turno = line_data ->> 'turno'
      where id = existing_item_id;
    end if;
    existing_item_id := null;
    total := total + 1;
  end loop;
  perform public.patio_registrar_auditoria(
    'log-' || gen_random_uuid()::text, p_usuario_id, 'escala.importada',
    'escala', v_escala_id, null, jsonb_build_object('data', p_data, 'linhas', total)
  );
end;
$$;

create or replace function public.adicionar_item_avulso(
  p_escala_id text, p_escala_data date, p_usuario_id uuid, p_item_id text,
  p_motorista_id text, p_motorista jsonb, p_rota text, p_turno text
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_escala_id text; v_motorista_id text;
begin
  if auth.uid() is distinct from p_usuario_id or not public.patio_tem_papel(array['analista']) then
    raise exception 'Somente analistas podem editar escalas.' using errcode = '42501';
  end if;
  insert into public.escalas (id, data, criada_por, origem)
  values (p_escala_id, p_escala_data, p_usuario_id, 'manual') on conflict (data) do nothing;
  select e.id into v_escala_id from public.escalas e where e.data = p_escala_data;
  insert into public.motoristas (id, driver_id, nome, veiculo_modelo, veiculo_cor, placa, telefone)
  values (
    p_motorista_id, upper(p_motorista ->> 'driverId'), p_motorista ->> 'nome',
    p_motorista ->> 'veiculoModelo', coalesce(p_motorista ->> 'veiculoCor', ''),
    p_motorista ->> 'placa', p_motorista ->> 'telefone'
  )
  on conflict (driver_id) do update set
    nome = excluded.nome, veiculo_modelo = excluded.veiculo_modelo,
    veiculo_cor = excluded.veiculo_cor, placa = excluded.placa, telefone = excluded.telefone,
    atualizado_em = now()
  returning id into v_motorista_id;
  insert into public.escala_itens (
    id, escala_id, motorista_id, rota, turno, status, adicionado_por, avulso
  ) values (p_item_id, v_escala_id, v_motorista_id, upper(p_rota), p_turno, 'aguardando', p_usuario_id, true);
end;
$$;

create or replace function public.editar_item(
  p_escala_item_id text, p_usuario_id uuid, p_motorista jsonb, p_rota text, p_turno text
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare item public.escala_itens%rowtype; driver public.motoristas%rowtype;
  before_json jsonb; after_json jsonb;
begin
  if auth.uid() is distinct from p_usuario_id or not public.patio_tem_papel(array['analista']) then
    raise exception 'Somente analistas podem editar escalas.' using errcode = '42501';
  end if;
  select * into item from public.escala_itens where id = p_escala_item_id and removido_em is null for update;
  if not found then return; end if;
  select * into driver from public.motoristas where id = item.motorista_id for update;
  before_json := jsonb_build_object(
    'driverId', driver.driver_id, 'nome', driver.nome, 'veiculoModelo', driver.veiculo_modelo,
    'veiculoCor', driver.veiculo_cor, 'placa', driver.placa, 'rota', item.rota, 'turno', item.turno
  );
  update public.motoristas set
    driver_id = coalesce(p_motorista ->> 'driverId', driver_id),
    nome = coalesce(p_motorista ->> 'nome', nome),
    veiculo_modelo = coalesce(p_motorista ->> 'veiculoModelo', veiculo_modelo),
    veiculo_cor = coalesce(p_motorista ->> 'veiculoCor', veiculo_cor),
    placa = coalesce(p_motorista ->> 'placa', placa),
    telefone = case when p_motorista ? 'telefone' then p_motorista ->> 'telefone' else telefone end,
    atualizado_em = now()
  where id = driver.id;
  -- The RPC records both the old and new driver snapshot in one audit event.
  -- Suppress the generic row trigger to avoid a second, less accurate record.
  perform set_config('patio.silenciar_auditoria_item', 'on', true);
  update public.escala_itens set
    rota = coalesce(upper(p_rota), rota), turno = coalesce(p_turno, turno)
  where id = item.id;
  select * into driver from public.motoristas where id = item.motorista_id;
  after_json := jsonb_build_object(
    'driverId', driver.driver_id, 'nome', driver.nome, 'veiculoModelo', driver.veiculo_modelo,
    'veiculoCor', driver.veiculo_cor, 'placa', driver.placa,
    'rota', coalesce(upper(p_rota), item.rota), 'turno', coalesce(p_turno, item.turno)
  );
  perform public.patio_registrar_auditoria(
    'log-' || gen_random_uuid()::text, p_usuario_id, 'escala.item_editado',
    'escala_item', item.id, before_json, after_json
  );
end;
$$;

create or replace function public.remover_item(p_escala_item_id text, p_usuario_id uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is distinct from p_usuario_id or not public.patio_tem_papel(array['analista']) then
    raise exception 'Somente analistas podem remover itens.' using errcode = '42501';
  end if;
  update public.escala_itens set removido_em = now()
  where id = p_escala_item_id and removido_em is null;
  return found;
end;
$$;

create or replace function public.remover_itens_do_dia(p_data date, p_usuario_id uuid)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare removed integer;
begin
  if auth.uid() is distinct from p_usuario_id or not public.patio_tem_papel(array['analista']) then
    raise exception 'Somente analistas podem remover itens.' using errcode = '42501';
  end if;
  update public.escala_itens i set removido_em = now()
  from public.escalas e where e.id = i.escala_id and e.data = p_data and i.removido_em is null;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

create or replace function public.registrar_checkin(
  p_id text, p_escala_item_id text, p_fiscal_id uuid, p_resultado text,
  p_observacao text, p_divergencias jsonb
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare item public.escala_itens%rowtype; driver public.motoristas%rowtype;
  divergence jsonb; irregularity_id text; expected_value text;
  next_status text; checkin_time timestamptz := now();
begin
  if auth.uid() is distinct from p_fiscal_id or not public.patio_tem_papel(array['fiscal']) then
    raise exception 'Somente o fiscal autenticado pode registrar check-in.' using errcode = '42501';
  end if;
  select * into item from public.escala_itens
  where id = p_escala_item_id and removido_em is null for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'Item de escala não encontrado.'); end if;
  if item.status = 'bloqueado' then
    return jsonb_build_object('ok', false, 'erro', 'Item bloqueado: só um analista ou líder pode resolver o bloqueio.');
  end if;
  next_status := case when p_resultado = 'conforme' then 'liberado' else 'bloqueado' end;
  select * into driver from public.motoristas where id = item.motorista_id;
  insert into public.checkins (id, escala_item_id, fiscal_id, em, resultado, observacao)
  values (p_id, item.id, p_fiscal_id, checkin_time, p_resultado, p_observacao);
  perform set_config('patio.silenciar_auditoria_item', 'on', true);
  update public.escala_itens set status = next_status where id = item.id;
  perform public.patio_registrar_auditoria(
    'log-' || gen_random_uuid()::text, p_fiscal_id, 'checkin.registrado',
    'escala_item', item.id, jsonb_build_object('status', item.status),
    jsonb_build_object('resultado', p_resultado, 'status', next_status)
  );
  for divergence in select value from jsonb_array_elements(coalesce(p_divergencias, '[]'::jsonb))
  loop
    expected_value := case divergence ->> 'tipo'
      when 'placa' then driver.placa
      when 'veiculo' then concat_ws(' ', driver.veiculo_modelo, nullif(driver.veiculo_cor, ''))
      when 'nome' then driver.nome
      when 'id' then driver.driver_id
      when 'ocupante' then 'Somente o driver'
      else null
    end;
    if expected_value is null then raise exception 'Tipo de irregularidade inválido.'; end if;
    irregularity_id := divergence ->> 'id';
    insert into public.irregularidades (id, checkin_id, escala_item_id, tipo, esperado, encontrado)
    values (irregularity_id, p_id, item.id, divergence ->> 'tipo', expected_value, divergence ->> 'encontrado');
    perform public.patio_registrar_auditoria(
      'log-' || gen_random_uuid()::text, p_fiscal_id, 'irregularidade.reportada',
      'irregularidade', irregularity_id, null,
      jsonb_build_object('tipo', divergence ->> 'tipo', 'esperado', expected_value, 'encontrado', divergence ->> 'encontrado')
    );
  end loop;
  return jsonb_build_object('ok', true, 'status', next_status);
end;
$$;

create or replace function public.resolver_bloqueio(
  p_id text, p_irregularidade_id text, p_usuario_id uuid,
  p_decisao text, p_justificativa text
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare irr public.irregularidades%rowtype; item public.escala_itens%rowtype; next_status text;
  user_role text;
begin
  if auth.uid() is distinct from p_usuario_id or not public.patio_perfil_ativo() then
    raise exception 'Sessão autenticada inválida para resolver bloqueio.' using errcode = '42501';
  end if;
  select p.papel into user_role from public.profiles p where p.id = auth.uid();
  if user_role <> 'analista' then
    return jsonb_build_object('ok', false, 'erro',
      case when user_role = 'fiscal'
        then 'Fiscal de pátio não pode resolver bloqueio. Acione um analista.'
        else 'Liderança acompanha o pátio, mas quem resolve bloqueio é o analista.'
      end);
  end if;
  select * into irr from public.irregularidades where id = p_irregularidade_id;
  if not found then return jsonb_build_object('ok', false, 'erro', 'Irregularidade não encontrada.'); end if;
  select * into item from public.escala_itens where id = irr.escala_item_id for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'Item de escala não encontrado.'); end if;
  if item.status <> 'bloqueado' then return jsonb_build_object('ok', false, 'erro', 'Este item não está bloqueado.'); end if;
  if length(trim(coalesce(p_justificativa, ''))) < 10 then
    return jsonb_build_object('ok', false, 'erro', 'Justificativa obrigatória, com pelo menos 10 caracteres.');
  end if;
  next_status := case when p_decisao = 'liberado' then 'liberado_com_ressalva' else 'bloqueado' end;
  insert into public.liberacoes (id, irregularidade_id, analista_id, em, justificativa, decisao)
  values (p_id, irr.id, p_usuario_id, now(), p_justificativa, p_decisao);
  perform set_config('patio.silenciar_auditoria_item', 'on', true);
  update public.escala_itens set status = next_status where id = item.id;
  perform public.patio_registrar_auditoria(
    'log-' || gen_random_uuid()::text, p_usuario_id,
    case when p_decisao = 'liberado' then 'bloqueio.liberado' else 'bloqueio.mantido' end,
    'irregularidade', irr.id, jsonb_build_object('status', item.status),
    jsonb_build_object('status', next_status, 'justificativa', p_justificativa)
  );
  return jsonb_build_object('ok', true, 'status', next_status);
end;
$$;

revoke all on function public.importar_escala(text, date, uuid, jsonb) from public, anon;
revoke all on function public.adicionar_item_avulso(text, date, uuid, text, text, jsonb, text, text) from public, anon;
revoke all on function public.editar_item(text, uuid, jsonb, text, text) from public, anon;
revoke all on function public.remover_item(text, uuid) from public, anon;
revoke all on function public.remover_itens_do_dia(date, uuid) from public, anon;
revoke all on function public.registrar_checkin(text, text, uuid, text, text, jsonb) from public, anon;
revoke all on function public.resolver_bloqueio(text, text, uuid, text, text) from public, anon;
grant execute on function public.importar_escala(text, date, uuid, jsonb) to authenticated;
grant execute on function public.adicionar_item_avulso(text, date, uuid, text, text, jsonb, text, text) to authenticated;
grant execute on function public.editar_item(text, uuid, jsonb, text, text) to authenticated;
grant execute on function public.remover_item(text, uuid) to authenticated;
grant execute on function public.remover_itens_do_dia(date, uuid) to authenticated;
grant execute on function public.registrar_checkin(text, text, uuid, text, text, jsonb) to authenticated;
grant execute on function public.resolver_bloqueio(text, text, uuid, text, text) to authenticated;

-- Turn on row-level changes so SupabaseDataSource.subscribe() refreshes on
-- actual database mutations. Existing Supabase projects already have this publication.
do $$
declare table_name text;
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables
  ) then
    foreach table_name in array array[
      'profiles', 'motoristas', 'escalas', 'escala_itens',
      'checkins', 'irregularidades', 'liberacoes', 'auditoria'
    ] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end;
$$;

-- Role administration is an operator action, never an anon-key/browser update:
-- update public.profiles set papel = 'analista' where id = '<auth user UUID>';
