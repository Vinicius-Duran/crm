import "server-only";
import { Resend } from "resend";
import type { Credencial } from "./credencial";
import { escaparHtml } from "./texto";
import { nomeArquivo } from "./zip";

export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type ResultadoEnvio = { ok: true } | { ok: false; erro: string; cotaEsgotada: boolean };

export async function enviarCredencial(c: Credencial, pdf: Uint8Array): Promise<ResultadoEnvio> {
  if (!c.email) return { ok: false, erro: "Participante sem e-mail", cotaEsgotada: false };
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: c.email,
    subject: `Sua credencial: ${c.evento}`,
    html:
      `<p>Olá, ${escaparHtml(c.nome)}.</p>` +
      `<p>Segue em anexo sua credencial para <strong>${escaparHtml(c.evento)}</strong> (${c.data}).</p>` +
      `<p>Apresente o QR code na entrada, no celular ou impresso.</p>`,
    // Resend serializa Uint8Array/Buffer errado no JSON; base64 é o formato seguro.
    attachments: [{ filename: `${nomeArquivo(c.nome)}.pdf`, content: Buffer.from(pdf).toString("base64") }],
  });
  if (!error) return { ok: true };
  return {
    ok: false,
    erro: error.message,
    cotaEsgotada: error.name === "daily_quota_exceeded" || error.name === "monthly_quota_exceeded",
  };
}
