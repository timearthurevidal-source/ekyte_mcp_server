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
import { spawn } from "node:child_process";
import { downloadArtifact, getWorkspaceReport, sign, verify, videoSource } from "../services/publications.js";
import { companyUrl, getRawClient } from "../services/ekyte-client.js";
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

// ---- capa de vídeo: um quadro extraído com ffmpeg
const VIDEO_CONCURRENCY = 2;
let running = 0;
const queue: Array<() => void> = [];
function acquire(): Promise<void> {
  if (running < VIDEO_CONCURRENCY) {
    running++;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(() => { running++; resolve(); }));
}
function release(): void {
  running--;
  const next = queue.shift();
  if (next) next();
}

function ffmpegFrame(url: string, headers: string, seek: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const args = ["-hide_banner", "-loglevel", "error"];
    if (headers) args.push("-headers", headers);
    args.push("-ss", String(seek), "-i", url, "-frames:v", "1", "-vf", "scale=520:-2", "-f", "image2", "-c:v", "mjpeg", "-q:v", "4", "pipe:1");
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => proc.kill("SIGKILL"), 60_000);
    proc.stdout.on("data", (c: Buffer) => chunks.push(c));
    proc.stderr.on("data", (c: Buffer) => { err += c.toString(); });
    proc.on("error", (e) => { clearTimeout(timer); reject(e); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      const buf = Buffer.concat(chunks);
      if (code === 0 && buf.length > 0) resolve(buf);
      else reject(new Error(`ffmpeg saiu com ${code}: ${err.slice(0, 300)}`));
    });
  });
}

const videoThumbs = new Map<number, { buf: Buffer; type: string }>();
const videoFails = new Map<number, number>(); // id -> horário da falha (evita repetir em loop)

async function videoThumb(id: number): Promise<{ buf: Buffer; type: string }> {
  const hit = videoThumbs.get(id);
  if (hit) return hit;
  const failedAt = videoFails.get(id);
  if (failedAt && Date.now() - failedAt < 60 * 60 * 1000) throw new Error("falha recente");
  await acquire();
  try {
    const again = videoThumbs.get(id);
    if (again) return again;
    const src = await videoSource(id);
    let jpg: Buffer;
    try {
      jpg = await ffmpegFrame(src.url, src.headers, 1);
    } catch {
      jpg = await ffmpegFrame(src.url, src.headers, 0);
    }
    let out = { buf: jpg, type: "image/jpeg" };
    const resize = await getResizer();
    if (resize) {
      try { out = { buf: await resize(jpg), type: "image/webp" }; } catch { /* mantém jpg */ }
    }
    if (videoThumbs.size >= MAX_THUMBS) videoThumbs.delete(videoThumbs.keys().next().value as number);
    videoThumbs.set(id, out);
    return out;
  } catch (e) {
    videoFails.set(id, Date.now());
    throw e;
  } finally {
    release();
  }
}

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

  app.get("/relatorio/vthumb/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || !verify("v", id, req.query.s)) {
      res.status(404).end();
      return;
    }
    try {
      const t = await videoThumb(id);
      res.setHeader("Content-Type", t.type);
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      res.end(t.buf);
    } catch (e) {
      console.error(`[report] vthumb ${id}:`, e instanceof Error ? e.message : e);
      res.setHeader("Cache-Control", "no-store");
      res.status(502).end();
    }
  });

  // Vídeo para tocar no relatório: redireciona para o link temporário do armazenamento
  // quando o eKyte oferece um (não passa tráfego pela Railway); senão, repassa com suporte a Range.
  app.get("/relatorio/video/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || !verify("v", id, req.query.s)) {
      res.status(404).end();
      return;
    }
    try {
      const src = await videoSource(id);
      if (!src.headers) {
        res.setHeader("Cache-Control", "no-store");
        res.redirect(302, src.url);
        return;
      }
      const range = typeof req.headers.range === "string" ? req.headers.range : undefined;
      const up = await getRawClient().get(companyUrl(`artifacts/${id}/download`), {
        responseType: "stream",
        headers: range ? { Range: range } : {},
        validateStatus: (s) => s >= 200 && s < 300,
        timeout: 0,
      });
      res.status(up.status);
      for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
        const v = up.headers[h];
        if (v) res.setHeader(h, String(v));
      }
      if (!up.headers["accept-ranges"]) res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "private, max-age=3600");
      const stream = up.data as NodeJS.ReadableStream & { destroy: () => void };
      req.on("close", () => stream.destroy());
      stream.pipe(res);
    } catch (e) {
      console.error(`[report] video ${id}:`, e instanceof Error ? e.message : e);
      if (!res.headersSent) res.status(502).end();
    }
  });

  // Checagem dos vídeos de um workspace (mesma assinatura do relatório). Devolve JSON.
  app.get("/relatorio/:ws/diag-video", async (req: Request, res: Response) => {
    const ws = Number(req.params.ws);
    if (!Number.isInteger(ws) || ws <= 0 || !verify("r", ws, req.query.s)) {
      res.status(404).end();
      return;
    }
    const report = await getWorkspaceReport(ws);
    const vids = report.pieces.filter((p) => p.videoId).slice(0, 4);
    const out: any[] = [];
    for (const p of vids) {
      const id = p.videoId as number;
      const r: any = { id, titulo: p.title };
      try {
        const src = await videoSource(id);
        r.fonte = src.headers ? "proxy (sem redirecionamento)" : `redireciona para ${new URL(src.url).host}`;
      } catch (e: any) {
        r.fonte_erro = `${e?.response?.status ?? ""} ${e?.message ?? e}`.trim();
      }
      try {
        const t0 = Date.now();
        const t = await videoThumb(id);
        r.capa = `ok ${t.type} ${t.buf.length}B em ${Date.now() - t0}ms`;
      } catch (e: any) {
        r.capa_erro = `${e?.message ?? e}`.slice(0, 400);
      }
      try {
        const up = await getRawClient().get(companyUrl(`artifacts/${id}/download`), {
          responseType: "stream", headers: { Range: "bytes=0-1023" }, maxRedirects: 5,
          validateStatus: () => true, timeout: 20000,
        });
        (up.data as any)?.destroy?.();
        r.download = `${up.status} ${up.headers["content-type"] ?? ""} ${up.headers["content-range"] ?? up.headers["content-length"] ?? ""}`.trim();
      } catch (e: any) {
        r.download_erro = `${e?.message ?? e}`;
      }
      out.push(r);
    }
    res.json({ workspace: report.workspaceName, videos_com_arquivo: report.pieces.filter((p) => p.videoId).length, testes: out });
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
