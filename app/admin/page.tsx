"use client";

import { useEffect, useState } from "react";
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

type CompanyGroup = {
  name: string;
  totalEmployees: number;
  totalDocuments: number;
  signedDocuments: number;
  unsignedDocuments: number;
};

export default function AdminPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [documentType, setDocumentType] = useState("payslip");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const employeeCompanyByEmail = employees.reduce<Record<string, string>>(
    (acc, employee) => {
      acc[employee.email] = employee.company_name?.trim() || "Senza appalto";
      return acc;
    },
    {}
  );

  const companyGroups: CompanyGroup[] = Object.values(
    employees.reduce<Record<string, CompanyGroup>>((acc, employee) => {
      const companyName = employee.company_name?.trim() || "Senza appalto";

      if (!acc[companyName]) {
        acc[companyName] = {
          name: companyName,
          totalEmployees: 0,
          totalDocuments: 0,
          signedDocuments: 0,
          unsignedDocuments: 0,
        };
      }

      acc[companyName].totalEmployees += 1;

      return acc;
    }, {})
  )
    .map((group) => {
      const companyDocuments = documents.filter(
        (doc) => employeeCompanyByEmail[doc.email] === group.name
      );

      const signedDocuments = companyDocuments.filter(
        (doc) => doc.status === "signed"
      ).length;

      return {
        ...group,
        totalDocuments: companyDocuments.length,
        signedDocuments,
        unsignedDocuments: companyDocuments.length - signedDocuments,
      };
    })
    .sort((a, b) => b.totalEmployees - a.totalEmployees);

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
              Gestione appalti, dipendenti e documenti.
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

        <div className="border rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">
            Appalti / Clienti
          </h2>

          {companyGroups.length === 0 ? (
            <p>Nessun appalto presente.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {companyGroups.map((group) => (
                <a
                  key={group.name}
                  href={`/admin/companies/${encodeURIComponent(group.name)}`}
                  className="border rounded-xl p-4 shadow-sm block hover:bg-gray-50 transition space-y-2"
                >
                  <div>
                    <p className="font-semibold text-lg">{group.name}</p>
                    <p className="text-sm text-gray-500">
                      {group.totalEmployees}{" "}
                      {group.totalEmployees === 1
                        ? "dipendente"
                        : "dipendenti"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold bg-green-100 text-green-700 border-green-200">
                      Firmati: {group.signedDocuments}
                    </span>

                    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold bg-red-100 text-red-700 border-red-200">
                      Da firmare: {group.unsignedDocuments}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
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
              className="border rounded-lg px-4 py-2"
              value={employeeForm.password}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  password: e.target.value,
                })
              }
            />

            <input
              type="text"
              placeholder="Appalto / Cliente"
              className="border rounded-lg px-4 py-2 md:col-span-2"
              value={employeeForm.company_name}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  company_name: e.target.value,
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
      </section>
    </main>
  );
}
