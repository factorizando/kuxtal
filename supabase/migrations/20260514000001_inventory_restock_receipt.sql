-- Agrega columna de comprobante fotográfico a reabastecimientos de inventario
alter table inventory_restocks add column if not exists receipt_url text;
