import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FiltrosFacturas } from "@/components/dashboard/filtros-facturas";
import { TablaFacturas } from "@/components/dashboard/tabla-facturas";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Factura } from "@/lib/tipos";

type FacturaConClasificacion = Factura & {
  sesiones_carga: { clasificacion: "compra" | "venta" } | { clasificacion: "compra" | "venta" }[];
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const parametros = await searchParams;
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let consulta = supabase
    .from("facturas")
    .select("*, sesiones_carga!inner(clasificacion)")
    .order("fecha_emision", { ascending: false, nullsFirst: false })
    .order("creado_en", { ascending: false })
    .limit(50);

  if (parametros.fecha_desde) consulta = consulta.gte("fecha_emision", parametros.fecha_desde);
  if (parametros.fecha_hasta) consulta = consulta.lte("fecha_emision", parametros.fecha_hasta);
  if (parametros.proveedor) consulta = consulta.ilike("emisor_razon_social", `%${parametros.proveedor}%`);
  if (parametros.tipo) consulta = consulta.eq("tipo_comprobante", parametros.tipo);
  if (parametros.numero) consulta = consulta.ilike("numero", `%${parametros.numero}%`);
  if (parametros.estado) consulta = consulta.eq("estado", parametros.estado);
  if (parametros.clasificacion) {
    consulta = consulta.eq("sesiones_carga.clasificacion", parametros.clasificacion);
  }

  const { data, error } = await consulta;
  const facturas = (data ?? []) as FacturaConClasificacion[];

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Facturas procesadas</h1>
        <div className="flex gap-2">
          <Button render={<Link href="/cargar" />} nativeButton={false} size="lg">
            Cargar Facturas
          </Button>
          <Button render={<a href="/api/export/excel" />} nativeButton={false} variant="outline" size="lg">
            Exportar Excel
          </Button>
        </div>
      </div>

      <FiltrosFacturas valoresIniciales={parametros} />

      {error ? (
        <p className="mt-6 text-sm text-destructive">Error al cargar facturas: {error.message}</p>
      ) : (
        <TablaFacturas facturas={facturas} />
      )}
    </main>
  );
}
