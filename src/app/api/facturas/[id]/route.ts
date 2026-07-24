import { NextResponse, type NextRequest } from "next/server";
import { noAutenticado, usuarioActual } from "@/lib/auth-servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CAMPOS_EDITABLES_FACTURA, primerRelacionado } from "@/lib/tipos";

const URL_FIRMADA_SEGUNDOS = 60 * 10; // 10 minutos, alcanza para ver la vista previa

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const usuario = await usuarioActual(supabase);
  if (!usuario) return noAutenticado();

  const { data: factura, error } = await supabase
    .from("facturas")
    .select("*, productos(*), archivos(ruta_storage, nombre_original, tipo_mime)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!factura) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  let urlVistaPrevia: string | null = null;
  const archivo = primerRelacionado<{ ruta_storage: string }>(factura.archivos);
  if (archivo?.ruta_storage) {
    const { data: firmada } = await supabase.storage
      .from("facturas")
      .createSignedUrl(archivo.ruta_storage, URL_FIRMADA_SEGUNDOS);
    urlVistaPrevia = firmada?.signedUrl ?? null;
  }

  return NextResponse.json({ factura, urlVistaPrevia });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const usuario = await usuarioActual(supabase);
  if (!usuario) return noAutenticado();

  const cuerpo = await request.json().catch(() => null);
  if (!cuerpo || typeof cuerpo !== "object") {
    return NextResponse.json({ error: "Cuerpo invalido" }, { status: 400 });
  }

  // Solo se aceptan los campos editables definidos en tipos.ts — nunca ids,
  // estado de procesamiento, confianza ni timestamps desde el cliente.
  const cuerpoRecibido = cuerpo as Record<string, unknown>;
  const cambios: Record<string, unknown> = {};
  for (const campo of CAMPOS_EDITABLES_FACTURA) {
    if (campo in cuerpoRecibido) {
      cambios[campo] = cuerpoRecibido[campo];
    }
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "No hay campos validos para actualizar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("facturas")
    .update(cambios)
    .eq("id", id)
    .select("*, productos(*)")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ factura: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const usuario = await usuarioActual(supabase);
  if (!usuario) return noAutenticado();

  const { data: factura, error: errorBusqueda } = await supabase
    .from("facturas")
    .select("archivo_id, archivos(ruta_storage)")
    .eq("id", id)
    .maybeSingle();

  if (errorBusqueda) {
    return NextResponse.json({ error: errorBusqueda.message }, { status: 500 });
  }
  if (!factura) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  const archivo = primerRelacionado<{ ruta_storage: string }>(factura.archivos);
  if (archivo?.ruta_storage) {
    await supabase.storage.from("facturas").remove([archivo.ruta_storage]);
  }

  // Se borra el archivo (no la factura directamente): la relacion tiene
  // ON DELETE CASCADE archivos -> facturas -> productos, asi se limpia todo
  // en un solo paso sin dejar un archivo huerfano en Storage/DB.
  const { error: errorBorrado } = await supabase
    .from("archivos")
    .delete()
    .eq("id", factura.archivo_id);

  if (errorBorrado) {
    return NextResponse.json({ error: errorBorrado.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
