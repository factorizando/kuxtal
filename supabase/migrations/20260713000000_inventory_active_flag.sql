-- Flag active en inventory_items para distinguir artículos con pautas activas
-- de los que ya no se consumen. Default true para no romper items existentes.

alter table inventory_items
  add column if not exists active boolean not null default true;
