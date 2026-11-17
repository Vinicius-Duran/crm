-- Fatia 1 do SaaS, Tarefa 2: isola empresas/eventos/participantes por conta (RLS).
-- Dados existentes (empresa VM Events) vão para a conta vm-events (ver migração anterior).

alter table empresas add column conta_id uuid references contas (id) on delete cascade;
alter table eventos add column conta_id uuid references contas (id) on delete cascade;
alter table participantes add column conta_id uuid references contas (id) on delete cascade;

update empresas set conta_id = (select id from contas where slug = 'vm-events');
update eventos set conta_id = (select id from contas where slug = 'vm-events');
update participantes set conta_id = (select id from contas where slug = 'vm-events');

alter table empresas alter column conta_id set not null;
alter table eventos alter column conta_id set not null;
alter table participantes alter column conta_id set not null;

alter table empresas alter column conta_id set default conta_atual();
alter table eventos alter column conta_id set default conta_atual();
alter table participantes alter column conta_id set default conta_atual();

create index empresas_conta on empresas (conta_id);
create index eventos_conta on eventos (conta_id);
create index participantes_conta on participantes (conta_id);

drop index empresas_nome_unico;
create unique index empresas_nome_unico on empresas (conta_id, lower(nome));

create policy "conta" on empresas for all to authenticated using (conta_id = conta_atual()) with check (conta_id = conta_atual());
create policy "conta" on eventos for all to authenticated using (conta_id = conta_atual()) with check (conta_id = conta_atual());
create policy "conta" on participantes for all to authenticated using (conta_id = conta_atual()) with check (conta_id = conta_atual());
