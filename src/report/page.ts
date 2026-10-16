/**
 * Painel dinâmico de entregas — logos, cores, fonte e frases vêm da marca do
 * workspace (src/report/brands.ts); sem marca configurada, visual neutro.
 *
 * O servidor embute os dados (lidos ao vivo do eKyte) e o navegador recalcula
 * totais, gráfico, redes, situação e galeria a cada filtro.
 * Para ajustar a marca de um cliente, edite src/report/brands.ts.
 */

import { KIND_LABEL, STATUS_LABEL, WorkspaceReport, sign } from "../services/publications.js";
import { Brand, brandFor } from "./brands.js";

/** Logo da marca ou, sem logo, o nome em texto. */
function logo(url: string | undefined, b: Brand, cls: string): string {
  return url ? `<img src="${esc(url)}" alt="${esc(b.nomeCompleto)}">` : `<span class="${cls}">${esc(b.nomeCompleto)}</span>`;
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** JSON seguro para dentro de <script>. */
function jsonForScript(v: unknown): string {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .split(String.fromCharCode(0x2028)).join("\\u2028")
    .split(String.fromCharCode(0x2029)).join("\\u2029");
}

export function renderReportPage(r: WorkspaceReport, opts: { refreshHref: string }): string {
  const b = brandFor(r.workspaceId, r.workspaceName);
  const c = b.cores;
  const fontStack = `"${b.fonte}",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`;
  const data = {
    nome: r.workspaceName || b.nomeCompleto,
    gerado: new Date(r.generatedAt).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "long",
      timeStyle: "short",
    }),
    hoje: new Date().toISOString().slice(0, 7),
    kinds: KIND_LABEL,
    status: STATUS_LABEL,
    pecas: r.pieces
      .filter((p) => p.month)
      .map((p) => ({
        k: p.kind,
        t: p.title,
        d: p.date,
        m: p.month,
        i: p.imageId ? `/relatorio/img/${p.imageId}?s=${sign("i", p.imageId)}` : "",
        v: p.videoId ? `/relatorio/vthumb/${p.videoId}?s=${sign("v", p.videoId)}` : "",
        l: p.slides,
        u: p.postUrl || "",
        n: p.networks,
        s: p.status,
        ta: p.taskTitle,
      })),
    outras: r.others.map((o) => ({ t: o.title, d: o.date, m: o.month })),
  };

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Relatório de Marketing · ${esc(data.nome)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${b.fonteUrl ? `<link rel="stylesheet" href="${b.fonteUrl}">` : ""}
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=swap">
<style>
/* Layout: barra do site · título + filtros fixos · números · gráfico mensal | redes e situação · galeria por mês · tabela · rodapé verde */
:root{
  --verde:${c.marca}; --verde-escuro:${c.marcaEscura}; --verde-claro:${c.marcaClara}; --verde-linha:${c.marcaLinha};
  --tinta:${c.tinta}; --cinza:${c.cinza}; --linha:${c.linha}; --fundo:${c.fundo}; --branco:#ffffff;
  --c-carrossel:${c.carrossel}; --c-estatico:${c.estatico}; --c-video:${c.video}; --c-email:${c.email}; --c-artigo:${c.artigo};
  --st-publicada:${c.publicada}; --st-agendada:${c.agendada}; --st-entregue:${c.entregue}; --st-producao:${c.producao};
  --font:${fontStack};
  color-scheme:light;
}
*{box-sizing:border-box}
body{margin:0;font-family:var(--font);color:var(--tinta);background:var(--fundo);font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:var(--verde)}
button{font:inherit;color:inherit}
.ms{font-family:"Material Symbols Outlined";font-weight:normal;font-style:normal;font-size:20px;line-height:1;display:inline-block;letter-spacing:normal;text-transform:none;white-space:nowrap;direction:ltr;font-feature-settings:"liga";-webkit-font-feature-settings:"liga";vertical-align:middle}
.wrap{max-width:1240px;margin:0 auto;padding-left:max(20px,env(safe-area-inset-left,0px));padding-right:max(20px,env(safe-area-inset-right,0px))}
[hidden]{display:none!important}
:focus-visible{outline:3px solid var(--c-estatico);outline-offset:2px}

/* barra do site */
.top{background:var(--branco);border-bottom:1px solid var(--linha)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-block:14px}
.top img{height:36px;width:auto}
.top .meta{font-size:13px;color:var(--cinza);text-align:right;line-height:1.35}
.top .meta b{display:block;color:var(--tinta);font-weight:600;font-size:14px}
.top .meta a{font-weight:600;text-decoration:none}

/* título */
.intro{background:linear-gradient(180deg,var(--verde-claro),var(--fundo));padding-block:36px 22px}
.eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--verde)}
h1{font-size:clamp(28px,4vw,42px);line-height:1.1;font-weight:800;letter-spacing:-.02em;margin:10px 0 8px;text-wrap:balance}
#resumo{color:var(--cinza);font-size:17px;max-width:70ch;margin:0}
#resumo b{color:var(--tinta)}

/* filtros */
.filtros{position:sticky;top:0;z-index:10;background:${c.filtrosFundo};backdrop-filter:blur(8px);border-bottom:1px solid var(--linha)}
.filtros .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding-block:12px}
.grupo{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.grupo > .rot{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--cinza);margin-right:2px}
.sep{width:1px;align-self:stretch;background:var(--linha)}
select,input[type=search]{font:inherit;font-size:14px;border:1px solid var(--linha);background:var(--branco);border-radius:10px;padding:7px 10px;color:var(--tinta)}
input[type=search]{min-width:0;width:200px}
.chip{border:1px solid var(--linha);background:var(--branco);padding:6px 12px;border-radius:999px;font-size:13.5px;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.chip:hover{border-color:var(--verde)}
.chip[aria-pressed=true]{background:var(--verde);border-color:var(--verde);color:#fff}
.chip .dot{width:9px;height:9px;border-radius:50%}
.chip[aria-pressed=true] .dot{box-shadow:0 0 0 2px #fff}
.limpar{border:0;background:none;color:var(--verde);font-weight:600;font-size:13.5px;cursor:pointer;padding:6px 4px}

/* números */
main{padding-block:22px 10px;display:grid;gap:22px}
.kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
.kpi{background:var(--branco);border:1px solid var(--linha);border-radius:16px;padding:16px 16px 14px;text-align:left;cursor:pointer;display:grid;gap:2px;transition:border-color .15s}
.kpi:hover{border-color:var(--verde)}
.kpi[aria-pressed=true]{border-color:var(--verde);box-shadow:inset 0 0 0 1px var(--verde)}
.kpi.total{background:var(--verde);border-color:var(--verde);color:#fff;cursor:default}
.kpi .ms{font-size:24px;margin-bottom:4px}
.kpi strong{font-size:34px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}
.kpi span:last-child{font-size:13.5px;color:var(--cinza)}
.kpi.total span:last-child{color:${c.totalLegenda}}

/* painéis */
.duo{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:22px}
.painel{background:var(--branco);border:1px solid var(--linha);border-radius:16px;padding:18px 20px;min-width:0}
.painel h2{font-size:18px;font-weight:700;margin:0 0 2px}
.painel .sub{color:var(--cinza);font-size:13.5px;margin:0 0 12px}
.legenda{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12.5px;color:var(--cinza);margin-bottom:6px}
.legenda i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.grafico{overflow-x:auto}
.grafico svg{display:block}
.grafico .g{stroke:var(--linha)}
.grafico .ax{fill:var(--cinza);font-size:11px;font-family:var(--font)}
.grafico .tot{fill:var(--tinta);font-size:11.5px;font-weight:700;font-family:var(--font)}
.grafico .col{cursor:pointer}
.grafico .col:hover .hl{fill:var(--verde-claro)}
.grafico .col.sel .hl{fill:var(--verde-claro)}
.barras{display:grid;gap:9px}
.barra{display:grid;grid-template-columns:96px minmax(0,1fr) 40px;align-items:center;gap:10px;font-size:13.5px;background:none;border:0;padding:0;text-align:left;cursor:pointer}
.barra .trilho{height:12px;border-radius:6px;background:var(--fundo);overflow:hidden}
.barra .enche{height:100%;border-radius:6px;background:var(--verde)}
.barra b{text-align:right;font-variant-numeric:tabular-nums}
.barra[aria-pressed=true] span:first-child{font-weight:700;color:var(--verde)}
.pilha{display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--fundo);margin:6px 0 10px}
.pilha span{height:100%}
.st-lista{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}
.vazio{color:var(--cinza);font-size:14px;padding:6px 0}

/* galeria */
.cab{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 14px}
.cab h2{font-size:22px;font-weight:800;margin:0}
.cab p{margin:0;color:var(--cinza);font-size:14px}
.mes{display:grid;gap:12px}
.mes header{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;border-bottom:1px solid var(--linha);padding-bottom:8px}
.mes h3{font-size:19px;font-weight:700;margin:0}
.mes .cont{font-size:13px;color:var(--cinza)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}
.card{background:var(--branco);border:1px solid var(--linha);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;min-width:0}
.thumb{position:relative;aspect-ratio:4/5;background:var(--verde-claro)}
.thumb img{position:relative;width:100%;height:100%;object-fit:cover}
.play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;background:rgba(10,61,41,.72);color:#fff;display:grid;place-items:center;pointer-events:none}
.play .ms{font-size:30px}
.ph{position:absolute;inset:0;display:grid;place-items:center;color:var(--verde)}
.ph .ms{font-size:42px;opacity:.65}
.tipo{position:absolute;left:8px;top:8px;display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;padding:3px 8px 3px 6px;border-radius:999px;background:rgba(255,255,255,.95)}
.tipo .ms{font-size:15px}
.sit{position:absolute;right:8px;top:8px;font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;color:#fff}
.corpo{padding:10px 12px 12px;display:flex;flex-direction:column;gap:3px;flex:1}
.corpo h4{margin:0;font-size:13.5px;font-weight:600;line-height:1.35;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.corpo .info{margin:0;font-size:12px;color:var(--cinza)}
.corpo a{margin-top:auto;padding-top:6px;font-size:12.5px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:2px}
.corpo a .ms{font-size:15px}
.mais{justify-self:center;border:1px solid var(--verde);color:var(--verde);background:var(--branco);border-radius:999px;padding:9px 20px;font-weight:600;cursor:pointer}

/* tabela */
details.painel summary{cursor:pointer;font-weight:700;font-size:16px}
.tabela{overflow-x:auto;margin-top:12px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:14px}
th,td{padding:9px 10px;border-bottom:1px solid var(--linha);text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left}
thead th{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--cinza);font-weight:600}
td.t{font-weight:700}
.outras ul{list-style:none;margin:0;padding:0;columns:2 300px;column-gap:28px}
.outras li{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--linha);break-inside:avoid;font-size:14px}
.outras time{color:var(--cinza);font-size:12.5px;white-space:nowrap}

footer{margin-top:36px;background:var(--verde-escuro);color:${c.rodapeTexto}}
footer .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:18px;padding-block:30px}
footer img{height:32px;width:auto}
footer p{margin:6px 0 0;font-size:13.5px}
footer .dir{text-align:right;font-size:13px}
footer a{color:#fff}
${b.logoClara && b.logoEscura ? "" : ".marca-txt{font-weight:800;font-size:20px;letter-spacing:-.01em;color:var(--tinta)}\nfooter .marca-txt{color:#fff}\n"}
@media (max-width:1000px){.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.duo{grid-template-columns:minmax(0,1fr)}}
@media (max-width:640px){
  .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .sep{display:none}
  input[type=search]{width:100%}
  .grupo.busca{flex:1 1 100%}
  .top .meta span{display:none}
  footer .dir{text-align:left}
  .filtros{position:static}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
</style>
</head>
<body>
<div class="top"><div class="wrap">
  ${logo(b.logoClara, b, "marca-txt")}
  <div class="meta"><b>Relatório de marketing</b><span>Dados do eKyte · ${esc(data.gerado)} · </span><a href="${esc(opts.refreshHref)}">atualizar agora</a></div>
</div></div>

<section class="intro"><div class="wrap">
  <span class="eyebrow"><span class="ms">${esc(b.icone)}</span>Arthur &amp; Vidal para ${esc(b.nomeCompleto)}</span>
  <h1>${esc(b.titulo)}</h1>
  <p id="resumo"></p>
</div></section>

<div class="filtros"><div class="wrap">
  <div class="grupo">
    <span class="rot">Período</span>
    <label class="sr" hidden for="de">De</label><select id="de" aria-label="De"></select>
    <span>até</span>
    <label class="sr" hidden for="ate">Até</label><select id="ate" aria-label="Até"></select>
    <select id="atalho" aria-label="Atalhos de período">
      <option value="">Atalhos…</option>
      <option value="mes">Mês atual</option>
      <option value="3">Últimos 3 meses</option>
      <option value="6">Últimos 6 meses</option>
      <option value="ano">Este ano</option>
      <option value="tudo">Todo o período</option>
    </select>
  </div>
  <span class="sep"></span>
  <div class="grupo" id="f-rede"><span class="rot">Rede</span></div>
  <span class="sep"></span>
  <div class="grupo" id="f-sit"><span class="rot">Situação</span></div>
  <span class="sep"></span>
  <div class="grupo busca"><input id="busca" type="search" placeholder="Buscar peça ou tema" aria-label="Buscar"></div>
  <button type="button" class="limpar" id="limpar">Limpar filtros</button>
</div></div>

<main class="wrap">
  <div class="kpis" id="kpis"></div>

  <div class="duo">
    <section class="painel">
      <h2>Peças por mês</h2>
      <p class="sub">Toque num mês para ver só ele.</p>
      <div class="legenda" id="leg"></div>
      <div class="grafico" id="grafico"></div>
    </section>
    <section class="painel">
      <h2>Por rede social</h2>
      <p class="sub">Peças que foram para cada canal. Toque para filtrar.</p>
      <div class="barras" id="redes"></div>
      <h2 style="margin-top:18px">Situação</h2>
      <div class="pilha" id="pilha"></div>
      <div class="st-lista" id="stl"></div>
    </section>
  </div>

  <section class="mes-lista" style="display:grid;gap:22px">
    <div class="cab"><h2>Galeria</h2><p id="gal-info"></p></div>
    <div id="galeria" style="display:grid;gap:26px"></div>
  </section>

  <details class="painel">
    <summary>Tabela por mês</summary>
    <div class="tabela"><table><thead id="th"></thead><tbody id="tb"></tbody></table></div>
  </details>

  <section class="painel outras" id="outras-box">
    <h2>Planejamento, roteiros e estratégia</h2>
    <p class="sub">Entregas do período que não viram peça publicada, mas fazem parte do trabalho.</p>
    <ul id="outras"></ul>
  </section>
</main>

<footer><div class="wrap">
  <div>${logo(b.logoEscura, b, "marca-txt")}<p>${esc(b.assinatura)}</p></div>
  <div class="dir">Relatório gerado a partir do eKyte e atualizado automaticamente.<br>Última leitura: ${esc(data.gerado)}</div>
</div></footer>

<script id="dados" type="application/json">${jsonForScript(data)}</script>
<script>
(function(){
var D=JSON.parse(document.getElementById("dados").textContent);
var P=(D.pecas||[]).map(function(p){p.n=Array.isArray(p.n)?p.n:[];p.t=p.t||"";p.ta=p.ta||"";p.s=p.s||"entregue";return p});
var KINDS=["carrossel","estatico","video","email","artigo"];
var PLURAL={carrossel:"Carrosséis",estatico:"Estáticos",video:"Vídeos",email:"E-mails marketing",artigo:"Blog e LinkedIn"};
var ICON={carrossel:"view_carousel",estatico:"image",video:"smart_display",email:"mail",artigo:"article"};
var COR={carrossel:"var(--c-carrossel)",estatico:"var(--c-estatico)",video:"var(--c-video)",email:"var(--c-email)",artigo:"var(--c-artigo)"};
var STS=["publicada","agendada","entregue","producao"];
var STCOR={publicada:"var(--st-publicada)",agendada:"var(--st-agendada)",entregue:"var(--st-entregue)",producao:"var(--st-producao)"};
var MES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
var MESL=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
function mc(m){var a=m.split("-");return MES[+a[1]-1]+"/"+a[0].slice(2)}
function ml(m){var a=m.split("-");return MESL[+a[1]-1]+" de "+a[0]}
function db(d){var a=d.split("-");return a.length===3?a[2]+"/"+a[1]+"/"+a[0]:""}
function el(tag,attrs,html){var e=document.createElement(tag);if(attrs)for(var k in attrs){if(k==="text")e.textContent=attrs[k];else e.setAttribute(k,attrs[k])}if(html!=null)e.innerHTML=html;return e}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}

var meses=Array.from(new Set(P.map(function(p){return p.m}))).sort();
var redes={};P.forEach(function(p){p.n.forEach(function(n){redes[n]=(redes[n]||0)+1})});
var listaRedes=Object.keys(redes).sort(function(a,b){return redes[b]-redes[a]});

var F={de:meses[0],ate:meses[meses.length-1],kinds:{},redes:{},sts:{},q:""};

// ---- controles
var de=document.getElementById("de"),ate=document.getElementById("ate");
meses.forEach(function(m){de.appendChild(el("option",{value:m,text:mc(m)}));ate.appendChild(el("option",{value:m,text:mc(m)}))});
de.value=F.de;ate.value=F.ate;
de.onchange=function(){F.de=de.value;if(F.de>F.ate){F.ate=F.de;ate.value=F.ate}render()};
ate.onchange=function(){F.ate=ate.value;if(F.ate<F.de){F.de=F.ate;de.value=F.de}render()};
document.getElementById("atalho").onchange=function(){
  var v=this.value,fim=meses[meses.length-1],hoje=D.hoje;this.value="";
  var ultimo=meses.filter(function(m){return m<=hoje}).pop()||fim;
  if(v==="mes"){F.de=F.ate=ultimo}
  else if(v==="3"||v==="6"){var i=meses.indexOf(ultimo);F.ate=ultimo;F.de=meses[Math.max(0,i-(+v)+1)]}
  else if(v==="ano"){var y=hoje.slice(0,4);var ms=meses.filter(function(m){return m.slice(0,4)===y});if(ms.length){F.de=ms[0];F.ate=ms[ms.length-1]}}
  else if(v==="tudo"){F.de=meses[0];F.ate=fim}
  de.value=F.de;ate.value=F.ate;render();
};
function chips(boxId,keys,label,store,dot){
  var box=document.getElementById(boxId);
  keys.forEach(function(k){
    var b=el("button",{type:"button","class":"chip","aria-pressed":"false","data-k":k});
    b.innerHTML=(dot?'<span class="dot" style="background:'+dot(k)+'"></span>':"")+esc(label(k));
    b.onclick=function(){if(store[k])delete store[k];else store[k]=1;render()};
    box.appendChild(b);
  });
}
chips("f-rede",listaRedes,function(k){return k},F.redes);
chips("f-sit",STS.filter(function(s){return P.some(function(p){return p.s===s})}),function(k){return D.status[k]},F.sts,function(k){return STCOR[k]});
var busca=document.getElementById("busca"),tm;
busca.oninput=function(){clearTimeout(tm);tm=setTimeout(function(){F.q=busca.value.trim().toLowerCase();render()},150)};
document.getElementById("limpar").onclick=function(){F={de:meses[0],ate:meses[meses.length-1],kinds:{},redes:{},sts:{},q:""};de.value=F.de;ate.value=F.ate;busca.value="";render()};

function vazio(o){for(var k in o)return false;return true}
function filtra(ignorarKind){
  return P.filter(function(p){
    if(p.m<F.de||p.m>F.ate)return false;
    if(!ignorarKind&&!vazio(F.kinds)&&!F.kinds[p.k])return false;
    if(!vazio(F.redes)&&!p.n.some(function(n){return F.redes[n]}))return false;
    if(!vazio(F.sts)&&!F.sts[p.s])return false;
    if(F.q&&(p.t+" "+p.ta).toLowerCase().indexOf(F.q)<0)return false;
    return true;
  });
}
function conta(arr,key){var c={};arr.forEach(function(p){c[p[key]]=(c[p[key]]||0)+1});return c}

// ---- números
function kpis(base){
  var c=conta(base,"k"),box=document.getElementById("kpis");box.innerHTML="";
  var tot=filtra(false).length;
  var t=el("div",{"class":"kpi total"});t.innerHTML='<span class="ms">inventory_2</span><strong>'+tot+'</strong><span>Peças no filtro</span>';box.appendChild(t);
  KINDS.forEach(function(k){
    var b=el("button",{type:"button","class":"kpi","aria-pressed":F.kinds[k]?"true":"false",title:"Filtrar "+PLURAL[k].toLowerCase()});
    b.innerHTML='<span class="ms" style="color:'+COR[k]+'">'+ICON[k]+'</span><strong>'+(c[k]||0)+'</strong><span>'+PLURAL[k]+'</span>';
    b.onclick=function(){if(F.kinds[k])delete F.kinds[k];else F.kinds[k]=1;render()};
    box.appendChild(b);
  });
}

// ---- gráfico
function grafico(arr){
  var ms=meses.filter(function(m){return m>=F.de&&m<=F.ate});
  var box=document.getElementById("grafico");
  if(!ms.length){box.innerHTML='<p class="vazio">Nenhum mês no período.</p>';return}
  var por={};ms.forEach(function(m){por[m]={}});arr.forEach(function(p){if(por[p.m])por[p.m][p.k]=(por[p.m][p.k]||0)+1});
  var tots=ms.map(function(m){var s=0;for(var k in por[m])s+=por[m][k];return s});
  var max=Math.max(4,Math.max.apply(null,tots));
  var step=max<=10?2:max<=25?5:max<=60?10:20,top=Math.ceil(max/step)*step;
  var W=Math.max(520,ms.length*52+50),H=230,L=34,B=28,T=16,ph=H-B-T,cw=(W-L-8)/ms.length,bw=Math.min(28,cw*.62);
  function y(v){return T+ph-(v/top)*ph}
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Peças por mês">';
  for(var v=0;v<=top;v+=step)s+='<line class="g" x1="'+L+'" x2="'+(W-4)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text class="ax" x="'+(L-7)+'" y="'+(y(v)+4)+'" text-anchor="end">'+v+'</text>';
  ms.forEach(function(m,i){
    var cx=L+cw*(i+.5),acc=0,sel=F.de===m&&F.ate===m;
    s+='<g class="col'+(sel?" sel":"")+'" data-m="'+m+'"><rect class="hl" x="'+(L+cw*i+2)+'" y="'+T+'" width="'+(cw-4)+'" height="'+ph+'" fill="transparent" rx="6"/>';
    KINDS.forEach(function(k){var n=por[m][k]||0;if(!n)return;var y0=y(acc),y1=y(acc+n);s+='<rect x="'+(cx-bw/2)+'" y="'+y1+'" width="'+bw+'" height="'+Math.max(0,y0-y1-1.5)+'" fill="'+COR[k]+'"><title>'+mc(m)+" · "+PLURAL[k]+": "+n+'</title></rect>';acc+=n});
    if(tots[i])s+='<text class="tot" x="'+cx+'" y="'+(y(tots[i])-5)+'" text-anchor="middle">'+tots[i]+'</text>';
    s+='<text class="ax" x="'+cx+'" y="'+(H-9)+'" text-anchor="middle">'+mc(m)+'</text></g>';
  });
  box.innerHTML=s+'</svg>';
  box.querySelectorAll(".col").forEach(function(g){g.onclick=function(){var m=g.getAttribute("data-m");if(F.de===m&&F.ate===m){F.de=meses[0];F.ate=meses[meses.length-1]}else{F.de=F.ate=m}de.value=F.de;ate.value=F.ate;render()}});
}

// ---- redes e situação
function lados(arr){
  var c={};arr.forEach(function(p){p.n.forEach(function(n){c[n]=(c[n]||0)+1})});
  var box=document.getElementById("redes");box.innerHTML="";
  var max=Math.max.apply(null,[1].concat(listaRedes.map(function(n){return c[n]||0})));
  if(!listaRedes.length)box.innerHTML='<p class="vazio">As peças não têm rede cadastrada.</p>';
  listaRedes.forEach(function(n){
    var b=el("button",{type:"button","class":"barra","aria-pressed":F.redes[n]?"true":"false"});
    b.innerHTML='<span>'+esc(n)+'</span><span class="trilho"><span class="enche" style="width:'+((c[n]||0)/max*100)+'%"></span></span><b>'+(c[n]||0)+'</b>';
    b.onclick=function(){if(F.redes[n])delete F.redes[n];else F.redes[n]=1;render()};
    box.appendChild(b);
  });
  var s=conta(arr,"s"),tot=arr.length||1,pilha=document.getElementById("pilha"),stl=document.getElementById("stl");pilha.innerHTML="";stl.innerHTML="";
  STS.forEach(function(k){
    if(!s[k])return;
    pilha.appendChild(el("span",{style:"width:"+(s[k]/tot*100)+"%;background:"+STCOR[k],title:D.status[k]+": "+s[k]}));
    stl.appendChild(el("div",null,'<span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:'+STCOR[k]+'"></span>'+esc(D.status[k])+' <b style="float:right;font-variant-numeric:tabular-nums">'+s[k]+'</b>'));
  });
}

// ---- galeria
var LIM=60,limite=LIM;
function card(p){
  var ph='<div class="ph"><span class="ms">'+ICON[p.k]+'</span></div>';
  var img=p.i?'<img loading="lazy" src="'+p.i+'" alt="'+esc(p.t)+'">'
    :p.v?ph+'<img loading="lazy" src="'+p.v+'" alt="'+esc(p.t)+'" onerror="this.remove()"><span class="play"><span class="ms">play_arrow</span></span>'
    :ph;
  var info=[db(p.d),p.k==="carrossel"&&p.l>1?p.l+" lâminas":"",p.n.join(", ")].filter(Boolean).join(" · ");
  return '<article class="card"><div class="thumb">'+img+'<span class="tipo"><span class="ms" style="color:'+COR[p.k]+'">'+ICON[p.k]+'</span>'+esc(D.kinds[p.k])+'</span><span class="sit" style="background:'+STCOR[p.s]+'">'+esc(D.status[p.s])+'</span></div><div class="corpo"><h4>'+esc(p.t)+'</h4><p class="info">'+esc(info)+'</p>'+(p.u?'<a href="'+esc(p.u)+'" target="_blank" rel="noopener">Ver publicação <span class="ms">arrow_forward</span></a>':'')+'</div></article>';
}
function galeria(arr){
  var box=document.getElementById("galeria");
  var ord=arr.slice().sort(function(a,b){return b.d<a.d?-1:b.d>a.d?1:0});
  var vis=ord.slice(0,limite),grupos={},ordem=[];
  vis.forEach(function(p){if(!grupos[p.m]){grupos[p.m]=[];ordem.push(p.m)}grupos[p.m].push(p)});
  var porMes=conta(arr,"m"),html="";
  ordem.forEach(function(m){html+='<section class="mes"><header><h3>'+ml(m)+'</h3><span class="cont">'+porMes[m]+(porMes[m]===1?" peça":" peças")+'</span></header><div class="cards">'+grupos[m].map(card).join("")+'</div></section>'});
  if(!arr.length)html='<p class="vazio">Nenhuma peça com esses filtros. Use “Limpar filtros” para ver tudo.</p>';
  box.innerHTML=html;
  if(ord.length>limite){var b=el("button",{type:"button","class":"mais"});b.textContent="Mostrar mais "+Math.min(LIM,ord.length-limite)+" de "+(ord.length-limite)+" restantes";b.onclick=function(){limite+=LIM;galeria(arr)};box.appendChild(b)}
  document.getElementById("gal-info").textContent=arr.length?("Mostrando "+Math.min(limite,arr.length)+" de "+arr.length+", da mais recente para a mais antiga"):"";
}

// ---- tabela e outras entregas
function tabela(arr){
  document.getElementById("th").innerHTML="<tr><th>Mês</th>"+KINDS.map(function(k){return "<th>"+PLURAL[k]+"</th>"}).join("")+"<th>Total</th></tr>";
  var ms=meses.filter(function(m){return m>=F.de&&m<=F.ate}).reverse(),por={};
  arr.forEach(function(p){por[p.m]=por[p.m]||{};por[p.m][p.k]=(por[p.m][p.k]||0)+1});
  var tot={},T=0;
  document.getElementById("tb").innerHTML=ms.map(function(m){var r=por[m]||{},t=0;var tds=KINDS.map(function(k){var n=r[k]||0;t+=n;tot[k]=(tot[k]||0)+n;return "<td>"+(n||"–")+"</td>"}).join("");T+=t;return "<tr><td>"+ml(m)+"</td>"+tds+'<td class="t">'+t+"</td></tr>"}).join("")+
    '<tr><td><b>Total</b></td>'+KINDS.map(function(k){return "<td><b>"+(tot[k]||0)+"</b></td>"}).join("")+'<td class="t">'+T+"</td></tr>";
}
function outras(){
  var lst=D.outras.filter(function(o){return o.m>=F.de&&o.m<=F.ate&&(!F.q||o.t.toLowerCase().indexOf(F.q)>=0)});
  document.getElementById("outras-box").hidden=!lst.length;
  document.getElementById("outras").innerHTML=lst.map(function(o){return "<li><span>"+esc(o.t)+"</span><time>"+db(o.d)+"</time></li>"}).join("");
  return lst.length;
}

function resumo(arr,nOutras){
  var periodo=F.de===F.ate?ml(F.de).toLowerCase():ml(F.de).toLowerCase()+" a "+ml(F.ate).toLowerCase();
  var pub=arr.filter(function(p){return p.s==="publicada"}).length;
  var txt="<b>"+arr.length+(arr.length===1?" peça":" peças")+"</b> de "+periodo+(pub?", <b>"+pub+"</b> "+(pub===1?"já publicada":"já publicadas")+" nas redes":"");
  if(nOutras)txt+=", além de "+nOutras+(nOutras===1?" entrega":" entregas")+" de planejamento e roteiros";
  var ativos=[];
  KINDS.forEach(function(k){if(F.kinds[k])ativos.push(PLURAL[k].toLowerCase())});
  Object.keys(F.redes).forEach(function(n){ativos.push(n)});
  Object.keys(F.sts).forEach(function(s){ativos.push(D.status[s].toLowerCase())});
  if(F.q)ativos.push("“"+F.q+"”");
  document.getElementById("resumo").innerHTML=txt+"."+(ativos.length?" Filtro: "+esc(ativos.join(", "))+".":"");
}

function sync(){
  document.querySelectorAll("#f-rede .chip").forEach(function(b){b.setAttribute("aria-pressed",F.redes[b.getAttribute("data-k")]?"true":"false")});
  document.querySelectorAll("#f-sit .chip").forEach(function(b){b.setAttribute("aria-pressed",F.sts[b.getAttribute("data-k")]?"true":"false")});
}
var leg=document.getElementById("leg");
KINDS.forEach(function(k){if(P.some(function(p){return p.k===k}))leg.appendChild(el("span",null,'<i style="background:'+COR[k]+'"></i>'+esc(D.kinds[k])))});

function render(){
  limite=LIM;sync();
  var semKind=filtra(true),arr=filtra(false);
  kpis(semKind);grafico(arr);lados(arr);galeria(arr);tabela(arr);
  resumo(arr,outras());
}
render();
})();
</script>
</body>
</html>`;
}
