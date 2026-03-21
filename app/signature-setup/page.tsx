"use client";

import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { supabase } from "@/lib/supabase";

export default function SignatureSetupPage() {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [message, setMessage] = useState("");
  const [canvasWidth, setCanvasWidth] = useState(500);

  useEffect(() => {
    function updateCanvasWidth() {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;
      setCanvasWidth(width);
    }

    updateCanvasWidth();
    window.addEventListener("resize", updateCanvasWidth);

    return () => {
      window.removeEventListener("resize", updateCanvasWidth);
    };
  }, []);

  const clearSignature = () => {
    sigRef.current?.clear();
  };

  const handleSave = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setMessage("Disegna prima la firma");
      return;
    }

    setMessage("Salvataggio firma in corso...");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(userError);
      setMessage("Utente non autenticato");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("employee_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.employee_id) {
      console.error(profileError);
      setMessage("Profilo dipendente non trovato");
      return;
    }

    const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const filePath = `${profile.employee_id}/signature.png`;

    const { error: uploadError } = await supabase.storage
      .from("signatures")
      .upload(filePath, blob, {
        upsert: true,
        contentType: "image/png",
      });

    if (uploadError) {
      console.error(uploadError);
      setMessage(`Errore upload firma: ${uploadError.message}`);
      return;
    }

    const { error: deactivateError } = await supabase
      .from("stored_signatures")
      .update({ is_active: false })
      .eq("employee_id", profile.employee_id);

    if (deactivateError) {
      console.error(deactivateError);
      setMessage(
        `Errore aggiornamento firme precedenti: ${deactivateError.message}`
      );
      return;
    }

    const { error: insertError } = await supabase
      .from("stored_signatures")
      .insert({
        employee_id: profile.employee_id,
        signature_image_url: filePath,
        is_active: true,
      });

    if (insertError) {
      console.error(insertError);
      setMessage(`Errore salvataggio firma: ${insertError.message}`);
      return;
    }

    setMessage("Firma salvata correttamente");

    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1000);
  };

  return (
    <main className="min-h-screen bg-white text-black p-6 flex items-center justify-center">
      <div className="max-w-lg w-full border rounded-2xl shadow-sm p-6 space-y-4">
        <h1 className="text-3xl font-bold">Deposita firma</h1>

        <p className="text-gray-600">
          Disegna la tua firma nel riquadro qui sotto. Su telefono puoi usare il
          dito o il pennino.
        </p>

        <div
          ref={containerRef}
          className="border rounded-xl p-2 bg-white"
          style={{ touchAction: "none" }}
        >
          <SignatureCanvas
            ref={sigRef}
            penColor="black"
            backgroundColor="white"
            canvasProps={{
              width: canvasWidth,
              height: 200,
              className: "w-full h-[200px] rounded-lg",
              style: { touchAction: "none" },
            }}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={clearSignature}
            className="flex-1 border rounded-lg px-4 py-2"
          >
            Cancella
          </button>

          <button
            onClick={handleSave}
            className="flex-1 bg-black text-white rounded-lg px-4 py-2"
          >
            Salva firma
          </button>
        </div>

        {message && <p className="text-sm">{message}</p>}
      </div>
    </main>
  );
}
