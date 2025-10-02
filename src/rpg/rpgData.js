// src/rpg/rpgData.js

/* ================================
   CONFIG E DADOS DO MODO RPG
   - Edite aqui para adicionar/alterar itens, classes, raças e textos
   ================================ */

export const rpgUi = {
  title: "Reino RPG",
  subtitle:
    "Escolha sua classe, raça e enfrente chefes lendários. Miniaturas em resina com qualidade de vitrine.",
  ctaBack: "Voltar à Loja",
};

export const rpgClasses = [
  "Todos",
  "Guerreiro",
  "Mago",
  "Arqueiro",
  "Clérigo",
  "Ladino",
  "Bárbaro",
];

export const rpgRacas = [
  "Todas",
  "Humano",
  "Elfo",
  "Anão",
  "Orc",
  "Tiefling",
  "Draconato",
];

/**
 * ITENS DO RPG
 * - tipo: "miniatura" | "boss"
 * - classe / raca: use valores das listas acima (ou adicione novos e inclua nas listas)
 * - imgs: array de caminhos das imagens em /public/images/rpg/
 */
export const rpgItens = [
  // ===== Miniaturas =====
  {
    id: "rpg_m1",
    tipo: "miniatura",
    nome: "Guerreiro Anão",
    classe: "Guerreiro",
    raca: "Anão",
    escala: "28 mm",
    preco: 20,
    imgs: [
      "/images/rpg/guerreiro-anao-1.jpg",
    ],
  },
  {
    id: "rpg_m2",
    tipo: "miniatura",
    nome: "Maga Humana",
    classe: "Mago",
    raca: "Humano",
    escala: "28 mm",
    preco: 20,
    imgs: ["/images/rpg/maga-humana-1.jpg"],
  },

  // ===== Bosses =====
  {
    id: "rpg_b1",
    tipo: "boss",
    nome: "Dragão das Cinzas",
    classe: "Bárbaro", // só para facilitar filtros (pode por "—")
    raca: "Draconato",
    escala: "1/6",
    preco: 680,
    imgs: ["/images/rpg/dragao-cinzas-1.jpg", "/images/rpg/dragao-cinzas-2.jpg"],
  },
  {
    id: "rpg_b2",
    tipo: "boss",
    nome: "Lorde Orc",
    classe: "Guerreiro",
    raca: "Orc",
    escala: "1/7",
    preco: 520,
    imgs: ["/images/rpg/lorde-orc-1.jpg"],
  },
];

/* DICA:
   - Para adicionar itens, duplique um objeto, mude "id", "nome", "classe", "raca", "imgs" e "preco".
   - As imagens devem ficar em public/images/rpg/... (você decide os nomes).
*/
