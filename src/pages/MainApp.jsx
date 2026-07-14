import { useState, useMemo } from "react";
import { useSwipe } from "../hooks/useSwipe";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useReadings } from "../hooks/useReadings";
import {
  getGluStatus,
  getBPStatus,
  getGluAlerts,
  getBPAlerts,
} from "../utils/analysis";

const CONTEXTS = [
  "En ayunas",
  "Antes de comer",
  "Después de comer",
  "Antes de dormir",
  "Ejercicio",
  "Otro",
];
const ARMS = ["Brazo izquierdo", "Brazo derecho"];

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
  ...e,
});

function nowLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Parses "YYYY-MM-DDTHH:MM" as local time (safe cross-browser: multi-arg constructor always uses local time)
function parseLocalDT(str) {
  if (!str) return new Date(NaN);
  const [datePart, timePart = "00:00"] = str.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi);
}

function fmt(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((nowDay - dDay) / 86400000);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const time = `${h % 12 || 12}:${m} ${h < 12 ? "am" : "pm"}`;
  if (diff === 0) return `Hoy · ${time}`;
  if (diff === 1) return `Ayer · ${time}`;
  const days = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} · ${time}`;
}

function Chip({ val, cur, set }) {
  return (
    <button
      onClick={() => set(val)}
      style={{
        padding: "7px 12px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 500,
        border: `1.5px solid ${cur === val ? G : bd}`,
        background: cur === val ? "#ECFDF5" : "#F9FAFB",
        color: cur === val ? G : mu,
        cursor: "pointer",
      }}
    >
      {val}
    </button>
  );
}

function SubTabs({ value, onChange, tabs }) {
  return (
    <div
      style={{
        display: "flex",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 14,
        border: `1px solid ${bd}`,
        background: wh,
      }}
    >
      {tabs.map(([id, lbl]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          style={{
            flex: 1,
            padding: "10px 0",
            fontSize: 13,
            fontWeight: value === id ? 600 : 400,
            color: value === id ? wh : mu,
            background: value === id ? G : "transparent",
            border: "none",
            cursor: "pointer",
            transition: "all .2s",
          }}
        >
          {lbl}
        </button>
      ))}
    </div>
  );
}

function BPGauge({ sys, dia }) {
  const st = getBPStatus(sys, dia);
  return (
    <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
      {[G, "#D97706", "#EA580C", "#DC2626", "#7C3AED"].map((c, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 5,
            borderRadius: 2,
            background: i <= st.grade ? c : bd,
            transition: "background .3s",
          }}
        />
      ))}
    </div>
  );
}

function RangeInput({ label, value, min, max, unit, onChange, color }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 13, color: tx, fontWeight: 500 }}>
          {label}
        </span>
        <span style={{ fontSize: 18, fontWeight: 700, color: color || G }}>
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ width: "100%", accentColor: color || G, cursor: "pointer" }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: mu,
          marginTop: 2,
        }}
      >
        <span>
          {min} {unit}
        </span>
        <span>
          {max} {unit}
        </span>
      </div>
    </div>
  );
}

const SUB_TABS = ["inicio", "registrar", "historial", "config"];

function SavedScreen() {
  return (
    <div style={{ ...card(), textAlign: "center", padding: "52px 0" }}>
      <div style={{ fontSize: 56, marginBottom: 14 }}>✅</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: G }}>¡Guardado!</div>
      <div style={{ fontSize: 13, color: mu, marginTop: 6 }}>
        Regresando al inicio...
      </div>
    </div>
  );
}

export default function MainApp({
  user,
  profile,
  signOut,
  targetUserId,
  viewingPatient,
  onSelectPatient,
  patients,
  onOpenProfile,
  myRoleInGroup,
  onSwipeScreen,
}) {
  const {
    gluReadings,
    bpReadings,
    loading,
    addGlucose,
    addBP,
    updateGlucose,
    updateBP,
    deleteGlucose,
    deleteBP,
  } = useReadings(user.id, targetUserId || null);

  // Si hay un paciente seleccionado y el usuario no es caregiver/admin,
  // solo puede observar (no registrar)
  const isViewer =
    !!viewingPatient && !["admin", "caregiver"].includes(myRoleInGroup);
  const canDelete = myRoleInGroup === "admin" || !myRoleInGroup;
  const [showPersonSelector, setShowPersonSelector] = useState(false);
  const [tab, setTab] = useState("inicio");

  const swipeHandlers = useSwipe({
    onSwipeLeft(startY) {
      if (startY < window.innerHeight * 0.65) {
        // Zona superior → navegar sub-tabs hacia la derecha
        setTab((t) => {
          const i = SUB_TABS.indexOf(t);
          return SUB_TABS[Math.min(i + 1, SUB_TABS.length - 1)];
        });
      } else {
        // Zona inferior → navegar pantalla principal hacia la derecha
        onSwipeScreen?.("left");
      }
    },
    onSwipeRight(startY) {
      if (startY < window.innerHeight * 0.65) {
        // Zona superior → navegar sub-tabs hacia la izquierda
        setTab((t) => {
          const i = SUB_TABS.indexOf(t);
          return SUB_TABS[Math.max(i - 1, 0)];
        });
      } else {
        // Zona inferior → navegar pantalla principal hacia la izquierda
        onSwipeScreen?.("right");
      }
    },
  });
  const [subTab, setSubTab] = useState("glucosa");
  const [histTab, setHistTab] = useState("glucosa");
  const [cfg, setCfg] = useState({
    hypo: profile?.glucose_hypo || 70,
    target_high: profile?.glucose_target_high || 180,
    high: profile?.glucose_high || 250,
  });
  const [draftCfg, setDraftCfg] = useState({
    hypo: profile?.glucose_hypo || 70,
    target_high: profile?.glucose_target_high || 180,
    high: profile?.glucose_high || 250,
  });
  const [cfgSaved, setCfgSaved] = useState(false);
  const [editingCfg, setEditingCfg] = useState(false);

  const [gForm, setGForm] = useState({ v: "", ctx: "En ayunas", note: "", date: nowLocal() });
  const [bForm, setBForm] = useState({
    sys: "",
    dia: "",
    pulse: "",
    arm: "Brazo izquierdo",
    note: "",
    date: nowLocal(),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detailRec, setDetailRec] = useState(null); // { type: 'glu'|'bp', data: {...} }
  const [editRec, setEditRec] = useState(null); // { type: 'glu'|'bp', data: {...} }
  const [editDraft, setEditDraft] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  const latestG = gluReadings[0];
  const latestBP = bpReadings[0];
  const stG = latestG ? getGluStatus(latestG.value, cfg) : null;
  const stBP = latestBP
    ? getBPStatus(latestBP.systolic, latestBP.diastolic)
    : null;

  const gluAlerts = useMemo(
    () => (gluReadings.length ? getGluAlerts(gluReadings, cfg) : []),
    [gluReadings, cfg],
  );
  const bpAlerts = useMemo(
    () => (bpReadings.length ? getBPAlerts(bpReadings) : []),
    [bpReadings],
  );
  const allAlerts = [...gluAlerts, ...bpAlerts];

  const chartGlu = gluReadings
    .slice(0, 10)
    .reverse()
    .map((r) => {
      const d = new Date(r.recorded_at);
      const p = (n) => String(n).padStart(2, "0");
      const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
      return {
        t: `${p(d.getHours())}:${p(d.getMinutes())}`,
        date: `${d.getDate()} ${months[d.getMonth()]}`,
        v: r.value,
      };
    });

  const avg = gluReadings.length
    ? Math.round(
        gluReadings.reduce((a, r) => a + r.value, 0) / gluReadings.length,
      )
    : 0;
  const inRange = gluReadings.filter(
    (r) => r.value >= cfg.hypo && r.value <= cfg.target_high,
  ).length;
  const pct = gluReadings.length
    ? Math.round((inRange / gluReadings.length) * 100)
    : 0;
  const avgSys = bpReadings.length
    ? Math.round(
        bpReadings.reduce((a, r) => a + r.systolic, 0) / bpReadings.length,
      )
    : 0;
  const avgDia = bpReadings.length
    ? Math.round(
        bpReadings.reduce((a, r) => a + r.diastolic, 0) / bpReadings.length,
      )
    : 0;

  const gFormVal = gForm.v ? parseInt(gForm.v) : null;
  const gFormSt = gFormVal ? getGluStatus(gFormVal, cfg) : null;
  const bSys = bForm.sys ? parseInt(bForm.sys) : null;
  const bDia = bForm.dia ? parseInt(bForm.dia) : null;
  const bFormSt = bSys && bDia ? getBPStatus(bSys, bDia) : null;
  const bFormOk =
    bSys && bDia && bSys >= 60 && bSys <= 250 && bDia >= 40 && bDia <= 150;

  const tabBtn = (active) => ({
    flex: 1,
    padding: "10px 0",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    color: active ? G : mu,
    background: wh,
    border: "none",
    cursor: "pointer",
    borderBottom: `2.5px solid ${active ? G : "transparent"}`,
    transition: "color .15s",
  });

  async function saveGlu() {
    const val = parseInt(gForm.v);
    if (!val || val < 20 || val > 600) return;
    setSaving(true);
    try {
      await addGlucose({
        value: val,
        context: gForm.ctx,
        note: gForm.note,
        recorded_at: gForm.date ? parseLocalDT(gForm.date).toISOString() : undefined,
      });
      setGForm({ v: "", ctx: "En ayunas", note: "", date: nowLocal() });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setTab("inicio");
      }, 1400);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveBP() {
    if (!bFormOk) return;
    setSaving(true);
    try {
      await addBP({
        systolic: bSys,
        diastolic: bDia,
        pulse: bForm.pulse ? parseInt(bForm.pulse) : null,
        arm: bForm.arm,
        note: bForm.note,
        recorded_at: bForm.date ? parseLocalDT(bForm.date).toISOString() : undefined,
      });
      setBForm({
        sys: "",
        dia: "",
        pulse: "",
        arm: "Brazo izquierdo",
        note: "",
        date: nowLocal(),
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setTab("inicio");
      }, 1400);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  function saveCfg() {
    setCfg({ ...draftCfg });
    setEditingCfg(false);
    setCfgSaved(true);
    setTimeout(() => setCfgSaved(false), 2000);
  }

  function openEdit(type, r) {
    if (type === "glu") {
      const d = new Date(r.recorded_at);
      const p = (n) => String(n).padStart(2, "0");
      const local = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
      setEditDraft({ value: String(r.value), ctx: r.context, note: r.note || "", date: local });
    } else {
      const d = new Date(r.recorded_at);
      const p = (n) => String(n).padStart(2, "0");
      const local = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
      setEditDraft({
        sys: String(r.systolic),
        dia: String(r.diastolic),
        pulse: r.pulse ? String(r.pulse) : "",
        arm: r.arm,
        note: r.note || "",
        date: local,
      });
    }
    setEditRec({ type, data: r });
  }

  async function saveEdit() {
    setEditSaving(true);
    try {
      if (editRec.type === "glu") {
        const val = parseInt(editDraft.value);
        if (!val || val < 20 || val > 600) return;
        await updateGlucose(editRec.data.id, {
          value: val,
          context: editDraft.ctx,
          note: editDraft.note,
          recorded_at: parseLocalDT(editDraft.date).toISOString(),
        });
      } else {
        const sys = parseInt(editDraft.sys);
        const dia = parseInt(editDraft.dia);
        if (!sys || !dia) return;
        await updateBP(editRec.data.id, {
          systolic: sys,
          diastolic: dia,
          pulse: editDraft.pulse ? parseInt(editDraft.pulse) : null,
          arm: editDraft.arm,
          note: editDraft.note,
          recorded_at: parseLocalDT(editDraft.date).toISOString(),
        });
      }
      setEditRec(null);
    } catch (e) {
      alert(e.message);
    } finally {
      setEditSaving(false);
    }
  }

  const canEdit = myRoleInGroup === "admin" || !myRoleInGroup;

  if (loading)
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: mu,
          fontFamily: "system-ui",
          fontSize: 14,
        }}
      >
        Cargando registros...
      </div>
    );

  return (
    <div
      {...swipeHandlers}
      style={{
        background: bg,
        fontFamily: "system-ui,-apple-system,sans-serif",
        minHeight: "100dvh",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: hd,
          padding: "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Nombre / selector de persona */}
        {(() => {
          const isUserPatient = patients.some((p) => p.id === user.id);
          const selfOption = { id: null, name: profile?.full_name || user.email, isSelf: true };
          const options = isUserPatient ? patients : [...patients, selfOption];
          const currentName = viewingPatient?.name || profile?.full_name || user.email;
          const hasOptions = options.length > 1;

          return (
            <div>
              <div style={{ color: "#6B7280", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>
                KuXtaL
              </div>
              {hasOptions ? (
                <button
                  onClick={() => setShowPersonSelector(true)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    marginTop: 2,
                  }}
                >
                  <span style={{ color: wh, fontSize: 14, fontWeight: 600 }}>{currentName}</span>
                  <span style={{ color: "#9CA3AF", fontSize: 11 }}>∨</span>
                </button>
              ) : (
                <div style={{ color: wh, fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                  {currentName}
                </div>
              )}
            </div>
          );
        })()}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            onClick={onOpenProfile}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              cursor: "pointer",
              background: profile?.avatar_url ? "transparent" : "#FFFFFF22",
              border: "2px solid #FFFFFF44",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 700,
              color: wh,
              overflow: "hidden",
            }}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              (profile?.full_name || user.email || "?")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          background: wh,
          display: "flex",
          borderBottom: `1px solid ${bd}`,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {[
          ["inicio", "Inicio"],
          ["registrar", "+ Nuevo"],
          ["historial", "Historial"],
          ["config", "⚙ Config"],
        ].map(([id, lbl]) => (
          <button
            key={id}
            style={tabBtn(tab === id)}
            onClick={() => setTab(id)}
          >
            {lbl}
          </button>
        ))}
      </div>

      <div style={{ padding: "14px 14px 28px" }}>
        {/* ── INICIO ── */}
        {tab === "inicio" && (
          <>
            {allAlerts.map((a, i) => (
              <div
                key={i}
                style={{
                  background: a.lv === "danger" ? "#FEF2F2" : "#FFFBEB",
                  border: `1px solid ${a.lv === "danger" ? "#FCA5A5" : "#FCD34D"}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 10,
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>
                  {a.lv === "danger" ? "🚨" : "⚠️"}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: a.lv === "danger" ? "#991B1B" : "#92400E",
                    lineHeight: 1.5,
                  }}
                >
                  {a.msg}
                </span>
              </div>
            ))}

            {!latestG && !latestBP && (
              <div
                style={{ ...card(), textAlign: "center", padding: "40px 20px" }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: tx,
                    marginBottom: 6,
                  }}
                >
                  {viewingPatient
                    ? `${viewingPatient.name} aún no tiene registros`
                    : "Bienvenido a KuXtaL"}
                </div>
                <div style={{ fontSize: 13, color: mu }}>
                  {viewingPatient
                    ? "Los registros aparecerán aquí cuando se agreguen"
                    : "Agrega tu primer registro con el botón + Nuevo"}
                </div>
              </div>
            )}

            {latestG && latestBP && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{ ...card(), marginBottom: 0, cursor: "pointer" }}
                  onClick={() => {
                    setTab("registrar");
                    setSubTab("glucosa");
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      color: mu,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 8,
                    }}
                  >
                    Glucosa
                  </div>
                  <div
                    style={{
                      fontSize: 42,
                      fontWeight: 700,
                      color: stG.color,
                      lineHeight: 1,
                    }}
                  >
                    {latestG.value}
                  </div>
                  <div style={{ fontSize: 10, color: mu, marginTop: 2 }}>
                    mg/dL
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: "inline-block",
                      background: stG.bg,
                      border: `1px solid ${stG.ring}`,
                      borderRadius: 20,
                      padding: "3px 8px",
                      color: stG.color,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {stG.label}
                  </div>
                </div>
                <div
                  style={{ ...card(), marginBottom: 0, cursor: "pointer" }}
                  onClick={() => {
                    setTab("registrar");
                    setSubTab("presion");
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      color: mu,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 8,
                    }}
                  >
                    Presión arterial
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "baseline", gap: 2 }}
                  >
                    <span
                      style={{
                        fontSize: 30,
                        fontWeight: 700,
                        color: stBP.color,
                        lineHeight: 1,
                      }}
                    >
                      {latestBP.systolic}
                    </span>
                    <span style={{ fontSize: 16, color: mu }}>/</span>
                    <span
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: stBP.color,
                      }}
                    >
                      {latestBP.diastolic}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: mu, marginTop: 2 }}>
                    mmHg
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: "inline-block",
                      background: stBP.bg,
                      border: `1px solid ${stBP.ring}`,
                      borderRadius: 20,
                      padding: "3px 8px",
                      color: stBP.color,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {stBP.label}
                  </div>
                </div>
              </div>
            )}

            {gluReadings.length > 0 && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  {[
                    ["Prom. glu", `${avg}`, "mg/dL"],
                    ["En rango", `${pct}%`, `${inRange}/${gluReadings.length}`],
                    ["Prom. SIS", `${avgSys}`, "mmHg"],
                    ["Prom. DIA", `${avgDia}`, "mmHg"],
                  ].map(([l, v, s]) => (
                    <div
                      key={l}
                      style={{
                        background: wh,
                        borderRadius: 12,
                        padding: "10px 6px",
                        textAlign: "center",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 8,
                          color: mu,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          marginBottom: 3,
                        }}
                      >
                        {l}
                      </div>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: tx,
                        }}
                      >
                        {v}
                      </div>
                      <div style={{ fontSize: 9, color: mu, marginTop: 1 }}>
                        {s}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={card()}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: tx,
                      marginBottom: 12,
                    }}
                  >
                    Glucosa — últimos registros
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart
                      data={chartGlu}
                      margin={{ top: 8, right: 4, left: -28, bottom: 16 }}
                    >
                      <defs>
                        <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={G} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={G} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="t"
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        height={30}
                        tick={({ x, y, payload }) => {
                          const datum = chartGlu.find((d) => d.t === payload.value);
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text textAnchor="middle" dy={-4} style={{ fontSize: 8, fill: mu }}>
                                {datum?.date || ""}
                              </text>
                              <text textAnchor="middle" dy={8} style={{ fontSize: 9, fill: mu }}>
                                {payload.value}
                              </text>
                            </g>
                          );
                        }}
                      />
                      <YAxis
                        domain={[40, 360]}
                        tick={{ fontSize: 9, fill: mu }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(v) => [`${v} mg/dL`, "Glucosa"]}
                        contentStyle={{
                          fontSize: 11,
                          borderRadius: 8,
                          border: `1px solid ${bd}`,
                        }}
                      />
                      <ReferenceLine
                        y={cfg.hypo}
                        stroke="#EF4444"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                      />
                      <ReferenceLine
                        y={cfg.target_high}
                        stroke={G}
                        strokeDasharray="3 3"
                        strokeWidth={1}
                      />
                      <ReferenceLine
                        y={cfg.high}
                        stroke="#F59E0B"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                      />
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={G}
                        strokeWidth={2}
                        fill="url(#gG)"
                        dot={{ fill: G, r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </>
        )}

        {/* ── REGISTRAR ── */}
        {tab === "registrar" && (
          <>
            <SubTabs
              value={subTab}
              onChange={setSubTab}
              tabs={[
                ["glucosa", "💉 Glucosa"],
                ["presion", "🩺 Presión"],
              ]}
            />
            {saved ? (
              <SavedScreen />
            ) : subTab === "glucosa" ? (
              <div style={card({ padding: 22 })}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: tx,
                    marginBottom: 22,
                  }}
                >
                  {viewingPatient
                    ? `Registrar glucosa de ${viewingPatient.name}`
                    : "Registro de glucosa"}
                </div>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={lbl10({ textAlign: "center" })}>
                    Valor (mg/dL)
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <input
                      type="number"
                      inputMode="numeric"
                      value={gForm.v}
                      onChange={(e) =>
                        setGForm((f) => ({ ...f, v: e.target.value }))
                      }
                      placeholder="---"
                      min={20}
                      max={600}
                      disabled={isViewer}
                      style={{
                        fontSize: 68,
                        fontWeight: 700,
                        width: 160,
                        color: gFormSt ? gFormSt.color : "#D1D5DB",
                        border: "none",
                        borderBottom: `3px solid ${gFormSt ? gFormSt.color : "#E5E7EB"}`,
                        outline: "none",
                        background: "transparent",
                        textAlign: "center",
                        padding: "0 4px",
                        fontFamily: "inherit",
                      }}
                    />
                    <span style={{ fontSize: 18, color: mu }}>mg/dL</span>
                  </div>
                  {gFormSt && gFormVal >= 20 && (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 13,
                        fontWeight: 600,
                        color: gFormSt.color,
                      }}
                    >
                      {gFormSt.label}
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={lbl10()}>Contexto</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {CONTEXTS.map((c) => (
                      <Chip
                        key={c}
                        val={c}
                        cur={gForm.ctx}
                        set={(v) => setGForm((f) => ({ ...f, ctx: v }))}
                      />
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={lbl10()}>Nota (opcional)</div>
                  <textarea
                    value={gForm.note}
                    onChange={(e) =>
                      setGForm((f) => ({ ...f, note: e.target.value }))
                    }
                    placeholder="Síntomas, comida, insulina..."
                    rows={3}
                    disabled={isViewer}
                    style={{
                      width: "100%",
                      border: `1.5px solid ${bd}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 16,
                      color: tx,
                      resize: "none",
                      outline: "none",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <div style={lbl10()}>Fecha y hora del registro</div>
                  <input
                    type="datetime-local"
                    value={gForm.date}
                    onChange={(e) => setGForm((f) => ({ ...f, date: e.target.value }))}
                    disabled={isViewer}
                    style={{
                      width: "100%",
                      border: `1.5px solid ${bd}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 16,
                      color: tx,
                      outline: "none",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {isViewer ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "12px 0",
                      fontSize: 13,
                      color: mu,
                    }}
                  >
                    Solo puedes ver los datos de este paciente
                  </div>
                ) : (
                  <button
                    onClick={saveGlu}
                    disabled={saving || !gFormVal || gFormVal < 20}
                    style={{
                      width: "100%",
                      padding: 14,
                      background: gFormVal && gFormVal >= 20 ? G : "#D1D5DB",
                      color: wh,
                      border: "none",
                      borderRadius: 12,
                      fontSize: 15,
                      fontWeight: 600,
                      cursor:
                        gFormVal && gFormVal >= 20 ? "pointer" : "not-allowed",
                    }}
                  >
                    {saving ? "Guardando..." : "Guardar glucosa"}
                  </button>
                )}
              </div>
            ) : (
              <div style={card({ padding: 22 })}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: tx,
                    marginBottom: 22,
                  }}
                >
                  {viewingPatient
                    ? `Registrar presión de ${viewingPatient.name}`
                    : "Registro de presión arterial"}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
                  {[
                    ["sys", "Sistólica", 60, 250],
                    ["dia", "Diastólica", 40, 150],
                  ].map(([key, lbl, mn, mx]) => (
                    <div key={key} style={{ textAlign: "center" }}>
                      <div style={lbl10({ textAlign: "center" })}>{lbl}</div>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={bForm[key]}
                        onChange={(e) =>
                          setBForm((f) => ({ ...f, [key]: e.target.value }))
                        }
                        placeholder="---"
                        min={mn}
                        max={mx}
                        disabled={isViewer}
                        style={{
                          fontSize: 48,
                          fontWeight: 700,
                          width: "100%",
                          color: bFormSt ? bFormSt.color : "#D1D5DB",
                          border: "none",
                          borderBottom: `3px solid ${bFormSt ? bFormSt.color : "#E5E7EB"}`,
                          outline: "none",
                          background: "transparent",
                          textAlign: "center",
                          padding: "0 4px",
                          fontFamily: "inherit",
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ fontSize: 10, color: mu, marginTop: 4 }}>
                        mmHg
                      </div>
                    </div>
                  ))}
                </div>
                {bFormSt && (
                  <>
                    <div style={{ textAlign: "center", marginBottom: 4 }}>
                      <span
                        style={{
                          background: bFormSt.bg,
                          border: `1.5px solid ${bFormSt.ring}`,
                          borderRadius: 20,
                          padding: "5px 14px",
                          color: bFormSt.color,
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {bFormSt.label}
                      </span>
                    </div>
                    <BPGauge sys={bSys} dia={bDia} />
                  </>
                )}
                <div style={{ marginTop: 20, marginBottom: 18 }}>
                  <div style={lbl10()}>Pulso (opcional)</div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <input
                      type="number"
                      inputMode="numeric"
                      value={bForm.pulse}
                      onChange={(e) =>
                        setBForm((f) => ({ ...f, pulse: e.target.value }))
                      }
                      placeholder="ej. 72"
                      min={30}
                      max={220}
                      disabled={isViewer}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        border: `1.5px solid ${bd}`,
                        borderRadius: 10,
                        fontSize: 16,
                        color: tx,
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    />
                    <span style={{ fontSize: 12, color: mu }}>lpm</span>
                  </div>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={lbl10()}>Brazo medido</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {ARMS.map((a) => (
                      <Chip
                        key={a}
                        val={a}
                        cur={bForm.arm}
                        set={(v) => setBForm((f) => ({ ...f, arm: v }))}
                      />
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={lbl10()}>Nota (opcional)</div>
                  <textarea
                    value={bForm.note}
                    onChange={(e) =>
                      setBForm((f) => ({ ...f, note: e.target.value }))
                    }
                    placeholder="Posición, medicamento, síntomas..."
                    rows={2}
                    disabled={isViewer}
                    style={{
                      width: "100%",
                      border: `1.5px solid ${bd}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 16,
                      color: tx,
                      resize: "none",
                      outline: "none",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <div style={lbl10()}>Fecha y hora del registro</div>
                  <input
                    type="datetime-local"
                    value={bForm.date}
                    onChange={(e) => setBForm((f) => ({ ...f, date: e.target.value }))}
                    disabled={isViewer}
                    style={{
                      width: "100%",
                      border: `1.5px solid ${bd}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 16,
                      color: tx,
                      outline: "none",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {isViewer ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "12px 0",
                      fontSize: 13,
                      color: mu,
                    }}
                  >
                    Solo puedes ver los datos de este paciente
                  </div>
                ) : (
                  <button
                    onClick={saveBP}
                    disabled={saving || !bFormOk}
                    style={{
                      width: "100%",
                      padding: 14,
                      background: bFormOk ? "#1D4ED8" : "#D1D5DB",
                      color: wh,
                      border: "none",
                      borderRadius: 12,
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: bFormOk ? "pointer" : "not-allowed",
                    }}
                  >
                    {saving ? "Guardando..." : "Guardar presión arterial"}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* ── HISTORIAL ── */}
        {tab === "historial" && (
          <>
            <SubTabs
              value={histTab}
              onChange={setHistTab}
              tabs={[
                ["glucosa", "💉 Glucosa"],
                ["presion", "🩺 Presión"],
              ]}
            />
            <div style={card()}>
              {histTab === "glucosa" ? (
                <>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: tx,
                      marginBottom: 14,
                    }}
                  >
                    Glucosa — {gluReadings.length} registros
                  </div>
                  {gluReadings.length === 0 && (
                    <div
                      style={{
                        fontSize: 13,
                        color: mu,
                        textAlign: "center",
                        padding: "20px 0",
                      }}
                    >
                      Sin registros aún
                    </div>
                  )}
                  {gluReadings.map((r) => {
                    const s = getGluStatus(r.value, cfg);
                    return (
                      <div
                        key={r.id}
                        onClick={() => setDetailRec({ type: "glu", data: r })}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "11px 0",
                          borderBottom: `1px solid ${bd}`,
                          cursor: "pointer",
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: s.color,
                            marginRight: 12,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: tx, fontWeight: 500 }}>
                            {r.context}
                          </div>
                          <div style={{ fontSize: 11, color: mu, marginTop: 2 }}>
                            {fmt(r.recorded_at)}
                          </div>
                          {r.note && (
                            <div style={{ fontSize: 11, color: mu, marginTop: 2 }}>
                              {r.note}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div>
                            <span style={{ fontSize: 20, fontWeight: 700, color: s.color }}>
                              {r.value}
                            </span>
                            <span style={{ fontSize: 10, color: mu, marginLeft: 4 }}>
                              mg/dL
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: mu }}>›</span>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: tx,
                      marginBottom: 14,
                    }}
                  >
                    Presión arterial — {bpReadings.length} registros
                  </div>
                  {bpReadings.length === 0 && (
                    <div
                      style={{
                        fontSize: 13,
                        color: mu,
                        textAlign: "center",
                        padding: "20px 0",
                      }}
                    >
                      Sin registros aún
                    </div>
                  )}
                  {bpReadings.map((r) => {
                    const s = getBPStatus(r.systolic, r.diastolic);
                    return (
                      <div
                        key={r.id}
                        onClick={() => setDetailRec({ type: "bp", data: r })}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "11px 0",
                          borderBottom: `1px solid ${bd}`,
                          cursor: "pointer",
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: s.color,
                            marginRight: 12,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                            <span style={{ fontSize: 18, fontWeight: 700, color: s.color }}>
                              {r.systolic}
                            </span>
                            <span style={{ fontSize: 13, color: mu }}>/</span>
                            <span style={{ fontSize: 15, fontWeight: 600, color: s.color }}>
                              {r.diastolic}
                            </span>
                            <span style={{ fontSize: 10, color: mu }}>mmHg</span>
                          </div>
                          <div style={{ fontSize: 11, color: mu, marginTop: 2 }}>
                            {r.arm}{r.pulse ? ` · ${r.pulse} lpm` : ""} · {fmt(r.recorded_at)}
                          </div>
                          {r.note && (
                            <div style={{ fontSize: 11, color: mu, marginTop: 2 }}>
                              {r.note}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              background: s.bg,
                              border: `1px solid ${s.ring}`,
                              borderRadius: 20,
                              padding: "3px 8px",
                              color: s.color,
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {s.label}
                          </div>
                          <span style={{ fontSize: 11, color: mu }}>›</span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </>
        )}

        {/* ── CONFIG ── */}
        {tab === "config" && (
          <>
            <div style={card()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: tx }}>
                  Rangos de glucosa
                </div>
                {!editingCfg && (
                  <button
                    onClick={() => setEditingCfg(true)}
                    style={{ padding: "5px 14px", border: `1.5px solid ${bd}`, borderRadius: 8, background: wh, fontSize: 13, fontWeight: 600, color: tx, cursor: "pointer" }}
                  >
                    Editar
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12, color: mu, marginBottom: 16 }}>
                Personaliza los umbrales según tu tratamiento
              </div>

              {!editingCfg ? (
                <div>
                  {[
                    ["Hipoglucemia", draftCfg.hypo, "#DC2626"],
                    ["Rango objetivo — límite superior", draftCfg.target_high, G],
                    ["Alerta de glucosa elevada", draftCfg.high, "#DC2626"],
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
                    label="Hipoglucemia"
                    value={draftCfg.hypo}
                    min={50}
                    max={90}
                    unit="mg/dL"
                    color="#DC2626"
                    onChange={(v) => setDraftCfg((c) => ({ ...c, hypo: v }))}
                  />
                  <RangeInput
                    label="Rango objetivo — límite superior"
                    value={draftCfg.target_high}
                    min={120}
                    max={240}
                    unit="mg/dL"
                    color={G}
                    onChange={(v) =>
                      setDraftCfg((c) => ({
                        ...c,
                        target_high: v,
                        high: Math.max(v + 20, c.high),
                      }))
                    }
                  />
                  <RangeInput
                    label="Alerta de glucosa elevada"
                    value={draftCfg.high}
                    min={draftCfg.target_high + 20}
                    max={400}
                    unit="mg/dL"
                    color="#DC2626"
                    onChange={(v) => setDraftCfg((c) => ({ ...c, high: v }))}
                  />
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 10, color: mu, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                      Vista previa
                    </div>
                    <div style={{ height: 20, borderRadius: 10, overflow: "hidden", display: "flex" }}>
                      <div style={{ width: `${((draftCfg.hypo - 40) / 360) * 100}%`, background: "#FEE2E2" }} />
                      <div style={{ width: `${((draftCfg.target_high - draftCfg.hypo) / 360) * 100}%`, background: "#D1FAE5" }} />
                      <div style={{ width: `${((draftCfg.high - draftCfg.target_high) / 360) * 100}%`, background: "#FEF3C7" }} />
                      <div style={{ flex: 1, background: "#FEE2E2" }} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {editingCfg && (
              <>
                <button
                  onClick={saveCfg}
                  style={{
                    width: "100%",
                    padding: 14,
                    background: cfgSaved ? G : hd,
                    color: wh,
                    border: "none",
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background .3s",
                    marginBottom: 8,
                  }}
                >
                  {cfgSaved ? "✓ Guardado" : "Guardar configuración"}
                </button>
                <button
                  onClick={() => { setDraftCfg({ ...cfg }); setEditingCfg(false); }}
                  style={{
                    width: "100%",
                    padding: 14,
                    background: "transparent",
                    color: mu,
                    border: `1.5px solid ${bd}`,
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: 12,
                  }}
                >
                  Cancelar
                </button>
              </>
            )}

            <button
              onClick={signOut}
              style={{
                width: "100%",
                padding: 14,
                background: "transparent",
                color: "#EF4444",
                border: "1.5px solid #FCA5A5",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cerrar sesión
            </button>
          </>
        )}
      </div>

      {/* ── Bottom sheet: detalle de registro ── */}
      {detailRec && (() => {
        const r = detailRec.data;
        const isGlu = detailRec.type === "glu";
        const s = isGlu ? getGluStatus(r.value, cfg) : getBPStatus(r.systolic, r.diastolic);
        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 60, display: "flex", alignItems: "flex-end" }}
            onClick={() => setDetailRec(null)}
          >
            <div
              style={{ background: wh, borderRadius: "20px 20px 0 0", width: "100%", paddingBottom: 32, boxSizing: "border-box" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: bd }} />
              </div>
              {/* Header */}
              <div style={{ padding: "12px 20px 16px", borderBottom: `1px solid ${bd}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: mu, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 2 }}>
                    {isGlu ? "Glucosa" : "Presión arterial"}
                  </div>
                  {isGlu ? (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 36, fontWeight: 800, color: s.color }}>{r.value}</span>
                      <span style={{ fontSize: 14, color: mu }}>mg/dL</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{r.systolic}</span>
                      <span style={{ fontSize: 18, color: mu }}>/</span>
                      <span style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{r.diastolic}</span>
                      <span style={{ fontSize: 13, color: mu }}>mmHg</span>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ background: s.bg, border: `1.5px solid ${s.ring}`, borderRadius: 20, padding: "5px 12px", color: s.color, fontSize: 12, fontWeight: 700 }}>
                    {s.label}
                  </span>
                </div>
              </div>
              {/* Detalles */}
              <div style={{ padding: "16px 20px" }}>
                {isGlu ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 13, color: mu }}>Contexto</span>
                      <span style={{ fontSize: 13, color: tx, fontWeight: 500 }}>{r.context}</span>
                    </div>
                  </>
                ) : (
                  <>
                    {r.pulse && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 13, color: mu }}>Pulso</span>
                        <span style={{ fontSize: 13, color: tx, fontWeight: 500 }}>{r.pulse} lpm</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 13, color: mu }}>Brazo</span>
                      <span style={{ fontSize: 13, color: tx, fontWeight: 500 }}>{r.arm}</span>
                    </div>
                  </>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: mu }}>Fecha y hora</span>
                  <span style={{ fontSize: 13, color: tx, fontWeight: 500 }}>{fmt(r.recorded_at)}</span>
                </div>
                {r.note && (
                  <div style={{ marginTop: 4, padding: "10px 12px", background: "#F9FAFB", borderRadius: 10, fontSize: 13, color: tx }}>
                    {r.note}
                  </div>
                )}
              </div>
              {/* Botones de acción */}
              <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                {canEdit && (
                  <button
                    onClick={() => { openEdit(isGlu ? "glu" : "bp", r); setDetailRec(null); }}
                    style={{ width: "100%", padding: 14, background: hd, color: wh, border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
                  >
                    Editar registro
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => {
                      if (confirm("¿Borrar este registro?")) {
                        isGlu ? deleteGlucose(r.id) : deleteBP(r.id);
                        setDetailRec(null);
                      }
                    }}
                    style={{ width: "100%", padding: 14, background: "transparent", color: "#EF4444", border: "1.5px solid #FCA5A5", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
                  >
                    Eliminar registro
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal de edición de registro ── */}
      {editRec && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 60, display: "flex", alignItems: "flex-end" }}
          onClick={() => setEditRec(null)}
        >
          <div
            style={{ background: wh, borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "90dvh", overflowY: "auto", overscrollBehavior: "contain", paddingBottom: 32, boxSizing: "border-box" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "18px 20px 12px", fontSize: 15, fontWeight: 700, color: hd, borderBottom: `1px solid ${bd}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{editRec.type === "glu" ? "Editar registro de glucosa" : "Editar registro de presión"}</span>
              <button onClick={() => setEditRec(null)} style={{ background: "none", border: "none", fontSize: 20, color: mu, cursor: "pointer", padding: 0 }}>×</button>
            </div>
            <div style={{ padding: "20px 20px 0" }}>
              {editRec.type === "glu" ? (
                <>
                  <div style={{ marginBottom: 18 }}>
                    <div style={lbl10()}>Valor (mg/dL)</div>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={editDraft.value}
                      onChange={(e) => setEditDraft((d) => ({ ...d, value: e.target.value }))}
                      min={20} max={600}
                      style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${bd}`, borderRadius: 10, fontSize: 24, fontWeight: 700, color: tx, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <div style={lbl10()}>Contexto</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {CONTEXTS.map((c) => (
                        <Chip key={c} val={c} cur={editDraft.ctx} set={(v) => setEditDraft((d) => ({ ...d, ctx: v }))} />
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <div style={lbl10()}>Nota (opcional)</div>
                    <textarea
                      value={editDraft.note}
                      onChange={(e) => setEditDraft((d) => ({ ...d, note: e.target.value }))}
                      rows={2}
                      style={{ width: "100%", border: `1.5px solid ${bd}`, borderRadius: 10, padding: "10px 12px", fontSize: 16, color: tx, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <div style={lbl10()}>Fecha y hora</div>
                    <input
                      type="datetime-local"
                      value={editDraft.date}
                      onChange={(e) => setEditDraft((d) => ({ ...d, date: e.target.value }))}
                      style={{ width: "100%", border: `1.5px solid ${bd}`, borderRadius: 10, padding: "10px 12px", fontSize: 16, color: tx, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
                    {[["sys", "Sistólica"], ["dia", "Diastólica"]].map(([key, label]) => (
                      <div key={key}>
                        <div style={lbl10()}>{label}</div>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={editDraft[key]}
                          onChange={(e) => setEditDraft((d) => ({ ...d, [key]: e.target.value }))}
                          style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${bd}`, borderRadius: 10, fontSize: 20, fontWeight: 700, color: tx, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <div style={lbl10()}>Pulso (opcional)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={editDraft.pulse}
                        onChange={(e) => setEditDraft((d) => ({ ...d, pulse: e.target.value }))}
                        style={{ flex: 1, padding: "10px 12px", border: `1.5px solid ${bd}`, borderRadius: 10, fontSize: 16, color: tx, outline: "none", fontFamily: "inherit" }}
                      />
                      <span style={{ fontSize: 12, color: mu }}>lpm</span>
                    </div>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <div style={lbl10()}>Brazo medido</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {ARMS.map((a) => (
                        <Chip key={a} val={a} cur={editDraft.arm} set={(v) => setEditDraft((d) => ({ ...d, arm: v }))} />
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <div style={lbl10()}>Nota (opcional)</div>
                    <textarea
                      value={editDraft.note}
                      onChange={(e) => setEditDraft((d) => ({ ...d, note: e.target.value }))}
                      rows={2}
                      style={{ width: "100%", border: `1.5px solid ${bd}`, borderRadius: 10, padding: "10px 12px", fontSize: 16, color: tx, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <div style={lbl10()}>Fecha y hora</div>
                    <input
                      type="datetime-local"
                      value={editDraft.date}
                      onChange={(e) => setEditDraft((d) => ({ ...d, date: e.target.value }))}
                      style={{ width: "100%", border: `1.5px solid ${bd}`, borderRadius: 10, padding: "10px 12px", fontSize: 16, color: tx, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                  </div>
                </>
              )}
              <button
                onClick={saveEdit}
                disabled={editSaving}
                style={{ width: "100%", padding: 14, background: G, color: wh, border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}
              >
                {editSaving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                onClick={() => setEditRec(null)}
                style={{ width: "100%", padding: 14, background: "transparent", color: mu, border: `1.5px solid ${bd}`, borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 8 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom sheet: selector de persona ── */}
      {showPersonSelector && (() => {
        const isUserPatient = patients.some((p) => p.id === user.id);
        const selfOption = { id: null, name: profile?.full_name || user.email, isSelf: true };
        const options = isUserPatient ? patients : [...patients, selfOption];
        const selectedId = viewingPatient?.id ?? null;

        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
            onClick={() => setShowPersonSelector(false)}
          >
            <div
              style={{ background: wh, borderRadius: "20px 20px 0 0", width: "100%", paddingBottom: 32, boxSizing: "border-box" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "20px 20px 12px", fontSize: 15, fontWeight: 700, color: hd, borderBottom: `1px solid ${bd}` }}>
                Ver datos de...
              </div>
              {options.map((opt) => {
                const isSelected = opt.id === selectedId;
                return (
                  <button
                    key={opt.id ?? "self"}
                    onClick={() => { onSelectPatient(opt.isSelf ? null : opt); setShowPersonSelector(false); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "15px 20px",
                      border: "none",
                      borderBottom: `1px solid ${bd}`,
                      background: isSelected ? "#ECFDF5" : "none",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 15, fontWeight: isSelected ? 600 : 400, color: isSelected ? G : hd }}>
                        {opt.name}
                      </div>
                      <div style={{ fontSize: 12, color: mu, marginTop: 2 }}>
                        {opt.isSelf ? "Tú" : "Paciente"}
                      </div>
                    </div>
                    {isSelected && <span style={{ color: G, fontSize: 18 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
