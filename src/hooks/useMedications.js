import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { dailyDose } from "../utils/medications";

// Devuelve la fecha local de hoy como "YYYY-MM-DD" (no usar toISOString).
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useMedications(groupId, userId) {
  const [schedules, setSchedules] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [intakes, setIntakes] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!groupId) {
      setSchedules([]);
      setConsultations([]);
      setIntakes([]);
      return;
    }
    setLoading(true);
    try {
      const today = todayStr();
      const [schRes, consRes, intRes] = await Promise.all([
        supabase
          .from("medication_schedules")
          .select("*, inventory_item:inventory_items(id, name, unit, image_url)")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false }),
        supabase
          .from("consultations")
          .select("*, creator:profiles!created_by(full_name)")
          .eq("group_id", groupId)
          .order("consultation_date", { ascending: false }),
        supabase
          .from("medication_intakes")
          .select("*, taker:profiles!taken_by(full_name)")
          .eq("group_id", groupId)
          .eq("scheduled_date", today),
      ]);
      if (schRes.error) throw schRes.error;
      if (consRes.error) throw consRes.error;
      if (intRes.error) throw intRes.error;
      setSchedules(schRes.data || []);
      setConsultations(consRes.data || []);
      setIntakes(intRes.data || []);
    } catch (e) {
      console.error("useMedications:", e);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`medications:${groupId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "medication_schedules",
        filter: `group_id=eq.${groupId}`,
      }, () => fetchAll())
      .on("postgres_changes", {
        event: "*", schema: "public", table: "consultations",
        filter: `group_id=eq.${groupId}`,
      }, () => fetchAll())
      .on("postgres_changes", {
        event: "*", schema: "public", table: "medication_intakes",
        filter: `group_id=eq.${groupId}`,
      }, () => fetchAll())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [groupId, fetchAll]);

  // ── Stock: deriva consumption_per_day del item desde sus pautas activas ──
  // Re-ancla el item (descuenta lo consumido a la tasa vieja hasta ahora) y
  // fija la nueva tasa. Si la suma es 0 (todo as_needed o suspendido), solo
  // desactiva el item (la columna consumption_per_day tiene check > 0).
  const recalcItemConsumption = useCallback(async (itemId) => {
    const today = todayStr();
    const { data: schs, error: schErr } = await supabase
      .from("medication_schedules")
      .select("*")
      .eq("item_id", itemId)
      .eq("active", true);
    if (schErr) throw schErr;

    const vigentes = (schs || []).filter(
      (s) =>
        s.start_date <= today && (!s.end_date || s.end_date >= today)
    );
    const perDay = vigentes.reduce((sum, s) => sum + dailyDose(s), 0);
    if (perDay <= 0) {
      // Sin pautas vigentes → desactivar item (no tocar consumption_per_day)
      await supabase
        .from("inventory_items")
        .update({ active: false })
        .eq("id", itemId);
      return;
    }

    const { data: item, error: itemErr } = await supabase
      .from("inventory_items")
      .select("current_quantity, consumption_per_day, quantity_updated_at")
      .eq("id", itemId)
      .single();
    if (itemErr) throw itemErr;

    const elapsedDays =
      (Date.now() - new Date(item.quantity_updated_at).getTime()) / 86400000;
    const reanchored = Math.max(
      0,
      item.current_quantity - item.consumption_per_day * elapsedDays
    );

    const { error: updErr } = await supabase
      .from("inventory_items")
      .update({
        current_quantity: parseFloat(reanchored.toFixed(3)),
        consumption_per_day: parseFloat(perDay.toFixed(3)),
        quantity_updated_at: new Date().toISOString(),
        active: true,
      })
      .eq("id", itemId);
    if (updErr) throw updErr;
  }, []);

  // Campos comunes de una pauta a partir del payload del formulario
  function scheduleFields(p) {
    return {
      group_id: groupId,
      item_id: p.itemId,
      created_by: userId,
      dose: parseFloat(p.dose),
      frequency_type: p.frequencyType,
      interval_days: p.frequencyType === "every_n_days" ? parseInt(p.intervalDays, 10) || 1 : null,
      days_of_week: p.frequencyType === "days_of_week" ? (p.daysOfWeek || []) : null,
      times: p.frequencyType === "as_needed" ? [] : (p.times || []),
      start_date: p.startDate,
      end_date: p.endDate || null,
      notes: p.notes?.trim() || null,
    };
  }

  async function addSchedule(p) {
    const { error } = await supabase
      .from("medication_schedules")
      .insert({ ...scheduleFields(p), consultation_id: p.consultationId || null });
    if (error) throw error;
    await recalcItemConsumption(p.itemId);
    await fetchAll();
  }

  async function updateSchedule(id, p) {
    const { error } = await supabase
      .from("medication_schedules")
      .update(scheduleFields(p))
      .eq("id", id);
    if (error) throw error;
    await recalcItemConsumption(p.itemId);
    await fetchAll();
  }

  async function suspendSchedule(schedule, endDate) {
    const { error } = await supabase
      .from("medication_schedules")
      .update({ active: false, end_date: endDate || todayStr() })
      .eq("id", schedule.id);
    if (error) throw error;
    await recalcItemConsumption(schedule.item_id);
    await fetchAll();
  }

  // Borra una pauta por completo (las tomas ligadas caen en cascada).
  async function deleteSchedule(schedule) {
    const { error } = await supabase
      .from("medication_schedules")
      .delete()
      .eq("id", schedule.id);
    if (error) throw error;
    await recalcItemConsumption(schedule.item_id);
    await fetchAll();
  }

  async function markTaken({ scheduleId, itemId, date, time, dose, note }) {
    const { error } = await supabase.from("medication_intakes").insert({
      group_id: groupId,
      schedule_id: scheduleId,
      item_id: itemId,
      scheduled_date: date,
      scheduled_time: time ?? null,
      dose: parseFloat(dose),
      taken_by: userId,
      note: note?.trim() || null,
    });
    if (error) throw error;
    await fetchAll();
  }

  async function unmarkTaken(intakeId) {
    const { error } = await supabase
      .from("medication_intakes")
      .delete()
      .eq("id", intakeId);
    if (error) throw error;
    setIntakes((prev) => prev.filter((i) => i.id !== intakeId));
  }

  // ── Costo de consulta ↔ presupuesto ───────────────────────
  // Normaliza el costo: devuelve un número > 0 o null (sin costo).
  function parseConsultCost(raw) {
    if (raw == null || raw === "") return null;
    const n = parseFloat(raw);
    return isNaN(n) || n <= 0 ? null : n;
  }

  function consultBudgetNote(doctor) {
    const d = doctor?.trim();
    return d ? `Consulta · ${d}` : "Consulta médica";
  }

  // Crea el movimiento de gasto de una consulta y devuelve su id.
  async function createConsultBudgetEntry(cost, doctor, date) {
    const { data, error } = await supabase
      .from("budget_entries")
      .insert({
        group_id: groupId,
        recorded_by: userId,
        type: "expense",
        amount: cost,
        category: "Consulta médica",
        note: consultBudgetNote(doctor),
        entry_date: date,
      })
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }

  // ── Flujo guiado de consulta ──────────────────────────────
  // payload: { consultationDate, doctor, notes, cost,
  //   decisions: [{ scheduleId, itemId, action: 'keep'|'suspend'|'adjust', fields? }],
  //   newSchedules: [scheduleFieldsPayload] }
  async function saveConsultation(payload) {
    // Si la consulta tiene costo, se registra como gasto en el presupuesto y se
    // enlaza a la consulta para poder mantenerlo sincronizado.
    const cost = parseConsultCost(payload.cost);
    let budgetEntryId = null;
    if (cost) {
      budgetEntryId = await createConsultBudgetEntry(cost, payload.doctor, payload.consultationDate);
    }

    const { data: cons, error: consErr } = await supabase
      .from("consultations")
      .insert({
        group_id: groupId,
        created_by: userId,
        consultation_date: payload.consultationDate,
        doctor: payload.doctor?.trim() || null,
        notes: payload.notes?.trim() || null,
        cost: cost,
        budget_entry_id: budgetEntryId,
      })
      .select()
      .single();
    if (consErr) throw consErr;

    const affectedItems = new Set();

    for (const d of payload.decisions || []) {
      if (d.action === "suspend") {
        const { error } = await supabase
          .from("medication_schedules")
          .update({ active: false, end_date: payload.consultationDate })
          .eq("id", d.scheduleId);
        if (error) throw error;
        affectedItems.add(d.itemId);
      } else if (d.action === "adjust") {
        // Cierra la pauta vieja e inserta una nueva ligada a la consulta
        const { error: closeErr } = await supabase
          .from("medication_schedules")
          .update({ active: false, end_date: payload.consultationDate })
          .eq("id", d.scheduleId);
        if (closeErr) throw closeErr;
        const { error: insErr } = await supabase
          .from("medication_schedules")
          .insert({
            ...scheduleFields({ ...d.fields, startDate: payload.consultationDate }),
            consultation_id: cons.id,
          });
        if (insErr) throw insErr;
        affectedItems.add(d.itemId);
      }
    }

    for (const ns of payload.newSchedules || []) {
      const { error } = await supabase
        .from("medication_schedules")
        .insert({
          ...scheduleFields({ ...ns, startDate: ns.startDate || payload.consultationDate }),
          consultation_id: cons.id,
        });
      if (error) throw error;
      affectedItems.add(ns.itemId);
    }

    for (const itemId of affectedItems) {
      await recalcItemConsumption(itemId);
    }
    await fetchAll();
    return cons;
  }

  // Edita los datos de cabecera de una consulta (fecha, médico, notas, costo).
  // El movimiento de presupuesto vinculado se crea, actualiza o borra según el
  // costo nuevo.
  async function updateConsultation(id, { consultationDate, doctor, notes, cost }) {
    const newCost = parseConsultCost(cost);

    // Recuperar el vínculo actual con el presupuesto.
    const { data: current, error: curErr } = await supabase
      .from("consultations")
      .select("budget_entry_id")
      .eq("id", id)
      .single();
    if (curErr) throw curErr;

    let budgetEntryId = current?.budget_entry_id || null;
    if (newCost) {
      if (budgetEntryId) {
        const { error: upErr } = await supabase
          .from("budget_entries")
          .update({
            amount: newCost,
            note: consultBudgetNote(doctor),
            entry_date: consultationDate,
          })
          .eq("id", budgetEntryId);
        if (upErr) throw upErr;
      } else {
        budgetEntryId = await createConsultBudgetEntry(newCost, doctor, consultationDate);
      }
    } else if (budgetEntryId) {
      // Ya no tiene costo: borrar el gasto vinculado.
      const { error: delErr } = await supabase
        .from("budget_entries")
        .delete()
        .eq("id", budgetEntryId);
      if (delErr) throw delErr;
      budgetEntryId = null;
    }

    const { error } = await supabase
      .from("consultations")
      .update({
        consultation_date: consultationDate,
        doctor: doctor?.trim() || null,
        notes: notes?.trim() || null,
        cost: newCost,
        budget_entry_id: budgetEntryId,
      })
      .eq("id", id);
    if (error) throw error;
    await fetchAll();
  }

  // Borra una consulta. Las pautas ligadas conservan su vigencia: el FK
  // consultation_id es ON DELETE SET NULL, así que solo pierden el vínculo.
  // Si la consulta generó un gasto, también se borra ese movimiento.
  async function deleteConsultation(id) {
    const { data: current } = await supabase
      .from("consultations")
      .select("budget_entry_id")
      .eq("id", id)
      .single();
    const { error } = await supabase
      .from("consultations")
      .delete()
      .eq("id", id);
    if (error) throw error;
    if (current?.budget_entry_id) {
      const { error: delErr } = await supabase
        .from("budget_entries")
        .delete()
        .eq("id", current.budget_entry_id);
      if (delErr) throw delErr;
    }
    await fetchAll();
  }

  return {
    schedules,
    consultations,
    intakes,
    loading,
    addSchedule,
    updateSchedule,
    suspendSchedule,
    deleteSchedule,
    markTaken,
    unmarkTaken,
    saveConsultation,
    updateConsultation,
    deleteConsultation,
    recalcItemConsumption,
    refetch: fetchAll,
  };
}
