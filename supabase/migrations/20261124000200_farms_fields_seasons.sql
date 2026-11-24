-- AgroCentral — Etapa 2: Propriedades, mapa, talhões, culturas e safras

-- ---------------------------------------------------------------------------
-- Geometria: GeoJSON (fonte da verdade na API) -> PostGIS (consultas e área)
-- ---------------------------------------------------------------------------
create or replace function private.geojson_to_multipolygon(p jsonb)
returns extensions.geometry language plpgsql immutable
set search_path = ''
as $$
declare
  g extensions.geometry;
  src jsonb := p;
begin
  if p is null or p = 'null'::jsonb then return null; end if;
  if src->>'type' = 'Feature' then src := src->'geometry'; end if;
  if src->>'type' = 'FeatureCollection' then
    select extensions.st_collect(extensions.st_geomfromgeojson((f->'geometry')::text))
      into g from jsonb_array_elements(src->'features') f;
  else
    g := extensions.st_geomfromgeojson(src::text);
  end if;
  g := extensions.st_setsrid(g, 4326);
  if not extensions.st_isvalid(g) then g := extensions.st_makevalid(g); end if;
  g := extensions.st_multi(extensions.st_collectionextract(g, 3));
  if extensions.st_isempty(g) then
    raise exception 'Geometria inválida: é necessário ao menos um polígono' using errcode = '22023';
  end if;
  if extensions.st_xmin(g) < -180 or extensions.st_xmax(g) > 180 or extensions.st_ymin(g) < -90 or extensions.st_ymax(g) > 90 then
    raise exception 'Coordenadas fora do intervalo WGS84' using errcode = '22023';
  end if;
  return g;
end $$;

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  code text,
  address text,
  city text,
  state char(2) check (state is null or state ~ '^[A-Z]{2}$'),
  latitude numeric(9,6) check (latitude between -90 and 90),
  longitude numeric(9,6) check (longitude between -180 and 180),
  total_area_ha numeric(12,4) check (total_area_ha >= 0),
  productive_area_ha numeric(12,4) check (productive_area_ha >= 0),
  preservation_area_ha numeric(12,4) check (preservation_area_ha >= 0),
  legal_reserve_ha numeric(12,4) check (legal_reserve_ha >= 0),
  tenure_type text check (tenure_type in ('propria','arrendada','parceria','comodato','outra')),
  owner_name text,
  car_code text,
  incra_code text,
  notes text,
  boundary_geojson jsonb,
  boundary extensions.geometry(MultiPolygon, 4326),
  boundary_area_ha numeric(14,4),
  boundary_perimeter_m numeric(14,2),
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (productive_area_ha is null or total_area_ha is null or productive_area_ha <= total_area_ha)
);
create index farms_org_idx on public.farms(organization_id);
create index farms_boundary_gix on public.farms using gist (boundary);

alter table public.membership_farms
  add constraint membership_farms_farm_fk foreign key (organization_id, farm_id)
  references public.farms(organization_id, id) on delete cascade;

-- Políticas de farms (o próprio id é o farm_id)
alter table public.farms enable row level security;
create policy farms_select on public.farms for select to authenticated
  using (private.has_perm(organization_id, 'farms', 'view') and private.can_access_farm(organization_id, id));
create policy farms_insert on public.farms for insert to authenticated
  with check (private.has_perm(organization_id, 'farms', 'create') and private.has_role(organization_id, array['owner','admin','manager']::public.app_role[]));
create policy farms_update on public.farms for update to authenticated
  using (private.has_perm(organization_id, 'farms', 'edit') and private.can_access_farm(organization_id, id))
  with check (private.has_perm(organization_id, 'farms', 'edit') and private.can_access_farm(organization_id, id));
create policy farms_delete on public.farms for delete to authenticated
  using (private.has_perm(organization_id, 'farms', 'delete') and private.can_access_farm(organization_id, id));
create trigger farms_touch before insert or update on public.farms for each row execute function private.touch_row();

create table public.points_of_interest (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null,
  kind text not null check (kind in ('sede','galpao','silo','poco','reservatorio','estrada','ponte','acesso','estacao_meteorologica','rio','construcao','outro')),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  notes text,
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete cascade
);
create index poi_farm_idx on public.points_of_interest(farm_id);
select private.apply_std_policies('points_of_interest', 'farms', true);

create table public.fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  code text,
  geojson jsonb,
  geom extensions.geometry(MultiPolygon, 4326),
  area_ha numeric(14,4),
  perimeter_m numeric(14,2),
  manual_area_ha numeric(14,4) check (manual_area_ha > 0),
  soil_type text,
  relief text check (relief in ('plano','suave_ondulado','ondulado','forte_ondulado','montanhoso')),
  irrigation text not null default 'sequeiro' check (irrigation in ('sequeiro','pivo','gotejamento','aspersao','sulco','outro')),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  notes text,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete cascade
);
create index fields_farm_idx on public.fields(farm_id);
create index fields_geom_gix on public.fields using gist (geom);
create unique index fields_code_uq on public.fields(farm_id, lower(code)) where code is not null and archived_at is null;
select private.apply_std_policies('fields', 'fields', true);

-- Histórico geométrico (autor e data de cada alteração)
create table public.geometry_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null,
  entity_type text not null check (entity_type in ('farm','field')),
  entity_id uuid not null,
  geojson jsonb,
  area_ha numeric(14,4),
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index geometry_history_entity_idx on public.geometry_history(entity_id, changed_at desc);
alter table public.geometry_history enable row level security;
create policy geometry_history_select on public.geometry_history for select to authenticated
  using (private.has_perm(organization_id, 'farms', 'view') and private.can_access_farm(organization_id, farm_id));

create or replace function private.sync_geometry()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  src jsonb;
  g extensions.geometry;
  changed boolean;
begin
  if tg_table_name = 'farms' then
    src := new.boundary_geojson;
    changed := tg_op = 'INSERT' or new.boundary_geojson is distinct from old.boundary_geojson;
  else
    src := new.geojson;
    changed := tg_op = 'INSERT' or new.geojson is distinct from old.geojson;
  end if;
  if not changed then return new; end if;

  g := private.geojson_to_multipolygon(src);
  if tg_table_name = 'farms' then
    new.boundary := g;
    new.boundary_area_ha := case when g is null then null else round((extensions.st_area(g::extensions.geography) / 10000)::numeric, 4) end;
    new.boundary_perimeter_m := case when g is null then null else round(extensions.st_perimeter(g::extensions.geography)::numeric, 2) end;
    if g is not null and (new.latitude is null or new.longitude is null) then
      new.latitude := round(extensions.st_y(extensions.st_pointonsurface(g))::numeric, 6);
      new.longitude := round(extensions.st_x(extensions.st_pointonsurface(g))::numeric, 6);
    end if;
  else
    new.geom := g;
    new.area_ha := case when g is null then null else round((extensions.st_area(g::extensions.geography) / 10000)::numeric, 4) end;
    new.perimeter_m := case when g is null then null else round(extensions.st_perimeter(g::extensions.geography)::numeric, 2) end;
  end if;
  return new;
end $$;

create or replace function private.log_geometry()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'farms' then
    if tg_op = 'INSERT' and new.boundary_geojson is null then return null; end if;
    if tg_op = 'UPDATE' and new.boundary_geojson is not distinct from old.boundary_geojson then return null; end if;
    insert into public.geometry_history (organization_id, farm_id, entity_type, entity_id, geojson, area_ha, changed_by)
    values (new.organization_id, new.id, 'farm', new.id, new.boundary_geojson, new.boundary_area_ha, auth.uid());
  else
    if tg_op = 'INSERT' and new.geojson is null then return null; end if;
    if tg_op = 'UPDATE' and new.geojson is not distinct from old.geojson then return null; end if;
    insert into public.geometry_history (organization_id, farm_id, entity_type, entity_id, geojson, area_ha, changed_by)
    values (new.organization_id, new.farm_id, 'field', new.id, new.geojson, new.area_ha, auth.uid());
  end if;
  return null;
end $$;

create trigger farms_geometry before insert or update on public.farms for each row execute function private.sync_geometry();
create trigger fields_geometry before insert or update on public.fields for each row execute function private.sync_geometry();
create trigger farms_geometry_log after insert or update on public.farms for each row execute function private.log_geometry();
create trigger fields_geometry_log after insert or update on public.fields for each row execute function private.log_geometry();
create trigger farms_audit after insert or update or delete on public.farms for each row execute function private.audit_row();
create trigger fields_audit after insert or update or delete on public.fields for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Culturas e variedades (globais da plataforma + personalizadas por organização)
-- ---------------------------------------------------------------------------
create table public.crops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  slug text,
  yield_unit text not null default 'sc' check (yield_unit in ('sc','kg','t','@','cx','un')),
  sack_weight_kg numeric(8,3) check (sack_weight_kg > 0),
  color text,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index crops_global_slug_uq on public.crops(slug) where organization_id is null;
alter table public.crops enable row level security;
create policy crops_select on public.crops for select to authenticated
  using (organization_id is null or private.is_org_member(organization_id));
create policy crops_insert on public.crops for insert to authenticated
  with check (organization_id is not null and private.has_perm(organization_id, 'seasons', 'create'));
create policy crops_update on public.crops for update to authenticated
  using (organization_id is not null and private.has_perm(organization_id, 'seasons', 'edit'))
  with check (organization_id is not null and private.has_perm(organization_id, 'seasons', 'edit'));
create policy crops_delete on public.crops for delete to authenticated
  using (organization_id is not null and private.has_perm(organization_id, 'seasons', 'delete'));

insert into public.crops (slug, name, yield_unit, sack_weight_kg, color) values
  ('soja','Soja','sc',60,'#c9a227'),
  ('milho','Milho','sc',60,'#e0b000'),
  ('cafe_arabica','Café arábica','sc',60,'#6f4e37'),
  ('cafe_conilon','Café conilon','sc',60,'#8b5a2b'),
  ('trigo','Trigo','sc',60,'#d4a373'),
  ('feijao','Feijão','sc',60,'#7f5539'),
  ('arroz','Arroz','sc',50,'#e9d8a6'),
  ('algodao','Algodão','@',15,'#f1faee'),
  ('cana','Cana-de-açúcar','t',null,'#52b788'),
  ('sorgo','Sorgo','sc',60,'#bc6c25'),
  ('outra','Outra cultura','kg',null,'#adb5bd');

create table public.varieties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  crop_id uuid not null references public.crops(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  supplier text,
  cycle_days int check (cycle_days between 1 and 2000),
  notes text,
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
select private.apply_std_policies('varieties', 'seasons', false);

-- ---------------------------------------------------------------------------
-- Safras
-- ---------------------------------------------------------------------------
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  cycle text,
  crop_id uuid not null references public.crops(id) on delete restrict,
  start_date date not null,
  end_date date,
  status text not null default 'planejada' check (status in ('planejada','em_andamento','colhida','encerrada','cancelada')),
  responsible_employee_id uuid,
  expected_yield_per_ha numeric(12,3) check (expected_yield_per_ha >= 0),
  estimated_cost numeric(14,2) check (estimated_cost >= 0),
  notes text,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (end_date is null or end_date >= start_date),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete cascade
);
create index seasons_farm_idx on public.seasons(farm_id);
select private.apply_std_policies('seasons', 'seasons', true);
create trigger seasons_audit after insert or update or delete on public.seasons for each row execute function private.audit_row();

create table public.season_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null,
  season_id uuid not null,
  field_id uuid not null,
  variety_id uuid,
  planted_area_ha numeric(14,4) check (planted_area_ha > 0),
  planting_date date,
  expected_harvest_date date,
  population_per_ha numeric(12,2) check (population_per_ha >= 0),
  seed_rate_kg_ha numeric(10,3) check (seed_rate_kg_ha >= 0),
  seed_supplier text,
  stage text,
  expected_yield_per_ha numeric(12,3) check (expected_yield_per_ha >= 0),
  notes text,
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, field_id),
  check (expected_harvest_date is null or planting_date is null or expected_harvest_date >= planting_date),
  foreign key (organization_id, season_id) references public.seasons(organization_id, id) on delete cascade,
  foreign key (organization_id, field_id) references public.fields(organization_id, id) on delete restrict,
  foreign key (organization_id, variety_id) references public.varieties(organization_id, id) on delete set null (variety_id)
);
create index season_fields_field_idx on public.season_fields(field_id);
select private.apply_std_policies('season_fields', 'seasons', true);

-- Garante que talhão e safra pertençam à mesma propriedade; farm_id é derivado da safra.
create or replace function private.check_season_field()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  s_farm uuid; f_farm uuid; f_area numeric;
begin
  select farm_id into s_farm from public.seasons where id = new.season_id;
  select farm_id, coalesce(manual_area_ha, area_ha) into f_farm, f_area from public.fields where id = new.field_id;
  if s_farm is null or f_farm is null then
    raise exception 'Safra ou talhão não encontrado' using errcode = '23503';
  end if;
  if s_farm <> f_farm then
    raise exception 'O talhão não pertence à propriedade da safra' using errcode = '23514';
  end if;
  new.farm_id := s_farm;
  if new.planted_area_ha is null then new.planted_area_ha := f_area; end if;
  if f_area is not null and new.planted_area_ha > f_area * 1.001 then
    raise exception 'Área plantada (% ha) maior que a área do talhão (% ha)', new.planted_area_ha, f_area using errcode = '23514';
  end if;
  return new;
end $$;
create trigger season_fields_check before insert or update on public.season_fields
  for each row execute function private.check_season_field();

-- ---------------------------------------------------------------------------
-- Colheitas
-- ---------------------------------------------------------------------------
create table public.harvest_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null,
  season_id uuid not null,
  field_id uuid not null,
  harvest_date date not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null check (unit in ('sc','kg','t','@','cx','un')),
  quantity_kg numeric(16,3),
  moisture_pct numeric(5,2) check (moisture_pct between 0 and 100),
  impurity_pct numeric(5,2) check (impurity_pct between 0 and 100),
  quality text,
  losses_kg numeric(14,3) check (losses_kg >= 0),
  destination text check (destination in ('armazem_proprio','cooperativa','venda_direta','trading','consumo','outro')),
  notes text,
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, season_id) references public.seasons(organization_id, id) on delete cascade,
  foreign key (organization_id, field_id) references public.fields(organization_id, id) on delete restrict
);
create index harvest_season_idx on public.harvest_records(season_id);
select private.apply_std_policies('harvest_records', 'seasons', true);

-- Regra: colheita só em talhão vinculado à safra; conversão para kg usa o peso de saca configurado.
create or replace function private.check_harvest()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  sw numeric;
begin
  if not exists (select 1 from public.season_fields sf where sf.season_id = new.season_id and sf.field_id = new.field_id) then
    raise exception 'O talhão informado não pertence à safra selecionada' using errcode = '23514';
  end if;
  select s.farm_id, c.sack_weight_kg into new.farm_id, sw
    from public.seasons s join public.crops c on c.id = s.crop_id where s.id = new.season_id;
  new.quantity_kg := case new.unit
    when 'kg' then new.quantity
    when 't' then new.quantity * 1000
    when '@' then new.quantity * 15
    when 'sc' then case when sw is null then null else new.quantity * sw end
    else null end;
  if new.unit = 'sc' and sw is null then
    raise exception 'A cultura desta safra não tem peso de saca configurado; informe em kg ou t' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger harvest_check before insert or update on public.harvest_records
  for each row execute function private.check_harvest();
create trigger harvest_audit after insert or update or delete on public.harvest_records for each row execute function private.audit_row();
