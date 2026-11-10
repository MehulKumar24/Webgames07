import * as THREE from 'three';

// High-Detail Procedural Canvas Texture Generators with PBR Surface Microstructure

const textureCache = new Map<string, THREE.Texture>();
const bumpTextureCache = new WeakMap<THREE.Texture, THREE.Texture>();

export function createBumpTexture(texture: THREE.Texture): THREE.Texture {
  const cached = bumpTextureCache.get(texture);
  if (cached) return cached;

  const bumpTexture = texture.clone();
  bumpTexture.colorSpace = THREE.NoColorSpace;
  bumpTexture.anisotropy = 8;
  bumpTexture.needsUpdate = true;
  bumpTextureCache.set(texture, bumpTexture);
  return bumpTexture;
}

export function getProceduralTexture(type: string, options: Record<string, unknown> = {}): THREE.Texture {
  const cacheKey = `${type}_${JSON.stringify(options)}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  switch (type) {
    case 'asphalt_wet': {
      // Balanced mid-slate urban asphalt with micro-gravel, subtle sheen, and lane markings
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, 512, 512);

      // Gravel aggregate speckles
      for (let i = 0; i < 14000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const lum = Math.floor(46 + Math.random() * 34);
        ctx.fillStyle = `rgb(${lum},${lum + 4},${lum + 10})`;
        ctx.fillRect(x, y, 1.5, 1.5);
      }

      // Asphalt tar seams & hairline cracks
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
      ctx.lineWidth = 2;
      for (let c = 0; c < 6; c++) {
        ctx.beginPath();
        let cx = Math.random() * 512;
        let cy = 0;
        ctx.moveTo(cx, cy);
        while (cy < 512) {
          cy += 32;
          cx += (Math.random() - 0.5) * 18;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }

      // Wet reflective puddles (balanced contrast, no dark black holes)
      for (let i = 0; i < 12; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const r = 24 + Math.random() * 44;
        const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
        grad.addColorStop(0.5, 'rgba(30, 41, 59, 0.25)');
        grad.addColorStop(1, 'rgba(30, 41, 59, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Road lane markings
      if (options.roadLine) {
        ctx.fillStyle = '#eab308';
        ctx.fillRect(242, 0, 10, 512);
        ctx.fillRect(260, 0, 10, 512);
        for (let i = 0; i < 650; i++) {
          ctx.fillStyle = '#14171f';
          ctx.fillRect(240 + Math.random() * 32, Math.random() * 512, 2, 2);
        }
      }
      break;
    }

    case 'concrete_panels': {
      // Architectural precast concrete panels with bevel seams, rebar stains, and tie-holes
      ctx.fillStyle = options.color ? (options.color as string) : '#4b5563';
      ctx.fillRect(0, 0, 512, 512);

      const imgData = ctx.getImageData(0, 0, 512, 512);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 26;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      }
      ctx.putImageData(imgData, 0, 0);

      // Weathering vertical streaks
      for (let x = 0; x < 512; x += 16) {
        ctx.fillStyle = `rgba(15, 23, 42, ${Math.random() * 0.14})`;
        ctx.fillRect(x, 0, 8, 512);
      }

      // Panel bevel highlights & shadow seams
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 6, 246, 246);
      ctx.strokeRect(260, 6, 246, 246);
      ctx.strokeRect(6, 260, 246, 246);
      ctx.strokeRect(260, 260, 246, 246);

      ctx.strokeStyle = 'rgba(15, 20, 30, 0.8)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, 252, 252);
      ctx.strokeRect(256, 2, 252, 252);
      ctx.strokeRect(2, 256, 252, 252);
      ctx.strokeRect(256, 256, 252, 252);

      // Form-tie indents
      const holes = [
        [28, 28], [228, 28], [28, 228], [228, 228],
        [284, 28], [484, 28], [284, 228], [484, 228],
        [28, 284], [228, 284], [28, 484], [228, 484],
        [284, 284], [484, 284], [284, 484], [484, 484]
      ];
      holes.forEach(([hx, hy]) => {
        ctx.fillStyle = 'rgba(10, 14, 22, 0.9)';
        ctx.beginPath();
        ctx.arc(hx, hy, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      break;
    }

    case 'container_ribs': {
      // Corrugated metal shipping container side panels with stenciled ISO markings
      const baseColor = (options.color as string) || '#0284c7';
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, 512, 512);

      const ribWidth = 28;
      for (let x = 0; x < 512; x += ribWidth) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(x, 0, 5, 512);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.fillRect(x + 5, 0, ribWidth - 12, 512);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        ctx.fillRect(x + ribWidth - 7, 0, 7, 512);
      }

      // Scuff marks & edge wear
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.fillRect(0, 470, 512, 42);
      ctx.fillRect(0, 0, 512, 24);

      ctx.font = '900 22px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText('APEX-MARITIME // 45G1', 34, 76);
      ctx.font = '700 16px monospace';
      ctx.fillText('TARE: 3,800 KG | PAYLOAD: 28,700 KG', 34, 104);
      break;
    }

    case 'hazard_stripes': {
      ctx.fillStyle = '#eab308';
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = '#0f172a';
      const stripeW = 40;
      for (let x = -512; x < 1024; x += stripeW * 2) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + stripeW, 0);
        ctx.lineTo(x + stripeW - 256, 512);
        ctx.lineTo(x - 256, 512);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    case 'cyber_billboard': {
      const hue = (options.hue as number) || 190;
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, 512, 512);

      ctx.strokeStyle = `hsl(${hue}, 100%, 65%)`;
      ctx.lineWidth = 12;
      ctx.strokeRect(16, 16, 480, 480);

      ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.1)`;
      for (let y = 0; y < 512; y += 8) {
        ctx.fillRect(0, y, 512, 4);
      }

      ctx.fillStyle = `hsl(${hue}, 100%, 75%)`;
      ctx.font = '900 46px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((options.text as string) || 'NEO NEXUS', 256, 215);

      ctx.font = '700 22px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText((options.subtext as string) || 'CYBERNETIC DEFENSE', 256, 275);

      ctx.fillStyle = `hsl(${(hue + 60) % 360}, 100%, 65%)`;
      ctx.fillRect(136, 305, 240, 8);
      break;
    }

    case 'building_facade': {
      const baseColor = (options.color as string) || '#3b495e';
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, 512, 512);

      // Structural concrete columns & floor spandrels
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      for (let r = 0; r < 8; r++) {
        ctx.fillRect(0, r * 64, 512, 8);
      }

      const rows = 8;
      const cols = 6;
      const winW = 46;
      const winH = 38;
      const gapX = 38;
      const gapY = 26;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = 32 + c * (winW + gapX);
          const wy = 18 + r * (winH + gapY);

          ctx.fillStyle = '#1e293b';
          ctx.fillRect(wx - 3, wy - 3, winW + 6, winH + 6);

          const isLit = (r * 5 + c * 7) % 6 < 3;
          if (isLit) {
            const warmOrCool = (r + c) % 2 === 0 ? 'rgb(254, 240, 195)' : 'rgb(186, 230, 253)';
            ctx.fillStyle = warmOrCool;
            ctx.fillRect(wx, wy, winW, winH);
            ctx.fillStyle = 'rgba(30, 41, 59, 0.35)';
            ctx.fillRect(wx, wy, winW, 10);
          } else {
            ctx.fillStyle = '#2d3d52';
            ctx.fillRect(wx, wy, winW, winH);
          }
        }
      }
      break;
    }

    case 'sandstone_weathered': {
      // Desert canyon sandstone & sun-baked strata for Dustfall
      ctx.fillStyle = (options.color as string) || '#c89666';
      ctx.fillRect(0, 0, 512, 512);

      for (let y = 0; y < 512; y += 12) {
        const wave = Math.sin(y * 0.04) * 14;
        ctx.fillStyle = `rgba(120, 72, 38, ${0.16 + Math.abs(wave) * 0.008})`;
        ctx.fillRect(0, y, 512, 6 + Math.random() * 8);
      }

      for (let i = 0; i < 14000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#fef3c7' : '#9a6b44';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.6, 1.6);
      }
      break;
    }

    case 'glacier_ice': {
      // Sub-zero Arctic snow & crystalline glacier ice with soft anti-glare blue-grey tone
      ctx.fillStyle = (options.color as string) || '#b8d0e8';
      ctx.fillRect(0, 0, 512, 512);

      // Ice crystalline patches
      for (let i = 0; i < 24; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const r = 30 + Math.random() * 60;
        const grad = ctx.createRadialGradient(x, y, 4, x, y, r);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
        grad.addColorStop(1, 'rgba(203, 213, 225, 0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Frost fracture lines
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        let x = Math.random() * 512;
        let y = Math.random() * 512;
        ctx.moveTo(x, y);
        for (let s = 0; s < 5; s++) {
          x += (Math.random() - 0.5) * 90;
          y += (Math.random() - 0.5) * 90;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }

    case 'industrial_diamond_plate': {
      // Maritime steel deck with diamond tread and weathered rivets for Black Harbor
      ctx.fillStyle = (options.color as string) || '#475569';
      ctx.fillRect(0, 0, 512, 512);

      ctx.strokeStyle = 'rgba(203, 213, 225, 0.28)';
      ctx.lineWidth = 2;
      for (let y = 16; y < 512; y += 32) {
        for (let x = 16; x < 512; x += 32) {
          ctx.beginPath();
          ctx.moveTo(x - 6, y);
          ctx.lineTo(x + 6, y);
          ctx.moveTo(x, y - 6);
          ctx.lineTo(x, y + 6);
          ctx.stroke();
        }
      }

      // Rust/saltwater weathering along plate seams
      ctx.strokeStyle = 'rgba(180, 83, 9, 0.32)';
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, 504, 504);
      break;
    }

    case 'overgrown_stone': {
      // Ancient temple stone fused with lush moss & roots for Verdant
      ctx.fillStyle = (options.color as string) || '#4d6645';
      ctx.fillRect(0, 0, 512, 512);

      // Stone block masonry seams
      ctx.strokeStyle = 'rgba(30, 45, 28, 0.55)';
      ctx.lineWidth = 5;
      for (let y = 0; y < 512; y += 128) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
        const offset = (y / 128) % 2 === 0 ? 0 : 128;
        for (let x = offset; x < 512; x += 256) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 128);
          ctx.stroke();
        }
      }

      // Moss & lichen clusters
      for (let i = 0; i < 65; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const r = 10 + Math.random() * 28;
        ctx.fillStyle = Math.random() > 0.3 ? 'rgba(74, 222, 128, 0.25)' : 'rgba(132, 204, 22, 0.3)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    default:
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, 512, 512);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;

  textureCache.set(cacheKey, texture);
  return texture;
}
