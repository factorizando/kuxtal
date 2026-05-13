-- ============================================================
-- Tabla de entradas/salidas presupuestarias por grupo familiar
-- ============================================================
CREATE TABLE IF NOT EXISTS budget_entries (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       bigint        NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  recorded_by    uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contributor_id uuid          REFERENCES profiles(id) ON DELETE SET NULL,
  type           text          NOT NULL CHECK (type IN ('income', 'expense')),
  amount         numeric(10,2) NOT NULL CHECK (amount > 0),
  category       text          NOT NULL,
  note           text,
  receipt_url    text,
  entry_date     date          NOT NULL,
  created_at     timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE budget_entries ENABLE ROW LEVEL SECURITY;

-- Cualquier miembro del grupo puede leer las entradas
CREATE POLICY "members_read_budget" ON budget_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM family_memberships fm
      WHERE fm.group_id = budget_entries.group_id
        AND fm.user_id = auth.uid()
    )
  );

-- Solo admin y caregiver pueden insertar
CREATE POLICY "admin_caregiver_insert_budget" ON budget_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM family_memberships fm
      WHERE fm.group_id = budget_entries.group_id
        AND fm.user_id = auth.uid()
        AND fm.role IN ('admin', 'caregiver')
    )
  );

-- Solo admin y caregiver pueden actualizar (para guardar receipt_url tras subir foto)
CREATE POLICY "admin_caregiver_update_budget" ON budget_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM family_memberships fm
      WHERE fm.group_id = budget_entries.group_id
        AND fm.user_id = auth.uid()
        AND fm.role IN ('admin', 'caregiver')
    )
  );

-- Solo admin y caregiver pueden eliminar
CREATE POLICY "admin_caregiver_delete_budget" ON budget_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM family_memberships fm
      WHERE fm.group_id = budget_entries.group_id
        AND fm.user_id = auth.uid()
        AND fm.role IN ('admin', 'caregiver')
    )
  );

-- ============================================================
-- Bucket de Storage para comprobantes (tickets)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('receipts', 'receipts', true)
  ON CONFLICT (id) DO NOTHING;

-- Lectura pública (bucket público, pero la policy es requerida igualmente)
CREATE POLICY "receipts_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts');

-- Solo usuarios autenticados pueden subir
CREATE POLICY "receipts_authenticated_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'receipts' AND auth.uid() IS NOT NULL);

-- Solo usuarios autenticados pueden eliminar
CREATE POLICY "receipts_authenticated_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'receipts' AND auth.uid() IS NOT NULL);
