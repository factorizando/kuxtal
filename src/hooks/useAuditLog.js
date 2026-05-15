import { useState, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useAuditLog(groupId, userId) {
  const [logEntries, setLogEntries] = useState([]);
  const [logLoading, setLogLoading] = useState(false);

  const fetchLog = useCallback(async () => {
    if (!groupId) { setLogEntries([]); return; }
    setLogLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*, changer:profiles!changed_by(full_name)")
        .eq("group_id", groupId)
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setLogEntries(data || []);
    } catch (e) {
      console.error("useAuditLog:", e);
    } finally {
      setLogLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`audit_log:${groupId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "audit_log",
        filter: `group_id=eq.${groupId}`,
      }, () => fetchLog())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [groupId, fetchLog]);

  async function logAction({ entityType, entityId, action, before, after }) {
    if (!groupId || !userId) return;
    try {
      await supabase.from("audit_log").insert({
        group_id: groupId,
        entity_type: entityType,
        entity_id: String(entityId),
        action,
        changed_by: userId,
        before: before ?? null,
        after: after ?? null,
      });
    } catch (e) {
      console.error("logAction:", e);
    }
  }

  return { logEntries, logLoading, logAction, fetchLog };
}
