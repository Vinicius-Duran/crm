import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Casca } from "@/components/casca";
import "./globals.css";

const geist = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "CRM de eventos" };

// Toda tela lê o banco na hora; nada é pré-renderizado no build.
export const dynamic = "force-dynamic";

// Aplica o tema salvo antes da pintura, para a tela não piscar clara no modo escuro.
const SCRIPT_TEMA = `try{var t=localStorage.getItem("tema");if(t==="escuro"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <TooltipProvider>
          <Casca>{children}</Casca>
        </TooltipProvider>
        <Toaster richColors />
      </body>
    </html>
  );
}
