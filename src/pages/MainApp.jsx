import { useState, useMemo } from "react";
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
const DEFAULT_CFG = { hypo: 70, target_high: 180, high: 250 };

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

function fmt(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  const time = d.toTimeString().slice(0, 5);
  if (diff === 0) return `Hoy · ${time}`;
  if (diff === 1) return `Ayer · ${time}`;
  return `Hace ${diff} días · ${time}`;
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

export default function MainApp({
  user,
  profile,
  signOut,
  targetUserId,
  viewingPatient,
  onOpenProfile,
  myRoleInGroup,
}) {
  const {
    gluReadings,
    bpReadings,
    loading,
    addGlucose,
    addBP,
    deleteGlucose,
    deleteBP,
  } = useReadings(user.id, targetUserId || null);

  // Si hay un paciente seleccionado y el usuario no es caregiver/admin,
  // solo puede observar (no registrar)
  const isViewer =
    !!viewingPatient && !["admin", "caregiver"].includes(myRoleInGroup);
  const canDelete = myRoleInGroup === "admin" || !viewingPatient;
  const [tab, setTab] = useState("inicio");
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

  const [gForm, setGForm] = useState({ v: "", ctx: "En ayunas", note: "" });
  const [bForm, setBForm] = useState({
    sys: "",
    dia: "",
    pulse: "",
    arm: "Brazo izquierdo",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    .map((r) => ({
      t: new Date(r.recorded_at).toTimeString().slice(0, 5),
      v: r.value,
    }));

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
      await addGlucose({ value: val, context: gForm.ctx, note: gForm.note });
      setGForm({ v: "", ctx: "En ayunas", note: "" });
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
      });
      setBForm({
        sys: "",
        dia: "",
        pulse: "",
        arm: "Brazo izquierdo",
        note: "",
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
    setCfgSaved(true);
    setTimeout(() => setCfgSaved(false), 2000);
  }

  const SavedScreen = () => (
    <div style={{ ...card(), textAlign: "center", padding: "52px 0" }}>
      <div style={{ fontSize: 56, marginBottom: 14 }}>✅</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: G }}>¡Guardado!</div>
      <div style={{ fontSize: 13, color: mu, marginTop: 6 }}>
        Regresando al inicio...
      </div>
    </div>
  );

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
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
      style={{
        background: bg,
        fontFamily: "system-ui,-apple-system,sans-serif",
        minHeight: "100vh",
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
        <div>
          <div
            style={{
              color: "#6B7280",
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            KuXtaL
          </div>
          <div
            style={{ color: wh, fontSize: 14, fontWeight: 600, marginTop: 2 }}
          >
            {viewingPatient
              ? viewingPatient.name
              : profile?.full_name || user.email}
          </div>
        </div>
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
                      margin={{ top: 8, right: 4, left: -28, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={G} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={G} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="t"
                        tick={{ fontSize: 9, fill: mu }}
                        tickLine={false}
                        axisLine={false}
                        interval={1}
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
                <div style={{ marginBottom: 24 }}>
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
                      fontSize: 13,
                      color: tx,
                      resize: "none",
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
                        fontSize: 14,
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
                <div style={{ marginBottom: 24 }}>
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
                      fontSize: 13,
                      color: tx,
                      resize: "none",
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
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "9px 0",
                          borderBottom: `1px solid ${bd}`,
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
                          <div
                            style={{
                              fontSize: 13,
                              color: tx,
                              fontWeight: 500,
                            }}
                          >
                            {r.context}
                          </div>
                          <div
                            style={{ fontSize: 11, color: mu, marginTop: 2 }}
                          >
                            {fmt(r.recorded_at)}
                          </div>
                          {r.note && (
                            <div
                              style={{ fontSize: 11, color: mu, marginTop: 2 }}
                            >
                              {r.note}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            textAlign: "right",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontSize: 20,
                                fontWeight: 700,
                                color: s.color,
                              }}
                            >
                              {r.value}
                            </span>
                            <span
                              style={{ fontSize: 10, color: mu, marginLeft: 4 }}
                            >
                              mg/dL
                            </span>
                          </div>
                          {canDelete && (
                            <button
                              onClick={() => {
                                if (confirm("¿Borrar este registro?"))
                                  deleteGlucose(r.id);
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 16,
                                padding: 4,
                                color: "#FCA5A5",
                              }}
                            >
                              🗑
                            </button>
                          )}
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
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "9px 0",
                          borderBottom: `1px solid ${bd}`,
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
                          <div
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 18,
                                fontWeight: 700,
                                color: s.color,
                              }}
                            >
                              {r.systolic}
                            </span>
                            <span style={{ fontSize: 13, color: mu }}>/</span>
                            <span
                              style={{
                                fontSize: 15,
                                fontWeight: 600,
                                color: s.color,
                              }}
                            >
                              {r.diastolic}
                            </span>
                            <span style={{ fontSize: 10, color: mu }}>
                              mmHg
                            </span>
                          </div>
                          <div
                            style={{ fontSize: 11, color: mu, marginTop: 2 }}
                          >
                            {r.arm}
                            {r.pulse ? ` · ${r.pulse} lpm` : ""} ·{" "}
                            {fmt(r.recorded_at)}
                          </div>
                          {r.note && (
                            <div
                              style={{ fontSize: 11, color: mu, marginTop: 2 }}
                            >
                              {r.note}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
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
                          {canDelete && (
                            <button
                              onClick={() => {
                                if (confirm("¿Borrar este registro?"))
                                  deleteBP(r.id);
                              }}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 16,
                                padding: 4,
                                color: "#FCA5A5",
                              }}
                            >
                              🗑
                            </button>
                          )}
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
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: tx,
                  marginBottom: 4,
                }}
              >
                Rangos de glucosa
              </div>
              <div style={{ fontSize: 12, color: mu, marginBottom: 20 }}>
                Personaliza los umbrales según tu tratamiento
              </div>
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
                <div
                  style={{
                    fontSize: 10,
                    color: mu,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                >
                  Vista previa
                </div>
                <div
                  style={{
                    height: 20,
                    borderRadius: 10,
                    overflow: "hidden",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      width: `${((draftCfg.hypo - 40) / 360) * 100}%`,
                      background: "#FEE2E2",
                    }}
                  />
                  <div
                    style={{
                      width: `${((draftCfg.target_high - draftCfg.hypo) / 360) * 100}%`,
                      background: "#D1FAE5",
                    }}
                  />
                  <div
                    style={{
                      width: `${((draftCfg.high - draftCfg.target_high) / 360) * 100}%`,
                      background: "#FEF3C7",
                    }}
                  />
                  <div style={{ flex: 1, background: "#FEE2E2" }} />
                </div>
              </div>
            </div>

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
                marginBottom: 12,
              }}
            >
              {cfgSaved ? "✓ Guardado" : "Guardar configuración"}
            </button>

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
    </div>
  );
}
