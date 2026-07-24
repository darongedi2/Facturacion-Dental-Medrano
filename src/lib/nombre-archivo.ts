import { ETIQUETAS_TIPO_COMPROBANTE } from "@/lib/comprobantes";
import type { TipoComprobante } from "@/lib/tipos";

function sanear(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca acentos (rango Unicode de diacriticos)
    .replace(/[^a-zA-Z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

interface DatosParaNombre {
  fecha_emision: string | null;
  tipo_comprobante: TipoComprobante;
  emisor_razon_social: string | null;
  punto_venta: string | null;
  numero: string | null;
}

// Formato pedido: AAAA-MM-DD - Tipo - Proveedor - PuntoVenta-Numero.ext
export function construirNombreNormalizado(datos: DatosParaNombre, extension: string): string {
  const fecha = datos.fecha_emision ?? new Date().toISOString().slice(0, 10);
  const tipo = sanear(ETIQUETAS_TIPO_COMPROBANTE[datos.tipo_comprobante] ?? datos.tipo_comprobante);
  const proveedor = sanear(datos.emisor_razon_social ?? "Sin proveedor");
  const puntoVenta = datos.punto_venta ?? "0000";
  const numero = datos.numero ?? "00000000";

  return `${fecha} - ${tipo} - ${proveedor} - ${puntoVenta}-${numero}.${extension}`;
}
