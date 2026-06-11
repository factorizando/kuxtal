-- Información orientativa de cada artículo (medicamento): para qué está
-- indicado y posibles efectos secundarios. Se puede generar con IA (edge
-- function generate-med-info) o editar a mano. info_generated_at marca cuándo
-- se generó/actualizó por última vez.
alter table inventory_items
  add column if not exists indication   text,
  add column if not exists side_effects text,
  add column if not exists info_generated_at timestamptz;
