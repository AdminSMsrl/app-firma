"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type EmployeeType = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  company_name: string | null;
};

type DocumentType = {
  id: string;
  month: number;
  year: number;
  status: string;
  original_file_url: string;
  signed_file_url: string | null;
  uploaded_at: string;
  viewed_at: string | null;
  signed_at: string | null;
};

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [employee, setEmployee] = useState<EmployeeType | null>(null);
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState("");

  useEffect(() => {
    async function loadData() {
      const resolvedParams = await params;
      setEmployeeId(resolvedParams.id);

      const { data: employeeData, error: employeeError } = await supabase
        .from("employees")
        .select("id, first_name, last_name, email, phone, status, company_name")
        .eq("id", resolvedParams.id)
        .single();

      const { data: documentsData, error: documentsError } = await supabase
        .from("documents")
        .select("*")
        .eq("employee_id", resolvedParams.id)
        .order("uploaded_at", { ascending: false });

      if (employeeError) {
        console.error(employeeError);
        setMessage("Errore caricamento dipendente");
      }

      if (documentsError) {
        console.error(documentsError);
        setMessage("Errore caricamento documenti");
      }

      setEmployee(employeeData || null);
      setDocuments(documentsData || []);
      setLoading(false);
    }

    loadData();
  }, [params]);

  const handleUpdate = async () => {
    if (!employee) return;

    setMessage("");

    const response = await fetch("/api/admin/update-employee", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: employee.id,
        action: "update",
        data: {
          first_name: employee.first_name,
          last_name: employee.last_name,
          email: employee.email,
          phone: employee.phone,
          company_name: employee.company_name,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "Errore aggiornamento dipendente");
      return;
    }

    setMessage("Dipendente aggiornato correttamente");
  };

  const handleSuspend = async () => {
    if (!employee) return;

    setMessage("");

    const response = await fetch("/api/admin/update-employee", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: employee.id,
        action: "suspend",
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "Errore sospensione dipendente");
      return;
    }

    setEmployee({ ...employee, status: "suspended" });
    setMessage("Dipendente sospeso correttamente");
  };

  const handleDownload = async (fileUrl: string, bucket: string) => {
    const filePath = fileUrl.replace(`${bucket}/`, "");

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) {
      console.error(error);
      setMessage("Errore download documento");
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Caricamento dettaglio dipendente...</p>
      </main>
    );
  }

  if (!employee) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Dipendente non trovato</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black p-8">
      <section className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {employee.first_name} {employee.last_name}
            </h1>
            <p className="text-gray-600">ID dipendente: {employeeId}</p>
          </div>

          <a href="/admin" className="border rounded-lg px-4 py-2">
            Torna alla dashboard
          </a>
        </div>

        <div className="border rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Dati dipendente</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              value={employee.first_name}
              onChange={(e) =>
                setEmployee({ ...employee, first_name: e.target.value })
              }
              className="border rounded-lg px-4 py-2"
              placeholder="Nome"
            />

            <input
              type="text"
              value={employee.last_name}
              onChange={(e) =>
                setEmployee({ ...employee, last_name: e.target.value })
              }
              className="border rounded-lg px-4 py-2"
              placeholder="Cognome"
            />

            <input
              type="email"
              value={employee.email}
              onChange={(e) =>
                setEmployee({ ...employee, email: e.target.value })
              }
              className="border rounded-lg px-4 py-2"
              placeholder="Email"
            />

            <input
              type="text"
              value={employee.status}
              disabled
              className="border rounded-lg px-4 py-2 bg-gray-100"
              placeholder="Stato"
            />

            <input
              type="text"
              value={employee.company_name || ""}
              onChange={(e) =>
                setEmployee({ ...employee, company_name: e.target.value })
              }
              className="border rounded-lg px-4 py-2 md:col-span-2"
              placeholder="Appalto / Cliente"
            />
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleUpdate}
              className="bg-black text-white rounded-lg px-4 py-2"
            >
              Salva modifiche
            </button>

            <button
              onClick={handleSuspend}
              className="border rounded-lg px-4 py-2"
            >
              Sospendi dipendente
            </button>
          </div>

          {message && <p className="text-sm">{message}</p>}
        </div>

        <div className="border rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Documenti caricati</h2>

          {documents.length === 0 ? (
            <p>Nessun documento caricato per questo dipendente.</p>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="border rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div>
                    <p className="font-semibold">
                      Documento {doc.month}/{doc.year}
                    </p>
                    <p className="text-sm text-gray-600">
                      Stato: {doc.status}
                    </p>
                    <p className="text-sm text-gray-600">
                      Caricato il:{" "}
                      {new Date(doc.uploaded_at).toLocaleString("it-IT")}
                    </p>
                    {doc.signed_at && (
                      <p className="text-sm text-gray-600">
                        Firmato il:{" "}
                        {new Date(doc.signed_at).toLocaleString("it-IT")}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() =>
                        handleDownload(doc.original_file_url, "original-documents")
                      }
                      className="px-3 py-2 rounded-lg border"
                    >
                      PDF originale
                    </button>

                    {doc.signed_file_url && (
                      <button
                        onClick={() =>
                          handleDownload(doc.signed_file_url!, "signed-documents")
                        }
                        className="px-3 py-2 rounded-lg border"
                      >
                        PDF firmato
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
