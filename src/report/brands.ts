/**
 * Marca de cada cliente no relatório de entregas (/relatorio/<workspaceId>).
 *
 * Para adicionar um cliente: copie um bloco de BRANDS, troque o ID do workspace
 * do eKyte e preencha logos, cores, fonte e frases. Workspace sem bloco aqui
 * usa o visual neutro (NEUTRA), com o nome do workspace no lugar da logo.
 */

export interface BrandColors {
  marca: string;        // cor principal (botões, destaques, card de total)
  marcaEscura: string;  // rodapé
  marcaClara: string;   // fundos suaves (topo, miniaturas sem imagem)
  marcaLinha: string;   // linhas sobre o tom de marca
  tinta: string;        // texto
  cinza: string;        // texto secundário
  linha: string;        // bordas
  fundo: string;        // fundo da página
  filtrosFundo: string; // barra de filtros (fundo com leve transparência)
  totalLegenda: string; // legenda dentro do card de total
  rodapeTexto: string;  // texto do rodapé
  // cores por formato e por situação
  carrossel: string;
  estatico: string;
  video: string;
  email: string;
  artigo: string;
  publicada: string;
  agendada: string;
  entregue: string;
  producao: string;
}

export interface Brand {
  /** Nome curto usado no título ("Tudo o que criamos para a Bagueira"). */
  nomeCurto: string;
  /** Nome completo (texto alternativo das logos e linha "Arthur & Vidal para …"). */
  nomeCompleto: string;
  /** Título da página. */
  titulo: string;
  /** Frase de assinatura no rodapé. */
  assinatura: string;
  /** Logo para fundo claro (barra do topo). Sem logo, aparece o nome. */
  logoClara?: string;
  /** Logo para fundo escuro (rodapé). Sem logo, aparece o nome. */
  logoEscura?: string;
  /** Ícone Material Symbols ao lado de "Arthur & Vidal para …". */
  icone: string;
  /** Nome da fonte (família CSS) e link do Google Fonts. */
  fonte: string;
  fonteUrl?: string;
  cores: BrandColors;
}

const HEEBO = "https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap";

const BAGUEIRA: Brand = {
  nomeCurto: "a Bagueira",
  nomeCompleto: "Bagueira Seguros",
  titulo: "Tudo o que criamos para a Bagueira",
  assinatura: "Proteção e estratégia para o seu patrimônio financeiro.",
  logoClara: "https://bagueiraseguros.com.br/05bagueira_horizontal_preto.webp?v=20260622-8",
  logoEscura: "https://bagueiraseguros.com.br/03bagueira_horizontal_branco.webp?v=20260622-8",
  icone: "verified_user",
  fonte: "Heebo",
  fonteUrl: HEEBO,
  cores: {
    marca: "#0f6b45", marcaEscura: "#0a3d29", marcaClara: "#e7f2ec", marcaLinha: "#c9e0d3",
    tinta: "#16201b", cinza: "#5d6a63", linha: "#dfe6e2", fundo: "#f5f7f6",
    filtrosFundo: "rgba(245,247,246,.96)", totalLegenda: "#d5eadf", rodapeTexto: "#d8e6de",
    carrossel: "#0f6b45", estatico: "#5aa37f", video: "#c9a227", email: "#2f5d8a", artigo: "#8a6f9e",
    publicada: "#0f6b45", agendada: "#2f5d8a", entregue: "#8fb7a1", producao: "#c9a227",
  },
};

/** Visual para workspaces sem marca configurada: grafite neutro, Heebo, nome em texto. */
const NEUTRA_CORES: BrandColors = {
  marca: "#2f3a45", marcaEscura: "#1c232b", marcaClara: "#eef1f4", marcaLinha: "#d5dbe1",
  tinta: "#1b2127", cinza: "#5f6b76", linha: "#e1e5ea", fundo: "#f6f7f9",
  filtrosFundo: "rgba(246,247,249,.96)", totalLegenda: "#d3dae1", rodapeTexto: "#c9d1d9",
  carrossel: "#2f3a45", estatico: "#7d93a8", video: "#c9a227", email: "#2f5d8a", artigo: "#8a6f9e",
  publicada: "#2f3a45", agendada: "#2f5d8a", entregue: "#9aa8b5", producao: "#c9a227",
};

const AUGUSTO_ESTEVES: Brand = {
  nomeCurto: "o Augusto",
  nomeCompleto: "Augusto Esteves Jr.",
  titulo: "Tudo o que criamos para o Augusto",
  assinatura: "Clareza de cenário, estratégia e decisão bem feita.",
  // logo do site (verde-claro, para fundo escuro); falta a versão para fundo claro
  logoEscura: "https://augustoesteves.com.br/assets/images/logo-verde-claro.png",
  icone: "apartment",
  fonte: "Heebo",
  fonteUrl: HEEBO,
  // cores ainda neutras: o site não deixou ler os hexas — trocar quando confirmados
  cores: NEUTRA_CORES,
};

export const BRANDS: Record<number, Brand> = {
  113920: BAGUEIRA,
  113919: AUGUSTO_ESTEVES,
};

export function brandFor(workspaceId: number, workspaceName: string): Brand {
  const b = BRANDS[workspaceId];
  if (b) return b;
  const nome = (workspaceName || "o cliente").trim();
  return {
    nomeCurto: nome,
    nomeCompleto: nome,
    titulo: `Tudo o que criamos para ${nome}`,
    assinatura: "Relatório de entregas de marketing.",
    icone: "verified_user",
    fonte: "Heebo",
    fonteUrl: HEEBO,
    cores: NEUTRA_CORES,
  };
}
