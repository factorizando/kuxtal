-- Agrega soporte para presentaciones (ej. cajas de 7 tabletas)
alter table inventory_items
  add column if not exists units_per_pack int check (units_per_pack > 1);
