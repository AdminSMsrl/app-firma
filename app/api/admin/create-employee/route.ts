"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type DocumentItem = {
  id: string;
  month: number;
  year: number;
  status: string;
  original_file_url: string;
  signed_file_url: string | null;
};

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadMessage, setDownloadMessage] = useState("");

  useEffect(() => {
    async function loadEmployeeDocuments() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("employee_id, privacy_accepted")
        .eq("id", user.id)
        .single();

      if (!profile?.employee_id) {
        setLoading(false);
        return;
      }

      if (!profile.privacy_accepted) {
        window.location.href = "/privacy";
        return;
      }

      const { data: signature } = await supabase
        .from("stored_signatures")
        .select("id")
        .eq("employee_id", profile.employee_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!signature) {
        window.location.href = "/signature-setup";
        return;
      }

      const { data: docs } = await supabase
        .from("documents")
        .select("id, month, year, status, original_file_url, signed_file_url")
        .eq("employee_id", profile.employee_id)
        .order("uploaded_at", { ascending: false });

      setDocuments(docs || []);
      setLoading(false);
    }

    loadEmployeeDocuments();
  }, []);

  const handleDownloadSignedPdf = async (signedFileUrl: string | null) => {
    if (!signedFileUrl) {
      setDownloadMessage("PDF firmato non disponibile");
      return;
    }

    setDownloadMessage("");

    const filePath = signedFileUrl.replace("signed-documents/", "");

    const { data, error } = await supabase.storage
      .from("signed-documents")
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) {
      console.error(error);
      setDownloadMessage("Errore nel download del PDF firmato");
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const getStatusLabel = (status: string) => {
    if (status === "signed") return "Firmato";
    return "Da firmare";
  };

  const getStatusStyle = (status: string) => {
    if (status === "signed") {
      return "bg-green-100 text-green-700 border-green-200";
    }

    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white text-black">
        <p>Caricamento area dipendente...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black p-8">
      <section className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Area Dipendente</h1>
            <p className="text-gray-600">
              Qui puoi visualizzare e firmare le tue buste paga.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="border rounded-lg px-4 py-2"
          >
            Logout
          </button>
        </div>

        <div className="border rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Le tue buste paga</h2>

          {documents.length === 0 ? (
            <p>Nessun documento disponibile.</p>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="border rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div className="space-y-2">
                    <p className="font-semibold">
                      Busta paga {doc.month}/{doc.year}
                    </p>

                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm border ${getStatusStyle(
                        doc.status
                      )}`}
                    >
                      {getStatusLabel(doc.status)}
                    </span>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <a
                      href={`/document/${doc.id}`}
                      className="px-4 py-2 rounded-lg border inline-block"
                    >
                      Apri documento
                    </a>

                    {doc.status !== "signed" ? (
                      <a
                        href={`/document/${doc.id}`}
                        className="px-4 py-2 rounded-lg bg-black text-white inline-block"
                      >
                        Firma ora
                      </a>
                    ) : (
                      <button
                        onClick={() => handleDownloadSignedPdf(doc.signed_file_url)}
                        className="px-4 py-2 rounded-lg border"
                      >
                        Scarica PDF firmato
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {downloadMessage && (
            <p className="text-sm text-red-600 mt-4">{downloadMessage}</p>
          )}
        </div>
      </section>
    </main>
  );
}