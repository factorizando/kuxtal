-- ============================================================
-- KuXtaL — Inventario: RLS por rol + auditoría de ajustes
-- ============================================================

-- Helper: verifica que el usuario es admin o caregiver en el grupo
create or replace function is_group_editor(gid bigint)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from family_memberships
    where group_id = gid
      and user_id = auth.uid()
      and role in ('admin', 'caregiver')
  );
$$;

-- ── Corregir políticas de inventory_items ───────────────────
-- Reemplazamos las políticas de escritura permisivas por
-- otras que exigen rol admin o caregiver.

drop policy if exists "inv_items_insert" on inventory_items;
drop policy if exists "inv_items_update" on inventory_items;
drop policy if exists "inv_items_delete" on inventory_items;

create policy "inv_items_insert" on inventory_items
  for insert with check (is_group_editor(group_id) and auth.uid() = created_by);

create policy "inv_items_update" on inventory_items
  for update using (is_group_editor(group_id));

create policy "inv_items_delete" on inventory_items
  for delete using (is_group_editor(group_id));

-- ── Corregir políticas de inventory_restocks ────────────────

drop policy if exists "inv_restocks_insert" on inventory_restocks;
drop policy if exists "inv_restocks_delete" on inventory_restocks;

create policy "inv_restocks_insert" on inventory_restocks
  for insert with check (is_group_editor(group_id) and auth.uid() = recorded_by);

create policy "inv_restocks_delete" on inventory_restocks
  for delete using (is_group_editor(group_id));

-- ── Historial de ajustes manuales de cantidad ───────────────
-- Los reabastecimientos ya quedan en inventory_restocks.
-- Esta tabla registra los ajustes manuales (correcciones de
-- stock) que no pasan por el flujo de reabastecimiento.

create table if not exists inventory_adjustments (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references inventory_items(id) on delete cascade,
  group_id     bigint not null references family_groups(id) on delete cascade,
  adjusted_by  uuid not null references profiles(id),
  old_quantity numeric(10,3) not null,
  new_quantity numeric(10,3) not null,
  adjusted_at  timestamptz not null default now()
);

create index if not exists idx_inventory_adjustments_item_id
  on inventory_adjustments(item_id);

alter table inventory_adjustments enable row level security;

-- Cualquier miembro puede ver el historial de ajustes
create policy "inv_adjustments_select" on inventory_adjustments
  for select using (is_group_member(group_id));

-- Solo admin/caregiver pueden registrar ajustes
create policy "inv_adjustments_insert" on inventory_adjustments
  for insert with check (is_group_editor(group_id) and auth.uid() = adjusted_by);
