import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useReadings(userId, targetUserId = null) {
  const [gluReadings, setGluReadings] = useState([]);
  const [bpReadings, setBpReadings] = useState([]);
  const [loading, setLoading] = useState(true);

  // El ID real de quien son los datos
  const dataUserId = targetUserId || userId;

  const fetchAll = useCallback(async () => {
    if (!dataUserId) return;
    setLoading(true);
    try {
      const [{ data: glu }, { data: bp }] = await Promise.all([
        supabase
          .from("glucose_readings")
          .select("*")
          .eq("user_id", dataUserId)
          .order("recorded_at", { ascending: false })
          .limit(50),
        supabase
          .from("bp_readings")
          .select("*")
          .eq("user_id", dataUserId)
          .order("recorded_at", { ascending: false })
          .limit(50),
      ]);
      setGluReadings(glu || []);
      setBpReadings(bp || []);
    } catch (e) {
      console.error("fetchAll error:", e);
    } finally {
      setLoading(false);
    }
  }, [dataUserId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [fetchAll]);

  // Enviar notificación push si el valor es crítico
  async function sendAlertIfCritical({ type, value, systolic, diastolic }) {
    let title = null, body = null;

    if (type === "glucose") {
      if (value < 70)
        { title = "🚨 Hipoglucemia"; body = `Glucosa: ${value} mg/dL — requiere atención inmediata` }
      else if (value > 250)
        { title = "⚠️ Glucosa muy elevada"; body = `Glucosa: ${value} mg/dL — consulta a tu médico` }
    }

    if (type === "bp") {
      if (systolic >= 180 || diastolic >= 120)
        { title = "🚨 Crisis hipertensiva"; body = `Presión: ${systolic}/${diastolic} mmHg — busca atención médica` }
      else if (systolic >= 140 || diastolic >= 90)
        { title = "⚠️ Presión muy elevada"; body = `Presión: ${systolic}/${diastolic} mmHg (HTA Etapa 2)` }
    }

    if (!title) return;

    // Obtener todos los grupos del paciente
    const { data: patientGroups } = await supabase
      .from("family_memberships")
      .select("group_id")
      .eq("user_id", dataUserId);

    const groupIds = (patientGroups || []).map((g) => g.group_id);

    // Reunir IDs de todos los miembros de esos grupos
    let memberIds = [dataUserId];
    if (groupIds.length > 0) {
      const { data: groupMembers } = await supabase
        .from("family_memberships")
        .select("user_id")
        .in("group_id", groupIds);
      memberIds = [...new Set((groupMembers || []).map((m) => m.user_id))];
    }

    // Obtener suscripciones de TODOS los integrantes del grupo
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .in("user_id", memberIds);

    if (!subs?.length) return;

    // Enviar notificación a cada dispositivo suscrito
    await Promise.all(
      subs.map(({ subscription }) =>
        supabase.functions.invoke("send-push-notification", {
          body: { subscription, title, body },
        })
      )
    );
  }

  async function addGlucose({ value, context, note, recorded_at }) {
    const row = { user_id: dataUserId, recorded_by: userId, value, context, note };
    if (recorded_at) row.recorded_at = recorded_at;
    const { data, error } = await supabase
      .from("glucose_readings")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    setGluReadings((prev) => {
      const next = [data, ...prev];
      return next.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
    });
    sendAlertIfCritical({ type: "glucose", value }).catch(console.error);
  }

  async function addBP({ systolic, diastolic, pulse, arm, note, recorded_at }) {
    const row = { user_id: dataUserId, recorded_by: userId, systolic, diastolic, pulse, arm, note };
    if (recorded_at) row.recorded_at = recorded_at;
    const { data, error } = await supabase
      .from("bp_readings")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    setBpReadings((prev) => {
      const next = [data, ...prev];
      return next.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
    });
    sendAlertIfCritical({ type: "bp", systolic, diastolic }).catch(console.error);
  }

  async function updateGlucose(id, fields) {
    const { data, error } = await supabase
      .from("glucose_readings")
      .update(fields)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setGluReadings((prev) => {
      const next = prev.map((r) => (r.id === id ? data : r));
      return next.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
    });
  }

  async function updateBP(id, fields) {
    const { data, error } = await supabase
      .from("bp_readings")
      .update(fields)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    setBpReadings((prev) => {
      const next = prev.map((r) => (r.id === id ? data : r));
      return next.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
    });
  }

  async function deleteGlucose(id) {
    const { error } = await supabase
      .from("glucose_readings")
      .delete()
      .eq("id", id);
    if (error) throw error;
    setGluReadings((prev) => prev.filter((r) => r.id !== id));
  }

  async function deleteBP(id) {
    const { error } = await supabase
      .from("bp_readings")
      .delete()
      .eq("id", id);
    if (error) throw error;
    setBpReadings((prev) => prev.filter((r) => r.id !== id));
  }

  return {
    gluReadings,
    bpReadings,
    loading,
    addGlucose,
    addBP,
    updateGlucose,
    updateBP,
    deleteGlucose,
    deleteBP,
    refetch: fetchAll,
  };
}
