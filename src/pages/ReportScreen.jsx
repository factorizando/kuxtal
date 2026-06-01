import { useState, useEffect, useMemo } from "react";
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
  { label: "90 días", days: 90 },
  { label: "180 días", days: 180 },
];

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

// ─── Sub-components (module level) ───────────────────────────────────────────

function Section({ title, accent, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
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
    <div style={{
      flex: "1 1 90px",
      background: wh,
      border: `1px solid ${bd}`,
      borderRadius: 10,
      padding: "10px 12px",
    }}>
      <div style={{ fontSize: 10, color: mu, textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {unit && <div style={{ fontSize: 11, color: mu, marginTop: 3 }}>{unit}</div>}
    </div>
  );
}

function DistBar({ segments }) {
  const active = segments.filter((s) => s.pct > 0);
  if (!active.length) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 6 }}>
        {active.map((s, i) => (
          <div key={i} style={{ width: `${s.pct}%`, background: s.color }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px" }}>
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
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 40px" }}>

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
          <div style={{ marginTop: 12, fontSize: 11, color: mu, background: "#F9FAFB", border: `1px solid ${bd}`, borderRadius: 6, padding: "6px 10px" }}>
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
            <Section title="Glucosa en sangre" accent={G}>
              {!gluStats ? (
                <div style={{ color: mu, fontSize: 13, padding: "12px 0" }}>Sin registros de glucosa en este período.</div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <StatCard
                      label="Promedio"
                      value={Math.round(gluStats.avg)}
                      unit="mg/dL"
                      color={gluAvgStatus.color}
                    />
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
                    <StatCard
                      label="Variabilidad (DE)"
                      value={Math.round(gluStats.stddev)}
                      unit="mg/dL"
                      color={tx}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    <StatCard label="Mínimo" value={gluStats.min} unit="mg/dL" color={gluStats.min < cfg.hypo ? "#DC2626" : tx} />
                    <StatCard label="Máximo" value={gluStats.max} unit="mg/dL" color={gluStats.max > cfg.high ? "#DC2626" : tx} />
                    <StatCard label="Total registros" value={gluStats.n} unit="en el período" color={tx} />
                  </div>
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
            </Section>

            {/* ── BLOOD PRESSURE ── */}
            <Section title="Presión arterial" accent="#7C3AED">
              {!bpStats ? (
                <div style={{ color: mu, fontSize: 13, padding: "12px 0" }}>Sin registros de presión en este período.</div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    <StatCard
                      label="Promedio sistólica"
                      value={`${Math.round(bpStats.avgSys)}`}
                      unit="mmHg"
                      color={tx}
                    />
                    <StatCard
                      label="Promedio diastólica"
                      value={`${Math.round(bpStats.avgDia)}`}
                      unit="mmHg"
                      color={tx}
                    />
                    <StatCard
                      label="Clasificación media"
                      value={bpAvgStatus.label}
                      unit={`${Math.round(bpStats.avgSys)}/${Math.round(bpStats.avgDia)} mmHg`}
                      color={bpAvgStatus.color}
                    />
                    <StatCard label="Total registros" value={bpStats.n} unit="en el período" color={tx} />
                  </div>
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
            </Section>
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
