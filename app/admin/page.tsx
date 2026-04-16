"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
};

type DocumentItem = {
  document_id: string;
  first_name: string;
  last_name: string;
  email: string;
  month: number;
  year: number;
  status: string;
  original_file_url: string;
  signed_file_url: string | null;
  uploaded_at: string;
  viewed_at: string | null;
  signed_at: string | null;
};

export default function AdminPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    first_name: "",
    last_name: "",
    tax_code: "",
    email: "",
    phone: "",
    password: "",
  });

  async function loadData() {
    const { data: employeesData, error: employeesError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, status")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    const { data: documentsData, error: documentsError } = await supabase
      .from("document_overview")
      .select("*")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (employeesError) {
      console.error("Errore caricamento dipendenti:", employeesError);
      setMessage("Errore caricamento dipendenti");
    }

    if (documentsError) {
      console.error("Errore caricamento documenti:", documentsError);
      setMessage("Errore caricamento documenti");
    }

    setEmployees(employeesData || []);
    setDocuments(documentsData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    const { first_name, last_name, tax_code, email, phone, password } =
      employeeForm;

    if (!first_name || !last_name || !tax_code || !email || !password) {
      setMessage("Compila tutti i campi obbligatori del dipendente");
      return;
    }

    setCreatingEmployee(true);

    try {
      const response = await fetch("/api/admin/create-employee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name,
          last_name,
          tax_code,
          email,
          phone,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Errore creazione dipendente");
        setCreatingEmployee(false);
        return;
      }

      setMessage("Dipendente creato correttamente");
      setEmployeeForm({
        first_name: "",
        last_name: "",
        tax_code: "",
        email: "",
        phone: "",
        password: "",
      });

      await loadData();
    } catch (error) {
      console.error(error);
      setMessage("Errore imprevisto durante la creazione dipendente");
    }

    setCreatingEmployee(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!selectedEmployee || !month || !year || !file) {
      setMessage("Compila tutti i campi e seleziona un PDF");
      return;
    }

    if (file.type !== "application/pdf") {
      setMessage("Puoi caricare solo file PDF");
      return;
    }

    setUploading(true);

    const safeFileName = `${selectedEmployee}-${month}-${year}-${Date.now()}.pdf`;
    const storagePath = `${selectedEmployee}/${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("original-documents")
      .upload(storagePath, file, {
        upsert: true,
        contentType: "application/pdf",
      });

    if (uploadError) {
      console.error(uploadError);
      setMessage(`Errore upload PDF: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("documents").insert({
      employee_id: selectedEmployee,
      month: Number(month),
      year: Number(year),
      original_file_url: `original-documents/${storagePath}`,
      status: "available",
    });

    if (insertError) {
      console.error(insertError);
      setMessage(`Errore salvataggio documento: ${insertError.message}`);
      setUploading(false);
      return;
    }

    setMessage("PDF caricato correttamente");
    setSelectedEmployee("");
    setMonth("");
    setYear("");
    setFile(null);

    const fileInput = document.getElementById(
      "pdfFile"
    ) as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";

    await loadData();
    setUploading(false);
  };

  const handleDownloadOriginal = async (originalFileUrl: string) => {
    setMessage("");

    const filePath = originalFileUrl.replace("original-documents/", "");

    const { data, error } = await supabase.storage
      .from("original-documents")
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) {
      console.error(error);
      setMessage("Errore nel download del PDF originale");
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  const handleDownloadSigned = async (signedFileUrl: string | null) => {
    if (!signedFileUrl) {
      setMessage("PDF firmato non disponibile");
      return;
    }

    setMessage("");

    const filePath = signedFileUrl.replace("signed-documents/", "");

    const { data, error } = await supabase.storage
      .from("signed-documents")
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) {
      console.error(error);
      setMessage("Errore nel download del PDF firmato");
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  const handleDeleteDocument = async (documentId: string) => {
    const confirmed = window.confirm(
      "Sei sicuro di voler eliminare questa busta paga? L'operazione è definitiva."
    );

    if (!confirmed) return;

    setMessage("");

    try {
      const response = await fetch("/api/admin/delete-document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Errore eliminazione documento");
        return;
      }

      setMessage("Documento eliminato correttamente");
      await loadData();
    } catch (error) {
      console.error(error);
      setMessage("Errore imprevisto durante l'eliminazione del documento");
    }
  };

  const handleSuspendEmployee = async (employeeId: string) => {
    setMessage("");

    try {
      const response = await fetch("/api/admin/update-employee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: employeeId,
          action: "suspend",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Errore sospensione dipendente");
        return;
      }

      setMessage("Dipendente sospeso correttamente");
      await loadData();
    } catch (error) {
      console.error(error);
      setMessage("Errore imprevisto durante la sospensione");
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    const confirmed = window.confirm(
      "ATTENZIONE: stai per eliminare definitivamente il dipendente.\n\n" +
        "Verranno eliminati:\n" +
        "- accesso login\n" +
        "- firme salvate\n" +
        "- documenti caricati\n" +
        "- PDF firmati\n\n" +
        "Questa operazione NON è reversibile.\n\n" +
        "Vuoi continuare?"
    );

    if (!confirmed) return;

    setMessage("");

    try {
      const response = await fetch("/api/admin/delete-employee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Errore eliminazione dipendente");
        return;
      }

      setMessage("Dipendente eliminato correttamente");
      await loadData();
    } catch (error) {
      console.error(error);
      setMessage("Errore imprevisto durante l'eliminazione del dipendente");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Caricamento dashboard admin...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black p-8 space-y-8">
      <section className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Admin</h1>
            <p className="text-gray-600">
              Gestione dipendenti e monitoraggio buste paga.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="border rounded-lg px-4 py-2"
          >
            Logout
          </button>
        </div>

        {message && <p className="text-sm text-red-600">{message}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Dipendenti</p>
            <p className="text-2xl font-bold">{employees.length}</p>
          </div>
          <div className="border rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Documenti</p>
            <p className="text-2xl font-bold">{documents.length}</p>
          </div>
          <div className="border rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Documenti firmati</p>
            <p className="text-2xl font-bold">
              {documents.filter((doc) => doc.status === "signed").length}
            </p>
          </div>
        </div>

        <div className="border rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Crea dipendente</h2>

          <form
            onSubmit={handleCreateEmployee}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <input
              type="text"
              placeholder="Nome"
              className="border rounded-lg px-4 py-2"
              value={employeeForm.first_name}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  first_name: e.target.value,
                })
              }
            />

            <input
              type="text"
              placeholder="Cognome"
              className="border rounded-lg px-4 py-2"
              value={employeeForm.last_name}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  last_name: e.target.value,
                })
              }
            />

            <input
              type="text"
              placeholder="Codice fiscale"
              className="border rounded-lg px-4 py-2"
              value={employeeForm.tax_code}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  tax_code: e.target.value.toUpperCase(),
                })
              }
            />

            <input
              type="email"
              placeholder="Email"
              className="border rounded-lg px-4 py-2"
              value={employeeForm.email}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  email: e.target.value,
                })
              }
            />

            <input
              type="text"
              placeholder="Telefono"
              className="border rounded-lg px-4 py-2"
              value={employeeForm.phone}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  phone: e.target.value,
                })
              }
            />

            <input
              type="password"
              placeholder="Password iniziale"
              className="border rounded-lg px-4 py-2"
              value={employeeForm.password}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  password: e.target.value,
                })
              }
            />

            <button
              type="submit"
              disabled={creatingEmployee}
              className="md:col-span-2 bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50"
            >
              {creatingEmployee ? "Creazione..." : "Crea dipendente"}
            </button>
          </form>
        </div>

        <div className="border rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Carica busta paga</h2>

          <form
            onSubmit={handleUpload}
            className="grid grid-cols-1 md:grid-cols-4 gap-4"
          >
            <select
              className="border rounded-lg px-4 py-2"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              <option value="">Seleziona dipendente</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.last_name} {employee.first_name}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              max="12"
              placeholder="Mese"
              className="border rounded-lg px-4 py-2"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />

            <input
              type="number"
              min="2024"
              placeholder="Anno"
              className="border rounded-lg px-4 py-2"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />

            <input
              id="pdfFile"
              type="file"
              accept="application/pdf"
              className="border rounded-lg px-4 py-2"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            <button
              type="submit"
              disabled={uploading}
              className="md:col-span-4 bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50"
            >
              {uploading ? "Caricamento..." : "Carica PDF"}
            </button>
          </form>
        </div>

        <div className="border rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Dipendenti</h2>

          {employees.length === 0 ? (
            <p>Nessun dipendente presente.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Dipendente</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Stato</th>
                    <th className="py-2">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} className="border-b">
                      <td className="py-2">
                        <a
                          href={`/admin/employees/${employee.id}`}
                          className="underline"
                        >
                          {employee.last_name} {employee.first_name}
                        </a>
                      </td>
                      <td className="py-2">{employee.email}</td>
                      <td className="py-2">{employee.status}</td>
                      <td className="py-2">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleSuspendEmployee(employee.id)}
                            className="px-2 py-1 border rounded"
                          >
                            Sospendi
                          </button>

                          <button
                            onClick={() => handleDeleteEmployee(employee.id)}
                            className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                          >
                            Elimina definitivamente
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Documenti</h2>

          {documents.length === 0 ? (
            <p>Nessun documento presente.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Dipendente</th>
                    <th className="py-2">Periodo</th>
                    <th className="py-2">Stato</th>
                    <th className="py-2">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.document_id} className="border-b">
                      <td className="py-2">
                        {doc.last_name} {doc.first_name}
                      </td>
                      <td className="py-2">
                        {doc.month}/{doc.year}
                      </td>
                      <td className="py-2">{doc.status}</td>
                      <td className="py-2">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() =>
                              handleDownloadOriginal(doc.original_file_url)
                            }
                            className="px-3 py-1 rounded-lg border"
                          >
                            PDF originale
                          </button>

                          <button
                            onClick={() =>
                              handleDownloadSigned(doc.signed_file_url)
                            }
                            className="px-3 py-1 rounded-lg border"
                          >
                            PDF firmato
                          </button>

                          <button
                            onClick={() =>
                              handleDeleteDocument(doc.document_id)
                            }
                            className="px-3 py-1 rounded-lg border"
                          >
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
