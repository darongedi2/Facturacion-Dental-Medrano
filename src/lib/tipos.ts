// Tipos que reflejan el esquema de supabase/migrations/0001_init.sql.
// Si el esquema cambia, este archivo se actualiza a mano (ver ARQUITECTURA.md §6).

export type Rol = "admin" | "operador";
export type Clasificacion = "compra" | "venta";
export type EstadoArchivo = "pendiente" | "procesando" | "procesado" | "error";
export type EstadoFactura = "revision" | "validada" | "error";

export type TipoComprobante =
  | "factura_a"
  | "factura_b"
  | "factura_c"
  | "factura_m"
  | "factura_e"
  | "nc_a"
  | "nc_b"
  | "nc_c"
  | "nd_a"
  | "nd_b"
  | "nd_c"
  | "recibo"
  | "ticket"
  | "otro";

export interface ErrorValidacion {
  codigo: string;
  mensaje: string;
  campo?: string;
}

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  creado_en: string;
}

export interface SesionCarga {
  id: string;
  usuario_id: string;
  clasificacion: Clasificacion;
  creado_en: string;
}

export interface Archivo {
  id: string;
  sesion_carga_id: string;
  nombre_original: string;
  nombre_normalizado: string | null;
  ruta_storage: string;
  tipo_mime: string;
  tamano_bytes: number;
  estado: EstadoArchivo;
  error_mensaje: string | null;
  creado_en: string;
}

export interface Factura {
  id: string;
  archivo_id: string;
  sesion_carga_id: string;

  tipo_comprobante: TipoComprobante;
  letra: string | null;
  codigo_afip: string | null;
  punto_venta: string | null;
  numero: string | null;
  fecha_emision: string | null;
  fecha_pago: string | null;
  periodo_desde: string | null;
  periodo_hasta: string | null;
  moneda: string | null;
  condicion_venta: string | null;

  emisor_razon_social: string | null;
  emisor_nombre_comercial: string | null;
  emisor_cuit: string | null;
  emisor_direccion: string | null;
  emisor_localidad: string | null;
  emisor_provincia: string | null;
  emisor_codigo_postal: string | null;
  emisor_condicion_iva: string | null;
  emisor_ingresos_brutos: string | null;
  emisor_fecha_inicio_actividades: string | null;

  cliente_razon_social: string | null;
  cliente_cuit: string | null;
  cliente_direccion: string | null;
  cliente_localidad: string | null;
  cliente_provincia: string | null;
  cliente_condicion_iva: string | null;

  cae: string | null;
  cae_vencimiento: string | null;
  qr_data: string | null;

  importe_neto_gravado: number | null;
  iva_27: number | null;
  iva_21: number | null;
  iva_105: number | null;
  iva_5: number | null;
  iva_25: number | null;
  iva_exento: number | null;
  iva_no_gravado: number | null;
  percepcion_iva: number | null;
  percepcion_iibb: number | null;
  percepcion_municipal: number | null;
  impuestos_internos: number | null;
  otros_tributos: number | null;
  descuentos: number | null;
  total: number | null;

  confianza_porcentaje: number | null;
  estado: EstadoFactura;
  duplicada: boolean;
  errores_detectados: ErrorValidacion[];
  extraccion_raw: unknown;
  observaciones: string | null;

  creado_en: string;
  actualizado_en: string;
}

export interface Producto {
  id: string;
  factura_id: string;
  orden: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number | null;
  unidad: string | null;
  precio_unitario: number | null;
  bonificacion_pct: number | null;
  bonificacion_monto: number | null;
  alicuota_iva: number | null;
  subtotal: number | null;
  subtotal_con_iva: number | null;
}

/**
 * Supabase-js, sin tipos generados por `supabase gen types`, no puede saber
 * que una relacion embebida por una FK unica (ej. facturas.archivo_id) es
 * "uno a uno" y a veces infiere el shape como array. En runtime PostgREST
 * siempre devuelve un objeto solo para ese caso. Este helper normaliza
 * ambas formas sin recurrir a castings inseguros desperdigados.
 */
export function primerRelacionado<T>(valor: T | T[] | null | undefined): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

// Campos de `facturas` que el usuario puede editar manualmente en la
// pantalla de Revision (todo menos ids, metadata de procesamiento y timestamps).
export const CAMPOS_EDITABLES_FACTURA = [
  "tipo_comprobante",
  "letra",
  "codigo_afip",
  "punto_venta",
  "numero",
  "fecha_emision",
  "fecha_pago",
  "periodo_desde",
  "periodo_hasta",
  "moneda",
  "condicion_venta",
  "emisor_razon_social",
  "emisor_nombre_comercial",
  "emisor_cuit",
  "emisor_direccion",
  "emisor_localidad",
  "emisor_provincia",
  "emisor_codigo_postal",
  "emisor_condicion_iva",
  "emisor_ingresos_brutos",
  "emisor_fecha_inicio_actividades",
  "cliente_razon_social",
  "cliente_cuit",
  "cliente_direccion",
  "cliente_localidad",
  "cliente_provincia",
  "cliente_condicion_iva",
  "cae",
  "cae_vencimiento",
  "qr_data",
  "importe_neto_gravado",
  "iva_27",
  "iva_21",
  "iva_105",
  "iva_5",
  "iva_25",
  "iva_exento",
  "iva_no_gravado",
  "percepcion_iva",
  "percepcion_iibb",
  "percepcion_municipal",
  "impuestos_internos",
  "otros_tributos",
  "descuentos",
  "total",
  "observaciones",
] as const satisfies readonly (keyof Factura)[];
