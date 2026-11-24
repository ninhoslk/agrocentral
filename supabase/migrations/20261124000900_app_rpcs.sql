-- AgroCentral — RPCs transacionais usadas pela aplicação (security invoker: RLS do usuário se aplica)

-- Registra atividade + insumos (saída de estoque) + uso de máquina em uma única transação.
create or replace function public.register_activity(p_activity jsonb, p_inputs jsonb default '[]'::jsonb, p_usage jsonb default null)
returns uuid language plpgsql security invoker
set search_path = ''
as $$
declare
  a public.activities;
  a_id uuid;
  i jsonb;
begin
  a := jsonb_populate_record(null::public.activities, p_activity);
  if jsonb_array_length(coalesce(p_inputs, '[]'::jsonb)) > 0 and coalesce(a.status, 'concluida') not in ('em_andamento', 'concluida') then
    raise exception 'Insumos só podem ser lançados em atividades em andamento ou concluídas' using errcode = '23514';
  end if;
  insert into public.activities (organization_id, farm_id, field_id, season_id, activity_type_id, title, status, started_at, ended_at,
    responsible_employee_id, team_id, equipment_id, area_worked_ha, labor_cost, other_cost, notes)
  values (a.organization_id, a.farm_id, a.field_id, a.season_id, a.activity_type_id, a.title, coalesce(a.status, 'concluida'), a.started_at, a.ended_at,
    a.responsible_employee_id, a.team_id, a.equipment_id, a.area_worked_ha, coalesce(a.labor_cost, 0), coalesce(a.other_cost, 0), a.notes)
  returning id into a_id;

  for i in select * from jsonb_array_elements(coalesce(p_inputs, '[]'::jsonb)) loop
    insert into public.activity_inputs (organization_id, activity_id, item_id, quantity, dose_per_ha, notes)
    values (a.organization_id, a_id, (i->>'item_id')::uuid, (i->>'quantity')::numeric, nullif(i->>'dose_per_ha', '')::numeric, nullif(i->>'notes', ''));
  end loop;

  if p_usage is not null and a.equipment_id is not null and (
       nullif(p_usage->>'hours', '') is not null or nullif(p_usage->>'fuel_liters', '') is not null or nullif(p_usage->>'hour_meter_end', '') is not null) then
    insert into public.equipment_usage (organization_id, equipment_id, usage_date, hours, hour_meter_end, fuel_liters, fuel_cost, operator_employee_id, activity_id, field_id)
    values (a.organization_id, a.equipment_id, (a.started_at at time zone 'America/Sao_Paulo')::date,
      nullif(p_usage->>'hours', '')::numeric, nullif(p_usage->>'hour_meter_end', '')::numeric,
      nullif(p_usage->>'fuel_liters', '')::numeric, nullif(p_usage->>'fuel_cost', '')::numeric,
      a.responsible_employee_id, a_id, a.field_id);
  end if;
  return a_id;
end $$;
grant execute on function public.register_activity(jsonb, jsonb, jsonb) to authenticated;

-- Lança parcelas/recorrência de forma atômica (valores já divididos no cliente com centavos exatos)
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
    installment_number, installment_count, installment_group, notes)
  select r.organization_id, r.farm_id, r.season_id, r.field_id, r.crop_id, r.cost_center_id, r.category_id, r.contact_id, r.account_id,
    r.kind, r.description, r.amount, r.quantity, r.quantity_unit, coalesce(r.issue_date, current_date), r.due_date, r.paid_date, coalesce(r.status, 'pendente'),
    r.payment_method, r.document_number, r.installment_number, r.installment_count, r.installment_group, r.notes
  from jsonb_populate_recordset(null::public.transactions, p_rows) r;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.create_transactions(jsonb) to authenticated;

-- Convite: valida permissão, evita duplicidade e devolve o token para o link de convite
create or replace function public.create_invitation(p_org uuid, p_email text, p_role public.app_role, p_all_farms boolean, p_farm_ids uuid[])
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare
  t uuid;
begin
  if not private.has_perm(p_org, 'settings', 'admin') then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if p_role = 'owner' then raise exception 'Não é possível convidar como proprietário' using errcode = '42501'; end if;
  if (select count(*) from public.invitations where organization_id = p_org and created_at > now() - interval '1 day') >= 50 then
    raise exception 'Limite diário de convites atingido' using errcode = '54000';
  end if;
  if exists (select 1 from public.memberships m join auth.users u on u.id = m.user_id
             where m.organization_id = p_org and lower(u.email) = lower(btrim(p_email))) then
    raise exception 'Este e-mail já é membro da organização' using errcode = '23505';
  end if;
  update public.invitations set status = 'revoked' where organization_id = p_org and lower(email) = lower(btrim(p_email)) and status = 'pending';
  insert into public.invitations (organization_id, email, role, all_farms, farm_ids, invited_by)
  values (p_org, lower(btrim(p_email)), p_role, p_all_farms, coalesce(p_farm_ids, '{}'), auth.uid())
  returning token into t;
  return t;
end $$;
grant execute on function public.create_invitation(uuid, text, public.app_role, boolean, uuid[]) to authenticated;
