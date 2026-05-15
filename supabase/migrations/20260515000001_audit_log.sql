create table if not exists audit_log (
  id           uuid primary key default gen_random_uuid(),
  group_id     bigint not null references family_groups(id) on delete cascade,
  entity_type  text not null,
  entity_id    text not null,
  action       text not null check (action in ('edit', 'delete')),
  changed_by   uuid not null references profiles(id),
  before       jsonb,
  after        jsonb,
  occurred_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_group_id    on audit_log(group_id);
create index if not exists idx_audit_log_occurred_at on audit_log(occurred_at desc);

alter table audit_log enable row level security;

create policy "audit_log_select" on audit_log
  for select using (is_group_member(group_id));

create policy "audit_log_insert" on audit_log
  for insert with check (is_group_member(group_id) and auth.uid() = changed_by);
