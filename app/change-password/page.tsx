"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    setMessage("");

    if (!password || !confirmPassword) {
      setMessage("Compila tutti i campi");
      return;
    }

    if (password.length < 6) {
      setMessage("La password deve avere almeno 6 caratteri");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Le password non coincidono");
      return;
    }

    setLoading(true);

    const { error: passwordError } = await supabase.auth.updateUser({
      password: password,
    });

    if (passwordError) {
      console.error(passwordError);
      setMessage(`Errore aggiornamento password: ${passwordError.message}`);
      setLoading(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(userError);
      setMessage("Utente non autenticato");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/update-password-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: user.id }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "Errore aggiornamento stato password");
      setLoading(false);
      return;
    }

    setMessage("Password aggiornata correttamente");

    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 800);
  };

  return (
    <main className="min-h-screen bg-white text-black flex items-center justify-center p-6">
      <section className="max-w-md w-full border rounded-2xl p-6 shadow-sm space-y-4">
        <h1 className="text-2xl font-bold">Cambia password</h1>

        <p className="text-sm text-gray-600">
          Per motivi di sicurezza devi impostare una nuova password.
        </p>

        <input
          type="password"
          placeholder="Nuova password"
          className="border rounded-lg px-4 py-2 w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="Conferma password"
          className="border rounded-lg px-4 py-2 w-full"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button
          onClick={handleChangePassword}
          disabled={loading}
          className="w-full bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Salvataggio..." : "Salva nuova password"}
        </button>

        {message && <p className="text-sm text-red-600">{message}</p>}
      </section>
    </main>
  );
}