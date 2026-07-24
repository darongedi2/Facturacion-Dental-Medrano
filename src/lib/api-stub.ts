import { NextResponse } from "next/server";

// Respuesta temporal para rutas todavia no implementadas (paso 2: solo
// existe el esqueleto de carpetas). Se reemplaza ruta por ruta en el paso
// de backend.
export function noImplementado(ruta: string) {
  return NextResponse.json(
    { error: "No implementado todavia", ruta },
    { status: 501 },
  );
}
