import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { noAutenticado, usuarioActual } from "@/lib/auth-servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquemaCrear = z.object({
  clasificacion: z.enum(["compra", "venta"]),
});

export async function POST(request: NextRequest) {
  const supabase = await crearClienteServidor();
  const usuario = await usuarioActual(supabase);
  if (!usuario) return noAutenticado();

  const cuerpo = await request.json().catch(() => null);
  const parseo = esquemaCrear.safeParse(cuerpo);
  if (!parseo.success) {
    return NextResponse.json(
      { error: parseo.error.issues[0]?.message ?? "Datos invalidos" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("sesiones_carga")
    .insert({ usuario_id: usuario.id, clasificacion: parseo.data.clasificacion })
    .select("id, clasificacion, creado_en")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sesionCarga: data }, { status: 201 });
}
