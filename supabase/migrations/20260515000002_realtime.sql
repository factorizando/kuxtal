-- Agrega las tablas a la publicación de Supabase Realtime
-- El bloque DO evita errores si ya estuvieran agregadas
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'budget_entries'
  ) then
    alter publication supabase_realtime add table budget_entries;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'inventory_items'
  ) then
    alter publication supabase_realtime add table inventory_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'inventory_restocks'
  ) then
    alter publication supabase_realtime add table inventory_restocks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'audit_log'
  ) then
    alter publication supabase_realtime add table audit_log;
  end if;
end $$;
