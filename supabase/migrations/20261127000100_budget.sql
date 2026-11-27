-- AgroCentral — Orçamento e planejamento rural (MICRO / MACRO / RESUMO)
--
-- Princípios:
--  * O ORÇADO vive em budget_lines (despesas e receitas previstas, com quantidade × valor unitário
--    calculado no banco como coluna gerada).
--  * O REALIZADO não é duplicado: vem de public.transactions (Financeiro). Um lançamento financeiro
--    pode apontar para a linha do orçamento que ele executa (transactions.budget_line_id).
--  * Cenários (conservador/realista/otimista/personalizado) são ajustes percentuais sobre o orçamento
--    base — nunca cópias dos dados.
--  * Mesmas regras de isolamento do restante da plataforma: RLS por organização, propriedade e papel.

-- ---------------------------------------------------------------------------
-- Módulo e permissões
-- ---------------------------------------------------------------------------
alter table public.organizations alter column enabled_modules set default array[
  'dashboard','farms','fields','seasons','activities','tasks','team','finance','budget','inventory',
  'equipment','documents','weather','market','marketplace','calculators','reports','notifications'
];
update public.organizations set enabled_modules = array_append(enabled_modules, 'budget')
  where not ('budget' = any (enabled_modules));

insert into public.role_permissions (role, module, actions) values
  ('owner',      'budget', array['view','create','edit','delete','export','admin']),
  ('admin',      'budget', array['view','create','edit','delete','export','admin']),
  ('finance',    'budget', array['view','create','edit','delete','export']),
  ('manager',    'budget', array['view','create','edit','export']),
  ('agronomist', 'budget', array['view','export']),
  ('viewer',     'budget', array['view'])
on conflict (role, module) do nothing;

-- ---------------------------------------------------------------------------
-- Categorias de despesa complementares (globais, compartilhadas com o Financeiro)
-- ---------------------------------------------------------------------------
insert into public.financial_categories (kind, slug, name) values
  ('despesa','corretivos','Corretivos de solo'),
  ('despesa','lubrificantes','Lubrificantes'),
  ('despesa','salarios_encargos','Salários e encargos'),
  ('despesa','maquinas_equipamentos','Máquinas e equipamentos'),
  ('despesa','pecas_servicos','Peças e serviços'),
  ('despesa','agua','Água'),
  ('despesa','irrigacao','Irrigação'),
  ('despesa','armazenagem','Armazenagem'),
  ('despesa','seguros','Seguros'),
  ('despesa','administrativas','Despesas administrativas'),
  ('despesa','investimentos','Investimentos')
on conflict (slug) where organization_id is null do nothing;

-- ---------------------------------------------------------------------------
-- Linhas do orçamento (MICRO)
-- ---------------------------------------------------------------------------
create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  season_id uuid,
  field_id uuid,
  crop_id uuid references public.crops(id) on delete set null,
  activity_id uuid,
  category_id uuid not null references public.financial_categories(id) on delete restrict,
  subcategory text check (subcategory is null or char_length(subcategory) <= 80),
  contact_id uuid,
  inventory_item_id uuid,
  equipment_id uuid,
  kind text not null default 'despesa' check (kind in ('despesa','receita')),
  expense_type text not null default 'custeio' check (expense_type in ('custeio','investimento','financiamento','administrativo','receita')),
  description text not null check (char_length(btrim(description)) between 2 and 240),
  unit text check (unit is null or char_length(unit) <= 12),
  quantity numeric(16,4) not null default 1 check (quantity > 0),
  unit_price numeric(16,4) not null check (unit_price >= 0),
  -- Cálculo no banco: nunca depende do navegador
  total_amount numeric(16,2) generated always as (round(quantity * unit_price, 2)) stored,
  planned_date date not null,
  actual_date date,
  payment_method text check (payment_method in ('dinheiro','pix','boleto','transferencia','cartao','cheque','permuta','outro')),
  payment_terms text check (payment_terms is null or char_length(payment_terms) <= 80),
  installments int not null default 1 check (installments between 1 and 120),
  recurrence text not null default 'nenhuma' check (recurrence in ('nenhuma','mensal','trimestral','anual')),
  recurrence_group uuid,
  is_extraordinary boolean not null default false,
  status text not null default 'previsto' check (status in ('previsto','aprovado','realizado','cancelado')),
  notes text check (notes is null or char_length(notes) <= 2000),
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (status <> 'realizado' or actual_date is not null),
  check ((kind = 'receita') = (expense_type = 'receita')),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete cascade,
  foreign key (organization_id, season_id) references public.seasons(organization_id, id) on delete set null (season_id),
  foreign key (organization_id, field_id) references public.fields(organization_id, id) on delete set null (field_id),
  foreign key (organization_id, activity_id) references public.activities(organization_id, id) on delete set null (activity_id),
  foreign key (organization_id, contact_id) references public.contacts(organization_id, id) on delete set null (contact_id),
  foreign key (organization_id, inventory_item_id) references public.inventory_items(organization_id, id) on delete set null (inventory_item_id),
  foreign key (organization_id, equipment_id) references public.equipment(organization_id, id) on delete set null (equipment_id)
);
create index budget_lines_org_date_idx on public.budget_lines(organization_id, planned_date);
create index budget_lines_season_idx on public.budget_lines(season_id);
create index budget_lines_farm_idx on public.budget_lines(farm_id);
create index budget_lines_category_idx on public.budget_lines(category_id);
select private.apply_std_policies('budget_lines', 'budget', true);
create trigger budget_lines_audit after insert or update or delete on public.budget_lines for each row execute function private.audit_row();
create trigger budget_lines_links before insert or update on public.budget_lines for each row execute function private.check_farm_links();

-- Regras: categoria compatível com o tipo; cultura herdada da safra; data efetiva só quando realizado.
create or replace function private.check_budget_line()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  ck text; corg uuid;
begin
  select kind, organization_id into ck, corg from public.financial_categories where id = new.category_id;
  if ck is distinct from new.kind then
    raise exception 'Categoria incompatível com o tipo da linha do orçamento' using errcode = '23514';
  end if;
  if corg is not null and corg <> new.organization_id then
    raise exception 'Categoria de outra organização' using errcode = '42501';
  end if;
  if new.kind = 'receita' then new.expense_type := 'receita'; end if;
  if new.kind = 'despesa' and new.expense_type = 'receita' then new.expense_type := 'custeio'; end if;
  if new.crop_id is null and new.season_id is not null then
    select crop_id into new.crop_id from public.seasons where id = new.season_id;
  end if;
  if new.status = 'realizado' and new.actual_date is null then new.actual_date := current_date; end if;
  if new.status in ('previsto','aprovado') then new.actual_date := null; end if;
  return new;
end $$;
create trigger budget_lines_rules before insert or update on public.budget_lines
  for each row execute function private.check_budget_line();

-- ---------------------------------------------------------------------------
-- Realizado = Financeiro. Vínculo opcional do lançamento com a linha orçada.
-- ---------------------------------------------------------------------------
alter table public.transactions add column budget_line_id uuid;
alter table public.transactions add constraint transactions_budget_line_fk
  foreign key (organization_id, budget_line_id) references public.budget_lines(organization_id, id) on delete set null (budget_line_id);
create index transactions_budget_line_idx on public.transactions(budget_line_id) where budget_line_id is not null;

create or replace function private.check_transaction_budget_line()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  bk text;
begin
  if new.budget_line_id is null then return new; end if;
  select kind into bk from public.budget_lines where id = new.budget_line_id and organization_id = new.organization_id;
  if bk is null then
    raise exception 'Linha do orçamento não encontrada' using errcode = '23503';
  end if;
  if bk <> new.kind then
    raise exception 'O lançamento e a linha do orçamento devem ser do mesmo tipo' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger transactions_budget_line before insert or update of budget_line_id, kind on public.transactions
  for each row execute function private.check_transaction_budget_line();

-- A view do Financeiro passa a expor o vínculo (recriada com as mesmas colunas + budget_line_id)
drop view if exists public.transactions_v;
create view public.transactions_v with (security_invoker = true) as
select t.*,
  case
    when t.status = 'pago' then 'pago'
    when t.status = 'cancelado' then 'cancelado'
    when t.due_date < current_date then 'vencido'
    when t.due_date <= current_date + 7 then 'vence_em_breve'
    else 'em_aberto'
  end as situation,
  c.name as category_name
from public.transactions t
join public.financial_categories c on c.id = t.category_id;

-- create_transactions passa a aceitar budget_line_id (mesma assinatura, invoker → RLS do chamador)
create or replace function public.create_transactions(p_rows jsonb)
returns int language plpgsql security invoker
set search_path = ''
as $$
declare
  n int;
begin
  if jsonb_array_length(p_rows) > 120 then raise exception 'Máximo de 120 parcelas por lançamento' using errcode = '54000'; end if;
  insert into public.transactions (organization_id, farm_id, season_id, field_id, crop_id, cost_center_id, category_id, contact_id, account_id,
    kind, description, amount, quantity, quantity_unit, issue_date, due_date, paid_date, status, payment_method, document_number,
    installment_number, installment_count, installment_group, notes, activity_id, budget_line_id)
  select r.organization_id, r.farm_id, r.season_id, r.field_id, r.crop_id, r.cost_center_id, r.category_id, r.contact_id, r.account_id,
    r.kind, r.description, r.amount, r.quantity, r.quantity_unit, coalesce(r.issue_date, current_date), r.due_date, r.paid_date, coalesce(r.status, 'pendente'),
    r.payment_method, r.document_number, r.installment_number, r.installment_count, r.installment_group, r.notes, r.activity_id, r.budget_line_id
  from jsonb_populate_recordset(null::public.transactions, p_rows) r;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.create_transactions(jsonb) to authenticated;

-- Visão MICRO com valores realizados agregados do Financeiro (RLS do chamador em ambas as tabelas)
create view public.budget_lines_v with (security_invoker = true) as
select b.*,
  c.name as category_name,
  c.slug as category_slug,
  coalesce(r.realized, 0)::numeric(16,2) as realized_amount,
  coalesce(r.paid, 0)::numeric(16,2) as paid_amount,
  coalesce(r.tx_count, 0)::int as tx_count
from public.budget_lines b
join public.financial_categories c on c.id = b.category_id
left join lateral (
  select sum(t.amount) as realized,
         sum(t.amount) filter (where t.status = 'pago') as paid,
         count(*) as tx_count
  from public.transactions t
  where t.budget_line_id = b.id and t.status <> 'cancelado' and t.archived_at is null
) r on true;

-- ---------------------------------------------------------------------------
-- Cenários (ajustes percentuais sobre o orçamento base)
-- ---------------------------------------------------------------------------
create table public.budget_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  season_id uuid,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  kind text not null default 'personalizado' check (kind in ('conservador','realista','otimista','personalizado')),
  price_pct numeric(7,2) not null default 0 check (price_pct between -100 and 500),
  yield_pct numeric(7,2) not null default 0 check (yield_pct between -100 and 500),
  cost_pct numeric(7,2) not null default 0 check (cost_pct between -100 and 500),
  -- { "<category_id>": -10, ... } ajuste específico por categoria (soma ao cost_pct)
  category_pct jsonb not null default '{}'::jsonb check (jsonb_typeof(category_pct) = 'object'),
  -- investimento adicional simulado (R$) — "e se eu comprar…"
  extra_investment numeric(16,2) not null default 0 check (extra_investment >= 0),
  notes text check (notes is null or char_length(notes) <= 2000),
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete cascade,
  foreign key (organization_id, season_id) references public.seasons(organization_id, id) on delete cascade
);
create index budget_scenarios_org_idx on public.budget_scenarios(organization_id);
select private.apply_std_policies('budget_scenarios', 'budget', true);
create trigger budget_scenarios_audit after insert or update or delete on public.budget_scenarios for each row execute function private.audit_row();

-- check_farm_links usa new.field_id; cenários não têm talhão — função própria e enxuta
create or replace function private.check_scenario_links()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.farm_id is null and new.season_id is not null then
    select farm_id into new.farm_id from public.seasons where id = new.season_id;
  end if;
  if new.season_id is not null and not exists (select 1 from public.seasons s where s.id = new.season_id and s.farm_id = new.farm_id) then
    raise exception 'A safra não pertence à propriedade informada' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger budget_scenarios_links before insert or update on public.budget_scenarios
  for each row execute function private.check_scenario_links();

-- ---------------------------------------------------------------------------
-- Criação em lote (recorrências) — invoker: RLS e triggers do chamador valem para cada linha
-- ---------------------------------------------------------------------------
create or replace function public.create_budget_lines(p_rows jsonb)
returns int language plpgsql security invoker
set search_path = ''
as $$
declare
  n int;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Nenhuma linha informada' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 60 then raise exception 'Máximo de 60 linhas por operação' using errcode = '54000'; end if;
  insert into public.budget_lines (organization_id, farm_id, season_id, field_id, crop_id, activity_id, category_id, subcategory, contact_id,
    inventory_item_id, equipment_id, kind, expense_type, description, unit, quantity, unit_price, planned_date, actual_date, payment_method,
    payment_terms, installments, recurrence, recurrence_group, is_extraordinary, status, notes)
  select r.organization_id, r.farm_id, r.season_id, r.field_id, r.crop_id, r.activity_id, r.category_id, r.subcategory, r.contact_id,
    r.inventory_item_id, r.equipment_id, coalesce(r.kind, 'despesa'), coalesce(r.expense_type, 'custeio'), r.description, r.unit,
    coalesce(r.quantity, 1), r.unit_price, r.planned_date, r.actual_date, r.payment_method, r.payment_terms, coalesce(r.installments, 1),
    coalesce(r.recurrence, 'nenhuma'), r.recurrence_group, coalesce(r.is_extraordinary, false), coalesce(r.status, 'previsto'), r.notes
  from jsonb_to_recordset(p_rows) as r(
    organization_id uuid, farm_id uuid, season_id uuid, field_id uuid, crop_id uuid, activity_id uuid, category_id uuid, subcategory text,
    contact_id uuid, inventory_item_id uuid, equipment_id uuid, kind text, expense_type text, description text, unit text, quantity numeric,
    unit_price numeric, planned_date date, actual_date date, payment_method text, payment_terms text, installments int, recurrence text,
    recurrence_group uuid, is_extraordinary boolean, status text, notes text);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.create_budget_lines(jsonb) from public, anon;
grant execute on function public.create_budget_lines(jsonb) to authenticated;
