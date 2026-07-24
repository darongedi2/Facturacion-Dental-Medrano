import type { ErrorValidacion } from "@/lib/tipos";

// Formula transparente (ARQUITECTURA.md §7): se parte de 100 y se resta
// por cada dato importante que falte o error detectado. Piso 0, techo 100.
const CAMPOS_CRITICOS = ["emisor_cuit", "tipo_comprobante", "fecha_emision", "numero", "total"];
const CAMPOS_SECUNDARIOS = ["cae", "cae_vencimiento", "emisor_razon_social", "cliente_cuit", "importe_neto_gravado"];

const PENALIDAD_CRITICO = 15;
const PENALIDAD_SECUNDARIO = 5;
const PENALIDAD_ERROR = 10;
const TOPE_SI_DUPLICADA = 40;

function estaVacio(valor: unknown): boolean {
  return valor === null || valor === undefined || valor === "";
}

export function calcularConfianza(
  datos: Record<string, unknown>,
  errores: ErrorValidacion[],
  duplicada: boolean,
): number {
  let puntaje = 100;

  for (const campo of CAMPOS_CRITICOS) {
    if (estaVacio(datos[campo])) puntaje -= PENALIDAD_CRITICO;
  }
  for (const campo of CAMPOS_SECUNDARIOS) {
    if (estaVacio(datos[campo])) puntaje -= PENALIDAD_SECUNDARIO;
  }
  puntaje -= errores.length * PENALIDAD_ERROR;

  if (duplicada) {
    puntaje = Math.min(puntaje, TOPE_SI_DUPLICADA);
  }

  return Math.max(0, Math.min(100, Math.round(puntaje)));
}
