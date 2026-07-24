"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeConfianza } from "@/components/shared/badge-confianza";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ErrorValidacion, Factura, Producto } from "@/lib/tipos";

function Campo({
  etiqueta,
  valor,
  onChange,
  tipo = "text",
}: {
  etiqueta: string;
  valor: string | number | null;
  onChange: (valor: string) => void;
  tipo?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{etiqueta}</Label>
      <Input type={tipo} value={valor ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function RevisionFacturaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [factura, setFactura] = useState<(Factura & { productos: Producto[] }) | null>(null);
  const [urlVistaPrevia, setUrlVistaPrevia] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/facturas/${id}`)
      .then((r) => r.json())
      .then((cuerpo) => {
        setFactura(cuerpo.factura ?? null);
        setUrlVistaPrevia(cuerpo.urlVistaPrevia ?? null);
      })
      .finally(() => setCargando(false));
  }, [id]);

  function actualizarCampo<K extends keyof Factura>(campo: K, valor: Factura[K]) {
    setFactura((previo) => (previo ? { ...previo, [campo]: valor } : previo));
  }

  async function guardar() {
    if (!factura) return;
    setGuardando(true);
    setMensaje(null);
    const res = await fetch(`/api/facturas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(factura),
    });
    setGuardando(false);
    setMensaje(res.ok ? "Guardado." : "Error al guardar.");
  }

  async function marcarValidada() {
    await fetch(`/api/facturas/${id}/validar`, { method: "POST" });
    router.push("/dashboard");
  }

  if (cargando) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  if (!factura) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-muted-foreground">No se encontro la factura.</p>
      </main>
    );
  }

  const errores = (factura.errores_detectados ?? []) as ErrorValidacion[];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Revision de factura</h1>
        <div className="flex items-center gap-3">
          <BadgeConfianza porcentaje={factura.confianza_porcentaje} />
          <Button variant="outline" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
          <Button onClick={marcarValidada}>Marcar como validada</Button>
        </div>
      </div>

      {errores.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Se detectaron posibles problemas:</p>
          <ul className="list-inside list-disc">
            {errores.map((error, indice) => (
              <li key={indice}>{error.mensaje}</li>
            ))}
          </ul>
        </div>
      )}
      {mensaje && <p className="mb-4 text-sm text-muted-foreground">{mensaje}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-muted/20 p-2">
          {urlVistaPrevia ? (
            factura.archivo_id && urlVistaPrevia.includes(".pdf") ? (
              <iframe src={urlVistaPrevia} className="h-[80vh] w-full rounded" title="Vista previa" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlVistaPrevia} alt="Vista previa de la factura" className="w-full rounded" />
            )
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">Sin vista previa disponible.</p>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Comprobante</h2>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Letra" valor={factura.letra} onChange={(v) => actualizarCampo("letra", v)} />
              <Campo etiqueta="Punto de venta" valor={factura.punto_venta} onChange={(v) => actualizarCampo("punto_venta", v)} />
              <Campo etiqueta="Numero" valor={factura.numero} onChange={(v) => actualizarCampo("numero", v)} />
              <Campo etiqueta="Fecha de emision" tipo="date" valor={factura.fecha_emision} onChange={(v) => actualizarCampo("fecha_emision", v)} />
              <Campo etiqueta="Fecha de pago" tipo="date" valor={factura.fecha_pago} onChange={(v) => actualizarCampo("fecha_pago", v)} />
              <Campo etiqueta="Moneda" valor={factura.moneda} onChange={(v) => actualizarCampo("moneda", v)} />
              <Campo etiqueta="Condicion de venta" valor={factura.condicion_venta} onChange={(v) => actualizarCampo("condicion_venta", v)} />
              <Campo etiqueta="CAE" valor={factura.cae} onChange={(v) => actualizarCampo("cae", v)} />
              <Campo etiqueta="Vencimiento CAE" tipo="date" valor={factura.cae_vencimiento} onChange={(v) => actualizarCampo("cae_vencimiento", v)} />
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Emisor</h2>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Razon social" valor={factura.emisor_razon_social} onChange={(v) => actualizarCampo("emisor_razon_social", v)} />
              <Campo etiqueta="CUIT" valor={factura.emisor_cuit} onChange={(v) => actualizarCampo("emisor_cuit", v)} />
              <Campo etiqueta="Direccion" valor={factura.emisor_direccion} onChange={(v) => actualizarCampo("emisor_direccion", v)} />
              <Campo etiqueta="Localidad" valor={factura.emisor_localidad} onChange={(v) => actualizarCampo("emisor_localidad", v)} />
              <Campo etiqueta="Provincia" valor={factura.emisor_provincia} onChange={(v) => actualizarCampo("emisor_provincia", v)} />
              <Campo etiqueta="Condicion IVA" valor={factura.emisor_condicion_iva} onChange={(v) => actualizarCampo("emisor_condicion_iva", v)} />
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Cliente</h2>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Razon social" valor={factura.cliente_razon_social} onChange={(v) => actualizarCampo("cliente_razon_social", v)} />
              <Campo etiqueta="CUIT" valor={factura.cliente_cuit} onChange={(v) => actualizarCampo("cliente_cuit", v)} />
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Impuestos</h2>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Neto gravado" tipo="number" valor={factura.importe_neto_gravado} onChange={(v) => actualizarCampo("importe_neto_gravado", Number(v))} />
              <Campo etiqueta="IVA 21%" tipo="number" valor={factura.iva_21} onChange={(v) => actualizarCampo("iva_21", Number(v))} />
              <Campo etiqueta="IVA 27%" tipo="number" valor={factura.iva_27} onChange={(v) => actualizarCampo("iva_27", Number(v))} />
              <Campo etiqueta="IVA 10.5%" tipo="number" valor={factura.iva_105} onChange={(v) => actualizarCampo("iva_105", Number(v))} />
              <Campo etiqueta="Percepcion IIBB" tipo="number" valor={factura.percepcion_iibb} onChange={(v) => actualizarCampo("percepcion_iibb", Number(v))} />
              <Campo etiqueta="Total" tipo="number" valor={factura.total} onChange={(v) => actualizarCampo("total", Number(v))} />
            </div>
          </section>
        </div>
      </div>

      {factura.productos?.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Productos</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripcion</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Precio unitario</TableHead>
                <TableHead>IVA</TableHead>
                <TableHead>Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factura.productos.map((producto) => (
                <TableRow key={producto.id}>
                  <TableCell>{producto.descripcion}</TableCell>
                  <TableCell>{producto.cantidad ?? "-"}</TableCell>
                  <TableCell>{producto.precio_unitario ?? "-"}</TableCell>
                  <TableCell>{producto.alicuota_iva ?? "-"}</TableCell>
                  <TableCell>{producto.subtotal_con_iva ?? producto.subtotal ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </main>
  );
}
