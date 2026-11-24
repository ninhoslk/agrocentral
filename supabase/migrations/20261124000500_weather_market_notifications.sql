-- AgroCentral — Etapa 5: Notificações, clima e mercado

-- ---------------------------------------------------------------------------
-- Notificações
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  category text not null check (category in ('clima','mercado','financeiro','estoque','maquinas','safras','tarefas','marketplace','documentos','sistema')),
  priority text not null default 'media' check (priority in ('baixa','media','alta','critica')),
  title text not null,
  body text,
  link text,
  source text,
  dedup_key text not null,
  valid_until timestamptz,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);
create index notifications_user_idx on public.notifications(user_id, created_at desc) where archived_at is null;
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.notifications from authenticated;
grant update (read_at, archived_at) on public.notifications to authenticated;

create table public.notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  category text not null check (category in ('clima','mercado','financeiro','estoque','maquinas','safras','tarefas','marketplace','documentos','sistema')),
  in_app boolean not null default true,
  email boolean not null default false,
  min_priority text not null default 'baixa' check (min_priority in ('baixa','media','alta','critica')),
  quiet_start time,
  quiet_end time,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);
alter table public.notification_preferences enable row level security;
create policy notification_preferences_self on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function private.priority_rank(p text)
returns int language sql immutable
set search_path = ''
as $$ select case p when 'baixa' then 1 when 'media' then 2 when 'alta' then 3 when 'critica' then 4 else 0 end $$;

-- Ponto único de criação de notificação: respeita preferências e deduplica.
create or replace function private.notify(
  p_user uuid, p_org uuid, p_category text, p_priority text, p_title text, p_body text,
  p_link text, p_dedup text, p_source text default null, p_valid_until timestamptz default null)
returns boolean language plpgsql security definer
set search_path = ''
as $$
declare
  pref record;
  inserted int;
begin
  select * into pref from public.notification_preferences where user_id = p_user and category = p_category;
  if found and (not pref.in_app or private.priority_rank(p_priority) < private.priority_rank(pref.min_priority)) then
    return false;
  end if;
  insert into public.notifications (user_id, organization_id, category, priority, title, body, link, dedup_key, source, valid_until)
  values (p_user, p_org, p_category, p_priority, left(p_title, 200), left(p_body, 1000), p_link, p_dedup, p_source, p_valid_until)
  on conflict (user_id, dedup_key) do nothing;
  get diagnostics inserted = row_count;
  return inserted > 0;
end $$;

-- Notifica todos os membros com permissão de visualização em um módulo (e acesso à propriedade).
create or replace function private.notify_members(
  p_org uuid, p_farm uuid, p_module text, p_category text, p_priority text,
  p_title text, p_body text, p_link text, p_dedup text, p_source text default null)
returns int language plpgsql security definer
set search_path = ''
as $$
declare
  m record; n int := 0;
begin
  for m in
    select mb.user_id from public.memberships mb
    join public.role_permissions rp on rp.role = mb.role and rp.module = p_module
    where mb.organization_id = p_org and mb.status = 'active' and 'view' = any (rp.actions)
      and (mb.all_farms or p_farm is null or exists (select 1 from public.membership_farms mf where mf.membership_id = mb.id and mf.farm_id = p_farm))
  loop
    if private.notify(m.user_id, p_org, p_category, p_priority, p_title, p_body, p_link, p_dedup, p_source) then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Clima: cache normalizado por coordenada (dado público, escrito só pelo backend)
-- ---------------------------------------------------------------------------
create table public.weather_cache (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  lat numeric(6,2) not null,
  lon numeric(6,2) not null,
  payload jsonb not null,
  source_url text,
  fetched_at timestamptz not null,
  valid_until timestamptz not null,
  status text not null default 'ok' check (status in ('ok','error')),
  last_error text,
  last_error_at timestamptz,
  unique (provider, lat, lon)
);
alter table public.weather_cache enable row level security;
create policy weather_cache_read on public.weather_cache for select to authenticated using (true);

create table public.weather_alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('chuva_intensa','chuva_acumulada','estiagem','calor','frio','geada','vento_forte')),
  threshold numeric(8,2) not null,
  lookahead_days int not null default 3 check (lookahead_days between 1 and 7),
  priority text not null default 'alta' check (priority in ('baixa','media','alta','critica')),
  enabled boolean not null default true,
  notes text,
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete cascade
);
alter table public.weather_alert_rules enable row level security;
create policy weather_alert_rules_select on public.weather_alert_rules for select to authenticated
  using (private.has_perm(organization_id, 'weather', 'view') and private.can_access_farm(organization_id, farm_id));
create policy weather_alert_rules_insert on public.weather_alert_rules for insert to authenticated
  with check (user_id = (select auth.uid()) and private.has_perm(organization_id, 'weather', 'view') and private.can_access_farm(organization_id, farm_id));
create policy weather_alert_rules_update on public.weather_alert_rules for update to authenticated
  using (user_id = (select auth.uid()) or private.has_perm(organization_id, 'weather', 'edit'))
  with check (private.can_access_farm(organization_id, farm_id));
create policy weather_alert_rules_delete on public.weather_alert_rules for delete to authenticated
  using (user_id = (select auth.uid()) or private.has_perm(organization_id, 'weather', 'delete'));
create trigger weather_alert_rules_touch before insert or update on public.weather_alert_rules for each row execute function private.touch_row();

create table public.weather_alert_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null,
  rule_id uuid references public.weather_alert_rules(id) on delete set null,
  kind text not null,
  dedup_key text not null unique,
  message text not null,
  observed_value numeric(10,2),
  threshold numeric(10,2),
  forecast_for date,
  provider text not null,
  data_status text not null default 'forecast' check (data_status in ('forecast','observation','official_warning')),
  fetched_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index weather_alert_events_farm_idx on public.weather_alert_events(farm_id, created_at desc);
alter table public.weather_alert_events enable row level security;
create policy weather_alert_events_select on public.weather_alert_events for select to authenticated
  using (private.has_perm(organization_id, 'weather', 'view') and private.can_access_farm(organization_id, farm_id));

-- Avalia regras de alerta de uma propriedade a partir do payload normalizado do cache.
-- Chamado pelo backend (Edge Function) após cada coleta. Deduplicação por regra+data.
create or replace function public.evaluate_weather_rules(p_farm uuid, p_cache uuid)
returns int language plpgsql security definer
set search_path = ''
as $$
declare
  c record; r record; d jsonb; v numeric; days jsonb; total numeric; dry int;
  msg text; fdate date; n int := 0; fname text; key text;
begin
  select * into c from public.weather_cache where id = p_cache;
  if not found or c.status <> 'ok' then return 0; end if;
  select name into fname from public.farms where id = p_farm;
  days := c.payload->'daily';
  for r in select * from public.weather_alert_rules where farm_id = p_farm and enabled loop
    msg := null; v := null; fdate := null;
    if r.kind in ('chuva_intensa','calor','frio','geada','vento_forte') then
      for d in select x.e from jsonb_array_elements(days) with ordinality as x(e, i) where x.i <= r.lookahead_days order by x.i loop
        v := case r.kind
          when 'chuva_intensa' then (d->>'precipitation_mm')::numeric
          when 'calor' then (d->>'temperature_max_c')::numeric
          when 'frio' then (d->>'temperature_min_c')::numeric
          when 'geada' then (d->>'temperature_min_c')::numeric
          when 'vento_forte' then coalesce((d->>'wind_gusts_max_kmh')::numeric, (d->>'wind_speed_max_kmh')::numeric)
        end;
        if v is null then continue; end if;
        if (r.kind in ('chuva_intensa','calor','vento_forte') and v >= r.threshold)
           or (r.kind in ('frio','geada') and v <= r.threshold) then
          fdate := (d->>'date')::date;
          msg := case r.kind
            when 'chuva_intensa' then format('Previsão de %s mm de chuva em %s', v, to_char(fdate, 'DD/MM'))
            when 'calor' then format('Previsão de máxima de %s °C em %s', v, to_char(fdate, 'DD/MM'))
            when 'frio' then format('Previsão de mínima de %s °C em %s', v, to_char(fdate, 'DD/MM'))
            when 'geada' then format('Mínima prevista de %s °C em %s — condição favorável a geada', v, to_char(fdate, 'DD/MM'))
            when 'vento_forte' then format('Previsão de vento/rajada de %s km/h em %s', v, to_char(fdate, 'DD/MM'))
          end;
          exit;
        end if;
      end loop;
    elsif r.kind = 'chuva_acumulada' then
      select sum((e->>'precipitation_mm')::numeric) into total
        from jsonb_array_elements(days) with ordinality as x(e, i) where x.i <= r.lookahead_days;
      if total >= r.threshold then
        v := total; fdate := (days->0->>'date')::date;
        msg := format('Acumulado previsto de %s mm nos próximos %s dias', round(total, 1), r.lookahead_days);
      end if;
    elsif r.kind = 'estiagem' then
      -- threshold = nº mínimo de dias consecutivos com chuva prevista < 1 mm
      select count(*) into dry from (
        select e from jsonb_array_elements(days) as x(e) where coalesce((e->>'precipitation_mm')::numeric, 0) < 1
      ) s;
      if dry >= r.threshold and dry = jsonb_array_length(days) then
        v := dry; fdate := (days->0->>'date')::date;
        msg := format('Sem chuva relevante prevista para os próximos %s dias', dry);
      end if;
    end if;

    if msg is not null then
      key := format('wx:%s:%s:%s', r.id, r.kind, fdate);
      insert into public.weather_alert_events (organization_id, farm_id, rule_id, kind, dedup_key, message, observed_value, threshold, forecast_for, provider, fetched_at)
      values (r.organization_id, p_farm, r.id, r.kind, key, msg, v, r.threshold, fdate, c.provider, c.fetched_at)
      on conflict (dedup_key) do nothing;
      if found then
        n := n + 1;
        perform private.notify(r.user_id, r.organization_id, 'clima', r.priority,
          format('Alerta de clima — %s', fname),
          msg || format('. Fonte: %s (previsão, atualizada em %s UTC). Previsão não é certeza; consulte avisos oficiais do INMET.', c.provider, to_char(c.fetched_at, 'DD/MM HH24:MI')),
          '/clima', key, c.provider, (fdate + 1)::timestamptz);
      end if;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.evaluate_weather_rules(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mercado: instrumentos, cotações (oficiais via backend; manuais/demonstrativas via usuário)
-- ---------------------------------------------------------------------------
create table public.market_instruments (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('cambio','commodity','indice')),
  unit text not null,
  currency text not null default 'BRL',
  provider text,
  provider_series text,
  description text,
  sort int not null default 100
);
alter table public.market_instruments enable row level security;
create policy market_instruments_read on public.market_instruments for select to authenticated using (true);

insert into public.market_instruments (id, name, kind, unit, currency, provider, provider_series, description, sort) values
  ('USD_BRL','Dólar comercial (venda)','cambio','BRL/USD','BRL','bcb_sgs','1','Taxa de câmbio livre — dólar americano (venda), série diária do Banco Central (SGS 1). Valor de referência, não preço negociável em tempo real.',1),
  ('USD_BRL_COMPRA','Dólar comercial (compra)','cambio','BRL/USD','BRL','bcb_sgs','10813','Taxa de câmbio livre — dólar americano (compra), SGS 10813.',2),
  ('EUR_BRL','Euro (venda)','cambio','BRL/EUR','BRL','bcb_sgs','21619','Euro (venda), série diária do Banco Central (SGS 21619).',3),
  ('SOJA','Soja','commodity','BRL/sc 60 kg','BRL',null,null,'Sem fonte gratuita licenciada para uso comercial configurada. Use lançamento manual ou contrate fornecedor (ex.: CEPEA).',10),
  ('MILHO','Milho','commodity','BRL/sc 60 kg','BRL',null,null,'Sem fonte gratuita licenciada configurada.',11),
  ('CAFE_ARABICA','Café arábica','commodity','BRL/sc 60 kg','BRL',null,null,'Sem fonte gratuita licenciada configurada.',12),
  ('CAFE_CONILON','Café conilon','commodity','BRL/sc 60 kg','BRL',null,null,'Sem fonte gratuita licenciada configurada.',13),
  ('TRIGO','Trigo','commodity','BRL/sc 60 kg','BRL',null,null,'Sem fonte gratuita licenciada configurada.',14),
  ('FEIJAO','Feijão','commodity','BRL/sc 60 kg','BRL',null,null,'Sem fonte gratuita licenciada configurada.',15),
  ('ARROZ','Arroz em casca','commodity','BRL/sc 50 kg','BRL',null,null,'Sem fonte gratuita licenciada configurada.',16),
  ('ALGODAO','Algodão em pluma','commodity','BRL/@ 15 kg','BRL',null,null,'Sem fonte gratuita licenciada configurada.',17),
  ('CANA','Cana-de-açúcar (ATR)','commodity','BRL/kg ATR','BRL',null,null,'Sem fonte gratuita licenciada configurada.',18),
  ('BOI_GORDO','Boi gordo','commodity','BRL/@ 15 kg','BRL',null,null,'Sem fonte gratuita licenciada configurada.',19);

create table public.market_quotes (
  id uuid primary key default gen_random_uuid(),
  instrument_id text not null references public.market_instruments(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  value numeric(18,6) not null check (value > 0),
  currency text not null default 'BRL',
  unit text not null,
  region text not null default 'Brasil',
  source text not null,
  source_url text,
  observed_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  status text not null check (status in ('oficial','indicativo','atrasado','demonstrativo','manual')),
  notes text,
  payload jsonb,
  is_demo boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (organization_id is not null or status in ('oficial','indicativo','atrasado')),
  check (status <> 'demonstrativo' or is_demo)
);
create unique index market_quotes_uq on public.market_quotes
  (instrument_id, coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), region, source, observed_at);
create index market_quotes_lookup_idx on public.market_quotes(instrument_id, observed_at desc);
alter table public.market_quotes enable row level security;
create policy market_quotes_select on public.market_quotes for select to authenticated
  using (organization_id is null or private.has_perm(organization_id, 'market', 'view'));
create policy market_quotes_insert on public.market_quotes for insert to authenticated
  with check (organization_id is not null and status in ('manual','demonstrativo')
              and private.has_perm(organization_id, 'market', 'create'));
create policy market_quotes_delete on public.market_quotes for delete to authenticated
  using (organization_id is not null and private.has_perm(organization_id, 'market', 'delete'));

create table public.price_alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  instrument_id text not null references public.market_instruments(id) on delete cascade,
  region text,
  direction text not null check (direction in ('acima','abaixo')),
  target_value numeric(18,6) not null check (target_value > 0),
  enabled boolean not null default true,
  last_triggered_at timestamptz,
  last_value numeric(18,6),
  notes text,
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.price_alert_rules enable row level security;
create policy price_alert_rules_self on public.price_alert_rules for all to authenticated
  using (user_id = (select auth.uid()) and private.is_org_member(organization_id))
  with check (user_id = (select auth.uid()) and private.has_perm(organization_id, 'market', 'view'));
create trigger price_alert_rules_touch before insert or update on public.price_alert_rules for each row execute function private.touch_row();

create table public.price_alert_events (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.price_alert_rules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_id uuid references public.market_quotes(id) on delete set null,
  value numeric(18,6) not null,
  target_value numeric(18,6) not null,
  direction text not null,
  created_at timestamptz not null default now(),
  unique (rule_id, quote_id)
);
alter table public.price_alert_events enable row level security;
create policy price_alert_events_self on public.price_alert_events for select to authenticated using (user_id = (select auth.uid()));

-- Avalia alertas de preço a cada nova cotação (somente cotações não demonstrativas
-- e, para cotações manuais, apenas regras da mesma organização). Dispara ao cruzar o alvo.
create or replace function private.evaluate_price_alerts()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  r record; inst record; hit boolean; key text;
begin
  if new.status = 'demonstrativo' or new.observed_at < now() - interval '5 days' then return null; end if;
  select * into inst from public.market_instruments where id = new.instrument_id;
  for r in
    select * from public.price_alert_rules pr
    where pr.instrument_id = new.instrument_id and pr.enabled
      and (pr.region is null or pr.region = new.region)
      and (new.organization_id is null or pr.organization_id = new.organization_id)
  loop
    hit := (r.direction = 'acima' and new.value >= r.target_value) or (r.direction = 'abaixo' and new.value <= r.target_value);
    -- Dispara somente na transição (evita repetir enquanto permanece além do alvo)
    if hit and (r.last_value is null or not (
         (r.direction = 'acima' and r.last_value >= r.target_value) or (r.direction = 'abaixo' and r.last_value <= r.target_value))) then
      key := format('px:%s:%s', r.id, new.id);
      insert into public.price_alert_events (rule_id, user_id, quote_id, value, target_value, direction)
      values (r.id, r.user_id, new.id, new.value, r.target_value, r.direction) on conflict do nothing;
      perform private.notify(r.user_id, r.organization_id, 'mercado', 'alta',
        format('%s %s do alvo', inst.name, case when r.direction = 'acima' then 'atingiu ou superou' else 'atingiu ou ficou abaixo' end),
        format('Valor %s %s (alvo %s). Fonte: %s, referência %s, status %s.',
               trim(to_char(new.value, 'FM999G999G990D00##')), new.unit, trim(to_char(r.target_value, 'FM999G999G990D00##')),
               new.source, to_char(new.observed_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), new.status),
        '/mercado', key, new.source);
      update public.price_alert_rules set last_triggered_at = now(), last_value = new.value where id = r.id;
    elsif new.observed_at >= coalesce((select max(q.observed_at) from public.market_quotes q where q.instrument_id = new.instrument_id and q.id <> new.id), new.observed_at) then
      update public.price_alert_rules set last_value = new.value where id = r.id;
    end if;
  end loop;
  return null;
end $$;
create trigger market_quotes_alerts after insert on public.market_quotes for each row execute function private.evaluate_price_alerts();
