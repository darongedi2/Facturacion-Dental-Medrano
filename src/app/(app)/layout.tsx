import type { ReactNode } from "react";
import { Navbar } from "@/components/shared/navbar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {children}
    </div>
  );
}
