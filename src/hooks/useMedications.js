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
  // fija la nueva tasa. Si la suma es 0 (todo as_needed o suspendido), deja
  // el consumption_per_day como estaba (la columna tiene check > 0).
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
    if (perDay <= 0) return; // no actualizar (check > 0; mantener tasa previa)

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

  // ── Flujo guiado de consulta ──────────────────────────────
  // payload: { consultationDate, doctor, notes,
  //   decisions: [{ scheduleId, itemId, action: 'keep'|'suspend'|'adjust', fields? }],
  //   newSchedules: [scheduleFieldsPayload] }
  async function saveConsultation(payload) {
    const { data: cons, error: consErr } = await supabase
      .from("consultations")
      .insert({
        group_id: groupId,
        created_by: userId,
        consultation_date: payload.consultationDate,
        doctor: payload.doctor?.trim() || null,
        notes: payload.notes?.trim() || null,
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

  return {
    schedules,
    consultations,
    intakes,
    loading,
    addSchedule,
    updateSchedule,
    suspendSchedule,
    markTaken,
    unmarkTaken,
    saveConsultation,
    recalcItemConsumption,
    refetch: fetchAll,
  };
}
