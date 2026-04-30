import { useState, useEffect } from "react";
import { useFamily } from "../hooks/useFamily";

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

const ROLE_LABELS = {
  admin: "Administrador",
  caregiver: "Cuidador",
  viewer: "Observador",
  patient: "Paciente",
};
const ROLE_COLORS = {
  admin: "#7C3AED",
  caregiver: "#1D4ED8",
  viewer: "#6B7280",
  patient: G,
};
const ROLES = ["admin", "caregiver", "viewer", "patient"];

function RoleBadge({ role }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 20,
        background: `${ROLE_COLORS[role]}18`,
        color: ROLE_COLORS[role],
        border: `1px solid ${ROLE_COLORS[role]}44`,
      }}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

export default function FamilyScreen({
  userId,
  onViewPatient,
  viewingPatient,
  onRoleChange,
}) {
  const {
    groups,
    activeGroup,
    members,
    myRole,
    loading,
    createGroup,
    createInvitation,
    joinWithCode,
    changeRole,
    removeMember,
    selectGroup,
    deleteGroup,
  } = useFamily(userId);

  const [view, setView] = useState("main");
  const [form, setForm] = useState({ name: "", code: "", invRole: "viewer" });
  const [invitation, setInvitation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const isAdmin = myRole === "admin";
  // Notifica a App.jsx cuando cambia el rol del usuario en el grupo activo
  useEffect(() => {
    if (onRoleChange) onRoleChange(myRole);
  }, [myRole]);

  function flash(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await createGroup(form.name.trim());
      setForm((f) => ({ ...f, name: "" }));
      flash("ok", "Grupo creado. ¡Ya eres administrador!");
      setView("main");
    } catch (e) {
      flash("err", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!form.code.trim()) return;
    setBusy(true);
    try {
      const name = await joinWithCode(form.code);
      setForm((f) => ({ ...f, code: "" }));
      flash("ok", `Te uniste al grupo "${name}" correctamente`);
      setView("main");
    } catch (e) {
      flash("err", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite() {
    setBusy(true);
    try {
      const inv = await createInvitation(activeGroup.id, form.invRole);
      setInvitation(inv);
      setView("invite");
    } catch (e) {
      flash("err", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleChangeRole(membershipId, newRole) {
    setBusy(true);
    try {
      await changeRole(membershipId, newRole);
      flash("ok", "Rol actualizado");
    } catch (e) {
      flash("err", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(membershipId, name) {
    if (!confirm(`¿Expulsar a ${name} del grupo?`)) return;
    setBusy(true);
    try {
      await removeMember(membershipId);
      flash("ok", `${name} fue removido del grupo`);
    } catch (e) {
      flash("err", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteGroup() {
    if (
      !confirm(
        `¿Eliminar el grupo "${activeGroup.name}"? Esta acción no se puede deshacer.`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteGroup(activeGroup.id);
      flash("ok", "Grupo eliminado correctamente");
    } catch (e) {
      flash("err", e.message);
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    border: `1.5px solid ${bd}`,
    borderRadius: 10,
    fontSize: 14,
    color: tx,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    marginBottom: 12,
  };

  const btn = (color = "#111827", outline = false) => ({
    width: "100%",
    padding: 13,
    background: outline ? "transparent" : color,
    color: outline ? color : wh,
    border: outline ? `1.5px solid ${color}` : "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 8,
    transition: "opacity .15s",
  });

  if (loading)
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: mu,
          fontFamily: "system-ui",
        }}
      >
        Cargando grupos...
      </div>
    );

  return (
    <div
      style={{
        background: bg,
        minHeight: "100vh",
        fontFamily: "system-ui,-apple-system,sans-serif",
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
            style={{ color: wh, fontSize: 16, fontWeight: 600, marginTop: 2 }}
          >
            Grupos familiares
          </div>
        </div>
        {view !== "main" && (
          <button
            onClick={() => {
              setView("main");
              setInvitation(null);
            }}
            style={{
              background: "#1F2937",
              border: "none",
              borderRadius: 20,
              padding: "5px 14px",
              color: "#9CA3AF",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ← Volver
          </button>
        )}
      </div>

      <div style={{ padding: "14px 14px 28px" }}>
        {/* Mensaje flash */}
        {msg && (
          <div
            style={{
              background: msg.type === "ok" ? "#ECFDF5" : "#FEF2F2",
              border: `1px solid ${msg.type === "ok" ? "#6EE7B7" : "#FCA5A5"}`,
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 12,
              fontSize: 13,
              color: msg.type === "ok" ? "#065F46" : "#991B1B",
            }}
          >
            {msg.type === "ok" ? "✅" : "❌"} {msg.text}
          </div>
        )}

        {/* ── MAIN ── */}
        {view === "main" && (
          <>
            {/* Sin grupos */}
            {groups.length === 0 && (
              <div
                style={{
                  ...card(),
                  textAlign: "center",
                  padding: "40px 20px",
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 44, marginBottom: 12 }}>👨‍👩‍👧</div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: tx,
                    marginBottom: 6,
                  }}
                >
                  Sin grupos aún
                </div>
                <div style={{ fontSize: 13, color: mu }}>
                  Crea un grupo o únete con un código de invitación
                </div>
              </div>
            )}

            {/* Lista de grupos */}
            {groups.length > 0 && (
              <div style={card()}>
                <div style={lbl10()}>Mis grupos</div>
                {groups.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => selectGroup(g)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: `1px solid ${bd}`,
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: tx }}>
                        {g.name}
                      </div>
                      <div style={{ fontSize: 11, color: mu, marginTop: 2 }}>
                        {activeGroup?.id === g.id
                          ? "● Activo"
                          : "Toca para seleccionar"}
                      </div>
                    </div>
                    <RoleBadge role={g.myRole} />
                  </div>
                ))}
              </div>
            )}

            {/* Grupo activo — miembros */}
            {activeGroup && (
              <div style={card()}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={lbl10({ marginBottom: 2 })}>Grupo activo</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: tx }}>
                      {activeGroup.name}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setView("manage")}
                      style={{
                        background: "#F3F4F6",
                        border: "none",
                        borderRadius: 20,
                        padding: "6px 14px",
                        fontSize: 12,
                        color: tx,
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      Gestionar
                    </button>
                  )}
                </div>

                <div style={lbl10()}>Miembros ({members.length})</div>
                {members.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 0",
                      borderBottom: `1px solid ${bd}`,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: `${ROLE_COLORS[m.role]}22`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 15,
                        flexShrink: 0,
                      }}
                    >
                      {m.profiles?.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: tx }}>
                        {m.profiles?.full_name || "(Sin nombre registrado)"}
                      </div>
                    </div>
                    <RoleBadge role={m.role} />
                  </div>
                ))}

                {members.length <= 1 && (
                  <button
                    onClick={handleDeleteGroup}
                    disabled={busy}
                    style={{
                      width: "100%",
                      marginTop: 20,
                      padding: 12,
                      background: "transparent",
                      color: "#DC2626",
                      border: "1.5px solid #FCA5A5",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🗑 Eliminar grupo
                  </button>
                )}

                {/* Pacientes del grupo — para ver sus datos */}
                {members.filter((m) => m.role === "patient").length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={lbl10()}>Ver datos de paciente</div>
                    {members
                      .filter(
                        (m) =>
                          m.role === "patient" && m.profiles?.id !== userId,
                      )
                      .map((m) => {
                        const isViewing = viewingPatient?.id === m.profiles?.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() =>
                              onViewPatient(
                                isViewing
                                  ? null
                                  : {
                                      id: m.profiles?.id,
                                      name: m.profiles?.full_name,
                                    },
                              )
                            }
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "12px 14px",
                              borderRadius: 12,
                              cursor: "pointer",
                              background: isViewing ? "#ECFDF5" : "#F9FAFB",
                              border: `1.5px solid ${isViewing ? G : bd}`,
                              marginBottom: 8,
                              transition: "all .2s",
                            }}
                          >
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: "50%",
                                background: `${G}22`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 16,
                                fontWeight: 700,
                                color: G,
                              }}
                            >
                              {m.profiles?.full_name?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: tx,
                                }}
                              >
                                {m.profiles?.full_name}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: mu,
                                  marginTop: 2,
                                }}
                              >
                                Paciente
                              </div>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: isViewing ? G : mu,
                              }}
                            >
                              {isViewing ? "✓ Viendo" : "Ver datos →"}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Acciones */}
            <button onClick={() => setView("create")} style={btn(G)}>
              + Crear nuevo grupo
            </button>
            <button onClick={() => setView("join")} style={btn(hd, true)}>
              Unirse con código
            </button>

            {isAdmin && activeGroup && (
              <div style={{ marginTop: 8 }}>
                <div style={lbl10({ marginBottom: 10 })}>
                  Invitar al grupo "{activeGroup.name}"
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      onClick={() => setForm((f) => ({ ...f, invRole: r }))}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 500,
                        border: `1.5px solid ${form.invRole === r ? ROLE_COLORS[r] : bd}`,
                        background:
                          form.invRole === r
                            ? `${ROLE_COLORS[r]}18`
                            : "#F9FAFB",
                        color: form.invRole === r ? ROLE_COLORS[r] : mu,
                        cursor: "pointer",
                      }}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleInvite}
                  disabled={busy}
                  style={btn("#7C3AED")}
                >
                  {busy
                    ? "Generando..."
                    : `Generar código para ${ROLE_LABELS[form.invRole]}`}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── CREAR GRUPO ── */}
        {view === "create" && (
          <div style={card({ padding: 22 })}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: tx,
                marginBottom: 6,
              }}
            >
              Crear nuevo grupo
            </div>
            <div style={{ fontSize: 13, color: mu, marginBottom: 20 }}>
              Serás el administrador del grupo
            </div>
            <div style={lbl10()}>Nombre del grupo</div>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ej. Familia García"
              style={inputStyle}
            />
            <button
              onClick={handleCreate}
              disabled={busy || !form.name.trim()}
              style={btn(G)}
            >
              {busy ? "Creando..." : "Crear grupo"}
            </button>
          </div>
        )}

        {/* ── UNIRSE ── */}
        {view === "join" && (
          <div style={card({ padding: 22 })}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: tx,
                marginBottom: 6,
              }}
            >
              Unirse a un grupo
            </div>
            <div style={{ fontSize: 13, color: mu, marginBottom: 20 }}>
              Pide el código de invitación al administrador del grupo
            </div>
            <div style={lbl10()}>Código de invitación</div>
            <input
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
              }
              placeholder="ej. AB3X7K"
              maxLength={6}
              style={{
                ...inputStyle,
                fontSize: 28,
                fontWeight: 700,
                textAlign: "center",
                letterSpacing: 6,
              }}
            />
            <button
              onClick={handleJoin}
              disabled={busy || form.code.length < 6}
              style={btn(G)}
            >
              {busy ? "Verificando..." : "Unirse al grupo"}
            </button>
          </div>
        )}

        {/* ── CÓDIGO GENERADO ── */}
        {view === "invite" && invitation && (
          <div style={card({ padding: 22, textAlign: "center" })}>
            <div style={{ fontSize: 13, color: mu, marginBottom: 8 }}>
              Código de invitación
            </div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: hd,
                letterSpacing: 8,
                fontVariantNumeric: "tabular-nums",
                marginBottom: 8,
              }}
            >
              {invitation.code}
            </div>
            <div style={{ marginBottom: 20 }}>
              <RoleBadge role={invitation.role} />
            </div>
            <div style={{ fontSize: 12, color: mu, marginBottom: 24 }}>
              Válido por 7 días · Compártelo por WhatsApp o mensaje
            </div>
            <button
              onClick={() => {
                const text = `Te invito a unirte a mi grupo en KuXtaL 🌿\n\nCódigo: ${invitation.code}\n\nDescarga la app y usa este código para unirte como ${ROLE_LABELS[invitation.role]}.`;
                if (navigator.share) navigator.share({ text });
                else
                  navigator.clipboard
                    .writeText(invitation.code)
                    .then(() => flash("ok", "Código copiado al portapapeles"));
              }}
              style={btn(G)}
            >
              Compartir código
            </button>
            <button onClick={() => setView("main")} style={btn(hd, true)}>
              Listo
            </button>
          </div>
        )}

        {/* ── GESTIONAR MIEMBROS ── */}
        {view === "manage" && isAdmin && (
          <div style={card()}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: tx,
                marginBottom: 4,
              }}
            >
              Gestionar miembros
            </div>
            <div style={{ fontSize: 12, color: mu, marginBottom: 16 }}>
              {activeGroup?.name}
            </div>

            {members.map((m) => {
              const isMe = m.profiles?.id === userId;
              return (
                <div
                  key={m.id}
                  style={{ padding: "12px 0", borderBottom: `1px solid ${bd}` }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: `${ROLE_COLORS[m.role]}22`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 15,
                      }}
                    >
                      {m.profiles?.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: tx }}>
                        {m.profiles?.full_name || "Paciente sin nombre"}
                      </div>
                    </div>
                    <RoleBadge role={m.role} />
                  </div>

                  {!isMe && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {ROLES.filter((r) => r !== m.role).map((r) => (
                        <button
                          key={r}
                          onClick={() => handleChangeRole(m.id, r)}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 500,
                            border: `1px solid ${ROLE_COLORS[r]}`,
                            background: "transparent",
                            color: ROLE_COLORS[r],
                            cursor: "pointer",
                          }}
                        >
                          → {ROLE_LABELS[r]}
                        </button>
                      ))}
                      <button
                        onClick={() =>
                          handleRemove(m.id, m.profiles?.full_name)
                        }
                        style={{
                          padding: "5px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 500,
                          border: "1px solid #FCA5A5",
                          background: "transparent",
                          color: "#DC2626",
                          cursor: "pointer",
                        }}
                      >
                        Expulsar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
