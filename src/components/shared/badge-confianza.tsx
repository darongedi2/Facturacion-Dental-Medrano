import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Semaforo de confianza: 95-100 verde, 80-94 amarillo, <80 rojo (ARQUITECTURA.md §7).
export function BadgeConfianza({ porcentaje }: { porcentaje: number | null }) {
  if (porcentaje === null) {
    return <Badge variant="outline">Sin procesar</Badge>;
  }

  const color =
    porcentaje >= 95
      ? "bg-green-100 text-green-800 border-green-300"
      : porcentaje >= 80
        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
        : "bg-red-100 text-red-800 border-red-300";

  return <Badge className={cn("border", color)}>{porcentaje}%</Badge>;
}
