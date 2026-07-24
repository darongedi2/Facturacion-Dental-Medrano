import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquemaLogin = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "La contrasena es obligatoria"),
});

export async function POST(request: NextRequest) {
  const cuerpo = await request.json().catch(() => null);
  const parseo = esquemaLogin.safeParse(cuerpo);
  if (!parseo.success) {
    return NextResponse.json(
      { error: parseo.error.issues[0]?.message ?? "Datos invalidos" },
      { status: 400 },
    );
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword(parseo.data);

  if (error || !data.user) {
    return NextResponse.json({ error: "Usuario o contrasena incorrectos" }, { status: 401 });
  }

  return NextResponse.json({ usuario: { id: data.user.id, email: data.user.email } });
}
