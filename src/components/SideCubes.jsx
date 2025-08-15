import React from "react";

/**
 * Animação de cubos caindo e girando na lateral.
 * side: "left" | "right"
 * width: largura da faixa lateral (px)
 * density: quantos cubos (10–60 é ok)
 * speed: velocidade base (1–3)
 * color: cor do traço (rgba recomendado)
 * opacity: opacidade do canvas
 */
export default function SideCubes({
  side = "left",
  width = 72,
  density = 32,
  speed = 1.6,
  color = "rgba(94, 234, 212, 0.45)", // teal-300 com alpha
  opacity = 0.5,
}) {
  const ref = React.useRef(null);
  const rafRef = React.useRef(null);
  const paused = React.useRef(false);

  React.useEffect(() => {
    // respeita acessibilidade
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paused.current = true;
      return;
    }

    const canvas = ref.current;
    if (!canvas) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const ctx = canvas.getContext("2d");

    function setSize() {
      const w = width;
      const h = window.innerHeight;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    setSize();

    // particulas (cubos)
    const cubes = [];
    const area = () => ({ w: width, h: window.innerHeight });

    function rand(min, max) {
      return Math.random() * (max - min) + min;
    }

    function spawnCube(yStart = rand(-area().h, 0)) {
      const s = rand(8, 18);                 // tamanho do cubo
      const xPad = 6;                         // padding da borda
      const x = side === "left" ? rand(xPad, width - xPad) : rand(xPad, width - xPad);
      const y = yStart;
      const vy = rand(0.35, 0.9) * speed;     // vel. queda
      const vr = rand(-0.02, 0.02) || 0.015;  // vel. rotação
      const rot = rand(0, Math.PI * 2);
      const shade = rand(0.2, 0.9);           // variação de brilho
      return { x, y, s, vy, vr, rot, shade };
    }

    // cria lote inicial
    for (let i = 0; i < density; i++) cubes.push(spawnCube(rand(-area().h, area().h)));

    function drawCube(c) {
      // desenha “cubo” isométrico simples (quadrado + borda + “sombra”)
      ctx.save();
      const x = side === "left" ? c.x : canvas.width / dpr - (width - c.x);
      ctx.translate(x, c.y);
      ctx.rotate(c.rot);

      // face
      ctx.fillStyle = `rgba(15, 23, 42, ${0.25 + 0.25 * c.shade})`; // slate-ligero com alpha
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;

      const s = c.s;
      ctx.beginPath();
      ctx.rect(-s / 2, -s / 2, s, s);
      ctx.fill();
      ctx.stroke();

      // marca no meio (parece 3D)
      ctx.beginPath();
      ctx.moveTo(-s / 2, -s / 2);
      ctx.lineTo(0, 0);
      ctx.lineTo(s / 2, -s / 2);
      ctx.strokeStyle = `rgba(94, 234, 212, ${0.25})`;
      ctx.stroke();

      ctx.restore();
    }

    function tick() {
      if (paused.current) return;

      // limpar
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // leve gradiente para dar profundidade
      const grad = ctx.createLinearGradient(0, 0, side === "left" ? width : 0, 0);
      grad.addColorStop(0, "rgba(2, 6, 23, 0.0)");
      grad.addColorStop(1, "rgba(2, 6, 23, 0.25)"); // slate-950 com alpha
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, canvas.height / dpr);

      // atualizar/desenhar cubos
      const h = area().h;
      for (const c of cubes) {
        c.y += c.vy;
        c.rot += c.vr;
        if (c.y - c.s > h + 10) {
          // reaparece acima
          const reset = spawnCube(-rand(20, h));
          c.x = reset.x; c.y = reset.y; c.s = reset.s;
          c.vy = reset.vy; c.vr = reset.vr; c.rot = reset.rot; c.shade = reset.shade;
        }
        drawCube(c);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    function onResize() {
      setSize();
    }
    window.addEventListener("resize", onResize);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [side, width, density, speed, color, opacity]);

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-y-0 ${side === "left" ? "left-0" : "right-0"} pointer-events-none z-10`}
      style={{ width, opacity }}
    >
      <canvas ref={ref} className="h-full w-full"></canvas>
    </div>
  );
}
