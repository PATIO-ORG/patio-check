-- Perfil Super Admin: acima de Líder, Fiscal e Analista.
-- Só é criado aqui, direto no banco (nunca pela tela de Colaboradores):
--   update public.profiles set papel = 'super_admin' where email = '...';
-- Faça o update DEPOIS de aplicar esta migração.

alter table public.profiles drop constraint if exists profiles_papel_check;
alter table public.profiles
  add constraint profiles_papel_check
  check (papel in ('fiscal', 'analista', 'lider', 'super_admin'));
