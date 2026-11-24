-- AgroCentral — RPCs de onboarding, convites, permissões, resumo do dashboard e rotinas agendadas

-- ---------------------------------------------------------------------------
-- Onboarding: cria organização + vínculo de proprietário + primeira propriedade (atômico)
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(
  p_name text, p_city text, p_state text, p_main_crop text default null, p_farm jsonb default null)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  org_id uuid;
  farm_id uuid;
  owned int;
begin
  if uid is null then raise exception 'Não autenticado' using errcode = '42501'; end if;
  select count(*) into owned from public.memberships where user_id = uid and role = 'owner';
  if owned >= 5 then raise exception 'Limite de organizações por usuário atingido' using errcode = '54000'; end if;

  insert into public.organizations (name, city, state, main_crop, created_by)
  values (btrim(p_name), nullif(btrim(p_city), ''), nullif(upper(btrim(p_state)), ''), p_main_crop, uid)
  returning id into org_id;

  perform set_config('app.bootstrap', 'on', true);
  insert into public.memberships (organization_id, user_id, role, all_farms, created_by) values (org_id, uid, 'owner', true, uid);
  perform set_config('app.bootstrap', 'off', true);

  if p_farm is not null and coalesce(btrim(p_farm->>'name'), '') <> '' then
    insert into public.farms (organization_id, name, city, state, latitude, longitude, total_area_ha, productive_area_ha, tenure_type, created_by)
    values (org_id, btrim(p_farm->>'name'),
            coalesce(nullif(btrim(p_farm->>'city'), ''), nullif(btrim(p_city), '')),
            coalesce(nullif(upper(btrim(p_farm->>'state')), ''), nullif(upper(btrim(p_state)), '')),
            nullif(p_farm->>'latitude', '')::numeric, nullif(p_farm->>'longitude', '')::numeric,
            nullif(p_farm->>'total_area_ha', '')::numeric, nullif(p_farm->>'productive_area_ha', '')::numeric,
            nullif(p_farm->>'tenure_type', ''), uid)
    returning id into farm_id;
  end if;

  insert into public.profiles (id) values (uid) on conflict (id) do nothing;
  update public.profiles set last_organization_id = org_id, onboarded_at = coalesce(onboarded_at, now()) where id = uid;
  insert into public.user_preferences (user_id, selected_farm_id) values (uid, farm_id)
  on conflict (user_id) do update set selected_farm_id = excluded.selected_farm_id;
  return org_id;
end $$;
grant execute on function public.create_organization(text, text, text, text, jsonb) to authenticated;

-- Permissões efetivas do usuário corrente numa organização (para a interface; o banco continua sendo a autoridade)
create or replace function public.my_permissions(p_org uuid)
returns table (module text, actions text[], role public.app_role, all_farms boolean, farm_ids uuid[])
language sql stable security definer
set search_path = ''
as $$
  select rp.module, rp.actions, m.role, m.all_farms,
         coalesce((select array_agg(mf.farm_id) from public.membership_farms mf where mf.membership_id = m.id), '{}')
  from public.memberships m
  join public.role_permissions rp on rp.role = m.role
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_org and m.user_id = auth.uid() and m.status = 'active'
    and (rp.module in ('settings','reports','dashboard','notifications') or rp.module = any (o.enabled_modules)
         or (rp.module in ('fields','seasons') and 'farms' = any (o.enabled_modules)));
$$;
grant execute on function public.my_permissions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Convites
-- ---------------------------------------------------------------------------
create or replace function public.get_invitation(p_token uuid)
returns table (organization_name text, role public.app_role, email text, status text, expires_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select o.name, i.role, i.email,
         case when i.status = 'pending' and i.expires_at < now() then 'expired' else i.status end,
         i.expires_at
  from public.invitations i join public.organizations o on o.id = i.organization_id
  where i.token = p_token;
$$;
grant execute on function public.get_invitation(uuid) to authenticated;

create or replace function public.accept_invitation(p_token uuid)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare
  inv record;
  uid uuid := auth.uid();
  email text := lower(coalesce(auth.jwt()->>'email', ''));
  mid uuid;
  f uuid;
begin
  if uid is null then raise exception 'Não autenticado' using errcode = '42501'; end if;
  select * into inv from public.invitations where token = p_token for update;
  if not found then raise exception 'Convite não encontrado' using errcode = 'P0002'; end if;
  if inv.status <> 'pending' then raise exception 'Convite não está mais pendente' using errcode = '23514'; end if;
  if inv.expires_at < now() then
    update public.invitations set status = 'expired' where id = inv.id;
    raise exception 'Convite expirado' using errcode = '23514';
  end if;
  if lower(inv.email) <> email then
    raise exception 'Este convite foi enviado para outro e-mail' using errcode = '42501';
  end if;

  insert into public.memberships (organization_id, user_id, role, all_farms, created_by)
  values (inv.organization_id, uid, inv.role, inv.all_farms, inv.invited_by)
  on conflict (organization_id, user_id) do update set role = excluded.role, all_farms = excluded.all_farms, status = 'active'
  returning id into mid;
  delete from public.membership_farms where membership_id = mid;
  if not inv.all_farms then
    foreach f in array inv.farm_ids loop
      insert into public.membership_farms (membership_id, organization_id, farm_id)
      select mid, inv.organization_id, f where exists (select 1 from public.farms where id = f and organization_id = inv.organization_id)
      on conflict do nothing;
    end loop;
  end if;
  update public.invitations set status = 'accepted', accepted_at = now() where id = inv.id;
  insert into public.profiles (id) values (uid) on conflict (id) do nothing;
  update public.profiles set last_organization_id = inv.organization_id, onboarded_at = coalesce(onboarded_at, now()) where id = uid;
  return inv.organization_id;
end $$;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- Atualiza papel e escopo de propriedades de um membro (atômico)
create or replace function public.set_member_access(p_membership uuid, p_role public.app_role, p_all_farms boolean, p_farm_ids uuid[], p_status text default 'active')
returns void language plpgsql security definer
set search_path = ''
as $$
declare
  m record; f uuid;
begin
  select * into m from public.memberships where id = p_membership for update;
  if not found then raise exception 'Membro não encontrado' using errcode = 'P0002'; end if;
  if not private.has_perm(m.organization_id, 'settings', 'admin') then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if m.user_id = auth.uid() and p_role <> m.role then raise exception 'Você não pode alterar o próprio papel' using errcode = '42501'; end if;
  update public.memberships set role = p_role, all_farms = p_all_farms, status = p_status where id = p_membership;
  delete from public.membership_farms where membership_id = p_membership;
  if not p_all_farms then
    foreach f in array coalesce(p_farm_ids, '{}') loop
      insert into public.membership_farms (membership_id, organization_id, farm_id)
      select p_membership, m.organization_id, f where exists (select 1 from public.farms where id = f and organization_id = m.organization_id);
    end loop;
  end if;
end $$;
grant execute on function public.set_member_access(uuid, public.app_role, boolean, uuid[], text) to authenticated;

-- Lista de membros com e-mail (somente para administradores)
create or replace function public.list_members(p_org uuid)
returns table (membership_id uuid, user_id uuid, full_name text, email text, role public.app_role, status text, all_farms boolean, farm_ids uuid[], created_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select m.id, m.user_id, p.full_name,
         case when private.has_perm(p_org, 'settings', 'admin') or m.user_id = auth.uid() then u.email::text end,
         m.role, m.status, m.all_farms,
         coalesce((select array_agg(mf.farm_id) from public.membership_farms mf where mf.membership_id = m.id), '{}'),
         m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.organization_id = p_org and private.is_org_member(p_org)
  order by m.created_at;
$$;
grant execute on function public.list_members(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Resumo do dashboard (respeita RLS: security invoker)
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_summary(p_org uuid, p_farm uuid default null)
returns jsonb language sql stable security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'farms', (select count(*) from public.farms f where f.organization_id = p_org and f.archived_at is null and (p_farm is null or f.id = p_farm)),
    'total_area_ha', (select coalesce(sum(coalesce(f.total_area_ha, f.boundary_area_ha)), 0) from public.farms f where f.organization_id = p_org and f.archived_at is null and (p_farm is null or f.id = p_farm)),
    'productive_area_ha', (select coalesce(sum(f.productive_area_ha), 0) from public.farms f where f.organization_id = p_org and f.archived_at is null and (p_farm is null or f.id = p_farm)),
    'fields', (select count(*) from public.fields x where x.organization_id = p_org and x.archived_at is null and (p_farm is null or x.farm_id = p_farm)),
    'fields_area_ha', (select coalesce(sum(coalesce(x.manual_area_ha, x.area_ha)), 0) from public.fields x where x.organization_id = p_org and x.archived_at is null and (p_farm is null or x.farm_id = p_farm)),
    'active_seasons', (select count(*) from public.seasons s where s.organization_id = p_org and s.status in ('planejada','em_andamento') and s.archived_at is null and (p_farm is null or s.farm_id = p_farm)),
    'crops', (select coalesce(jsonb_agg(distinct c.name), '[]') from public.seasons s join public.crops c on c.id = s.crop_id where s.organization_id = p_org and s.status in ('planejada','em_andamento') and (p_farm is null or s.farm_id = p_farm)),
    'tasks_open', (select count(*) from public.tasks t where t.organization_id = p_org and t.status in ('planejada','pendente','em_andamento') and t.archived_at is null and (p_farm is null or t.farm_id = p_farm)),
    'tasks_overdue', (select count(*) from public.tasks t where t.organization_id = p_org and t.status in ('planejada','pendente','em_andamento') and t.due_date < current_date and t.archived_at is null and (p_farm is null or t.farm_id = p_farm)),
    'tasks_today', (select count(*) from public.tasks t where t.organization_id = p_org and t.status in ('planejada','pendente','em_andamento') and t.due_date = current_date and (p_farm is null or t.farm_id = p_farm)),
    'low_stock', (select count(*) from public.inventory_items i where i.organization_id = p_org and i.archived_at is null and i.min_quantity is not null and i.current_quantity <= i.min_quantity and (p_farm is null or i.farm_id is null or i.farm_id = p_farm)),
    'maintenance_due', (select count(*) from public.equipment e where e.organization_id = p_org and e.archived_at is null and e.status <> 'vendido' and (p_farm is null or e.farm_id is null or e.farm_id = p_farm) and (
        (e.maintenance_interval_hours is not null and e.hour_meter >= coalesce(e.last_maintenance_hours, 0) + e.maintenance_interval_hours * 0.9)
        or (e.maintenance_interval_days is not null and coalesce(e.last_maintenance_date, e.acquisition_date, e.created_at::date) + e.maintenance_interval_days <= current_date + 7))),
    'docs_expiring', (select count(*) from public.documents d where d.organization_id = p_org and d.archived_at is null and d.expires_at between current_date and current_date + 30 and (p_farm is null or d.farm_id is null or d.farm_id = p_farm))
  );
$$;
grant execute on function public.dashboard_summary(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rotinas agendadas: notificações de vencimentos, estoque, manutenção, documentos e tarefas
-- ---------------------------------------------------------------------------
create or replace function private.generate_scheduled_notifications()
returns int language plpgsql security definer
set search_path = ''
as $$
declare
  r record; n int := 0;
begin
  -- Financeiro: vence em até 3 dias / vencido
  for r in select * from public.transactions where status = 'pendente' and archived_at is null and due_date <= current_date + 3 loop
    n := n + private.notify_members(r.organization_id, r.farm_id, 'finance', 'financeiro',
      case when r.due_date < current_date then 'alta' else 'media' end,
      case when r.due_date < current_date then
        format('%s vencida: %s', case r.kind when 'despesa' then 'Conta a pagar' else 'Conta a receber' end, r.description)
      else format('%s vence em %s: %s', case r.kind when 'despesa' then 'Conta a pagar' else 'Conta a receber' end, to_char(r.due_date, 'DD/MM'), r.description) end,
      format('Valor R$ %s', to_char(r.amount, 'FM999G999G990D00')), '/financeiro',
      format('fin:%s:%s', r.id, case when r.due_date < current_date then 'overdue' else 'due' end), 'AgroCentral');
  end loop;

  -- Estoque mínimo (uma vez por semana por item)
  for r in select * from public.inventory_items where archived_at is null and min_quantity is not null and current_quantity <= min_quantity loop
    n := n + private.notify_members(r.organization_id, r.farm_id, 'inventory', 'estoque', 'media',
      format('Estoque baixo: %s', r.name), format('Saldo %s %s (mínimo %s %s)', r.current_quantity, r.unit, r.min_quantity, r.unit),
      '/estoque', format('stock-min:%s:%s', r.id, to_char(current_date, 'IYYY-IW')), 'AgroCentral');
  end loop;

  -- Lotes próximos da validade (30 dias)
  for r in select l.*, i.name as item_name, i.unit from public.stock_lots l join public.inventory_items i on i.id = l.item_id
           where l.quantity > 0 and l.expires_at is not null and l.expires_at <= current_date + 30 loop
    n := n + private.notify_members(r.organization_id, r.farm_id, 'inventory', 'estoque', case when r.expires_at < current_date then 'alta' else 'media' end,
      format('Lote %s de %s %s', r.lot_code, r.item_name, case when r.expires_at < current_date then 'vencido' else 'vence em ' || to_char(r.expires_at, 'DD/MM/YYYY') end),
      format('Quantidade no lote: %s %s', r.quantity, r.unit), '/estoque',
      format('lot-exp:%s:%s', r.id, case when r.expires_at < current_date then 'expired' else 'soon' end), 'AgroCentral');
  end loop;

  -- Manutenção por horas ou por data
  for r in select * from public.equipment e where archived_at is null and status <> 'vendido' and (
        (maintenance_interval_hours is not null and hour_meter >= coalesce(last_maintenance_hours, 0) + maintenance_interval_hours * 0.9)
        or (maintenance_interval_days is not null and coalesce(last_maintenance_date, acquisition_date, created_at::date) + maintenance_interval_days <= current_date + 7)) loop
    n := n + private.notify_members(r.organization_id, r.farm_id, 'equipment', 'maquinas', 'media',
      format('Manutenção próxima ou vencida: %s', r.name),
      format('Horímetro %s h; última manutenção %s', r.hour_meter, coalesce(to_char(r.last_maintenance_date, 'DD/MM/YYYY'), 'não registrada')),
      '/maquinas', format('maint:%s:%s', r.id, coalesce(r.last_maintenance_date::text, 'none') || ':' || coalesce(r.last_maintenance_hours::text, '0')), 'AgroCentral');
  end loop;

  -- Documentos vencendo em 30 dias
  for r in select * from public.documents where archived_at is null and expires_at is not null and expires_at <= current_date + 30 loop
    n := n + private.notify_members(r.organization_id, r.farm_id, 'documents', 'documentos', case when r.expires_at < current_date then 'alta' else 'media' end,
      format('Documento %s: %s', case when r.expires_at < current_date then 'vencido' else 'vence em ' || to_char(r.expires_at, 'DD/MM/YYYY') end, r.name),
      null, '/documentos', format('doc:%s:%s', r.id, case when r.expires_at < current_date then 'expired' else 'soon' end), 'AgroCentral');
  end loop;

  -- Tarefas atrasadas: notifica o responsável (usuário) ou gestores
  for r in select * from public.tasks where status in ('planejada','pendente','em_andamento') and archived_at is null and due_date < current_date loop
    if r.assignee_user_id is not null then
      if private.notify(r.assignee_user_id, r.organization_id, 'tarefas', 'media', format('Tarefa atrasada: %s', r.title),
          format('Prazo: %s', to_char(r.due_date, 'DD/MM/YYYY')), '/tarefas', format('task-late:%s', r.id), 'AgroCentral') then n := n + 1; end if;
    else
      n := n + private.notify_members(r.organization_id, r.farm_id, 'tasks', 'tarefas', 'media', format('Tarefa atrasada: %s', r.title),
        format('Prazo: %s', to_char(r.due_date, 'DD/MM/YYYY')), '/tarefas', format('task-late:%s', r.id), 'AgroCentral');
    end if;
  end loop;

  -- Marketplace: expira anúncios vencidos
  update public.listings set status = 'expirado' where status = 'publicado' and expires_at < now();
  -- Convites expirados
  update public.invitations set status = 'expired' where status = 'pending' and expires_at < now();
  return n;
end $$;

-- Notifica o responsável quando uma tarefa é atribuída
create or replace function private.notify_task_assignment()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if new.assignee_user_id is not null and new.assignee_user_id is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assignee_user_id is distinct from old.assignee_user_id) then
    perform private.notify(new.assignee_user_id, new.organization_id, 'tarefas', case when new.priority in ('alta','urgente') then 'alta' else 'media' end,
      format('Nova tarefa atribuída: %s', new.title),
      case when new.due_date is not null then format('Prazo: %s', to_char(new.due_date, 'DD/MM/YYYY')) end,
      '/tarefas', format('task-assign:%s:%s', new.id, new.assignee_user_id), 'AgroCentral');
  end if;
  return null;
end $$;
create trigger tasks_notify after insert or update of assignee_user_id on public.tasks for each row execute function private.notify_task_assignment();

-- Tempo real (respeita RLS): notificações e mensagens do marketplace
alter publication supabase_realtime add table public.notifications, public.messages;

-- Moderação automática: a regra de anúncios aceita alteração de moderação vinda de rotinas internas
create or replace function private.listing_rules()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  recent int;
  internal boolean := current_setting('app.moderation', true) = 'on';
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    select count(*) into recent from public.listings where seller_id = new.seller_id and created_at > now() - interval '24 hours';
    if recent >= 20 then
      raise exception 'Limite de 20 anúncios por dia atingido' using errcode = '54000';
    end if;
    if exists (select 1 from public.listings l where l.seller_id = new.seller_id and lower(l.title) = lower(new.title)
               and l.status in ('publicado','pausado','rascunho')) then
      raise exception 'Você já tem um anúncio ativo com este título' using errcode = '23505';
    end if;
  else
    new.created_at := old.created_at;
    new.seller_id := old.seller_id;
    if not private.is_platform_admin() and not internal then
      new.moderation_status := old.moderation_status;
      new.moderation_note := old.moderation_note;
      if old.status = 'removido' then
        raise exception 'Anúncio removido pela moderação não pode ser alterado' using errcode = '42501';
      end if;
      if new.status = 'removido' then
        raise exception 'Status "removido" é exclusivo da moderação' using errcode = '42501';
      end if;
      if old.moderation_status = 'em_analise' and new.status = 'publicado' and old.status <> 'publicado' then
        raise exception 'Anúncio em análise não pode ser republicado até a revisão' using errcode = '42501';
      end if;
    end if;
  end if;
  if not new.show_phone then new.contact_phone := null; end if;
  if new.status = 'publicado' and (tg_op = 'INSERT' or old.status <> 'publicado') then
    new.published_at := now();
    new.expires_at := now() + interval '60 days';
  end if;
  if new.moderation_status = 'removido' then new.status := 'removido'; end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function private.report_rules()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  open_reports int; l record;
begin
  select * into l from public.listings where id = new.listing_id;
  if l.seller_id = new.reporter_id then raise exception 'Você não pode denunciar o próprio anúncio' using errcode = '23514'; end if;
  select count(*) into open_reports from public.listing_reports where listing_id = new.listing_id and status = 'aberta';
  if open_reports >= 3 and l.moderation_status = 'ok' then
    perform set_config('app.moderation', 'on', true);
    update public.listings set moderation_status = 'em_analise', moderation_note = 'Em análise após denúncias' where id = l.id;
    perform set_config('app.moderation', 'off', true);
    perform private.notify(l.seller_id, null, 'marketplace', 'alta', 'Anúncio em análise',
      'Seu anúncio "' || l.title || '" recebeu denúncias e está temporariamente oculto até revisão.', '/marketplace/meus-anuncios',
      'mod:' || l.id || ':' || current_date, 'moderação');
  end if;
  return null;
end $$;

create or replace function private.expire_listings()
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  perform set_config('app.moderation', 'on', true);
  update public.listings set status = 'expirado' where status = 'publicado' and expires_at < now();
  perform set_config('app.moderation', 'off', true);
end $$;
