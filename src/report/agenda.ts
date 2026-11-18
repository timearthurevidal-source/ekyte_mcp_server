/**
 * Agenda de publicações — só o que está agendado, com data e hora, para mandar ao cliente.
 *
 *   GET /agenda/:workspaceId?s=<mesma assinatura do relatório>
 *
 * Usa os mesmos dados do relatório (publicações das tarefas no eKyte), mas olha
 * a data/hora de cada canal (ctcTaskFormChannel.publicationDateStart) e mostra
 * só o que ainda não foi publicado, de hoje em diante. Marca e cores vêm de brands.ts.
 */

import { KIND_LABEL, Piece, WorkspaceReport, sign } from "../services/publications.js";
import { Brand, brandFor } from "./brands.js";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(v: unknown): string {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .split(String.fromCharCode(0x2028)).join("\\u2028")
    .split(String.fromCharCode(0x2029)).join("\\u2029");
}

function logo(url: string | undefined, b: Brand, cls: string): string {
  return url ? `<img src="${esc(url)}" alt="${esc(b.nomeCompleto)}">` : `<span class="${cls}">${esc(b.nomeCompleto)}</span>`;
}

/** Contraste WCAG entre duas cores #rrggbb (1 a 21). */
function contraste(a: string, b: string): number {
  const lum = (h: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
    if (!m) return 0;
    const n = parseInt(m[1], 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Hoje no horário de Brasília (AAAA-MM-DD). */
function hojeBR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export interface AgendaItem {
  d: string;      // AAAA-MM-DD
  h: string;      // HH:MM ou ""
  t: string;      // título da peça
  k: string;      // tipo (carrossel, estatico…)
  f: string;      // nome do formato no eKyte
  n: string[];    // redes
  i: string;      // capa (miniatura assinada)
  m: Midia[];     // todas as imagens/vídeos da publicação, para o visualizador
  ta: string;     // tarefa
}

/** Um arquivo no visualizador: imagem (i miniatura, g grande) ou vídeo (v arquivo, i quadro de capa). */
export interface Midia {
  i: string;
  g?: string;
  v?: string;
}

function midiasDaPeca(p: Piece): Midia[] {
  const files = p.media && p.media.length
    ? p.media
    : [
        ...(p.videoId ? [{ id: p.videoId, video: true }] : []),
        ...(p.imageId ? [{ id: p.imageId, video: false }] : []),
      ];
  return files.map((f) => {
    if (f.video) {
      const s = sign("v", f.id);
      return { i: `/relatorio/vthumb/${f.id}?s=${s}`, v: `/relatorio/video/${f.id}?s=${s}` };
    }
    const s = sign("i", f.id);
    return { i: `/relatorio/img/${f.id}?s=${s}`, g: `/relatorio/img/${f.id}?s=${s}&g=1` };
  });
}

/** Itens agendados (não publicados) de hoje em diante; mesma peça no mesmo horário vira um item só. */
export function agendaItems(pieces: Piece[], hoje = hojeBR()): AgendaItem[] {
  const out = new Map<string, AgendaItem>();
  for (const p of pieces) {
    const m = midiasDaPeca(p);
    // Capa: a imagem da capa do eKyte, senão o primeiro arquivo da publicação.
    const thumb = p.imageId
      ? `/relatorio/img/${p.imageId}?s=${sign("i", p.imageId)}`
      : m[0]?.i ?? "";
    const base = { t: p.title, k: p.kind, f: p.format, i: thumb, m, ta: p.taskTitle };
    const slots = (p.slots ?? []).filter((s) => !s.published && s.date >= hoje);
    if ((p.slots ?? []).length === 0) {
      // Sem canal cadastrado: entra só se a peça tem data futura e não foi publicada.
      if (!p.published && p.date && p.date >= hoje && p.status === "agendada") {
        out.set(`${p.taskId}|${p.formId}|${p.date}|`, { ...base, d: p.date, h: "", n: [...p.networks] });
      }
      continue;
    }
    for (const s of slots) {
      const key = `${p.taskId}|${p.formId}|${s.date}|${s.time}`;
      const hit = out.get(key);
      if (hit) {
        if (s.network && !hit.n.includes(s.network)) hit.n.push(s.network);
      } else {
        out.set(key, { ...base, d: s.date, h: s.time, n: s.network ? [s.network] : [...p.networks] });
      }
    }
  }
  return [...out.values()].sort((a, b) => a.d.localeCompare(b.d) || (a.h || "99").localeCompare(b.h || "99") || a.t.localeCompare(b.t));
}

export function renderAgendaPage(r: WorkspaceReport, opts: { refreshHref: string }): string {
  const b = brandFor(r.workspaceId, r.workspaceName);
  const c = b.cores;
  const fontStack = `"${b.fonte}",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`;
  const hoje = hojeBR();
  const itens = agendaItems(r.pieces, hoje);
  const data = {
    hoje,
    kinds: KIND_LABEL,
    itens,
  };
  const gerado = new Date(r.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short" });
  const nome = b.nomeCompleto || r.workspaceName;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Agenda de Publicações · ${esc(nome)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${b.fonteUrl ? `<link rel="stylesheet" href="${b.fonteUrl}">` : ""}
<style>
:root{
  --marca:${c.marca}; --marca-escura:${c.marcaEscura}; --marca-clara:${c.marcaClara}; --marca-linha:${c.marcaLinha};
  --destaque:${c.agendada};
  --tinta:${c.tinta}; --cinza:${c.cinza}; --linha:${c.linha}; --fundo:${c.fundo}; --branco:#ffffff;
  --c-carrossel:${c.carrossel}; --c-estatico:${c.estatico}; --c-video:${c.video}; --c-email:${c.email}; --c-artigo:${c.artigo};
  --font:${fontStack};
  color-scheme:light;
}
*{box-sizing:border-box}
body{margin:0;font-family:var(--font);color:var(--tinta);background:var(--fundo);font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:var(--marca)}
button{font:inherit;color:inherit}
.wrap{max-width:980px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
[hidden]{display:none!important}
:focus-visible{outline:3px solid var(--destaque);outline-offset:2px}

.top{background:var(--branco);border-bottom:1px solid var(--linha)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-block:14px}
.top img{height:${b.logoAltura?.topo ?? 36}px;width:auto}
.top .meta{font-size:13px;color:var(--cinza);text-align:right;line-height:1.35}
.top .meta b{display:block;color:var(--tinta);font-weight:600;font-size:14px}
.top .meta a{font-weight:600;text-decoration:none}
.marca-txt{font-weight:800;font-size:20px;letter-spacing:-.01em;color:var(--tinta)}

.intro{background:linear-gradient(180deg,var(--marca-clara),var(--fundo));padding-block:34px 20px}
.eyebrow{font-size:12.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--cinza)}
h1{font-size:clamp(28px,4.4vw,42px);line-height:1.1;font-weight:800;letter-spacing:-.02em;margin:10px 0 8px;text-wrap:balance}
#resumo{color:var(--cinza);font-size:17px;max-width:62ch;margin:0}
#resumo b{color:var(--tinta)}

.proxima{margin-top:20px;background:var(--marca);color:#fff;border-radius:18px;padding:18px 20px;display:flex;gap:18px;align-items:center}
.proxima .quando{min-width:0}
.proxima .rot{font-size:12px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:${contraste(c.agendada, c.marca) >= 3 ? c.agendada : "rgba(255,255,255,.75)"}}
.proxima .data{font-size:22px;font-weight:700;line-height:1.2;margin-top:2px}
.proxima .tit{font-size:14.5px;opacity:.85;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.proxima img{width:64px;height:64px;object-fit:cover;border-radius:12px;flex:none;background:rgba(255,255,255,.08)}

.filtros{position:sticky;top:0;z-index:10;background:${c.filtrosFundo};backdrop-filter:blur(8px);border-bottom:1px solid var(--linha)}
.filtros .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding-block:12px}
.grupo{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.grupo > .rot{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--cinza);margin-right:2px}
.chip{border:1px solid var(--linha);background:var(--branco);padding:6px 12px;border-radius:999px;font-size:13.5px;cursor:pointer}
.chip:hover{border-color:var(--marca)}
.chip[aria-pressed=true]{background:var(--marca);border-color:var(--marca);color:#fff}

main{padding-block:8px 40px}
.dia{margin-top:26px}
.dia-cab{display:flex;align-items:baseline;gap:10px;padding-bottom:8px;border-bottom:1px solid var(--linha);margin-bottom:10px}
.dia-cab h2{font-size:18px;font-weight:700;margin:0}
.dia-cab .tag{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;background:var(--destaque);color:#fff;border-radius:999px;padding:2px 9px}
.dia-cab .qtd{margin-left:auto;font-size:13px;color:var(--cinza)}
.item{display:grid;grid-template-columns:72px 96px minmax(0,1fr);gap:16px;align-items:center;background:var(--branco);border:1px solid var(--linha);border-radius:14px;padding:12px 14px;margin-bottom:8px}
.item.abre{cursor:pointer;transition:border-color .15s,box-shadow .15s}
.item.abre:hover{border-color:var(--marca);box-shadow:0 4px 18px rgba(0,0,0,.06)}
.capa{position:relative;width:96px;height:120px;border-radius:10px;overflow:hidden;background:var(--marca-clara)}
.capa img{width:100%;height:100%;object-fit:cover}
.capa .selo{position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,.62);color:#fff;font-size:11.5px;font-weight:600;border-radius:999px;padding:2px 8px;display:inline-flex;align-items:center;gap:4px}
.capa .play{position:absolute;inset:0;display:grid;place-items:center}
.capa .play span{width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.55);display:grid;place-items:center}
.capa .play span::before{content:"";border-left:12px solid #fff;border-top:8px solid transparent;border-bottom:8px solid transparent;margin-left:3px}
.ver{font-size:12.5px;font-weight:600;color:var(--marca);margin-top:6px;display:inline-block}

#visor{position:fixed;inset:0;z-index:50;background:rgba(10,11,12,.97);display:flex;flex-direction:column}
#visor .barra{display:flex;align-items:center;gap:12px;padding:12px 16px;color:#fff}
#visor .barra .tit{flex:1;min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#visor .barra .sub{font-size:13px;opacity:.7;font-weight:400}
#visor button{background:rgba(255,255,255,.12);border:0;color:#fff;border-radius:999px;cursor:pointer;display:grid;place-items:center}
#visor button:hover{background:rgba(255,255,255,.22)}
#v-fechar{width:40px;height:40px;font-size:22px;line-height:1}
#visor .palco{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:12px;padding:0 12px 12px}
#visor .midia{flex:1;min-width:0;height:100%;display:flex;align-items:center;justify-content:center}
#visor .midia img,#visor .midia video{max-width:100%;max-height:100%;border-radius:8px;object-fit:contain;background:#000}
.seta{width:44px;height:44px;font-size:22px;flex:none}
#visor .pontos{display:flex;justify-content:center;gap:6px;padding:0 0 16px}
#visor .pontos i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.3)}
#visor .pontos i.on{background:#fff}
.hora{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.hora.sem{font-size:12.5px;font-weight:600;color:var(--cinza);line-height:1.25}
.thumb{width:56px;height:56px;border-radius:10px;object-fit:cover;background:var(--marca-clara)}
.thumb.vazia{position:relative;overflow:hidden}
.thumb.vazia::after{content:"";position:absolute;inset:0;background:var(--tc);opacity:.22}
.info{min-width:0}
.info .tit{font-weight:600;font-size:15px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.info .det{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center}
.tipo{font-size:12px;font-weight:600;border-radius:6px;padding:2px 8px;color:#fff}
.rede{font-size:12px;border:1px solid var(--linha);border-radius:6px;padding:1px 8px;color:var(--cinza)}
.vazio{background:var(--branco);border:1px dashed var(--linha);border-radius:16px;padding:40px 20px;text-align:center;color:var(--cinza);margin-top:26px}
.vazio b{display:block;color:var(--tinta);font-size:17px;margin-bottom:4px}

footer{background:var(--marca-escura);color:${c.rodapeTexto};margin-top:24px}
footer .wrap{display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;align-items:center;padding-block:28px}
footer img{height:${b.logoAltura?.rodape ?? 32}px;width:auto;margin-bottom:8px}
footer .marca-txt{color:#fff}
footer p{margin:0;font-size:13.5px}
footer .dir{font-size:13px;text-align:right}

@media (max-width:640px){
  .top .meta{font-size:12px}
  .item{grid-template-columns:52px 76px minmax(0,1fr);gap:10px;padding:10px}
  .capa{width:76px;height:95px}
  .seta{position:absolute;top:50%;transform:translateY(-50%);z-index:2;background:rgba(0,0,0,.45)!important}
  #v-ant{left:8px} #v-prox{right:8px}
  #visor .palco{position:relative;padding:0 0 12px}
  .hora{font-size:17px}
  .filtros{position:static}
  .dia-cab{flex-wrap:wrap}
  .dia-cab .qtd{display:none}
  .dia-cab h2{font-size:16.5px}
  .proxima img{display:none}
  footer .dir{text-align:left}
}
@media print{
  .filtros,.top .meta a{display:none}
  .item{break-inside:avoid}
}
</style>
</head>
<body>
<header class="top"><div class="wrap">
  ${logo(b.logoClara, b, "marca-txt")}
  <div class="meta"><b>Agenda de publicações</b>Dados do eKyte · ${esc(gerado)} · <a href="${esc(opts.refreshHref)}">atualizar agora</a></div>
</div></header>

<section class="intro"><div class="wrap">
  <div class="eyebrow">Arthur &amp; Vidal para ${esc(nome)}</div>
  <h1>O que vai ao ar nos próximos dias</h1>
  <p id="resumo"></p>
  <div class="proxima" id="proxima" hidden></div>
</div></section>

<nav class="filtros" aria-label="Filtros"><div class="wrap">
  <div class="grupo" id="f-periodo"><span class="rot">Período</span></div>
  <div class="grupo" id="f-rede"><span class="rot">Rede</span></div>
</div></nav>

<main class="wrap" id="lista" aria-live="polite"></main>

<div id="visor" hidden role="dialog" aria-modal="true" aria-labelledby="v-tit">
  <div class="barra"><div class="tit" id="v-tit"></div><button type="button" id="v-fechar" aria-label="Fechar">×</button></div>
  <div class="palco">
    <button type="button" class="seta" id="v-ant" aria-label="Anterior">‹</button>
    <div class="midia" id="v-midia"></div>
    <button type="button" class="seta" id="v-prox" aria-label="Próxima">›</button>
  </div>
  <div class="pontos" id="v-pontos"></div>
</div>

<footer><div class="wrap">
  <div>${logo(b.logoEscura, b, "marca-txt")}<p>${esc(b.assinatura)}</p></div>
  <div class="dir">Agenda lida do eKyte e atualizada automaticamente.<br>Horários de Brasília.</div>
</div></footer>

<script>
var D=${jsonForScript(data)};
var COR={carrossel:"var(--c-carrossel)",estatico:"var(--c-estatico)",video:"var(--c-video)",email:"var(--c-email)",artigo:"var(--c-artigo)"};
var estado={dias:0,rede:""};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function dt(iso){var p=iso.split("-");return new Date(+p[0],+p[1]-1,+p[2])}
function somaDias(iso,n){var d=dt(iso);d.setDate(d.getDate()+n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
var AMANHA=somaDias(D.hoje,1);
function nomeDia(iso){var s=dt(iso).toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});return s.charAt(0).toUpperCase()+s.slice(1)}
function curto(iso){return dt(iso).toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit"}).replace(".","")}
function relativo(iso){return iso===D.hoje?"Hoje":iso===AMANHA?"Amanhã":""}
function plural(n,s,p){return n+" "+(n===1?s:p)}

var redes=[];D.itens.forEach(function(it){it.n.forEach(function(r){if(redes.indexOf(r)<0)redes.push(r)})});redes.sort();
function chip(cont,rot,ativo,fn){var b=document.createElement("button");b.className="chip";b.type="button";b.textContent=rot;b.setAttribute("aria-pressed",ativo?"true":"false");b.onclick=fn;cont.appendChild(b);return b}
function montaFiltros(){
  var fp=document.getElementById("f-periodo"),fr=document.getElementById("f-rede");
  [].slice.call(fp.querySelectorAll(".chip")).concat([].slice.call(fr.querySelectorAll(".chip"))).forEach(function(x){x.remove()});
  [[7,"7 dias"],[30,"30 dias"],[0,"Tudo"]].forEach(function(p){chip(fp,p[1],estado.dias===p[0],function(){estado.dias=p[0];montaFiltros();render()})});
  if(redes.length<2){fr.hidden=true;return}
  chip(fr,"Todas",estado.rede==="",function(){estado.rede="";montaFiltros();render()});
  redes.forEach(function(r){chip(fr,r,estado.rede===r,function(){estado.rede=r;montaFiltros();render()})});
}
function filtrados(){
  var lim=estado.dias?somaDias(D.hoje,estado.dias-1):"9999";
  return D.itens.filter(function(it){return it.d<=lim&&(!estado.rede||it.n.indexOf(estado.rede)>=0)});
}
function render(){
  var its=filtrados(),el=document.getElementById("lista");
  var resumo=document.getElementById("resumo");
  if(!D.itens.length){
    resumo.innerHTML="Nenhuma publicação agendada no momento.";
    el.innerHTML='<div class="vazio"><b>Agenda em aberto</b>Assim que novas publicações forem agendadas no eKyte, elas aparecem aqui com data e horário.</div>';
    return;
  }
  var dias={};its.forEach(function(it){(dias[it.d]=dias[it.d]||[]).push(it)});
  var chaves=Object.keys(dias).sort();
  resumo.innerHTML=its.length?"<b>"+plural(its.length,"publicação agendada","publicações agendadas")+"</b> em "+plural(chaves.length,"dia","dias")+", de "+esc(curto(chaves[0]))+" a "+esc(curto(chaves[chaves.length-1]))+".":"Nenhuma publicação nesse filtro.";
  var h="";
  if(!its.length)h='<div class="vazio"><b>Nada neste período</b>Troque o período ou a rede para ver as outras publicações.</div>';
  chaves.forEach(function(d){
    var rel=relativo(d);
    h+='<section class="dia"><div class="dia-cab"><h2>'+esc(nomeDia(d))+'</h2>'+(rel?'<span class="tag">'+rel+'</span>':"")+'<span class="qtd">'+plural(dias[d].length,"publicação","publicações")+'</span></div>';
    dias[d].forEach(function(it){
      var tipo=D.kinds[it.k]||it.f;
      var idx=D.itens.indexOf(it),tem=it.m.length>0,ehVideo=tem&&it.m[0].v;
      var selo=it.m.length>1?'<span class="selo">'+it.m.length+(it.k==="carrossel"?" lâminas":" arquivos")+'</span>':"";
      var capa=it.i?'<img loading="lazy" alt="" src="'+esc(it.i)+'">':'<div class="thumb vazia" style="width:100%;height:100%;--tc:'+(COR[it.k]||"var(--cinza)")+'"></div>';
      h+='<article class="item'+(tem?' abre':'')+'"'+(tem?' role="button" tabindex="0" data-i="'+idx+'" aria-label="Ver: '+esc(it.t)+'"':'')+'>'
        +(it.h?'<div class="hora">'+esc(it.h)+'</div>':'<div class="hora sem">Horário a definir</div>')
        +'<div class="capa">'+capa+(ehVideo?'<span class="play"><span></span></span>':'')+selo+'</div>'
        +'<div class="info"><div class="tit">'+esc(it.t)+'</div><div class="det"><span class="tipo" style="background:'+(COR[it.k]||"var(--cinza)")+'">'+esc(tipo)+'</span>'
        +it.n.map(function(r){return'<span class="rede">'+esc(r)+'</span>'}).join("")+'</div>'
        +(tem?'<span class="ver">'+(ehVideo?"Assistir":it.m.length>1?"Ver lâminas":"Ver arte")+' →</span>':'')+'</div></article>';
    });
    h+="</section>";
  });
  el.innerHTML=h;
}
(function proxima(){
  var p=D.itens[0];if(!p)return;
  var rel=relativo(p.d),el=document.getElementById("proxima");
  el.innerHTML=(p.i?'<img alt="" src="'+esc(p.i)+'">':"")+'<div class="quando"><div class="rot">Próxima publicação</div><div class="data">'+esc(rel?rel+", "+nomeDia(p.d).split(",").slice(1).join(",").trim():nomeDia(p.d))+(p.h?" às "+esc(p.h):"")+'</div><div class="tit">'+esc(p.t)+(p.n.length?" · "+esc(p.n.join(", ")):"")+'</div></div>';
  if(p.m.length){el.style.cursor="pointer";el.setAttribute("role","button");el.tabIndex=0;el.onclick=function(){vAbre(0,el)};el.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();vAbre(0,el)}}}
  el.hidden=false;
})();
var V={it:null,pos:0,volta:null},visor=document.getElementById("visor");
function vMostra(){
  var it=V.it,m=it.m[V.pos],el=document.getElementById("v-midia");
  el.innerHTML=m.v?'<video controls autoplay playsinline preload="metadata" poster="'+esc(m.i)+'" src="'+esc(m.v)+'"></video>':'<img alt="'+esc(it.t)+'" src="'+esc(m.g||m.i)+'">';
  var mais=it.m.length>1;
  document.getElementById("v-ant").hidden=!mais;document.getElementById("v-prox").hidden=!mais;
  document.getElementById("v-pontos").innerHTML=mais?it.m.map(function(_,i){return'<i class="'+(i===V.pos?"on":"")+'"></i>'}).join(""):"";
  document.getElementById("v-tit").innerHTML=esc(it.t)+'<div class="sub">'+esc(nomeDia(it.d))+(it.h?" às "+esc(it.h):"")+(it.n.length?" · "+esc(it.n.join(", ")):"")+(mais?" · "+(V.pos+1)+" de "+it.m.length:"")+'</div>';
  if(mais){var prox=it.m[(V.pos+1)%it.m.length];if(!prox.v){var pre=new Image();pre.src=prox.g||prox.i}}
}
function vAbre(i,orig){V.it=D.itens[i];V.pos=0;V.volta=orig;if(!V.it||!V.it.m.length)return;visor.hidden=false;document.body.style.overflow="hidden";vMostra();document.getElementById("v-fechar").focus()}
function vFecha(){visor.hidden=true;document.getElementById("v-midia").innerHTML="";document.body.style.overflow="";if(V.volta)V.volta.focus()}
function vPassa(d){if(!V.it)return;var n=V.it.m.length;V.pos=(V.pos+d+n)%n;vMostra()}
document.getElementById("v-fechar").onclick=vFecha;
document.getElementById("v-ant").onclick=function(){vPassa(-1)};
document.getElementById("v-prox").onclick=function(){vPassa(1)};
visor.addEventListener("click",function(e){if(e.target===visor||e.target.classList.contains("palco")||e.target.id==="v-midia")vFecha()});
document.addEventListener("keydown",function(e){if(visor.hidden)return;if(e.key==="Escape")vFecha();else if(e.key==="ArrowLeft")vPassa(-1);else if(e.key==="ArrowRight")vPassa(1)});
var tx=null;visor.addEventListener("touchstart",function(e){tx=e.touches[0].clientX},{passive:true});
visor.addEventListener("touchend",function(e){if(tx===null)return;var dx=e.changedTouches[0].clientX-tx;tx=null;if(Math.abs(dx)>50)vPassa(dx<0?1:-1)});
var lista=document.getElementById("lista");
lista.addEventListener("click",function(e){var t=e.target.closest&&e.target.closest("[data-i]");if(t)vAbre(+t.getAttribute("data-i"),t)});
lista.addEventListener("keydown",function(e){if(e.key!=="Enter"&&e.key!==" ")return;var t=e.target.closest&&e.target.closest("[data-i]");if(t){e.preventDefault();vAbre(+t.getAttribute("data-i"),t)}});
montaFiltros();render();
</script>
</body>
</html>`;
}
