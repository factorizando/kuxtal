-- Costo opcional de una consulta y su vínculo con el presupuesto.
-- Algunas consultas generan un gasto (consulta privada, copago) y otras no
-- (IMSS, Seguro Popular...). Cuando hay costo se crea un budget_entry de tipo
-- gasto y se enlaza aquí. ON DELETE SET NULL: si se borra el movimiento desde
-- el presupuesto, la consulta conserva el costo pero pierde el vínculo.
alter table consultations
  add column if not exists cost numeric(10,2) check (cost is null or cost >= 0),
  add column if not exists budget_entry_id uuid references budget_entries(id) on delete set null;
