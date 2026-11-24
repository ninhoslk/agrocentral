-- AgroCentral — Etapa 1: Fundação (acesso, organizações, permissões, utilitários)
-- Convenções: UUID PK, timestamps UTC, organization_id em toda tabela de negócio,
-- RLS em todas as tabelas expostas, helpers de autorização no schema "private".

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('owner','admin','manager','agronomist','finance','operator','viewer');

-- ---------------------------------------------------------------------------
-- Utilitários genéricos
-- ---------------------------------------------------------------------------
-- Tabelas de negócio: created_at/updated_at/created_by/updated_by/organization_id
create or replace function private.touch_row()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
  else
    if new.organization_id is distinct from old.organization_id then
      raise exception 'organization_id não pode ser alterado' using errcode = '42501';
    end if;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

-- Tabelas auxiliares: apenas created_at/updated_at
create or replace function private.touch_simple()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Organizações, perfis e vínculos
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  legal_document text check (legal_document is null or char_length(legal_document) <= 20),
  city text,
  state char(2) check (state is null or state ~ '^[A-Z]{2}$'),
  main_crop text,
  enabled_modules text[] not null default array[
    'dashboard','farms','fields','seasons','activities','tasks','team','finance','inventory',
    'equipment','documents','weather','market','marketplace','calculators','reports','notifications'
  ],
  plan text not null default 'free' check (plan in ('free','essencial','profissional','avancado','empresarial')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  phone text check (phone is null or char_length(phone) <= 30),
  avatar_url text,
  last_organization_id uuid references public.organizations(id) on delete set null,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  status text not null default 'active' check (status in ('active','suspended')),
  all_farms boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);

create table public.membership_farms (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (membership_id, farm_id)
);
create index membership_farms_farm_idx on public.membership_farms(farm_id);

-- Matriz de permissões por papel/módulo/ação (padrão da plataforma)
create table public.role_permissions (
  role public.app_role not null,
  module text not null,
  actions text[] not null,
  primary key (role, module)
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers de autorização (SECURITY DEFINER, sem search_path mutável)
-- ---------------------------------------------------------------------------
create or replace function private.is_org_member(p_org uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

create or replace function private.has_perm(p_org uuid, p_module text, p_action text)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.role_permissions rp on rp.role = m.role and rp.module = p_module
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and p_action = any (rp.actions)
      and (p_module in ('settings','reports','dashboard','notifications') or p_module = any (o.enabled_modules)
           or (p_module in ('fields','seasons') and 'farms' = any (o.enabled_modules)))
  );
$$;

create or replace function private.can_access_farm(p_org uuid, p_farm uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (m.all_farms or p_farm is null or exists (
        select 1 from public.membership_farms mf where mf.membership_id = m.id and mf.farm_id = p_farm))
  );
$$;

create or replace function private.has_role(p_org uuid, p_roles public.app_role[])
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role = any (p_roles)
  );
$$;

create or replace function private.is_platform_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid()));
$$;

grant execute on all functions in schema private to authenticated;
-- Página pública de anúncios (anon) avalia private.is_platform_admin() na política
grant usage on schema private to anon;
grant execute on function private.is_platform_admin() to anon;

-- Aplica as 4 políticas padrão (select/insert/update/delete) a uma tabela de negócio.
create or replace function private.apply_std_policies(p_table text, p_module text, p_has_farm boolean)
returns void language plpgsql
set search_path = ''
as $$
declare
  farm_expr text := case when p_has_farm then ' and private.can_access_farm(organization_id, farm_id)' else '' end;
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format('create policy %I on public.%I for select to authenticated using (private.has_perm(organization_id, %L, ''view'')%s)',
                 p_table || '_select', p_table, p_module, farm_expr);
  execute format('create policy %I on public.%I for insert to authenticated with check (private.has_perm(organization_id, %L, ''create'')%s)',
                 p_table || '_insert', p_table, p_module, farm_expr);
  execute format('create policy %I on public.%I for update to authenticated using (private.has_perm(organization_id, %L, ''edit'')%s) with check (private.has_perm(organization_id, %L, ''edit'')%s)',
                 p_table || '_update', p_table, p_module, farm_expr, p_module, farm_expr);
  execute format('create policy %I on public.%I for delete to authenticated using (private.has_perm(organization_id, %L, ''delete'')%s)',
                 p_table || '_delete', p_table, p_module, farm_expr);
  execute format('create trigger %I before insert or update on public.%I for each row execute function private.touch_row()',
                 p_table || '_touch', p_table);
end $$;

-- ---------------------------------------------------------------------------
-- Matriz padrão de permissões
-- ---------------------------------------------------------------------------
do $$
declare
  all_modules text[] := array['farms','fields','seasons','activities','tasks','team','finance','inventory','equipment','documents','weather','market','reports','settings','dashboard','notifications'];
  full_actions text[] := array['view','create','edit','delete','export','admin'];
  rw text[] := array['view','create','edit','delete','export'];
  m text;
begin
  foreach m in array all_modules loop
    insert into public.role_permissions values ('owner', m, full_actions);
    insert into public.role_permissions values ('admin', m, full_actions);
    insert into public.role_permissions values ('viewer', m, case when m = 'settings' then array['view'] else array['view'] end);
  end loop;

  -- Gerente: operação completa, financeiro somente leitura
  foreach m in array array['farms','fields','seasons','activities','tasks','team','inventory','equipment','documents','weather','market','reports','dashboard','notifications'] loop
    insert into public.role_permissions values ('manager', m, rw);
  end loop;
  insert into public.role_permissions values ('manager','finance', array['view','export']);
  insert into public.role_permissions values ('manager','settings', array['view']);

  -- Agrônomo: técnico
  foreach m in array array['fields','seasons','activities','tasks','documents'] loop
    insert into public.role_permissions values ('agronomist', m, array['view','create','edit','export']);
  end loop;
  foreach m in array array['farms','inventory','equipment','team','weather','market','reports','dashboard','notifications','settings'] loop
    insert into public.role_permissions values ('agronomist', m, array['view']);
  end loop;
  update public.role_permissions set actions = array['view','create','edit'] where role='agronomist' and module='weather';

  -- Financeiro
  insert into public.role_permissions values ('finance','finance', rw);
  insert into public.role_permissions values ('finance','documents', array['view','create','edit']);
  insert into public.role_permissions values ('finance','reports', array['view','export']);
  foreach m in array array['farms','fields','seasons','inventory','equipment','market','weather','dashboard','notifications','settings','activities'] loop
    insert into public.role_permissions values ('finance', m, array['view']);
  end loop;

  -- Operador: execução no campo
  insert into public.role_permissions values ('operator','activities', array['view','create','edit']);
  insert into public.role_permissions values ('operator','tasks', array['view','edit']);
  insert into public.role_permissions values ('operator','equipment', array['view','create']);
  foreach m in array array['farms','fields','seasons','inventory','weather','market','dashboard','notifications','settings','team'] loop
    insert into public.role_permissions values ('operator', m, array['view']);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS — acesso
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_farms enable row level security;
alter table public.role_permissions enable row level security;
alter table public.platform_admins enable row level security;

create policy organizations_select on public.organizations for select to authenticated
  using (private.is_org_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (private.has_perm(id, 'settings', 'admin')) with check (private.has_perm(id, 'settings', 'admin'));
create trigger organizations_touch before insert or update on public.organizations
  for each row execute function private.touch_simple();

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or exists (
    select 1 from public.memberships a join public.memberships b on a.organization_id = b.organization_id
    where a.user_id = (select auth.uid()) and a.status = 'active' and b.user_id = profiles.id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create trigger profiles_touch before insert or update on public.profiles
  for each row execute function private.touch_simple();

create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.is_org_member(organization_id));
create policy memberships_update on public.memberships for update to authenticated
  using (private.has_perm(organization_id, 'settings', 'admin'))
  with check (private.has_perm(organization_id, 'settings', 'admin'));
create policy memberships_delete on public.memberships for delete to authenticated
  using (private.has_perm(organization_id, 'settings', 'admin') or user_id = (select auth.uid()));
create trigger memberships_touch before insert or update on public.memberships
  for each row execute function private.touch_simple();

create policy membership_farms_select on public.membership_farms for select to authenticated
  using (private.is_org_member(organization_id));
create policy membership_farms_insert on public.membership_farms for insert to authenticated
  with check (private.has_perm(organization_id, 'settings', 'admin'));
create policy membership_farms_delete on public.membership_farms for delete to authenticated
  using (private.has_perm(organization_id, 'settings', 'admin'));

create policy role_permissions_read on public.role_permissions for select to authenticated using (true);
create policy platform_admins_self on public.platform_admins for select to authenticated using (user_id = (select auth.uid()));

-- Regras de integridade de papéis: proprietário só é definido/removido por proprietário;
-- a organização nunca fica sem proprietário.
create or replace function private.guard_membership()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  is_owner boolean;
  owners int;
begin
  is_owner := private.has_role(coalesce(new.organization_id, old.organization_id), array['owner']::public.app_role[]);
  if tg_op in ('UPDATE','DELETE') and old.role = 'owner' then
    select count(*) into owners from public.memberships
      where organization_id = old.organization_id and role = 'owner' and status = 'active' and id <> old.id;
    if owners = 0 and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active') then
      raise exception 'A organização precisa de ao menos um proprietário ativo' using errcode = '23514';
    end if;
    if not is_owner and auth.uid() is not null then
      raise exception 'Somente um proprietário pode alterar outro proprietário' using errcode = '42501';
    end if;
  end if;
  if tg_op in ('INSERT','UPDATE') and new.role = 'owner' and not is_owner and auth.uid() is not null
     and current_setting('app.bootstrap', true) is distinct from 'on' then
    raise exception 'Somente um proprietário pode conceder o papel de proprietário' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger memberships_guard before insert or update or delete on public.memberships
  for each row execute function private.guard_membership();

-- Perfil automático ao criar usuário
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Convites
-- ---------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.app_role not null default 'viewer' check (role <> 'owner'),
  all_farms boolean not null default true,
  farm_ids uuid[] not null default '{}',
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid default auth.uid(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index invitations_pending_uq on public.invitations (organization_id, lower(email)) where status = 'pending';
alter table public.invitations enable row level security;
create policy invitations_admin_select on public.invitations for select to authenticated
  using (private.has_perm(organization_id, 'settings', 'admin'));
create policy invitations_admin_insert on public.invitations for insert to authenticated
  with check (private.has_perm(organization_id, 'settings', 'admin'));
create policy invitations_admin_update on public.invitations for update to authenticated
  using (private.has_perm(organization_id, 'settings', 'admin'))
  with check (private.has_perm(organization_id, 'settings', 'admin'));
create trigger invitations_touch before insert or update on public.invitations
  for each row execute function private.touch_simple();

-- ---------------------------------------------------------------------------
-- Preferências do usuário
-- ---------------------------------------------------------------------------
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  selected_farm_id uuid,
  dashboard_layout jsonb,
  favorite_instruments text[] not null default array['USD_BRL','SOJA','MILHO'],
  market_region text,
  units jsonb not null default '{"area":"ha","weight":"sc"}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
create policy user_preferences_self on public.user_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger user_preferences_touch before insert or update on public.user_preferences
  for each row execute function private.touch_simple();

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb,
  actor uuid,
  at timestamptz not null default now()
);
create index audit_logs_org_at_idx on public.audit_logs (organization_id, at desc);
alter table public.audit_logs enable row level security;
create policy audit_logs_admin_select on public.audit_logs for select to authenticated
  using (private.has_perm(organization_id, 'settings', 'admin'));

create or replace function private.audit_row()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_logs (organization_id, table_name, record_id, action, old_data, new_data, actor)
  values (
    coalesce((r->>'organization_id')::uuid, case when tg_table_name = 'organizations' then (r->>'id')::uuid end),
    tg_table_name,
    (r->>'id')::uuid,
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) - 'search_vector' end,
    case when tg_op <> 'DELETE' then to_jsonb(new) - 'search_vector' end,
    auth.uid()
  );
  return null;
end $$;

create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function private.audit_row();
create trigger organizations_audit after update on public.organizations
  for each row execute function private.audit_row();

-- Logs de integrações externas (escritos somente pelo backend)
create table public.integration_logs (
  id bigint generated always as identity primary key,
  provider text not null,
  endpoint text,
  status text not null check (status in ('ok','error','cache_hit','skipped')),
  http_status int,
  duration_ms int,
  error text,
  at timestamptz not null default now()
);
create index integration_logs_provider_at_idx on public.integration_logs (provider, at desc);
alter table public.integration_logs enable row level security;
create policy integration_logs_read on public.integration_logs for select to authenticated using (true);
