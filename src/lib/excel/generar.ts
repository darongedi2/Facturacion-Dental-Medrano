import ExcelJS from "exceljs";
import { ETIQUETAS_TIPO_COMPROBANTE } from "@/lib/comprobantes";
import type { ErrorValidacion, Factura, Producto } from "@/lib/tipos";

type FacturaConRelaciones = Factura & {
  archivos: { nombre_original: string; nombre_normalizado: string | null } | { nombre_original: string; nombre_normalizado: string | null }[] | null;
  productos: Producto[];
};

function archivoDe(factura: FacturaConRelaciones) {
  return Array.isArray(factura.archivos) ? factura.archivos[0] : factura.archivos;
}

const COLOR_ENCABEZADO = "FF1F4E79";

const COLUMNAS_COMPROBANTE: { header: string; width: number } [] = [
  { header: "Fecha", width: 12 },
  { header: "Tipo", width: 20 },
  { header: "Letra", width: 8 },
  { header: "Punto de Venta", width: 14 },
  { header: "Numero", width: 14 },
  { header: "Razon Social Proveedor", width: 32 },
  { header: "CUIT Proveedor", width: 16 },
  { header: "Direccion", width: 32 },
  { header: "Localidad", width: 18 },
  { header: "Provincia", width: 18 },
  { header: "Codigo Postal", width: 12 },
  { header: "Condicion IVA", width: 24 },
  { header: "Razon Social Cliente", width: 32 },
  { header: "CUIT Cliente", width: 16 },
  { header: "Condicion IVA Cliente", width: 24 },
  { header: "Periodo Desde", width: 14 },
  { header: "Periodo Hasta", width: 14 },
  { header: "Fecha Vencimiento", width: 16 },
  { header: "Moneda", width: 10 },
  { header: "Condicion Venta", width: 16 },
  { header: "Importe Neto Gravado", width: 18 },
  { header: "IVA 27%", width: 14 },
  { header: "IVA 21%", width: 14 },
  { header: "IVA 10.5%", width: 14 },
  { header: "IVA 5%", width: 14 },
  { header: "IVA 2.5%", width: 14 },
  { header: "IVA Exento", width: 14 },
  { header: "IVA No Gravado", width: 16 },
  { header: "Percepcion IVA", width: 16 },
  { header: "Percepcion IIBB", width: 16 },
  { header: "Percepcion Municipal", width: 18 },
  { header: "Impuestos Internos", width: 18 },
  { header: "Otros Tributos", width: 16 },
  { header: "Descuentos", width: 14 },
  { header: "Total", width: 16 },
  { header: "CAE", width: 18 },
  { header: "Vencimiento CAE", width: 16 },
  { header: "Nombre Archivo", width: 45 },
  { header: "Fecha Carga", width: 16 },
  { header: "Observaciones", width: 30 },
];

const COLUMNAS_MONEDA = new Set([
  "Importe Neto Gravado", "IVA 27%", "IVA 21%", "IVA 10.5%", "IVA 5%", "IVA 2.5%",
  "IVA Exento", "IVA No Gravado", "Percepcion IVA", "Percepcion IIBB",
  "Percepcion Municipal", "Impuestos Internos", "Otros Tributos", "Descuentos", "Total",
]);
const COLUMNAS_FECHA = new Set(["Fecha", "Periodo Desde", "Periodo Hasta", "Fecha Vencimiento", "Vencimiento CAE", "Fecha Carga"]);

function formatearHojaComprobantes(hoja: ExcelJS.Worksheet) {
  hoja.columns = COLUMNAS_COMPROBANTE.map((columna) => ({ header: columna.header, width: columna.width }));
  const filaEncabezado = hoja.getRow(1);
  filaEncabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  filaEncabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ENCABEZADO } };
  hoja.autoFilter = { from: "A1", to: `${hoja.getColumn(COLUMNAS_COMPROBANTE.length).letter}1` };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  COLUMNAS_COMPROBANTE.forEach((columna, indice) => {
    const letra = hoja.getColumn(indice + 1).letter;
    if (COLUMNAS_MONEDA.has(columna.header)) {
      hoja.getColumn(indice + 1).numFmt = "#,##0.00";
    }
    if (COLUMNAS_FECHA.has(columna.header)) {
      hoja.getColumn(indice + 1).numFmt = "dd/mm/yyyy";
    }
    void letra;
  });
}

function agregarFilaComprobante(hoja: ExcelJS.Worksheet, factura: FacturaConRelaciones) {
  const archivo = archivoDe(factura);
  hoja.addRow([
    factura.fecha_emision ? new Date(factura.fecha_emision) : null,
    ETIQUETAS_TIPO_COMPROBANTE[factura.tipo_comprobante] ?? factura.tipo_comprobante,
    factura.letra,
    factura.punto_venta,
    factura.numero,
    factura.emisor_razon_social,
    factura.emisor_cuit,
    factura.emisor_direccion,
    factura.emisor_localidad,
    factura.emisor_provincia,
    factura.emisor_codigo_postal,
    factura.emisor_condicion_iva,
    factura.cliente_razon_social,
    factura.cliente_cuit,
    factura.cliente_condicion_iva,
    factura.periodo_desde ? new Date(factura.periodo_desde) : null,
    factura.periodo_hasta ? new Date(factura.periodo_hasta) : null,
    factura.fecha_pago ? new Date(factura.fecha_pago) : null,
    factura.moneda,
    factura.condicion_venta,
    factura.importe_neto_gravado,
    factura.iva_27,
    factura.iva_21,
    factura.iva_105,
    factura.iva_5,
    factura.iva_25,
    factura.iva_exento,
    factura.iva_no_gravado,
    factura.percepcion_iva,
    factura.percepcion_iibb,
    factura.percepcion_municipal,
    factura.impuestos_internos,
    factura.otros_tributos,
    factura.descuentos,
    factura.total,
    factura.cae,
    factura.cae_vencimiento ? new Date(factura.cae_vencimiento) : null,
    archivo?.nombre_normalizado ?? archivo?.nombre_original ?? "",
    new Date(factura.creado_en),
    factura.observaciones,
  ]);
}

function agregarHojaProductos(libro: ExcelJS.Workbook, facturas: FacturaConRelaciones[]) {
  const hoja = libro.addWorksheet("Productos");
  hoja.columns = [
    { header: "Factura", width: 20 },
    { header: "Proveedor", width: 32 },
    { header: "Descripcion", width: 40 },
    { header: "Cantidad", width: 12 },
    { header: "Unidad", width: 12 },
    { header: "Precio Unitario", width: 16 },
    { header: "IVA", width: 10 },
    { header: "Precio Total", width: 16 },
  ];
  const filaEncabezado = hoja.getRow(1);
  filaEncabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  filaEncabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ENCABEZADO } };
  hoja.autoFilter = { from: "A1", to: "H1" };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.getColumn(6).numFmt = "#,##0.00";
  hoja.getColumn(8).numFmt = "#,##0.00";

  for (const factura of facturas) {
    const identificador = `${factura.punto_venta ?? ""}-${factura.numero ?? ""}`;
    for (const producto of factura.productos ?? []) {
      hoja.addRow([
        identificador,
        factura.emisor_razon_social,
        producto.descripcion,
        producto.cantidad,
        producto.unidad,
        producto.precio_unitario,
        producto.alicuota_iva,
        producto.subtotal_con_iva ?? producto.subtotal,
      ]);
    }
  }
}

function agregarHojaErrores(libro: ExcelJS.Workbook, facturas: FacturaConRelaciones[]) {
  const hoja = libro.addWorksheet("Errores");
  hoja.columns = [
    { header: "Archivo", width: 45 },
    { header: "Tipo Error", width: 24 },
    { header: "Descripcion", width: 60 },
  ];
  const filaEncabezado = hoja.getRow(1);
  filaEncabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  filaEncabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ENCABEZADO } };
  hoja.autoFilter = { from: "A1", to: "C1" };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  for (const factura of facturas) {
    const archivo = archivoDe(factura);
    const nombre = archivo?.nombre_normalizado ?? archivo?.nombre_original ?? "";
    const errores = (factura.errores_detectados ?? []) as ErrorValidacion[];
    for (const error of errores) {
      hoja.addRow([nombre, error.codigo, error.mensaje]);
    }
  }
}

export async function generarExcelFacturas(
  compras: FacturaConRelaciones[],
  ventas: FacturaConRelaciones[],
): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Facturas AR IA";
  libro.created = new Date();

  const hojaCompras = libro.addWorksheet("Compras");
  formatearHojaComprobantes(hojaCompras);
  for (const factura of compras) agregarFilaComprobante(hojaCompras, factura);

  const hojaVentas = libro.addWorksheet("Ventas");
  formatearHojaComprobantes(hojaVentas);
  for (const factura of ventas) agregarFilaComprobante(hojaVentas, factura);

  agregarHojaProductos(libro, [...compras, ...ventas]);
  agregarHojaErrores(libro, [...compras, ...ventas]);

  const arrayBuffer = await libro.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
