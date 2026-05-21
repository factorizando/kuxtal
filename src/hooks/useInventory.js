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

// Calcula días de stock restantes descontando el consumo desde la última actualización
export function calcDaysRemaining(item) {
  const elapsedDays =
    (Date.now() - new Date(item.quantity_updated_at).getTime()) / 86400000;
  const remaining = Math.max(
    0,
    item.current_quantity - item.consumption_per_day * elapsedDays
  );
  return remaining / item.consumption_per_day;
}

export function useInventory(groupId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!groupId) { setItems([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("group_id", groupId)
        .order("name");
      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      console.error("useInventory:", e);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`inventory:${groupId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "inventory_items",
        filter: `group_id=eq.${groupId}`,
      }, () => fetchItems())
      .on("postgres_changes", {
        event: "*", schema: "public", table: "inventory_restocks",
        filter: `group_id=eq.${groupId}`,
      }, () => fetchItems())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [groupId, fetchItems]);

  async function addItem({ name, unit, consumptionPerDay, currentQuantity, alertThresholdDays, notes, createdBy, unitsPerPack, file }) {
    const { data, error } = await supabase.from("inventory_items").insert({
      group_id: groupId,
      created_by: createdBy,
      name: name.trim(),
      unit: unit.trim(),
      consumption_per_day: consumptionPerDay,
      current_quantity: currentQuantity,
      quantity_updated_at: new Date().toISOString(),
      alert_threshold_days: alertThresholdDays || 14,
      notes: notes?.trim() || null,
      units_per_pack: unitsPerPack || null,
    }).select().single();
    if (error) throw error;
    if (file && data?.id) {
      try {
        const compressed = await compressImage(file);
        const path = `items/${groupId}/${data.id}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("receipts")
          .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
          await supabase.from("inventory_items").update({ image_url: urlData.publicUrl }).eq("id", data.id);
        }
      } catch (e) {
        console.error("item image upload error:", e);
      }
    }
    await fetchItems();
  }

  async function deleteItem(id) {
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) throw error;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function adjustQuantity(itemId, newQuantity, adjustedBy) {
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new Error("Artículo no encontrado");

    const elapsedDays = (Date.now() - new Date(item.quantity_updated_at).getTime()) / 86400000;
    const oldQuantity = Math.max(0, item.current_quantity - item.consumption_per_day * elapsedDays);

    const { error: updateErr } = await supabase
      .from("inventory_items")
      .update({
        current_quantity: newQuantity,
        quantity_updated_at: new Date().toISOString(),
      })
      .eq("id", itemId);
    if (updateErr) throw updateErr;

    // Registrar el ajuste en el historial
    const { error: logErr } = await supabase.from("inventory_adjustments").insert({
      item_id: itemId,
      group_id: groupId,
      adjusted_by: adjustedBy,
      old_quantity: parseFloat(oldQuantity.toFixed(3)),
      new_quantity: newQuantity,
    });
    if (logErr) throw logErr;

    await fetchItems();
  }

  async function fetchAdjustments(itemId) {
    const { data, error } = await supabase
      .from("inventory_adjustments")
      .select("*, profiles(full_name)")
      .eq("item_id", itemId)
      .order("adjusted_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  }

  async function updateItem(id, { name, unit, consumptionPerDay, alertThresholdDays, notes, unitsPerPack, file }) {
    const { error } = await supabase
      .from("inventory_items")
      .update({
        name: name.trim(),
        unit: unit.trim(),
        consumption_per_day: consumptionPerDay,
        alert_threshold_days: alertThresholdDays || 14,
        notes: notes?.trim() || null,
        units_per_pack: unitsPerPack || null,
      })
      .eq("id", id);
    if (error) throw error;
    if (file) {
      try {
        const compressed = await compressImage(file);
        const path = `items/${groupId}/${id}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("receipts")
          .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
          await supabase.from("inventory_items").update({ image_url: urlData.publicUrl }).eq("id", id);
        }
      } catch (e) {
        console.error("item image update error:", e);
      }
    }
    await fetchItems();
  }

  async function restock({ itemId, quantity, price, brand, store, purchasedAt, notes, recordedBy, createBudgetEntry, itemName, file, existingBudgetEntryId }) {
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new Error("Artículo no encontrado");

    // Usar la fecha de compra como referencia para el cálculo, descontando
    // consumo desde esa fecha. Se clampea entre la última actualización y hoy.
    const purchasedAtTs = new Date(purchasedAt + "T12:00:00").getTime();
    const lastUpdateTs = new Date(item.quantity_updated_at).getTime();
    const effectiveTs = Math.max(lastUpdateTs, Math.min(purchasedAtTs, Date.now()));
    const elapsedToEffective = (effectiveTs - lastUpdateTs) / 86400000;
    const stockAtEffective = Math.max(0, item.current_quantity - item.consumption_per_day * elapsedToEffective);
    const newQuantity = stockAtEffective + quantity;
    const newUpdatedAt = new Date(effectiveTs).toISOString();

    // Crear gasto en presupuesto si se solicitó (o usar uno existente)
    let budgetEntryId = existingBudgetEntryId || null;
    if (!budgetEntryId && createBudgetEntry && price > 0) {
      const noteParts = [itemName, brand, store].filter(Boolean);
      const { data: budgetData, error: budgetErr } = await supabase
        .from("budget_entries")
        .insert({
          group_id: groupId,
          recorded_by: recordedBy,
          type: "expense",
          amount: price,
          category: "Medicamentos",
          note: noteParts.join(" · "),
          entry_date: purchasedAt,
        })
        .select()
        .single();
      if (budgetErr) throw budgetErr;
      budgetEntryId = budgetData.id;
    }

    // Registrar el reabastecimiento
    const { data: restockData, error: restockErr } = await supabase.from("inventory_restocks").insert({
      item_id: itemId,
      group_id: groupId,
      recorded_by: recordedBy,
      quantity,
      price: price > 0 ? price : null,
      brand: brand?.trim() || null,
      store: store?.trim() || null,
      purchased_at: purchasedAt,
      budget_entry_id: budgetEntryId,
      notes: notes?.trim() || null,
    }).select().single();
    if (restockErr) throw restockErr;

    // Subir comprobante fotográfico si se proporcionó
    if (file && restockData?.id) {
      try {
        const compressed = await compressImage(file);
        const path = `restocks/${groupId}/${restockData.id}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("receipts")
          .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
          await supabase.from("inventory_restocks").update({ receipt_url: urlData.publicUrl }).eq("id", restockData.id);
        }
      } catch (e) {
        console.error("restock receipt upload error:", e);
      }
    }

    // Actualizar cantidad del artículo
    const { error: updateErr } = await supabase
      .from("inventory_items")
      .update({
        current_quantity: newQuantity,
        quantity_updated_at: newUpdatedAt,
      })
      .eq("id", itemId);
    if (updateErr) throw updateErr;

    await fetchItems();
  }

  async function fetchRestocks(itemId) {
    const { data, error } = await supabase
      .from("inventory_restocks")
      .select("*")
      .eq("item_id", itemId)
      .order("purchased_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  }

  async function getRestockForEntry(budgetEntryId) {
    const { data, error } = await supabase
      .from("inventory_restocks")
      .select("*")
      .eq("budget_entry_id", budgetEntryId)
      .limit(1);
    if (error) throw error;
    return data?.[0] || null;
  }

  async function deleteRestockAndRevertStock(restockId, itemId, restockQuantity) {
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new Error("Artículo no encontrado en el inventario");
    const elapsedDays = (Date.now() - new Date(item.quantity_updated_at).getTime()) / 86400000;
    const estimatedNow = Math.max(0, item.current_quantity - item.consumption_per_day * elapsedDays);
    const newQuantity = Math.max(0, estimatedNow - restockQuantity);
    const { error: itemErr } = await supabase
      .from("inventory_items")
      .update({ current_quantity: parseFloat(newQuantity.toFixed(3)), quantity_updated_at: new Date().toISOString() })
      .eq("id", itemId);
    if (itemErr) throw itemErr;
    const { error: restockErr } = await supabase
      .from("inventory_restocks")
      .delete()
      .eq("id", restockId);
    if (restockErr) throw restockErr;
    await fetchItems();
  }

  async function updateRestockAndAdjustStock(restockId, itemId, oldQuantity, newQuantity, newPrice, newPurchasedAt) {
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new Error("Artículo no encontrado en el inventario");
    const elapsedDays = (Date.now() - new Date(item.quantity_updated_at).getTime()) / 86400000;
    const estimatedNow = Math.max(0, item.current_quantity - item.consumption_per_day * elapsedDays);
    const adjustedQuantity = Math.max(0, estimatedNow + (newQuantity - oldQuantity));
    const { error: itemErr } = await supabase
      .from("inventory_items")
      .update({ current_quantity: parseFloat(adjustedQuantity.toFixed(3)), quantity_updated_at: new Date().toISOString() })
      .eq("id", itemId);
    if (itemErr) throw itemErr;
    const { error: restockErr } = await supabase
      .from("inventory_restocks")
      .update({ quantity: newQuantity, price: newPrice > 0 ? newPrice : null, purchased_at: newPurchasedAt })
      .eq("id", restockId);
    if (restockErr) throw restockErr;
    await fetchItems();
  }

  return { items, loading, addItem, updateItem, deleteItem, adjustQuantity, restock, fetchRestocks, fetchAdjustments, getRestockForEntry, deleteRestockAndRevertStock, updateRestockAndAdjustStock, refetch: fetchItems };
}
