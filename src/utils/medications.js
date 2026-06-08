// Lógica de pautas de medicación: qué toca tomar en una fecha dada.
// Reglas de fecha (ver CLAUDE.md): las columnas date son strings "YYYY-MM-DD"
// y la comparación de días se hace a medianoche local con new Date(y, m, d),
// nunca con epochs de toISOString ni restas de milisegundos sobre strings.

// Parsea "YYYY-MM-DD" a un Date a medianoche local.
function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Días enteros entre dos fechas locales (b - a). Asume medianoche local.
function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// Convierte un Date local a string "YYYY-MM-DD".
export function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const DOW_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// ¿La pauta aplica en la fecha dada? dateStr es "YYYY-MM-DD" (fecha local).
export function scheduleAppliesOn(schedule, dateStr) {
  if (!schedule.active) return false;
  if (schedule.frequency_type === "as_needed") return false;

  const date = parseDate(dateStr);
  const start = parseDate(schedule.start_date);
  if (date < start) return false;
  if (schedule.end_date && date > parseDate(schedule.end_date)) return false;

  switch (schedule.frequency_type) {
    case "daily":
      return true;
    case "every_n_days": {
      const n = schedule.interval_days || 1;
      return daysBetween(start, date) % n === 0;
    }
    case "days_of_week":
      return (schedule.days_of_week || []).includes(date.getDay());
    default:
      return false;
  }
}

// Dosis diaria implícita de una pauta (para derivar consumption_per_day).
export function dailyDose(schedule) {
  if (!schedule.active) return 0;
  const perTake = Number(schedule.dose) || 0;
  const takes = (schedule.times || []).length || 0;
  switch (schedule.frequency_type) {
    case "daily":
      return perTake * takes;
    case "every_n_days":
      return (perTake * takes) / (schedule.interval_days || 1);
    case "days_of_week":
      return (perTake * takes * (schedule.days_of_week || []).length) / 7;
    case "as_needed":
    default:
      return 0;
  }
}

// Etiqueta legible de frecuencia.
export function frequencyLabel(schedule) {
  switch (schedule.frequency_type) {
    case "daily":
      return "Todos los días";
    case "every_n_days": {
      const n = schedule.interval_days || 1;
      return n === 1 ? "Todos los días" : `Cada ${n} días`;
    }
    case "days_of_week": {
      const days = (schedule.days_of_week || []).slice().sort();
      return days.length ? days.map((d) => DOW_LABELS[d]).join(", ") : "Días seleccionados";
    }
    case "as_needed":
      return "Según necesidad";
    default:
      return "";
  }
}

// Construye las tomas de un día: una fila por cada horario de cada pauta
// aplicable, ordenadas por hora, con la toma registrada (si existe).
// `intakes` son los registros del día (scheduled_date === dateStr).
export function buildTodayDoses(schedules, intakes, dateStr) {
  const rows = [];
  for (const s of schedules) {
    if (!scheduleAppliesOn(s, dateStr)) continue;
    const item = s.inventory_item || {};
    for (const time of s.times || []) {
      const takenIntake = intakes.find(
        (i) =>
          i.schedule_id === s.id &&
          i.scheduled_date === dateStr &&
          i.scheduled_time === time
      );
      rows.push({
        key: `${s.id}-${time}`,
        scheduleId: s.id,
        itemId: s.item_id,
        itemName: item.name || "Medicamento",
        unit: item.unit || "",
        dose: Number(s.dose),
        time,
        takenIntake: takenIntake || null,
      });
    }
  }
  rows.sort((a, b) => a.time.localeCompare(b.time));
  return rows;
}

// Pautas "según necesidad" activas y vigentes en la fecha dada.
export function asNeededSchedules(schedules, dateStr) {
  const date = parseDate(dateStr);
  return schedules.filter((s) => {
    if (!s.active || s.frequency_type !== "as_needed") return false;
    if (date < parseDate(s.start_date)) return false;
    if (s.end_date && date > parseDate(s.end_date)) return false;
    return true;
  });
}
