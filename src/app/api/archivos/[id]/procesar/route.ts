import { NextResponse, type NextRequest } from "next/server";
import { noAutenticado, usuarioActual } from "@/lib/auth-servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { extraerFactura } from "@/lib/gemini/extraer";
import { validarFactura } from "@/lib/validaciones";
import { calcularConfianza } from "@/lib/confianza";
import { construirNombreNormalizado } from "@/lib/nombre-archivo";
import type { TipoComprobante } from "@/lib/tipos";

interface ProductoExtraido {
  codigo?: string | null;
  descripcion: string;
  cantidad?: number | null;
  unidad?: string | null;
  precio_unitario?: number | null;
  bonificacion_pct?: number | null;
  bonificacion_monto?: number | null;
  alicuota_iva?: number | null;
  subtotal?: number | null;
  subtotal_con_iva?: number | null;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  const usuario = await usuarioActual(supabase);
  if (!usuario) return noAutenticado();

  const { data: archivo, error: errorArchivo } = await supabase
    .from("archivos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (errorArchivo || !archivo) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  await supabase.from("archivos").update({ estado: "procesando" }).eq("id", id);

  try {
    const { data: descarga, error: errorDescarga } = await supabase.storage
      .from("facturas")
      .download(archivo.ruta_storage);

    if (errorDescarga || !descarga) {
      throw new Error(errorDescarga?.message ?? "No se pudo descargar el archivo de Storage");
    }

    const buffer = Buffer.from(await descarga.arrayBuffer());
    const extraido = await extraerFactura(buffer, archivo.tipo_mime);
    const { productos, ...datosFactura } = extraido as Record<string, unknown> & {
      productos?: ProductoExtraido[];
    };

    const obtenerTexto = (campo: string) => (datosFactura[campo] as string | null) ?? null;
    const obtenerNumero = (campo: string) => (datosFactura[campo] as number | null) ?? null;

    const { errores, duplicada } = await validarFactura(supabase, {
      emisor_cuit: obtenerTexto("emisor_cuit"),
      tipo_comprobante: (datosFactura.tipo_comprobante as string) ?? "otro",
      punto_venta: obtenerTexto("punto_venta"),
      numero: obtenerTexto("numero"),
      fecha_emision: obtenerTexto("fecha_emision"),
      total: obtenerNumero("total"),
      importe_neto_gravado: obtenerNumero("importe_neto_gravado"),
      iva_27: obtenerNumero("iva_27"),
      iva_21: obtenerNumero("iva_21"),
      iva_105: obtenerNumero("iva_105"),
      iva_5: obtenerNumero("iva_5"),
      iva_25: obtenerNumero("iva_25"),
      percepcion_iva: obtenerNumero("percepcion_iva"),
      percepcion_iibb: obtenerNumero("percepcion_iibb"),
      percepcion_municipal: obtenerNumero("percepcion_municipal"),
      impuestos_internos: obtenerNumero("impuestos_internos"),
      otros_tributos: obtenerNumero("otros_tributos"),
      descuentos: obtenerNumero("descuentos"),
      cae_vencimiento: obtenerTexto("cae_vencimiento"),
    });

    const confianza = calcularConfianza(datosFactura, errores, duplicada);

    // Si se reprocesa un archivo que ya tenia una factura (ej. para
    // reintentar tras un error), se reemplaza en vez de chocar con la
    // restriccion unique de archivo_id.
    await supabase.from("facturas").delete().eq("archivo_id", archivo.id);

    const { data: facturaCreada, error: errorInsert } = await supabase
      .from("facturas")
      .insert({
        archivo_id: archivo.id,
        sesion_carga_id: archivo.sesion_carga_id,
        ...datosFactura,
        confianza_porcentaje: confianza,
        estado: "revision",
        duplicada,
        errores_detectados: errores,
        extraccion_raw: extraido,
      })
      .select("id")
      .single();

    if (errorInsert || !facturaCreada) {
      throw new Error(errorInsert?.message ?? "No se pudo guardar la factura extraida");
    }

    if (Array.isArray(productos) && productos.length > 0) {
      const filasProductos = productos.map((producto, indice) => ({
        factura_id: facturaCreada.id,
        orden: indice,
        codigo: producto.codigo ?? null,
        descripcion: producto.descripcion,
        cantidad: producto.cantidad ?? null,
        unidad: producto.unidad ?? null,
        precio_unitario: producto.precio_unitario ?? null,
        bonificacion_pct: producto.bonificacion_pct ?? null,
        bonificacion_monto: producto.bonificacion_monto ?? null,
        alicuota_iva: producto.alicuota_iva ?? null,
        subtotal: producto.subtotal ?? null,
        subtotal_con_iva: producto.subtotal_con_iva ?? null,
      }));
      await supabase.from("productos").insert(filasProductos);
    }

    const extension = archivo.ruta_storage.split(".").pop() ?? "pdf";
    const nombreNormalizado = construirNombreNormalizado(
      {
        fecha_emision: obtenerTexto("fecha_emision"),
        tipo_comprobante: ((datosFactura.tipo_comprobante as TipoComprobante) ?? "otro"),
        emisor_razon_social: obtenerTexto("emisor_razon_social"),
        punto_venta: obtenerTexto("punto_venta"),
        numero: obtenerTexto("numero"),
      },
      extension,
    );

    await supabase
      .from("archivos")
      .update({ estado: "procesado", nombre_normalizado: nombreNormalizado })
      .eq("id", id);

    return NextResponse.json({ facturaId: facturaCreada.id, confianza, errores });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido al procesar el archivo";
    await supabase.from("archivos").update({ estado: "error", error_mensaje: mensaje }).eq("id", id);
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
