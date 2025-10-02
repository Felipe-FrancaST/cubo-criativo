// ============================================================================
// Aqui ficam TODOS os produtos do catálogo/estoque.
// Como editar:
// - status: "estoque" | "catalogo"
// - tags: categorias/grupos (ex.: ["Naruto"], ["DBZ"], ["RPG"], ["Filmes"])
// - variants: [{ label: "1/7", price: 500 }, ...]
// - defaultVariant: escala inicial
// - imgs: array de imagens extras para a galeria (a 1ª pode ser igual à img)
// Coloque suas imagens em /public/images e referencie como "/images/arquivo.jpg"
// ============================================================================

export const produtos = [
  {
    id: "p1",
    nome: "Minthara (Baldur's Gate)",
    img: "/images/prod1.jpg",
    imgs: ["/images/prod1.jpg"],
    model: "/models/mintharaviewer.glb",
    status: "estoque",
    tags: ["Baldur's Gate", "Games", "RPG"],
    defaultVariant: "1/7 - 24 cm",
    variants: [
      { label: "1/7 - 24 cm", price: 500 }],
  },
  {
    id: "p2",
    nome: "Majin Boo",
    img: "/images/prod2.jpg",
    imgs: ["/images/prod2.jpg", "/images/prod2-1.jpg"],
    status: "catalogo",
    tags: ["DBZ", "Animes"],
    defaultVariant: "1/8",
    variants: [
      { label: "1/8 - 30 cm", price: 600 },
    ],
  },
  {
    id: "p3",
    nome: "Konan",
    img: "/images/prod3.jpg",
    imgs: ["/images/prod3.jpg", "/images/prod3-1.jpg"],
    status: "catalogo",
    tags: ["Naruto", "Animes"],
    defaultVariant: "1/9 - 26 cm",
    variants: [
      { label: "1/9 - 26 cm", price: 500 },
    ],
  },
  {
    id: "p4",
    nome: "Arlequina (NFSW)",
    img: "/images/prod4.jpg",
    imgs: ["/images/prod4.jpg", "/images/prod4-1.jpg", "/images/prod4-2.jpg"],
    status: "catalogo",
    tags: ["DC", "Filmes", "HQs", "NFSW"],
    defaultVariant: "1/6 - 33 cm",
    variants: [
      { label: "1/6 - 33 cm", price: 420 },
    ],
  },
  {
    id: "p5",
    nome: "Naruto (Clássico)",
    img: "/images/prod5.jpg",
    imgs: ["/images/prod5.jpg", "/images/prod5-1.jpg"],
    status: "catalogo",
    tags: ["Naruto", "Animes"],
    defaultVariant: "1/6",
    variants: [
      { label: "1/6 - 27 cm", price: 490 },
    ],
  },
  {
    id: "p6",
    nome: "Naruto (Hokage)",
    img: "/images/prod6.jpg",
    imgs: ["/images/prod6.jpg"],
    status: "catalogo",
    tags: ["Naruto", "Animes"],
    defaultVariant: "1/9",
    variants: [
      { label: "1/9 - 22 cm", price: 425 },

    ],
  },

  {
    id: "p56",
    nome: "Dobby (Harry Pooter)",
    img: "/images/prod56.jpg",
    imgs: ["/images/prod56.jpg"],
    status: "estoque",
    tags: ["Harry Pooter", "Filmes"],
    defaultVariant: "1/7",
    variants: [
      { label: "1/7 - 15 cm", price: 150 },
    ],
  },
];
