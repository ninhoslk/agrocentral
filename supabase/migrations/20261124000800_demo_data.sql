-- AgroCentral — Dados demonstrativos coerentes (todos marcados is_demo = true)
-- Geometrias, cotações e números são FICTÍCIOS e aparecem com o selo "DADO DEMONSTRATIVO".

create or replace function public.seed_demo_data(p_org uuid)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_farm uuid; f_a uuid; f_b uuid; f_c uuid;
  s_soja uuid; s_milho uuid;
  c_soja uuid; c_milho uuid;
  v_var_soja uuid; v_var_milho uuid;
  e_joao uuid; e_maria uuid; e_pedro uuid; t_team uuid;
  q_trator uuid; q_colh uuid; q_pulv uuid;
  loc uuid; sup_insumos uuid; sup_posto uuid; cli_trading uuid;
  i_semente uuid; i_map uuid; i_herb uuid; i_diesel uuid; i_kcl uuid;
  a_plantio uuid; a_aduba uuid; a_pulv uuid;
  acc uuid; cc uuid;
  t_plantio uuid; t_aduba uuid; t_pulv uuid; t_insp uuid; t_colheita uuid;
  cat uuid;
  base date := current_date;
begin
  if not private.has_role(p_org, array['owner','admin']::public.app_role[]) then
    raise exception 'Somente proprietário/administrador pode gerar dados demonstrativos' using errcode = '42501';
  end if;
  if exists (select 1 from public.farms where organization_id = p_org and is_demo) then
    raise exception 'Os dados demonstrativos já existem nesta organização' using errcode = '23505';
  end if;

  select id into c_soja from public.crops where slug = 'soja' and organization_id is null;
  select id into c_milho from public.crops where slug = 'milho' and organization_id is null;
  select id into t_plantio from public.activity_types where slug = 'plantio' and organization_id is null;
  select id into t_aduba from public.activity_types where slug = 'adubacao' and organization_id is null;
  select id into t_pulv from public.activity_types where slug = 'pulverizacao' and organization_id is null;
  select id into t_insp from public.activity_types where slug = 'inspecao' and organization_id is null;
  select id into t_colheita from public.activity_types where slug = 'colheita' and organization_id is null;

  -- Propriedade e talhões (geometria ilustrativa próxima a Rio Verde/GO)
  insert into public.farms (organization_id, name, code, city, state, total_area_ha, productive_area_ha, preservation_area_ha, legal_reserve_ha,
                            tenure_type, owner_name, notes, boundary_geojson, is_demo, created_by)
  values (p_org, 'Fazenda Boa Esperança (demonstração)', 'FBE', 'Rio Verde', 'GO', 1500, 1150, 80, 300, 'propria', 'Produtor Exemplo',
          'Propriedade fictícia para demonstração. Limites ilustrativos, não georreferenciados.',
          '{"type":"Polygon","coordinates":[[[-50.935,-17.815],[-50.895,-17.815],[-50.895,-17.783],[-50.935,-17.783],[-50.935,-17.815]]]}'::jsonb,
          true, uid)
  returning id into v_farm;

  insert into public.fields (organization_id, farm_id, name, code, soil_type, relief, irrigation, color, geojson, is_demo, created_by) values
    (p_org, v_farm, 'Talhão 01 — Sede', 'T01', 'Latossolo Vermelho', 'plano', 'sequeiro', '#c9a227',
     '{"type":"Polygon","coordinates":[[[-50.931,-17.800],[-50.918,-17.800],[-50.918,-17.788],[-50.931,-17.788],[-50.931,-17.800]]]}'::jsonb, true, uid)
  returning id into f_a;
  insert into public.fields (organization_id, farm_id, name, code, soil_type, relief, irrigation, color, geojson, is_demo, created_by) values
    (p_org, v_farm, 'Talhão 02 — Baixada', 'T02', 'Latossolo Vermelho-Amarelo', 'suave_ondulado', 'sequeiro', '#e0b000',
     '{"type":"Polygon","coordinates":[[[-50.916,-17.800],[-50.899,-17.800],[-50.899,-17.788],[-50.916,-17.788],[-50.916,-17.800]]]}'::jsonb, true, uid)
  returning id into f_b;
  insert into public.fields (organization_id, farm_id, name, code, soil_type, relief, irrigation, color, geojson, is_demo, created_by) values
    (p_org, v_farm, 'Talhão 03 — Pivô', 'T03', 'Latossolo Vermelho', 'plano', 'pivo', '#52b788',
     '{"type":"Polygon","coordinates":[[[-50.931,-17.812],[-50.912,-17.812],[-50.912,-17.802],[-50.931,-17.802],[-50.931,-17.812]]]}'::jsonb, true, uid)
  returning id into f_c;

  insert into public.points_of_interest (organization_id, farm_id, kind, name, latitude, longitude, is_demo) values
    (p_org, v_farm, 'sede', 'Sede', -17.7860, -50.9300, true),
    (p_org, v_farm, 'silo', 'Silo 1', -17.7870, -50.9250, true),
    (p_org, v_farm, 'poco', 'Poço artesiano', -17.8020, -50.9330, true),
    (p_org, v_farm, 'galpao', 'Galpão de máquinas', -17.7865, -50.9285, true);

  -- Equipe
  insert into public.employees (organization_id, farm_id, full_name, role_title, phone, status, hourly_cost, is_demo)
    values (p_org, v_farm, 'João da Silva (demo)', 'Operador de máquinas', '(64) 90000-0001', 'ativo', 28.50, true) returning id into e_joao;
  insert into public.employees (organization_id, farm_id, full_name, role_title, phone, status, hourly_cost, is_demo)
    values (p_org, v_farm, 'Maria Souza (demo)', 'Agrônoma', '(64) 90000-0002', 'ativo', 65.00, true) returning id into e_maria;
  insert into public.employees (organization_id, farm_id, full_name, role_title, phone, status, hourly_cost, is_demo)
    values (p_org, v_farm, 'Pedro Lima (demo)', 'Gerente de campo', '(64) 90000-0003', 'ativo', 48.00, true) returning id into e_pedro;
  insert into public.teams (organization_id, farm_id, name, leader_employee_id, is_demo) values (p_org, v_farm, 'Equipe de campo', e_pedro, true) returning id into t_team;
  insert into public.team_members (organization_id, team_id, employee_id) values (p_org, t_team, e_joao), (p_org, t_team, e_pedro);

  -- Variedades e safras
  insert into public.varieties (organization_id, crop_id, name, supplier, cycle_days, is_demo) values (p_org, c_soja, 'Soja Exemplo 7.4 IPRO', 'Sementes Exemplo', 115, true) returning id into v_var_soja;
  insert into public.varieties (organization_id, crop_id, name, supplier, cycle_days, is_demo) values (p_org, c_milho, 'Milho Híbrido Exemplo', 'Sementes Exemplo', 130, true) returning id into v_var_milho;

  insert into public.seasons (organization_id, farm_id, name, cycle, crop_id, start_date, end_date, status, responsible_employee_id, expected_yield_per_ha, estimated_cost, is_demo)
  values (p_org, v_farm, 'Soja 2026/27', '2026/27', c_soja, base - 45, base + 80, 'em_andamento', e_maria, 62, 1150000, true) returning id into s_soja;
  insert into public.seasons (organization_id, farm_id, name, cycle, crop_id, start_date, end_date, status, responsible_employee_id, expected_yield_per_ha, estimated_cost, is_demo)
  values (p_org, v_farm, 'Milho safrinha 2026', '2026', c_milho, base - 300, base - 120, 'colhida', e_maria, 105, 420000, true) returning id into s_milho;

  insert into public.season_fields (organization_id, season_id, field_id, variety_id, planting_date, expected_harvest_date, population_per_ha, seed_rate_kg_ha, stage, expected_yield_per_ha, is_demo) values
    (p_org, s_soja, f_a, v_var_soja, base - 40, base + 75, 300000, 55, 'V6 (vegetativo)', 64, true),
    (p_org, s_soja, f_b, v_var_soja, base - 37, base + 78, 300000, 55, 'V5 (vegetativo)', 60, true),
    (p_org, s_milho, f_c, v_var_milho, base - 295, base - 125, 65000, 20, 'Colhido', 105, true);

  insert into public.harvest_records (organization_id, season_id, field_id, harvest_date, quantity, unit, moisture_pct, impurity_pct, quality, destination, is_demo)
    values (p_org, s_milho, f_c, base - 125, 18900, 'sc', 14.5, 1.2, 'Tipo 1', 'armazem_proprio', true);

  -- Contatos e estoque
  insert into public.contacts (organization_id, kind, name, city, state, is_demo) values (p_org, 'fornecedor', 'Agro Insumos Exemplo Ltda (demo)', 'Rio Verde', 'GO', true) returning id into sup_insumos;
  insert into public.contacts (organization_id, kind, name, city, state, is_demo) values (p_org, 'fornecedor', 'Posto Exemplo (demo)', 'Rio Verde', 'GO', true) returning id into sup_posto;
  insert into public.contacts (organization_id, kind, name, city, state, is_demo) values (p_org, 'cliente', 'Trading Exemplo S.A. (demo)', 'Goiânia', 'GO', true) returning id into cli_trading;
  insert into public.inventory_locations (organization_id, farm_id, name, is_demo) values (p_org, v_farm, 'Almoxarifado sede', true) returning id into loc;

  insert into public.inventory_items (organization_id, farm_id, name, category, unit, min_quantity, supplier_id, location_id, is_demo)
    values (p_org, v_farm, 'Semente de soja 7.4 IPRO', 'semente', 'kg', 500, sup_insumos, loc, true) returning id into i_semente;
  insert into public.inventory_items (organization_id, farm_id, name, category, unit, min_quantity, supplier_id, location_id, is_demo)
    values (p_org, v_farm, 'Fertilizante MAP 11-52-00', 'fertilizante', 'kg', 5000, sup_insumos, loc, true) returning id into i_map;
  insert into public.inventory_items (organization_id, farm_id, name, category, unit, min_quantity, supplier_id, location_id, active_ingredient, is_demo)
    values (p_org, v_farm, 'Herbicida exemplo (demo)', 'defensivo', 'L', 100, sup_insumos, loc, 'Ingrediente ativo fictício', true) returning id into i_herb;
  insert into public.inventory_items (organization_id, farm_id, name, category, unit, min_quantity, supplier_id, location_id, is_demo)
    values (p_org, v_farm, 'Óleo diesel S10', 'combustivel', 'L', 3000, sup_posto, loc, true) returning id into i_diesel;
  insert into public.inventory_items (organization_id, farm_id, name, category, unit, min_quantity, supplier_id, location_id, is_demo)
    values (p_org, v_farm, 'Cloreto de potássio (KCl)', 'fertilizante', 'kg', 4000, sup_insumos, loc, true) returning id into i_kcl;

  insert into public.stock_movements (organization_id, farm_id, item_id, kind, quantity, unit_cost, occurred_at, contact_id, lot_code, lot_expires_at, notes, is_demo, created_by) values
    (p_org, v_farm, i_semente, 'entrada', 15000, 7.80, base - 60, sup_insumos, 'LT-SOJA-01', base + 200, 'Compra safra 2026/27', true, uid),
    (p_org, v_farm, i_map, 'entrada', 70000, 4.10, base - 60, sup_insumos, null, null, 'Compra safra 2026/27', true, uid),
    (p_org, v_farm, i_herb, 'entrada', 600, 38.00, base - 50, sup_insumos, 'LT-HB-22', base + 25, 'Compra', true, uid),
    (p_org, v_farm, i_diesel, 'entrada', 20000, 6.05, base - 55, sup_posto, null, null, 'Abastecimento tanque', true, uid),
    (p_org, v_farm, i_kcl, 'entrada', 3500, 3.20, base - 58, sup_insumos, null, null, 'Compra', true, uid);

  -- Máquinas
  insert into public.equipment (organization_id, farm_id, name, kind, brand, model, year, identifier, hour_meter, status, fuel_type, maintenance_interval_hours, maintenance_interval_days, last_maintenance_date, last_maintenance_hours, acquisition_value, is_demo)
    values (p_org, v_farm, 'Trator 01 (demo)', 'trator', 'Marca Exemplo', 'TX-200', 2019, 'TR-01', 6420, 'ativo', 'diesel', 250, 180, base - 150, 6200, 480000, true) returning id into q_trator;
  insert into public.equipment (organization_id, farm_id, name, kind, brand, model, year, identifier, hour_meter, status, fuel_type, maintenance_interval_hours, maintenance_interval_days, last_maintenance_date, last_maintenance_hours, acquisition_value, is_demo)
    values (p_org, v_farm, 'Colheitadeira 01 (demo)', 'colheitadeira', 'Marca Exemplo', 'CH-9', 2021, 'CO-01', 2310, 'ativo', 'diesel', 300, 365, base - 110, 2290, 1850000, true) returning id into q_colh;
  insert into public.equipment (organization_id, farm_id, name, kind, brand, model, year, identifier, hour_meter, status, fuel_type, maintenance_interval_hours, maintenance_interval_days, last_maintenance_date, last_maintenance_hours, acquisition_value, is_demo)
    values (p_org, v_farm, 'Pulverizador autopropelido (demo)', 'pulverizador', 'Marca Exemplo', 'PV-30', 2020, 'PU-01', 3105, 'ativo', 'diesel', 200, 120, base - 100, 2950, 920000, true) returning id into q_pulv;
  insert into public.maintenance_records (organization_id, equipment_id, kind, status, performed_date, hour_meter, description, parts_cost, labor_cost, provider, is_demo) values
    (p_org, q_trator, 'preventiva', 'concluida', base - 150, 6200, 'Revisão 250 h: troca de óleo e filtros', 2850, 900, 'Oficina Exemplo', true),
    (p_org, q_pulv, 'corretiva', 'concluida', base - 100, 2950, 'Substituição de bicos e mangueiras', 4200, 1100, 'Oficina Exemplo', true);
  insert into public.maintenance_records (organization_id, equipment_id, kind, status, scheduled_date, description, parts_cost, labor_cost, provider, is_demo) values
    (p_org, q_colh, 'preventiva', 'agendada', base + 20, 'Revisão pré-colheita', 0, 0, 'Concessionária Exemplo', true);

  -- Atividades com insumos (geram saídas de estoque e custo)
  insert into public.activities (organization_id, farm_id, field_id, season_id, activity_type_id, title, status, started_at, ended_at, responsible_employee_id, team_id, equipment_id, area_worked_ha, labor_cost, is_demo)
    values (p_org, v_farm, f_a, s_soja, t_plantio, 'Plantio soja T01', 'concluida', (base - 40)::timestamptz + interval '10 hours', (base - 40)::timestamptz + interval '21 hours', e_joao, t_team, q_trator, 160, 2200, true)
    returning id into a_plantio;
  insert into public.activity_inputs (organization_id, activity_id, item_id, quantity, dose_per_ha, is_demo) values
    (p_org, a_plantio, i_semente, 8800, 55, true),
    (p_org, a_plantio, i_map, 32000, 200, true);
  insert into public.equipment_usage (organization_id, equipment_id, usage_date, hours, fuel_liters, fuel_cost, operator_employee_id, activity_id, field_id, is_demo)
    values (p_org, q_trator, base - 40, 11, 420, 2541, e_joao, a_plantio, f_a, true);

  insert into public.activities (organization_id, farm_id, field_id, season_id, activity_type_id, title, status, started_at, ended_at, responsible_employee_id, equipment_id, area_worked_ha, labor_cost, is_demo)
    values (p_org, v_farm, f_b, s_soja, t_aduba, 'Adubação de base T02', 'concluida', (base - 38)::timestamptz + interval '10 hours', (base - 38)::timestamptz + interval '19 hours', e_joao, q_trator, 210, 1900, true)
    returning id into a_aduba;
  insert into public.activity_inputs (organization_id, activity_id, item_id, quantity, dose_per_ha, is_demo) values
    (p_org, a_aduba, i_map, 31500, 150, true);

  insert into public.activities (organization_id, farm_id, field_id, season_id, activity_type_id, title, status, started_at, ended_at, responsible_employee_id, equipment_id, area_worked_ha, labor_cost, is_demo)
    values (p_org, v_farm, f_a, s_soja, t_pulv, 'Aplicação de herbicida pós-emergente T01', 'concluida', (base - 12)::timestamptz + interval '9 hours', (base - 12)::timestamptz + interval '14 hours', e_joao, q_pulv, 160, 800, true)
    returning id into a_pulv;
  insert into public.activity_inputs (organization_id, activity_id, item_id, quantity, dose_per_ha, is_demo) values
    (p_org, a_pulv, i_herb, 480, 3, true);

  insert into public.activities (organization_id, farm_id, field_id, season_id, activity_type_id, title, status, started_at, responsible_employee_id, notes, is_demo)
    values (p_org, v_farm, f_b, s_soja, t_insp, 'Monitoramento de pragas T02', 'concluida', (base - 3)::timestamptz + interval '11 hours', e_maria, 'Baixa incidência de lagartas; manter monitoramento semanal.', true);

  insert into public.work_logs (organization_id, farm_id, employee_id, work_date, hours, activity_id, is_demo) values
    (p_org, v_farm, e_joao, base - 40, 11, a_plantio, true),
    (p_org, v_farm, e_joao, base - 38, 9, a_aduba, true),
    (p_org, v_farm, e_joao, base - 12, 5, a_pulv, true);

  -- Tarefas
  insert into public.tasks (organization_id, farm_id, field_id, season_id, title, description, due_date, priority, status, assignee_employee_id, is_demo) values
    (p_org, v_farm, f_a, s_soja, 'Monitorar pragas no T01', 'Pano de batida em 10 pontos', base, 'alta', 'pendente', e_maria, true),
    (p_org, v_farm, f_b, s_soja, 'Aplicação de fungicida preventivo T02', null, base + 5, 'media', 'planejada', e_joao, true),
    (p_org, v_farm, null, null, 'Revisar pulverizador antes da próxima aplicação', null, base - 2, 'alta', 'pendente', e_pedro, true),
    (p_org, v_farm, f_c, null, 'Coleta de amostras de solo T03', 'Profundidades 0-20 e 20-40 cm', base + 12, 'baixa', 'pendente', e_maria, true);

  -- Financeiro
  insert into public.financial_accounts (organization_id, name, kind, bank, initial_balance, is_demo) values (p_org, 'Conta principal (demo)', 'conta_corrente', 'Banco Exemplo', 350000, true) returning id into acc;
  insert into public.cost_centers (organization_id, name, is_demo) values (p_org, 'Produção de grãos', true) returning id into cc;

  select id into cat from public.financial_categories where slug = 'sementes' and organization_id is null;
  insert into public.transactions (organization_id, farm_id, season_id, crop_id, cost_center_id, category_id, contact_id, account_id, kind, description, amount, issue_date, due_date, paid_date, status, payment_method, is_demo)
    values (p_org, v_farm, s_soja, c_soja, cc, cat, sup_insumos, acc, 'despesa', 'Sementes de soja — 15 t', 117000, base - 60, base - 30, base - 30, 'pago', 'boleto', true);
  select id into cat from public.financial_categories where slug = 'fertilizantes' and organization_id is null;
  insert into public.transactions (organization_id, farm_id, season_id, crop_id, cost_center_id, category_id, contact_id, account_id, kind, description, amount, issue_date, due_date, paid_date, status, payment_method, installment_number, installment_count, is_demo) values
    (p_org, v_farm, s_soja, c_soja, cc, cat, sup_insumos, acc, 'despesa', 'Fertilizante MAP 70 t — parcela 1/2', 143500, base - 60, base - 15, base - 15, 'pago', 'boleto', 1, 2, true),
    (p_org, v_farm, s_soja, c_soja, cc, cat, sup_insumos, acc, 'despesa', 'Fertilizante MAP 70 t — parcela 2/2', 143500, base - 60, base + 2, null, 'pendente', 'boleto', 2, 2, true);
  select id into cat from public.financial_categories where slug = 'defensivos' and organization_id is null;
  insert into public.transactions (organization_id, farm_id, season_id, crop_id, cost_center_id, category_id, contact_id, account_id, kind, description, amount, issue_date, due_date, status, payment_method, is_demo)
    values (p_org, v_farm, s_soja, c_soja, cc, cat, sup_insumos, acc, 'despesa', 'Herbicida 600 L', 22800, base - 50, base + 10, 'pendente', 'boleto', true);
  select id into cat from public.financial_categories where slug = 'combustivel' and organization_id is null;
  insert into public.transactions (organization_id, farm_id, season_id, cost_center_id, category_id, contact_id, account_id, kind, description, amount, issue_date, due_date, paid_date, status, payment_method, is_demo)
    values (p_org, v_farm, s_soja, cc, cat, sup_posto, acc, 'despesa', 'Diesel S10 — 20.000 L', 121000, base - 55, base - 25, base - 25, 'pago', 'pix', true);
  select id into cat from public.financial_categories where slug = 'mao_de_obra' and organization_id is null;
  insert into public.transactions (organization_id, farm_id, cost_center_id, category_id, account_id, kind, description, amount, issue_date, due_date, paid_date, status, payment_method, is_demo) values
    (p_org, v_farm, cc, cat, acc, 'despesa', 'Folha de pagamento — mês anterior', 38500, base - 35, base - 30, base - 30, 'pago', 'transferencia', true),
    (p_org, v_farm, cc, cat, acc, 'despesa', 'Folha de pagamento — mês atual', 38500, base - 5, base - 1, null, 'pendente', 'transferencia', true);
  select id into cat from public.financial_categories where slug = 'manutencao' and organization_id is null;
  insert into public.transactions (organization_id, farm_id, category_id, account_id, kind, description, amount, issue_date, due_date, paid_date, status, payment_method, is_demo)
    values (p_org, v_farm, cat, acc, 'despesa', 'Manutenção corretiva pulverizador', 5300, base - 100, base - 95, base - 95, 'pago', 'pix', true);
  select id into cat from public.financial_categories where slug = 'venda_graos' and organization_id is null;
  insert into public.transactions (organization_id, farm_id, season_id, crop_id, cost_center_id, category_id, contact_id, account_id, kind, description, amount, quantity, quantity_unit, issue_date, due_date, paid_date, status, payment_method, is_demo) values
    (p_org, v_farm, s_milho, c_milho, cc, cat, cli_trading, acc, 'receita', 'Venda milho safrinha — 12.000 sc', 660000, 12000, 'sc', base - 110, base - 80, base - 80, 'pago', 'transferencia', true),
    (p_org, v_farm, s_milho, c_milho, cc, cat, cli_trading, acc, 'receita', 'Venda milho safrinha — 6.000 sc', 342000, 6000, 'sc', base - 20, base + 15, null, 'pendente', 'transferencia', true);

  -- Cotações demonstrativas (claramente rotuladas; NÃO representam mercado real)
  insert into public.market_quotes (instrument_id, organization_id, value, unit, region, source, observed_at, status, notes, is_demo, created_by)
  select inst, p_org, round((val + (random() * 2 - 1) * val * 0.015)::numeric, 2), unit, 'Praça exemplo (GO)', 'Dados demonstrativos AgroCentral',
         (base - d)::timestamptz + interval '18 hours', 'demonstrativo', 'Valor fictício para demonstração', true, uid
  from (values ('SOJA', 128.0, 'BRL/sc 60 kg'), ('MILHO', 62.0, 'BRL/sc 60 kg')) as v(inst, val, unit)
  cross join generate_series(0, 29) as d;

  -- Regras de alerta de clima para a propriedade demonstrativa
  insert into public.weather_alert_rules (organization_id, farm_id, user_id, kind, threshold, lookahead_days, priority, is_demo) values
    (p_org, v_farm, uid, 'chuva_intensa', 40, 3, 'alta', true),
    (p_org, v_farm, uid, 'vento_forte', 50, 3, 'media', true),
    (p_org, v_farm, uid, 'calor', 36, 5, 'media', true);

  insert into public.user_preferences (user_id, selected_farm_id) values (uid, v_farm)
  on conflict (user_id) do update set selected_farm_id = excluded.selected_farm_id;
  return v_farm;
end $$;
grant execute on function public.seed_demo_data(uuid) to authenticated;

create or replace function public.clear_demo_data(p_org uuid)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.has_role(p_org, array['owner','admin']::public.app_role[]) then
    raise exception 'Somente proprietário/administrador pode remover dados demonstrativos' using errcode = '42501';
  end if;
  delete from public.transactions where organization_id = p_org and is_demo;
  delete from public.market_quotes where organization_id = p_org and is_demo;
  delete from public.weather_alert_rules where organization_id = p_org and is_demo;
  delete from public.tasks where organization_id = p_org and is_demo;
  delete from public.work_logs where organization_id = p_org and is_demo;
  delete from public.equipment_usage where organization_id = p_org and is_demo;
  delete from public.activities where organization_id = p_org and is_demo;
  delete from public.harvest_records where organization_id = p_org and is_demo;
  delete from public.season_fields where organization_id = p_org and is_demo;
  delete from public.seasons where organization_id = p_org and is_demo;
  delete from public.maintenance_records where organization_id = p_org and is_demo;
  delete from public.equipment where organization_id = p_org and is_demo;
  delete from public.stock_movements where organization_id = p_org and is_demo;
  delete from public.stock_lots where organization_id = p_org and is_demo;
  delete from public.inventory_items where organization_id = p_org and is_demo;
  delete from public.inventory_locations where organization_id = p_org and is_demo;
  delete from public.teams where organization_id = p_org and is_demo;
  delete from public.employees where organization_id = p_org and is_demo;
  delete from public.contacts where organization_id = p_org and is_demo;
  delete from public.varieties where organization_id = p_org and is_demo;
  delete from public.financial_accounts where organization_id = p_org and is_demo;
  delete from public.cost_centers where organization_id = p_org and is_demo;
  delete from public.points_of_interest where organization_id = p_org and is_demo;
  delete from public.fields where organization_id = p_org and is_demo;
  delete from public.farms where organization_id = p_org and is_demo;
end $$;
grant execute on function public.clear_demo_data(uuid) to authenticated;
