-- ============================================================
-- KuXtaL — Medicamentos con horario + consultas médicas
-- ============================================================
-- Reutiliza inventory_items (un medicamento = un inventory_item) y
-- los grupos/roles familiares. Añade:
--   consultations        — visitas médicas mensuales
--   medication_schedules — pautas (dosis, frecuencia, horarios)
--   medication_intakes   — registro de adherencia (tomas marcadas)
-- Las pautas derivan el consumption_per_day del item; el stock se
-- descuenta de forma continua con el modelo de inventario existente.

-- Consultas médicas (group-scoped, igual que el inventario)
create table if not exists consultations (
  id                uuid primary key default gen_random_uuid(),
  group_id          bigint not null references family_groups(id) on delete cascade,
  created_by        uuid not null references profiles(id),
  consultation_date date not null default current_date,
  doctor            text,
  notes             text,
  created_at        timestamptz not null default now()
);

-- Pautas de medicación: dosis + frecuencia + horarios para un item
create table if not exists medication_schedules (
  id              uuid primary key default gen_random_uuid(),
  group_id        bigint not null references family_groups(id) on delete cascade,
  item_id         uuid not null references inventory_items(id) on delete cascade,
  consultation_id uuid references consultations(id) on delete set null,
  created_by      uuid not null references profiles(id),
  dose            numeric(10,3) not null check (dose > 0),
  frequency_type  text not null check (frequency_type in ('daily', 'every_n_days', 'days_of_week', 'as_needed')),
  interval_days   int check (interval_days > 0),
  days_of_week    smallint[],
  times           text[] not null default '{}',
  start_date      date not null default current_date,
  end_date        date,
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now()
);

-- Registro de tomas (adherencia). No modifica el stock: el descuento
-- se hace de forma continua vía consumption_per_day del item.
create table if not exists medication_intakes (
  id             uuid primary key default gen_random_uuid(),
  group_id       bigint not null references family_groups(id) on delete cascade,
  schedule_id    uuid not null references medication_schedules(id) on delete cascade,
  item_id        uuid not null references inventory_items(id) on delete cascade,
  scheduled_date date not null,
  scheduled_time text,
  dose           numeric(10,3) not null,
  taken_by       uuid not null references profiles(id),
  taken_at       timestamptz not null default now(),
  note           text,
  created_at     timestamptz not null default now(),
  unique (schedule_id, scheduled_date, scheduled_time)
);

-- Índices
create index if not exists idx_consultations_group_id         on consultations(group_id);
create index if not exists idx_med_schedules_group_id          on medication_schedules(group_id);
create index if not exists idx_med_schedules_item_id           on medication_schedules(item_id);
create index if not exists idx_med_intakes_group_id            on medication_intakes(group_id);
create index if not exists idx_med_intakes_item_id             on medication_intakes(item_id);
create index if not exists idx_med_intakes_schedule_date       on medication_intakes(schedule_id, scheduled_date);

-- ── Row Level Security ──────────────────────────────────────
-- Helpers is_group_member / is_group_editor ya existen (inventario).

alter table consultations         enable row level security;
alter table medication_schedules  enable row level security;
alter table medication_intakes    enable row level security;

-- Consultas: lectura miembros; escritura admin/caregiver
create policy "consultations_select" on consultations
  for select using (is_group_member(group_id));
create policy "consultations_insert" on consultations
  for insert with check (is_group_editor(group_id) and auth.uid() = created_by);
create policy "consultations_update" on consultations
  for update using (is_group_editor(group_id));
create policy "consultations_delete" on consultations
  for delete using (is_group_editor(group_id));

-- Pautas: lectura miembros; escritura admin/caregiver
create policy "med_schedules_select" on medication_schedules
  for select using (is_group_member(group_id));
create policy "med_schedules_insert" on medication_schedules
  for insert with check (is_group_editor(group_id) and auth.uid() = created_by);
create policy "med_schedules_update" on medication_schedules
  for update using (is_group_editor(group_id));
create policy "med_schedules_delete" on medication_schedules
  for delete using (is_group_editor(group_id));

-- Tomas: cualquier miembro puede marcar su propia toma y deshacerla
create policy "med_intakes_select" on medication_intakes
  for select using (is_group_member(group_id));
create policy "med_intakes_insert" on medication_intakes
  for insert with check (is_group_member(group_id) and auth.uid() = taken_by);
create policy "med_intakes_delete" on medication_intakes
  for delete using (is_group_member(group_id));
