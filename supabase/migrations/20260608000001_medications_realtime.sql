-- Agrega las tablas de medicamentos a la publicación de Supabase Realtime
-- El bloque DO evita errores si ya estuvieran agregadas
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'consultations'
  ) then
    alter publication supabase_realtime add table consultations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'medication_schedules'
  ) then
    alter publication supabase_realtime add table medication_schedules;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'medication_intakes'
  ) then
    alter publication supabase_realtime add table medication_intakes;
  end if;
end $$;
