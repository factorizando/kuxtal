import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

async function compressImage(file, maxWidth = 1200) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, 1);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82);
    };
    img.src = url;
  });
}

export function useBudget(groupId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!groupId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("budget_entries")
        .select(
          `*, recorder:profiles!recorded_by(full_name), contributor:profiles!contributor_id(full_name)`
        )
        .eq("group_id", groupId)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      setEntries(data || []);
    } catch (e) {
      console.error("useBudget fetch:", e);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`budget_entries:${groupId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "budget_entries",
        filter: `group_id=eq.${groupId}`,
      }, () => fetchEntries())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [groupId, fetchEntries]);

  async function addEntry({
    type,
    amount,
    category,
    contributorId,
    note,
    entryDate,
    file,
    recordedBy,
  }) {
    // contributorId puede ser un UUID de perfil o un valor especial como "bienestar"
    const isProfileContributor = contributorId && contributorId.includes("-");
    const { data, error } = await supabase
      .from("budget_entries")
      .insert({
        group_id: groupId,
        recorded_by: recordedBy,
        contributor_id: type === "income" && isProfileContributor ? contributorId : null,
        contributor_label: type === "income" && !isProfileContributor && contributorId ? contributorId : null,
        type,
        amount: parseFloat(amount),
        category,
        note: note?.trim() || null,
        entry_date: entryDate,
      })
      .select()
      .single();
    if (error) throw error;

    if (file) {
      try {
        const compressed = await compressImage(file);
        const path = `${groupId}/${data.id}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("receipts")
          .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from("receipts")
            .getPublicUrl(path);
          await supabase
            .from("budget_entries")
            .update({ receipt_url: urlData.publicUrl })
            .eq("id", data.id);
        }
      } catch (e) {
        console.error("receipt upload error:", e);
        // El movimiento queda guardado aunque falle la foto
      }
    }

    await fetchEntries();
  }

  async function updateEntry(id, { type, amount, category, contributorId, note, entryDate }) {
    const isProfileContributor = contributorId && contributorId.includes("-");
    const { error } = await supabase
      .from("budget_entries")
      .update({
        contributor_id: type === "income" && isProfileContributor ? contributorId : null,
        contributor_label: type === "income" && !isProfileContributor && contributorId ? contributorId : null,
        type,
        amount: parseFloat(amount),
        category,
        note: note?.trim() || null,
        entry_date: entryDate,
      })
      .eq("id", id);
    if (error) throw error;
    await fetchEntries();
  }

  async function deleteEntry(id) {
    const entry = entries.find((e) => e.id === id);
    const { error } = await supabase
      .from("budget_entries")
      .delete()
      .eq("id", id);
    if (error) throw error;

    if (entry?.receipt_url) {
      const match = entry.receipt_url.split("/receipts/")[1];
      if (match) {
        await supabase.storage
          .from("receipts")
          .remove([decodeURIComponent(match)]);
      }
    }

    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return { entries, loading, addEntry, updateEntry, deleteEntry, refetch: fetchEntries };
}
