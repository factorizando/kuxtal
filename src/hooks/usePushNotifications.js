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

  // Borrar registro anterior
  await supabase.from("push_subscriptions").delete().eq("user_id", userId);

  // Insertar nuevo
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: userId,
    endpoint: endpoint,
    subscription: subJson,
  });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("✅ Suscripción guardada");
  setSubscribed(true);
}
