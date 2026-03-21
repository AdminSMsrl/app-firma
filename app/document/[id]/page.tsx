"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

type DocType = {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  status: string;
  original_file_url: string;
  signed_file_url: string | null;
};

type SignatureType = {
  id: string;
  signature_image_url: string;
};

export default function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [doc, setDoc] = useState<DocType | null>(null);
  const [signature, setSignature] = useState<SignatureType | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [message, setMessage] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);

  useEffect(() => {
    async function loadDocument() {
      const resolvedParams = await params;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Utente non autenticato");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", user.id)
        .single();

      if (!profile?.employee_id) {
        setMessage("Profilo non trovato");
        return;
      }

      const { data: documentData, error: documentError } = await supabase
        .from("documents")
        .select("*")
        .eq("id", resolvedParams.id)
        .eq("employee_id", profile.employee_id)
        .single();

      if (documentError || !documentData) {
        setMessage("Documento non trovato");
        return;
      }

      setDoc(documentData);

      const { data: signatureData } = await supabase
        .from("stored_signatures")
        .select("id, signature_image_url")
        .eq("employee_id", profile.employee_id)
        .eq("is_active", true)
        .single();

      setSignature(signatureData || null);

      const originalPath = documentData.original_file_url.replace(
        "original-documents/",
        ""
      );

      const { data: signedUrlData } = await supabase.storage
        .from("original-documents")
        .createSignedUrl(originalPath, 3600);

      if (signedUrlData?.signedUrl) {
        setPdfUrl(signedUrlData.signedUrl);
      }

      await supabase.from("document_events").insert({
        document_id: resolvedParams.id,
        employee_id: profile.employee_id,
        event_type: "viewed",
      });

      if (documentData.status === "available") {
        await supabase
          .from("documents")
          .update({
            status: "viewed",
            viewed_at: new Date().toISOString(),
          })
          .eq("id", resolvedParams.id);
      }
    }

    loadDocument();
  }, [params]);

  const handleApplySignature = async () => {
    if (!doc || !signature) return;

    if (!confirmChecked) {
      setMessage("Devi confermare la dichiarazione prima di firmare");
      return;
    }

    setMessage("Firma in corso, attendi...");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Utente non autenticato");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("employee_id")
      .eq("id", user.id)
      .single();

    if (!profile?.employee_id) {
      setMessage("Profilo non trovato");
      return;
    }

    const originalPath = doc.original_file_url.replace("original-documents/", "");
    const signaturePath = signature.signature_image_url;

    const { data: originalSignedUrl } = await supabase.storage
      .from("original-documents")
      .createSignedUrl(originalPath, 3600);

    const { data: signatureSignedUrl } = await supabase.storage
      .from("signatures")
      .createSignedUrl(signaturePath, 3600);

    if (!originalSignedUrl?.signedUrl || !signatureSignedUrl?.signedUrl) {
      setMessage("Errore accesso ai file");
      return;
    }

    const pdfBytes = await fetch(originalSignedUrl.signedUrl).then((res) =>
      res.arrayBuffer()
    );
    const signatureBytes = await fetch(signatureSignedUrl.signedUrl).then((res) =>
      res.arrayBuffer()
    );

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pngImage = await pdfDoc.embedPng(signatureBytes);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width } = lastPage.getSize();

    const pngDims = pngImage.scale(0.34);

    // Firma spostata più in basso e più a destra
    const signatureX = width - pngDims.width - 25;
    const signatureY = 8;

    lastPage.drawImage(pngImage, {
      x: signatureX,
      y: signatureY,
      width: pngDims.width,
      height: pngDims.height,
    });

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const now = new Date().toLocaleString("it-IT");

    // Data separata dalla firma, più a sinistra
    lastPage.drawText(`Firmato il: ${now}`, {
      x: width - 260,
      y: 20,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    const signedPdfBytes = await pdfDoc.save();

    const signedBlob = new Blob([Buffer.from(signedPdfBytes)], {
      type: "application/pdf",
    });

    const signedPath = `${profile.employee_id}/document-${doc.id}-signed.pdf`;

    const { error: uploadSignedError } = await supabase.storage
      .from("signed-documents")
      .upload(signedPath, signedBlob, {
        upsert: true,
        contentType: "application/pdf",
      });

    if (uploadSignedError) {
      console.error(uploadSignedError);
      setMessage("Errore upload PDF firmato");
      return;
    }

    const consentText =
      "Confermo di apporre la mia firma elettronica al presente documento mediante utilizzo della firma grafica depositata sul mio account.";

    await supabase.from("document_signatures").insert({
      document_id: doc.id,
      employee_id: profile.employee_id,
      signed_at: new Date().toISOString(),
      consent_text: consentText,
      consent_confirmed: true,
      consent_confirmed_at: new Date().toISOString(),
    });

    await supabase
      .from("documents")
      .update({
        status: "signed",
        signed_at: new Date().toISOString(),
        signed_file_url: `signed-documents/${signedPath}`,
      })
      .eq("id", doc.id);

    await supabase.from("document_events").insert([
      {
        document_id: doc.id,
        employee_id: profile.employee_id,
        event_type: "signed",
      },
      {
        document_id: doc.id,
        employee_id: profile.employee_id,
        event_type: "downloaded_signed",
      },
    ]);

    setMessage("Documento firmato correttamente");

    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1200);
  };

  if (!doc) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white text-black">
        <p>{message || "Caricamento documento..."}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black p-8">
      <section className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Busta paga {doc.month}/{doc.year}
            </h1>
            <p className="text-gray-600">
              {doc.status === "signed"
                ? "Documento già firmato"
                : "Documento da firmare"}
            </p>
          </div>

          <a href="/dashboard" className="border rounded-lg px-4 py-2">
            Torna alla dashboard
          </a>
        </div>

        <div className="border rounded-2xl p-4 shadow-sm">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-[700px] rounded-lg"
              title="Anteprima PDF"
            />
          ) : (
            <p>Anteprima documento non disponibile.</p>
          )}
        </div>

        {doc.status !== "signed" && (
          <div className="border rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-xl font-semibold">Conferma firma</h2>

            <p>Prima di firmare, verifica il contenuto del documento.</p>

            <p className="text-sm text-gray-700">
              Confermo di apporre la mia firma elettronica al presente documento
              mediante utilizzo della firma grafica depositata sul mio account.
            </p>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
              />
              <span>Ho letto e confermo la dichiarazione sopra riportata.</span>
            </label>

            <button
              onClick={handleApplySignature}
              disabled={!confirmChecked}
              className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
            >
              Conferma e firma
            </button>
          </div>
        )}

        {doc.status === "signed" && (
          <div className="border rounded-2xl p-6 shadow-sm">
            <p className="text-green-700 font-medium">
              Questo documento è già stato firmato correttamente.
            </p>
          </div>
        )}

        {message && <p className="text-sm">{message}</p>}
      </section>
    </main>
  );
}
