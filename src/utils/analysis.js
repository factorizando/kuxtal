export function getGluStatus(v, cfg) {
  if (v < cfg.hypo)
    return {
      label: "Hipoglucemia",
      color: "#DC2626",
      bg: "#FEF2F2",
      ring: "#FCA5A5",
    };
  if (v <= cfg.target_high)
    return {
      label: "En rango",
      color: "#059669",
      bg: "#ECFDF5",
      ring: "#6EE7B7",
    };
  if (v <= cfg.high)
    return {
      label: "Elevada",
      color: "#D97706",
      bg: "#FFFBEB",
      ring: "#FCD34D",
    };
  return {
    label: "Muy elevada",
    color: "#DC2626",
    bg: "#FEF2F2",
    ring: "#FCA5A5",
  };
}

export function getBPStatus(sys, dia) {
  if (sys < 120 && dia < 80)
    return {
      label: "Normal",
      color: "#059669",
      bg: "#ECFDF5",
      ring: "#6EE7B7",
      grade: 0,
    };
  if (sys < 130 && dia < 80)
    return {
      label: "Elevada",
      color: "#D97706",
      bg: "#FFFBEB",
      ring: "#FCD34D",
      grade: 1,
    };
  if (sys < 140 || dia < 90)
    return {
      label: "HTA Etapa 1",
      color: "#EA580C",
      bg: "#FFF7ED",
      ring: "#FDBA74",
      grade: 2,
    };
  if (sys < 180 && dia < 120)
    return {
      label: "HTA Etapa 2",
      color: "#DC2626",
      bg: "#FEF2F2",
      ring: "#FCA5A5",
      grade: 3,
    };
  return {
    label: "Crisis hipertensiva",
    color: "#7C3AED",
    bg: "#F5F3FF",
    ring: "#C4B5FD",
    grade: 4,
  };
}

export function getGluAlerts(data, cfg) {
  const al = [],
    r7 = data.slice(0, 7),
    l = data[0];
  if (!l) return al;
  if (l.value < cfg.hypo)
    al.push({
      lv: "danger",
      msg: `Hipoglucemia en el último registro: ${l.value} mg/dL`,
    });
  if (l.value > cfg.high)
    al.push({
      lv: "danger",
      msg: `Glucosa muy elevada: ${l.value} mg/dL. Consulta a tu médico.`,
    });
  const hypos = r7.filter((r) => r.value < cfg.hypo).length;
  if (hypos >= 2)
    al.push({
      lv: "warning",
      msg: `Patrón: ${hypos} hipoglucemias en los últimos 7 registros.`,
    });
  const highs = r7.filter((r) => r.value > cfg.target_high).length;
  if (highs >= 4)
    al.push({
      lv: "warning",
      msg: `${highs} de los últimos 7 registros superan el rango objetivo.`,
    });
  return al;
}

export function getBPAlerts(data) {
  const al = [],
    l = data[0];
  if (!l) return al;
  const st = getBPStatus(l.systolic, l.diastolic);
  if (st.grade >= 4)
    al.push({
      lv: "danger",
      msg: `Crisis hipertensiva: ${l.systolic}/${l.diastolic} mmHg. Busca atención médica de inmediato.`,
    });
  else if (st.grade >= 3)
    al.push({
      lv: "danger",
      msg: `Presión muy elevada: ${l.systolic}/${l.diastolic} mmHg (HTA Etapa 2).`,
    });
  const stage2 = data
    .slice(0, 7)
    .filter((r) => getBPStatus(r.systolic, r.diastolic).grade >= 3).length;
  if (stage2 >= 3)
    al.push({
      lv: "warning",
      msg: `Patrón: ${stage2} lecturas con HTA Etapa 2 en los últimos 7 registros.`,
    });
  return al;
}
