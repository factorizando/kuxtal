import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import AuthScreen from "./components/AuthScreen";
import MainApp from "./pages/MainApp";
import FamilyScreen from "./pages/FamilyScreen";
import ProfileScreen from "./pages/ProfileScreen";
import BudgetScreen from "./pages/BudgetScreen";

const G = "#059669",
  mu = "#6B7280",
  bd = "#E5E7EB",
  wh = "#FFFFFF";

function Avatar({ profile, user, size = 36, onClick }) {
  const initials = (profile?.full_name || user?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        cursor: "pointer",
        background: profile?.avatar_url ? "transparent" : `${G}33`,
        border: `2px solid ${G}66`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        color: G,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt="avatar"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initials
      )}
    </div>
  );
}

export default function App() {
  const { user, profile, loading, signOut } = useAuth();
  const [screen, setScreen] = useState("app");
  const [viewingPatient, setViewingPatient] = useState(null);
  const [myRoleInGroup, setMyRoleInGroup] = useState(null);

  function handleViewPatient(patient) {
    setViewingPatient(patient);
    if (patient) setScreen("app");
  }

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui",
          color: mu,
          fontSize: 14,
        }}
      >
        Cargando KuXtaL...
      </div>
    );

  if (!user) return <AuthScreen />;

  // Pantalla de perfil — ocupa toda la pantalla
  if (screen === "profile")
    return <ProfileScreen onClose={() => setScreen("app")} signOut={signOut} />;

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,sans-serif" }}>
      {/* Banner: viendo datos de paciente */}
      {viewingPatient && screen === "app" && (
        <div
          style={{
            background: "#1D4ED8",
            color: wh,
            padding: "8px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 13,
            position: "sticky",
            top: 0,
            zIndex: 30,
          }}
        >
          <span>
            👁 Viendo datos de <strong>{viewingPatient.name}</strong>
          </span>
          <button
            onClick={() => setViewingPatient(null)}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              borderRadius: 20,
              padding: "3px 12px",
              color: wh,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Salir
          </button>
        </div>
      )}

      {/* Contenido */}
      <div style={{ paddingBottom: 70 }}>
        {screen === "app" && (
          <MainApp
            user={user}
            profile={profile}
            signOut={signOut}
            targetUserId={viewingPatient?.id || null}
            viewingPatient={viewingPatient}
            onOpenProfile={() => setScreen("profile")}
            myRoleInGroup={myRoleInGroup}
          />
        )}
        {screen === "family" && (
          <FamilyScreen
            userId={user.id}
            onViewPatient={handleViewPatient}
            viewingPatient={viewingPatient}
            onRoleChange={setMyRoleInGroup}
          />
        )}
        {screen === "budget" && <BudgetScreen userId={user.id} />}
      </div>

      {/* Navegación inferior */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: wh,
          borderTop: `1px solid ${bd}`,
          display: "flex",
        }}
      >
        {[
          ["app", "📊", "Mi salud"],
          ["family", "👨‍👩‍👧", "Familia"],
          ["budget", "💰", "Presupuesto"],
        ].map(([id, icon, lbl]) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              borderTop: `2.5px solid ${screen === id ? G : "transparent"}`,
              color: screen === id ? G : mu,
              transition: "color .15s",
            }}
          >
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div
              style={{
                fontSize: 11,
                fontWeight: screen === id ? 600 : 400,
                marginTop: 2,
              }}
            >
              {lbl}
            </div>
          </button>
        ))}

        {/* Avatar como botón de perfil */}
        <button
          onClick={() => setScreen("profile")}
          style={{
            flex: 1,
            padding: "6px 0",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderTop: `2.5px solid ${screen === "profile" ? G : "transparent"}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Avatar profile={profile} user={user} size={28} />
          <div
            style={{
              fontSize: 11,
              fontWeight: screen === "profile" ? 600 : 400,
              color: screen === "profile" ? G : mu,
            }}
          >
            Perfil
          </div>
        </button>
      </div>
    </div>
  );
}
