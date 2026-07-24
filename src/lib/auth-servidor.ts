import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Devuelve el usuario autenticado o null. Usar dentro de un Route Handler
 * con el cliente de crearClienteServidor().
 */
export async function usuarioActual(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Respuesta 401 estandar para rutas de API sin sesion. */
export function noAutenticado() {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}
