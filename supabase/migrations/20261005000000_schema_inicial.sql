-- CRM de eventos: esquema inicial.
-- RLS ligado sem política: a API pública do Supabase (anon/authenticated) não lê nem escreve nada.
-- Só o servidor Next.js, com a chave service_role (que ignora RLS), acessa as tabelas.

create type tipo_participante as enum ('palestrante', 'vip', 'autoridade', 'convidado');

create type tipo_evento as enum (
  'palestra', 'workshop', 'treinamento', 'kickoff', 'lancamento',
  'premiacao_incentivo', 'demonstracao_produto', 'feedback'
);

create table empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  created_at timestamptz not null default now()
);
create unique index empresas_nome_unico on empresas (lower(nome));

create table participantes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  -- nome sem acento e minúsculo, preenchido pelo app (normalizarBusca); é onde a busca roda.
  nome_busca text not null,
  documento text not null unique check (documento ~ '^[0-9A-Z]+$'),
  data_nascimento date,
  email text,
  telefone text,
  empresa_id uuid references empresas (id) on delete restrict,
  tipo tipo_participante not null,
  created_at timestamptz not null default now()
);
create index participantes_empresa on participantes (empresa_id);

create table eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  tipo tipo_evento not null,
  data date not null,
  created_at timestamptz not null default now()
);

create table inscricoes (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references participantes (id) on delete cascade,
  evento_id uuid not null references eventos (id) on delete cascade,
  codigo text not null unique,
  checkin_em timestamptz,
  email_enviado_em timestamptz,
  email_erro text,
  created_at timestamptz not null default now(),
  unique (participante_id, evento_id)
);
create index inscricoes_evento on inscricoes (evento_id);

alter table empresas enable row level security;
alter table participantes enable row level security;
alter table eventos enable row level security;
alter table inscricoes enable row level security;
