"use client";

import { usePathname } from "next/navigation";
import { BarraSuperior } from "@/components/barra-superior";
import { MenuLateral } from "@/components/menu-lateral";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Menu lateral e barra superior em todas as telas, menos no check-in, que é tela cheia (modo foco).
export function Casca({ children }: { children: React.ReactNode }) {
  if (usePathname().startsWith("/checkin")) return <main className="mx-auto w-full max-w-2xl px-4 py-6">{children}</main>;
  return (
    <SidebarProvider>
      <MenuLateral />
      <SidebarInset>
        <BarraSuperior />
        <main className="mx-auto w-full max-w-7xl px-3 py-6 md:px-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
