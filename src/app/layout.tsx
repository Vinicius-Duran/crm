import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = { title: "CRM de eventos" };

// Toda tela lê o banco na hora; nada é pré-renderizado no build.
export const dynamic = "force-dynamic";

const MENU = [
  ["/eventos", "Eventos"],
  ["/participantes", "Participantes"],
  ["/empresas", "Empresas"],
  ["/checkin", "Check-in"],
] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <header className="border-b">
          <nav className="mx-auto flex max-w-6xl gap-4 overflow-x-auto px-4 py-3 text-sm font-medium">
            {MENU.map(([href, texto]) => (
              <Link key={href} href={href} className="whitespace-nowrap hover:underline">
                {texto}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <Toaster richColors />
      </body>
    </html>
  );
}
