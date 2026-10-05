import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";

export type DadosCredencial = {
  nome: string;
  tipo: string; // rótulo já legível: "VIP", "Palestrante"
  empresa: string | null;
  evento: string;
  data: string; // "17/05/2026"
  codigo: string;
};

// Helvetica padrão só codifica WinAnsi (cobre português). Fora disso, tira acento e troca o resto por "?".
export function textoSeguro(fonte: PDFFont, texto: string): string {
  try {
    fonte.encodeText(texto);
    return texto;
  } catch {
    return texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\x20-\x7E]/g, "?");
  }
}

// Diminui a fonte até caber na largura; nome comprido não vaza da página.
function tamanhoQueCabe(fonte: PDFFont, texto: string, maximo: number, largura: number): number {
  let tamanho = maximo;
  while (tamanho > 10 && fonte.widthOfTextAtSize(texto, tamanho) > largura) tamanho -= 1;
  return tamanho;
}

export async function gerarCredencialPdf(d: DadosCredencial): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([595.28, 841.89]); // A4 em pontos
  const { width, height } = pagina.getSize();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margem = 56;
  const larguraUtil = width - margem * 2;

  const centro = (texto: string, fonte: PDFFont, tamanho: number, y: number, cor = rgb(0.1, 0.1, 0.1)) => {
    const t = textoSeguro(fonte, texto);
    const s = tamanhoQueCabe(fonte, t, tamanho, larguraUtil);
    pagina.drawText(t, { x: (width - fonte.widthOfTextAtSize(t, s)) / 2, y, size: s, font: fonte, color: cor });
  };

  centro(d.evento, negrito, 20, height - 90);
  centro(d.data, regular, 13, height - 112, rgb(0.4, 0.4, 0.4));

  const png = await QRCode.toBuffer(d.codigo, { errorCorrectionLevel: "M", margin: 1, width: 600 });
  const qr = await pdf.embedPng(png);
  const lado = 300;
  pagina.drawImage(qr, { x: (width - lado) / 2, y: height - 170 - lado, width: lado, height: lado });

  centro(d.nome, negrito, 30, height - 530);
  centro(d.tipo.toUpperCase(), negrito, 16, height - 565, rgb(0.35, 0.35, 0.35));
  if (d.empresa) centro(d.empresa, regular, 16, height - 592);
  centro("Apresente este QR code na entrada do evento.", regular, 11, 60, rgb(0.45, 0.45, 0.45));

  return pdf.save();
}
