/**
 * Página HTML do relatório de entregas — visual inspirado em bagueiraseguros.com.br
 * (logo oficial do site, Heebo, verde institucional, cards e ícones Material).
 * Para ajustar a cor da marca, mude só --verde e --verde-escuro abaixo.
 */

import { KIND_LABEL, Piece, PieceKind, WorkspaceReport, sign } from "../services/publications.js";

const LOGO_PRETO = "https://bagueiraseguros.com.br/05bagueira_horizontal_preto.webp?v=20260622-8";
const LOGO_BRANCO = "https://bagueiraseguros.com.br/03bagueira_horizontal_branco.webp?v=20260622-8";

const KINDS: PieceKind[] = ["carrossel", "estatico", "video", "email", "artigo"];
const ICON: Record<PieceKind, string> = {
  carrossel: "view_carousel",
  estatico: "image",
  video: "smart_display",
  email: "mail",
  artigo: "article",
};
const PLURAL: Record<PieceKind, string> = {
  carrossel: "Carrosséis",
  estatico: "Estáticos",
  video: "Vídeos",
  email: "E-mails marketing",
  artigo: "Blog / LinkedIn",
};
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mesCurto(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m ? `${MESES[m - 1]}/${String(y).slice(2)}` : "sem data";
}
function mesLongo(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m ? `${MESES_LONGOS[m - 1]} de ${y}` : "Sem data";
}
function dataBr(d: string): string {
  const [y, m, dd] = d.split("-");
  return dd ? `${dd}/${m}/${y}` : "";
}

function count(pieces: Piece[]): Record<PieceKind, number> {
  const c = { carrossel: 0, estatico: 0, video: 0, email: 0, artigo: 0 } as Record<PieceKind, number>;
  for (const p of pieces) c[p.kind]++;
  return c;
}

function chart(months: string[], byMonth: Map<string, Piece[]>): string {
  const series: PieceKind[] = ["carrossel", "estatico", "video", "email"];
  const totals = months.map((m) => series.reduce((s, k) => s + count(byMonth.get(m) ?? [])[k], 0));
  const max = Math.max(4, ...totals);
  const step = max <= 10 ? 2 : max <= 25 ? 5 : 10;
  const top = Math.ceil(max / step) * step;
  const W = Math.max(560, months.length * 56 + 60);
  const H = 240, L = 36, B = 30, T = 14;
  const plotH = H - B - T;
  const bw = Math.min(30, ((W - L - 10) / months.length) * 0.6);
  const x = (i: number) => L + ((W - L - 10) / months.length) * (i + 0.5);
  const y = (v: number) => T + plotH - (v / top) * plotH;

  let grid = "";
  for (let v = 0; v <= top; v += step) {
    grid += `<line x1="${L}" x2="${W - 6}" y1="${y(v)}" y2="${y(v)}" class="g"/>` +
      `<text x="${L - 8}" y="${y(v) + 4}" class="ax" text-anchor="end">${v}</text>`;
  }
  let bars = "";
  months.forEach((m, i) => {
    const c = count(byMonth.get(m) ?? []);
    let acc = 0;
    for (const k of series) {
      if (!c[k]) continue;
      const y0 = y(acc), y1 = y(acc + c[k]);
      bars += `<rect x="${x(i) - bw / 2}" y="${y1}" width="${bw}" height="${Math.max(0, y0 - y1 - 1.5)}" class="s-${k}"><title>${esc(mesCurto(m))} · ${KIND_LABEL[k]}: ${c[k]}</title></rect>`;
      acc += c[k];
    }
    if (totals[i]) bars += `<text x="${x(i)}" y="${y(totals[i]) - 6}" text-anchor="middle" class="tot">${totals[i]}</text>`;
    bars += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="ax">${esc(mesCurto(m))}</text>`;
  });
  return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Peças por mês">${grid}${bars}</svg></div>`;
}

function card(p: Piece): string {
  const img = p.imageId
    ? `<img loading="lazy" src="/relatorio/img/${p.imageId}?s=${sign("i", p.imageId)}" alt="${esc(p.title)}">`
    : `<div class="ph"><span class="material-symbols-outlined">${ICON[p.kind]}</span></div>`;
  const meta = [dataBr(p.date), p.kind === "carrossel" && p.slides > 1 ? `${p.slides} lâminas` : ""].filter(Boolean).join(" · ");
  const link = p.postUrl
    ? `<a class="post" href="${esc(p.postUrl)}" target="_blank" rel="noopener">Ver publicação <span class="material-symbols-outlined">arrow_forward</span></a>`
    : "";
  return `<article class="piece" data-kind="${p.kind}">
  <div class="thumb">${img}<span class="badge b-${p.kind}"><span class="material-symbols-outlined">${ICON[p.kind]}</span>${KIND_LABEL[p.kind]}</span></div>
  <div class="pbody"><h4>${esc(p.title)}</h4><p class="meta">${esc(meta)}</p>${link}</div>
</article>`;
}

export function renderReportPage(r: WorkspaceReport, opts: { refreshHref: string }): string {
  const pieces = r.pieces.filter((p) => p.month);
  const byMonth = new Map<string, Piece[]>();
  for (const p of pieces) {
    if (!byMonth.has(p.month)) byMonth.set(p.month, []);
    byMonth.get(p.month)!.push(p);
  }
  const monthsAsc = [...byMonth.keys()].sort();
  const monthsDesc = [...monthsAsc].reverse();
  const tot = count(pieces);
  const periodo = monthsAsc.length
    ? `${mesLongo(monthsAsc[0]).toLowerCase()} a ${mesLongo(monthsAsc[monthsAsc.length - 1]).toLowerCase()}`
    : "";
  const gerado = new Date(r.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short" });
  const publicadas = pieces.filter((p) => p.published).length;

  const kpis = (["carrossel", "estatico", "video", "email"] as PieceKind[])
    .map((k) => `<div class="kpi"><span class="material-symbols-outlined ic-${k}">${ICON[k]}</span><strong>${tot[k]}</strong><span>${PLURAL[k]}</span></div>`)
    .join("");

  const tableRows = monthsDesc
    .map((m) => {
      const c = count(byMonth.get(m)!);
      const total = c.carrossel + c.estatico + c.video + c.email + c.artigo;
      return `<tr><th scope="row"><a href="#m-${m}">${esc(mesLongo(m))}</a></th>${KINDS.map((k) => `<td>${c[k] || "–"}</td>`).join("")}<td class="t">${total}</td></tr>`;
    })
    .join("");

  const sections = monthsDesc
    .map((m) => {
      const ps = byMonth.get(m)!;
      const c = count(ps);
      const chips = KINDS.filter((k) => c[k]).map((k) => `<span class="chip">${c[k]} ${esc(KIND_LABEL[k].toLowerCase())}</span>`).join("");
      return `<section class="month" id="m-${m}" data-month="${m}">
  <header><h3>${esc(mesLongo(m))}</h3><div class="chips">${chips}</div></header>
  <div class="grid">${ps.map(card).join("")}</div>
</section>`;
    })
    .join("");

  const others = r.others.length
    ? `<section class="others"><h3>Planejamento e estratégia</h3><p class="lead">Entregas que não geram peça publicada, mas fazem parte do trabalho.</p><ul>${r.others
        .map((o) => `<li><span>${esc(o.title)}</span><time>${esc(dataBr(o.date))}</time></li>`)
        .join("")}</ul></section>`
    : "";

  const filterBtns = [`<button type="button" class="f on" data-k="all">Todas</button>`]
    .concat(KINDS.filter((k) => tot[k]).map((k) => `<button type="button" class="f" data-k="${k}">${esc(KIND_LABEL[k])}</button>`))
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Relatório de entregas · ${esc(r.workspaceName || "Bagueira")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=swap">
<style>
/* Layout: cabeçalho do site · resumo do período · gráfico mensal · tabela · galeria por mês · rodapé verde */
:root{
  --verde:#0f6b45; --verde-escuro:#0a3d29; --verde-claro:#e7f2ec;
  --tinta:#16201b; --cinza:#5d6a63; --linha:#dfe6e2; --fundo:#f6f8f7; --branco:#ffffff;
  --s-carrossel:#0f6b45; --s-estatico:#5aa37f; --s-video:#c9a227; --s-email:#2f5d8a; --s-artigo:#8a6f9e;
  --font:"Heebo",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  color-scheme:light;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:var(--font);color:var(--tinta);background:var(--branco);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:var(--verde)}
.material-symbols-outlined{font-family:"Material Symbols Outlined";font-weight:normal;font-style:normal;font-size:20px;line-height:1;display:inline-block;letter-spacing:normal;text-transform:none;white-space:nowrap;direction:ltr;-webkit-font-feature-settings:"liga";font-feature-settings:"liga"}
.wrap{max-width:1180px;margin:0 auto;padding-left:max(20px,env(safe-area-inset-left,0px));padding-right:max(20px,env(safe-area-inset-right,0px))}
.top{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--linha)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-block:14px}
.top img{height:38px;width:auto}
.top .tag{font-size:13px;color:var(--cinza);text-align:right}
.top .tag b{color:var(--tinta);font-weight:600}
.hero{background:linear-gradient(180deg,var(--verde-claro),var(--branco));padding-block:56px 40px}
.eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--verde)}
h1{font-size:clamp(30px,4.4vw,48px);line-height:1.1;font-weight:800;letter-spacing:-.02em;margin:12px 0 12px;max-width:18ch;text-wrap:balance}
.hero p.lead{color:var(--cinza);font-size:18px;max-width:60ch;margin:0}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:32px}
.kpi{background:var(--branco);border:1px solid var(--linha);border-radius:16px;padding:20px;display:grid;gap:2px}
.kpi strong{font-size:40px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}
.kpi > span:last-child{color:var(--cinza);font-size:14px}
.kpi .material-symbols-outlined{font-size:26px;margin-bottom:6px}
.ic-carrossel{color:var(--s-carrossel)}.ic-estatico{color:var(--s-estatico)}.ic-video{color:var(--s-video)}.ic-email{color:var(--s-email)}
.trust{display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:20px;color:var(--cinza);font-size:14px}
.trust span{display:inline-flex;align-items:center;gap:6px}
.trust .material-symbols-outlined{color:var(--verde);font-size:18px}
section.block{padding-block:48px 8px}
h2{font-size:28px;font-weight:800;letter-spacing:-.01em;margin:0 0 6px}
h2 + p{color:var(--cinza);margin:0 0 22px}
.panel{border:1px solid var(--linha);border-radius:16px;padding:20px;background:var(--branco)}
.legend{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:13px;color:var(--cinza);margin-bottom:10px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.chart-wrap{overflow-x:auto}
svg .g{stroke:var(--linha);stroke-width:1}
svg .ax{fill:var(--cinza);font-size:11px;font-family:var(--font)}
svg .tot{fill:var(--tinta);font-size:12px;font-weight:700;font-family:var(--font)}
.s-carrossel{fill:var(--s-carrossel)}.s-estatico{fill:var(--s-estatico)}.s-video{fill:var(--s-video)}.s-email{fill:var(--s-email)}
.table-wrap{overflow-x:auto;margin-top:20px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:15px}
th,td{padding:10px 12px;border-bottom:1px solid var(--linha);text-align:right;white-space:nowrap}
th[scope=row],thead th:first-child{text-align:left}
thead th{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--cinza);font-weight:600}
th[scope=row] a{color:var(--tinta);text-decoration:none;font-weight:600}
th[scope=row] a:hover{color:var(--verde)}
td.t{font-weight:700}
.filters{position:sticky;top:67px;z-index:4;background:var(--branco);padding-block:12px;display:flex;flex-wrap:wrap;gap:8px;border-bottom:1px solid var(--linha)}
.f{font:inherit;font-size:14px;border:1px solid var(--linha);background:var(--branco);color:var(--tinta);padding:8px 16px;border-radius:999px;cursor:pointer}
.f:hover{border-color:var(--verde)}
.f.on{background:var(--verde);border-color:var(--verde);color:#fff}
.f:focus-visible,a:focus-visible{outline:3px solid var(--s-estatico);outline-offset:2px}
.month{padding-block:28px 8px;border-bottom:1px solid var(--linha)}
.month header{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 16px;margin-bottom:18px}
.month h3{font-size:22px;font-weight:700;margin:0}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:13px;background:var(--verde-claro);color:var(--verde-escuro);padding:3px 10px;border-radius:999px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px}
.piece{border:1px solid var(--linha);border-radius:14px;overflow:hidden;background:var(--branco);display:flex;flex-direction:column;min-width:0}
.thumb{position:relative;aspect-ratio:4/5;background:var(--fundo)}
.thumb img{width:100%;height:100%;object-fit:cover}
.ph{width:100%;height:100%;display:grid;place-items:center;color:var(--verde);background:var(--verde-claro)}
.ph .material-symbols-outlined{font-size:44px;opacity:.7}
.badge{position:absolute;left:10px;top:10px;display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;padding:4px 9px 4px 7px;border-radius:999px;background:rgba(255,255,255,.94);color:var(--tinta)}
.badge .material-symbols-outlined{font-size:16px}
.b-carrossel .material-symbols-outlined{color:var(--s-carrossel)}.b-estatico .material-symbols-outlined{color:var(--s-estatico)}.b-video .material-symbols-outlined{color:var(--s-video)}.b-email .material-symbols-outlined{color:var(--s-email)}.b-artigo .material-symbols-outlined{color:var(--s-artigo)}
.pbody{padding:12px 14px 14px;display:flex;flex-direction:column;gap:4px;flex:1}
.pbody h4{margin:0;font-size:14px;font-weight:600;line-height:1.35;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.meta{margin:0;font-size:12.5px;color:var(--cinza)}
.post{margin-top:auto;padding-top:6px;font-size:13px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:2px}
.post .material-symbols-outlined{font-size:16px}
.others{padding-block:40px 8px}
.others h3{font-size:22px;margin:0 0 4px}
.others .lead{color:var(--cinza);margin:0 0 14px}
.others ul{list-style:none;margin:0;padding:0;columns:2 320px;column-gap:32px}
.others li{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--linha);break-inside:avoid;font-size:15px}
.others time{color:var(--cinza);font-size:13px;white-space:nowrap;font-variant-numeric:tabular-nums}
footer{margin-top:56px;background:var(--verde-escuro);color:#d8e6de}
footer .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:20px;padding-block:36px}
footer img{height:34px;width:auto}
footer p{margin:6px 0 0;font-size:14px;max-width:52ch}
footer .upd{text-align:right;font-size:13px}
footer a{color:#fff}
[hidden]{display:none!important}
@media (max-width:760px){
  .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .top .tag span{display:none}
  .filters{top:62px}
  footer .upd{text-align:left}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style>
</head>
<body>
<div class="top"><div class="wrap">
  <img src="${LOGO_PRETO}" alt="Bagueira Seguros">
  <div class="tag"><b>Relatório de entregas</b><span> · preparado por Arthur &amp; Vidal</span></div>
</div></div>

<header class="hero"><div class="wrap">
  <span class="eyebrow"><span class="material-symbols-outlined">verified_user</span>Marketing Bagueira</span>
  <h1>Tudo o que criamos para a Bagueira</h1>
  <p class="lead">${pieces.length} peças entregues de ${esc(periodo)}, contadas a partir das publicações cadastradas no eKyte${publicadas ? `, ${publicadas} delas já publicadas nas redes` : ""}.</p>
  <div class="kpis">${kpis}</div>
  <div class="trust">
    ${tot.artigo ? `<span><span class="material-symbols-outlined">article</span>${tot.artigo} conteúdos de blog e LinkedIn</span>` : ""}
    ${r.others.length ? `<span><span class="material-symbols-outlined">history</span>${r.others.length} entregas de planejamento e estratégia</span>` : ""}
    <span><span class="material-symbols-outlined">calendar_month</span>${monthsAsc.length} meses de trabalho</span>
  </div>
</div></header>

<main class="wrap">
  <section class="block">
    <h2>Peças por mês</h2>
    <p>Carrosséis, estáticos, vídeos e e-mails marketing de cada mês.</p>
    <div class="panel">
      <div class="legend"><span><i style="background:var(--s-carrossel)"></i>Carrossel</span><span><i style="background:var(--s-estatico)"></i>Estático</span><span><i style="background:var(--s-video)"></i>Vídeo</span><span><i style="background:var(--s-email)"></i>E-mail marketing</span></div>
      ${chart(monthsAsc, byMonth)}
      <div class="table-wrap"><table>
        <thead><tr><th>Mês</th>${KINDS.map((k) => `<th>${esc(KIND_LABEL[k])}</th>`).join("")}<th>Total</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table></div>
    </div>
  </section>

  <section class="block" id="galeria">
    <h2>Galeria de peças</h2>
    <p>Do mês mais recente para o mais antigo. Filtre por formato.</p>
    <div class="filters" role="group" aria-label="Filtrar por formato">${filterBtns}</div>
    ${sections}
  </section>
  ${others}
</main>

<footer><div class="wrap">
  <div><img src="${LOGO_BRANCO}" alt="Bagueira Seguros"><p>Proteção e estratégia para o seu patrimônio financeiro.</p></div>
  <div class="upd">Dados do eKyte, atualizados automaticamente.<br>Última leitura: ${esc(gerado)} · <a href="${esc(opts.refreshHref)}">atualizar agora</a></div>
</div></footer>

<script>
(function(){
  var btns=document.querySelectorAll(".f");
  btns.forEach(function(b){b.addEventListener("click",function(){
    btns.forEach(function(x){x.classList.toggle("on",x===b)});
    var k=b.getAttribute("data-k");
    document.querySelectorAll(".piece").forEach(function(p){p.hidden=!(k==="all"||p.getAttribute("data-kind")===k)});
    document.querySelectorAll(".month").forEach(function(m){m.hidden=!m.querySelector(".piece:not([hidden])")});
  })});
})();
</script>
</body>
</html>`;
}
