-- Todo evento pertence a uma empresa. Em 2026-10-06 produção tinha 0 eventos, por isso o
-- `not null` entra direto, sem preencher linhas antigas.
alter table eventos add column empresa_id uuid not null references empresas (id) on delete restrict;
create index eventos_empresa on eventos (empresa_id);
