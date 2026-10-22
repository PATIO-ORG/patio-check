-- Primeiro acesso sem e-mail: a conta nasce (ou é redefinida pelo Líder) com
-- precisa_senha = true. Enquanto isso for verdadeiro, a pessoa entra só com o e-mail
-- e é obrigada a criar uma senha; ao criar, a flag volta a false.
alter table public.profiles
  add column if not exists precisa_senha boolean not null default false;
