import type { TipoComprobante } from "@/lib/tipos";

export const ETIQUETAS_TIPO_COMPROBANTE: Record<TipoComprobante, string> = {
  factura_a: "Factura A",
  factura_b: "Factura B",
  factura_c: "Factura C",
  factura_m: "Factura M",
  factura_e: "Factura E",
  nc_a: "Nota de Credito A",
  nc_b: "Nota de Credito B",
  nc_c: "Nota de Credito C",
  nd_a: "Nota de Debito A",
  nd_b: "Nota de Debito B",
  nd_c: "Nota de Debito C",
  recibo: "Recibo",
  ticket: "Ticket",
  otro: "Otro",
};

export const ETIQUETAS_ESTADO_FACTURA: Record<string, string> = {
  revision: "En revision",
  validada: "Validada",
  error: "Error",
};
