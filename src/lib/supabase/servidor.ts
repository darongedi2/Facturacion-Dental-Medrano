import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para usar en Server Components y Route Handlers.
 * Respeta la sesion del usuario (via cookies) y por lo tanto las
 * politicas de Row Level Security — nunca usar la service role key aca.
 */
export async function crearClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Llamado desde un Server Component (no puede setear cookies):
            // se ignora porque proxy.ts ya se encarga de refrescar la sesion.
          }
        },
      },
    },
  );
}
