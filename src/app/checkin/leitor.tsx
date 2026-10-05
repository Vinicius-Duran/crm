"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import gsap from "gsap";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buscarInscritos, checkinPorCodigo, checkinPorInscricao, type Inscrito, type ResultadoCheckin } from "./actions";

// Verde/âmbar/vermelho distintos; contraste texto/fundo medido ≥ 4,5:1 nos dois temas
// (tabela completa, par a par, no IMPLEMENTACAO.md da issue #21).
const COR = {
  ok: "border-sucesso bg-sucesso/10 text-sucesso",
  repetido: "border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50",
  outro_evento: "border-destructive bg-destructive/10 text-red-950 dark:text-destructive",
  desconhecido: "border-destructive bg-destructive/10 text-red-950 dark:text-destructive",
} as const;

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

function Cartao({ r }: { r: ResultadoCheckin }) {
  const caixa = useRef<HTMLDivElement>(null);
  // Cada resultado entra com um "pulo" curto; quem prefere menos movimento vê o cartão direto.
  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(caixa.current, { scale: 0.96, opacity: 0, duration: 0.22, ease: "power2.out" });
    });
    return () => mm.revert();
  }, [r]);
  return (
    <div ref={caixa} role="status" aria-live="assertive" className={`rounded-xl border-2 p-5 ${COR[r.status]}`}>
      {r.status === "ok" && (
        <>
          <p className="text-sm font-semibold uppercase tracking-wide">Check-in feito · entregar crachá</p>
          <p className="mt-1 text-3xl font-bold">{r.nome}</p>
          <p className="text-lg">{r.tipo}{r.empresa ? ` · ${r.empresa}` : ""}</p>
        </>
      )}
      {r.status === "repetido" && (
        <>
          <p className="text-sm font-semibold uppercase tracking-wide">Já fez check-in às {hora(r.checkinEm)}</p>
          <p className="mt-1 text-3xl font-bold">{r.nome}</p>
          <p className="text-lg">{r.tipo}{r.empresa ? ` · ${r.empresa}` : ""} · não entregar outro crachá</p>
        </>
      )}
      {r.status === "outro_evento" && (
        <>
          <p className="text-sm font-semibold uppercase tracking-wide">QR de outro evento</p>
          <p className="mt-1 text-3xl font-bold">{r.nome}</p>
          <p className="text-lg">Inscrito em: {r.evento}</p>
        </>
      )}
      {r.status === "desconhecido" && <p className="text-2xl font-bold">Código não encontrado</p>}
    </div>
  );
}

export function Leitor({ eventos, padrao }: { eventos: { id: string; rotulo: string }[]; padrao: string }) {
  const [eventoId, setEventoId] = useState(padrao);
  const [resultado, setResultado] = useState<ResultadoCheckin | null>(null);
  const [erroCamera, setErroCamera] = useState("");
  const [inscritos, setInscritos] = useState<Inscrito[]>([]);
  const [pendente, iniciar] = useTransition();
  const video = useRef<HTMLVideoElement>(null);
  // O callback do scanner é criado uma vez; lê evento e último código por ref para não reabrir a câmera.
  const eventoRef = useRef(padrao);
  const ultimo = useRef({ codigo: "", em: 0 });

  useEffect(() => {
    eventoRef.current = eventoId;
  }, [eventoId]);

  const lerCodigo = (codigo: string) => {
    // A câmera lê o mesmo QR várias vezes por segundo; repetição em menos de 3 s é ignorada.
    const agora = Date.now();
    if (codigo === ultimo.current.codigo && agora - ultimo.current.em < 3000) return;
    ultimo.current = { codigo, em: agora };
    iniciar(async () => setResultado(await checkinPorCodigo(codigo, eventoRef.current || null)));
  };
  const lerCodigoRef = useRef(lerCodigo);
  useEffect(() => {
    lerCodigoRef.current = lerCodigo;
  });

  useEffect(() => {
    let scanner: { destroy(): void } | undefined;
    let cancelado = false;
    (async () => {
      const { default: QrScanner } = await import("qr-scanner");
      if (cancelado || !video.current) return;
      const s = new QrScanner(video.current, (r) => lerCodigoRef.current(r.data), {
        returnDetailedScanResult: true,
        preferredCamera: "environment",
        maxScansPerSecond: 5,
      });
      scanner = s;
      try {
        await s.start();
      } catch {
        if (!cancelado) setErroCamera("Não foi possível abrir a câmera. Use o campo de código ou a busca por nome.");
      }
    })();
    return () => {
      cancelado = true;
      scanner?.destroy();
    };
  }, []);

  return (
    <section className="grid gap-4">
      <h1 className="sr-only">Check-in</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/eventos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft />
          Voltar ao painel
        </Link>
        <select
          aria-label="Evento"
          value={eventoId}
          onChange={(e) => setEventoId(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">Qualquer evento</option>
          {eventos.map((e) => (
            <option key={e.id} value={e.id}>{e.rotulo}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent>
          <video ref={video} className="aspect-square w-full rounded-xl bg-black object-cover" muted playsInline />
        </CardContent>
      </Card>
      {erroCamera && <p className="text-sm text-destructive">{erroCamera}</p>}

      {/* Leitor de código de barras USB digita o código e manda Enter: cai aqui também. */}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const campo = e.currentTarget.elements.namedItem("codigo") as HTMLInputElement;
          lerCodigo(campo.value);
          campo.value = "";
        }}
      >
        <Input name="codigo" placeholder="Digite ou cole o código" aria-label="Código do QR" autoComplete="off" />
        <Button type="submit" disabled={pendente}>Validar</Button>
      </form>

      {resultado && <Cartao r={resultado} />}

      <Card>
        <CardContent className="grid gap-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const termo = (e.currentTarget.elements.namedItem("termo") as HTMLInputElement).value;
              iniciar(async () => setInscritos(await buscarInscritos(termo, eventoId || null)));
            }}
          >
            <Input name="termo" placeholder="Sem QR? Busque por nome ou CPF" aria-label="Buscar inscrito" />
            <Button type="submit" variant="outline" disabled={pendente}>Buscar</Button>
          </form>
          <ul className="grid gap-2">
            {inscritos.map((i) => (
              <li key={i.inscricaoId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span>
                  <span className="block font-medium">{i.nome}</span>
                  <span className="block text-xs text-muted-foreground">
                    {i.documento}{i.empresa ? ` · ${i.empresa}` : ""} · {i.evento}{i.checkinEm ? ` · check-in às ${hora(i.checkinEm)}` : ""}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={pendente}
                  onClick={() =>
                    iniciar(async () => {
                      setResultado(await checkinPorInscricao(i.inscricaoId, eventoId || null));
                      setInscritos([]);
                    })
                  }
                >
                  Check-in
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
