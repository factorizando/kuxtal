import { useState, useMemo, useEffect, useRef } from "react";
import { useFamily } from "../hooks/useFamily";
import { useBudget } from "../hooks/useBudget";
import { useSwipe } from "../hooks/useSwipe";
import { useInventory, calcDaysRemaining } from "../hooks/useInventory";
import { useAuditLog } from "../hooks/useAuditLog";

const G = "#059669",
  mu = "#6B7280",
  bd = "#E5E7EB",
  wh = "#FFFFFF",
  bg = "#F4F2ED",
  rd = "#EF4444",
  am = "#D97706";

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

const STORES = [
  "Farmacias del Ahorro",
  "Farmacias Similares",
  "Mercado Libre",
  "Farmacia Gámez",
  "Farmacias Benavides",
  "Cruz Verde",
  "Walmart",
  "Sam's Club",
  "Costco",
  "Amazon",
  "Otro",
];

const UNITS = [
  "tabletas",
  "cápsulas",
  "mL",
  "unidades",
  "tiras",
  "lancetas",
  "jeringas",
  "plumas",
  "frascos",
  "cajas",
];

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
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
      <div
        style={{
          fontSize: bold ? 15 : 13,
          fontWeight: bold ? 700 : 600,
          color,
        }}
      >
        {fmtCurrency(value)}
      </div>
    </div>
  );
}

function EntryCard({ entry, canDelete, onDelete, onEdit, onViewReceipt }) {
  const isIncome = entry.type === "income";
  const color = isIncome ? G : rd;
  const sign = isIncome ? "+" : "−";
  const monthAbbr = MESES[parseInt(entry.entry_date?.split("-")[1]) - 1]?.slice(
    0,
    3,
  );

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
        <div
          style={{
            fontSize: 10,
            color,
            textTransform: "uppercase",
            marginTop: 1,
          }}
        >
          {monthAbbr}
        </div>
      </div>
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
          <div style={{ fontSize: 12, color: mu, marginTop: 2 }}>
            {entry.note}
          </div>
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, color }}>
          {sign}
          {fmtCurrency(parseFloat(entry.amount))}
        </div>
        {canDelete && (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onEdit}
              style={{
                background: "none",
                border: "none",
                color: "#9CA3AF",
                fontSize: 16,
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
              }}
            >
              ✏️
            </button>
            <button
              onClick={onDelete}
              style={{
                background: "none",
                border: "none",
                color: "#D1D5DB",
                fontSize: 17,
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
              }}
            >
              🗑
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoPicker({ id, preview, onFile, onClear }) {
  function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onFile(file, URL.createObjectURL(file));
    e.target.value = "";
  }
  const btnSt = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px 0",
    border: `1.5px dashed ${bd}`,
    borderRadius: 8,
    cursor: "pointer",
    color: mu,
    fontSize: 13,
    background: "#FAFAFA",
  };
  return preview ? (
    <div>
      <img
        src={preview}
        alt=""
        style={{
          maxHeight: 130,
          maxWidth: "100%",
          borderRadius: 6,
          objectFit: "contain",
          display: "block",
        }}
      />
      <button
        onClick={onClear}
        style={{
          background: "none",
          border: "none",
          color: rd,
          fontSize: 12,
          cursor: "pointer",
          marginTop: 4,
          padding: 0,
        }}
      >
        Quitar foto
      </button>
    </div>
  ) : (
    <div style={{ display: "flex", gap: 8 }}>
      <label htmlFor={`${id}-cam`} style={btnSt}>
        📷 Cámara
        <input
          id={`${id}-cam`}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={pick}
          style={{ display: "none" }}
        />
      </label>
      <label htmlFor={`${id}-gal`} style={btnSt}>
        🖼 Galería
        <input
          id={`${id}-gal`}
          type="file"
          accept="image/*"
          onChange={pick}
          style={{ display: "none" }}
        />
      </label>
    </div>
  );
}

function InventoryItemCard({ item, onDetail }) {
  const days = calcDaysRemaining(item);
  const isUrgent = days < item.alert_threshold_days;
  const isWarning = !isUrgent && days < item.alert_threshold_days * 2;
  const statusColor = isUrgent ? rd : isWarning ? am : G;
  const fillPct = Math.min(100, (days / (item.alert_threshold_days * 3)) * 100);
  const daysLabel = days < 1 ? "Sin stock" : `${Math.round(days)} días`;

  return (
    <div
      onClick={onDetail}
      style={{
        background: wh,
        borderRadius: 12,
        padding: "14px 16px",
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        borderLeft: `4px solid ${statusColor}`,
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {item.image_url && (
          <img
            src={item.image_url}
            alt={item.name}
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
            {item.name}
          </div>
          <div style={{ fontSize: 12, color: mu, marginTop: 2 }}>
            {item.consumption_per_day} {item.unit}/día
            {item.units_per_pack && (
              <span> · 📦 cajas de {item.units_per_pack}</span>
            )}
          </div>
          <div style={{ margin: "8px 0 4px" }}>
            <div
              style={{
                height: 5,
                borderRadius: 3,
                background: "#F3F4F6",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${fillPct}%`,
                  background: statusColor,
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: statusColor, fontWeight: 600 }}>
              {isUrgent && days >= 1 ? "⚠️ " : ""}
              {daysLabel}
            </span>
            <span style={{ fontSize: 11, color: mu }}>Ver detalle ›</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const ENTITY_LABELS = {
  budget_entry: "movimiento",
  inventory_item: "artículo",
  inventory_restock: "reabastecimiento",
};

const FIELD_LABELS = {
  type: "Tipo", amount: "Monto", category: "Categoría",
  note: "Nota", entry_date: "Fecha",
  name: "Nombre", unit: "Unidad", consumption_per_day: "Consumo/día",
  alert_threshold_days: "Días de alerta", notes: "Notas", units_per_pack: "Por presentación",
  restock_quantity: "Cantidad (reabastecimiento)", restock_price: "Precio (reabastecimiento)",
  restock_purchased_at: "Fecha de compra (reabastecimiento)",
};

function formatFieldValue(key, val) {
  if (val === null || val === undefined) return "—";
  if (key === "amount" || key === "restock_price") {
    const n = parseFloat(val);
    return isNaN(n) ? String(val) : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  }
  if (key === "type") return val === "expense" ? "Gasto" : "Ingreso";
  return String(val);
}

function LogEntry({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const entityLabel = ENTITY_LABELS[entry.entity_type] || entry.entity_type;
  const actionLabel = entry.action === "edit" ? "editó" : "eliminó";
  const actionIcon = entry.action === "edit" ? "✏️" : "🗑️";

  const changedFields = entry.action === "edit" && entry.before && entry.after
    ? Object.keys({ ...entry.before, ...entry.after }).filter(
        (k) => JSON.stringify(entry.before?.[k]) !== JSON.stringify(entry.after?.[k])
      )
    : [];

  return (
    <div style={{ background: wh, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ width: "100%", background: "none", border: "none", padding: "12px 14px", cursor: "pointer", textAlign: "left" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: "#111827" }}>
              {actionIcon} <strong>{entry.changer?.full_name || "Alguien"}</strong> {actionLabel} un {entityLabel}
            </div>
            {entry.action === "edit" && changedFields.length > 0 && (
              <div style={{ fontSize: 12, color: mu, marginTop: 2 }}>
                {changedFields.map((k) => FIELD_LABELS[k] || k).join(" · ")}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: mu }}>{fmtDateTime(entry.occurred_at)}</div>
            <div style={{ fontSize: 10, color: mu, marginTop: 2 }}>{expanded ? "▲" : "▼"}</div>
          </div>
        </div>
      </button>
      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${bd}` }}>
          {entry.action === "edit" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: mu, textTransform: "uppercase", marginBottom: 6 }}>Antes</div>
                {changedFields.map((k) => (
                  <div key={k} style={{ fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: mu }}>{FIELD_LABELS[k] || k}: </span>
                    <span style={{ color: rd }}>{formatFieldValue(k, entry.before?.[k])}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: mu, textTransform: "uppercase", marginBottom: 6 }}>Después</div>
                {changedFields.map((k) => (
                  <div key={k} style={{ fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: mu }}>{FIELD_LABELS[k] || k}: </span>
                    <span style={{ color: G }}>{formatFieldValue(k, entry.after?.[k])}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: mu, textTransform: "uppercase", marginBottom: 6 }}>Datos eliminados</div>
              {entry.before && Object.entries(entry.before).map(([k, v]) => (
                <div key={k} style={{ fontSize: 12, color: mu, marginBottom: 3 }}>
                  <span style={{ fontWeight: 500 }}>{FIELD_LABELS[k] || k}: </span>
                  {formatFieldValue(k, v)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Sheet({ onClose, title, children, swipeToClose = false }) {
  const touch = useRef({ x: null, y: null, valid: false });

  function handleTouchStart(e) {
    if (!swipeToClose) return;
    const startX = e.touches[0].clientX;
    touch.current = {
      x: startX,
      y: e.touches[0].clientY,
      valid: startX >= window.innerWidth - 44,
    };
  }

  function handleTouchEnd(e) {
    if (!swipeToClose) return;
    const { x: sx, y: sy, valid } = touch.current;
    touch.current = { x: null, y: null, valid: false };
    if (!valid || sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = Math.abs(e.changedTouches[0].clientY - sy);
    if (dx < -48 && dy < Math.abs(dx)) onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { touch.current = { x: null, y: null, valid: false }; }}
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              color: mu,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function BudgetScreen({ userId, onSwipeScreen }) {
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => onSwipeScreen?.("left"),
    onSwipeRight: () => onSwipeScreen?.("right"),
  });
  const {
    groups,
    activeGroup,
    members,
    myRole,
    loading: groupLoading,
    selectGroup,
  } = useFamily(userId);
  const {
    entries,
    loading: budgetLoading,
    addEntry,
    updateEntry,
    deleteEntry,
  } = useBudget(activeGroup?.id);
  const {
    items: invItems,
    loading: invLoading,
    addItem,
    updateItem,
    deleteItem,
    adjustQuantity,
    restock,
    fetchRestocks,
    getRestockForEntry,
    deleteRestockAndRevertStock,
    updateRestockAndAdjustStock,
  } = useInventory(activeGroup?.id);

  const { logEntries, logLoading, logAction, fetchLog } = useAuditLog(activeGroup?.id, userId);

  const now = new Date();
  const [budgetTab, setBudgetTab] = useState("movimientos");

  // ── Movimientos state ─────────────────────────────────────
  const [period, setPeriod] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [showForm, setShowForm] = useState(false);
  const [viewReceipt, setViewReceipt] = useState(null);
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

  // ── Edit entry state ──────────────────────────────────────
  const [showEditEntry, setShowEditEntry] = useState(null);
  const [eType, setEType] = useState("expense");
  const [eAmount, setEAmount] = useState("");
  const [eCategory, setECategory] = useState("");
  const [eContributor, setEContributor] = useState("");
  const [eNote, setENote] = useState("");
  const [eEntryDate, setEEntryDate] = useState(todayStr());
  const [eEditSaving, setEEditSaving] = useState(false);
  const [eEditError, setEEditError] = useState(null);
  const [eIsRestockLinked, setEIsRestockLinked] = useState(false);
  const [eRestockData, setERestockData] = useState(null);
  const [eQuantity, setEQuantity] = useState("");
  const [showEditCategorySheet, setShowEditCategorySheet] = useState(false);
  const [showEditContributorSheet, setShowEditContributorSheet] =
    useState(false);

  // ── Inventario state ──────────────────────────────────────
  const [showAddItem, setShowAddItem] = useState(false);
  const [showRestock, setShowRestock] = useState(null);
  const [showDetail, setShowDetail] = useState(null);
  const [showAdjust, setShowAdjust] = useState(null);
  const [showUnitSheet, setShowUnitSheet] = useState(false);
  const [showStoreSheet, setShowStoreSheet] = useState(false);
  const [restockHistory, setRestockHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [iImgFile, setIImgFile] = useState(null);
  const [iImgPreview, setIImgPreview] = useState(null);
  const [eImgFile, setEImgFile] = useState(null);
  const [eImgPreview, setEImgPreview] = useState(null);

  const [iName, setIName] = useState("");
  const [iUnit, setIUnit] = useState("tabletas");
  const [iUnitsPerPack, setIUnitsPerPack] = useState("");
  const [iConsumo, setIConsumo] = useState("");
  const [iCantidad, setICantidad] = useState("");
  const [iAlerta, setIAlerta] = useState("14");
  const [iNotes, setINotes] = useState("");
  const [addItemSaving, setAddItemSaving] = useState(false);
  const [addItemError, setAddItemError] = useState(null);

  const [showEditItem, setShowEditItem] = useState(null);
  const [eName, setEName] = useState("");
  const [eUnit, setEUnit] = useState("tabletas");
  const [eUnitsPerPack, setEUnitsPerPack] = useState("");
  const [eConsumo, setEConsumo] = useState("");
  const [eAlerta, setEAlerta] = useState("14");
  const [eNotes, setENotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [unitSheetTarget, setUnitSheetTarget] = useState("add");

  const [rQuantity, setRQuantity] = useState("");
  const [rBoxes, setRBoxes] = useState("");
  const [rBrand, setRBrand] = useState("");
  const [rStore, setRStore] = useState("");
  const [rPrice, setRPrice] = useState("");
  const [rDate, setRDate] = useState(todayStr());
  const [rNotes, setRNotes] = useState("");
  const [rCreateBudget, setRCreateBudget] = useState(true);
  const [rFile, setRFile] = useState(null);
  const [rFilePreview, setRFilePreview] = useState(null);
  const [rSaving, setRSaving] = useState(false);
  const [restockError, setRestockError] = useState(null);

  const [adjQuantity, setAdjQuantity] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjError, setAdjError] = useState(null);

  const canEdit = myRole === "admin" || myRole === "caregiver";
  const canDelete = myRole === "admin";

  useEffect(() => {
    if (canDelete) fetchLog();
  }, [fetchLog, canDelete]);

  // ── Movimientos calcs ─────────────────────────────────────
  const monthEntries = useMemo(
    () =>
      entries
        .filter((e) => {
          if (!e.entry_date) return false;
          const [y, m] = e.entry_date.split("-").map(Number);
          return y === period.year && m === period.month;
        })
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    [entries, period],
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

  // ── Inventario calcs ──────────────────────────────────────
  const sortedItems = [...invItems].sort(
    (a, b) => calcDaysRemaining(a) - calcDaysRemaining(b),
  );
  const urgentCount = invItems.filter(
    (i) => calcDaysRemaining(i) < i.alert_threshold_days,
  ).length;

  // ── Movimientos handlers ──────────────────────────────────
  function prevMonth() {
    setPeriod((p) =>
      p.month === 1
        ? { year: p.year - 1, month: 12 }
        : { ...p, month: p.month - 1 },
    );
  }
  function nextMonth() {
    setPeriod((p) =>
      p.month === 12
        ? { year: p.year + 1, month: 1 }
        : { ...p, month: p.month + 1 },
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
    try {
      const restock = await getRestockForEntry(id);
      const entryToLog = entries.find((e) => e.id === id);
      if (restock) {
        const item = invItems.find((i) => i.id === restock.item_id);
        const itemName = item ? item.name : "el artículo";
        const unit = item ? item.unit : "unidades";
        if (
          !window.confirm(
            `Este movimiento está vinculado a un reabastecimiento de inventario.\n\nSe eliminará el movimiento, se borrará del historial de compras y se descontarán ${restock.quantity} ${unit} de ${itemName}.\n\n¿Continuar?`,
          )
        )
          return;
        await deleteRestockAndRevertStock(restock.id, restock.item_id, restock.quantity);
      } else {
        if (!window.confirm("¿Eliminar este movimiento?")) return;
      }
      await logAction({
        entityType: "budget_entry",
        entityId: id,
        action: "delete",
        before: {
          type: entryToLog?.type,
          amount: entryToLog?.amount,
          category: entryToLog?.category,
          note: entryToLog?.note,
          entry_date: entryToLog?.entry_date,
          ...(restock ? {
            restock_quantity: restock.quantity,
            restock_price: restock.price,
            restock_purchased_at: restock.purchased_at,
          } : {}),
        },
        after: null,
      });
      await deleteEntry(id);
    } catch (e) {
      alert(e.message);
    }
  }

  async function openEditEntry(entry) {
    try {
      const restock = await getRestockForEntry(entry.id);
      setEIsRestockLinked(!!restock);
      setERestockData(restock);
      setEQuantity(restock ? String(restock.quantity) : "");
    } catch {
      setEIsRestockLinked(false);
      setERestockData(null);
      setEQuantity("");
    }
    setEType(entry.type);
    setEAmount(String(entry.amount));
    setECategory(entry.category);
    setENote(entry.note || "");
    setEEntryDate(entry.entry_date);
    const contributorVal =
      entry.contributor?.id || entry.contributor_label || "";
    setEContributor(contributorVal);
    setEEditError(null);
    setShowEditEntry(entry);
  }

  async function handleEditEntry() {
    const parsed = parseFloat(eAmount);
    if (!eAmount || isNaN(parsed) || parsed <= 0) {
      setEEditError("Ingresa un monto válido");
      return;
    }
    if (!eCategory) {
      setEEditError("Selecciona una categoría");
      return;
    }
    if (!eEntryDate) {
      setEEditError("Selecciona una fecha");
      return;
    }
    if (eIsRestockLinked && eRestockData) {
      const newQty = parseFloat(eQuantity);
      if (!eQuantity || isNaN(newQty) || newQty <= 0) {
        setEEditError("Ingresa una cantidad válida");
        return;
      }
    }
    setEEditSaving(true);
    setEEditError(null);
    try {
      await logAction({
        entityType: "budget_entry",
        entityId: showEditEntry.id,
        action: "edit",
        before: {
          type: showEditEntry.type,
          amount: showEditEntry.amount,
          category: showEditEntry.category,
          note: showEditEntry.note,
          entry_date: showEditEntry.entry_date,
          ...(eIsRestockLinked && eRestockData ? {
            restock_quantity: eRestockData.quantity,
            restock_price: eRestockData.price,
            restock_purchased_at: eRestockData.purchased_at,
          } : {}),
        },
        after: {
          type: eType,
          amount: parsed,
          category: eCategory,
          note: eNote || null,
          entry_date: eEntryDate,
          ...(eIsRestockLinked && eRestockData ? {
            restock_quantity: parseFloat(eQuantity),
            restock_price: parsed,
            restock_purchased_at: eEntryDate,
          } : {}),
        },
      });
      if (eIsRestockLinked && eRestockData) {
        await updateRestockAndAdjustStock(
          eRestockData.id,
          eRestockData.item_id,
          eRestockData.quantity,
          parseFloat(eQuantity),
          parsed,
          eEntryDate,
        );
      }
      await updateEntry(showEditEntry.id, {
        type: eType,
        amount: eAmount,
        category: eCategory,
        contributorId: eType === "income" ? eContributor || null : null,
        note: eNote,
        entryDate: eEntryDate,
      });
      setShowEditEntry(null);
    } catch (e) {
      setEEditError(e.message || "Error al guardar");
    } finally {
      setEEditSaving(false);
    }
  }

  // ── Inventario handlers ───────────────────────────────────
  function openAddItem() {
    setIName("");
    setIUnit("tabletas");
    setIUnitsPerPack("");
    setIConsumo("");
    setICantidad("");
    setIAlerta("14");
    setINotes("");
    setAddItemError(null);
    setIImgFile(null);
    setIImgPreview(null);
    setUnitSheetTarget("add");
    setShowAddItem(true);
  }

  function openEditItem(item) {
    setEName(item.name);
    setEUnit(item.unit);
    setEUnitsPerPack(item.units_per_pack ? String(item.units_per_pack) : "");
    setEConsumo(String(item.consumption_per_day));
    setEAlerta(String(item.alert_threshold_days));
    setENotes(item.notes || "");
    setEditError(null);
    setEImgFile(null);
    setEImgPreview(null);
    setUnitSheetTarget("edit");
    setShowEditItem(item);
  }

  async function handleEditItem() {
    if (!eName.trim()) {
      setEditError("Ingresa un nombre");
      return;
    }
    const consumo = parseFloat(eConsumo);
    if (!eConsumo || isNaN(consumo) || consumo <= 0) {
      setEditError("Ingresa un consumo diario válido");
      return;
    }
    const unitsPerPack = eUnitsPerPack ? parseInt(eUnitsPerPack) : null;
    if (eUnitsPerPack && (isNaN(unitsPerPack) || unitsPerPack < 2)) {
      setEditError("La presentación debe tener al menos 2 unidades");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await logAction({
        entityType: "inventory_item",
        entityId: showEditItem.id,
        action: "edit",
        before: {
          name: showEditItem.name,
          unit: showEditItem.unit,
          consumption_per_day: showEditItem.consumption_per_day,
          alert_threshold_days: showEditItem.alert_threshold_days,
          notes: showEditItem.notes,
          units_per_pack: showEditItem.units_per_pack,
        },
        after: {
          name: eName.trim(),
          unit: eUnit,
          consumption_per_day: consumo,
          alert_threshold_days: parseInt(eAlerta) || 14,
          notes: eNotes?.trim() || null,
          units_per_pack: unitsPerPack,
        },
      });
      await updateItem(showEditItem.id, {
        name: eName,
        unit: eUnit,
        consumptionPerDay: consumo,
        alertThresholdDays: parseInt(eAlerta) || 14,
        notes: eNotes,
        unitsPerPack,
        file: eImgFile || null,
      });
      setShowEditItem(null);
    } catch (e) {
      setEditError(e.message || "Error al guardar");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleAddItem() {
    if (!iName.trim()) {
      setAddItemError("Ingresa un nombre");
      return;
    }
    const consumo = parseFloat(iConsumo);
    if (!iConsumo || isNaN(consumo) || consumo <= 0) {
      setAddItemError("Ingresa un consumo diario válido");
      return;
    }
    const cantidad = parseFloat(iCantidad);
    if (iCantidad === "" || isNaN(cantidad) || cantidad < 0) {
      setAddItemError("Ingresa la cantidad actual");
      return;
    }
    const unitsPerPack = iUnitsPerPack ? parseInt(iUnitsPerPack) : null;
    if (iUnitsPerPack && (isNaN(unitsPerPack) || unitsPerPack < 2)) {
      setAddItemError("La presentación debe tener al menos 2 unidades");
      return;
    }
    setAddItemSaving(true);
    setAddItemError(null);
    try {
      await addItem({
        name: iName,
        unit: iUnit,
        consumptionPerDay: consumo,
        currentQuantity: cantidad,
        alertThresholdDays: parseInt(iAlerta) || 14,
        notes: iNotes,
        createdBy: userId,
        unitsPerPack,
        file: iImgFile || null,
      });
      setShowAddItem(false);
    } catch (e) {
      setAddItemError(e.message || "Error al guardar");
    } finally {
      setAddItemSaving(false);
    }
  }

  function openRestock(item) {
    setRQuantity("");
    setRBoxes("");
    setRBrand("");
    setRStore("");
    setRPrice("");
    setRDate(todayStr());
    setRNotes("");
    setRCreateBudget(true);
    setRestockError(null);
    setRFile(null);
    setRFilePreview(null);
    setShowRestock(item);
  }

  async function handleRestock() {
    let qty;
    if (showRestock.units_per_pack) {
      const boxes = parseInt(rBoxes);
      if (!rBoxes || isNaN(boxes) || boxes <= 0) {
        setRestockError("Ingresa el número de cajas");
        return;
      }
      qty = boxes * showRestock.units_per_pack;
    } else {
      qty = parseFloat(rQuantity);
      if (!rQuantity || isNaN(qty) || qty <= 0) {
        setRestockError("Ingresa una cantidad válida");
        return;
      }
    }
    if (!rDate) {
      setRestockError("Ingresa la fecha de compra");
      return;
    }
    setRSaving(true);
    setRestockError(null);
    try {
      await restock({
        itemId: showRestock.id,
        quantity: qty,
        price: parseFloat(rPrice) || 0,
        brand: rBrand,
        store: rStore,
        purchasedAt: rDate,
        notes: rNotes,
        recordedBy: userId,
        createBudgetEntry: rCreateBudget,
        itemName: showRestock.name,
        file: rFile || null,
      });
      setShowRestock(null);
    } catch (e) {
      setRestockError(e.message || "Error al reabastecer");
    } finally {
      setRSaving(false);
    }
  }

  async function openDetail(item) {
    setShowDetail(item);
    setRestockHistory([]);
    setHistoryLoading(true);
    try {
      const history = await fetchRestocks(item.id);
      setRestockHistory(history);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  }

  function openAdjust(item) {
    const estimated = Math.max(
      0,
      Math.round(calcDaysRemaining(item) * item.consumption_per_day),
    );
    setAdjQuantity(String(estimated));
    setAdjError(null);
    setShowAdjust(item);
  }

  async function handleAdjust() {
    const qty = parseFloat(adjQuantity);
    if (adjQuantity === "" || isNaN(qty) || qty < 0) {
      setAdjError("Ingresa una cantidad válida");
      return;
    }
    setAdjSaving(true);
    setAdjError(null);
    try {
      await adjustQuantity(showAdjust.id, qty, userId);
      setShowAdjust(null);
    } catch (e) {
      setAdjError(e.message || "Error al ajustar");
    } finally {
      setAdjSaving(false);
    }
  }

  async function handleDeleteItem(item) {
    if (
      !window.confirm(
        `¿Eliminar "${item.name}" del inventario? Se perderá el historial de reabastecimientos.`,
      )
    )
      return;
    try {
      await logAction({
        entityType: "inventory_item",
        entityId: item.id,
        action: "delete",
        before: {
          name: item.name,
          unit: item.unit,
          consumption_per_day: item.consumption_per_day,
          notes: item.notes,
          units_per_pack: item.units_per_pack,
        },
        after: null,
      });
      await deleteItem(item.id);
    } catch (e) {
      alert(e.message);
    }
  }

  // ── Early returns ─────────────────────────────────────────
  if (groupLoading) {
    return (
      <div
        style={{ padding: 40, textAlign: "center", color: mu, fontSize: 14 }}
      >
        Cargando...
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <div
        style={{ padding: 40, textAlign: "center", color: mu, fontSize: 14 }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
        <div>
          Únete o crea un grupo familiar para usar el presupuesto compartido.
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div
      {...swipeHandlers}
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

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          background: wh,
          borderBottom: `1px solid ${bd}`,
        }}
      >
        {[
          ["movimientos", "💸 Movimientos", null],
          ["inventario", "📦 Inventario", urgentCount],
          ...(canDelete ? [["auditoria", "📋 Auditoría", null]] : []),
        ].map(([t, lbl, badge]) => (
          <button
            key={t}
            onClick={() => setBudgetTab(t)}
            style={{
              flex: 1,
              padding: "11px 0",
              border: "none",
              background: "transparent",
              borderBottom: `2.5px solid ${budgetTab === t ? G : "transparent"}`,
              color: budgetTab === t ? G : mu,
              fontSize: 13,
              fontWeight: budgetTab === t ? 600 : 400,
              cursor: "pointer",
              position: "relative",
            }}
          >
            {lbl}
            {badge > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  background: rd,
                  color: wh,
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 6px",
                  verticalAlign: "middle",
                }}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── MOVIMIENTOS ── */}
      {budgetTab === "movimientos" && (
        <>
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
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 22,
                color: mu,
                padding: "2px 8px",
              }}
            >
              ‹
            </button>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#111827",
                minWidth: 150,
                textAlign: "center",
              }}
            >
              {MESES[period.month - 1]} {period.year}
            </span>
            <button
              onClick={nextMonth}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 22,
                color: mu,
                padding: "2px 8px",
              }}
            >
              ›
            </button>
          </div>

          <div
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
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
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                }}
              >
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
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                }}
              >
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

            {budgetLoading ? (
              <div
                style={{
                  textAlign: "center",
                  color: mu,
                  padding: 24,
                  fontSize: 14,
                }}
              >
                Cargando movimientos...
              </div>
            ) : monthEntries.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: mu,
                  padding: 24,
                  fontSize: 14,
                }}
              >
                No hay movimientos en {MESES[period.month - 1]} {period.year}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {monthEntries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    canDelete={canDelete}
                    onDelete={() => handleDelete(entry.id)}
                    onEdit={() => openEditEntry(entry)}
                    onViewReceipt={() => setViewReceipt(entry.receipt_url)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── INVENTARIO ── */}
      {budgetTab === "inventario" && (
        <div
          style={{
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {urgentCount > 0 && (
            <div
              style={{
                background: "#FEF2F2",
                border: `1px solid #FECACA`,
                borderRadius: 12,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: rd }}>
                  {urgentCount}{" "}
                  {urgentCount === 1
                    ? "artículo necesita"
                    : "artículos necesitan"}{" "}
                  reabastecerse
                </div>
                <div style={{ fontSize: 12, color: "#9B1C1C", marginTop: 2 }}>
                  Stock por debajo del umbral de alerta
                </div>
              </div>
            </div>
          )}

          {canEdit && (
            <button
              onClick={openAddItem}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
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
              }}
            >
              + Agregar artículo
            </button>
          )}

          {invLoading ? (
            <div
              style={{
                textAlign: "center",
                color: mu,
                padding: 24,
                fontSize: 14,
              }}
            >
              Cargando inventario...
            </div>
          ) : sortedItems.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: mu,
                padding: 40,
                fontSize: 14,
                background: wh,
                borderRadius: 12,
                boxShadow: "0 1px 4px rgba(0,0,0,.06)",
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Sin artículos en inventario
              </div>
              <div style={{ fontSize: 12 }}>
                Agrega medicamentos y suministros para llevar el control de
                stock.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sortedItems.map((item) => (
                <InventoryItemCard
                  key={item.id}
                  item={item}
                  onDetail={() => openDetail(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AUDITORÍA ── */}
      {budgetTab === "auditoria" && canDelete && (
        <div style={{ padding: "16px 16px 80px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Historial de cambios</div>
            <button
              onClick={fetchLog}
              disabled={logLoading}
              style={{ background: "none", border: `1px solid ${bd}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, color: mu, cursor: "pointer", opacity: logLoading ? 0.6 : 1 }}
            >
              {logLoading ? "Cargando..." : "Actualizar"}
            </button>
          </div>
          {logLoading ? (
            <div style={{ textAlign: "center", color: mu, padding: 24, fontSize: 14 }}>Cargando...</div>
          ) : logEntries.length === 0 ? (
            <div style={{ textAlign: "center", color: mu, padding: 24, fontSize: 14 }}>Sin cambios registrados</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {logEntries.map((entry) => <LogEntry key={entry.id} entry={entry} />)}
            </div>
          )}
        </div>
      )}

      {/* ── BOTTOM SHEETS: Movimientos ── */}

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
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
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
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  color: mu,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 18,
              }}
            >
              {[
                ["expense", "💸 Gasto", rd],
                ["income", "💰 Ingreso", G],
              ].map(([t, lbl, col]) => (
                <button
                  key={t}
                  onClick={() => {
                    setFType(t);
                    setFCategory("");
                  }}
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
                      : members.find((m) => m.profiles.id === fContributor)
                          ?.profiles.full_name || "Seleccionar integrante..."}
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
              <PhotoPicker
                id="entry-receipt"
                preview={fPreview}
                onFile={(file, url) => {
                  setFFile(file);
                  setFPreview(url);
                }}
                onClear={() => {
                  setFFile(null);
                  setFPreview(null);
                }}
              />
            </Field>
            {formError && (
              <div style={{ color: rd, fontSize: 13, marginBottom: 12 }}>
                {formError}
              </div>
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

      {showEditEntry && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            zIndex: 50,
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditEntry(null);
          }}
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>
                Editar movimiento
              </span>
              <button
                onClick={() => setShowEditEntry(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  color: mu,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            {eIsRestockLinked && (
              <div
                style={{
                  background: "#FEF3C7",
                  border: "1px solid #FCD34D",
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 16,
                  fontSize: 13,
                  color: "#92400E",
                }}
              >
                Este movimiento está vinculado a un reabastecimiento de
                inventario. Los cambios aquí solo afectan el presupuesto; el
                stock del artículo no se modificará.
              </div>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 18,
              }}
            >
              {[
                ["expense", "💸 Gasto", rd],
                ["income", "💰 Ingreso", G],
              ].map(([t, lbl, col]) => (
                <button
                  key={t}
                  onClick={() => {
                    setEType(t);
                    setECategory("");
                  }}
                  style={{
                    padding: "11px 0",
                    border: `2px solid ${eType === t ? col : bd}`,
                    borderRadius: 10,
                    background: eType === t ? `${col}18` : wh,
                    color: eType === t ? col : mu,
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
                value={eAmount}
                onChange={(e) => setEAmount(e.target.value)}
                min="0"
                step="0.01"
                style={inputSt}
              />
            </Field>
            <Field label="Fecha">
              <input
                type="date"
                value={eEntryDate}
                onChange={(e) => setEEntryDate(e.target.value)}
                style={inputSt}
              />
            </Field>
            <Field label="Categoría">
              {eType === "income" ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {INCOME_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setECategory(c)}
                      style={{
                        padding: "8px 18px",
                        border: `2px solid ${eCategory === c ? G : bd}`,
                        borderRadius: 20,
                        background: eCategory === c ? `${G}15` : wh,
                        color: eCategory === c ? G : mu,
                        fontWeight: eCategory === c ? 600 : 400,
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
                  onClick={() => setShowEditCategorySheet(true)}
                  style={{
                    ...inputSt,
                    textAlign: "left",
                    cursor: "pointer",
                    color: eCategory ? "#111827" : "#9CA3AF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: `1px solid ${bd}`,
                  }}
                >
                  <span>{eCategory || "Seleccionar categoría..."}</span>
                  <span style={{ color: mu, fontSize: 13 }}>›</span>
                </button>
              )}
            </Field>
            {eType === "income" && (
              <Field label="Aportado por">
                <button
                  onClick={() => setShowEditContributorSheet(true)}
                  style={{
                    ...inputSt,
                    textAlign: "left",
                    cursor: "pointer",
                    color: eContributor ? "#111827" : "#9CA3AF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: `1px solid ${bd}`,
                  }}
                >
                  <span>
                    {eContributor === "bienestar"
                      ? "Bienestar"
                      : members.find((m) => m.profiles.id === eContributor)
                          ?.profiles.full_name || "Seleccionar integrante..."}
                  </span>
                  <span style={{ color: mu, fontSize: 13 }}>›</span>
                </button>
              </Field>
            )}
            {eIsRestockLinked &&
              eRestockData &&
              (() => {
                const item = invItems.find(
                  (i) => i.id === eRestockData.item_id,
                );
                const unit = item ? item.unit : "unidades";
                return (
                  <Field label={`Cantidad (${unit})`}>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="ej. 30"
                      value={eQuantity}
                      onChange={(e) => setEQuantity(e.target.value)}
                      min="0.001"
                      step="1"
                      style={inputSt}
                    />
                    {item?.units_per_pack &&
                      eQuantity &&
                      parseFloat(eQuantity) > 0 && (
                        <div style={{ fontSize: 12, color: mu, marginTop: 6 }}>
                          ={" "}
                          {(
                            parseFloat(eQuantity) / item.units_per_pack
                          ).toFixed(1)}{" "}
                          cajas de {item.units_per_pack} {unit}
                        </div>
                      )}
                  </Field>
                );
              })()}
            <Field label="Nota (opcional)">
              <input
                type="text"
                placeholder="Descripción adicional..."
                value={eNote}
                onChange={(e) => setENote(e.target.value)}
                style={inputSt}
              />
            </Field>
            {eEditError && (
              <div style={{ color: rd, fontSize: 13, marginBottom: 12 }}>
                {eEditError}
              </div>
            )}
            <button
              onClick={handleEditEntry}
              disabled={eEditSaving}
              style={{
                width: "100%",
                padding: "14px 0",
                background: eType === "expense" ? rd : G,
                color: wh,
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: eEditSaving ? "not-allowed" : "pointer",
                opacity: eEditSaving ? 0.7 : 1,
              }}
            >
              {eEditSaving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}

      {showEditCategorySheet && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            zIndex: 55,
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={() => setShowEditCategorySheet(false)}
        >
          <div
            style={{
              background: wh,
              borderRadius: "20px 20px 0 0",
              width: "100%",
              paddingBottom: 32,
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "20px 20px 12px",
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                borderBottom: `1px solid ${bd}`,
              }}
            >
              Categoría de gasto
            </div>
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setECategory(c);
                  setShowEditCategorySheet(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "15px 20px",
                  border: "none",
                  borderBottom: `1px solid ${bd}`,
                  background: eCategory === c ? `${G}0D` : "none",
                  color: eCategory === c ? G : "#111827",
                  fontSize: 15,
                  fontWeight: eCategory === c ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  boxSizing: "border-box",
                }}
              >
                {c}
                {eCategory === c && (
                  <span style={{ color: G, fontSize: 16 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {showEditContributorSheet && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            zIndex: 55,
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={() => setShowEditContributorSheet(false)}
        >
          <div
            style={{
              background: wh,
              borderRadius: "20px 20px 0 0",
              width: "100%",
              paddingBottom: 32,
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "20px 20px 12px",
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                borderBottom: `1px solid ${bd}`,
              }}
            >
              Aportado por
            </div>
            {[
              { id: "bienestar", name: "Bienestar" },
              ...members.map((m) => ({
                id: m.profiles.id,
                name: m.profiles.full_name || "Sin nombre",
              })),
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  setEContributor(opt.id);
                  setShowEditContributorSheet(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "15px 20px",
                  border: "none",
                  borderBottom: `1px solid ${bd}`,
                  background: eContributor === opt.id ? `${G}0D` : "none",
                  color: eContributor === opt.id ? G : "#111827",
                  fontSize: 15,
                  fontWeight: eContributor === opt.id ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  boxSizing: "border-box",
                }}
              >
                {opt.name}
                {eContributor === opt.id && (
                  <span style={{ color: G, fontSize: 16 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {showCategorySheet && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            zIndex: 55,
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={() => setShowCategorySheet(false)}
        >
          <div
            style={{
              background: wh,
              borderRadius: "20px 20px 0 0",
              width: "100%",
              paddingBottom: 32,
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "20px 20px 12px",
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                borderBottom: `1px solid ${bd}`,
              }}
            >
              Categoría de gasto
            </div>
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setFCategory(c);
                  setShowCategorySheet(false);
                }}
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
                {fCategory === c && (
                  <span style={{ color: G, fontSize: 16 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {showContributorSheet && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            zIndex: 55,
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={() => setShowContributorSheet(false)}
        >
          <div
            style={{
              background: wh,
              borderRadius: "20px 20px 0 0",
              width: "100%",
              paddingBottom: 32,
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "20px 20px 12px",
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                borderBottom: `1px solid ${bd}`,
              }}
            >
              Aportado por
            </div>
            {[
              { id: "bienestar", name: "Bienestar" },
              ...members.map((m) => ({
                id: m.profiles.id,
                name: m.profiles.full_name || "Sin nombre",
              })),
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  setFContributor(opt.id);
                  setShowContributorSheet(false);
                }}
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
                {fContributor === opt.id && (
                  <span style={{ color: G, fontSize: 16 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

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
            style={{
              maxWidth: "95vw",
              maxHeight: "90vh",
              borderRadius: 8,
              objectFit: "contain",
            }}
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

      {/* ── BOTTOM SHEETS: Inventario ── */}

      {showAddItem && (
        <Sheet onClose={() => setShowAddItem(false)} title="Nuevo artículo">
          <Field label="Nombre del artículo">
            <input
              type="text"
              placeholder="ej. Metformina 500mg, Tiras reactivas..."
              value={iName}
              onChange={(e) => setIName(e.target.value)}
              style={inputSt}
            />
          </Field>
          <Field label="Unidad de medida">
            <button
              onClick={() => setShowUnitSheet(true)}
              style={{
                ...inputSt,
                textAlign: "left",
                cursor: "pointer",
                color: "#111827",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: `1px solid ${bd}`,
              }}
            >
              <span>{iUnit}</span>
              <span style={{ color: mu, fontSize: 13 }}>›</span>
            </button>
          </Field>
          <Field
            label={`${iUnit.charAt(0).toUpperCase() + iUnit.slice(1)} por presentación (opcional)`}
          >
            <input
              type="number"
              inputMode="numeric"
              placeholder={`ej. 7 si se vende en cajas de 7 ${iUnit}`}
              value={iUnitsPerPack}
              onChange={(e) => setIUnitsPerPack(e.target.value)}
              min="2"
              step="1"
              style={inputSt}
            />
          </Field>
          <Field label={`Consumo diario (${iUnit}/día)`}>
            <input
              type="number"
              inputMode="decimal"
              placeholder="ej. 2"
              value={iConsumo}
              onChange={(e) => setIConsumo(e.target.value)}
              min="0.01"
              step="0.5"
              style={inputSt}
            />
          </Field>
          <Field label={`Cantidad actual (${iUnit})`}>
            <input
              type="number"
              inputMode="decimal"
              placeholder="¿Cuántos tienes ahora?"
              value={iCantidad}
              onChange={(e) => setICantidad(e.target.value)}
              min="0"
              step="1"
              style={inputSt}
            />
            {iUnitsPerPack &&
              parseInt(iUnitsPerPack) >= 2 &&
              iCantidad &&
              parseFloat(iCantidad) > 0 && (
                <div style={{ fontSize: 12, color: mu, marginTop: 6 }}>
                  ={" "}
                  {(parseFloat(iCantidad) / parseInt(iUnitsPerPack)).toFixed(1)}{" "}
                  cajas de {iUnitsPerPack} {iUnit}
                </div>
              )}
          </Field>
          <Field label="Alertar cuando queden (días)">
            <input
              type="number"
              inputMode="numeric"
              value={iAlerta}
              onChange={(e) => setIAlerta(e.target.value)}
              min="1"
              max="90"
              step="1"
              style={inputSt}
            />
          </Field>
          <Field label="Notas (opcional)">
            <input
              type="text"
              placeholder="..."
              value={iNotes}
              onChange={(e) => setINotes(e.target.value)}
              style={inputSt}
            />
          </Field>
          <Field label="Foto del producto (opcional)">
            <PhotoPicker
              id="add-item-img"
              preview={iImgPreview}
              onFile={(file, url) => {
                setIImgFile(file);
                setIImgPreview(url);
              }}
              onClear={() => {
                setIImgFile(null);
                setIImgPreview(null);
              }}
            />
          </Field>
          {addItemError && (
            <div style={{ color: rd, fontSize: 13, marginBottom: 12 }}>
              {addItemError}
            </div>
          )}
          <button
            onClick={handleAddItem}
            disabled={addItemSaving}
            style={{
              width: "100%",
              padding: "14px 0",
              background: "#111827",
              color: wh,
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: addItemSaving ? "not-allowed" : "pointer",
              opacity: addItemSaving ? 0.7 : 1,
            }}
          >
            {addItemSaving ? "Guardando..." : "Guardar artículo"}
          </button>
        </Sheet>
      )}

      {showEditItem && (
        <Sheet onClose={() => setShowEditItem(null)} title="Editar artículo">
          <Field label="Nombre del artículo">
            <input
              type="text"
              placeholder="ej. Metformina 500mg"
              value={eName}
              onChange={(e) => setEName(e.target.value)}
              style={inputSt}
            />
          </Field>
          <Field label="Unidad de medida">
            <button
              onClick={() => {
                setUnitSheetTarget("edit");
                setShowUnitSheet(true);
              }}
              style={{
                ...inputSt,
                textAlign: "left",
                cursor: "pointer",
                color: "#111827",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: `1px solid ${bd}`,
              }}
            >
              <span>{eUnit}</span>
              <span style={{ color: mu, fontSize: 13 }}>›</span>
            </button>
          </Field>
          <Field
            label={`${eUnit.charAt(0).toUpperCase() + eUnit.slice(1)} por presentación (opcional)`}
          >
            <input
              type="number"
              inputMode="numeric"
              placeholder={`ej. 7 si se vende en cajas de 7 ${eUnit}`}
              value={eUnitsPerPack}
              onChange={(e) => setEUnitsPerPack(e.target.value)}
              min="2"
              step="1"
              style={inputSt}
            />
          </Field>
          <Field label={`Consumo diario (${eUnit}/día)`}>
            <input
              type="number"
              inputMode="decimal"
              placeholder="ej. 2"
              value={eConsumo}
              onChange={(e) => setEConsumo(e.target.value)}
              min="0.01"
              step="0.5"
              style={inputSt}
            />
          </Field>
          <Field label="Alertar cuando queden (días)">
            <input
              type="number"
              inputMode="numeric"
              value={eAlerta}
              onChange={(e) => setEAlerta(e.target.value)}
              min="1"
              max="90"
              step="1"
              style={inputSt}
            />
          </Field>
          <Field label="Notas (opcional)">
            <input
              type="text"
              placeholder="..."
              value={eNotes}
              onChange={(e) => setENotes(e.target.value)}
              style={inputSt}
            />
          </Field>
          <Field label="Foto del producto">
            {showEditItem?.image_url && !eImgPreview && (
              <div style={{ marginBottom: 8 }}>
                <img
                  src={showEditItem.image_url}
                  alt=""
                  style={{
                    maxHeight: 100,
                    maxWidth: "100%",
                    borderRadius: 6,
                    objectFit: "contain",
                    display: "block",
                  }}
                />
                <div style={{ fontSize: 11, color: mu, marginTop: 4 }}>
                  Foto actual — selecciona una nueva para reemplazarla
                </div>
              </div>
            )}
            <PhotoPicker
              id="edit-item-img"
              preview={eImgPreview}
              onFile={(file, url) => {
                setEImgFile(file);
                setEImgPreview(url);
              }}
              onClear={() => {
                setEImgFile(null);
                setEImgPreview(null);
              }}
            />
          </Field>
          {editError && (
            <div style={{ color: rd, fontSize: 13, marginBottom: 12 }}>
              {editError}
            </div>
          )}
          <button
            onClick={handleEditItem}
            disabled={editSaving}
            style={{
              width: "100%",
              padding: "14px 0",
              background: "#111827",
              color: wh,
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: editSaving ? "not-allowed" : "pointer",
              opacity: editSaving ? 0.7 : 1,
            }}
          >
            {editSaving ? "Guardando..." : "Guardar cambios"}
          </button>
        </Sheet>
      )}

      {showRestock && (
        <Sheet
          onClose={() => setShowRestock(null)}
          title={`Reabastecer · ${showRestock.name}`}
        >
          {showRestock.units_per_pack ? (
            <Field label="Número de cajas compradas">
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={rBoxes}
                onChange={(e) => setRBoxes(e.target.value)}
                min="1"
                step="1"
                style={inputSt}
              />
              {rBoxes && parseInt(rBoxes) > 0 && (
                <div
                  style={{
                    fontSize: 13,
                    color: G,
                    fontWeight: 600,
                    marginTop: 6,
                  }}
                >
                  = {parseInt(rBoxes) * showRestock.units_per_pack}{" "}
                  {showRestock.unit}
                </div>
              )}
            </Field>
          ) : (
            <Field label={`Cantidad comprada (${showRestock.unit})`}>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={rQuantity}
                onChange={(e) => setRQuantity(e.target.value)}
                min="0.01"
                step="1"
                style={inputSt}
              />
            </Field>
          )}
          <Field label="Marca / Patente">
            <input
              type="text"
              placeholder="ej. Metformina Norma, Glucophage, Pisa..."
              value={rBrand}
              onChange={(e) => setRBrand(e.target.value)}
              style={inputSt}
            />
          </Field>
          <Field label="Tienda">
            <button
              onClick={() => setShowStoreSheet(true)}
              style={{
                ...inputSt,
                textAlign: "left",
                cursor: "pointer",
                color: rStore ? "#111827" : "#9CA3AF",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: `1px solid ${bd}`,
              }}
            >
              <span>{rStore || "Sin especificar"}</span>
              <span style={{ color: mu, fontSize: 13 }}>›</span>
            </button>
          </Field>
          <Field label="Precio total pagado (MXN, opcional)">
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={rPrice}
              onChange={(e) => setRPrice(e.target.value)}
              min="0"
              step="0.01"
              style={inputSt}
            />
          </Field>
          <Field label="Fecha de compra">
            <input
              type="date"
              value={rDate}
              onChange={(e) => setRDate(e.target.value)}
              style={inputSt}
            />
          </Field>
          <Field label="Notas (opcional)">
            <input
              type="text"
              placeholder="..."
              value={rNotes}
              onChange={(e) => setRNotes(e.target.value)}
              style={inputSt}
            />
          </Field>
          <Field label="Comprobante (opcional)">
            <PhotoPicker
              id="restock-receipt"
              preview={rFilePreview}
              onFile={(file, url) => {
                setRFile(file);
                setRFilePreview(url);
              }}
              onClear={() => {
                setRFile(null);
                setRFilePreview(null);
              }}
            />
          </Field>
          {parseFloat(rPrice) > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 18,
                padding: "12px 14px",
                background: "#F9FAFB",
                borderRadius: 10,
                cursor: "pointer",
              }}
              onClick={() => setRCreateBudget((v) => !v)}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  border: `2px solid ${rCreateBudget ? G : bd}`,
                  background: rCreateBudget ? G : wh,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {rCreateBudget && (
                  <span style={{ color: wh, fontSize: 13, lineHeight: 1 }}>
                    ✓
                  </span>
                )}
              </div>
              <span style={{ fontSize: 14, color: "#111827" }}>
                Registrar como gasto en presupuesto
              </span>
            </div>
          )}
          {restockError && (
            <div style={{ color: rd, fontSize: 13, marginBottom: 12 }}>
              {restockError}
            </div>
          )}
          <button
            onClick={handleRestock}
            disabled={rSaving}
            style={{
              width: "100%",
              padding: "14px 0",
              background: G,
              color: wh,
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: rSaving ? "not-allowed" : "pointer",
              opacity: rSaving ? 0.7 : 1,
            }}
          >
            {rSaving ? "Guardando..." : "Confirmar reabastecimiento"}
          </button>
        </Sheet>
      )}

      {showDetail && (
        <Sheet onClose={() => setShowDetail(null)} title={showDetail.name} swipeToClose>
          {showDetail.image_url && (
            <img
              src={showDetail.image_url}
              alt={showDetail.name}
              style={{
                width: "100%",
                maxHeight: 180,
                objectFit: "contain",
                borderRadius: 10,
                background: "#F9FAFB",
                marginBottom: 16,
              }}
            />
          )}
          <div
            style={{
              background: "#F9FAFB",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 12, color: mu, marginBottom: 4 }}>
              Stock actual estimado
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
              {Math.max(
                0,
                Math.round(
                  calcDaysRemaining(showDetail) *
                    showDetail.consumption_per_day,
                ),
              )}{" "}
              {showDetail.unit}
            </div>
            <div style={{ fontSize: 13, color: mu, marginTop: 2 }}>
              ~{Math.round(calcDaysRemaining(showDetail))} días ·{" "}
              {showDetail.consumption_per_day} {showDetail.unit}/día
              {showDetail.units_per_pack && (
                <span> · 📦 cajas de {showDetail.units_per_pack}</span>
              )}
            </div>
          </div>

          {canEdit && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 20,
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    setShowDetail(null);
                    openRestock(showDetail);
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    background: G,
                    color: wh,
                    border: "none",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Reabastecer
                </button>
                <button
                  onClick={() => {
                    setShowDetail(null);
                    openAdjust(showDetail);
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    background: wh,
                    color: "#111827",
                    border: `1.5px solid ${bd}`,
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Ajustar
                </button>
                {canDelete && (
                  <button
                    onClick={() => {
                      setShowDetail(null);
                      handleDeleteItem(showDetail);
                    }}
                    style={{
                      padding: "10px 14px",
                      background: wh,
                      color: rd,
                      border: `1.5px solid #FECACA`,
                      borderRadius: 8,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setShowDetail(null);
                  openEditItem(showDetail);
                }}
                style={{
                  width: "100%",
                  padding: "10px 0",
                  background: "none",
                  border: `1.5px solid ${bd}`,
                  borderRadius: 8,
                  fontSize: 14,
                  color: "#111827",
                  cursor: "pointer",
                }}
              >
                ✏️ Editar artículo
              </button>
            </div>
          )}

          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: mu,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 10,
            }}
          >
            Historial de compras
          </div>

          {historyLoading ? (
            <div
              style={{
                textAlign: "center",
                color: mu,
                padding: 16,
                fontSize: 14,
              }}
            >
              Cargando...
            </div>
          ) : restockHistory.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: mu,
                padding: 16,
                fontSize: 13,
              }}
            >
              Sin historial de reabastecimientos
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {restockHistory.map((r) => {
                const pricePerUnit =
                  r.price && r.quantity ? r.price / r.quantity : null;
                return (
                  <div
                    key={r.id}
                    style={{
                      background: "#F9FAFB",
                      borderRadius: 10,
                      padding: "12px 14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 14,
                            color: "#111827",
                          }}
                        >
                          {r.brand || "Marca no especificada"}
                        </div>
                        {r.store && (
                          <div
                            style={{ fontSize: 12, color: mu, marginTop: 2 }}
                          >
                            📍 {r.store}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: mu, marginTop: 2 }}>
                          {r.quantity} {showDetail.unit} · {r.purchased_at}
                        </div>
                        {r.receipt_url && (
                          <button
                            onClick={() => setViewReceipt(r.receipt_url)}
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
                      <div
                        style={{
                          textAlign: "right",
                          flexShrink: 0,
                          marginLeft: 12,
                        }}
                      >
                        {r.price ? (
                          <>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 14,
                                color: "#111827",
                              }}
                            >
                              {fmtCurrency(r.price)}
                            </div>
                            {pricePerUnit && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: mu,
                                  marginTop: 2,
                                }}
                              >
                                {fmtCurrency(pricePerUnit)}/{showDetail.unit}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ fontSize: 12, color: mu }}>
                            Sin precio
                          </div>
                        )}
                      </div>
                    </div>
                    {r.notes && (
                      <div
                        style={{
                          fontSize: 12,
                          color: mu,
                          marginTop: 6,
                          borderTop: `1px solid ${bd}`,
                          paddingTop: 6,
                        }}
                      >
                        {r.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Sheet>
      )}

      {showUnitSheet && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            zIndex: 55,
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={() => setShowUnitSheet(false)}
        >
          <div
            style={{
              background: wh,
              borderRadius: "20px 20px 0 0",
              width: "100%",
              paddingBottom: 32,
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "20px 20px 12px",
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                borderBottom: `1px solid ${bd}`,
              }}
            >
              Unidad de medida
            </div>
            {UNITS.map((u) => {
              const activeUnit = unitSheetTarget === "edit" ? eUnit : iUnit;
              return (
                <button
                  key={u}
                  onClick={() => {
                    unitSheetTarget === "edit" ? setEUnit(u) : setIUnit(u);
                    setShowUnitSheet(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "15px 20px",
                    border: "none",
                    borderBottom: `1px solid ${bd}`,
                    background: activeUnit === u ? `${G}0D` : "none",
                    color: activeUnit === u ? G : "#111827",
                    fontSize: 15,
                    fontWeight: activeUnit === u ? 600 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                    boxSizing: "border-box",
                  }}
                >
                  {u}
                  {activeUnit === u && (
                    <span style={{ color: G, fontSize: 16 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showStoreSheet && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            zIndex: 55,
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={() => setShowStoreSheet(false)}
        >
          <div
            style={{
              background: wh,
              borderRadius: "20px 20px 0 0",
              width: "100%",
              paddingBottom: 32,
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "20px 20px 12px",
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                borderBottom: `1px solid ${bd}`,
              }}
            >
              Tienda
            </div>
            {["", ...STORES].map((s) => (
              <button
                key={s || "_none"}
                onClick={() => {
                  setRStore(s);
                  setShowStoreSheet(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "15px 20px",
                  border: "none",
                  borderBottom: `1px solid ${bd}`,
                  background: rStore === s ? `${G}0D` : "none",
                  color: rStore === s ? G : "#111827",
                  fontSize: 15,
                  fontWeight: rStore === s ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  boxSizing: "border-box",
                }}
              >
                {s || "Sin especificar"}
                {rStore === s && (
                  <span style={{ color: G, fontSize: 16 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAdjust && (
        <Sheet
          onClose={() => setShowAdjust(null)}
          title={`Ajustar · ${showAdjust.name}`}
        >
          <div
            style={{
              background: "#F9FAFB",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 12, color: mu, marginBottom: 2 }}>
              Stock estimado actual
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>
              ~
              {Math.max(
                0,
                Math.round(
                  calcDaysRemaining(showAdjust) *
                    showAdjust.consumption_per_day,
                ),
              )}{" "}
              {showAdjust.unit}
            </div>
          </div>
          <Field label={`Cantidad real que tienes ahora (${showAdjust.unit})`}>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={adjQuantity}
              onChange={(e) => setAdjQuantity(e.target.value)}
              min="0"
              step="1"
              style={inputSt}
              autoFocus
            />
          </Field>
          {adjError && (
            <div style={{ color: rd, fontSize: 13, marginBottom: 12 }}>
              {adjError}
            </div>
          )}
          <button
            onClick={handleAdjust}
            disabled={adjSaving}
            style={{
              width: "100%",
              padding: "14px 0",
              background: "#111827",
              color: wh,
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: adjSaving ? "not-allowed" : "pointer",
              opacity: adjSaving ? 0.7 : 1,
            }}
          >
            {adjSaving ? "Guardando..." : "Actualizar cantidad"}
          </button>
        </Sheet>
      )}
    </div>
  );
}
