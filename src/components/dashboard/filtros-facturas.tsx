import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ETIQUETAS_ESTADO_FACTURA, ETIQUETAS_TIPO_COMPROBANTE } from "@/lib/comprobantes";

// Formulario GET nativo (sin JS): al enviar, navega a /dashboard?... y el
// Server Component vuelve a consultar con esos filtros. Simple y rapido.
export function FiltrosFacturas({
  valoresIniciales,
}: {
  valoresIniciales: Record<string, string | undefined>;
}) {
  return (
    <form method="get" className="mb-4 grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3 lg:grid-cols-6">
      <div className="flex flex-col gap-1">
        <Label htmlFor="fecha_desde" className="text-xs">Fecha desde</Label>
        <Input id="fecha_desde" name="fecha_desde" type="date" defaultValue={valoresIniciales.fecha_desde} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="fecha_hasta" className="text-xs">Fecha hasta</Label>
        <Input id="fecha_hasta" name="fecha_hasta" type="date" defaultValue={valoresIniciales.fecha_hasta} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="proveedor" className="text-xs">Proveedor</Label>
        <Input id="proveedor" name="proveedor" placeholder="Razon social" defaultValue={valoresIniciales.proveedor} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="numero" className="text-xs">Numero</Label>
        <Input id="numero" name="numero" placeholder="0001-00001234" defaultValue={valoresIniciales.numero} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="tipo" className="text-xs">Tipo</Label>
        <select
          id="tipo"
          name="tipo"
          defaultValue={valoresIniciales.tipo ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Todos</option>
          {Object.entries(ETIQUETAS_TIPO_COMPROBANTE).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>{etiqueta}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="estado" className="text-xs">Estado</Label>
        <select
          id="estado"
          name="estado"
          defaultValue={valoresIniciales.estado ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Todos</option>
          {Object.entries(ETIQUETAS_ESTADO_FACTURA).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>{etiqueta}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="clasificacion" className="text-xs">Compras/Ventas</Label>
        <select
          id="clasificacion"
          name="clasificacion"
          defaultValue={valoresIniciales.clasificacion ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Todas</option>
          <option value="compra">Compras</option>
          <option value="venta">Ventas</option>
        </select>
      </div>
      <div className="col-span-full flex gap-2">
        <Button type="submit" size="sm">Filtrar</Button>
        <Button render={<Link href="/dashboard" />} variant="ghost" size="sm">
          Limpiar
        </Button>
      </div>
    </form>
  );
}
