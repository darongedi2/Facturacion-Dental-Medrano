import type { ReactNode } from "react";

// Layout del area autenticada (dashboard, cargar, facturas). La barra de
// navegacion y el chequeo de sesion se completan en el paso de frontend.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
