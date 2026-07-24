import { NextResponse, type NextRequest } from "next/server";
import { noAutenticado, usuarioActual } from "@/lib/auth-servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";

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
  const clasificacion = parametros.get("clasificacion");
  const pagina = Math.max(1, Number(parametros.get("page") ?? 1));
  const porPagina = Math.min(100, Math.max(1, Number(parametros.get("pageSize") ?? 20)));
  const desde = (pagina - 1) * porPagina;
  const hasta = desde + porPagina - 1;

  let consulta = supabase
    .from("facturas")
    .select("*, sesiones_carga!inner(clasificacion)", { count: "exact" })
    .order("fecha_emision", { ascending: false, nullsFirst: false })
    .order("creado_en", { ascending: false })
    .range(desde, hasta);

  if (fechaDesde) consulta = consulta.gte("fecha_emision", fechaDesde);
  if (fechaHasta) consulta = consulta.lte("fecha_emision", fechaHasta);
  if (proveedor) consulta = consulta.ilike("emisor_razon_social", `%${proveedor}%`);
  if (tipo) consulta = consulta.eq("tipo_comprobante", tipo);
  if (numero) consulta = consulta.ilike("numero", `%${numero}%`);
  if (estado) consulta = consulta.eq("estado", estado);
  if (clasificacion) consulta = consulta.eq("sesiones_carga.clasificacion", clasificacion);

  const { data, error, count } = await consulta;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    facturas: data,
    total: count ?? 0,
    page: pagina,
    pageSize: porPagina,
  });
}
