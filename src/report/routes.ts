/**
 * Rotas HTTP do relatório de entregas.
 *
 *   GET /relatorio/:workspaceId?s=<assinatura>[&atualizar=1]
 *   GET /relatorio/img/:artifactId?s=<assinatura>
 *
 * Os links são assinados (HMAC) — só quem recebeu o link abre a página,
 * e só as imagens que aparecem nela podem ser baixadas.
 * Use a ferramenta ekyte_report_link para gerar o link de um workspace.
 */

import type { Express, Request, Response } from "express";
import { downloadArtifact, getWorkspaceReport, sign, verify } from "../services/publications.js";
import { renderReportPage } from "./page.js";

type Resizer = (buf: Buffer) => Promise<Buffer>;
let resizer: Resizer | null | undefined;

async function getResizer(): Promise<Resizer | null> {
  if (resizer !== undefined) return resizer;
  try {
    const mod: any = await import("sharp");
    const sharp = mod.default ?? mod;
    resizer = (buf) => sharp(buf, { failOn: "none" }).rotate().resize({ width: 520, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
  } catch (e) {
    console.error("[report] sharp indisponível, imagens vão no tamanho original:", e instanceof Error ? e.message : e);
    resizer = null;
  }
  return resizer;
}

// Miniaturas em memória (cada uma ~30–60 KB).
const thumbs = new Map<number, { buf: Buffer; type: string }>();
const MAX_THUMBS = 800;

export function reportLink(baseUrl: string, workspaceId: number): string {
  return `${baseUrl.replace(/\/+$/, "")}/relatorio/${workspaceId}?s=${sign("r", workspaceId)}`;
}

export function registerReportRoutes(app: Express): void {
  app.get("/relatorio/img/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || !verify("i", id, req.query.s)) {
      res.status(404).end();
      return;
    }
    try {
      let hit = thumbs.get(id);
      if (!hit) {
        const original = await downloadArtifact(id);
        if (!/^image\//i.test(original.type)) {
          res.status(415).end();
          return;
        }
        const resize = await getResizer();
        hit = original;
        if (resize) {
          try {
            hit = { buf: await resize(original.buf), type: "image/webp" };
          } catch {
            /* mantém original */
          }
        }
        if (thumbs.size >= MAX_THUMBS) thumbs.delete(thumbs.keys().next().value as number);
        thumbs.set(id, hit);
      }
      res.setHeader("Content-Type", hit.type);
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      res.end(hit.buf);
    } catch (e) {
      console.error(`[report] img ${id}:`, e instanceof Error ? e.message : e);
      res.status(502).end();
    }
  });

  app.get("/relatorio/:ws", async (req: Request, res: Response) => {
    const ws = Number(req.params.ws);
    if (!Number.isInteger(ws) || ws <= 0 || !verify("r", ws, req.query.s)) {
      res.status(404).type("text/plain").send("Relatório não encontrado. Confira o link completo.");
      return;
    }
    try {
      const refresh = req.query.atualizar === "1";
      const report = await getWorkspaceReport(ws, refresh);
      const html = renderReportPage(report, { refreshHref: `/relatorio/${ws}?s=${req.query.s}&atualizar=1` });
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.type("html").send(html);
    } catch (e) {
      console.error(`[report] ws ${ws}:`, e);
      res.status(502).type("text/plain").send("Não consegui ler o eKyte agora. Tente de novo em alguns minutos.");
    }
  });
}
