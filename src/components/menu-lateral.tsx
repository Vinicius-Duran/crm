"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarDays, FileSpreadsheet, QrCode, Users, type LucideIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { GRUPOS, itemAtivo } from "@/lib/navegacao";

const ICONES: Record<string, LucideIcon> = {
  "/eventos": CalendarDays,
  "/participantes": Users,
  "/empresas": Building2,
  "/participantes/importar": FileSpreadsheet,
  "/checkin": QrCode,
};

export function MenuLateral() {
  const ativo = itemAtivo(usePathname());
  // No celular o menu é uma gaveta: fecha ao escolher um item.
  const { setOpenMobile } = useSidebar();
  const fechar = () => setOpenMobile(false);
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/eventos" onClick={fechar} />}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <QrCode className="size-4" />
              </span>
              <span className="grid leading-tight">
                <span className="font-semibold">CRM de eventos</span>
                <span className="text-xs text-muted-foreground">Credenciamento</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {GRUPOS.map((g) => (
          <SidebarGroup key={g.titulo}>
            <SidebarGroupLabel>{g.titulo}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.itens.map(({ href, texto }) => {
                  const Icone = ICONES[href];
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        isActive={ativo === href}
                        tooltip={texto}
                        render={<Link href={href} onClick={fechar} />}
                      >
                        <Icone />
                        <span>{texto}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
