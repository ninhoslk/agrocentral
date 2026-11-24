-- AgroCentral — Suporte às integrações externas (Edge Functions): segredos, cache, limites de taxa

create extension if not exists pgcrypto with schema extensions;

create table private.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into private.app_config (key, value) values ('cron_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- Usada pelas Edge Functions (service_role) para validar chamadas agendadas
create or replace function public.verify_cron_secret(p_secret text)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from private.app_config where key = 'cron_secret' and value = p_secret);
$$;
revoke execute on function public.verify_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_cron_secret(text) to service_role;

-- Limite de 1 requisição/s para o Nominatim (política de uso do serviço público)
create table private.rate_gates (key text primary key, last_at timestamptz not null default 'epoch');
insert into private.rate_gates (key) values ('nominatim') on conflict do nothing;

create or replace function public.take_rate_slot(p_key text, p_interval_ms int)
returns boolean language plpgsql security definer
set search_path = ''
as $$
declare ok boolean;
begin
  update private.rate_gates set last_at = clock_timestamp()
  where key = p_key and last_at <= clock_timestamp() - make_interval(secs => p_interval_ms / 1000.0)
  returning true into ok;
  return coalesce(ok, false);
end $$;
revoke execute on function public.take_rate_slot(text, int) from public, anon, authenticated;
grant execute on function public.take_rate_slot(text, int) to service_role;

-- Cache de geocodificação (dados públicos)
create table public.geocode_cache (
  query_norm text primary key,
  results jsonb not null,
  provider text not null,
  fetched_at timestamptz not null default now()
);
alter table public.geocode_cache enable row level security;
-- sem políticas: acesso apenas pelo backend (service_role)

-- Inserção idempotente de cotações oficiais (sem conflito em índice de expressão)
create or replace function public.upsert_official_quotes(p_rows jsonb)
returns int language plpgsql security definer
set search_path = ''
as $$
declare n int;
begin
  insert into public.market_quotes (instrument_id, organization_id, value, currency, unit, region, source, source_url, observed_at, fetched_at, status, payload, created_by)
  select r.instrument_id, null, r.value, coalesce(r.currency, 'BRL'), r.unit, coalesce(r.region, 'Brasil'), r.source, r.source_url, r.observed_at,
         coalesce(r.fetched_at, now()), r.status, r.payload, null
  from jsonb_populate_recordset(null::public.market_quotes, p_rows) r
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.upsert_official_quotes(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_official_quotes(jsonb) to service_role;

-- Propriedades com regras de alerta ativas (para a coleta agendada)
create or replace function public.farms_with_weather_rules()
returns table (farm_id uuid, latitude numeric, longitude numeric)
language sql stable security definer
set search_path = ''
as $$
  select distinct f.id, f.latitude, f.longitude
  from public.farms f join public.weather_alert_rules r on r.farm_id = f.id and r.enabled
  where f.archived_at is null and f.latitude is not null and f.longitude is not null;
$$;
revoke execute on function public.farms_with_weather_rules() from public, anon, authenticated;
grant execute on function public.farms_with_weather_rules() to service_role;
grant execute on function public.evaluate_weather_rules(uuid, uuid) to service_role;

-- Último status por provedor (página de integrações) — sem dados sensíveis
create or replace view public.integration_status with (security_invoker = true) as
select distinct on (provider) provider, status, http_status, duration_ms, error, at
from public.integration_logs
order by provider, at desc;
grant select on public.integration_status to authenticated;
