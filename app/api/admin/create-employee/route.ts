import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { first_name, last_name, tax_code, email, phone, password } = body;

    if (!first_name || !last_name || !tax_code || !email || !password) {
      return NextResponse.json(
        { error: "Campi obbligatori mancanti" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: employeeData, error: employeeError } = await adminClient
      .from("employees")
      .insert({
        first_name,
        last_name,
        tax_code,
        email,
        phone,
        status: "active",
      })
      .select()
      .single();

    if (employeeError || !employeeData) {
      return NextResponse.json(
        { error: employeeError?.message || "Errore creazione dipendente" },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      await adminClient.from("employees").delete().eq("id", employeeData.id);

      return NextResponse.json(
        { error: authError?.message || "Errore creazione utente auth" },
        { status: 400 }
      );
    }

    const { error: profileError } = await adminClient.from("profiles").insert({
      id: authData.user.id,
      employee_id: employeeData.id,
      role: "employee",
      privacy_accepted: false,
      must_change_password: false,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(authData.user.id);
      await adminClient.from("employees").delete().eq("id", employeeData.id);

      return NextResponse.json(
        { error: profileError.message || "Errore creazione profilo" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      employee: employeeData,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
