"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ENLACES = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cargar", label: "Cargar Facturas" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  async function salir() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b bg-background px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="font-semibold">Facturas AR IA</span>
        <nav className="flex gap-4">
          {ENLACES.map((enlace) => (
            <Link
              key={enlace.href}
              href={enlace.href}
              className={cn(
                "text-sm text-muted-foreground hover:text-foreground",
                pathname === enlace.href && "font-medium text-foreground",
              )}
            >
              {enlace.label}
            </Link>
          ))}
        </nav>
      </div>
      <Button variant="ghost" size="sm" onClick={salir}>
        Salir
      </Button>
    </header>
  );
}
