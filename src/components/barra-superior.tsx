"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { trilha } from "@/lib/navegacao";

function alternarTema() {
  const escuro = document.documentElement.classList.toggle("dark");
  try {
    localStorage.setItem("tema", escuro ? "escuro" : "claro");
  } catch {}
}

export function BarraSuperior() {
  const passos = trilha(usePathname());
  return (
    <header className="sticky top-3 z-10 mx-3 mt-3 flex h-14 items-center gap-2 rounded-xl border bg-background/95 px-3 backdrop-blur md:mx-6">
      <SidebarTrigger aria-label="Recolher menu" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {passos.map((p, i) => (
            <Fragment key={p.href}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="truncate">
                {i === passos.length - 1 ? (
                  <BreadcrumbPage>{p.texto}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={p.href} />}>{p.texto}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <Button variant="ghost" size="icon-sm" onClick={alternarTema} aria-label="Alternar tema claro e escuro">
        <Sun className="hidden dark:block" />
        <Moon className="dark:hidden" />
      </Button>
    </header>
  );
}
