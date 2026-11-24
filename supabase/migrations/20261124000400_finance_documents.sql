-- AgroCentral — Etapa 4: Financeiro e documentos

create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('receita','despesa')),
  slug text,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  created_at timestamptz not null default now()
);
create unique index financial_categories_global_uq on public.financial_categories(slug) where organization_id is null;
alter table public.financial_categories enable row level security;
create policy financial_categories_select on public.financial_categories for select to authenticated
  using (organization_id is null or private.has_perm(organization_id, 'finance', 'view'));
create policy financial_categories_insert on public.financial_categories for insert to authenticated
  with check (organization_id is not null and private.has_perm(organization_id, 'finance', 'create'));
create policy financial_categories_delete on public.financial_categories for delete to authenticated
  using (organization_id is not null and private.has_perm(organization_id, 'finance', 'delete'));

insert into public.financial_categories (kind, slug, name) values
  ('receita','venda_graos','Venda de grãos'),
  ('receita','venda_cafe','Venda de café'),
  ('receita','venda_animais','Venda de animais'),
  ('receita','prestacao_servicos','Prestação de serviços'),
  ('receita','arrendamento_recebido','Arrendamento recebido'),
  ('receita','outras_receitas','Outras receitas'),
  ('despesa','sementes','Sementes'),
  ('despesa','fertilizantes','Fertilizantes'),
  ('despesa','defensivos','Defensivos'),
  ('despesa','combustivel','Combustível'),
  ('despesa','mao_de_obra','Funcionários / mão de obra'),
  ('despesa','manutencao','Manutenção'),
  ('despesa','energia','Energia'),
  ('despesa','arrendamento','Arrendamento'),
  ('despesa','transporte','Transporte / frete'),
  ('despesa','servicos_terceiros','Serviços terceirizados'),
  ('despesa','financiamento','Financiamento / juros'),
  ('despesa','impostos','Impostos e taxas'),
  ('despesa','despesas_diversas','Despesas diversas');

create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  notes text,
  is_demo boolean not null default false,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
select private.apply_std_policies('cost_centers', 'finance', false);

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  kind text not null default 'conta_corrente' check (kind in ('caixa','conta_corrente','poupanca','cartao','investimento','outro')),
  bank text,
  initial_balance numeric(14,2) not null default 0,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
select private.apply_std_policies('financial_accounts', 'finance', false);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  season_id uuid,
  field_id uuid,
  crop_id uuid references public.crops(id) on delete set null,
  cost_center_id uuid,
  category_id uuid not null references public.financial_categories(id) on delete restrict,
  contact_id uuid,
  account_id uuid,
  activity_id uuid,
  kind text not null check (kind in ('receita','despesa')),
  description text not null check (char_length(btrim(description)) between 2 and 240),
  amount numeric(14,2) not null check (amount > 0),
  quantity numeric(14,3) check (quantity > 0),
  quantity_unit text check (quantity_unit in ('sc','kg','t','@','L','un','ha','h')),
  issue_date date not null default current_date,
  due_date date not null,
  paid_date date,
  status text not null default 'pendente' check (status in ('pendente','pago','cancelado')),
  payment_method text check (payment_method in ('dinheiro','pix','boleto','transferencia','cartao','cheque','permuta','outro')),
  document_number text,
  installment_number int check (installment_number >= 1),
  installment_count int check (installment_count >= 1),
  installment_group uuid,
  notes text,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (status <> 'pago' or paid_date is not null),
  check (installment_number is null or installment_count is null or installment_number <= installment_count),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete restrict,
  foreign key (organization_id, season_id) references public.seasons(organization_id, id) on delete set null (season_id),
  foreign key (organization_id, field_id) references public.fields(organization_id, id) on delete set null (field_id),
  foreign key (organization_id, cost_center_id) references public.cost_centers(organization_id, id) on delete set null (cost_center_id),
  foreign key (organization_id, contact_id) references public.contacts(organization_id, id) on delete set null (contact_id),
  foreign key (organization_id, account_id) references public.financial_accounts(organization_id, id) on delete set null (account_id),
  foreign key (organization_id, activity_id) references public.activities(organization_id, id) on delete set null (activity_id)
);
create index transactions_org_due_idx on public.transactions(organization_id, due_date);
create index transactions_farm_idx on public.transactions(farm_id);
create index transactions_season_idx on public.transactions(season_id);
select private.apply_std_policies('transactions', 'finance', true);
create trigger transactions_audit after insert or update or delete on public.transactions for each row execute function private.audit_row();
create trigger transactions_links before insert or update on public.transactions for each row execute function private.check_farm_links();

create or replace function private.check_transaction_category()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  ck text; corg uuid;
begin
  select kind, organization_id into ck, corg from public.financial_categories where id = new.category_id;
  if ck is distinct from new.kind then
    raise exception 'Categoria incompatível com o tipo de lançamento' using errcode = '23514';
  end if;
  if corg is not null and corg <> new.organization_id then
    raise exception 'Categoria de outra organização' using errcode = '42501';
  end if;
  if new.status <> 'pago' then new.paid_date := null; end if;
  return new;
end $$;
create trigger transactions_category before insert or update on public.transactions for each row execute function private.check_transaction_category();

-- Visão com situação calculada (vencido/a vencer) — respeita RLS do chamador
create view public.transactions_v with (security_invoker = true) as
select t.*,
  case
    when t.status = 'pago' then 'pago'
    when t.status = 'cancelado' then 'cancelado'
    when t.due_date < current_date then 'vencido'
    when t.due_date <= current_date + 7 then 'vence_em_breve'
    else 'em_aberto'
  end as situation,
  c.name as category_name
from public.transactions t
join public.financial_categories c on c.id = t.category_id;

-- ---------------------------------------------------------------------------
-- Documentos (arquivos privados no Storage, metadados aqui)
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid,
  field_id uuid,
  season_id uuid,
  equipment_id uuid,
  transaction_id uuid,
  activity_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  doc_type text not null default 'outro' check (doc_type in ('contrato','nota_fiscal','car','ccir','itr','documento_maquina','laudo','analise_solo','receita_agronomica','comprovante','foto','relatorio','outro')),
  tags text[] not null default '{}',
  issue_date date,
  expires_at date,
  responsible text,
  notes text,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path like organization_id::text || '/%'),
  foreign key (organization_id, farm_id) references public.farms(organization_id, id) on delete set null (farm_id),
  foreign key (organization_id, field_id) references public.fields(organization_id, id) on delete set null (field_id),
  foreign key (organization_id, season_id) references public.seasons(organization_id, id) on delete set null (season_id),
  foreign key (organization_id, equipment_id) references public.equipment(organization_id, id) on delete set null (equipment_id),
  foreign key (organization_id, transaction_id) references public.transactions(organization_id, id) on delete set null (transaction_id),
  foreign key (organization_id, activity_id) references public.activities(organization_id, id) on delete set null (activity_id)
);
create index documents_org_idx on public.documents(organization_id, doc_type);
create index documents_expires_idx on public.documents(expires_at) where expires_at is not null;
select private.apply_std_policies('documents', 'documents', true);

-- Buckets: documentos privados (20 MB) e mídia de anúncios pública (5 MB, imagens)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('documents', 'documents', false, 20971520, array[
    'application/pdf','image/jpeg','image/png','image/webp','image/heic',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword','application/vnd.ms-excel','text/csv','text/plain',
    'application/vnd.google-earth.kml+xml','application/vnd.google-earth.kmz','application/geo+json','application/json','application/zip']),
  ('listing-media', 'listing-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create or replace function private.storage_org(p_name text)
returns uuid language plpgsql immutable
set search_path = ''
as $$
begin
  return (string_to_array(p_name, '/'))[1]::uuid;
exception when others then
  return null;
end $$;

create policy documents_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and private.has_perm(private.storage_org(name), 'documents', 'view'));
create policy documents_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and private.has_perm(private.storage_org(name), 'documents', 'create'));
create policy documents_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and private.has_perm(private.storage_org(name), 'documents', 'delete'));

-- Mídia de anúncios: pasta = id do usuário
create policy listing_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy listing_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'listing-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
