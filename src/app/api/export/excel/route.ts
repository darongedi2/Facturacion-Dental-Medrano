import { NextResponse, type NextRequest } from "next/server";
import { noAutenticado, usuarioActual } from "@/lib/auth-servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { generarExcelFacturas } from "@/lib/excel/generar";

export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor();
  const usuario = await usuarioActual(supabase);
  if (!usuario) return noAutenticado();

  const parametros = request.nextUrl.searchParams;
  const fechaDesde = parametros.get("fecha_desde");
  const fechaHasta = parametros.get("fecha_hasta");
  const proveedor = parametros.get("proveedor");
  const tipo = parametros.get("tipo");
  const numero = parametros.get("numero");
  const estado = parametros.get("estado");

  function construirConsulta(clasificacion: "compra" | "venta") {
    let consulta = supabase
      .from("facturas")
      .select("*, archivos!inner(nombre_original, nombre_normalizado), productos(*), sesiones_carga!inner(clasificacion)")
      .eq("sesiones_carga.clasificacion", clasificacion)
      .order("fecha_emision", { ascending: true, nullsFirst: true });

    if (fechaDesde) consulta = consulta.gte("fecha_emision", fechaDesde);
    if (fechaHasta) consulta = consulta.lte("fecha_emision", fechaHasta);
    if (proveedor) consulta = consulta.ilike("emisor_razon_social", `%${proveedor}%`);
    if (tipo) consulta = consulta.eq("tipo_comprobante", tipo);
    if (numero) consulta = consulta.ilike("numero", `%${numero}%`);
    if (estado) consulta = consulta.eq("estado", estado);

    return consulta;
  }

  const [{ data: compras, error: errorCompras }, { data: ventas, error: errorVentas }] = await Promise.all([
    construirConsulta("compra"),
    construirConsulta("venta"),
  ]);

  if (errorCompras || errorVentas) {
    return NextResponse.json(
      { error: errorCompras?.message ?? errorVentas?.message },
      { status: 500 },
    );
  }

  const buffer = await generarExcelFacturas(compras ?? [], ventas ?? []);
  const nombreArchivo = `Facturas_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
