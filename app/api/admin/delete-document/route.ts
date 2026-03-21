import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "ID documento mancante" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (documentError || !document) {
      return NextResponse.json(
        { error: "Documento non trovato" },
        { status: 404 }
      );
    }

    if (document.original_file_url) {
      const originalPath = document.original_file_url.replace(
        "original-documents/",
        ""
      );

      await supabase.storage.from("original-documents").remove([originalPath]);
    }

    if (document.signed_file_url) {
      const signedPath = document.signed_file_url.replace(
        "signed-documents/",
        ""
      );

      await supabase.storage.from("signed-documents").remove([signedPath]);
    }

    await supabase.from("document_signatures").delete().eq("document_id", documentId);
    await supabase.from("document_events").delete().eq("document_id", documentId);

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}