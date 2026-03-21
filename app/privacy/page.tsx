"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PrivacyPage() {
  const [checked, setChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!checked) {
      setMessage("Devi accettare l'informativa per continuare");
      return;
    }

    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Utente non autenticato");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ privacy_accepted: true })
      .eq("id", user.id);

    if (error) {
      console.error(error);
      setMessage("Errore salvataggio accettazione");
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  };

  return (
    <main className="min-h-screen bg-white text-black flex items-center justify-center p-6">
      <section className="max-w-xl w-full border rounded-2xl p-6 shadow-sm space-y-4">
        <h1 className="text-2xl font-bold">Informativa utilizzo piattaforma</h1>

        <div className="text-sm text-gray-700 space-y-3">
          <p>
            I tuoi dati personali (nome, email, documenti e firma grafica)
            saranno trattati esclusivamente per la gestione del rapporto di
            lavoro e la firma delle buste paga.
          </p>

          <p>
            I documenti firmati saranno archiviati digitalmente e resi
            disponibili tramite questa piattaforma.
          </p>

          <p>
            La firma apposta tramite questa applicazione ha valore di conferma
            della presa visione del documento.
          </p>
        </div>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span className="text-sm">
            Dichiaro di aver letto l'informativa e accetto l'utilizzo della
            piattaforma
          </span>
        </label>

        <button
          onClick={handleAccept}
          disabled={loading}
          className="w-full bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Salvataggio..." : "Continua"}
        </button>

        {message && <p className="text-sm text-red-600">{message}</p>}
      </section>
    </main>
  );
}