import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useReadings(userId) {
  const [gluReadings, setGluReadings] = useState([]);
  const [bpReadings, setBpReadings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const [{ data: glu }, { data: bp }] = await Promise.all([
      supabase
        .from("glucose_readings")
        .select("*")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(50),
      supabase
        .from("bp_readings")
        .select("*")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(50),
    ]);

    setGluReadings(glu || []);
    setBpReadings(bp || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function addGlucose({ value, context, note }) {
    const { data, error } = await supabase
      .from("glucose_readings")
      .insert({ user_id: userId, recorded_by: userId, value, context, note })
      .select()
      .single();
    if (error) throw error;
    setGluReadings((prev) => [data, ...prev]);
  }

  async function addBP({ systolic, diastolic, pulse, arm, note }) {
    const { data, error } = await supabase
      .from("bp_readings")
      .insert({
        user_id: userId,
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

  return {
    gluReadings,
    bpReadings,
    loading,
    addGlucose,
    addBP,
    refetch: fetchAll,
  };
}
