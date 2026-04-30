import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

const G = "#059669",
  tx = "#111827",
  mu = "#6B7280",
  bd = "#E5E7EB",
  wh = "#FFFFFF";

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(form.email, form.password);
      } else {
        await signUp(form.email, form.password, form.name);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const input = (placeholder, key, type = "text") => (
    <input
      type={type}
      placeholder={placeholder}
      value={form[key]}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      style={{
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
      }}
    />
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F4F2ED",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: wh,
          borderRadius: 20,
          padding: 32,
          width: "100%",
          maxWidth: 380,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              color: mu,
              letterSpacing: 3,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            KuXtaL
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: tx }}>
            {mode === "login" ? "Bienvenido de vuelta" : "Crear cuenta"}
          </div>
          <div style={{ fontSize: 13, color: mu, marginTop: 4 }}>
            {mode === "login"
              ? "Ingresa a tu cuenta para continuar"
              : "Regístrate para empezar"}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          {mode === "register" && input("Nombre completo", "name")}
          {input("Correo electrónico", "email", "email")}
          {input("Contraseña", "password", "password")}

          {error && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                color: "#991B1B",
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 14,
              background: G,
              color: wh,
              border: "none",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? "Cargando..."
              : mode === "login"
                ? "Iniciar sesión"
                : "Registrarse"}
          </button>
        </form>

        <div
          style={{
            textAlign: "center",
            marginTop: 18,
            fontSize: 13,
            color: mu,
          }}
        >
          {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
          <span
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            style={{ color: G, fontWeight: 600, cursor: "pointer" }}
          >
            {mode === "login" ? "Regístrate" : "Inicia sesión"}
          </span>
        </div>
      </div>
    </div>
  );
}
