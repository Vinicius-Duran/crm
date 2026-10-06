import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";

export type DadosCredencial = {
  nome: string;
  tipo: string; // rótulo já legível: "VIP", "Palestrante"
  empresa: string | null; // onde o participante trabalha
  empresaCliente: string; // dona do evento
  evento: string;
  tipoEvento: string; // rótulo já legível: "Premiação e incentivo"
  data: string; // "17/05/2026"
  codigo: string;
};

// Todo texto da credencial, na ordem de cima para baixo. Separado do desenho para dar para testar:
// o pdf-lib grava o conteúdo comprimido, e o texto não aparece cru no arquivo.
export function textosCredencial(d: DadosCredencial) {
  const ano = d.data.slice(-4);
  return {
    empresaCliente: d.empresaCliente.toUpperCase(),
    evento: d.evento,
    subtitulo: `${d.tipoEvento} · ${d.data}`,
    codigo: d.codigo,
    nome: d.nome,
    tipo: d.tipo.toUpperCase(),
    empresa: d.empresa,
    aviso: "Credencial pessoal e intransferível.",
    instrucao: "Apresente este QR code na entrada do evento.",
    rodape: `© ${ano} ${d.empresaCliente} · Organização VM Events. Todos os direitos reservados.`,
  };
}

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

// Diminui a fonte até caber na largura; texto comprido não vaza da página.
function tamanhoQueCabe(fonte: PDFFont, texto: string, maximo: number, largura: number): number {
  let tamanho = maximo;
  while (tamanho > 6 && fonte.widthOfTextAtSize(texto, tamanho) > largura) tamanho -= 1;
  return tamanho;
}

export async function gerarCredencialPdf(d: DadosCredencial): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([595.28, 841.89]); // A4 em pontos
  const { width, height } = pagina.getSize();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const margem = 56;
  const larguraUtil = width - margem * 2;
  const cinza = rgb(0.4, 0.4, 0.4);
  const t = textosCredencial(d);

  const centro = (texto: string, fonte: PDFFont, tamanho: number, y: number, cor = rgb(0.1, 0.1, 0.1)) => {
    const seguro = textoSeguro(fonte, texto);
    const s = tamanhoQueCabe(fonte, seguro, tamanho, larguraUtil);
    pagina.drawText(seguro, { x: (width - fonte.widthOfTextAtSize(seguro, s)) / 2, y, size: s, font: fonte, color: cor });
  };

  centro(t.empresaCliente, negrito, 11, height - 70, cinza);
  centro(t.evento, negrito, 22, height - 100);
  centro(t.subtitulo, regular, 12, height - 122, cinza);

  // QR em vetor, direto da matriz: gerar e embutir um PNG custava ~120 ms por credencial (o ZIP de
  // um evento de 10.000 levaria ~20 min). Cada trecho de módulos escuros de uma linha vira um retângulo.
  const { modules } = QRCode.create(d.codigo, { errorCorrectionLevel: "M" });
  const lado = 280;
  const modulo = lado / (modules.size + 2); // 1 módulo de margem em volta, como antes
  const x0 = (width - lado) / 2 + modulo;
  const topo = height - 150 - modulo;
  for (let linha = 0; linha < modules.size; linha++) {
    for (let coluna = 0; coluna < modules.size; ) {
      if (!modules.get(linha, coluna)) {
        coluna++;
        continue;
      }
      const inicio = coluna;
      while (coluna < modules.size && modules.get(linha, coluna)) coluna++;
      pagina.drawRectangle({
        x: x0 + inicio * modulo,
        y: topo - (linha + 1) * modulo,
        width: (coluna - inicio) * modulo,
        // Um fio a mais de altura: sem isso alguns leitores de PDF mostram uma linha clara entre as fileiras.
        height: modulo + 0.05,
        color: rgb(0, 0, 0),
      });
    }
  }
  // Impresso embaixo do QR: se a câmera falhar, a equipe digita no check-in.
  centro(t.codigo, mono, 12, height - 450, cinza);

  centro(t.nome, negrito, 30, height - 510);
  centro(t.tipo, negrito, 16, height - 542, cinza);
  if (t.empresa) centro(t.empresa, regular, 15, height - 566);

  centro(t.aviso, regular, 11, 120, cinza);
  centro(t.instrucao, regular, 11, 104, cinza);
  pagina.drawLine({ start: { x: margem, y: 84 }, end: { x: width - margem, y: 84 }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
  centro(t.rodape, regular, 9, 64, cinza);

  return pdf.save();
}
