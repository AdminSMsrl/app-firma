"use client";

import { useEffect, useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  company_name: string | null;
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
  document_type?: string | null;
};

type DocumentGroup = {
  key: string;
  month: number;
  year: number;
  category: "payslip" | "other";
  total: number;
  signed: number;
  viewed: number;
  available: number;
};

export default function AdminPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentPeriodFilter, setDocumentPeriodFilter] = useState("all");
  const [documentStatusFilter, setDocumentStatusFilter] = useState("all");
  const [documentTypeFilter, setDocumentTypeFilter] = useState("all");

  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [documentType, setDocumentType] = useState("payslip");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState("");

  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    first_name: "",
    last_name: "",
    company_name: "",
    email: "",
    password: "",
  });

  async function loadData() {
    const { data: employeesData, error: employeesError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, email, status, company_name")
      .order("company_name", { ascending: true })
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

  const getMonthName = (monthNumber: number) => {
    const months = [
      "Gennaio",
      "Febbraio",
      "Marzo",
      "Aprile",
      "Maggio",
      "Giugno",
      "Luglio",
      "Agosto",
      "Settembre",
      "Ottobre",
      "Novembre",
      "Dicembre",
    ];

    return months[monthNumber - 1] || `Mese ${monthNumber}`;
  };

  const getDocumentCategory = (type?: string | null): "payslip" | "other" => {
    return !type || type === "payslip" ? "payslip" : "other";
  };

  const getDocumentCategoryLabel = (category: "payslip" | "other") => {
    if (category === "payslip") return "Buste paga";
    return "Altri documenti";
  };

  const documentGroups: DocumentGroup[] = Object.values(
    documents.reduce<Record<string, DocumentGroup>>((acc, doc) => {
      const category = getDocumentCategory(doc.document_type);
      const key = `${doc.year}-${doc.month}-${category}`;

      if (!acc[key]) {
        acc[key] = {
          key,
          month: doc.month,
          year: doc.year,
          category,
          total: 0,
          signed: 0,
          viewed: 0,
          available: 0,
        };
      }

      acc[key].total += 1;

      if (doc.status === "signed") acc[key].signed += 1;
      if (doc.status === "viewed") acc[key].viewed += 1;
      if (doc.status === "available") acc[key].available += 1;

      return acc;
    }, {})
  ).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    if (b.month !== a.month) return b.month - a.month;
    if (a.category === "payslip" && b.category === "other") return -1;
    if (a.category === "other" && b.category === "payslip") return 1;
    return 0;
  });

  const documentPeriods = Object.values(
    documents.reduce<Record<string, { key: string; label: string }>>(
      (acc, doc) => {
        const key = `${doc.year}-${doc.month}`;

        if (!acc[key]) {
          acc[key] = {
            key,
            label: `${getMonthName(doc.month)} ${doc.year}`,
          };
        }

        return acc;
      },
      {}
    )
  );

  const getDocumentTypeLabel = (type?: string | null) => {
    if (type === "tax_bonus_form") return "Modulo imposta sostitutiva";
    return "Busta paga";
  };

  const getDocumentStatusLabel = (status: string) => {
    if (status === "signed") return "Firmato";
    if (status === "viewed") return "Visualizzato";
    if (status === "available") return "Da firmare";
    return status;
  };

  const getEmployeeStatusLabel = (status: string) => {
    if (status === "active") return "Attivo";
    if (status === "suspended") return "Sospeso";
    return status;
  };

  const getEmployeeStatusClass = (status: string) => {
    if (status === "active") {
      return "bg-green-100 text-green-700 border-green-200";
    }

    if (status === "suspended") {
      return "bg-red-100 text-red-700 border-red-200";
    }

    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getDocumentStatusClass = (status: string) => {
    if (status === "signed") {
      return "bg-green-100 text-green-700 border-green-200";
    }

    if (status === "viewed") {
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    }

    if (status === "available") {
      return "bg-red-100 text-red-700 border-red-200";
    }

    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  const filteredEmployees = employees.filter((employee) => {
    const query = employeeSearch.toLowerCase().trim();

    if (!query) return true;

    const fullText = `${employee.last_name} ${employee.first_name} ${employee.email} ${
      employee.company_name || ""
    }`.toLowerCase();

    return fullText.includes(query);
  });

  const filteredDocuments = documents.filter((doc) => {
    const query = documentSearch.toLowerCase().trim();

    const fullText = `${doc.last_name} ${doc.first_name} ${doc.email} ${getDocumentTypeLabel(
      doc.document_type
    )} ${doc.month}/${doc.year}`.toLowerCase();

    const matchesSearch = !query || fullText.includes(query);
    const matchesPeriod =
      documentPeriodFilter === "all" ||
      documentPeriodFilter === `${doc.year}-${doc.month}`;
    const matchesStatus =
      documentStatusFilter === "all" || documentStatusFilter === doc.status;
    const matchesType =
      documentTypeFilter === "all" ||
      documentTypeFilter === (doc.document_type || "payslip");

    return matchesSearch && matchesPeriod && matchesStatus && matchesType;
  });

  const buildDownloadFileName = (doc: DocumentItem) => {
    const employeeName = `${doc.last_name} ${doc.first_name}`.trim();
    const documentLabel = getDocumentTypeLabel(doc.document_type);
    const paddedMonth = String(doc.month).padStart(2, "0");

    return `${employeeName} - ${documentLabel} - ${paddedMonth}-${doc.year}.pdf`;
  };

  const downloadFileFromSignedUrl = async (
    signedUrl: string,
    fileName: string
  ) => {
    const response = await fetch(signedUrl);

    if (!response.ok) {
      throw new Error("Errore durante il download del file");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();

    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const handleDownloadSignedZip = async (
    month: number,
    year: number,
    category: "payslip" | "other"
  ) => {
    const groupKey = `${year}-${month}-${category}`;

    try {
      setMessage("Preparazione archivio ZIP...");
      setDownloadingZip(groupKey);

      const signedDocuments = documents.filter(
        (doc) =>
          doc.month === month &&
          doc.year === year &&
          getDocumentCategory(doc.document_type) === category &&
          doc.status === "signed" &&
          doc.signed_file_url
      );

      if (signedDocuments.length === 0) {
        setMessage("Nessun PDF firmato disponibile per questa sezione");
        setDownloadingZip("");
        return;
      }

      const zip = new JSZip();

      for (const doc of signedDocuments) {
        if (!doc.signed_file_url) continue;

        const filePath = doc.signed_file_url.replace("signed-documents/", "");

        const { data, error } = await supabase.storage
          .from("signed-documents")
          .createSignedUrl(filePath, 3600);

        if (error || !data?.signedUrl) {
          console.error(error);
          continue;
        }

        const response = await fetch(data.signedUrl);

        if (!response.ok) continue;

        const blob = await response.blob();

        zip.file(buildDownloadFileName(doc), blob);
      }

      const zipBlob = await zip.generateAsync({
        type: "blob",
      });

      const objectUrl = URL.createObjectURL(zipBlob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${getDocumentCategoryLabel(category)} firmati ${getMonthName(
        month
      )} ${year}.zip`;

      document.body.appendChild(link);
      link.click();

      link.remove();
      URL.revokeObjectURL(objectUrl);

      setMessage("ZIP scaricato correttamente");
    } catch (error) {
      console.error(error);
      setMessage("Errore creazione archivio ZIP");
    }

    setDownloadingZip("");
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    const { first_name, last_name, company_name, email, password } =
      employeeForm;

    if (!first_name || !last_name || !company_name || !email || !password) {
      setMessage("Compila nome, cognome, appalto/cliente, email e password");
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
          company_name,
          email,
          password,
          tax_code: "",
          phone: "",
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
        company_name: "",
        email: "",
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

    if (!selectedEmployee || !documentType || !month || !year || !file) {
      setMessage("Compila tutti i campi e seleziona un PDF");
      return;
    }

    if (file.type !== "application/pdf") {
      setMessage("Puoi caricare solo file PDF");
      return;
    }

    setUploading(true);

    const safeFileName = `${selectedEmployee}-${documentType}-${month}-${year}-${Date.now()}.pdf`;
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
      document_type: documentType,
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
    setDocumentType("payslip");
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

  const handleDownloadOriginal = async (doc: DocumentItem) => {
    setMessage("");

    const filePath = doc.original_file_url.replace("original-documents/", "");

    const { data, error } = await supabase.storage
      .from("original-documents")
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) {
      console.error(error);
      setMessage("Errore nel download del PDF originale");
      return;
    }

    try {
      await downloadFileFromSignedUrl(data.signedUrl, buildDownloadFileName(doc));
    } catch (error) {
      console.error(error);
      setMessage("Errore nel download del PDF originale");
    }
  };

  const handleDownloadSigned = async (doc: DocumentItem) => {
    if (!doc.signed_file_url) {
      setMessage("PDF firmato non disponibile");
      return;
    }

    setMessage("");

    const filePath = doc.signed_file_url.replace("signed-documents/", "");

    const { data, error } = await supabase.storage
      .from("signed-documents")
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) {
      console.error(error);
      setMessage("Errore nel download del PDF firmato");
      return;
    }

    try {
      await downloadFileFromSignedUrl(data.signedUrl, buildDownloadFileName(doc));
    } catch (error) {
      console.error(error);
      setMessage("Errore nel download del PDF firmato");
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    const confirmed = window.confirm(
      "Sei sicuro di voler eliminare questo documento? L'operazione è definitiva."
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
              Gestione dipendenti e monitoraggio documenti.
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
              placeholder="Appalto / Cliente"
              className="border rounded-lg px-4 py-2"
              value={employeeForm.company_name}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  company_name: e.target.value,
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
              type="password"
              placeholder="Password iniziale"
              className="border rounded-lg px-4 py-2 md:col-span-2"
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
          <h2 className="text-xl font-semibold">Carica documento</h2>

          <form
            onSubmit={handleUpload}
            className="grid grid-cols-1 md:grid-cols-5 gap-4"
          >
            <select
              className="border rounded-lg px-4 py-2"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              <option value="">Seleziona dipendente</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.company_name ? `${employee.company_name} - ` : ""}
                  {employee.last_name} {employee.first_name}
                </option>
              ))}
            </select>

            <select
              className="border rounded-lg px-4 py-2"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
            >
              <option value="payslip">Busta paga</option>
              <option value="tax_bonus_form">Modulo imposta sostitutiva</option>
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
              className="md:col-span-5 bg-black text-white rounded-lg px-4 py-2 disabled:opacity-50"
            >
              {uploading ? "Caricamento..." : "Carica PDF"}
            </button>
          </form>
        </div>

        <div className="border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div>
              <h2 className="text-xl font-semibold">Dipendenti</h2>
              <p className="text-sm text-gray-500">
                Visualizzati {filteredEmployees.length} su {employees.length}
              </p>
            </div>

            <input
              type="text"
              placeholder="Cerca per nome, cognome, email o appalto"
              className="border rounded-lg px-4 py-2 w-full md:w-80"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
            />
          </div>

          {filteredEmployees.length === 0 ? (
            <p>Nessun dipendente trovato.</p>
          ) : (
            <div className="overflow-auto max-h-[360px] border rounded-xl">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-left">
                    <th className="py-2 px-3">Dipendente</th>
                    <th className="py-2 px-3">Appalto / Cliente</th>
                    <th className="py-2 px-3">Email</th>
                    <th className="py-2 px-3">Stato</th>
                    <th className="py-2 px-3">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b">
                      <td className="py-2 px-3">
                        <a
                          href={`/admin/employees/${employee.id}`}
                          className="underline font-medium"
                        >
                          {employee.last_name} {employee.first_name}
                        </a>
                      </td>
                      <td className="py-2 px-3">
                        {employee.company_name || "-"}
                      </td>
                      <td className="py-2 px-3">{employee.email}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getEmployeeStatusClass(
                            employee.status
                          )}`}
                        >
                          {getEmployeeStatusLabel(employee.status)}
                        </span>
                      </td>
                      <td className="py-2 px-3">
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
          <h2 className="text-xl font-semibold mb-4">
            Riepilogo documenti per periodo
          </h2>

          {documentGroups.length === 0 ? (
            <p>Nessun periodo presente.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {documentGroups.map((group) => (
                <div
                  key={group.key}
                  className="border rounded-2xl p-4 shadow-sm space-y-3"
                >
                  <div>
                    <p className="text-lg font-semibold">
                      {getMonthName(group.month)} {group.year}
                    </p>
                    <p className="text-sm text-gray-700 font-medium">
                      {getDocumentCategoryLabel(group.category)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {group.total} documenti totali
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold bg-green-100 text-green-700 border-green-200">
                      Firmati: {group.signed}
                    </span>

                    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold bg-yellow-100 text-yellow-700 border-yellow-200">
                      Visualizzati: {group.viewed}
                    </span>

                    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold bg-red-100 text-red-700 border-red-200">
                      Da firmare: {group.available}
                    </span>

                    <button
                      onClick={() =>
                        handleDownloadSignedZip(
                          group.month,
                          group.year,
                          group.category
                        )
                      }
                      disabled={
                        group.signed === 0 || downloadingZip === group.key
                      }
                      className="w-full mt-2 border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {downloadingZip === group.key
                        ? "Preparazione ZIP..."
                        : `Scarica ${getDocumentCategoryLabel(group.category)}`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div>
              <h2 className="text-xl font-semibold">Documenti</h2>
              <p className="text-sm text-gray-500">
                Visualizzati {filteredDocuments.length} su {documents.length}
              </p>
            </div>

            <input
              type="text"
              placeholder="Cerca documento o dipendente"
              className="border rounded-lg px-4 py-2 w-full md:w-80"
              value={documentSearch}
              onChange={(e) => setDocumentSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <select
              className="border rounded-lg px-4 py-2"
              value={documentPeriodFilter}
              onChange={(e) => setDocumentPeriodFilter(e.target.value)}
            >
              <option value="all">Tutti i periodi</option>
              {documentPeriods.map((period) => (
                <option key={period.key} value={period.key}>
                  {period.label}
                </option>
              ))}
            </select>

            <select
              className="border rounded-lg px-4 py-2"
              value={documentStatusFilter}
              onChange={(e) => setDocumentStatusFilter(e.target.value)}
            >
              <option value="all">Tutti gli stati</option>
              <option value="signed">Firmati</option>
              <option value="viewed">Visualizzati</option>
              <option value="available">Da firmare</option>
            </select>

            <select
              className="border rounded-lg px-4 py-2"
              value={documentTypeFilter}
              onChange={(e) => setDocumentTypeFilter(e.target.value)}
            >
              <option value="all">Tutti i tipi</option>
              <option value="payslip">Buste paga</option>
              <option value="tax_bonus_form">Modulo imposta sostitutiva</option>
            </select>
          </div>

          {filteredDocuments.length === 0 ? (
            <p>Nessun documento trovato.</p>
          ) : (
            <div className="overflow-auto max-h-[520px] border rounded-xl">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-left">
                    <th className="py-2 px-3">Dipendente</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Periodo</th>
                    <th className="py-2 px-3">Stato</th>
                    <th className="py-2 px-3">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.document_id} className="border-b">
                      <td className="py-2 px-3">
                        {doc.last_name} {doc.first_name}
                      </td>
                      <td className="py-2 px-3">
                        {getDocumentTypeLabel(doc.document_type)}
                      </td>
                      <td className="py-2 px-3">
                        {doc.month}/{doc.year}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getDocumentStatusClass(
                            doc.status
                          )}`}
                        >
                          {getDocumentStatusLabel(doc.status)}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleDownloadOriginal(doc)}
                            className="px-3 py-1 rounded-lg border"
                          >
                            PDF originale
                          </button>

                          <button
                            onClick={() => handleDownloadSigned(doc)}
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
