import { useEffect, useRef, useCallback } from "react";

export interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  shape: "rect" | "circle" | "star";
  tilt: number;
  tiltAngle: number;
  tiltSpeed: number;
  rotation: number;
  rotationSpeed: number;
}

const CONFETTI_COLORS = [
  "#f0d27a", // Ouro BalaBet
  "#ffd166", // Amarelo Doce
  "#06d6a0", // Verde Vitória
  "#47e0d0", // Ciano Jogador 1
  "#6cb6ff", // Azul Jogador 2
  "#ff8a5b", // Laranja Jogador 3
  "#d18bff", // Roxo Jogador 4
  "#ef476f", // Rosa Framboesa
  "#ffffff", // Brilho Estelar
];

export function ConfettiCanvas({
  active = false,
  onComplete,
}: {
  active?: boolean;
  onComplete?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<ConfettiParticle[]>([]);
  const animIdRef = useRef<number | null>(null);

  const spawnBurst = useCallback((originX?: number, originY?: number, count = 160) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cx = originX ?? canvas.width / 2;
    const cy = originY ?? canvas.height / 2;

    const newParticles: ConfettiParticle[] = [];

    for (let i = 0; i < count; i++) {
      // Dispersão em 360 graus com impulso explosivo inicial para cima e laterais
      const angle = Math.random() * Math.PI * 2;
      const speed = 7 + Math.random() * 18;
      // Impulso vertical adicional para criar arco parabólico natural
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - (speed * 0.4);

      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const randShape = Math.random();
      const shape: ConfettiParticle["shape"] =
        randShape < 0.65 ? "rect" : randShape < 0.85 ? "circle" : "star";

      newParticles.push({
        x: cx + (Math.random() - 0.5) * 30,
        y: cy + (Math.random() - 0.5) * 30,
        vx,
        vy,
        size: 7 + Math.random() * 7,
        color,
        alpha: 1,
        decay: 0.007 + Math.random() * 0.009,
        shape,
        tilt: Math.random() * 10,
        tiltAngle: Math.random() * Math.PI * 2,
        tiltSpeed: 0.07 + Math.random() * 0.12,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.18,
      });
    }

    particlesRef.current.push(...newParticles);

    // Inicia loop se não estiver rodando
    if (!animIdRef.current) {
      startLoop();
    }
  }, []);

  const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  };

  const startLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gravity = 0.38;
    const drag = 0.975;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const alive: ConfettiParticle[] = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Atualização da física de trajetória
        p.x += p.vx;
        p.y += p.vy;
        p.vy += gravity;
        p.vx *= drag;
        p.vy *= drag;

        // Efeito de oscilação tridimensional e rotação
        p.tiltAngle += p.tiltSpeed;
        p.tilt = Math.sin(p.tiltAngle) * 12;
        p.rotation += p.rotationSpeed;
        p.alpha -= p.decay;

        if (p.alpha > 0 && p.y < canvas.height + 50) {
          alive.push(p);

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);

          if (p.shape === "rect") {
            const currentW = p.size;
            const currentH = p.size * (Math.abs(p.tilt) / 12) * 1.6;
            ctx.fillRect(-currentW / 2, -currentH / 2, currentW, Math.max(1.5, currentH));
          } else if (p.shape === "circle") {
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Estrelinha brilhante
            drawStar(ctx, 0, 0, 4, p.size * 0.7, p.size * 0.3);
          }

          ctx.restore();
        }
      }

      particlesRef.current = alive;

      if (alive.length > 0) {
        animIdRef.current = requestAnimationFrame(render);
      } else {
        animIdRef.current = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onComplete?.();
      }
    };

    animIdRef.current = requestAnimationFrame(render);
  };

  // Ajusta a resolução do canvas à viewport
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
    };
  }, []);

  // Dispara os confetes automaticamente quando a prop `active` se torna verdadeira
  useEffect(() => {
    if (active) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Dispara uma explosão exuberante centrada na tela
        spawnBurst(canvas.width / 2, canvas.height / 2, 175);

        // Dispara uma segunda rajada ligeiramente atrasada (+180ms) para maior volume visual
        const timeout = setTimeout(() => {
          spawnBurst(canvas.width / 2, canvas.height / 2, 90);
        }, 180);

        return () => clearTimeout(timeout);
      }
    }
  }, [active, spawnBurst]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
      aria-hidden="true"
    />
  );
}
