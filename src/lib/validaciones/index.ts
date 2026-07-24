import type { SupabaseClient } from "@supabase/supabase-js";
import type { ErrorValidacion } from "@/lib/tipos";
import { cuitValido } from "./cuit";

export interface DatosParaValidar {
  emisor_cuit: string | null;
  tipo_comprobante: string;
  punto_venta: string | null;
  numero: string | null;
  fecha_emision: string | null;
  total: number | null;
  importe_neto_gravado: number | null;
  iva_27: number | null;
  iva_21: number | null;
  iva_105: number | null;
  iva_5: number | null;
  iva_25: number | null;
  percepcion_iva: number | null;
  percepcion_iibb: number | null;
  percepcion_municipal: number | null;
  impuestos_internos: number | null;
  otros_tributos: number | null;
  descuentos: number | null;
  cae_vencimiento: string | null;
}

const TOLERANCIA_TOTAL = 1; // $1, por redondeo

export async function validarFactura(
  supabase: SupabaseClient,
  datos: DatosParaValidar,
  excluirFacturaId?: string,
): Promise<{ errores: ErrorValidacion[]; duplicada: boolean }> {
  const errores: ErrorValidacion[] = [];

  if (datos.emisor_cuit && !cuitValido(datos.emisor_cuit)) {
    errores.push({
      codigo: "CUIT_INVALIDO",
      mensaje: `El CUIT del emisor (${datos.emisor_cuit}) no es valido.`,
      campo: "emisor_cuit",
    });
  }

  const faltantes: string[] = [];
  if (!datos.emisor_cuit) faltantes.push("CUIT del emisor");
  if (!datos.fecha_emision) faltantes.push("fecha de emision");
  if (!datos.numero) faltantes.push("numero de comprobante");
  if (datos.total === null) faltantes.push("total");
  if (faltantes.length > 0) {
    errores.push({ codigo: "CAMPOS_FALTANTES", mensaje: `Faltan datos: ${faltantes.join(", ")}.` });
  }

  // Solo tiene sentido este chequeo si el comprobante realmente discrimina
  // el neto (ej. Factura A/B). Un monotributista (Factura C) o un recibo
  // no discriminan nada: no hay "suma" contra la cual comparar el total,
  // y no es un error que esos campos vengan vacios.
  if (datos.total !== null && datos.importe_neto_gravado !== null) {
    const sumaCalculada =
      (datos.importe_neto_gravado ?? 0) +
      (datos.iva_27 ?? 0) +
      (datos.iva_21 ?? 0) +
      (datos.iva_105 ?? 0) +
      (datos.iva_5 ?? 0) +
      (datos.iva_25 ?? 0) +
      (datos.percepcion_iva ?? 0) +
      (datos.percepcion_iibb ?? 0) +
      (datos.percepcion_municipal ?? 0) +
      (datos.impuestos_internos ?? 0) +
      (datos.otros_tributos ?? 0) -
      (datos.descuentos ?? 0);

    if (Math.abs(sumaCalculada - datos.total) > TOLERANCIA_TOTAL) {
      errores.push({
        codigo: "TOTAL_INCORRECTO",
        mensaje: `El total (${datos.total}) no coincide con la suma de neto + impuestos (${sumaCalculada.toFixed(2)}).`,
        campo: "total",
      });
    }
  }

  if (datos.cae_vencimiento && datos.fecha_emision && datos.cae_vencimiento < datos.fecha_emision) {
    errores.push({
      codigo: "DATOS_INCONSISTENTES",
      mensaje: "La fecha de vencimiento del CAE es anterior a la fecha de emision.",
    });
  }

  let duplicada = false;
  if (datos.emisor_cuit && datos.numero) {
    let consulta = supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("emisor_cuit", datos.emisor_cuit)
      .eq("tipo_comprobante", datos.tipo_comprobante)
      .eq("punto_venta", datos.punto_venta ?? "")
      .eq("numero", datos.numero);

    if (excluirFacturaId) {
      consulta = consulta.neq("id", excluirFacturaId);
    }

    const { count } = await consulta;
    if (count && count > 0) {
      duplicada = true;
      errores.unshift({
        codigo: "FACTURA_DUPLICADA",
        mensaje: "Ya existe una factura cargada con el mismo emisor, tipo, punto de venta y numero.",
      });
    }
  }

  return { errores, duplicada };
}
