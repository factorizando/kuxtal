-- Permite a los usuarios actualizar sus propios registros de glucosa.
-- También permite a administradores de familia actualizar registros de pacientes del grupo.

create policy "users can update own glucose readings"
  on glucose_readings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "family admins can update glucose readings of group members"
  on glucose_readings for update
  using (
    exists (
      select 1
      from family_memberships fm_admin
      join family_memberships fm_patient on fm_admin.group_id = fm_patient.group_id
      where fm_admin.user_id = auth.uid()
        and fm_admin.role = 'admin'
        and fm_patient.user_id = glucose_readings.user_id
    )
  )
  with check (true);

create policy "users can update own bp readings"
  on bp_readings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "family admins can update bp readings of group members"
  on bp_readings for update
  using (
    exists (
      select 1
      from family_memberships fm_admin
      join family_memberships fm_patient on fm_admin.group_id = fm_patient.group_id
      where fm_admin.user_id = auth.uid()
        and fm_admin.role = 'admin'
        and fm_patient.user_id = bp_readings.user_id
    )
  )
  with check (true);
