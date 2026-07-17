import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart, Line, ReferenceArea, ReferenceLine,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { supabase } from "../lib/supabase";
import { useSwipe } from "../hooks/useSwipe";
import { getGluStatus, getBPStatus } from "../utils/analysis";

const G = "#059669",
  tx = "#111827",
  mu = "#6B7280",
  bd = "#E5E7EB",
  bg = "#F4F2ED",
  wh = "#FFFFFF";

const RANGES = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "45 días", days: 45 },
  { label: "60 días", days: 60 },
  { label: "90 días", days: 90 },
  { label: "180 días", days: 180 },
];

const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function fmtDate(d) {
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDT(isoStr) {
  const d = new Date(isoStr);
  const day = d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${h}:${m}`;
}

function toChartLabel(isoStr) {
  const d = new Date(isoStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// ─── Sub-components (module level) ───────────────────────────────────────────

function Section({ title, accent, className, children }) {
  return (
    <div className={className ? `${className} report-section` : "report-section"} style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 4, height: 20, background: accent, borderRadius: 2 }} />
        <span style={{ fontSize: 17, fontWeight: 700, color: tx }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, unit, color }) {
  return (
    <div className="stat-card" style={{
      flex: "1 1 100px",
      background: wh,
      borderBottom: `2px solid ${bd}`,
      padding: "8px 10px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 9, color: mu, fontWeight: 600, letterSpacing: 0.3, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {unit && <div style={{ fontSize: 10, color: mu, marginTop: 2 }}>{unit}</div>}
    </div>
  );
}

function DistBar({ segments }) {
  const active = segments.filter((s) => s.pct > 0);
  if (!active.length) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: mu, textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>
        Distribución de lecturas
      </div>
      <div style={{ display: "flex", height: 20, borderRadius: 6, overflow: "hidden", marginBottom: 6 }}>
        {active.map((s, i) => (
          <div key={i} style={{ width: `${s.pct}%`, background: s.color, display: "flex", alignItems: "center", justifyContent: "center", borderRight: i < active.length - 1 ? "1px solid rgba(255,255,255,.5)" : "none" }}>
            {s.pct >= 10 && (
              <span style={{ fontSize: 10, color: wh, fontWeight: 700 }}>{Math.round(s.pct)}%</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 14px" }}>
        {active.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: mu }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function GlucoseChart({ data, cfg }) {
  if (!data.length) return null;
  // data sorted desc; reverse to chronological order
  const chartData = [...data].reverse().map((r) => ({
    t: toChartLabel(r.recorded_at),
    v: r.value,
  }));
  const vals = chartData.map((d) => d.v);
  const yMin = Math.max(30, Math.min(...vals) - 20);
  const yMax = Math.min(400, Math.max(...vals) + 30);
  const tickInterval = Math.max(0, Math.floor(chartData.length / 7) - 1);

  return (
    <div style={{ background: wh, border: `1px solid ${bd}`, borderRadius: 10, padding: "12px 8px 8px", marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: mu, textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5, marginBottom: 6, paddingLeft: 8 }}>
        Tendencia de glucosa ({data.length} registros)
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 30, left: 0, bottom: 0 }}>
          {/* Colored background zones */}
          <ReferenceArea y1={yMin} y2={Math.min(cfg.hypo, yMax)} fill="#FEE2E2" fillOpacity={0.65} ifOverflow="hidden" />
          <ReferenceArea y1={Math.max(cfg.hypo, yMin)} y2={Math.min(cfg.target_high, yMax)} fill="#DCFCE7" fillOpacity={0.6} ifOverflow="hidden" />
          <ReferenceArea y1={Math.max(cfg.target_high, yMin)} y2={Math.min(cfg.high, yMax)} fill="#FEF9C3" fillOpacity={0.65} ifOverflow="hidden" />
          <ReferenceArea y1={Math.max(cfg.high, yMin)} y2={yMax} fill="#FEE2E2" fillOpacity={0.5} ifOverflow="hidden" />
          {cfg.hypo >= yMin && cfg.hypo <= yMax && (
            <ReferenceLine y={cfg.hypo} stroke="#DC2626" strokeDasharray="4 3" strokeWidth={1}
              label={{ value: `${cfg.hypo}`, position: "insideRight", fontSize: 9, fill: "#DC2626" }} />
          )}
          {cfg.target_high >= yMin && cfg.target_high <= yMax && (
            <ReferenceLine y={cfg.target_high} stroke="#D97706" strokeDasharray="4 3" strokeWidth={1}
              label={{ value: `${cfg.target_high}`, position: "insideRight", fontSize: 9, fill: "#D97706" }} />
          )}
          {cfg.high >= yMin && cfg.high <= yMax && (
            <ReferenceLine y={cfg.high} stroke="#B91C1C" strokeDasharray="4 3" strokeWidth={1}
              label={{ value: `${cfg.high}`, position: "insideRight", fontSize: 9, fill: "#B91C1C" }} />
          )}
          <XAxis dataKey="t" tick={{ fontSize: 9, fill: mu }} tickLine={false} axisLine={false} interval={tickInterval} />
          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 9, fill: mu }} tickLine={false} axisLine={false} width={42} tickFormatter={(v) => `${v}`} />
          <Tooltip
            formatter={(v) => [`${v} mg/dL`, "Glucosa"]}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${bd}` }}
          />
          <Line
            type="monotone" dataKey="v" stroke={G} strokeWidth={2}
            dot={{ r: 2.5, fill: G, strokeWidth: 0 }}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 14px", paddingLeft: 8 }}>
        {[
          { color: "#FEE2E2", border: "#DC2626", label: `Hipoglucemia (<${cfg.hypo})` },
          { color: "#DCFCE7", border: "#059669", label: `En rango (${cfg.hypo}–${cfg.target_high})` },
          { color: "#FEF9C3", border: "#D97706", label: `Elevada (${cfg.target_high}–${cfg.high})` },
          { color: "#FECACA", border: "#B91C1C", label: `Muy elevada (>${cfg.high})` },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: mu }}>
            <div style={{ width: 12, height: 10, background: item.color, border: `1px solid ${item.border}`, borderRadius: 2 }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function BPChart({ data }) {
  if (!data.length) return null;
  const chartData = [...data].reverse().map((r) => ({
    t: toChartLabel(r.recorded_at),
    sys: r.systolic,
    dia: r.diastolic,
  }));
  const allVals = chartData.flatMap((d) => [d.sys, d.dia]);
  const yMin = Math.max(40, Math.min(...allVals) - 10);
  const yMax = Math.min(240, Math.max(...allVals) + 15);
  const tickInterval = Math.max(0, Math.floor(chartData.length / 7) - 1);

  return (
    <div style={{ background: wh, border: `1px solid ${bd}`, borderRadius: 10, padding: "12px 8px 8px", marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: mu, textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5, marginBottom: 6, paddingLeft: 8 }}>
        Tendencia de presión arterial ({data.length} registros)
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
          {/* Normal zone */}
          <ReferenceArea y1={yMin} y2={Math.min(80, yMax)} fill="#DCFCE7" fillOpacity={0.4} ifOverflow="hidden" />
          {/* Threshold lines */}
          {130 >= yMin && 130 <= yMax && (
            <ReferenceLine y={130} stroke="#D97706" strokeDasharray="4 3" strokeWidth={1}
              label={{ value: "130", position: "right", fontSize: 9, fill: "#D97706" }} />
          )}
          {140 >= yMin && 140 <= yMax && (
            <ReferenceLine y={140} stroke="#EA580C" strokeDasharray="4 3" strokeWidth={1}
              label={{ value: "140", position: "right", fontSize: 9, fill: "#EA580C" }} />
          )}
          {180 >= yMin && 180 <= yMax && (
            <ReferenceLine y={180} stroke="#DC2626" strokeDasharray="4 3" strokeWidth={1}
              label={{ value: "180", position: "right", fontSize: 9, fill: "#DC2626" }} />
          )}
          <XAxis dataKey="t" tick={{ fontSize: 9, fill: mu }} tickLine={false} axisLine={false} interval={tickInterval} />
          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 9, fill: mu }} tickLine={false} axisLine={false} width={42} />
          <Tooltip
            formatter={(v, name) => [`${v} mmHg`, name === "sys" ? "Sistólica" : "Diastólica"]}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${bd}` }}
          />
          <Line type="monotone" dataKey="sys" name="sys" stroke="#7C3AED" strokeWidth={2}
            dot={{ r: 2.5, fill: "#7C3AED", strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0 }} />
          <Line type="monotone" dataKey="dia" name="dia" stroke="#A78BFA" strokeWidth={2}
            dot={{ r: 2.5, fill: "#A78BFA", strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0 }} />
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 14px", paddingLeft: 8 }}>
        {[
          { el: <div style={{ width: 16, height: 2, background: "#7C3AED", borderRadius: 1 }} />, label: "Sistólica" },
          { el: <div style={{ width: 16, height: 2, background: "#A78BFA", borderRadius: 1 }} />, label: "Diastólica" },
          { el: <div style={{ width: 16, height: 0, borderTop: "2px dashed #D97706" }} />, label: "130 (Elevada)" },
          { el: <div style={{ width: 16, height: 0, borderTop: "2px dashed #EA580C" }} />, label: "140 (HTA1)" },
          { el: <div style={{ width: 16, height: 0, borderTop: "2px dashed #DC2626" }} />, label: "180 (Crisis)" },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: mu }}>
            {item.el}
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadingsTable({ rows, headers }) {
  if (!rows.length) return null;
  return (
    <div style={{ overflowX: "auto", marginTop: 4 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{
                textAlign: "left", padding: "6px 8px",
                background: "#F9FAFB", borderBottom: `1px solid ${bd}`,
                fontWeight: 600, color: mu, fontSize: 11,
                textTransform: "uppercase", letterSpacing: 0.3,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#F9FAFB" : wh }}>
              <td style={{ padding: "5px 8px", color: mu, borderBottom: `1px solid ${bd}` }}>{r.date}</td>
              <td style={{ padding: "5px 8px", fontWeight: 700, color: r.color, borderBottom: `1px solid ${bd}` }}>{r.value}</td>
              <td style={{ padding: "5px 8px", color: mu, borderBottom: `1px solid ${bd}` }}>{r.extra}</td>
              <td style={{ padding: "5px 8px", color: mu, borderBottom: `1px solid ${bd}` }}>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ReportScreen({ userId, profile, viewingPatient, onSwipeScreen }) {
  const targetUserId = viewingPatient?.id || userId;
  const patientName = viewingPatient?.name || profile?.full_name || "Paciente";

  const cfg = {
    hypo: profile?.glucose_hypo ?? 70,
    target_high: profile?.glucose_target_high ?? 140,
    high: profile?.glucose_high ?? 180,
  };

  const [rangeDays, setRangeDays] = useState(30);
  const [showGlu, setShowGlu] = useState(true);
  const [showBP, setShowBP] = useState(true);
  const [gluData, setGluData] = useState([]);
  const [bpData, setBpData] = useState([]);
  const [loading, setLoading] = useState(true);

  const swipeHandlers = useSwipe(onSwipeScreen);

  useEffect(() => {
    if (!targetUserId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
    Promise.all([
      supabase
        .from("glucose_readings")
        .select("*")
        .eq("user_id", targetUserId)
        .gte("recorded_at", from)
        .order("recorded_at", { ascending: false }),
      supabase
        .from("bp_readings")
        .select("*")
        .eq("user_id", targetUserId)
        .gte("recorded_at", from)
        .order("recorded_at", { ascending: false }),
    ]).then(([{ data: glu }, { data: bp }]) => {
      setGluData(glu || []);
      setBpData(bp || []);
      setLoading(false);
    });
  }, [targetUserId, rangeDays]);

  // Glucose statistics
  const gluStats = (() => {
    if (!gluData.length) return null;
    const vals = gluData.map((r) => r.value);
    const n = vals.length;
    const avg = vals.reduce((a, b) => a + b, 0) / n;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const hypo = vals.filter((v) => v < cfg.hypo).length;
    const inRange = vals.filter((v) => v >= cfg.hypo && v <= cfg.target_high).length;
    const elevated = vals.filter((v) => v > cfg.target_high && v <= cfg.high).length;
    const veryHigh = vals.filter((v) => v > cfg.high).length;
    const stddev = Math.sqrt(vals.reduce((a, v) => a + (v - avg) ** 2, 0) / n);
    return { n, avg, min, max, hypo, inRange, elevated, veryHigh, stddev };
  })();

  // Blood pressure statistics
  const bpStats = (() => {
    if (!bpData.length) return null;
    const n = bpData.length;
    const avgSys = bpData.reduce((a, r) => a + r.systolic, 0) / n;
    const avgDia = bpData.reduce((a, r) => a + r.diastolic, 0) / n;
    const dist = { normal: 0, elevated: 0, hta1: 0, hta2: 0, crisis: 0 };
    bpData.forEach((r) => {
      const g = getBPStatus(r.systolic, r.diastolic).grade;
      if (g === 0) dist.normal++;
      else if (g === 1) dist.elevated++;
      else if (g === 2) dist.hta1++;
      else if (g === 3) dist.hta2++;
      else dist.crisis++;
    });
    return { n, avgSys, avgDia, dist };
  })();

  const today = useMemo(() => new Date(), []);
  const fromDate = useMemo(() => new Date(today.getTime() - rangeDays * 24 * 60 * 60 * 1000), [today, rangeDays]);

  const gluAvgStatus = gluStats ? getGluStatus(Math.round(gluStats.avg), cfg) : null;
  const bpAvgStatus = bpStats ? getBPStatus(Math.round(bpStats.avgSys), Math.round(bpStats.avgDia)) : null;

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,sans-serif", minHeight: "100dvh", background: bg }} {...swipeHandlers}>
      {/* Print styles injected only while this screen is mounted */}
      <style>{`
        @media print {
          .bottom-nav { display: none !important; }
          .report-toolbar { display: none !important; }
          body { background: white !important; }
          @page { size: A4; margin: 1.5cm; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .report-body { max-width: 100% !important; width: 100% !important; overflow: hidden !important; }
          .stat-card-row { page-break-inside: avoid; }
          .recharts-wrapper { page-break-inside: avoid; width: 100% !important; }
          .recharts-reference-area rect { fill-opacity: 0.1 !important; }
          .ranges-info { background: transparent !important; border: 1px solid #9CA3AF !important; }
          .bp-section { page-break-before: always; }
          th { background: #F3F4F6 !important; }
        }
      `}</style>

      {/* Toolbar (hidden on print) */}
      <div className="report-toolbar" style={{
        position: "sticky", top: 0, zIndex: 10,
        background: wh, borderBottom: `1px solid ${bd}`,
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", flexWrap: "wrap",
      }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: tx, marginRight: 4 }}>Informe médico</span>
        <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }}>
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              style={{
                padding: "5px 11px", borderRadius: 20,
                border: `1.5px solid ${rangeDays === r.days ? G : bd}`,
                background: rangeDays === r.days ? "#ECFDF5" : wh,
                color: rangeDays === r.days ? G : mu,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { label: "Glucosa", active: showGlu, toggle: () => setShowGlu((v) => !v), activeColor: G, activeBg: "#ECFDF5" },
            { label: "Presión", active: showBP, toggle: () => setShowBP((v) => !v), activeColor: "#7C3AED", activeBg: "#F5F3FF" },
          ].map(({ label, active, toggle, activeColor, activeBg }) => (
            <button
              key={label}
              onClick={toggle}
              style={{
                padding: "5px 11px", borderRadius: 20,
                border: `1.5px solid ${active ? activeColor : bd}`,
                background: active ? activeBg : wh,
                color: active ? activeColor : mu,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {active ? "✓ " : ""}{label}
            </button>
          ))}
        </div>
        <button
          onClick={() => window.print()}
          style={{
            padding: "7px 18px", borderRadius: 8, border: "none",
            background: G, color: wh, fontWeight: 600, fontSize: 13,
            cursor: "pointer", WebkitTapHighlightColor: "transparent",
            whiteSpace: "nowrap",
          }}
        >
          Imprimir / PDF
        </button>
      </div>

      {/* Report body */}
      <div className="report-body" style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 40px" }}>

        {/* Report header */}
        <div style={{ marginBottom: 24, borderBottom: `3px solid ${G}`, paddingBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: tx }}>{patientName}</div>
              <div style={{ fontSize: 13, color: mu, marginTop: 4 }}>
                {fmtDate(fromDate)} — {fmtDate(today)} · {rangeDays} días
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 12, color: mu }}>
              <div style={{ fontWeight: 800, color: G, fontSize: 15, marginBottom: 2 }}>KuXtaL</div>
              <div>Generado: {fmtDate(today)}</div>
              <div style={{ marginTop: 6, color: tx }}>Médico: ________________________</div>
            </div>
          </div>
          <div className="ranges-info" style={{ marginTop: 12, fontSize: 11, color: mu, background: "#F9FAFB", border: `1px solid ${bd}`, borderRadius: 6, padding: "6px 10px" }}>
            Rangos personalizados — Hipoglucemia: &lt;{cfg.hypo} mg/dL · Meta: {cfg.hypo}–{cfg.target_high} mg/dL · Elevada: {cfg.target_high}–{cfg.high} mg/dL · Muy elevada: &gt;{cfg.high} mg/dL
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", color: mu, padding: "60px 0", fontSize: 14 }}>
            Cargando datos del período...
          </div>
        )}

        {!loading && (
          <>
            {/* ── GLUCOSE ── */}
            {showGlu && <Section title="Glucosa en sangre" accent={G}>
              {!gluStats ? (
                <div style={{ color: mu, fontSize: 13, padding: "12px 0" }}>Sin registros de glucosa en este período.</div>
              ) : (
                <>
                  <div className="stat-card-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <StatCard label="Promedio" value={Math.round(gluStats.avg)} unit="mg/dL" color={gluAvgStatus.color} />
                    <StatCard
                      label="Tiempo en rango"
                      value={`${Math.round((gluStats.inRange / gluStats.n) * 100)}%`}
                      unit={`${gluStats.inRange} de ${gluStats.n} lect.`}
                      color={G}
                    />
                    <StatCard
                      label="Hipoglucemias"
                      value={`${Math.round((gluStats.hypo / gluStats.n) * 100)}%`}
                      unit={`${gluStats.hypo} episodios`}
                      color={gluStats.hypo > 0 ? "#DC2626" : mu}
                    />
                    <StatCard label="Variabilidad (DE)" value={Math.round(gluStats.stddev)} unit="mg/dL" color={tx} />
                  </div>
                  <div className="stat-card-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    <StatCard label="Mínimo" value={gluStats.min} unit="mg/dL" color={gluStats.min < cfg.hypo ? "#DC2626" : tx} />
                    <StatCard label="Máximo" value={gluStats.max} unit="mg/dL" color={gluStats.max > cfg.high ? "#DC2626" : tx} />
                    <StatCard label="Total registros" value={gluStats.n} unit="en el período" color={tx} />
                  </div>
                  <GlucoseChart data={gluData} cfg={cfg} />
                  <DistBar segments={[
                    { pct: (gluStats.hypo / gluStats.n) * 100, color: "#DC2626", label: `Hipoglucemia ${Math.round((gluStats.hypo / gluStats.n) * 100)}%` },
                    { pct: (gluStats.inRange / gluStats.n) * 100, color: "#059669", label: `En rango ${Math.round((gluStats.inRange / gluStats.n) * 100)}%` },
                    { pct: (gluStats.elevated / gluStats.n) * 100, color: "#D97706", label: `Elevada ${Math.round((gluStats.elevated / gluStats.n) * 100)}%` },
                    { pct: (gluStats.veryHigh / gluStats.n) * 100, color: "#B91C1C", label: `Muy elevada ${Math.round((gluStats.veryHigh / gluStats.n) * 100)}%` },
                  ]} />
                  <ReadingsTable
                    headers={["Fecha / Hora", "Glucosa", "Contexto", "Nota"]}
                    rows={gluData.slice(0, 60).map((r) => ({
                      date: fmtDT(r.recorded_at),
                      value: `${r.value} mg/dL`,
                      color: getGluStatus(r.value, cfg).color,
                      extra: r.context || "",
                      note: r.note || "",
                    }))}
                  />
                </>
              )}
            </Section>}

            {/* ── BLOOD PRESSURE ── */}
            {showBP && <Section title="Presión arterial" accent="#7C3AED" className={showGlu ? "bp-section" : undefined}>
              {!bpStats ? (
                <div style={{ color: mu, fontSize: 13, padding: "12px 0" }}>Sin registros de presión en este período.</div>
              ) : (
                <>
                  <div className="stat-card-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    <StatCard label="Promedio sistólica" value={`${Math.round(bpStats.avgSys)}`} unit="mmHg" color={tx} />
                    <StatCard label="Promedio diastólica" value={`${Math.round(bpStats.avgDia)}`} unit="mmHg" color={tx} />
                    <StatCard
                      label="Clasificación media"
                      value={bpAvgStatus.label}
                      unit={`${Math.round(bpStats.avgSys)}/${Math.round(bpStats.avgDia)} mmHg`}
                      color={bpAvgStatus.color}
                    />
                    <StatCard label="Total registros" value={bpStats.n} unit="en el período" color={tx} />
                  </div>
                  <BPChart data={bpData} />
                  <DistBar segments={[
                    { pct: (bpStats.dist.normal / bpStats.n) * 100, color: "#059669", label: `Normal ${Math.round((bpStats.dist.normal / bpStats.n) * 100)}%` },
                    { pct: (bpStats.dist.elevated / bpStats.n) * 100, color: "#D97706", label: `Elevada ${Math.round((bpStats.dist.elevated / bpStats.n) * 100)}%` },
                    { pct: (bpStats.dist.hta1 / bpStats.n) * 100, color: "#EA580C", label: `HTA Etapa 1 ${Math.round((bpStats.dist.hta1 / bpStats.n) * 100)}%` },
                    { pct: (bpStats.dist.hta2 / bpStats.n) * 100, color: "#DC2626", label: `HTA Etapa 2 ${Math.round((bpStats.dist.hta2 / bpStats.n) * 100)}%` },
                    { pct: (bpStats.dist.crisis / bpStats.n) * 100, color: "#7C3AED", label: `Crisis ${Math.round((bpStats.dist.crisis / bpStats.n) * 100)}%` },
                  ]} />
                  <ReadingsTable
                    headers={["Fecha / Hora", "Presión", "Pulso / Brazo", "Nota"]}
                    rows={bpData.slice(0, 60).map((r) => ({
                      date: fmtDT(r.recorded_at),
                      value: `${r.systolic}/${r.diastolic} mmHg`,
                      color: getBPStatus(r.systolic, r.diastolic).color,
                      extra: [r.pulse ? `${r.pulse} lpm` : "", r.arm || ""].filter(Boolean).join(" · "),
                      note: r.note || "",
                    }))}
                  />
                </>
              )}
            </Section>}
          </>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 32, paddingTop: 14, borderTop: `1px solid ${bd}`,
          fontSize: 11, color: mu,
          display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4,
        }}>
          <span>KuXtaL — Monitoreo de salud familiar</span>
          <span>Período: últimos {rangeDays} días · Generado: {fmtDate(today)}</span>
        </div>
      </div>
    </div>
  );
}
