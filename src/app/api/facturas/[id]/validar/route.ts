import { NextResponse, type NextRequest } from "next/server";
import { noAutenticado, usuarioActual } from "@/lib/auth-servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const usuario = await usuarioActual(supabase);
  if (!usuario) return noAutenticado();

  const { data, error } = await supabase
    .from("facturas")
    .update({ estado: "validada" })
    .eq("id", id)
    .select("id, estado")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ factura: data });
}
