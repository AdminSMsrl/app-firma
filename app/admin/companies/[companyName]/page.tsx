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

  const getDocumentStatusClass = (status: string) => {
    if (status === "signed") return "bg-green-100 text-green-700 border-green-200";
    if (status === "viewed") return "bg-yellow-100 text-yellow-700 border-yellow-200";
    if (status === "available") return "bg-red-100 text-red-700 border-red-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  const employeesById = employees.reduce<Record<string, Employee>>(
    (acc, employee) => {
      acc[employee.id] = employee;
      return acc;
    },
    {}
  );

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
            <p className="text-gray-600">Dashboard appalto / cliente</p>
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
            <p className="text-2xl font-bold">
              {documents.filter((doc) => doc.status !== "signed").length}
            </p>
          </div>
        </div>

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
          <h2 className="text-xl font-semibold mb-4">Dipendenti</h2>

          {employees.length === 0 ? (
            <p>Nessun dipendente presente per questo appalto.</p>
          ) : (
            <div className="overflow-auto max-h-[360px] border rounded-xl">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-left">
                    <th className="py-2 px-3">Dipendente</th>
                    <th className="py-2 px-3">Email</th>
                    <th className="py-2 px-3">Stato</th>
                  </tr>
                </thead>

                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} className="border-b">
                      <td className="py-2 px-3">
                        <a
                          href={`/admin/employees/${employee.id}`}
                          className="underline font-medium"
                        >
                          {employee.last_name} {employee.first_name}
                        </a>
                      </td>

                      <td className="py-2 px-3">{employee.email}</td>

                      <td className="py-2 px-3">{employee.status}</td>
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
            <p>Nessun documento presente per questo appalto.</p>
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
                  {documents.map((doc) => {
                    const employee = employeesById[doc.employee_id];

                    return (
                      <tr key={doc.id} className="border-b">
                        <td className="py-2 px-3">
                          {employee
                            ? `${employee.last_name} ${employee.first_name}`
                            : "Dipendente"}
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
