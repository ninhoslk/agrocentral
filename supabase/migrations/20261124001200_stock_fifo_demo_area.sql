-- AgroCentral — Saídas sem lote informado consomem lotes por validade (FIFO/FEFO) para manter
-- o saldo dos lotes coerente com o saldo do item; área declarada da fazenda demonstrativa
-- alinhada ao polígono ilustrativo.

create or replace function private.apply_stock_movement()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  it record;
  delta numeric;
  new_qty numeric;
  lot record;
  remaining numeric;
  take numeric;
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
  elsif delta < 0 then
    -- Sem lote informado: consome primeiro os lotes que vencem antes (FEFO)
    remaining := -delta;
    for lot in select * from public.stock_lots where item_id = new.item_id and quantity > 0
               order by expires_at nulls last, created_at for update loop
      exit when remaining <= 0;
      take := least(lot.quantity, remaining);
      update public.stock_lots set quantity = quantity - take where id = lot.id;
      remaining := remaining - take;
    end loop;
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

-- Lotes nunca podem somar mais que o saldo do item (corrige dados já existentes)
do $$
declare
  it record; lot record; excess numeric; take numeric;
begin
  for it in select i.id, i.current_quantity, coalesce(sum(l.quantity), 0) as lots_total
            from public.inventory_items i left join public.stock_lots l on l.item_id = i.id
            group by i.id having coalesce(sum(l.quantity), 0) > i.current_quantity loop
    excess := it.lots_total - it.current_quantity;
    for lot in select * from public.stock_lots where item_id = it.id and quantity > 0 order by expires_at nulls last, created_at loop
      exit when excess <= 0;
      take := least(lot.quantity, excess);
      update public.stock_lots set quantity = quantity - take where id = lot.id;
      excess := excess - take;
    end loop;
  end loop;
end $$;

-- Dados demonstrativos: área declarada coerente com o polígono ilustrativo (~1.500 ha)
do $$
declare d text;
begin
  d := pg_get_functiondef('public.seed_demo_data(uuid)'::regprocedure);
  d := replace(d, '''FBE'', ''Rio Verde'', ''GO'', 1250, 980, 70, 250', '''FBE'', ''Rio Verde'', ''GO'', 1500, 1150, 80, 300');
  execute d;
end $$;
update public.farms set total_area_ha = 1500, productive_area_ha = 1150, preservation_area_ha = 80, legal_reserve_ha = 300
where is_demo and code = 'FBE';
