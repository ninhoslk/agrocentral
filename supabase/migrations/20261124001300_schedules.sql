-- AgroCentral — Rotinas agendadas (pg_cron + pg_net)
-- O segredo de chamada fica em private.app_config (não exposto pela API).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function private.call_function(p_name text)
returns bigint language plpgsql security definer
set search_path = ''
as $$
declare
  base text := coalesce((select value from private.app_config where key = 'functions_url'), 'https://ejclwvxbojtufyiacjdo.supabase.co/functions/v1');
  secret text := (select value from private.app_config where key = 'cron_secret');
begin
  return net.http_post(
    url := base || '/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    body := '{"mode":"cron"}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;
revoke execute on function private.call_function(text) from public, anon, authenticated;

-- Clima e alertas de clima: a cada hora (minuto 7)
select cron.schedule('agro-weather-hourly', '7 * * * *', $$select private.call_function('weather')$$);
-- Câmbio oficial (BCB/SGS): dias úteis às 13h40 e 17h40 (Brasília = UTC-3)
select cron.schedule('agro-market-sync', '40 16,20 * * 1-5', $$select private.call_function('market-sync')$$);
-- Notificações de vencimentos, estoque, manutenção, documentos e tarefas: 6h e 14h (Brasília)
select cron.schedule('agro-daily-notifications', '0 9,17 * * *', $$select private.generate_scheduled_notifications(); select private.expire_listings()$$);
