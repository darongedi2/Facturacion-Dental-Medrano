import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BadgeConfianza } from "@/components/shared/badge-confianza";
import { ETIQUETAS_ESTADO_FACTURA, ETIQUETAS_TIPO_COMPROBANTE } from "@/lib/comprobantes";
import type { Factura, TipoComprobante } from "@/lib/tipos";

function formatearMoneda(valor: number | null) {
  if (valor === null) return "-";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(valor);
}

export function TablaFacturas({ facturas }: { facturas: Factura[] }) {
  if (facturas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        Todavia no hay facturas procesadas. Empeza subiendo la primera con &quot;Cargar Facturas&quot;.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Numero</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Confianza</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {facturas.map((factura) => (
            <TableRow key={factura.id} className="cursor-pointer hover:bg-muted/50">
              <TableCell>
                <Link href={`/facturas/${factura.id}`} className="block">
                  {factura.fecha_emision ?? "-"}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/facturas/${factura.id}`} className="block">
                  {ETIQUETAS_TIPO_COMPROBANTE[factura.tipo_comprobante as TipoComprobante] ?? factura.tipo_comprobante}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/facturas/${factura.id}`} className="block">
                  {factura.punto_venta && factura.numero
                    ? `${factura.punto_venta}-${factura.numero}`
                    : factura.numero ?? "-"}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/facturas/${factura.id}`} className="block">
                  {factura.emisor_razon_social ?? "-"}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/facturas/${factura.id}`} className="block">
                  {formatearMoneda(factura.total)}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/facturas/${factura.id}`} className="block">
                  {ETIQUETAS_ESTADO_FACTURA[factura.estado] ?? factura.estado}
                  {factura.duplicada && " (duplicada)"}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/facturas/${factura.id}`} className="block">
                  <BadgeConfianza porcentaje={factura.confianza_porcentaje} />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
