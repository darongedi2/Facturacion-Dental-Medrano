import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { noAutenticado, usuarioActual } from "@/lib/auth-servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ETIQUETAS_TIPO_COMPROBANTE } from "@/lib/comprobantes";
import { primerRelacionado, type ErrorValidacion } from "@/lib/tipos";

const FORMATO_MONEDA = "#,##0.00";
const FORMATO_FECHA = "dd/mm/yyyy";
const COLOR_ENCABEZADO = "FF1F4E79";

interface ColumnaExcel {
  header: string;
  key: string;
  width: number;
  moneda?: boolean;
  fecha?: boolean;
}

const COLUMNAS_FACTURA: ColumnaExcel[] = [
  { header: "Fecha", key: "fecha_emision", width: 12, fecha: true },
  { header: "Tipo", key: "tipo_label", width: 18 },
  { header: "Letra", key: "letra", width: 8 },
  { header: "Punto de Venta", key: "punto_venta", width: 14 },
  { header: "Numero", key: "numero", width: 14 },
  { header: "Razon Social Proveedor", key: "emisor_razon_social", width: 30 },
  { header: "CUIT Proveedor", key: "emisor_cuit", width: 16 },
  { header: "Direccion", key: "emisor_direccion", width: 30 },
  { header: "Localidad", key: "emisor_localidad", width: 18 },
  { header: "Provincia", key: "emisor_provincia", width: 18 },
  { header: "Codigo Postal", key: "emisor_codigo_postal", width: 12 },
  { header: "Condicion IVA", key: "emisor_condicion_iva", width: 22 },
  { header: "Razon Social Cliente", key: "cliente_razon_social", width: 30 },
  { header: "CUIT Cliente", key: "cliente_cuit", width: 16 },
  { header: "Condicion IVA Cliente", key: "cliente_condicion_iva", width: 22 },
  { header: "Periodo Desde", key: "periodo_desde", width: 14, fecha: true },
  { header: "Periodo Hasta", key: "periodo_hasta", width: 14, fecha: true },
  { header: "Fecha Vencimiento", key: "fecha_pago", width: 14, fecha: true },
  { header: "Moneda", key: "moneda", width: 10 },
  { header: "Condicion Venta", key: "condicion_venta", width: 16 },
  { header: "Importe Neto Gravado", key: "importe_neto_gravado", width: 16, moneda: true },
  { header: "IVA 27%", key: "iva_27", width: 12, moneda: true },
  { header: "IVA 21%", key: "iva_21", width: 12, moneda: true },
  { header: "IVA 10.5%", key: "iva_105", width: 12, moneda: true },
  { header: "IVA 5%", key: "iva_5", width: 12, moneda: true },
  { header: "IVA 2.5%", key: "iva_25", width: 12, moneda: true },
  { header: "IVA Exento", key: "iva_exento", width: 12, moneda: true },
  { header: "IVA No Gravado", key: "iva_no_gravado", width: 14, moneda: true },
  { header: "Percepcion IVA", key: "percepcion_iva", width: 14, moneda: true },
  { header: "Percepcion IIBB", key: "percepcion_iibb", width: 14, moneda: true },
  { header: "Percepcion Municipal", key: "percepcion_municipal", width: 16, moneda: true },
  { header: "Impuestos Internos", key: "impuestos_internos", width: 16, moneda: true },
  { header: "Otros Tributos", key: "otros_tributos", width: 14, moneda: true },
  { header: "Descuentos", key: "descuentos", width: 12, moneda: true },
  { header: "Total", key: "total", width: 14, moneda: true },
  { header: "CAE", key: "cae", width: 18 },
  { header: "Vencimiento CAE", key: "cae_vencimiento", width: 14, fecha: true },
  { header: "Nombre Archivo", key: "nombre_archivo", width: 42 },
  { header: "Fecha Carga", key: "fecha_carga", width: 14, fecha: true },
  { header: "Observaciones", key: "observaciones", width: 30 },
];

const COLUMNAS_PRODUCTO: ColumnaExcel[] = [
  { header: "Factura", key: "factura", width: 20 },
  { header: "Proveedor", key: "proveedor", width: 30 },
  { header: "Descripcion", key: "descripcion", width: 40 },
  { header: "Cantidad", key: "cantidad", width: 10 },
  { header: "Unidad", key: "unidad", width: 10 },
  { header: "Precio Unitario", key: "precio_unitario", width: 14, moneda: true },
  { header: "IVA", key: "alicuota_iva", width: 10 },
  { header: "Precio Total", key: "precio_total", width: 14, moneda: true },
];

const COLUMNAS_ERROR: ColumnaExcel[] = [
  { header: "Archivo", key: "archivo", width: 42 },
  { header: "Tipo Error", key: "tipo_error", width: 22 },
  { header: "Descripcion", key: "descripcion", width: 60 },
];

function estilizarEncabezado(hoja: ExcelJS.Worksheet) {
  hoja.getRow(1).eachCell((celda) => {
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ENCABEZADO } };
  });
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: hoja.columnCount },
  };
}

function aplicarFormatos(hoja: ExcelJS.Worksheet, columnas: ColumnaExcel[]) {
  columnas.forEach((columna, indice) => {
    const col = hoja.getColumn(indice + 1);
    if (columna.moneda) col.numFmt = FORMATO_MONEDA;
    if (columna.fecha) col.numFmt = FORMATO_FECHA;
  });
}

// Postgres devuelve las columnas `date` como texto "YYYY-MM-DD" via
// PostgREST: hay que convertirlas a Date real para que ExcelJS las trate
// como fecha (y el numFmt "dd/mm/yyyy" tenga efecto, no como texto plano).
function aFecha(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const fecha = new Date(`${valor}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilaFactura = any;

function filaComun(factura: FilaFactura) {
  const archivo = primerRelacionado<{ nombre_normalizado: string | null; nombre_original: string; creado_en: string }>(
    factura.archivos,
  );
  return {
    fecha_emision: aFecha(factura.fecha_emision),
    tipo_label:
      ETIQUETAS_TIPO_COMPROBANTE[factura.tipo_comprobante as keyof typeof ETIQUETAS_TIPO_COMPROBANTE] ??
      factura.tipo_comprobante,
    letra: factura.letra,
    punto_venta: factura.punto_venta,
    numero: factura.numero,
    emisor_razon_social: factura.emisor_razon_social,
    emisor_cuit: factura.emisor_cuit,
    emisor_direccion: factura.emisor_direccion,
    emisor_localidad: factura.emisor_localidad,
    emisor_provincia: factura.emisor_provincia,
    emisor_codigo_postal: factura.emisor_codigo_postal,
    emisor_condicion_iva: factura.emisor_condicion_iva,
    cliente_razon_social: factura.cliente_razon_social,
    cliente_cuit: factura.cliente_cuit,
    cliente_condicion_iva: factura.cliente_condicion_iva,
    periodo_desde: aFecha(factura.periodo_desde),
    periodo_hasta: aFecha(factura.periodo_hasta),
    fecha_pago: aFecha(factura.fecha_pago),
    moneda: factura.moneda,
    condicion_venta: factura.condicion_venta,
    importe_neto_gravado: factura.importe_neto_gravado,
    iva_27: factura.iva_27,
    iva_21: factura.iva_21,
    iva_105: factura.iva_105,
    iva_5: factura.iva_5,
    iva_25: factura.iva_25,
    iva_exento: factura.iva_exento,
    iva_no_gravado: factura.iva_no_gravado,
    percepcion_iva: factura.percepcion_iva,
    percepcion_iibb: factura.percepcion_iibb,
    percepcion_municipal: factura.percepcion_municipal,
    impuestos_internos: factura.impuestos_internos,
    otros_tributos: factura.otros_tributos,
    descuentos: factura.descuentos,
    total: factura.total,
    cae: factura.cae,
    cae_vencimiento: aFecha(factura.cae_vencimiento),
    nombre_archivo: archivo?.nombre_normalizado ?? archivo?.nombre_original ?? "",
    fecha_carga: archivo?.creado_en ? new Date(archivo.creado_en) : null,
    observaciones: factura.observaciones,
  };
}

export async function GET() {
  const supabase = await crearClienteServidor();
  const usuario = await usuarioActual(supabase);
  if (!usuario) return noAutenticado();

  const { data: facturas, error } = await supabase
    .from("facturas")
    .select("*, sesiones_carga!inner(clasificacion), archivos(nombre_original, nombre_normalizado, creado_en), productos(*)")
    .order("fecha_emision", { ascending: true, nullsFirst: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const libro = new ExcelJS.Workbook();
  libro.creator = "Facturas AR IA";
  libro.created = new Date();

  // --- Compras / Ventas ---
  for (const [nombreHoja, clasificacion] of [
    ["Compras", "compra"],
    ["Ventas", "venta"],
  ] as const) {
    const hoja = libro.addWorksheet(nombreHoja);
    hoja.columns = COLUMNAS_FACTURA;

    const filas = (facturas ?? []).filter((f) => {
      const sesion = primerRelacionado<{ clasificacion: string }>(f.sesiones_carga);
      return sesion?.clasificacion === clasificacion;
    });

    for (const factura of filas) {
      hoja.addRow(filaComun(factura));
    }

    estilizarEncabezado(hoja);
    aplicarFormatos(hoja, COLUMNAS_FACTURA);
  }

  // --- Productos ---
  const hojaProductos = libro.addWorksheet("Productos");
  hojaProductos.columns = COLUMNAS_PRODUCTO;
  for (const factura of facturas ?? []) {
    const productos = (factura.productos ?? []) as {
      descripcion: string;
      cantidad: number | null;
      unidad: string | null;
      precio_unitario: number | null;
      alicuota_iva: number | null;
      subtotal: number | null;
      subtotal_con_iva: number | null;
    }[];
    for (const producto of productos) {
      hojaProductos.addRow({
        factura: `${factura.punto_venta ?? ""}-${factura.numero ?? ""}`,
        proveedor: factura.emisor_razon_social,
        descripcion: producto.descripcion,
        cantidad: producto.cantidad,
        unidad: producto.unidad,
        precio_unitario: producto.precio_unitario,
        alicuota_iva: producto.alicuota_iva,
        precio_total: producto.subtotal_con_iva ?? producto.subtotal,
      });
    }
  }
  estilizarEncabezado(hojaProductos);
  aplicarFormatos(hojaProductos, COLUMNAS_PRODUCTO);

  // --- Errores ---
  const hojaErrores = libro.addWorksheet("Errores");
  hojaErrores.columns = COLUMNAS_ERROR;
  for (const factura of facturas ?? []) {
    const archivo = primerRelacionado<{ nombre_normalizado: string | null; nombre_original: string }>(
      factura.archivos,
    );
    const errores = (factura.errores_detectados ?? []) as ErrorValidacion[];
    for (const errorFactura of errores) {
      hojaErrores.addRow({
        archivo: archivo?.nombre_normalizado ?? archivo?.nombre_original ?? "",
        tipo_error: errorFactura.codigo,
        descripcion: errorFactura.mensaje,
      });
    }
  }
  estilizarEncabezado(hojaErrores);
  aplicarFormatos(hojaErrores, COLUMNAS_ERROR);

  const buffer = await libro.xlsx.writeBuffer();
  const fechaArchivo = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="facturas_${fechaArchivo}.xlsx"`,
    },
  });
}
