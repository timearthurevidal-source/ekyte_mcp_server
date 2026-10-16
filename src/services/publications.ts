/**
 * Publicações (peças) de um workspace — base do relatório de entregas.
 *
 * No Ekyte, cada peça entregue fica cadastrada como uma "publicação"
 * (ctc-task-form) dentro da tarefa: tem formato (Post Único, Carrossel, Reels…),
 * título, imagem de capa, data de veiculação e link do post publicado.
 * O briefing e o campo "quantidade" costumam estar vazios ou com o texto padrão
 * do modelo, então NÃO servem para contar peças.
 */

import { createHmac, createHash } from "node:crypto";
import { apiGet, companyUrl, companyV2Url, getCompanyId, getRawClient } from "./ekyte-client.js";

export type PieceKind = "carrossel" | "estatico" | "video" | "email" | "artigo";

export const KIND_LABEL: Record<PieceKind, string> = {
  carrossel: "Carrossel",
  estatico: "Estático",
  video: "Vídeo",
  email: "E-mail marketing",
  artigo: "Blog / LinkedIn",
};

export interface Piece {
  taskId: number;
  taskTitle: string;
  taskType: string;
  formId: number | null;
  format: string;          // nome do formato no Ekyte (ex.: "Post Carrossel: Feed")
  kind: PieceKind;
  title: string;
  date: string;            // AAAA-MM-DD usada para o mês
  month: string;           // AAAA-MM
  imageId: number | null;  // artefato de capa
  slides: number;          // imagens no formulário (carrossel)
  approved: boolean;
  published: boolean;
  postUrl: string | null;
}

export interface OtherDelivery {
  taskId: number;
  title: string;
  taskType: string;
  date: string;
  month: string;
}

export interface WorkspaceReport {
  workspaceId: number;
  workspaceName: string;
  generatedAt: string;
  pieces: Piece[];
  others: OtherDelivery[];   // entregas sem peça cadastrada (planejamento, ideias…)
  tasksScanned: number;
}

// ---------------------------------------------------------------- helpers

function day(s: unknown): string | null {
  return typeof s === "string" && s.length >= 10 ? s.slice(0, 10) : null;
}

function clean(s: unknown, max = 140): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

function parseValues(v: unknown): Record<string, any> {
  if (!v || typeof v !== "string") return {};
  try {
    const o = JSON.parse(v);
    return (o && typeof o.form === "object" && o.form) || {};
  } catch {
    return {};
  }
}

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi)$/i;

/** Classifica uma publicação do Ekyte. */
export function classifyForm(f: Record<string, any>, taskType: string): PieceKind {
  const name = `${f.form?.name ?? ""}`.toLowerCase();
  const channels: any[] = Array.isArray(f.ctcTaskFormChannel) ? f.ctcTaskFormChannel : [];
  const thumb = `${f.thumbnail?.name ?? ""}`;

  if (/e-?mail/.test(name)) return "email";
  if (/carross/.test(name) || f.form?.formType === 50) return "carrossel";
  if (/reels|v[ií]deo|video|tiktok|shorts|youtube/.test(name)) return "video";
  if (channels.some((c) => c?.isVideo === 1) || VIDEO_EXT.test(thumb)) return "video";
  if (/blog|artigo|linkedin/.test(name) && !f.thumbnailId) return "artigo";
  if (/e-?mail/i.test(taskType)) return "email";
  return "estatico";
}

/** Para tarefas sem publicação cadastrada: decide se vira peça ou "outra entrega". */
function classifyTaskWithoutForms(title: string, type: string): PieceKind | null {
  const t = `${title} ${type}`.toLowerCase();
  if (/e-?mail/.test(t)) return "email";
  if (/blog|linkedln|linkedin|artigo/.test(t)) return "artigo";
  if (/planejamento|estrat[eé]gia|ideia|ticket|an[aá]lise|ap\. ?(comercial|institucional)/.test(t)) return null;
  if (/editorial m[eê]s|roteiro/.test(t)) return null; // editorial sem peças cadastradas = roteiros
  if (/v[ií]deo|podcast|reels/.test(t)) return "video";
  if (/m[ií]dia off|arte|story|storie|post|comunicado|informativo|cart[aã]o|etiqueta|quadro|tag|chap[eé]u/.test(t)) return "estatico";
  return null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---------------------------------------------------------------- data

export async function fetchTaskForms(taskId: number): Promise<Record<string, any>[]> {
  const data = await apiGet<unknown>(companyV2Url(`ctc-tasks/${taskId}/forms`));
  return Array.isArray(data) ? (data as Record<string, any>[]) : [];
}

export function formToPiece(f: Record<string, any>, task: Record<string, any>): Piece {
  const taskType = `${task.ctcTaskType?.name ?? task.task_type ?? ""}`;
  const channels: any[] = Array.isArray(f.ctcTaskFormChannel) ? f.ctcTaskFormChannel : [];
  const pubDates = channels.map((c) => day(c?.publicationDateStart)).filter(Boolean) as string[];
  const postUrl = channels.find((c) => typeof c?.postUrl === "string" && c.postUrl)?.postUrl ?? null;
  const values = parseValues(f.values);
  const images = Array.isArray(values["2"]) ? values["2"] : [];
  const tags: any[] = Array.isArray(f.tags) ? f.tags : [];
  const date =
    pubDates.sort()[0] ??
    day(f.placementStartDate) ??
    day(task.resolvedDate) ??
    day(task.currentDueDate) ??
    "";
  return {
    taskId: task.id,
    taskTitle: clean(task.title, 120),
    taskType,
    formId: f.id ?? null,
    format: `${f.form?.name ?? ""}`,
    kind: classifyForm(f, taskType),
    title: clean(f.formName || f.description || task.title),
    date,
    month: date.slice(0, 7),
    imageId: typeof f.thumbnailId === "number" ? f.thumbnailId : null,
    slides: images.length,
    approved: tags.some((t) => /aprovad/i.test(`${t?.name ?? ""}`)),
    published: Boolean(postUrl) || channels.some((c) => c?.status === 3),
    postUrl,
  };
}

/** Monta o relatório de um workspace (tarefas concluídas). */
export async function buildWorkspaceReport(workspaceId: number): Promise<WorkspaceReport> {
  const tasks = await apiGet<Record<string, any>[]>(companyV2Url("ctc-tasks"), {
    limit: 2000,
    workspaceId,
    situation: 30,
  });
  const list = Array.isArray(tasks) ? tasks : [];

  const pieces: Piece[] = [];
  const others: OtherDelivery[] = [];
  let workspaceName = "";

  await mapLimit(list, 4, async (task) => {
    workspaceName ||= task.workspace?.name ?? "";
    let forms: Record<string, any>[] = [];
    try {
      forms = await fetchTaskForms(task.id);
    } catch (e) {
      console.error(`[report] forms ${task.id}:`, e instanceof Error ? e.message : e);
    }
    const type = `${task.ctcTaskType?.name ?? ""}`;
    const date = day(task.resolvedDate) ?? day(task.currentDueDate) ?? "";
    if (forms.length) {
      for (const f of forms) pieces.push(formToPiece(f, task));
      return;
    }
    const kind = classifyTaskWithoutForms(`${task.title ?? ""}`, type);
    if (kind) {
      pieces.push({
        taskId: task.id,
        taskTitle: clean(task.title, 120),
        taskType: type,
        formId: null,
        format: type,
        kind,
        title: clean(task.title),
        date,
        month: date.slice(0, 7),
        imageId: null,
        slides: 0,
        approved: false,
        published: false,
        postUrl: null,
      });
    } else {
      others.push({ taskId: task.id, title: clean(task.title, 120), taskType: type, date, month: date.slice(0, 7) });
    }
  });

  pieces.sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));
  others.sort((a, b) => b.date.localeCompare(a.date));

  return {
    workspaceId,
    workspaceName,
    generatedAt: new Date().toISOString(),
    pieces,
    others,
    tasksScanned: list.length,
  };
}

// ---------------------------------------------------------------- cache

const CACHE_MS = 6 * 60 * 60 * 1000;
const cache = new Map<number, { at: number; data: Promise<WorkspaceReport> }>();

export function getWorkspaceReport(workspaceId: number, refresh = false): Promise<WorkspaceReport> {
  const hit = cache.get(workspaceId);
  if (!refresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = buildWorkspaceReport(workspaceId);
  cache.set(workspaceId, { at: Date.now(), data });
  data.catch(() => cache.delete(workspaceId));
  return data;
}

// ---------------------------------------------------------------- links assinados

function secret(): string {
  return (
    process.env.REPORT_SECRET ||
    createHash("sha256").update(`report:${process.env.EKYTE_BEARER_TOKEN ?? ""}:${getCompanyId()}`).digest("hex")
  );
}

export function sign(kind: "r" | "i", id: number | string): string {
  return createHmac("sha256", secret()).update(`${kind}:${id}`).digest("hex").slice(0, 24);
}

export function verify(kind: "r" | "i", id: number | string, sig: unknown): boolean {
  return typeof sig === "string" && sig.length === 24 && sign(kind, id) === sig;
}

// ---------------------------------------------------------------- imagens

export async function downloadArtifact(artifactId: number): Promise<{ buf: Buffer; type: string }> {
  const res = await getRawClient().get<ArrayBuffer>(companyUrl(`artifacts/${artifactId}/download`), {
    responseType: "arraybuffer",
  });
  return {
    buf: Buffer.from(res.data),
    type: `${res.headers["content-type"] ?? "application/octet-stream"}`,
  };
}
