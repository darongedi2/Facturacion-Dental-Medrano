"use client";

import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Clasificacion } from "@/lib/tipos";

type EstadoCarga = "eligiendo" | "subiendo" | "completado";

interface ResultadoArchivo {
  nombre: string;
  ok: boolean;
  mensaje?: string;
}

export default function CargarPage() {
  const router = useRouter();
  const [clasificacion, setClasificacion] = useState<Clasificacion | null>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [estado, setEstado] = useState<EstadoCarga>("eligiendo");
  const [progreso, setProgreso] = useState(0);
  const [resultados, setResultados] = useState<ResultadoArchivo[]>([]);
  const canceladoRef = useRef(false);

  const onDrop = useCallback((archivosAceptados: File[]) => {
    setArchivos((previos) => [...previos, ...archivosAceptados]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
  });

  function quitarArchivo(indice: number) {
    setArchivos((previos) => previos.filter((_, i) => i !== indice));
  }

  async function procesar() {
    if (!clasificacion || archivos.length === 0) return;
    setEstado("subiendo");
    setProgreso(0);
    setResultados([]);
    canceladoRef.current = false;

    const resSesion = await fetch("/api/sesiones-carga", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clasificacion }),
    });
    if (!resSesion.ok) {
      setResultados([{ nombre: "General", ok: false, mensaje: "No se pudo crear la sesion de carga" }]);
      setEstado("completado");
      return;
    }
    const { sesionCarga } = await resSesion.json();

    const nuevosResultados: ResultadoArchivo[] = [];
    for (let i = 0; i < archivos.length; i++) {
      if (canceladoRef.current) break;

      const archivo = archivos[i];
      const formData = new FormData();
      formData.append("archivo", archivo);

      try {
        const res = await fetch(`/api/sesiones-carga/${sesionCarga.id}/archivos`, {
          method: "POST",
          body: formData,
        });
        const cuerpo = await res.json();
        if (res.ok && cuerpo.archivos?.length > 0) {
          nuevosResultados.push({ nombre: archivo.name, ok: true });
        } else {
          nuevosResultados.push({
            nombre: archivo.name,
            ok: false,
            mensaje: cuerpo.errores?.[0]?.mensaje ?? cuerpo.error ?? "Error al subir",
          });
        }
      } catch {
        nuevosResultados.push({ nombre: archivo.name, ok: false, mensaje: "Error de conexion" });
      }

      setProgreso(Math.round(((i + 1) / archivos.length) * 100));
      setResultados([...nuevosResultados]);
    }

    setEstado("completado");
  }

  function cancelar() {
    canceladoRef.current = true;
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Cargar facturas</h1>

      <Card>
        <CardContent className="flex flex-col gap-6 pt-6">
          <div>
            <p className="mb-2 text-sm font-medium">¿Estas facturas corresponden a?</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="clasificacion"
                  checked={clasificacion === "compra"}
                  onChange={() => setClasificacion("compra")}
                  disabled={estado !== "eligiendo"}
                />
                Compras
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="clasificacion"
                  checked={clasificacion === "venta"}
                  onChange={() => setClasificacion("venta")}
                  disabled={estado !== "eligiendo"}
                />
                Ventas
              </label>
            </div>
          </div>

          {estado === "eligiendo" && (
            <>
              <div
                {...getRootProps()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors",
                  isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                )}
              >
                <input {...getInputProps()} />
                <p className="text-sm text-muted-foreground">
                  Arrastra PDFs o imagenes aca, o hace clic para elegir archivos.
                </p>
              </div>

              {archivos.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm">
                  {archivos.map((archivo, indice) => (
                    <li key={`${archivo.name}-${indice}`} className="flex items-center justify-between rounded border px-3 py-1.5">
                      <span className="truncate">{archivo.name}</span>
                      <button
                        type="button"
                        onClick={() => quitarArchivo(indice)}
                        className="ml-2 text-muted-foreground hover:text-destructive"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                size="lg"
                disabled={!clasificacion || archivos.length === 0}
                onClick={procesar}
              >
                Procesar y guardar ({archivos.length})
              </Button>
            </>
          )}

          {estado === "subiendo" && (
            <div className="flex flex-col gap-3">
              <Progress value={progreso} />
              <p className="text-sm text-muted-foreground">Subiendo archivos... {progreso}%</p>
              <Button variant="outline" onClick={cancelar}>Cancelar</Button>
            </div>
          )}

          {estado === "completado" && (
            <div className="flex flex-col gap-3">
              <ul className="flex flex-col gap-1 text-sm">
                {resultados.map((resultado, indice) => (
                  <li
                    key={indice}
                    className={cn(
                      "rounded border px-3 py-1.5",
                      resultado.ok ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50",
                    )}
                  >
                    {resultado.ok ? "✅" : "❌"} {resultado.nombre}
                    {resultado.mensaje && ` — ${resultado.mensaje}`}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                Los archivos quedaron cargados. La lectura automatica con IA todavia no esta activa
                (paso 6 del roadmap) — por ahora solo se guardaron los archivos.
              </p>
              <Button onClick={() => router.push("/dashboard")}>Ir al Dashboard</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
