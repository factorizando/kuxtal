-- ============================================================
-- KuXtaL — Inventario de medicamentos y suministros
-- ============================================================

-- Artículos del inventario
create table if not exists inventory_items (
  id                   uuid primary key default gen_random_uuid(),
  group_id             bigint not null references family_groups(id) on delete cascade,
  created_by           uuid not null references profiles(id),
  name                 text not null,
  unit                 text not null,
  consumption_per_day  numeric(10,3) not null check (consumption_per_day > 0),
  current_quantity     numeric(10,3) not null default 0 check (current_quantity >= 0),
  quantity_updated_at  timestamptz not null default now(),
  alert_threshold_days int not null default 14 check (alert_threshold_days > 0),
  notes                text,
  created_at           timestamptz not null default now()
);

-- Historial de reabastecimientos
create table if not exists inventory_restocks (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references inventory_items(id) on delete cascade,
  group_id        bigint not null references family_groups(id) on delete cascade,
  recorded_by     uuid not null references profiles(id),
  quantity        numeric(10,3) not null check (quantity > 0),
  price           numeric(10,2) check (price >= 0),
  brand           text,
  store           text,
  purchased_at    date not null default current_date,
  budget_entry_id uuid references budget_entries(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

-- Índices
create index if not exists idx_inventory_items_group_id    on inventory_items(group_id);
create index if not exists idx_inventory_restocks_item_id  on inventory_restocks(item_id);
create index if not exists idx_inventory_restocks_group_id on inventory_restocks(group_id);

-- ── Row Level Security ──────────────────────────────────────

alter table inventory_items    enable row level security;
alter table inventory_restocks enable row level security;

-- Helper: verifica membresía en el grupo (create or replace para idempotencia)
create or replace function is_group_member(gid bigint)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from family_memberships
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- Políticas inventory_items
create policy "inv_items_select" on inventory_items
  for select using (is_group_member(group_id));

create policy "inv_items_insert" on inventory_items
  for insert with check (is_group_member(group_id) and auth.uid() = created_by);

create policy "inv_items_update" on inventory_items
  for update using (is_group_member(group_id));

create policy "inv_items_delete" on inventory_items
  for delete using (is_group_member(group_id));

-- Políticas inventory_restocks
create policy "inv_restocks_select" on inventory_restocks
  for select using (is_group_member(group_id));

create policy "inv_restocks_insert" on inventory_restocks
  for insert with check (is_group_member(group_id) and auth.uid() = recorded_by);

create policy "inv_restocks_delete" on inventory_restocks
  for delete using (is_group_member(group_id));
