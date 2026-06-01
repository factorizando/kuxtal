import { useState, useEffect, useRef } from "react";
import { useAuth } from "./hooks/useAuth";
import { supabase } from "./lib/supabase";
import AuthScreen from "./components/AuthScreen";
import MainApp from "./pages/MainApp";
import FamilyScreen from "./pages/FamilyScreen";
import ProfileScreen from "./pages/ProfileScreen";
import BudgetScreen from "./pages/BudgetScreen";
import ReportScreen from "./pages/ReportScreen";

const G = "#059669",
  mu = "#6B7280",
  bd = "#E5E7EB",
  wh = "#FFFFFF";


export default function App() {
  const { user, profile, loading, signOut } = useAuth();
  const [screen, setScreen] = useState("app");
  const [viewingPatient, setViewingPatient] = useState(null);
  const [myRoleInGroup, setMyRoleInGroup] = useState(null);
  const [patients, setPatients] = useState([]);

  const lastBackRef = useRef(0);
  const [exitToast, setExitToast] = useState(false);
  const exitToastTimerRef = useRef(null);

  function showExitToast() {
    setExitToast(true);
    clearTimeout(exitToastTimerRef.current);
    exitToastTimerRef.current = setTimeout(() => setExitToast(false), 2000);
  }

  const SCREENS = ["app", "family", "budget", "report"];
  function handleSwipeScreen(direction) {
    setScreen((cur) => {
      const i = SCREENS.indexOf(cur);
      if (direction === "left" && i < SCREENS.length - 1) return SCREENS[i + 1];
      if (direction === "right" && i > 0) return SCREENS[i - 1];
      if (direction === "right" && i === 0) {
        const now = Date.now();
        if (now - lastBackRef.current < 2000) {
          // second swipe within window — allow system exit
          return cur;
        }
        lastBackRef.current = now;
        showExitToast();
      }
      return cur;
    });
  }

  // History API: push initial guard so first back doesn't exit immediately
  useEffect(() => {
    history.pushState({ kuxtal: "main" }, "");
  }, []);

  // Push profile guard when entering profile screen
  useEffect(() => {
    if (screen === "profile") {
      history.pushState({ kuxtal: "profile" }, "");
    }
  }, [screen]);

  useEffect(() => {
    function onPop() {
      setScreen((cur) => {
        if (cur === "profile") return "app";
        // Main screens: double-back-to-exit
        const now = Date.now();
        if (now - lastBackRef.current < 2000) {
          // Second back within 2s — don't push guard, allow exit
          return cur;
        }
        lastBackRef.current = now;
        showExitToast();
        // Push guard again so the next back can be caught
        history.pushState({ kuxtal: "main" }, "");
        return cur;
      });
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Auto-detectar pacientes del grupo y preseleccionar el primero
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPatients([]);
    setMyRoleInGroup(null);
    setViewingPatient(null);
    if (!user) return;
    (async () => {
      const { data: myGroups } = await supabase
        .from("family_memberships")
        .select("group_id, role")
        .eq("user_id", user.id);

      if (!myGroups?.length) return;

      // Establecer rol del usuario en el grupo
      const firstRole = myGroups[0]?.role;
      if (firstRole) setMyRoleInGroup(firstRole);

      const groupIds = [...new Set(myGroups.map((g) => g.group_id))];

      const { data: patientMembers } = await supabase
        .from("family_memberships")
        .select("user_id, profiles(id, full_name)")
        .in("group_id", groupIds)
        .eq("role", "patient");

      // Deduplicar por user_id
      const seen = new Set();
      const unique = (patientMembers || [])
        .filter((m) => {
          if (seen.has(m.user_id)) return false;
          seen.add(m.user_id);
          return true;
        })
        .map((m) => ({
          id: m.profiles.id,
          name: m.profiles.full_name || "Paciente",
        }));

      setPatients(unique);

      // Preseleccionar primer paciente si el usuario logueado no es paciente
      const isUserPatient = unique.some((p) => p.id === user.id);
      if (!isUserPatient && unique.length > 0) {
        setViewingPatient((prev) => prev ?? unique[0]);
      }
    })();
  }, [user]);

  function handleViewPatient(patient) {
    setViewingPatient(patient);
    if (patient) setScreen("app");
  }

  if (loading)
    return (
      <div
        style={{
          minHeight: "100dvh",
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

  if (screen === "profile")
    return <ProfileScreen onClose={() => setScreen("app")} signOut={signOut} />;

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,sans-serif" }}>
      {/* Contenido */}
      <div style={{ paddingBottom: "calc(70px + env(safe-area-inset-bottom))" }}>
        {screen === "app" && (
          <MainApp
            user={user}
            profile={profile}
            signOut={signOut}
            targetUserId={viewingPatient?.id || null}
            viewingPatient={viewingPatient}
            onSelectPatient={setViewingPatient}
            patients={patients}
            onOpenProfile={() => setScreen("profile")}
            myRoleInGroup={myRoleInGroup}
            onSwipeScreen={handleSwipeScreen}
          />
        )}
        {screen === "family" && (
          <FamilyScreen
            userId={user.id}
            onViewPatient={handleViewPatient}
            viewingPatient={viewingPatient}
            onRoleChange={setMyRoleInGroup}
            onSwipeScreen={handleSwipeScreen}
          />
        )}
        {screen === "budget" && <BudgetScreen userId={user.id} onSwipeScreen={handleSwipeScreen} />}
        {screen === "report" && (
          <ReportScreen
            userId={user.id}
            profile={profile}
            viewingPatient={viewingPatient}
            onSwipeScreen={handleSwipeScreen}
          />
        )}
      </div>

      {/* Toast doble-gesto para salir */}
      {exitToast && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(82px + env(safe-area-inset-bottom))",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(17,24,39,0.88)",
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: 500,
            padding: "9px 20px",
            borderRadius: 24,
            zIndex: 50,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          Toca de nuevo para salir
        </div>
      )}

      {/* Navegación inferior */}
      <div
        className="bottom-nav"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: wh,
          borderTop: `1px solid ${bd}`,
          display: "flex",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {[
          ["app", "📊", "Salud"],
          ["family", "👨‍👩‍👧", "Familia"],
          ["budget", "💰", "Presupuesto"],
          ["report", "📋", "Informe"],
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
              WebkitTapHighlightColor: "transparent",
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

      </div>
    </div>
  );
}
