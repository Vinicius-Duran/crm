-- Fatia 1 do SaaS: contas e usuários. Não toca nas tabelas de eventos (migração B faz isso).

create type papel_usuario as enum ('dono', 'barbeiro');

create table contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  -- único, usado também como identificador da página pública de agendamento.
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  modulos text[] not null default '{}',
  fuso text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now()
);

create table usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  conta_id uuid not null references contas (id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  papel papel_usuario not null,
  admin_plataforma boolean not null default false,
  created_at timestamptz not null default now()
);
create index usuarios_conta on usuarios (conta_id);

-- security definer: lê usuarios por auth.uid() mesmo com RLS ligado, para as políticas abaixo.
create function conta_atual()
returns uuid
language sql stable security definer set search_path = public
as $$
  select conta_id from usuarios where id = auth.uid();
$$;
revoke all on function conta_atual() from public;
grant execute on function conta_atual() to authenticated;

create function papel_atual()
returns papel_usuario
language sql stable security definer set search_path = public
as $$
  select papel from usuarios where id = auth.uid();
$$;
revoke all on function papel_atual() from public;
grant execute on function papel_atual() to authenticated;

alter table contas enable row level security;
alter table usuarios enable row level security;

-- Sem política de escrita: contas e usuários só são criados/alterados pelo service_role.
create policy "conta propria" on contas for select to authenticated using (id = conta_atual());
create policy "usuarios da propria conta" on usuarios for select to authenticated using (conta_id = conta_atual());

insert into contas (nome, slug, modulos) values ('VM Events', 'vm-events', '{eventos}');
