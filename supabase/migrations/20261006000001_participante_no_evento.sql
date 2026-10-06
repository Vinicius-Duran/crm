-- O participante pertence ao evento: a inscrição deixa de existir e o que era dela (código do QR,
-- check-in, status do e-mail) vira coluna do participante. Em 2026-10-06 produção tinha 0
-- participantes e 0 inscrições, por isso as tabelas são recriadas em vez de migradas.
drop table inscricoes;
drop table participantes;

create table participantes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos (id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  -- nome sem acento e minúsculo, preenchido pelo app (normalizarBusca); é onde a busca roda.
  nome_busca text not null,
  documento text not null check (documento ~ '^[0-9A-Z]+$'),
  data_nascimento date,
  email text,
  telefone text,
  -- Onde a pessoa trabalha, em texto livre. Não é a empresa cliente dona do evento.
  empresa text,
  tipo tipo_participante not null,
  -- O check-in procura só pelo código, por isso ele é único no banco inteiro.
  codigo text not null unique,
  checkin_em timestamptz,
  email_enviado_em timestamptz,
  email_erro text,
  created_at timestamptz not null default now(),
  unique (evento_id, documento)
);

alter table participantes enable row level security;
