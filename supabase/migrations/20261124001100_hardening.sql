-- AgroCentral — Endurecimento final de privilégios
-- Funções do schema private não são executáveis por PUBLIC/anon (exceto a usada na política pública).
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
grant execute on function private.is_platform_admin() to anon;
alter default privileges in schema private revoke execute on functions from public;

-- RPCs públicas: somente usuários autenticados
revoke execute on function public.create_organization(text, text, text, text, jsonb) from public, anon;
revoke execute on function public.my_permissions(uuid) from public, anon;
revoke execute on function public.get_invitation(uuid) from public, anon;
revoke execute on function public.accept_invitation(uuid) from public, anon;
revoke execute on function public.set_member_access(uuid, public.app_role, boolean, uuid[], text) from public, anon;
revoke execute on function public.list_members(uuid) from public, anon;
revoke execute on function public.dashboard_summary(uuid, uuid) from public, anon;
revoke execute on function public.seed_demo_data(uuid) from public, anon;
revoke execute on function public.clear_demo_data(uuid) from public, anon;
revoke execute on function public.respond_offer(uuid, text) from public, anon;
revoke execute on function public.moderate_listing(uuid, text, text) from public, anon;
revoke execute on function public.marketplace_counters() from public, anon;
revoke execute on function public.register_activity(jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.create_transactions(jsonb) from public, anon;
revoke execute on function public.create_invitation(uuid, text, public.app_role, boolean, uuid[]) from public, anon;
