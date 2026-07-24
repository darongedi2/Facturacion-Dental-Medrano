import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { noAutenticado, usuarioActual } from "@/lib/auth-servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const TAMANO_MAXIMO_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sesionCargaId } = await params;
  const supabase = await crearClienteServidor();
  const usuario = await usuarioActual(supabase);
  if (!usuario) return noAutenticado();

  const { data: sesion, error: errorSesion } = await supabase
    .from("sesiones_carga")
    .select("id")
    .eq("id", sesionCargaId)
    .maybeSingle();

  if (errorSesion || !sesion) {
    return NextResponse.json({ error: "Sesion de carga no encontrada" }, { status: 404 });
  }

  const formData = await request.formData();
  const archivosSubidos = formData
    .getAll("archivo")
    .filter((valor): valor is File => valor instanceof File);

  if (archivosSubidos.length === 0) {
    return NextResponse.json({ error: "No se recibio ningun archivo" }, { status: 400 });
  }

  const creados: { id: string; nombre_original: string }[] = [];
  const errores: { nombre_original: string; mensaje: string }[] = [];

  for (const archivo of archivosSubidos) {
    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      errores.push({
        nombre_original: archivo.name,
        mensaje: `Formato no soportado (${archivo.type || "desconocido"}). Solo PDF, JPG, PNG o WEBP.`,
      });
      continue;
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      errores.push({ nombre_original: archivo.name, mensaje: "El archivo supera los 15 MB" });
      continue;
    }

    const extension = archivo.name.split(".").pop()?.toLowerCase() || "pdf";
    const rutaStorage = `${sesionCargaId}/${randomUUID()}.${extension}`;

    const { error: errorSubida } = await supabase.storage
      .from("facturas")
      .upload(rutaStorage, archivo, { contentType: archivo.type, upsert: false });

    if (errorSubida) {
      errores.push({ nombre_original: archivo.name, mensaje: errorSubida.message });
      continue;
    }

    const { data: archivoCreado, error: errorInsert } = await supabase
      .from("archivos")
      .insert({
        sesion_carga_id: sesionCargaId,
        nombre_original: archivo.name,
        ruta_storage: rutaStorage,
        tipo_mime: archivo.type,
        tamano_bytes: archivo.size,
        estado: "pendiente",
      })
      .select("id, nombre_original")
      .single();

    if (errorInsert || !archivoCreado) {
      await supabase.storage.from("facturas").remove([rutaStorage]);
      errores.push({ nombre_original: archivo.name, mensaje: errorInsert?.message ?? "Error al guardar" });
      continue;
    }

    creados.push(archivoCreado);
  }

  return NextResponse.json({ archivos: creados, errores }, { status: 201 });
}
