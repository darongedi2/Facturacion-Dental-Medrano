import { Type, type Schema } from "@google/genai";

const TIPOS_COMPROBANTE = [
  "factura_a", "factura_b", "factura_c", "factura_m", "factura_e",
  "nc_a", "nc_b", "nc_c", "nd_a", "nd_b", "nd_c",
  "recibo", "ticket", "otro",
];

// Esquema que le pasamos a Gemini (responseSchema) para que devuelva
// exactamente esta forma. Ver ARQUITECTURA.md §6 para el tipo TS equivalente.
export const ESQUEMA_FACTURA: Schema = {
  type: Type.OBJECT,
  properties: {
    tipo_comprobante: { type: Type.STRING, enum: TIPOS_COMPROBANTE },
    letra: { type: Type.STRING, nullable: true },
    codigo_afip: { type: Type.STRING, nullable: true },
    punto_venta: { type: Type.STRING, nullable: true },
    numero: { type: Type.STRING, nullable: true },
    fecha_emision: { type: Type.STRING, nullable: true, description: "Formato YYYY-MM-DD" },
    fecha_pago: { type: Type.STRING, nullable: true, description: "Formato YYYY-MM-DD" },
    periodo_desde: { type: Type.STRING, nullable: true, description: "Formato YYYY-MM-DD" },
    periodo_hasta: { type: Type.STRING, nullable: true, description: "Formato YYYY-MM-DD" },
    moneda: { type: Type.STRING, nullable: true },
    condicion_venta: { type: Type.STRING, nullable: true },

    emisor_razon_social: { type: Type.STRING, nullable: true },
    emisor_nombre_comercial: { type: Type.STRING, nullable: true },
    emisor_cuit: { type: Type.STRING, nullable: true },
    emisor_direccion: { type: Type.STRING, nullable: true },
    emisor_localidad: { type: Type.STRING, nullable: true },
    emisor_provincia: { type: Type.STRING, nullable: true },
    emisor_codigo_postal: { type: Type.STRING, nullable: true },
    emisor_condicion_iva: { type: Type.STRING, nullable: true },
    emisor_ingresos_brutos: { type: Type.STRING, nullable: true },
    emisor_fecha_inicio_actividades: { type: Type.STRING, nullable: true, description: "Formato YYYY-MM-DD" },

    cliente_razon_social: { type: Type.STRING, nullable: true },
    cliente_cuit: { type: Type.STRING, nullable: true },
    cliente_direccion: { type: Type.STRING, nullable: true },
    cliente_localidad: { type: Type.STRING, nullable: true },
    cliente_provincia: { type: Type.STRING, nullable: true },
    cliente_condicion_iva: { type: Type.STRING, nullable: true },

    cae: { type: Type.STRING, nullable: true },
    cae_vencimiento: { type: Type.STRING, nullable: true, description: "Formato YYYY-MM-DD" },
    qr_data: { type: Type.STRING, nullable: true },

    importe_neto_gravado: { type: Type.NUMBER, nullable: true },
    iva_27: { type: Type.NUMBER, nullable: true },
    iva_21: { type: Type.NUMBER, nullable: true },
    iva_105: { type: Type.NUMBER, nullable: true },
    iva_5: { type: Type.NUMBER, nullable: true },
    iva_25: { type: Type.NUMBER, nullable: true },
    iva_exento: { type: Type.NUMBER, nullable: true },
    iva_no_gravado: { type: Type.NUMBER, nullable: true },
    percepcion_iva: { type: Type.NUMBER, nullable: true },
    percepcion_iibb: { type: Type.NUMBER, nullable: true },
    percepcion_municipal: { type: Type.NUMBER, nullable: true },
    impuestos_internos: { type: Type.NUMBER, nullable: true },
    otros_tributos: { type: Type.NUMBER, nullable: true },
    descuentos: { type: Type.NUMBER, nullable: true },
    total: { type: Type.NUMBER, nullable: true },

    productos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          codigo: { type: Type.STRING, nullable: true },
          descripcion: { type: Type.STRING },
          cantidad: { type: Type.NUMBER, nullable: true },
          unidad: { type: Type.STRING, nullable: true },
          precio_unitario: { type: Type.NUMBER, nullable: true },
          bonificacion_pct: { type: Type.NUMBER, nullable: true },
          bonificacion_monto: { type: Type.NUMBER, nullable: true },
          alicuota_iva: { type: Type.NUMBER, nullable: true },
          subtotal: { type: Type.NUMBER, nullable: true },
          subtotal_con_iva: { type: Type.NUMBER, nullable: true },
        },
        required: ["descripcion"],
      },
    },
  },
  required: ["tipo_comprobante", "productos"],
};
