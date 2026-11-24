-- AgroCentral — Etapa 6: Marketplace (anúncios, mídia, favoritos, conversas, propostas, denúncias)
-- O marketplace aproxima as partes: a AgroCentral não intermedia pagamento, entrega ou garantia.

create table public.marketplace_categories (
  id text primary key,
  name text not null,
  parent_id text references public.marketplace_categories(id) on delete cascade,
  sort int not null default 100,
  restricted_note text
);
alter table public.marketplace_categories enable row level security;
create policy marketplace_categories_read on public.marketplace_categories for select to anon, authenticated using (true);

insert into public.marketplace_categories (id, name, parent_id, sort, restricted_note) values
  ('maquinas','Máquinas e equipamentos',null,1,null),
  ('tratores','Tratores','maquinas',1,null),
  ('colheitadeiras','Colheitadeiras','maquinas',2,null),
  ('pulverizadores','Pulverizadores','maquinas',3,null),
  ('plantadeiras','Plantadeiras','maquinas',4,null),
  ('implementos','Implementos agrícolas','maquinas',5,null),
  ('maquinas_diversas','Máquinas diversas','maquinas',6,null),
  ('veiculos','Caminhões e veículos utilitários',null,2,null),
  ('pecas','Peças e componentes',null,3,null),
  ('insumos','Insumos',null,4,'Defensivos e sementes exigem registro e devem respeitar a legislação vigente (receituário agronômico, registro MAPA). Anúncios irregulares serão removidos.'),
  ('graos','Grãos e produção agrícola',null,5,null),
  ('animais','Animais e produtos pecuários',null,6,'Exige documentação sanitária (GTA) conforme legislação.'),
  ('imoveis','Terras, sítios, fazendas e arrendamentos',null,7,null),
  ('servicos','Serviços agrícolas',null,8,null),
  ('logistica','Armazenagem, frete e logística',null,9,null);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  category_id text not null references public.marketplace_categories(id),
  title text not null check (char_length(btrim(title)) between 5 and 120),
  description text not null check (char_length(btrim(description)) between 10 and 5000),
  price numeric(14,2) check (price > 0),
  currency text not null default 'BRL' check (currency in ('BRL','USD')),
  price_unit text,
  negotiable boolean not null default true,
  condition text not null default 'nao_aplica' check (condition in ('novo','seminovo','usado','recondicionado','nao_aplica')),
  quantity numeric(14,3) check (quantity > 0),
  unit text,
  state char(2) not null check (state ~ '^[A-Z]{2}$'),
  city text not null check (char_length(btrim(city)) between 2 and 120),
  brand text, model text,
  year int check (year between 1900 and 2100),
  hours_used numeric(12,1) check (hours_used >= 0),
  attributes jsonb not null default '{}',
  seller_name text not null check (char_length(btrim(seller_name)) between 2 and 120),
  show_phone boolean not null default false,
  contact_phone text,
  status text not null default 'rascunho' check (status in ('rascunho','publicado','pausado','vendido','expirado','removido')),
  moderation_status text not null default 'ok' check (moderation_status in ('ok','em_analise','removido')),
  moderation_note text,
  published_at timestamptz,
  expires_at timestamptz,
  is_demo boolean not null default false,
  search_vector tsvector generated always as (
    setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(brand, '') || ' ' || coalesce(model, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index listings_search_idx on public.listings using gin (search_vector);
create index listings_public_idx on public.listings(status, moderation_status, published_at desc);
create index listings_category_idx on public.listings(category_id);
create index listings_seller_idx on public.listings(seller_id);
alter table public.listings enable row level security;
create policy listings_public_read on public.listings for select to anon, authenticated
  using ((status in ('publicado','vendido') and moderation_status = 'ok' and (expires_at is null or expires_at > now()))
         or seller_id = (select auth.uid()) or private.is_platform_admin());
create policy listings_insert on public.listings for insert to authenticated
  with check (seller_id = (select auth.uid()) and status in ('rascunho','publicado'));
create policy listings_update on public.listings for update to authenticated
  using (seller_id = (select auth.uid()) or private.is_platform_admin())
  with check (seller_id = (select auth.uid()) or private.is_platform_admin());
create policy listings_delete on public.listings for delete to authenticated
  using (seller_id = (select auth.uid()) and status = 'rascunho');

create or replace function private.listing_rules()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  recent int;
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
    if not private.is_platform_admin() then
      -- Moderação só pode ser alterada pela plataforma
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
create trigger listings_rules before insert or update on public.listings for each row execute function private.listing_rules();

create table public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  seller_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path text not null unique,
  position int not null default 0,
  created_at timestamptz not null default now(),
  check (storage_path like seller_id::text || '/%')
);
create index listing_media_listing_idx on public.listing_media(listing_id, position);
alter table public.listing_media enable row level security;
create policy listing_media_read on public.listing_media for select to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));
create policy listing_media_insert on public.listing_media for insert to authenticated
  with check (seller_id = (select auth.uid()) and exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid())));
create policy listing_media_delete on public.listing_media for delete to authenticated
  using (seller_id = (select auth.uid()));
create policy listing_media_update on public.listing_media for update to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
revoke update on public.listing_media from authenticated;
grant update (position) on public.listing_media to authenticated;

create or replace function private.listing_media_limit()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.listing_media where listing_id = new.listing_id) >= 10 then
    raise exception 'Máximo de 10 fotos por anúncio' using errcode = '54000';
  end if;
  return new;
end $$;
create trigger listing_media_limit before insert on public.listing_media for each row execute function private.listing_media_limit();

create table public.listing_favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
alter table public.listing_favorites enable row level security;
create policy listing_favorites_self on public.listing_favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  buyer_name text,
  status text not null default 'aberta' check (status in ('aberta','encerrada')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);
create index conversations_buyer_idx on public.conversations(buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations(seller_id, last_message_at desc);
alter table public.conversations enable row level security;
create policy conversations_participants on public.conversations for select to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));
create policy conversations_insert on public.conversations for insert to authenticated
  with check (buyer_id = (select auth.uid()));
create policy conversations_update on public.conversations for update to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()))
  with check (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));
revoke update on public.conversations from authenticated;
grant update (status) on public.conversations to authenticated;

create or replace function private.conversation_rules()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  l record;
begin
  select * into l from public.listings where id = new.listing_id;
  if not found or l.status <> 'publicado' or l.moderation_status <> 'ok' then
    raise exception 'Anúncio indisponível para contato' using errcode = '23514';
  end if;
  if l.seller_id = new.buyer_id then
    raise exception 'Você não pode iniciar conversa no próprio anúncio' using errcode = '23514';
  end if;
  new.seller_id := l.seller_id;
  select coalesce(full_name, 'Usuário') into new.buyer_name from public.profiles where id = new.buyer_id;
  return new;
end $$;
create trigger conversations_rules before insert on public.conversations for each row execute function private.conversation_rules();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'mensagem' check (kind in ('mensagem','proposta')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  offer_amount numeric(14,2) check (offer_amount > 0),
  offer_status text check (offer_status in ('pendente','aceita','recusada','retirada')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'proposta' or (offer_amount is not null and offer_status is not null))
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);
alter table public.messages enable row level security;
create policy messages_participants on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and exists (
    select 1 from public.conversations c where c.id = conversation_id and c.status = 'aberta'
      and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))));
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;
create policy messages_mark_read on public.messages for update to authenticated
  using (sender_id <> (select auth.uid()) and exists (select 1 from public.conversations c where c.id = conversation_id and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))))
  with check (sender_id <> (select auth.uid()));

create or replace function private.message_rules()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  c record; recent int; recipient uuid; ltitle text;
begin
  select count(*) into recent from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if recent >= 20 then
    raise exception 'Muitas mensagens em pouco tempo. Aguarde um instante.' using errcode = '54000';
  end if;
  new.created_at := now();
  new.read_at := null;
  if new.kind = 'proposta' then new.offer_status := 'pendente'; else new.offer_amount := null; new.offer_status := null; end if;
  select * into c from public.conversations where id = new.conversation_id;
  update public.conversations set last_message_at = now() where id = c.id;
  recipient := case when new.sender_id = c.buyer_id then c.seller_id else c.buyer_id end;
  select title into ltitle from public.listings where id = c.listing_id;
  perform private.notify(recipient, null, 'marketplace', case when new.kind = 'proposta' then 'alta' else 'media' end,
    case when new.kind = 'proposta' then 'Nova proposta: ' || ltitle else 'Nova mensagem: ' || ltitle end,
    left(new.body, 160), '/marketplace/mensagens/' || c.id, 'msg:' || new.id, 'marketplace');
  return new;
end $$;
create trigger messages_rules before insert on public.messages for each row execute function private.message_rules();

-- Responder proposta (somente o destinatário aceita/recusa; o autor pode retirar)
create or replace function public.respond_offer(p_message uuid, p_action text)
returns void language plpgsql security definer
set search_path = ''
as $$
declare
  m record; c record;
begin
  select * into m from public.messages where id = p_message for update;
  if not found or m.kind <> 'proposta' then raise exception 'Proposta não encontrada' using errcode = 'P0002'; end if;
  select * into c from public.conversations where id = m.conversation_id;
  if auth.uid() not in (c.buyer_id, c.seller_id) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if m.offer_status <> 'pendente' then raise exception 'Esta proposta já foi respondida' using errcode = '23514'; end if;
  if p_action in ('aceita','recusada') and m.sender_id = auth.uid() then
    raise exception 'Somente o destinatário pode aceitar ou recusar' using errcode = '42501';
  end if;
  if p_action = 'retirada' and m.sender_id <> auth.uid() then
    raise exception 'Somente o autor pode retirar a proposta' using errcode = '42501';
  end if;
  if p_action not in ('aceita','recusada','retirada') then raise exception 'Ação inválida' using errcode = '22023'; end if;
  update public.messages set offer_status = p_action where id = p_message;
  perform private.notify(case when auth.uid() = c.buyer_id then c.seller_id else c.buyer_id end, null, 'marketplace', 'alta',
    'Proposta ' || p_action, 'Sua proposta de R$ ' || m.offer_amount || ' foi ' || p_action || '.',
    '/marketplace/mensagens/' || c.id, 'offer:' || p_message || ':' || p_action, 'marketplace');
end $$;
grant execute on function public.respond_offer(uuid, text) to authenticated;

create table public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text not null check (reason in ('fraude','spam','produto_proibido','duplicado','informacao_falsa','ofensivo','outro')),
  details text check (char_length(details) <= 1000),
  status text not null default 'aberta' check (status in ('aberta','procedente','improcedente')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (listing_id, reporter_id)
);
alter table public.listing_reports enable row level security;
create policy listing_reports_insert on public.listing_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy listing_reports_read on public.listing_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or private.is_platform_admin());
create policy listing_reports_moderate on public.listing_reports for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- 3 denúncias abertas colocam o anúncio em análise automaticamente
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
    update public.listings set moderation_status = 'em_analise', moderation_note = 'Em análise após denúncias' where id = l.id;
    perform private.notify(l.seller_id, null, 'marketplace', 'alta', 'Anúncio em análise',
      'Seu anúncio "' || l.title || '" recebeu denúncias e está temporariamente oculto até revisão.', '/marketplace/meus-anuncios',
      'mod:' || l.id || ':' || current_date, 'moderação');
  end if;
  return null;
end $$;
create trigger listing_reports_rules after insert on public.listing_reports for each row execute function private.report_rules();

-- Moderação (somente administradores da plataforma)
create or replace function public.moderate_listing(p_listing uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if p_decision not in ('ok','removido') then raise exception 'Decisão inválida' using errcode = '22023'; end if;
  update public.listings set moderation_status = p_decision, moderation_note = p_note where id = p_listing;
  update public.listing_reports set status = case when p_decision = 'removido' then 'procedente' else 'improcedente' end,
    reviewed_by = auth.uid(), reviewed_at = now()
  where listing_id = p_listing and status = 'aberta';
end $$;
grant execute on function public.moderate_listing(uuid, text, text) to authenticated;

-- Política de leitura de mídia pública depende do bucket público; contadores para dashboard
create or replace function public.marketplace_counters()
returns table (unread_messages bigint, favorites bigint, my_active_listings bigint)
language sql stable security invoker
set search_path = ''
as $$
  select
    (select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id
      where (c.buyer_id = auth.uid() or c.seller_id = auth.uid()) and m.sender_id <> auth.uid() and m.read_at is null),
    (select count(*) from public.listing_favorites f where f.user_id = auth.uid()),
    (select count(*) from public.listings l where l.seller_id = auth.uid() and l.status = 'publicado');
$$;
grant execute on function public.marketplace_counters() to authenticated;
