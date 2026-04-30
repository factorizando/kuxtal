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
    fetchAll();
  }, [fetchAll]);

  async function addGlucose({ value, context, note }) {
    const { data, error } = await supabase
      .from("glucose_readings")
      .insert({
        user_id: dataUserId, // datos del paciente
        recorded_by: userId, // quien los registra
        value,
        context,
        note,
      })
      .select()
      .single();
    if (error) throw error;
    setGluReadings((prev) => [data, ...prev]);
  }

  async function addBP({ systolic, diastolic, pulse, arm, note }) {
    const { data, error } = await supabase
      .from("bp_readings")
      .insert({
        user_id: dataUserId,
        recorded_by: userId,
        systolic,
        diastolic,
        pulse,
        arm,
        note,
      })
      .select()
      .single();
    if (error) throw error;
    setBpReadings((prev) => [data, ...prev]);
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
    const { error } = await supabase.from("bp_readings").delete().eq("id", id);
    if (error) throw error;
    setBpReadings((prev) => prev.filter((r) => r.id !== id));
  }
  return {
    gluReadings,
    bpReadings,
    loading,
    addGlucose,
    addBP,
    deleteGlucose,
    deleteBP,
    refetch: fetchAll,
  };
}
