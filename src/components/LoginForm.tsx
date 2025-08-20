"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginForm({ inline = false }: { inline?: boolean }) {
  const { login } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const nextParam = search.get("next") || "/profile";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (!ok) {
      setErr("Email o contraseña incorrectos.");
      return;
    }
    router.push(nextParam); // ← respeta ?next=
  }

  return (
    <section style={{ padding: inline ? 0 : "2rem" }}>
      <div
        style={{
          maxWidth: 420,
          margin: "0 auto",
          padding: "1.5rem",
          background: "#f9fdfb",
          borderRadius: 12,
          boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
        }}
      >
        {!inline && (
          <>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#210440" }}>
              Iniciar sesión
            </h1>
            <p style={{ marginBottom: "1rem", color: "#555" }}>
              Accede con tu correo y contraseña.
            </p>
          </>
        )}

        {err && (
          <div
            role="alert"
            style={{
              background: "#fdecea",
              border: "1px solid #f5c6cb",
              color: "#721c24",
              borderRadius: 8,
              padding: "0.6rem .8rem",
              marginBottom: ".8rem",
            }}
          >
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: ".75rem" }}>
          <input
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={input}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={input}
          />

          <button disabled={loading} type="submit" style={btnPrimary}>
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <div style={{ marginTop: ".75rem", textAlign: "center" }}>
          <span style={{ color: "#555", marginRight: ".4rem" }}>
            ¿No tenés cuenta?
          </span>
          <Link href="/register" style={btnLink}>
            Registrarse
          </Link>
        </div>
      </div>
    </section>
  );
}

const input: React.CSSProperties = {
  padding: ".75rem",
  border: "1px solid #dfe5e2",
  borderRadius: 10,
  fontSize: "1rem",
  background: "#fff",
};

const btnPrimary: React.CSSProperties = {
  marginTop: ".25rem",
  padding: ".8rem 1rem",
  background: "#57b87b",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(87,184,123,0.35)",
};

const btnLink: React.CSSProperties = {
  display: "inline-block",
  padding: ".45rem .8rem",
  borderRadius: 10,
  border: "1px solid #dfe5e2",
  textDecoration: "none",
  fontWeight: 600,
  color: "#210440",
  background: "#fff",
};
