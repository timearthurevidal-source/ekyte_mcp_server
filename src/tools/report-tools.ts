/**
 * Report tools (read-only) — A&V
 *
 * - ekyte_raw_get: GET genérico na API interna do Ekyte (somente leitura),
 *   usado para descobrir endpoints (anexos, formulários) sem novo deploy.
 * - ekyte_task_summaries: resumo compacto de várias tarefas de uma vez
 *   (quantidade, objetivo do briefing, artefatos/anexos).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, companyV2Url, getCompanyId, handleApiError } from "../services/ekyte-client.js";
import { CHARACTER_LIMIT } from "../constants.js";

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\/(div|p|h\d|li|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Pega o texto da seção "Objetivo" do briefing padrão da A&V. */
function extractObjetivo(text: string): string {
  const m = text.match(/Objetivo\s*\n([\s\S]*?)(\n\s*(Fazer|Solicitação|Briefing|Drive)\b|$)/i);
  const out = (m ? m[1] : "").trim();
  return out.length > 400 ? out.slice(0, 400) + "…" : out;
}

/** Reduz um artefato/anexo a campos úteis, sem conhecer o formato exato. */
function compactArtifact(a: unknown): Record<string, unknown> {
  if (!a || typeof a !== "object") return { value: a };
  const o = a as Record<string, unknown>;
  const keep: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "object") continue; // evita objetos aninhados grandes
    if (typeof v === "string" && v.length > 500) {
      keep[k] = v.slice(0, 500) + "…";
    } else {
      keep[k] = v;
    }
  }
  return keep;
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

export function registerReportTools(server: McpServer): void {
  // -------- GET genérico (somente leitura) --------
  server.registerTool(
    "ekyte_raw_get",
    {
      title: "Consulta livre (somente leitura) na API do Ekyte",
      description: `Faz um GET na API interna do Ekyte e devolve o JSON bruto (truncado).

SOMENTE LEITURA: só aceita caminhos que começam com /api/. Nunca altera dados.
Use {company} no caminho para inserir o ID da empresa.
Ex: "/api/v2/companies/{company}/ctc-tasks/123" ou "/api/companies/{company}/workspaces".`,
      inputSchema: {
        path: z.string().min(5).describe("Caminho começando com /api/. Use {company} para o ID da empresa."),
        params: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
          .describe("Parâmetros de query (opcional)."),
        max_chars: z.number().int().min(500).max(CHARACTER_LIMIT).default(12000)
          .describe("Tamanho máximo da resposta em caracteres."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ path, params, max_chars }) => {
      try {
        if (!path.startsWith("/api/") || path.includes("..")) {
          return { content: [{ type: "text" as const, text: "Erro: o caminho precisa começar com /api/." }] };
        }
        const finalPath = path.replace(/\{company\}/g, getCompanyId());
        const data = await apiGet<unknown>(finalPath, params ?? {});
        let text = JSON.stringify(data, null, 1);
        if (text.length > max_chars) {
          text = text.slice(0, max_chars) + `\n…[truncado: ${text.length} caracteres no total]`;
        }
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    }
  );

  // -------- Resumo de várias tarefas --------
  server.registerTool(
    "ekyte_task_summaries",
    {
      title: "Resumo de várias tarefas (quantidade, briefing e anexos)",
      description: `Busca várias tarefas de uma vez e devolve um resumo compacto de cada uma:
id, título, tipo, data de conclusão, quantidade (campo do Ekyte), objetivo do briefing
(texto da seção "Objetivo") e a lista de artefatos/anexos da tarefa.

Use para relatórios: contar peças (carrosséis, estáticos, vídeos, e-mails) e listar anexos.
Máximo de 60 tarefas por chamada.`,
      inputSchema: {
        task_ids: z.array(z.number().int().positive()).min(1).max(60)
          .describe("IDs das tarefas (use ekyte_list_tasks para descobrir)."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ task_ids }) => {
      const results = await mapLimit(task_ids, 5, async (id) => {
        try {
          const t = await apiGet<Record<string, any>>(companyV2Url(`ctc-tasks/${id}`));
          const desc = stripHtml(t.description);
          const artifacts = Array.isArray(t.artifacts) ? t.artifacts : [];
          return {
            id: t.id,
            title: t.title,
            type: t.ctcTaskType?.name,
            status: t.situation,
            due: t.currentDueDate?.split("T")[0],
            resolved: t.resolvedDate?.split("T")[0] ?? null,
            quantity: t.quantity ?? null,
            objetivo: extractObjetivo(desc),
            artifacts_count: artifacts.length,
            artifacts: artifacts.slice(0, 20).map(compactArtifact),
          };
        } catch (error) {
          return { id, error: handleApiError(error) };
        }
      });
      let text = JSON.stringify(results);
      if (text.length > CHARACTER_LIMIT) {
        text = text.slice(0, CHARACTER_LIMIT) + "…[truncado — peça menos tarefas por vez]";
      }
      return { content: [{ type: "text" as const, text }] };
    }
  );
}
