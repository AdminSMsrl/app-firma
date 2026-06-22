"use client";

export default function CompanyPage() {
  return (
    <main className="min-h-screen bg-white text-black p-8">
      <section className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Dettaglio Appalto
            </h1>

            <p className="text-gray-500">
              Pagina in costruzione
            </p>
          </div>

          <a
            href="/admin"
            className="border rounded-lg px-4 py-2"
          >
            Torna alla Dashboard
          </a>
        </div>

        <div className="border rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">
            Appalto
          </h2>

          <p className="text-gray-600">
            Qui verranno mostrati:
          </p>

          <ul className="list-disc ml-6 mt-3 space-y-2">
            <li>Numero dipendenti</li>
            <li>Documenti firmati</li>
            <li>Documenti da firmare</li>
            <li>Elenco dipendenti</li>
            <li>Elenco documenti</li>
            <li>Download ZIP documenti firmati</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
