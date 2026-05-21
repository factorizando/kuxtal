import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useRequests(groupId, userId) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!groupId) { setRequests([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("budget_requests")
        .select(`
          *,
          requester:profiles!requested_by(full_name),
          resolver:profiles!resolved_by(full_name),
          inventory_item:inventory_items!inventory_item_id(id, name, unit)
        `)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch (e) {
      console.error("useRequests fetch:", e);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`budget_requests:${groupId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "budget_requests",
        filter: `group_id=eq.${groupId}`,
      }, () => fetchRequests())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [groupId, fetchRequests]);

  async function addRequest({ amount, category, note, entryDate, inventoryItemId }) {
    const { data, error } = await supabase
      .from("budget_requests")
      .insert({
        group_id: groupId,
        requested_by: userId,
        amount: parseFloat(amount),
        category,
        note: note?.trim() || null,
        entry_date: entryDate,
        inventory_item_id: inventoryItemId || null,
      })
      .select()
      .single();
    if (error) throw error;
    await fetchRequests();

    notifyAdmins(groupId, userId, parseFloat(amount), category).catch(console.error);

    return data;
  }

  async function approveRequest(requestId, addEntryFn, restockFn, restockQuantity) {
    const req = requests.find((r) => r.id === requestId);
    if (!req) throw new Error("Solicitud no encontrada");

    const entryId = await addEntryFn({
      type: "expense",
      amount: req.amount,
      category: req.category,
      note: req.note,
      entryDate: req.entry_date,
      recordedBy: userId,
    });

    if (req.inventory_item_id && restockFn && restockQuantity) {
      await restockFn({
        itemId: req.inventory_item_id,
        quantity: parseFloat(restockQuantity),
        price: req.amount,
        purchasedAt: req.entry_date,
        recordedBy: userId,
        createBudgetEntry: false,
        existingBudgetEntryId: entryId,
      });
    }

    const { error } = await supabase
      .from("budget_requests")
      .update({ status: "approved", resolved_by: userId, resolved_at: new Date().toISOString() })
      .eq("id", requestId);
    if (error) throw error;
    await fetchRequests();
  }

  async function rejectRequest(requestId, responseNote) {
    const { error } = await supabase
      .from("budget_requests")
      .update({
        status: "rejected",
        response_note: responseNote?.trim() || null,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    if (error) throw error;
    await fetchRequests();
  }

  return { requests, loading, addRequest, approveRequest, rejectRequest };
}

async function notifyAdmins(groupId, requesterId, amount, category) {
  const { data: admins } = await supabase
    .from("family_memberships")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("role", "admin");

  if (!admins?.length) return;

  const adminIds = admins.map((a) => a.user_id).filter((id) => id !== requesterId);
  if (!adminIds.length) return;

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("subscription")
    .in("user_id", adminIds);

  if (!subs?.length) return;

  const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
  const title = "💸 Nueva solicitud de gasto";
  const body = `${fmt} en ${category}`;

  await Promise.all(
    subs.map(({ subscription }) =>
      supabase.functions.invoke("send-push-notification", {
        body: { subscription, title, body },
      })
    )
  );
}
