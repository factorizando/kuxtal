import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications(userId) {
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [subscribed, setSubscribed] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !userId) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setSubscribed(!!sub);
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkSubscription();
  }, [checkSubscription]);

  async function subscribe() {
    if (!userId) return;

    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return;

    const reg = await navigator.serviceWorker.ready;

    // Cancelar suscripción anterior si existe
    const existing = await reg.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    // Crear nueva suscripción
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Convertir a JSON y extraer endpoint explícitamente
    const subJson = sub.toJSON();
    const endpoint = subJson.endpoint;

    console.log("userId:", userId);
    console.log("endpoint:", endpoint);
    console.log("subJson:", subJson);

    // Upsert con conflicto en user_id
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: endpoint,
        subscription: subJson,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("Error:", error);
      return;
    }

    console.log("✅ Suscripción guardada");
    setSubscribed(true);
  }

  async function unsubscribe() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();

    await supabase.from("push_subscriptions").delete().eq("user_id", userId);

    setSubscribed(false);
  }

  return { permission, subscribed, subscribe, unsubscribe };
}
