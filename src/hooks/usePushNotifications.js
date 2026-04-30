async function subscribe() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Tu navegador no soporta notificaciones push");
    return;
  }

  // Verificar que userId existe antes de continuar
  if (!userId) {
    console.error("No hay userId disponible");
    return;
  }

  const perm = await Notification.requestPermission();
  setPermission(perm);
  if (perm !== "granted") return;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const subJson = sub.toJSON();
  console.log("Guardando suscripción para userId:", userId);
  console.log("Suscripción:", subJson);

  // Primero borrar la suscripción anterior si existe
  await supabase.from("push_subscriptions").delete().eq("user_id", userId);

  // Luego insertar la nueva
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: userId,
    endpoint: sub.endpoint,
    subscription: subJson,
  });

  if (error) {
    console.error("Error guardando suscripción:", error);
    return;
  }

  if (error) {
    console.error("Error guardando suscripción:", error);
    return;
  }

  setSubscribed(true);
}
