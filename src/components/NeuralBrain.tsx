import { useEffect, useRef } from "react";

export function NeuralBrain({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 500);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 500);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener("resize", handleResize);

    // Generate brain shape nodes inside an ellipse/brain outline
    const numNodes = 75;
    const nodes: {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      vx: number;
      vy: number;
      radius: number;
      pulse: number;
      pulseSpeed: number;
    }[] = [];

    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < numNodes; i++) {
      // Approximate brain shape coordinates using oval + lobes offset
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random();
      
      // Elliptical distribution for brain shape
      let rx = Math.cos(angle) * (width * 0.32) * Math.sqrt(r);
      let ry = Math.sin(angle) * (height * 0.28) * Math.sqrt(r);

      // Slight indentation at bottom center for brain stem/cerebellum shape
      if (ry > 20 && Math.abs(rx) < 40) {
        ry *= 0.6;
      }

      const x = centerX + rx;
      const y = centerY + ry;

      nodes.push({
        x,
        y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1.5,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
      });
    }

    // Glowing background particles (ambient stars)
    const bgParticles: { x: number; y: number; alpha: number; speed: number; size: number }[] = [];
    for (let i = 0; i < 40; i++) {
      bgParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        alpha: Math.random() * 0.5 + 0.1,
        speed: Math.random() * 0.3 + 0.1,
        size: Math.random() * 1.5 + 0.5,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw background ambient particle stars
      bgParticles.forEach((p) => {
        p.y -= p.speed;
        if (p.y < 0) {
          p.y = height;
          p.x = Math.random() * width;
        }
        ctx.fillStyle = `rgba(234, 179, 8, ${p.alpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Central radiant golden glow
      const radialGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        20,
        centerX,
        centerY,
        width * 0.45
      );
      radialGlow.addColorStop(0, "rgba(234, 179, 8, 0.22)");
      radialGlow.addColorStop(0.5, "rgba(202, 138, 4, 0.08)");
      radialGlow.addColorStop(1, "rgba(8, 8, 10, 0)");

      ctx.fillStyle = radialGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, width * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Update and draw nodes
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;

        // Keep near origin
        const distFromBaseSq = (node.x - node.baseX) ** 2 + (node.y - node.baseY) ** 2;
        if (distFromBaseSq > 400) {
          node.vx *= -1;
          node.vy *= -1;
        }

        node.pulse += node.pulseSpeed;
      });

      // Draw connecting lines (synapses)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const maxDist = 85;
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.35;
            
            // Create gradient line for golden synaptic effect
            const lineGrad = ctx.createLinearGradient(n1.x, n1.y, n2.x, n2.y);
            lineGrad.addColorStop(0, `rgba(253, 224, 71, ${alpha})`);
            lineGrad.addColorStop(1, `rgba(202, 138, 4, ${alpha * 0.6})`);

            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach((node) => {
        const pulseAlpha = (Math.sin(node.pulse) + 1) / 2;
        const currentRadius = node.radius + pulseAlpha * 1.2;

        // Outer glow
        ctx.fillStyle = `rgba(234, 179, 8, ${0.3 + pulseAlpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, currentRadius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright node core
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(node.x, node.y, currentRadius * 0.8, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
