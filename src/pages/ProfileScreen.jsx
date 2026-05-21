import { useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useSwipe } from "../hooks/useSwipe";

const G = "#059669",
  tx = "#111827",
  mu = "#6B7280",
  bd = "#E5E7EB",
  bg = "#F4F2ED",
  wh = "#FFFFFF",
  hd = "#111827";
const card = (e = {}) => ({
  background: wh,
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
  marginBottom: 12,
  ...e,
});
const lbl10 = (e = {}) => ({
  fontSize: 10,
  color: mu,
  textTransform: "uppercase",
  letterSpacing: 1.5,
  marginBottom: 8,
  display: "block",
  ...e,
});

function RangeInput({ label, value, min, max, unit, onChange, color }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: tx, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: color || G }}>
          {value} {unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ width: "100%", accentColor: color || G, cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: mu, marginTop: 2 }}>
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  );
}

export default function ProfileScreen({ onClose, signOut }) {
  const { user, profile, updateProfile, uploadAvatar } = useAuth();
  const { permission, subscribed, subscribe, unsubscribe } = usePushNotifications(user?.id);
  const swipeHandlers = useSwipe({ onSwipeRight: onClose });

  const [name, setName] = useState(profile?.full_name || "");
  const [ranges, setRanges] = useState({
    glucose_hypo: profile?.glucose_hypo || 70,
    glucose_target_high: profile?.glucose_target_high || 180,
    glucose_high: profile?.glucose_high || 250,
  });
  const [editingRanges, setEditingRanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  if (!user)
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6B7280", fontFamily: "system-ui" }}>
        Cargando perfil...
      </div>
    );

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ full_name: name.trim(), ...ranges });
      setEditingRanges(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("La imagen no debe superar 2MB");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadAvatar(file);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  const avatarUrl = profile?.avatar_url;
  const initials = (profile?.full_name || user?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div {...swipeHandlers} style={{ background: bg, minHeight: "100dvh", fontFamily: "system-ui,-apple-system,sans-serif" }}>

      {/* Header */}
      <div style={{ background: hd, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#6B7280", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>KuXtaL</div>
          <div style={{ color: wh, fontSize: 16, fontWeight: 600, marginTop: 2 }}>Mi perfil</div>
        </div>
        <button onClick={onClose} style={{ background: "#1F2937", border: "none", borderRadius: 20, padding: "5px 14px", color: "#9CA3AF", fontSize: 12, cursor: "pointer" }}>
          ← Volver
        </button>
      </div>

      <div style={{ padding: "14px 14px 28px" }}>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#991B1B" }}>
            ❌ {error}
          </div>
        )}

        {/* Avatar */}
        <div style={card({ textAlign: "center", padding: 28 })}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: 90, height: 90, borderRadius: "50%", margin: "0 auto 16px",
              background: avatarUrl ? "transparent" : `${G}22`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, fontWeight: 700, color: G, cursor: "pointer",
              position: "relative", overflow: "hidden", border: `3px solid ${G}44`,
            }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
              : initials
            }
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.45)", padding: "4px 0", fontSize: 10, color: wh, fontWeight: 500 }}>
              {uploading ? "..." : "✏️"}
            </div>
          </div>

          <div style={{ fontSize: 15, fontWeight: 700, color: tx }}>{profile?.full_name || "Sin nombre"}</div>
          <div style={{ fontSize: 12, color: mu, marginTop: 4 }}>{user?.email}</div>

          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{ display: "none" }}/>

          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ marginTop: 14, padding: "7px 20px", background: "transparent", border: `1.5px solid ${bd}`, borderRadius: 20, fontSize: 12, color: tx, cursor: "pointer", fontWeight: 500 }}>
            {uploading ? "Subiendo..." : "Cambiar foto"}
          </button>
        </div>

        {/* Datos personales */}
        <div style={card()}>
          <div style={{ fontSize: 14, fontWeight: 600, color: tx, marginBottom: 16 }}>Datos personales</div>
          <span style={lbl10()}>Nombre completo</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre completo"
            style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${bd}`, borderRadius: 10, fontSize: 14, color: tx, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 4 }}
          />
        </div>

        {/* Rangos de glucosa */}
        <div style={card()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: tx }}>Rangos de glucosa</div>
            {!editingRanges && (
              <button
                onClick={() => setEditingRanges(true)}
                style={{ padding: "5px 14px", border: `1.5px solid ${bd}`, borderRadius: 8, background: wh, fontSize: 13, fontWeight: 600, color: tx, cursor: "pointer" }}
              >
                Editar
              </button>
            )}
          </div>
          <div style={{ fontSize: 12, color: mu, marginBottom: 16 }}>
            Se guardan en tu perfil y se aplican en todos tus dispositivos
          </div>

          {!editingRanges ? (
            <div>
              {[
                ["Hipoglucemia — umbral inferior", ranges.glucose_hypo, "#DC2626"],
                ["Rango objetivo — límite superior", ranges.glucose_target_high, G],
                ["Alerta de glucosa elevada", ranges.glucose_high, "#DC2626"],
              ].map(([label, value, color], i, arr) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${bd}` : "none" }}>
                  <span style={{ fontSize: 13, color: tx }}>{label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color }}>{value} mg/dL</span>
                </div>
              ))}
            </div>
          ) : (
            <>
              <RangeInput
                label="Hipoglucemia — umbral inferior"
                value={ranges.glucose_hypo} min={50} max={90} unit="mg/dL" color="#DC2626"
                onChange={(v) => setRanges((r) => ({ ...r, glucose_hypo: v }))}
              />
              <RangeInput
                label="Rango objetivo — límite superior"
                value={ranges.glucose_target_high} min={120} max={240} unit="mg/dL" color={G}
                onChange={(v) => setRanges((r) => ({ ...r, glucose_target_high: v, glucose_high: Math.max(v + 20, r.glucose_high) }))}
              />
              <RangeInput
                label="Alerta de glucosa elevada"
                value={ranges.glucose_high} min={ranges.glucose_target_high + 20} max={400} unit="mg/dL" color="#DC2626"
                onChange={(v) => setRanges((r) => ({ ...r, glucose_high: v }))}
              />

              {/* Barra de vista previa */}
              <div>
                <span style={lbl10()}>Vista previa</span>
                <div style={{ height: 20, borderRadius: 10, overflow: "hidden", display: "flex" }}>
                  <div style={{ width: `${((ranges.glucose_hypo - 40) / 360) * 100}%`, background: "#FEE2E2" }}/>
                  <div style={{ width: `${((ranges.glucose_target_high - ranges.glucose_hypo) / 360) * 100}%`, background: "#D1FAE5" }}/>
                  <div style={{ width: `${((ranges.glucose_high - ranges.glucose_target_high) / 360) * 100}%`, background: "#FEF3C7" }}/>
                  <div style={{ flex: 1, background: "#FEE2E2" }}/>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                  {[["#DC2626","Hipo"],[G,"En rango"],["#D97706","Elevada"],["#DC2626","Muy elevada"]].map(([c, l]) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: c }}/>
                      <span style={{ fontSize: 10, color: mu }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => { setRanges({ glucose_hypo: profile?.glucose_hypo || 70, glucose_target_high: profile?.glucose_target_high || 180, glucose_high: profile?.glucose_high || 250 }); setEditingRanges(false); }}
                style={{ marginTop: 14, width: "100%", padding: "10px 0", border: `1.5px solid ${bd}`, borderRadius: 10, background: wh, fontSize: 14, fontWeight: 600, color: mu, cursor: "pointer" }}
              >
                Cancelar
              </button>
            </>
          )}
        </div>

        {/* Notificaciones push */}
        <div style={card()}>
          <div style={{ fontSize: 14, fontWeight: 600, color: tx, marginBottom: 4 }}>Notificaciones</div>
          <div style={{ fontSize: 12, color: mu, marginBottom: 16 }}>
            Recibe alertas en este dispositivo cuando los valores sean críticos
          </div>

          {permission === "denied" ? (
            <div style={{ fontSize: 13, color: "#DC2626", lineHeight: 1.5 }}>
              ❌ Notificaciones bloqueadas en este navegador. Ve a la configuración del sitio para activarlas.
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, color: tx, fontWeight: 500 }}>
                    {subscribed ? "🔔 Activadas en este dispositivo" : "🔕 Desactivadas"}
                  </div>
                  <div style={{ fontSize: 11, color: mu, marginTop: 2 }}>
                    {subscribed
                      ? "Recibirás alertas de valores críticos"
                      : "No recibirás alertas en este dispositivo"}
                  </div>
                </div>
                {/* Toggle switch */}
                <div
                  onClick={subscribed ? unsubscribe : subscribe}
                  style={{
                    width: 48, height: 26, borderRadius: 13, cursor: "pointer",
                    background: subscribed ? G : "#D1D5DB",
                    position: "relative", transition: "background .2s", flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3,
                    left: subscribed ? 25 : 3,
                    width: 20, height: 20, borderRadius: "50%",
                    background: wh, transition: "left .2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}/>
                </div>
              </div>

              {/* Alertas configuradas */}
              <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: mu, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                  Alertas configuradas
                </div>
                {[
                  ["🚨", "Hipoglucemia", `< ${ranges.glucose_hypo} mg/dL`],
                  ["⚠️", "Glucosa muy elevada", `> ${ranges.glucose_high} mg/dL`],
                  ["🚨", "Crisis hipertensiva", "≥ 180/120 mmHg"],
                  ["⚠️", "HTA Etapa 2", "≥ 140/90 mmHg"],
                ].map(([icon, label, range]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                    <span style={{ fontSize: 14 }}>{icon}</span>
                    <span style={{ fontSize: 12, color: tx, flex: 1 }}>{label}</span>
                    <span style={{ fontSize: 11, color: mu }}>{range}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSave} disabled={saving}
          style={{ width: "100%", padding: 14, background: saved ? G : hd, color: wh, border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", transition: "background .3s", marginBottom: 12 }}>
          {saved ? "✓ Guardado" : saving ? "Guardando..." : "Guardar cambios"}
        </button>

        <button
          onClick={signOut}
          style={{ width: "100%", padding: 14, background: "transparent", color: "#EF4444", border: "1.5px solid #FCA5A5", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>
          Cerrar sesión
        </button>

      </div>
    </div>
  );
}
