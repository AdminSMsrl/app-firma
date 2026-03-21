import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { employeeId } = body;

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId mancante" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: "Dipendente non trovato" },
        { status: 404 }
      );
    }

    const { data: documents, error: documentsError } = await supabase
      .from("documents")
      .select("id, original_file_url, signed_file_url")
      .eq("employee_id", employeeId);

    if (documentsError) {
      return NextResponse.json(
        { error: documentsError.message },
        { status: 400 }
      );
    }

    if (documents && documents.length > 0) {
      for (const doc of documents) {
        if (doc.original_file_url) {
          const originalPath = doc.original_file_url.replace(
            "original-documents/",
            ""
          );

          await supabase.storage.from("original-documents").remove([originalPath]);
        }

        if (doc.signed_file_url) {
          const signedPath = doc.signed_file_url.replace(
            "signed-documents/",
            ""
          );

          await supabase.storage.from("signed-documents").remove([signedPath]);
        }

        await supabase
          .from("document_signatures")
          .delete()
          .eq("document_id", doc.id);

        await supabase.from("document_events").delete().eq("document_id", doc.id);
      }

      await supabase.from("documents").delete().eq("employee_id", employeeId);
    }

    const { data: signatures, error: signaturesError } = await supabase
      .from("stored_signatures")
      .select("id, signature_image_url")
      .eq("employee_id", employeeId);

    if (signaturesError) {
      return NextResponse.json(
        { error: signaturesError.message },
        { status: 400 }
      );
    }

    if (signatures && signatures.length > 0) {
      for (const sig of signatures) {
        if (sig.signature_image_url) {
          await supabase.storage
            .from("signatures")
            .remove([sig.signature_image_url]);
        }
      }

      await supabase
        .from("stored_signatures")
        .delete()
        .eq("employee_id", employeeId);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("employee_id", employeeId)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    if (profile?.id) {
      await supabase.from("profiles").delete().eq("id", profile.id);
      await supabase.auth.admin.deleteUser(profile.id);
    }

    const { error: deleteEmployeeError } = await supabase
      .from("employees")
      .delete()
      .eq("id", employeeId);

    if (deleteEmployeeError) {
      return NextResponse.json(
        { error: deleteEmployeeError.message },
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
