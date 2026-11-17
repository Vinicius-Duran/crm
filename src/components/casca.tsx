"use client";

import { usePathname } from "next/navigation";
import { BarraSuperior } from "@/components/barra-superior";
import { MenuLateral } from "@/components/menu-lateral";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { Usuario } from "@/lib/sessao";

// Menu lateral e barra superior em toda tela logada, menos no check-in (tela cheia, modo foco)
// e em /entrar (sem sessão ainda).
export function Casca({ usuario, children }: { usuario: Usuario | null; children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/checkin") || pathname === "/entrar" || !usuario) {
    return <main className="mx-auto w-full max-w-2xl px-4 py-6">{children}</main>;
  }
  return (
    <SidebarProvider>
      <MenuLateral visao={{ papel: usuario.papel, adminPlataforma: usuario.adminPlataforma, modulos: usuario.conta.modulos }} />
      <SidebarInset>
        <BarraSuperior />
        <main className="mx-auto w-full max-w-7xl px-3 py-6 md:px-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
