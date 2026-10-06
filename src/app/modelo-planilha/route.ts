import { modeloPlanilha } from "@/lib/planilha";

export function GET() {
  return new Response(Buffer.from(modeloPlanilha()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-participantes.xlsx"',
    },
  });
}
