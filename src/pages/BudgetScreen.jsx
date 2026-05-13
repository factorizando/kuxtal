import { useState, useMemo } from "react";
import { useFamily } from "../hooks/useFamily";
import { useBudget } from "../hooks/useBudget";

const G = "#059669",
  mu = "#6B7280",
  bd = "#E5E7EB",
  wh = "#FFFFFF",
  bg = "#F4F2ED",
  rd = "#EF4444";

const EXPENSE_CATEGORIES = [
  "Consulta médica",
  "Terapia Física",
  "Medicamentos",
  "Insulina",
  "Jeringas/Plumas",
  "Tiras reactivas",
  "Lancetas",
  "Glucómetro",
  "Otro",
];

const INCOME_CATEGORIES = ["Aportación", "Pensión"];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function fmtCurrency(n) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

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

function SummaryCard({ label, value, color, bold }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: mu, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: bold ? 15 : 13, fontWeight: bold ? 700 : 600, color }}>
        {fmtCurrency(value)}
      </div>
    </div>
  );
}

function EntryCard({ entry, canEdit, onDelete, onViewReceipt }) {
  const isIncome = entry.type === "income";
  const color = isIncome ? G : rd;
  const sign = isIncome ? "+" : "−";
  const monthAbbr = MESES[parseInt(entry.entry_date?.split("-")[1]) - 1]?.slice(0, 3);

  return (
    <div
      style={{
        background: wh,
        borderRadius: 10,
        padding: "12px 14px",
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      {/* Fecha */}
      <div
        style={{
          minWidth: 44,
          textAlign: "center",
          background: isIncome ? "#D1FAE5" : "#FEE2E2",
          borderRadius: 8,
          padding: "5px 0",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 700, color, lineHeight: 1 }}>
          {entry.entry_date?.split("-")[2]}
        </div>
        <div style={{ fontSize: 10, color, textTransform: "uppercase", marginTop: 1 }}>
          {monthAbbr}
        </div>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>
          {entry.category}
        </div>
        {(entry.contributor?.full_name || entry.contributor_label) && (
          <div style={{ fontSize: 12, color: mu, marginTop: 2 }}>
            👤 {entry.contributor?.full_name || entry.contributor_label}
          </div>
        )}
        {entry.note && (
          <div style={{ fontSize: 12, color: mu, marginTop: 2 }}>{entry.note}</div>
        )}
        {entry.receipt_url && (
          <button
            onClick={onViewReceipt}
            style={{
              background: "none",
              border: "none",
              color: "#3B82F6",
              fontSize: 12,
              cursor: "pointer",
              padding: 0,
              marginTop: 4,
            }}
          >
            🧾 Ver comprobante
          </button>
        )}
      </div>

      {/* Monto + eliminar */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color }}>
          {sign}{fmtCurrency(parseFloat(entry.amount))}
        </div>
        {canEdit && (
          <button
            onClick={onDelete}
            style={{ background: "none", border: "none", color: "#D1D5DB", fontSize: 17, cursor: "pointer", padding: 0, lineHeight: 1 }}
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

export default function BudgetScreen({ userId }) {
  const { groups, activeGroup, members, myRole, loading: groupLoading, selectGroup } =
    useFamily(userId);
  const { entries, loading: budgetLoading, addEntry, deleteEntry } = useBudget(
    activeGroup?.id
  );

  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [showForm, setShowForm] = useState(false);
  const [viewReceipt, setViewReceipt] = useState(null);

  // Estado del formulario
  const [fType, setFType] = useState("expense");
  const [fAmount, setFAmount] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fContributor, setFContributor] = useState("");
  const [fNote, setFNote] = useState("");
  const [fDate, setFDate] = useState(todayStr());
  const [fFile, setFFile] = useState(null);
  const [fPreview, setFPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showContributorSheet, setShowContributorSheet] = useState(false);

  const canEdit = myRole === "admin" || myRole === "caregiver";

  const monthEntries = useMemo(
    () =>
      entries
        .filter((e) => {
          if (!e.entry_date) return false;
          const [y, m] = e.entry_date.split("-").map(Number);
          return y === period.year && m === period.month;
        })
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    [entries, period]
  );

  const monthIncome = monthEntries
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + parseFloat(e.amount), 0);
  const monthExpense = monthEntries
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + parseFloat(e.amount), 0);
  const monthBalance = monthIncome - monthExpense;

  const totalIncome = entries
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalExpense = entries
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalBalance = totalIncome - totalExpense;

  function prevMonth() {
    setPeriod((p) =>
      p.month === 1 ? { year: p.year - 1, month: 12 } : { ...p, month: p.month - 1 }
    );
  }
  function nextMonth() {
    setPeriod((p) =>
      p.month === 12 ? { year: p.year + 1, month: 1 } : { ...p, month: p.month + 1 }
    );
  }

  function openForm() {
    setFType("expense");
    setFAmount("");
    setFCategory("");
    setFContributor("");
    setFNote("");
    setFDate(todayStr());
    setFFile(null);
    setFPreview(null);
    setFormError(null);
    setShowForm(true);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFFile(file);
    setFPreview(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    const parsed = parseFloat(fAmount);
    if (!fAmount || isNaN(parsed) || parsed <= 0) {
      setFormError("Ingresa un monto válido");
      return;
    }
    if (!fCategory) {
      setFormError("Selecciona una categoría");
      return;
    }
    if (!fDate) {
      setFormError("Selecciona una fecha");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await addEntry({
        type: fType,
        amount: fAmount,
        category: fCategory,
        contributorId: fType === "income" ? fContributor || null : null,
        note: fNote,
        entryDate: fDate,
        file: fFile,
        recordedBy: userId,
      });
      setShowForm(false);
    } catch (e) {
      setFormError(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar este movimiento?")) return;
    try {
      await deleteEntry(id);
    } catch (e) {
      alert(e.message);
    }
  }

  // ── Sin grupo ──────────────────────────────────────────────
  if (groupLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: mu, fontSize: 14 }}>
        Cargando...
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: mu, fontSize: 14 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
        <div>Únete o crea un grupo familiar para usar el presupuesto compartido.</div>
      </div>
    );
  }

  // ── Pantalla ───────────────────────────────────────────────
  return (
    <div
      style={{
        fontFamily: "system-ui,-apple-system,sans-serif",
        background: bg,
        minHeight: "100vh",
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
          <div style={{ fontSize: 12, color: mu }}>Presupuesto familiar</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
            {activeGroup?.name}
          </div>
        </div>
        {groups.length > 1 && (
          <select
            value={activeGroup?.id || ""}
            onChange={(e) => {
              const g = groups.find((g) => g.id === e.target.value);
              if (g) selectGroup(g);
            }}
            style={{
              fontSize: 12,
              border: `1px solid ${bd}`,
              borderRadius: 8,
              padding: "4px 8px",
              color: mu,
              background: wh,
            }}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Selector de mes */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "10px 16px",
          background: wh,
          borderBottom: `1px solid ${bd}`,
        }}
      >
        <button
          onClick={prevMonth}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: mu, padding: "2px 8px" }}
        >
          ‹
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#111827", minWidth: 150, textAlign: "center" }}>
          {MESES[period.month - 1]} {period.year}
        </span>
        <button
          onClick={nextMonth}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: mu, padding: "2px 8px" }}
        >
          ›
        </button>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Resumen mensual */}
        <div
          style={{
            background: wh,
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: mu,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 14,
            }}
          >
            {MESES[period.month - 1]} {period.year}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <SummaryCard label="Ingresos" value={monthIncome} color={G} />
            <SummaryCard label="Gastos" value={monthExpense} color={rd} />
            <SummaryCard
              label="Saldo"
              value={monthBalance}
              color={monthBalance >= 0 ? G : rd}
              bold
            />
          </div>
        </div>

        {/* Resumen acumulado */}
        <div
          style={{
            background: wh,
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: mu,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 14,
            }}
          >
            Acumulado total
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <SummaryCard label="Ingresos" value={totalIncome} color={G} />
            <SummaryCard label="Gastos" value={totalExpense} color={rd} />
            <SummaryCard
              label="Saldo"
              value={totalBalance}
              color={totalBalance >= 0 ? G : rd}
              bold
            />
          </div>
        </div>

        {/* Botón agregar */}
        {canEdit && (
          <button
            onClick={openForm}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: G,
              color: wh,
              border: "none",
              borderRadius: 12,
              padding: "14px 20px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              width: "100%",
              boxShadow: "0 2px 8px rgba(5,150,105,.3)",
            }}
          >
            + Agregar movimiento
          </button>
        )}

        {/* Lista de entradas del mes */}
        {budgetLoading ? (
          <div style={{ textAlign: "center", color: mu, padding: 24, fontSize: 14 }}>
            Cargando movimientos...
          </div>
        ) : monthEntries.length === 0 ? (
          <div style={{ textAlign: "center", color: mu, padding: 24, fontSize: 14 }}>
            No hay movimientos en {MESES[period.month - 1]} {period.year}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {monthEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                canEdit={canEdit}
                onDelete={() => handleDelete(entry.id)}
                onViewReceipt={() => setViewReceipt(entry.receipt_url)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal: formulario ── */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            zIndex: 50,
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div
            style={{
              background: wh,
              borderRadius: "20px 20px 0 0",
              padding: 24,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          >
            {/* Encabezado */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>
                Nuevo movimiento
              </span>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: "none", border: "none", fontSize: 24, color: mu, cursor: "pointer", lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Tipo: Gasto / Ingreso */}
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}
            >
              {[
                ["expense", "💸 Gasto", rd],
                ["income", "💰 Ingreso", G],
              ].map(([t, lbl, col]) => (
                <button
                  key={t}
                  onClick={() => { setFType(t); setFCategory(""); }}
                  style={{
                    padding: "11px 0",
                    border: `2px solid ${fType === t ? col : bd}`,
                    borderRadius: 10,
                    background: fType === t ? `${col}18` : wh,
                    color: fType === t ? col : mu,
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <Field label="Monto (MXN)">
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={fAmount}
                onChange={(e) => setFAmount(e.target.value)}
                min="0"
                step="0.01"
                style={inputSt}
              />
            </Field>

            <Field label="Fecha">
              <input
                type="date"
                value={fDate}
                onChange={(e) => setFDate(e.target.value)}
                style={inputSt}
              />
            </Field>

            {/* Categoría — chips para ingreso, bottom sheet para gasto */}
            <Field label="Categoría">
              {fType === "income" ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {INCOME_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setFCategory(c)}
                      style={{
                        padding: "8px 18px",
                        border: `2px solid ${fCategory === c ? G : bd}`,
                        borderRadius: 20,
                        background: fCategory === c ? `${G}15` : wh,
                        color: fCategory === c ? G : mu,
                        fontWeight: fCategory === c ? 600 : 400,
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setShowCategorySheet(true)}
                  style={{
                    ...inputSt,
                    textAlign: "left",
                    cursor: "pointer",
                    color: fCategory ? "#111827" : "#9CA3AF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: `1px solid ${bd}`,
                  }}
                >
                  <span>{fCategory || "Seleccionar categoría..."}</span>
                  <span style={{ color: mu, fontSize: 13 }}>›</span>
                </button>
              )}
            </Field>

            {/* Aportado por — bottom sheet (solo ingreso) */}
            {fType === "income" && (
              <Field label="Aportado por">
                <button
                  onClick={() => setShowContributorSheet(true)}
                  style={{
                    ...inputSt,
                    textAlign: "left",
                    cursor: "pointer",
                    color: fContributor ? "#111827" : "#9CA3AF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: `1px solid ${bd}`,
                  }}
                >
                  <span>
                    {fContributor === "bienestar"
                      ? "Bienestar"
                      : members.find((m) => m.profiles.id === fContributor)?.profiles.full_name
                      || "Seleccionar integrante..."}
                  </span>
                  <span style={{ color: mu, fontSize: 13 }}>›</span>
                </button>
              </Field>
            )}

            <Field label="Nota (opcional)">
              <input
                type="text"
                placeholder="Descripción adicional..."
                value={fNote}
                onChange={(e) => setFNote(e.target.value)}
                style={inputSt}
              />
            </Field>

            <Field label="Comprobante (opcional)">
              <label
                style={{
                  display: "block",
                  border: `2px dashed ${bd}`,
                  borderRadius: 10,
                  padding: 12,
                  textAlign: "center",
                  cursor: "pointer",
                  color: mu,
                  fontSize: 13,
                  background: "#FAFAFA",
                }}
              >
                {fPreview ? (
                  <img
                    src={fPreview}
                    alt="comprobante"
                    style={{ maxHeight: 130, maxWidth: "100%", borderRadius: 6, objectFit: "contain" }}
                  />
                ) : (
                  <span>📷 Tomar foto o seleccionar imagen</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </label>
              {fPreview && (
                <button
                  onClick={() => { setFFile(null); setFPreview(null); }}
                  style={{ background: "none", border: "none", color: rd, fontSize: 12, cursor: "pointer", marginTop: 4 }}
                >
                  Quitar foto
                </button>
              )}
            </Field>

            {formError && (
              <div style={{ color: rd, fontSize: 13, marginBottom: 12 }}>{formError}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                width: "100%",
                padding: "14px 0",
                background: fType === "expense" ? rd : G,
                color: wh,
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Guardando..." : "Guardar movimiento"}
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom sheet: categorías de gasto ── */}
      {showCategorySheet && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 55, display: "flex", alignItems: "flex-end" }}
          onClick={() => setShowCategorySheet(false)}
        >
          <div
            style={{ background: wh, borderRadius: "20px 20px 0 0", width: "100%", paddingBottom: 32, boxSizing: "border-box" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 20px 12px", fontSize: 15, fontWeight: 700, color: "#111827", borderBottom: `1px solid ${bd}` }}>
              Categoría de gasto
            </div>
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => { setFCategory(c); setShowCategorySheet(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "15px 20px",
                  border: "none",
                  borderBottom: `1px solid ${bd}`,
                  background: fCategory === c ? `${G}0D` : "none",
                  color: fCategory === c ? G : "#111827",
                  fontSize: 15,
                  fontWeight: fCategory === c ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  boxSizing: "border-box",
                }}
              >
                {c}
                {fCategory === c && <span style={{ color: G, fontSize: 16 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom sheet: aportado por ── */}
      {showContributorSheet && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 55, display: "flex", alignItems: "flex-end" }}
          onClick={() => setShowContributorSheet(false)}
        >
          <div
            style={{ background: wh, borderRadius: "20px 20px 0 0", width: "100%", paddingBottom: 32, boxSizing: "border-box" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 20px 12px", fontSize: 15, fontWeight: 700, color: "#111827", borderBottom: `1px solid ${bd}` }}>
              Aportado por
            </div>
            {[{ id: "bienestar", name: "Bienestar" }, ...members.map((m) => ({ id: m.profiles.id, name: m.profiles.full_name || "Sin nombre" }))].map((opt) => (
              <button
                key={opt.id}
                onClick={() => { setFContributor(opt.id); setShowContributorSheet(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "15px 20px",
                  border: "none",
                  borderBottom: `1px solid ${bd}`,
                  background: fContributor === opt.id ? `${G}0D` : "none",
                  color: fContributor === opt.id ? G : "#111827",
                  fontSize: 15,
                  fontWeight: fContributor === opt.id ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  boxSizing: "border-box",
                }}
              >
                {opt.name}
                {fContributor === opt.id && <span style={{ color: G, fontSize: 16 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal: visor de comprobante ── */}
      {viewReceipt && (
        <div
          onClick={() => setViewReceipt(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.88)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={viewReceipt}
            alt="comprobante"
            style={{ maxWidth: "95vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }}
          />
          <button
            onClick={() => setViewReceipt(null)}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "rgba(255,255,255,.15)",
              border: "none",
              color: wh,
              fontSize: 22,
              borderRadius: "50%",
              width: 40,
              height: 40,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
