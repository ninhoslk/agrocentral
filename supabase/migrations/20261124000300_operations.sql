-- AgroCentral — Etapa 3: Operação (equipe, contatos, estoque, máquinas, diário de campo, tarefas)

-- ---------------------------------------------------------------------------
-- Equipe
-- ---------------------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  role_title text,
  phone text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status text not null default 'ativo' check (status in ('ativo','inativo','afastado')),
  hire_date date,
  hourly_cost numeric(10,2) check (hourly_cost >= 0),
  user_id uuid references auth.users(id) on delete set null,
  notes text,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete set null (farm_id)
);
select private.apply_std_policies('employees', 'team', true);

alter table public.seasons add constraint seasons_responsible_fk
  foreign key (organization_id, responsible_employee_id) references public.employees(organization_id, id) on delete set null (responsible_employee_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  leader_employee_id uuid,
  notes text,
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete set null (farm_id),
  foreign key (organization_id, leader_employee_id) references public.employees(organization_id, id) on delete set null (leader_employee_id)
);
select private.apply_std_policies('teams', 'team', true);

create table public.team_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null,
  employee_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (team_id, employee_id),
  foreign key (organization_id, team_id) references public.teams(organization_id, id) on delete cascade,
  foreign key (organization_id, employee_id) references public.employees(organization_id, id) on delete cascade
);
alter table public.team_members enable row level security;
create policy team_members_select on public.team_members for select to authenticated using (private.has_perm(organization_id, 'team', 'view'));
create policy team_members_insert on public.team_members for insert to authenticated with check (private.has_perm(organization_id, 'team', 'edit'));
create policy team_members_delete on public.team_members for delete to authenticated using (private.has_perm(organization_id, 'team', 'edit'));

-- ---------------------------------------------------------------------------
-- Contatos (fornecedores/clientes) — compartilhados por financeiro e estoque
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null default 'fornecedor' check (kind in ('fornecedor','cliente','ambos','outro')),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  document text,
  phone text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  city text,
  state char(2) check (state is null or state ~ '^[A-Z]{2}$'),
  notes text,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
alter table public.contacts enable row level security;
create policy contacts_select on public.contacts for select to authenticated
  using (private.has_perm(organization_id, 'finance', 'view') or private.has_perm(organization_id, 'inventory', 'view'));
create policy contacts_insert on public.contacts for insert to authenticated
  with check (private.has_perm(organization_id, 'finance', 'create') or private.has_perm(organization_id, 'inventory', 'create'));
create policy contacts_update on public.contacts for update to authenticated
  using (private.has_perm(organization_id, 'finance', 'edit') or private.has_perm(organization_id, 'inventory', 'edit'))
  with check (private.has_perm(organization_id, 'finance', 'edit') or private.has_perm(organization_id, 'inventory', 'edit'));
create policy contacts_delete on public.contacts for delete to authenticated
  using (private.has_perm(organization_id, 'finance', 'delete') or private.has_perm(organization_id, 'inventory', 'delete'));
create trigger contacts_touch before insert or update on public.contacts for each row execute function private.touch_row();

-- ---------------------------------------------------------------------------
-- Máquinas e equipamentos
-- ---------------------------------------------------------------------------
create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  kind text not null check (kind in ('trator','colheitadeira','pulverizador','plantadeira','implemento','caminhao','caminhonete','veiculo','irrigacao','outro')),
  brand text, model text,
  year int check (year between 1900 and 2100),
  serial_number text, plate text, identifier text,
  hour_meter numeric(12,1) not null default 0 check (hour_meter >= 0),
  odometer_km numeric(12,1) not null default 0 check (odometer_km >= 0),
  status text not null default 'ativo' check (status in ('ativo','em_manutencao','inativo','vendido')),
  acquisition_date date,
  acquisition_value numeric(14,2) check (acquisition_value >= 0),
  fuel_type text check (fuel_type in ('diesel','gasolina','etanol','eletrico','nenhum')),
  maintenance_interval_hours numeric(10,1) check (maintenance_interval_hours > 0),
  maintenance_interval_days int check (maintenance_interval_days > 0),
  last_maintenance_date date,
  last_maintenance_hours numeric(12,1),
  notes text,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete set null (farm_id)
);
select private.apply_std_policies('equipment', 'equipment', true);

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  equipment_id uuid not null,
  kind text not null check (kind in ('preventiva','corretiva')),
  status text not null default 'concluida' check (status in ('agendada','concluida','cancelada')),
  scheduled_date date,
  performed_date date,
  hour_meter numeric(12,1) check (hour_meter >= 0),
  description text not null check (char_length(btrim(description)) between 2 and 2000),
  parts_cost numeric(14,2) not null default 0 check (parts_cost >= 0),
  labor_cost numeric(14,2) not null default 0 check (labor_cost >= 0),
  total_cost numeric(14,2) generated always as (parts_cost + labor_cost) stored,
  provider text,
  notes text,
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'concluida' or performed_date is not null),
  check (status <> 'agendada' or scheduled_date is not null),
  foreign key (organization_id, equipment_id) references public.equipment(organization_id, id) on delete cascade
);
create index maintenance_equipment_idx on public.maintenance_records(equipment_id, performed_date desc);
select private.apply_std_policies('maintenance_records', 'equipment', true);

-- ---------------------------------------------------------------------------
-- Diário de campo (atividades)
-- ---------------------------------------------------------------------------
create table public.activity_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  slug text,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);
create unique index activity_types_global_uq on public.activity_types(slug) where organization_id is null;
alter table public.activity_types enable row level security;
create policy activity_types_select on public.activity_types for select to authenticated
  using (organization_id is null or private.is_org_member(organization_id));
create policy activity_types_insert on public.activity_types for insert to authenticated
  with check (organization_id is not null and private.has_perm(organization_id, 'settings', 'admin'));
create policy activity_types_delete on public.activity_types for delete to authenticated
  using (organization_id is not null and private.has_perm(organization_id, 'settings', 'admin'));

insert into public.activity_types (slug, name, color) values
  ('preparo','Preparo de solo','#8d6e63'),
  ('plantio','Plantio','#2e7d32'),
  ('adubacao','Adubação','#6d4c41'),
  ('pulverizacao','Pulverização / aplicação','#0277bd'),
  ('irrigacao','Irrigação','#0288d1'),
  ('inspecao','Inspeção / monitoramento','#f9a825'),
  ('controle_pragas','Controle de pragas e doenças','#c62828'),
  ('analise_solo','Análise de solo','#5d4037'),
  ('colheita','Colheita','#ef6c00'),
  ('manutencao','Manutenção','#546e7a'),
  ('outro','Outro','#757575');

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null,
  field_id uuid,
  season_id uuid,
  activity_type_id uuid not null references public.activity_types(id) on delete restrict,
  title text,
  status text not null default 'concluida' check (status in ('planejada','em_andamento','concluida','cancelada')),
  started_at timestamptz not null,
  ended_at timestamptz,
  responsible_employee_id uuid,
  team_id uuid,
  equipment_id uuid,
  area_worked_ha numeric(12,4) check (area_worked_ha >= 0),
  labor_cost numeric(14,2) not null default 0 check (labor_cost >= 0),
  other_cost numeric(14,2) not null default 0 check (other_cost >= 0),
  inputs_cost numeric(14,2) not null default 0,
  notes text,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (ended_at is null or ended_at >= started_at),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete cascade,
  foreign key (organization_id, field_id) references public.fields(organization_id, id) on delete restrict,
  foreign key (organization_id, season_id) references public.seasons(organization_id, id) on delete set null (season_id),
  foreign key (organization_id, responsible_employee_id) references public.employees(organization_id, id) on delete set null (responsible_employee_id),
  foreign key (organization_id, team_id) references public.teams(organization_id, id) on delete set null (team_id),
  foreign key (organization_id, equipment_id) references public.equipment(organization_id, id) on delete set null (equipment_id)
);
create index activities_farm_date_idx on public.activities(farm_id, started_at desc);
create index activities_field_idx on public.activities(field_id);
create index activities_season_idx on public.activities(season_id);
select private.apply_std_policies('activities', 'activities', true);
create trigger activities_audit after insert or update or delete on public.activities for each row execute function private.audit_row();

-- Coerência: talhão e safra precisam ser da mesma propriedade (e o talhão precisa estar na safra)
create or replace function private.check_farm_links()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.farm_id is null and new.field_id is not null then
    select farm_id into new.farm_id from public.fields where id = new.field_id;
  end if;
  if new.farm_id is null and new.season_id is not null then
    select farm_id into new.farm_id from public.seasons where id = new.season_id;
  end if;
  if new.field_id is not null and not exists (select 1 from public.fields f where f.id = new.field_id and f.farm_id = new.farm_id) then
    raise exception 'O talhão não pertence à propriedade informada' using errcode = '23514';
  end if;
  if new.season_id is not null and not exists (select 1 from public.seasons s where s.id = new.season_id and s.farm_id = new.farm_id) then
    raise exception 'A safra não pertence à propriedade informada' using errcode = '23514';
  end if;
  if new.season_id is not null and new.field_id is not null and not exists (
      select 1 from public.season_fields sf where sf.season_id = new.season_id and sf.field_id = new.field_id) then
    raise exception 'O talhão não está vinculado à safra selecionada' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger activities_links before insert or update on public.activities for each row execute function private.check_farm_links();

-- ---------------------------------------------------------------------------
-- Uso de máquinas
-- ---------------------------------------------------------------------------
create table public.equipment_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  equipment_id uuid not null,
  usage_date date not null,
  hours numeric(8,2) check (hours >= 0 and hours <= 24),
  hour_meter_end numeric(12,1) check (hour_meter_end >= 0),
  km numeric(10,1) check (km >= 0),
  fuel_liters numeric(10,2) check (fuel_liters >= 0),
  fuel_cost numeric(14,2) check (fuel_cost >= 0),
  operator_employee_id uuid,
  activity_id uuid,
  field_id uuid,
  notes text,
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hours is not null or hour_meter_end is not null or km is not null or fuel_liters is not null),
  foreign key (organization_id, equipment_id) references public.equipment(organization_id, id) on delete cascade,
  foreign key (organization_id, operator_employee_id) references public.employees(organization_id, id) on delete set null (operator_employee_id),
  foreign key (organization_id, activity_id) references public.activities(organization_id, id) on delete set null (activity_id),
  foreign key (organization_id, field_id) references public.fields(organization_id, id) on delete set null (field_id)
);
create index equipment_usage_eq_idx on public.equipment_usage(equipment_id, usage_date desc);
select private.apply_std_policies('equipment_usage', 'equipment', true);

-- Atualiza horímetro/hodômetro do equipamento (nunca regride).
create or replace function private.apply_equipment_usage()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  eq record;
begin
  select * into eq from public.equipment where id = new.equipment_id for update;
  if new.hour_meter_end is not null and new.hour_meter_end < eq.hour_meter and new.hours is null then
    raise exception 'Horímetro final (%) menor que o atual (%)', new.hour_meter_end, eq.hour_meter using errcode = '23514';
  end if;
  update public.equipment set
    hour_meter = greatest(hour_meter, coalesce(new.hour_meter_end, hour_meter + coalesce(new.hours, 0))),
    odometer_km = odometer_km + coalesce(new.km, 0)
  where id = new.equipment_id;
  return null;
end $$;
create trigger equipment_usage_apply after insert on public.equipment_usage for each row execute function private.apply_equipment_usage();

create or replace function private.apply_maintenance()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status = 'concluida' then
    update public.equipment e set
      last_maintenance_date = greatest(coalesce(e.last_maintenance_date, new.performed_date), new.performed_date),
      last_maintenance_hours = case when new.hour_meter is not null then greatest(coalesce(e.last_maintenance_hours, 0), new.hour_meter) else e.last_maintenance_hours end,
      hour_meter = greatest(e.hour_meter, coalesce(new.hour_meter, 0))
    where e.id = new.equipment_id;
  end if;
  return null;
end $$;
create trigger maintenance_apply after insert or update of status, performed_date, hour_meter on public.maintenance_records
  for each row execute function private.apply_maintenance();

create or replace function private.set_maintenance_farm()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  select farm_id into new.farm_id from public.equipment where id = new.equipment_id;
  return new;
end $$;
create trigger maintenance_farm before insert or update on public.maintenance_records for each row execute function private.set_maintenance_farm();
create trigger equipment_usage_farm before insert or update on public.equipment_usage for each row execute function private.set_maintenance_farm();

-- ---------------------------------------------------------------------------
-- Estoque
-- ---------------------------------------------------------------------------
create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  notes text,
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete set null (farm_id)
);
select private.apply_std_policies('inventory_locations', 'inventory', true);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  category text not null check (category in ('semente','fertilizante','defensivo','combustivel','lubrificante','peca','material','produto_colhido','outro')),
  unit text not null check (unit in ('kg','t','g','L','mL','un','sc','cx','m','bag')),
  current_quantity numeric(16,3) not null default 0,
  average_cost numeric(16,4) not null default 0 check (average_cost >= 0),
  min_quantity numeric(16,3) check (min_quantity >= 0),
  supplier_id uuid,
  location_id uuid,
  active_ingredient text,
  registration_number text,
  notes text,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (current_quantity >= 0),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete set null (farm_id),
  foreign key (organization_id, supplier_id) references public.contacts(organization_id, id) on delete set null (supplier_id),
  foreign key (organization_id, location_id) references public.inventory_locations(organization_id, id) on delete set null (location_id)
);
create index inventory_items_org_idx on public.inventory_items(organization_id, category);
select private.apply_std_policies('inventory_items', 'inventory', true);

-- Saldo e custo médio só mudam via movimentação.
create or replace function private.guard_inventory_balance()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if current_setting('app.stock_trigger', true) is distinct from 'on' then
      new.current_quantity := 0;
      new.average_cost := 0;
    end if;
  elsif (new.current_quantity is distinct from old.current_quantity or new.average_cost is distinct from old.average_cost)
        and current_setting('app.stock_trigger', true) is distinct from 'on' then
    raise exception 'Saldo e custo médio são atualizados somente por movimentações de estoque' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger inventory_items_guard before insert or update on public.inventory_items for each row execute function private.guard_inventory_balance();

create table public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  item_id uuid not null,
  lot_code text not null,
  expires_at date,
  quantity numeric(16,3) not null default 0 check (quantity >= 0),
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (item_id, lot_code),
  foreign key (organization_id, item_id) references public.inventory_items(organization_id, id) on delete cascade
);
select private.apply_std_policies('stock_lots', 'inventory', true);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  item_id uuid not null,
  kind text not null check (kind in ('entrada','saida','ajuste','transferencia')),
  quantity numeric(16,3) not null check (quantity <> 0),
  unit_cost numeric(16,4) check (unit_cost >= 0),
  total_cost numeric(16,2),
  balance_after numeric(16,3),
  lot_id uuid,
  lot_code text,
  lot_expires_at date,
  location_from_id uuid,
  location_to_id uuid,
  occurred_at timestamptz not null default now(),
  activity_id uuid,
  field_id uuid,
  season_id uuid,
  contact_id uuid,
  document_number text,
  notes text,
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'ajuste' or quantity > 0),
  check (kind <> 'transferencia' or location_to_id is not null),
  foreign key (organization_id, item_id) references public.inventory_items(organization_id, id) on delete cascade,
  foreign key (organization_id, lot_id) references public.stock_lots(organization_id, id) on delete set null (lot_id),
  foreign key (organization_id, activity_id) references public.activities(organization_id, id) on delete cascade,
  foreign key (organization_id, field_id) references public.fields(organization_id, id) on delete set null (field_id),
  foreign key (organization_id, season_id) references public.seasons(organization_id, id) on delete set null (season_id),
  foreign key (organization_id, contact_id) references public.contacts(organization_id, id) on delete set null (contact_id),
  foreign key (organization_id, location_from_id) references public.inventory_locations(organization_id, id) on delete set null (location_from_id),
  foreign key (organization_id, location_to_id) references public.inventory_locations(organization_id, id) on delete set null (location_to_id)
);
create index stock_movements_item_idx on public.stock_movements(item_id, occurred_at desc);
create index stock_movements_activity_idx on public.stock_movements(activity_id);
alter table public.stock_movements enable row level security;
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (private.has_perm(organization_id, 'inventory', 'view') and private.can_access_farm(organization_id, farm_id));
create policy stock_movements_insert on public.stock_movements for insert to authenticated
  with check (private.has_perm(organization_id, 'inventory', 'create') and private.can_access_farm(organization_id, farm_id));
-- Movimentações são imutáveis (correções via ajuste). Sem políticas de update/delete.
create trigger stock_movements_touch before insert on public.stock_movements for each row execute function private.touch_row();
create trigger stock_movements_audit after insert or delete on public.stock_movements for each row execute function private.audit_row();

-- Aplica a movimentação ao saldo dentro da mesma transação, com lock da linha do item.
create or replace function private.apply_stock_movement()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  it record;
  delta numeric;
  new_qty numeric;
  lot record;
begin
  select * into it from public.inventory_items where id = new.item_id for update;
  if not found then raise exception 'Item de estoque não encontrado' using errcode = '23503'; end if;
  if it.archived_at is not null then raise exception 'Item arquivado não aceita movimentações' using errcode = '23514'; end if;
  if new.farm_id is null then new.farm_id := it.farm_id; end if;

  delta := case new.kind when 'entrada' then new.quantity when 'saida' then -new.quantity when 'ajuste' then new.quantity else 0 end;
  new_qty := it.current_quantity + delta;
  if new_qty < 0 then
    raise exception 'Saldo insuficiente de "%": disponível % %, solicitado % %', it.name, it.current_quantity, it.unit, abs(delta), it.unit
      using errcode = '23514';
  end if;

  -- Lote: cria/atualiza saldo do lote
  if new.lot_code is not null and new.lot_id is null then
    insert into public.stock_lots (organization_id, farm_id, item_id, lot_code, expires_at, is_demo)
    values (new.organization_id, new.farm_id, new.item_id, new.lot_code, new.lot_expires_at, new.is_demo)
    on conflict (item_id, lot_code) do update set expires_at = coalesce(excluded.expires_at, public.stock_lots.expires_at)
    returning id into new.lot_id;
  end if;
  if new.lot_id is not null and delta <> 0 then
    select * into lot from public.stock_lots where id = new.lot_id for update;
    if lot.item_id <> new.item_id then raise exception 'Lote não pertence ao item' using errcode = '23514'; end if;
    if lot.quantity + delta < 0 then
      raise exception 'Saldo insuficiente no lote % (disponível %)', lot.lot_code, lot.quantity using errcode = '23514';
    end if;
    update public.stock_lots set quantity = quantity + delta where id = new.lot_id;
  end if;

  if new.kind = 'entrada' then
    if new.unit_cost is null then new.unit_cost := it.average_cost; end if;
  else
    new.unit_cost := it.average_cost;
  end if;
  new.total_cost := round(abs(delta) * coalesce(new.unit_cost, 0), 2);
  new.balance_after := new_qty;

  perform set_config('app.stock_trigger', 'on', true);
  update public.inventory_items set
    current_quantity = new_qty,
    average_cost = case
      when new.kind = 'entrada' and new_qty > 0 then round((it.current_quantity * it.average_cost + new.quantity * new.unit_cost) / new_qty, 4)
      else it.average_cost end,
    location_id = case when new.kind = 'transferencia' then new.location_to_id else location_id end
  where id = new.item_id;
  perform set_config('app.stock_trigger', 'off', true);
  return new;
end $$;
create trigger stock_movements_apply before insert on public.stock_movements for each row execute function private.apply_stock_movement();

-- Estorno quando uma movimentação vinculada a atividade é removida (cascata da atividade).
create or replace function private.revert_stock_movement()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  delta numeric;
begin
  delta := case old.kind when 'entrada' then -old.quantity when 'saida' then old.quantity when 'ajuste' then -old.quantity else 0 end;
  perform set_config('app.stock_trigger', 'on', true);
  update public.inventory_items set current_quantity = greatest(0, current_quantity + delta) where id = old.item_id;
  if old.lot_id is not null then
    update public.stock_lots set quantity = greatest(0, quantity + delta) where id = old.lot_id;
  end if;
  perform set_config('app.stock_trigger', 'off', true);
  return old;
end $$;
create trigger stock_movements_revert after delete on public.stock_movements for each row execute function private.revert_stock_movement();

-- Insumos usados numa atividade -> saída de estoque vinculada (talhão/safra) e custo da atividade.
create table public.activity_inputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  activity_id uuid not null,
  item_id uuid not null,
  quantity numeric(16,3) not null check (quantity > 0),
  dose_per_ha numeric(14,4) check (dose_per_ha >= 0),
  unit_cost numeric(16,4),
  total_cost numeric(16,2),
  stock_movement_id uuid references public.stock_movements(id) on delete set null,
  notes text,
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, activity_id) references public.activities(organization_id, id) on delete cascade,
  foreign key (organization_id, item_id) references public.inventory_items(organization_id, id) on delete restrict
);
create index activity_inputs_activity_idx on public.activity_inputs(activity_id);
alter table public.activity_inputs enable row level security;
create policy activity_inputs_select on public.activity_inputs for select to authenticated
  using (private.has_perm(organization_id, 'activities', 'view') and private.can_access_farm(organization_id, farm_id));
create policy activity_inputs_insert on public.activity_inputs for insert to authenticated
  with check (private.has_perm(organization_id, 'activities', 'create') and private.can_access_farm(organization_id, farm_id));
create policy activity_inputs_delete on public.activity_inputs for delete to authenticated
  using (private.has_perm(organization_id, 'activities', 'edit') and private.can_access_farm(organization_id, farm_id));
create trigger activity_inputs_touch before insert or update on public.activity_inputs for each row execute function private.touch_row();

create or replace function private.apply_activity_input()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  act record;
  mv record;
begin
  if tg_op = 'INSERT' then
    select * into act from public.activities where id = new.activity_id;
    insert into public.stock_movements (organization_id, farm_id, item_id, kind, quantity, occurred_at, activity_id, field_id, season_id, notes, is_demo, created_by)
    values (new.organization_id, act.farm_id, new.item_id, 'saida', new.quantity, act.started_at, act.id, act.field_id, act.season_id,
            'Consumo na atividade', new.is_demo, auth.uid())
    returning * into mv;
    update public.activity_inputs set stock_movement_id = mv.id, unit_cost = mv.unit_cost, total_cost = mv.total_cost, farm_id = act.farm_id
      where id = new.id;
    update public.activities set inputs_cost = inputs_cost + mv.total_cost where id = act.id;
  elsif tg_op = 'DELETE' then
    if old.stock_movement_id is not null then
      delete from public.stock_movements where id = old.stock_movement_id;
    end if;
    update public.activities set inputs_cost = greatest(0, inputs_cost - coalesce(old.total_cost, 0)) where id = old.activity_id;
  end if;
  return null;
end $$;
create trigger activity_inputs_apply after insert or delete on public.activity_inputs for each row execute function private.apply_activity_input();

create or replace function private.set_input_farm()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  select farm_id into new.farm_id from public.activities where id = new.activity_id;
  return new;
end $$;
create trigger activity_inputs_farm before insert on public.activity_inputs for each row execute function private.set_input_farm();

-- ---------------------------------------------------------------------------
-- Tarefas
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  field_id uuid,
  season_id uuid,
  activity_id uuid,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text,
  due_date date,
  priority text not null default 'media' check (priority in ('baixa','media','alta','urgente')),
  status text not null default 'pendente' check (status in ('planejada','pendente','em_andamento','concluida','cancelada')),
  assignee_employee_id uuid,
  assignee_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete cascade,
  foreign key (organization_id, field_id) references public.fields(organization_id, id) on delete set null (field_id),
  foreign key (organization_id, season_id) references public.seasons(organization_id, id) on delete set null (season_id),
  foreign key (organization_id, activity_id) references public.activities(organization_id, id) on delete set null (activity_id),
  foreign key (organization_id, assignee_employee_id) references public.employees(organization_id, id) on delete set null (assignee_employee_id)
);
create index tasks_org_status_idx on public.tasks(organization_id, status, due_date);
select private.apply_std_policies('tasks', 'tasks', true);
-- Operador responsável pode atualizar sua própria tarefa mesmo sem permissão de edição geral
create policy tasks_update_assignee on public.tasks for update to authenticated
  using (assignee_user_id = (select auth.uid()) and private.is_org_member(organization_id))
  with check (assignee_user_id = (select auth.uid()));

create or replace function private.task_status()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status <> 'concluida') then
    new.completed_at := now();
  elsif new.status <> 'concluida' then
    new.completed_at := null;
  end if;
  if new.field_id is not null and new.farm_id is null then
    select farm_id into new.farm_id from public.fields where id = new.field_id;
  end if;
  if new.field_id is not null and not exists (select 1 from public.fields f where f.id = new.field_id and f.farm_id = new.farm_id) then
    raise exception 'O talhão não pertence à propriedade informada' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger tasks_status before insert or update on public.tasks for each row execute function private.task_status();

create table public.work_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  employee_id uuid not null,
  work_date date not null,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  activity_id uuid,
  task_id uuid,
  notes text,
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, employee_id) references public.employees(organization_id, id) on delete cascade,
  foreign key (organization_id, activity_id) references public.activities(organization_id, id) on delete set null (activity_id),
  foreign key (organization_id, task_id) references public.tasks(organization_id, id) on delete set null (task_id)
);
create index work_logs_employee_idx on public.work_logs(employee_id, work_date desc);
select private.apply_std_policies('work_logs', 'team', true);
