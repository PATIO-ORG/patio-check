insert into public.usuarios (id, nome, email, papel)
values
  (
    '499ede14-0b36-4cf0-80c2-040af5c7c6a5',
    'Fiscal do Pátio',
    'fiscal@empresa.com',
    'fiscal'
  ),
  (
    '29026c5b-ae55-42ce-9f10-bb149d397d62',
    'Analista do Pátio',
    'analista@empresa.com',
    'analista'
  )
on conflict (id) do update
set
  nome = excluded.nome,
  email = excluded.email,
  papel = excluded.papel,
  ativo = true;
