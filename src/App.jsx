import { useAuth } from "./hooks/useAuth";
import { useReadings } from "./hooks/useReadings";
import AuthScreen from "./components/AuthScreen";
import MainApp from "./pages/MainApp";

export default function App() {
  const { user, profile, loading, signOut } = useAuth();

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui",
          color: "#6B7280",
          fontSize: 14,
        }}
      >
        Cargando KuXtaL...
      </div>
    );

  if (!user) return <AuthScreen />;

  return <MainApp user={user} profile={profile} signOut={signOut} />;
}
