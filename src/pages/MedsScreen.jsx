import { useState, useMemo } from "react";
import { useFamily } from "../hooks/useFamily";
import { useInventory } from "../hooks/useInventory";
import { useMedications } from "../hooks/useMedications";
import { useSwipe } from "../hooks/useSwipe";
import Sheet from "../components/Sheet";
import {
  buildTodayDoses,
  asNeededSchedules,
  frequencyLabel,
  DOW_LABELS,
} from "../utils/medications";

const G = "#059669",
  mu = "#6B7280",
  bd = "#E5E7EB",
  wh = "#FFFFFF",
  bg = "#F4F2ED",
  rd = "#EF4444",
  am = "#D97706",
  bl = "#2563EB";

const UNITS = [
  "tabletas",
  "cápsulas",
  "sobres",
  "mL",
  "unidades",
  "tiras",
  "lancetas",
  "jeringas",
  "plumas",
  "frascos",
  "cajas",
];

const inputSt = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${bd}`,
  borderRadius: 8,
  fontSize: 15,
  color: "#111827",
  background: "#FAFAFA",
  outline: "none",
  boxSizing: "border-box",
};

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function nowTimeStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Suma n días a una fecha "YYYY-MM-DD" (en local) y devuelve "YYYY-MM-DD".
function addDaysStr(startStr, n) {
  const [y, m, d] = startStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  const p = (x) => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

// Días inclusivos entre dos fechas "YYYY-MM-DD" (ambos extremos cuentan).
function durationBetween(startStr, endStr) {
  const [ys, ms, ds] = startStr.split("-").map(Number);
  const [ye, me, de] = endStr.split("-").map(Number);
  const a = new Date(ys, ms - 1, ds);
  const b = new Date(ye, me - 1, de);
  return Math.round((b - a) / 86400000) + 1;
}

// Deriva end_date a partir de durationDays (vacío = indefinido).
function formWithEndDate(f) {
  const days = parseInt(f.durationDays, 10);
  const endDate = days && days > 0 ? addDaysStr(f.startDate, days - 1) : null;
  return { ...f, endDate };
}

function fmtDose(dose, unit) {
  const n = Number(dose);
  const txt = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return unit ? `${txt} ${unit}` : txt;
}

function card() {
  return {
    background: wh,
    borderRadius: 12,
    padding: 14,
    boxShadow: "0 1px 4px rgba(0,0,0,.06)",
  };
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          color: mu,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// Forma vacía de pauta para el formulario
function emptyScheduleForm(startDate) {
  return {
    itemId: "",
    dose: "",
    frequencyType: "daily",
    intervalDays: "2",
    daysOfWeek: [],
    times: ["08:00"],
    startDate: startDate || todayStr(),
    durationDays: "",
    notes: "",
  };
}

// Convierte una pauta de la BD al formato del formulario
function scheduleToForm(s) {
  return {
    itemId: s.item_id,
    dose: String(s.dose),
    frequencyType: s.frequency_type,
    intervalDays: String(s.interval_days || 2),
    daysOfWeek: s.days_of_week || [],
    times: (s.times || []).length ? [...s.times] : ["08:00"],
    startDate: s.start_date,
    durationDays: s.end_date ? String(durationBetween(s.start_date, s.end_date)) : "",
    notes: s.notes || "",
  };
}

// Editor de horarios (lista de "HH:MM")
function TimesEditor({ times, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {times.map((t, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="time"
            value={t}
            onChange={(e) => {
              const next = [...times];
              next[i] = e.target.value;
              onChange(next);
            }}
            style={{ ...inputSt, flex: 1 }}
          />
          {times.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(times.filter((_, j) => j !== i))}
              style={{ background: "none", border: `1px solid ${bd}`, borderRadius: 8, padding: "8px 12px", color: rd, cursor: "pointer", fontSize: 16 }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...times, "20:00"])}
        style={{ background: "none", border: `1px dashed ${bd}`, borderRadius: 8, padding: "8px", color: mu, cursor: "pointer", fontSize: 13 }}
      >
        + Agregar horario
      </button>
    </div>
  );
}

// Formulario reutilizable de pauta. form/onChange controlados por el padre.
// onCreateItem({ name, unit }) crea un medicamento nuevo en el inventario y
// devuelve el item creado (para ligar la pauta sin haberlo comprado aún).
function ScheduleForm({ form, onChange, items, lockItem = false, onCreateItem }) {
  const update = (patch) => onChange({ ...form, ...patch });
  const selectedItem = items.find((it) => it.id === form.itemId);

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("tabletas");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState(null);
  const creatingNew = form.itemId === "__new__";

  async function handleCreate() {
    if (!newName.trim()) { setCreateErr("Escribe el nombre del medicamento."); return; }
    setCreating(true); setCreateErr(null);
    try {
      const item = await onCreateItem({ name: newName, unit: newUnit });
      update({ itemId: item.id });
      setNewName("");
    } catch (e) {
      setCreateErr(e.message || "Error al crear el medicamento");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {!lockItem && (
        <Field label="Medicamento">
          <select
            value={form.itemId}
            onChange={(e) => update({ itemId: e.target.value })}
            style={inputSt}
          >
            <option value="">Selecciona…</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
            {onCreateItem && <option value="__new__">➕ Crear nuevo medicamento…</option>}
          </select>
        </Field>
      )}

      {creatingNew && onCreateItem && (
        <div style={{ border: `1px dashed ${bd}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: mu, marginBottom: 10 }}>
            Nuevo medicamento (se agrega al inventario con stock 0).
          </div>
          <Field label="Nombre">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej. Metformina 850 mg"
              style={inputSt}
            />
          </Field>
          <Field label="Unidad">
            <select value={newUnit} onChange={(e) => setNewUnit(e.target.value)} style={inputSt}>
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </Field>
          {createErr && <div style={{ color: rd, fontSize: 13, marginBottom: 10 }}>{createErr}</div>}
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            style={{ background: G, color: wh, border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%", opacity: creating ? 0.6 : 1 }}
          >
            {creating ? "Creando…" : "Crear medicamento"}
          </button>
        </div>
      )}

      <Field label={`Dosis por toma${selectedItem ? ` (${selectedItem.unit})` : ""}`}>
        <input
          type="number"
          inputMode="decimal"
          step="0.001"
          min="0"
          value={form.dose}
          onChange={(e) => update({ dose: e.target.value })}
          placeholder="Ej. 1"
          style={inputSt}
        />
      </Field>

      <Field label="Frecuencia">
        <select
          value={form.frequencyType}
          onChange={(e) => update({ frequencyType: e.target.value })}
          style={inputSt}
        >
          <option value="daily">Todos los días</option>
          <option value="every_n_days">Cada N días</option>
          <option value="days_of_week">Días de la semana</option>
          <option value="as_needed">Según necesidad</option>
        </select>
      </Field>

      {form.frequencyType === "every_n_days" && (
        <Field label="Cada cuántos días">
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={form.intervalDays}
            onChange={(e) => update({ intervalDays: e.target.value })}
            style={inputSt}
          />
        </Field>
      )}

      {form.frequencyType === "days_of_week" && (
        <Field label="Días">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {DOW_LABELS.map((lbl, idx) => {
              const on = form.daysOfWeek.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    update({
                      daysOfWeek: on
                        ? form.daysOfWeek.filter((d) => d !== idx)
                        : [...form.daysOfWeek, idx],
                    })
                  }
                  style={{
                    border: `1px solid ${on ? G : bd}`,
                    background: on ? "#ECFDF5" : wh,
                    color: on ? G : mu,
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 13,
                    fontWeight: on ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {form.frequencyType !== "as_needed" && (
        <Field label="Horarios">
          <TimesEditor times={form.times} onChange={(times) => update({ times })} />
        </Field>
      )}

      <Field label="Inicio">
        <input
          type="date"
          value={form.startDate}
          onChange={(e) => update({ startDate: e.target.value })}
          style={inputSt}
        />
      </Field>

      <Field label="Duración (días)">
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={form.durationDays}
          onChange={(e) => update({ durationDays: e.target.value })}
          placeholder="Indefinido"
          style={inputSt}
        />
        {form.durationDays && Number(form.durationDays) >= 1 && form.startDate && (
          <div style={{ fontSize: 12, color: mu, marginTop: 4 }}>
            Termina el {fmtDate(addDaysStr(form.startDate, Number(form.durationDays) - 1))}
          </div>
        )}
      </Field>

      <Field label="Notas (opcional)">
        <input
          type="text"
          value={form.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Ej. con alimentos"
          style={inputSt}
        />
      </Field>
    </div>
  );
}

// Fila de toma del día
function DoseRow({ row, onTap }) {
  const taken = !!row.takenIntake;
  return (
    <button
      onClick={onTap}
      style={{
        ...card(),
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        textAlign: "left",
        border: "none",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        opacity: taken ? 0.7 : 1,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: taken ? "#ECFDF5" : "#F3F4F6",
          color: taken ? G : "#111827",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {row.time}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#111827",
            textDecoration: taken ? "line-through" : "none",
          }}
        >
          {row.itemName}
        </div>
        <div style={{ fontSize: 13, color: mu }}>{fmtDose(row.dose, row.unit)}</div>
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: taken ? G : bl,
          flexShrink: 0,
        }}
      >
        {taken ? "✓ Tomada" : "Marcar ›"}
      </span>
    </button>
  );
}

function ScheduleCard({ schedule, onTap }) {
  const item = schedule.inventory_item || {};
  return (
    <button
      onClick={onTap}
      style={{
        ...card(),
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        textAlign: "left",
        border: "none",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{item.name}</div>
        <div style={{ fontSize: 13, color: mu, marginTop: 2 }}>
          {fmtDose(schedule.dose, item.unit)} · {frequencyLabel(schedule)}
        </div>
        {(schedule.times || []).length > 0 && (
          <div style={{ fontSize: 12, color: mu, marginTop: 2 }}>
            🕐 {schedule.times.join(" · ")}
          </div>
        )}
      </div>
      <span style={{ fontSize: 12, color: mu, flexShrink: 0 }}>Ver detalle ›</span>
    </button>
  );
}

function ConsultationCard({ consultation, onTap }) {
  return (
    <button
      onClick={onTap}
      style={{
        ...card(),
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        textAlign: "left",
        border: "none",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ fontSize: 22 }}>🩺</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>
          {consultation.doctor || "Consulta médica"}
        </div>
        <div style={{ fontSize: 13, color: mu }}>{fmtDate(consultation.consultation_date)}</div>
      </div>
      <span style={{ fontSize: 12, color: mu, flexShrink: 0 }}>Ver detalle ›</span>
    </button>
  );
}

export default function MedsScreen({ userId, onSwipeScreen }) {
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => onSwipeScreen?.("left"),
    onSwipeRight: () => onSwipeScreen?.("right"),
  });

  const { groups, activeGroup, myRole, loading: groupLoading, selectGroup } = useFamily(userId);
  const { items: invItems, addItem } = useInventory(activeGroup?.id);
  const {
    schedules,
    consultations,
    intakes,
    loading,
    addSchedule,
    updateSchedule,
    suspendSchedule,
    markTaken,
    unmarkTaken,
    saveConsultation,
  } = useMedications(activeGroup?.id, userId);

  const canEdit = myRole === "admin" || myRole === "caregiver";
  const [medsTab, setMedsTab] = useState("hoy");
  const today = todayStr();

  // Sheets / formularios
  const [doseSheet, setDoseSheet] = useState(null); // fila de toma seleccionada
  const [scheduleDetail, setScheduleDetail] = useState(null);
  const [consultDetail, setConsultDetail] = useState(null);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [editSchedule, setEditSchedule] = useState(null);
  const [showConsult, setShowConsult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Formulario de pauta (nueva / edición)
  const [schedForm, setSchedForm] = useState(emptyScheduleForm());

  // Asistente de consulta
  const [consHeader, setConsHeader] = useState({ consultationDate: today, doctor: "", notes: "" });
  const [decisions, setDecisions] = useState({}); // scheduleId -> { action, fields }
  const [newScheds, setNewScheds] = useState([]); // [{ form }]

  const activeSchedules = useMemo(
    () => schedules.filter((s) => s.active),
    [schedules]
  );
  const todayDoses = useMemo(
    () => buildTodayDoses(schedules, intakes, today),
    [schedules, intakes, today]
  );
  const todayAsNeeded = useMemo(
    () => asNeededSchedules(schedules, today),
    [schedules, today]
  );

  // Crea un medicamento en el inventario sin stock (aún no comprado). El
  // consumption_per_day se ajustará después al guardar la pauta (recalc).
  async function createInventoryItem({ name, unit }) {
    return addItem({
      name,
      unit,
      consumptionPerDay: 1,
      currentQuantity: 0,
      alertThresholdDays: 14,
      createdBy: userId,
    });
  }

  function validateForm(f) {
    if (!f.itemId || f.itemId === "__new__") return "Selecciona o crea un medicamento.";
    if (!f.dose || Number(f.dose) <= 0) return "Indica la dosis por toma.";
    if (f.frequencyType === "days_of_week" && f.daysOfWeek.length === 0)
      return "Selecciona al menos un día.";
    if (f.frequencyType !== "as_needed" && f.times.length === 0)
      return "Agrega al menos un horario.";
    if (f.frequencyType === "every_n_days" && (!f.intervalDays || Number(f.intervalDays) < 1))
      return "Indica el intervalo de días.";
    if (f.durationDays && (!Number.isInteger(Number(f.durationDays)) || Number(f.durationDays) < 1))
      return "La duración debe ser un número de días válido.";
    return null;
  }

  function openAddSchedule() {
    setSchedForm(emptyScheduleForm());
    setErr(null);
    setShowAddSchedule(true);
  }

  async function handleAddSchedule() {
    const v = validateForm(schedForm);
    if (v) { setErr(v); return; }
    setBusy(true); setErr(null);
    try {
      await addSchedule(formWithEndDate(schedForm));
      setShowAddSchedule(false);
    } catch (e) {
      setErr(e.message || "Error al guardar la pauta");
    } finally {
      setBusy(false);
    }
  }

  function openEditSchedule(s) {
    setSchedForm(scheduleToForm(s));
    setEditSchedule(s);
    setScheduleDetail(null);
    setErr(null);
  }

  async function handleUpdateSchedule() {
    const v = validateForm(schedForm);
    if (v) { setErr(v); return; }
    setBusy(true); setErr(null);
    try {
      await updateSchedule(editSchedule.id, formWithEndDate(schedForm));
      setEditSchedule(null);
    } catch (e) {
      setErr(e.message || "Error al actualizar");
    } finally {
      setBusy(false);
    }
  }

  async function handleSuspend(s) {
    if (!confirm("¿Suspender esta pauta?")) return;
    setBusy(true);
    try {
      await suspendSchedule(s, today);
      setScheduleDetail(null);
    } catch (e) {
      alert(e.message || "Error al suspender");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleTaken(row) {
    setBusy(true);
    try {
      if (row.takenIntake) {
        await unmarkTaken(row.takenIntake.id);
      } else {
        await markTaken({
          scheduleId: row.scheduleId,
          itemId: row.itemId,
          date: today,
          time: row.time,
          dose: row.dose,
        });
      }
      setDoseSheet(null);
    } catch (e) {
      alert(e.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  async function handleTakeAsNeeded(s) {
    setBusy(true);
    try {
      await markTaken({
        scheduleId: s.id,
        itemId: s.item_id,
        date: today,
        time: nowTimeStr(),
        dose: s.dose,
      });
    } catch (e) {
      alert(e.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  // ── Asistente de consulta ───────────────────────────────────
  function openConsult() {
    setConsHeader({ consultationDate: today, doctor: "", notes: "" });
    const init = {};
    for (const s of activeSchedules) init[s.id] = { action: "keep", fields: scheduleToForm(s) };
    setDecisions(init);
    setNewScheds([]);
    setErr(null);
    setShowConsult(true);
  }

  function setDecisionAction(scheduleId, action) {
    setDecisions((prev) => ({
      ...prev,
      [scheduleId]: { ...prev[scheduleId], action },
    }));
  }

  function setDecisionFields(scheduleId, fields) {
    setDecisions((prev) => ({
      ...prev,
      [scheduleId]: { ...prev[scheduleId], fields },
    }));
  }

  async function handleSaveConsult() {
    // Validar pautas ajustadas y nuevas
    for (const s of activeSchedules) {
      const d = decisions[s.id];
      if (d?.action === "adjust") {
        const v = validateForm(d.fields);
        if (v) { setErr(`Pauta ajustada (${s.inventory_item?.name}): ${v}`); return; }
      }
    }
    for (const ns of newScheds) {
      const v = validateForm(ns.form);
      if (v) { setErr(`Nueva pauta: ${v}`); return; }
    }
    setBusy(true); setErr(null);
    try {
      const decisionList = activeSchedules.map((s) => ({
        scheduleId: s.id,
        itemId: s.item_id,
        action: decisions[s.id]?.action || "keep",
        fields: decisions[s.id]?.fields,
      }));
      await saveConsultation({
        consultationDate: consHeader.consultationDate,
        doctor: consHeader.doctor,
        notes: consHeader.notes,
        decisions: decisionList,
        newSchedules: newScheds.map((ns) => ns.form),
      });
      setShowConsult(false);
    } catch (e) {
      setErr(e.message || "Error al guardar la consulta");
    } finally {
      setBusy(false);
    }
  }

  // ── Early returns ───────────────────────────────────────────
  if (groupLoading) {
    return <div style={{ padding: 40, textAlign: "center", color: mu, fontSize: 14 }}>Cargando…</div>;
  }
  if (groups.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: mu, fontSize: 14 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>💊</div>
        <div>Únete o crea un grupo familiar para gestionar medicamentos.</div>
      </div>
    );
  }

  const btnPrimary = {
    background: "#111827",
    color: wh,
    border: "none",
    borderRadius: 12,
    padding: "14px 20px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 2px 8px rgba(0,0,0,.15)",
  };

  const consultDetailScheds = consultDetail
    ? schedules.filter((s) => s.consultation_id === consultDetail.id)
    : [];

  return (
    <div
      {...swipeHandlers}
      style={{
        fontFamily: "system-ui,-apple-system,sans-serif",
        background: bg,
        minHeight: "100dvh",
        paddingBottom: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: wh,
          borderBottom: `1px solid ${bd}`,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: mu }}>Medicamentos</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{activeGroup?.name}</div>
        </div>
        {groups.length > 1 && (
          <select
            value={activeGroup?.id || ""}
            onChange={(e) => {
              const g = groups.find((g) => g.id === e.target.value);
              if (g) selectGroup(g);
            }}
            style={{ fontSize: 12, border: `1px solid ${bd}`, borderRadius: 8, padding: "4px 8px", color: mu, background: wh }}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", background: wh, borderBottom: `1px solid ${bd}` }}>
        {[
          ["hoy", "☀️ Hoy"],
          ["pautas", "📋 Pautas"],
          ["consultas", "🩺 Consultas"],
        ].map(([t, lbl]) => (
          <button
            key={t}
            onClick={() => setMedsTab(t)}
            style={{
              flex: 1,
              padding: "11px 0",
              border: "none",
              background: "transparent",
              borderBottom: `2.5px solid ${medsTab === t ? G : "transparent"}`,
              color: medsTab === t ? G : mu,
              fontSize: 13,
              fontWeight: medsTab === t ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* ── HOY ── */}
      {medsTab === "hoy" && (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: "center", color: mu, padding: 24, fontSize: 14 }}>Cargando…</div>
          ) : todayDoses.length === 0 && todayAsNeeded.length === 0 ? (
            <div style={{ ...card(), textAlign: "center", color: mu, padding: 40, fontSize: 14 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>☀️</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Nada programado para hoy</div>
              <div style={{ fontSize: 12 }}>Crea una pauta en la pestaña Pautas.</div>
            </div>
          ) : (
            <>
              {todayDoses.map((row) => (
                <DoseRow key={row.key} row={row} onTap={() => setDoseSheet(row)} />
              ))}
              {todayAsNeeded.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: mu, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8 }}>
                    Según necesidad
                  </div>
                  {todayAsNeeded.map((s) => (
                    <div key={s.id} style={{ ...card(), display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>
                          {s.inventory_item?.name}
                        </div>
                        <div style={{ fontSize: 13, color: mu }}>
                          {fmtDose(s.dose, s.inventory_item?.unit)} · cuando se requiera
                        </div>
                      </div>
                      <button
                        onClick={() => handleTakeAsNeeded(s)}
                        disabled={busy}
                        style={{ background: "#ECFDF5", color: G, border: `1px solid ${G}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                      >
                        + Registrar
                      </button>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── PAUTAS ── */}
      {medsTab === "pautas" && (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {canEdit && (
            <button onClick={openAddSchedule} style={btnPrimary}>+ Nueva pauta</button>
          )}
          {loading ? (
            <div style={{ textAlign: "center", color: mu, padding: 24, fontSize: 14 }}>Cargando…</div>
          ) : activeSchedules.length === 0 ? (
            <div style={{ ...card(), textAlign: "center", color: mu, padding: 40, fontSize: 14 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Sin pautas activas</div>
              <div style={{ fontSize: 12 }}>Crea una pauta ligada a un medicamento del inventario.</div>
            </div>
          ) : (
            activeSchedules.map((s) => (
              <ScheduleCard key={s.id} schedule={s} onTap={() => setScheduleDetail(s)} />
            ))
          )}
        </div>
      )}

      {/* ── CONSULTAS ── */}
      {medsTab === "consultas" && (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {canEdit && (
            <button onClick={openConsult} style={btnPrimary}>+ Registrar consulta</button>
          )}
          {loading ? (
            <div style={{ textAlign: "center", color: mu, padding: 24, fontSize: 14 }}>Cargando…</div>
          ) : consultations.length === 0 ? (
            <div style={{ ...card(), textAlign: "center", color: mu, padding: 40, fontSize: 14 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🩺</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Sin consultas registradas</div>
              <div style={{ fontSize: 12 }}>Registra la visita médica y ajusta las pautas.</div>
            </div>
          ) : (
            consultations.map((c) => (
              <ConsultationCard key={c.id} consultation={c} onTap={() => setConsultDetail(c)} />
            ))
          )}
        </div>
      )}

      {/* Sheet: detalle de toma del día */}
      {doseSheet && (
        <Sheet onClose={() => setDoseSheet(null)} title={doseSheet.itemName} swipeToClose>
          <div style={{ fontSize: 14, color: mu, marginBottom: 16 }}>
            {fmtDose(doseSheet.dose, doseSheet.unit)} · {doseSheet.time}
          </div>
          {doseSheet.takenIntake && (
            <div style={{ fontSize: 13, color: G, marginBottom: 16 }}>
              ✓ Tomada{doseSheet.takenIntake.taker?.full_name ? ` por ${doseSheet.takenIntake.taker.full_name}` : ""}
            </div>
          )}
          <button
            onClick={() => handleToggleTaken(doseSheet)}
            disabled={busy}
            style={{
              ...btnPrimary,
              background: doseSheet.takenIntake ? wh : G,
              color: doseSheet.takenIntake ? rd : wh,
              border: doseSheet.takenIntake ? `1px solid ${bd}` : "none",
              boxShadow: "none",
            }}
          >
            {doseSheet.takenIntake ? "Deshacer" : "Marcar como tomada"}
          </button>
        </Sheet>
      )}

      {/* Sheet: detalle de pauta */}
      {scheduleDetail && (
        <Sheet onClose={() => setScheduleDetail(null)} title={scheduleDetail.inventory_item?.name} swipeToClose>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "#111827", marginBottom: 20 }}>
            <div><b>Dosis:</b> {fmtDose(scheduleDetail.dose, scheduleDetail.inventory_item?.unit)}</div>
            <div><b>Frecuencia:</b> {frequencyLabel(scheduleDetail)}</div>
            {(scheduleDetail.times || []).length > 0 && (
              <div><b>Horarios:</b> {scheduleDetail.times.join(" · ")}</div>
            )}
            <div><b>Desde:</b> {fmtDate(scheduleDetail.start_date)}</div>
            {scheduleDetail.end_date && (
              <div>
                <b>Hasta:</b> {fmtDate(scheduleDetail.end_date)}
                {" "}({durationBetween(scheduleDetail.start_date, scheduleDetail.end_date)} días)
              </div>
            )}
            {scheduleDetail.notes && <div><b>Notas:</b> {scheduleDetail.notes}</div>}
          </div>
          {canEdit && (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => openEditSchedule(scheduleDetail)}
                style={{ flex: 1, background: "#111827", color: wh, border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Editar
              </button>
              <button
                onClick={() => handleSuspend(scheduleDetail)}
                disabled={busy}
                style={{ flex: 1, background: wh, color: rd, border: `1px solid ${bd}`, borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Suspender
              </button>
            </div>
          )}
        </Sheet>
      )}

      {/* Sheet: nueva pauta */}
      {showAddSchedule && (
        <Sheet onClose={() => setShowAddSchedule(false)} title="Nueva pauta" swipeToClose>
          <ScheduleForm form={schedForm} onChange={setSchedForm} items={invItems} onCreateItem={createInventoryItem} />
          {err && <div style={{ color: rd, fontSize: 13, marginBottom: 12 }}>{err}</div>}
          <button onClick={handleAddSchedule} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Guardando…" : "Guardar pauta"}
          </button>
        </Sheet>
      )}

      {/* Sheet: editar pauta */}
      {editSchedule && (
        <Sheet onClose={() => setEditSchedule(null)} title="Editar pauta" swipeToClose>
          <ScheduleForm form={schedForm} onChange={setSchedForm} items={invItems} lockItem />
          {err && <div style={{ color: rd, fontSize: 13, marginBottom: 12 }}>{err}</div>}
          <button onClick={handleUpdateSchedule} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </Sheet>
      )}

      {/* Sheet: detalle de consulta */}
      {consultDetail && (
        <Sheet onClose={() => setConsultDetail(null)} title="Consulta médica" swipeToClose>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "#111827", marginBottom: 16 }}>
            <div><b>Fecha:</b> {fmtDate(consultDetail.consultation_date)}</div>
            {consultDetail.doctor && <div><b>Médico:</b> {consultDetail.doctor}</div>}
            {consultDetail.notes && <div><b>Notas:</b> {consultDetail.notes}</div>}
          </div>
          {consultDetailScheds.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: mu, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
                Pautas indicadas
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {consultDetailScheds.map((s) => (
                  <div key={s.id} style={{ fontSize: 14, color: "#111827" }}>
                    • {s.inventory_item?.name}: {fmtDose(s.dose, s.inventory_item?.unit)} · {frequencyLabel(s)}
                    {s.active ? "" : " (suspendida)"}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Sheet>
      )}

      {/* Sheet: asistente de consulta */}
      {showConsult && (
        <Sheet onClose={() => setShowConsult(false)} title="Registrar consulta" swipeToClose>
          <Field label="Fecha de la consulta">
            <input
              type="date"
              value={consHeader.consultationDate}
              onChange={(e) => setConsHeader((h) => ({ ...h, consultationDate: e.target.value }))}
              style={inputSt}
            />
          </Field>
          <Field label="Médico (opcional)">
            <input
              type="text"
              value={consHeader.doctor}
              onChange={(e) => setConsHeader((h) => ({ ...h, doctor: e.target.value }))}
              placeholder="Dr. / Dra."
              style={inputSt}
            />
          </Field>
          <Field label="Notas (opcional)">
            <textarea
              value={consHeader.notes}
              onChange={(e) => setConsHeader((h) => ({ ...h, notes: e.target.value }))}
              rows={2}
              style={{ ...inputSt, resize: "vertical" }}
            />
          </Field>

          {activeSchedules.length > 0 && (
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: mu, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
                Pautas vigentes
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeSchedules.map((s) => {
                  const d = decisions[s.id] || { action: "keep" };
                  return (
                    <div key={s.id} style={{ border: `1px solid ${bd}`, borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 8 }}>
                        {s.inventory_item?.name}
                        <span style={{ fontWeight: 400, color: mu }}> · {fmtDose(s.dose, s.inventory_item?.unit)} · {frequencyLabel(s)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[["keep", "Mantener"], ["adjust", "Ajustar"], ["suspend", "Suspender"]].map(([a, lbl]) => {
                          const on = d.action === a;
                          const color = a === "suspend" ? rd : a === "adjust" ? am : G;
                          return (
                            <button
                              key={a}
                              onClick={() => setDecisionAction(s.id, a)}
                              style={{
                                flex: 1,
                                border: `1px solid ${on ? color : bd}`,
                                background: on ? `${color}15` : wh,
                                color: on ? color : mu,
                                borderRadius: 8,
                                padding: "7px 0",
                                fontSize: 12,
                                fontWeight: on ? 600 : 400,
                                cursor: "pointer",
                              }}
                            >
                              {lbl}
                            </button>
                          );
                        })}
                      </div>
                      {d.action === "adjust" && (
                        <div style={{ marginTop: 12 }}>
                          <ScheduleForm
                            form={d.fields}
                            onChange={(fields) => setDecisionFields(s.id, fields)}
                            items={invItems}
                            lockItem
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nuevas pautas */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: mu, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
              Nuevas pautas
            </div>
            {newScheds.map((ns, idx) => (
              <div key={idx} style={{ border: `1px solid ${bd}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                  <button
                    onClick={() => setNewScheds((prev) => prev.filter((_, j) => j !== idx))}
                    style={{ background: "none", border: "none", color: rd, fontSize: 13, cursor: "pointer" }}
                  >
                    Quitar
                  </button>
                </div>
                <ScheduleForm
                  form={ns.form}
                  onChange={(form) => setNewScheds((prev) => prev.map((p, j) => (j === idx ? { form } : p)))}
                  items={invItems}
                  onCreateItem={createInventoryItem}
                />
              </div>
            ))}
            <button
              onClick={() => setNewScheds((prev) => [...prev, { form: emptyScheduleForm(consHeader.consultationDate) }])}
              style={{ background: "none", border: `1px dashed ${bd}`, borderRadius: 8, padding: "10px", color: mu, cursor: "pointer", fontSize: 13, width: "100%" }}
            >
              + Agregar pauta nueva
            </button>
          </div>

          {err && <div style={{ color: rd, fontSize: 13, margin: "12px 0" }}>{err}</div>}
          <button onClick={handleSaveConsult} disabled={busy} style={{ ...btnPrimary, marginTop: 16, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Guardando…" : "Guardar consulta"}
          </button>
        </Sheet>
      )}
    </div>
  );
}
