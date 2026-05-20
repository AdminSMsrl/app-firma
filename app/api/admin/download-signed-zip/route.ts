import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { month, year } = body;

    if (!month || !year) {
      return NextResponse.json(
        { error: "Mese e anno obbligatori" },
        { status: 400 }
      );
    }

    const { data: documents, error } = await supabase
      .from("document_overview")
      .select("*")
      .eq("month", month)
      .eq("year", year)
      .eq("status", "signed");

    if (error) {
      return NextResponse.json(
        { error: "Errore caricamento documenti" },
        { status: 500 }
      );
    }

    const zip = new JSZip();

    for (const doc of documents || []) {
      if (!doc.signed_file_url) continue;

      const filePath = doc.signed_file_url.replace(
        "signed-documents/",
        ""
      );

      const { data } = await supabase.storage
        .from("signed-documents")
        .download(filePath);

      if (!data) continue;

      const fileBuffer = await data.arrayBuffer();

      const documentLabel =
        doc.document_type === "tax_bonus_form"
          ? "Modulo imposta sostitutiva"
          : "Busta paga";

      const paddedMonth = String(doc.month).padStart(2, "0");

      const fileName = `${doc.last_name} ${doc.first_name} - ${documentLabel} - ${paddedMonth}-${doc.year}.pdf`;

      zip.file(fileName, fileBuffer);
    }

    const zipBlob = await zip.generateAsync({
      type: "nodebuffer",
    });

    return new NextResponse(zipBlob, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="Firmati-${month}-${year}.zip"`,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Errore generazione ZIP" },
      { status: 500 }
    );
  }
}
