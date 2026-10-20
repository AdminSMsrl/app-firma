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
  id: string;
  employee_id: string;
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

export default function CompanyPage({
  params,
}: {
  params: Promise<{ companyName: string }>;
}) {
  const [companyName, setCompanyName] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [downloadingZip, setDownloadingZip] = useState("");

  const [employeeSearch, setEmployeeSearch] = useState("");

  useEffect(() => {
    async function loadData() {
      const resolvedParams = await params;
      const decodedCompanyName = decodeURIComponent(resolvedParams.companyName);

      setCompanyName(decodedCompanyName);

      const { data: employeesData, error: employeesError } = await supabase
        .from("employees")
        .select("id, first_name, last_name, email, status, company_name")
        .eq("company_name", decodedCompanyName)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });

      if (employeesError) {
        console.error(employeesError);
        setMessage("Errore caricamento dipendenti");
        setLoading(false);
        return;
      }

      const loadedEmployees = employeesData || [];
      setEmployees(loadedEmployees);

      const employeeIds = loadedEmployees.map((employee) => employee.id);

      if (employeeIds.length === 0) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      const { data: documentsData, error: documentsError } = await supabase
        .from("documents")
        .select(
          "id, employee_id, month, year, status, original_file_url, signed_file_url, uploaded_at, viewed_at, signed_at, document_type"
        )
        .in("employee_id", employeeIds)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .order("uploaded_at", { ascending: false });

      if (documentsError) {
        console.error(documentsError);
        setMessage("Errore caricamento documenti");
        setLoading(false);
        return;
      }

      setDocuments(documentsData || []);
      setLoading(false);
    }

    loadData();
  }, [params]);

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

  const employeesById = employees.reduce<Record<string, Employee>>(
    (acc, employee) => {
      acc[employee.id] = employee;
      return acc;
    },
    {}
  );

  const pendingDocuments = documents.filter((doc) => doc.status !== "signed");

  const filteredEmployees = employees.filter((employee) => {
    const query = employeeSearch.toLowerCase().trim();

    if (!query) return true;

    const fullText = `${employee.last_name} ${employee.first_name} ${employee.email} ${employee.status}`.toLowerCase();

    return fullText.includes(query);
  });

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

  const buildDownloadFileName = (doc: DocumentItem) => {
    const employee = employeesById[doc.employee_id];
    const employeeName = employee
      ? `${employee.last_name} ${employee.first_name}`.trim()
      : "Dipendente";

    const documentLabel = getDocumentTypeLabel(doc.document_type);
    const paddedMonth = String(doc.month).padStart(2, "0");

    return `${employeeName} - ${documentLabel} - ${paddedMonth}-${doc.year}.pdf`;
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
      link.download = `${companyName} - ${getDocumentCategoryLabel(
        category
      )} firmati ${getMonthName(month)} ${year}.zip`;

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

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white text-black">
        <p>Caricamento appalto...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black p-8">
      <section className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">{companyName}</h1>
            <p className="text-gray-600">Dashboard appalto / cliente aggiornata</p>
          </div>

          <a href="/admin" className="border rounded-lg px-4 py-2">
            Torna alla dashboard
          </a>
        </div>

        {message && <p className="text-sm text-red-600">{message}</p>}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Dipendenti</p>
            <p className="text-2xl font-bold">{employees.length}</p>
          </div>

          <div className="border rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Documenti</p>
            <p className="text-2xl font-bold">{documents.length}</p>
          </div>

          <div className="border rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Firmati</p>
            <p className="text-2xl font-bold">
              {documents.filter((doc) => doc.status === "signed").length}
            </p>
          </div>

          <div className="border rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Da firmare</p>
            <p className="text-2xl font-bold">{pendingDocuments.length}</p>
          </div>
        </div>

        {pendingDocuments.length > 0 && (
          <div className="border rounded-2xl p-6 shadow-sm bg-red-50 border-red-200">
            <h2 className="text-xl font-semibold mb-4 text-red-700">
              Documenti da firmare
            </h2>

            <div className="space-y-2">
              {pendingDocuments.slice(0, 8).map((doc) => {
                const employee = employeesById[doc.employee_id];

                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-4 border rounded-xl p-3 bg-white"
                  >
                    <div>
                      <p className="font-medium">
                        {employee
                          ? `${employee.last_name} ${employee.first_name}`
                          : "Dipendente"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {getDocumentTypeLabel(doc.document_type)} {doc.month}/
                        {doc.year} · {getDocumentStatusLabel(doc.status)}
                      </p>
                    </div>

                    <a
                      href={`/admin/employees/${doc.employee_id}`}
                      className="border rounded-lg px-3 py-1 text-sm"
                    >
                      Apri
                    </a>
                  </div>
                );
              })}
            </div>

            {pendingDocuments.length > 8 && (
              <p className="text-sm text-red-700 mt-3">
                Altri {pendingDocuments.length - 8} documenti richiedono
                attenzione.
              </p>
            )}
          </div>
        )}

        <div className="border rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">
            Riepilogo documenti per periodo
          </h2>

          {documentGroups.length === 0 ? (
            <p>Nessun documento presente.</p>
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
              <h2 className="text-xl font-semibold">Dipendenti</h2>
              <p className="text-sm text-gray-500">
                Visualizzati {filteredEmployees.length} su {employees.length}
              </p>
            </div>

            <input
              type="text"
              placeholder="Cerca dipendente"
              className="border rounded-lg px-4 py-2 w-full md:w-80"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
            />
          </div>

          {filteredEmployees.length === 0 ? (
            <p>Nessun dipendente trovato per questo appalto.</p>
          ) : (
            <div className="overflow-auto max-h-[360px] border rounded-xl">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-left">
                    <th className="py-2 px-3">Dipendente</th>
                    <th className="py-2 px-3">Stato</th>
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
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getEmployeeStatusClass(
                            employee.status
                          )}`}
                        >
                          {getEmployeeStatusLabel(employee.status)}
                        </span>
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