-- Super Admin com poder total sobre o sistema.
-- Requer a migração 20261021200000_super_admin.sql já aplicada.
-- Toda checagem de papel das RPCs/policies passa por patio_tem_papel(): o Super Admin
-- ativo passa em qualquer uma (importar escala, editar itens, check-in etc.).

create or replace function public.patio_tem_papel(papeis text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.ativo
      and (p.papel = any (papeis) or p.papel = 'super_admin')
  );
$$;

-- resolver_bloqueio checava o papel direto; agora aceita também o Super Admin.
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
  if user_role not in ('analista', 'super_admin') then
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
