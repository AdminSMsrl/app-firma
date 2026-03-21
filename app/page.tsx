"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("Accesso in corso...");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("Email o password non corretti");
      return;
    }

    const userId = data.user.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      setMessage("Profilo utente non trovato");
      return;
    }

    if (profile.role === "admin") {
      window.location.href = "/admin";
      return;
    }

    if (profile.role === "employee") {
      window.location.href = "/dashboard";
      return;
    }

    setMessage("Ruolo utente non valido");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-white text-black p-8">
      <div className="max-w-md w-full rounded-2xl shadow-lg border p-8 space-y-6">
        <h1 className="text-3xl font-bold">Login</h1>
        <p className="text-sm text-gray-600">
          Accedi alla piattaforma per visualizzare o gestire le buste paga.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded-lg px-4 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Inserisci la tua email"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full border rounded-lg px-4 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Inserisci la tua password"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-black text-white rounded-lg px-4 py-2"
          >
            Accedi
          </button>
        </form>

        {message && <p className="text-sm">{message}</p>}
      </div>
    </main>
  );
}