import React, { useEffect, useRef, useState } from 'react';
import { MapData } from '../types/game';
import { RadarTelemetry } from '../engine/gameEngine';
import { Maximize2, Navigation, Radio, X, MapPin } from 'lucide-react';

interface TacticalMiniMapProps {
  mapData: MapData;
  radar: RadarTelemetry | null;
  onOpenFullMap: () => void;
  onPlacePing: (x: number, z: number) => void;
}

export const TacticalMiniMap: React.FC<TacticalMiniMapProps> = ({
  mapData,
  radar,
  onOpenFullMap,
  onPlacePing
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotateWithPlayer, setRotateWithPlayer] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1.85);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !radar) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = 176;
    const height = 176;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = width / 2;
    const cy = height / 2;
    const scale = rotateWithPlayer ? zoomLevel : zoomLevel * 0.78;

    // 1. Radar Background
    ctx.fillStyle = '#040914';
    ctx.fillRect(0, 0, width, height);

    const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, cx);
    grad.addColorStop(0, 'rgba(6, 182, 212, 0.14)');
    grad.addColorStop(0.7, 'rgba(15, 23, 42, 0.55)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Range rings
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.14)';
    ctx.lineWidth = 1;
    [28, 56, 80].forEach(r => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Transform coordinate space into Map World Space centered on the Player
    // In Three.js: playerYaw = 0 looks along -Z (North, -Y on canvas).
    // Turning Left increases playerYaw (+CCW in 3D), so rotating the map Clockwise (+playerYaw)
    // keeps whatever the player is looking at straight UP (-Y) at the top of the radar!
    ctx.save();
    ctx.translate(cx, cy);
    if (rotateWithPlayer) {
      ctx.rotate(radar.playerYaw);
    }
    ctx.scale(scale, scale);
    ctx.translate(-radar.playerX, -radar.playerZ);

    // 2. Map Floor Boundary (-54 to 54)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fillRect(-52, -52, 104, 104);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.2 / scale;
    ctx.strokeRect(-52, -52, 104, 104);

    // Tactical Grid Lines in World Space
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.32)';
    ctx.lineWidth = 0.6 / scale;
    for (let g = -40; g <= 40; g += 20) {
      ctx.beginPath();
      ctx.moveTo(g, -52);
      ctx.lineTo(g, 52);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-52, g);
      ctx.lineTo(52, g);
      ctx.stroke();
    }

    // 3. Draw Bomb Sites A & B
    const drawSite = (site: { x: number; z: number; radius: number }, color: string, fill: string) => {
      ctx.fillStyle = fill;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / scale;
      ctx.beginPath();
      ctx.arc(site.x, site.z, site.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    drawSite(mapData.siteA, 'rgba(34, 211, 238, 0.95)', 'rgba(34, 211, 238, 0.22)');
    drawSite(mapData.siteB, 'rgba(245, 158, 11, 0.95)', 'rgba(245, 158, 11, 0.22)');

    // 4. Draw Map Architecture (Walls, Buildings, Containers, Barrels)
    for (const w of radar.walls) {
      const rw = w.maxX - w.minX;
      const rz = w.maxZ - w.minZ;
      if (rw > 115 || rz > 115) continue;

      if (w.isExplosiveBarrel) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(w.minX, w.minZ, rw, rz);
      } else if (w.isWall) {
        ctx.fillStyle = 'rgba(71, 85, 105, 0.9)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.8)';
        ctx.lineWidth = 0.7 / scale;
        ctx.fillRect(w.minX, w.minZ, rw, rz);
        ctx.strokeRect(w.minX, w.minZ, rw, rz);
      } else {
        ctx.fillStyle = 'rgba(30, 58, 138, 0.7)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 0.6 / scale;
        ctx.fillRect(w.minX, w.minZ, rw, rz);
        ctx.strokeRect(w.minX, w.minZ, rw, rz);
      }
    }

    // 5. Draw Active Ability Zones (Smokes, Fire, Sonar, Ice Walls)
    for (const ab of radar.abilities) {
      ctx.beginPath();
      ctx.arc(ab.x, ab.z, 4.2, 0, Math.PI * 2);
      if (ab.team === 'alpha') {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      } else {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      }
      ctx.lineWidth = 1 / scale;
      ctx.fill();
      ctx.stroke();
    }

    // 6. Site Labels (counter-rotated by -playerYaw so text always stays upright)
    const drawUprightText = (wx: number, wz: number, text: string, color: string, fontSize = 10) => {
      ctx.save();
      ctx.translate(wx, wz);
      if (rotateWithPlayer) {
        ctx.rotate(-radar.playerYaw);
      }
      ctx.scale(1 / scale, 1 / scale);
      ctx.font = `900 ${fontSize}px "Chakra Petch", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };

    drawUprightText(mapData.siteA.x, mapData.siteA.z, 'A', '#22d3ee', 12);
    drawUprightText(mapData.siteB.x, mapData.siteB.z, 'B', '#fbbf24', 12);

    // 7. Planted Nexus Core Pulse
    if (radar.spikePosition) {
      const pulse = 2.5 + Math.sin(Date.now() * 0.01) * 1.4;
      ctx.beginPath();
      ctx.arc(radar.spikePosition.x, radar.spikePosition.z, pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.fill();
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1.5 / scale;
      ctx.stroke();
      drawUprightText(radar.spikePosition.x, radar.spikePosition.z, '!', '#ffffff', 11);
    }

    // 8. Tactical Pings
    for (const ping of radar.pings) {
      const age = (Date.now() - ping.createdAt) / 1000;
      const ringRadius = 1.5 + (age * 4) % 5.5;
      ctx.beginPath();
      ctx.arc(ping.x, ping.z, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
      ctx.lineWidth = 1.4 / scale;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ping.x, ping.z, 1.4, 0, Math.PI * 2);
      ctx.fillStyle = '#00f0ff';
      ctx.fill();
    }

    // 9. Draw Operatives (Allies & Spotted Enemies)
    for (const blip of radar.blips) {
      if (blip.isPlayer) continue;
      if (!blip.isSpotted && blip.team !== 'alpha') continue;

      if (!blip.isAlive) {
        if (blip.team === 'alpha') {
          drawUprightText(blip.x, blip.z, '×', 'rgba(148, 163, 184, 0.65)', 11);
        }
        continue;
      }

      ctx.save();
      ctx.translate(blip.x, blip.z);

      if (blip.team === 'alpha') {
        // Allied operative directional tick (bots face +Z when yaw=0, which is Math.PI - blip.yaw on canvas)
        ctx.save();
        ctx.rotate(Math.PI - blip.yaw);
        ctx.beginPath();
        ctx.moveTo(0, -3.4);
        ctx.lineTo(-1.8, 1.2);
        ctx.lineTo(1.8, 1.2);
        ctx.closePath();
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(0, 0, 2.1, 0, Math.PI * 2);
        ctx.fillStyle = '#0ea5e9';
        ctx.fill();
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 0.8 / scale;
        ctx.stroke();
      } else {
        // Spotted Enemy threat diamond
        ctx.save();
        if (rotateWithPlayer) ctx.rotate(-radar.playerYaw);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#fecaca';
        ctx.lineWidth = 0.9 / scale;
        ctx.fillRect(-2.1, -2.1, 4.2, 4.2);
        ctx.strokeRect(-2.1, -2.1, 4.2, 4.2);
        ctx.restore();
      }

      ctx.restore();
    }

    // 10. Draw Player Vision Cone & Arrow at (playerX, playerZ)
    // In world space, player looks along (-sin(playerYaw), -cos(playerYaw)), which is rotation -playerYaw
    ctx.save();
    ctx.translate(radar.playerX, radar.playerZ);
    ctx.rotate(-radar.playerYaw);

    // Vision FOV Cone (looking along -Y / North in local arrow space)
    const coneGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, 24);
    coneGrad.addColorStop(0, 'rgba(0, 240, 255, 0.42)');
    coneGrad.addColorStop(1, 'rgba(0, 240, 255, 0.0)');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 24, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
    ctx.closePath();
    ctx.fill();

    // Player Chevron Arrow
    ctx.beginPath();
    ctx.moveTo(0, -3.8);
    ctx.lineTo(2.7, 2.7);
    ctx.lineTo(0, 1.3);
    ctx.lineTo(-2.7, 2.7);
    ctx.closePath();
    ctx.fillStyle = '#00f0ff';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.9 / scale;
    ctx.stroke();

    ctx.restore();
    ctx.restore(); // End world space transform

    // 11. Draw Rotating Cardinal N/E/S/W Bezel Indicators
    const cardinals = [
      { label: 'N', angle: -Math.PI / 2, color: '#22d3ee' },
      { label: 'E', angle: 0, color: '#94a3b8' },
      { label: 'S', angle: Math.PI / 2, color: '#94a3b8' },
      { label: 'W', angle: Math.PI, color: '#94a3b8' }
    ];
    const yawOffset = rotateWithPlayer ? radar.playerYaw : 0;
    cardinals.forEach(c => {
      const a = c.angle + yawOffset;
      const rx = cx + Math.cos(a) * (cx - 10);
      const ry = cy + Math.sin(a) * (cy - 10);
      ctx.font = '900 9px "JetBrains Mono", monospace';
      ctx.fillStyle = c.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.label, rx, ry);
    });

    ctx.restore();
  }, [radar, mapData, rotateWithPlayer, zoomLevel]);

  // Allow clicking directly on the mini-map to ping that exact world coordinate
  const handleMiniMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!radar || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left - rect.width / 2;
    const py = e.clientY - rect.top - rect.height / 2;

    const scale = rotateWithPlayer ? zoomLevel : zoomLevel * 0.78;
    let dx = px / scale;
    let dz = py / scale;

    if (rotateWithPlayer) {
      // Inverse of ctx.rotate(+playerYaw) is rotating by -playerYaw
      const cos = Math.cos(-radar.playerYaw);
      const sin = Math.sin(-radar.playerYaw);
      const rx = dx * cos - dz * sin;
      const rz = dx * sin + dz * cos;
      dx = rx;
      dz = rz;
    }

    const worldX = Math.max(-50, Math.min(50, radar.playerX + dx));
    const worldZ = Math.max(-50, Math.min(50, radar.playerZ + dz));
    onPlacePing(worldX, worldZ);
  };

  return (
    <div className="flex flex-col gap-1.5 pointer-events-auto select-none">
      {/* Radar Frame */}
      <div className="relative w-[176px] h-[176px] rounded-2xl bg-slate-950/90 border-2 border-cyan-500/50 shadow-[0_0_25px_rgba(0,240,255,0.2)] overflow-hidden group">
        <canvas
          ref={canvasRef}
          onClick={handleMiniMapClick}
          title="Click anywhere on Mini-Map to Ping location • Press [M] for Full Tactical Map"
          className="w-full h-full cursor-crosshair block"
        />

        {/* Corner HUD Brackets */}
        <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
        <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
        <div className="absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
        <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

        {/* Radar Quick Controls Overlay */}
        <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRotateWithPlayer(!rotateWithPlayer);
            }}
            className="px-1.5 py-0.5 rounded bg-slate-950/85 border border-slate-700 hover:border-cyan-400 text-[9px] font-mono font-bold text-cyan-300 flex items-center gap-1 transition-all cursor-pointer"
            title="Toggle Rotating vs Fixed North-Up Radar"
          >
            <Navigation className="w-2.5 h-2.5" />
            {rotateWithPlayer ? 'ROT' : 'N-UP'}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setZoomLevel(prev => (prev > 2.1 ? 1.35 : prev + 0.45));
            }}
            className="px-1.5 py-0.5 rounded bg-slate-950/85 border border-slate-700 hover:border-cyan-400 text-[9px] font-mono font-bold text-slate-300 transition-all cursor-pointer tabular-nums"
            title="Cycle Radar Zoom"
          >
            {zoomLevel.toFixed(1)}x
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenFullMap();
            }}
            className="px-1.5 py-0.5 rounded bg-cyan-500/25 border border-cyan-400/70 hover:bg-cyan-500/40 text-[9px] font-mono font-bold text-cyan-200 flex items-center gap-0.5 transition-all cursor-pointer"
            title="Open Full Tactical Command Map [M]"
          >
            <Maximize2 className="w-2.5 h-2.5" />
            <span>MAP</span>
          </button>
        </div>
      </div>

      {/* Live Sector Callout Bar */}
      <div className="w-[176px] bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-1.5 flex flex-col gap-0.5 shadow-lg backdrop-blur-xs">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono tracking-widest uppercase text-slate-400 flex items-center gap-1">
            <Radio className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
            SECTOR
          </span>
          <span className="text-[9px] font-mono text-cyan-400 font-bold truncate max-w-[96px]">
            {mapData.name.toUpperCase()}
          </span>
        </div>
        <div className="text-xs font-bold tracking-wider text-white uppercase truncate">
          {radar?.currentCallout || 'ATTACKER SPAWN'}
        </div>
      </div>
    </div>
  );
};

interface TacticalFullMapModalProps {
  isOpen: boolean;
  mapData: MapData;
  radar: RadarTelemetry | null;
  onClose: () => void;
  onPlacePing: (x: number, z: number) => void;
}

export const TacticalFullMapModal: React.FC<TacticalFullMapModalProps> = ({
  isOpen,
  mapData,
  radar,
  onClose,
  onPlacePing
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen || !radar || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 540;
    if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const scale = 4.6;

    // Dark blueprint background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, size, size);

    // Blueprint grid
    ctx.strokeStyle = 'rgba(30, 58, 138, 0.35)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= size; x += 27) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, x);
      ctx.lineTo(size, x);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Outer tactical perimeter
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeRect(-52, -52, 104, 104);

    // Spawn Zones
    ctx.fillStyle = 'rgba(6, 182, 212, 0.14)';
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
    ctx.beginPath();
    ctx.arc(mapData.attackerSpawn.x, mapData.attackerSpawn.z, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.beginPath();
    ctx.arc(mapData.defenderSpawn.x, mapData.defenderSpawn.z, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bomb Sites A & B
    ctx.fillStyle = 'rgba(34, 211, 238, 0.24)';
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2 / scale;
    ctx.beginPath();
    ctx.arc(mapData.siteA.x, mapData.siteA.z, mapData.siteA.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(245, 158, 11, 0.24)';
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(mapData.siteB.x, mapData.siteB.z, mapData.siteB.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Walls & Buildings
    for (const w of radar.walls) {
      const rw = w.maxX - w.minX;
      const rz = w.maxZ - w.minZ;
      if (rw > 115 || rz > 115) continue;

      if (w.isExplosiveBarrel) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(w.minX, w.minZ, rw, rz);
      } else if (w.isWall) {
        ctx.fillStyle = 'rgba(51, 65, 85, 0.92)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.85)';
        ctx.lineWidth = 1 / scale;
        ctx.fillRect(w.minX, w.minZ, rw, rz);
        ctx.strokeRect(w.minX, w.minZ, rw, rz);
      } else {
        ctx.fillStyle = 'rgba(30, 64, 175, 0.72)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 0.9 / scale;
        ctx.fillRect(w.minX, w.minZ, rw, rz);
        ctx.strokeRect(w.minX, w.minZ, rw, rz);
      }
    }

    // Active Abilities
    for (const ab of radar.abilities) {
      ctx.beginPath();
      ctx.arc(ab.x, ab.z, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = ab.team === 'alpha' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(239, 68, 68, 0.35)';
      ctx.strokeStyle = ab.team === 'alpha' ? '#38bdf8' : '#ef4444';
      ctx.lineWidth = 1.5 / scale;
      ctx.fill();
      ctx.stroke();
    }

    // Callout Labels
    const drawLabel = (wx: number, wz: number, text: string, color = '#cbd5e1', sizePx = 10, bg = true) => {
      ctx.save();
      ctx.translate(wx, wz);
      ctx.scale(1 / scale, 1 / scale);
      ctx.font = `800 ${sizePx}px "Chakra Petch", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (bg) {
        const metrics = ctx.measureText(text);
        const padX = 5;
        const padY = 3;
        ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
        ctx.fillRect(-metrics.width / 2 - padX, -sizePx / 2 - padY, metrics.width + padX * 2, sizePx + padY * 2);
      }
      ctx.fillStyle = color;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };

    for (const callout of mapData.callouts) {
      drawLabel(callout.x, callout.z, callout.name.toUpperCase(), '#e2e8f0', 10, true);
    }

    drawLabel(mapData.siteA.x, mapData.siteA.z - 2.5, 'SITE A', '#22d3ee', 14, true);
    drawLabel(mapData.siteB.x, mapData.siteB.z - 2.5, 'SITE B', '#fbbf24', 14, true);

    // Planted Nexus Core
    if (radar.spikePosition) {
      ctx.beginPath();
      ctx.arc(radar.spikePosition.x, radar.spikePosition.z, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.65)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / scale;
      ctx.stroke();
      drawLabel(radar.spikePosition.x, radar.spikePosition.z - 4, 'NEXUS ARMED', '#fca5a5', 11, true);
    }

    // Tactical Pings
    for (const ping of radar.pings) {
      ctx.beginPath();
      ctx.arc(ping.x, ping.z, 3.2, 0, Math.PI * 2);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2 / scale;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ping.x, ping.z, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = '#00f0ff';
      ctx.fill();
      drawLabel(ping.x, ping.z - 3.6, ping.label, '#00f0ff', 10, true);
    }

    // Operatives
    for (const blip of radar.blips) {
      if (!blip.isAlive) continue;
      if (!blip.isPlayer && blip.team !== 'alpha' && !blip.isSpotted) continue;

      ctx.save();
      ctx.translate(blip.x, blip.z);

      // View cone for player (camera forward is -Z when yaw=0, rotating by -blip.yaw on North-Up canvas)
      if (blip.isPlayer) {
        ctx.save();
        ctx.rotate(-blip.yaw);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.28)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 15, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(0, 0, blip.isPlayer ? 2.4 : 1.9, 0, Math.PI * 2);
      ctx.fillStyle = blip.isPlayer ? '#00f0ff' : blip.team === 'alpha' ? '#38bdf8' : '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2 / scale;
      ctx.stroke();

      ctx.restore();

      const fsmShort = blip.fsmState
        ? blip.fsmState === 'FLANK_ROUTE'
          ? 'FLANK'
          : blip.fsmState === 'DEFENSIVE_CAMP'
          ? 'CAMP'
          : blip.fsmState === 'COORDINATED_EXECUTE'
          ? 'EXEC'
          : blip.fsmState === 'COMBAT_ENGAGE'
          ? 'FIGHT'
          : blip.fsmState === 'TACTICAL_RETREAT'
          ? 'COVER'
          : blip.fsmState === 'PLANT_OBJECTIVE'
          ? 'PLANT'
          : blip.fsmState === 'RETAKE_AND_DEFUSE'
          ? 'DEFUSE'
          : blip.fsmState === 'POST_PLANT_HOLD'
          ? 'HOLD'
          : 'ADV'
        : '';

      drawLabel(
        blip.x,
        blip.z + 3.2,
        blip.isPlayer
          ? 'YOU'
          : blip.team === 'alpha' && fsmShort
          ? `${blip.name} [${fsmShort}]`
          : blip.name,
        blip.team === 'alpha' ? '#7dd3fc' : '#fca5a5',
        9,
        true
      );
    }

    ctx.restore();
    ctx.restore();
  }, [isOpen, radar, mapData]);

  if (!isOpen) return null;

  const handleCanvasPing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 540 / rect.width;
    const scaleY = 540 / rect.height;
    const px = (e.clientX - rect.left) * scaleX - 270;
    const py = (e.clientY - rect.top) * scaleY - 270;

    const worldX = Math.max(-50, Math.min(50, px / 4.6));
    const worldZ = Math.max(-50, Math.min(50, py / 4.6));
    onPlacePing(worldX, worldZ);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none font-chakra">
      <div className="bg-slate-900/95 border-2 border-cyan-500/50 rounded-2xl max-w-4xl w-full p-5 shadow-[0_0_50px_rgba(0,240,255,0.25)] flex flex-col md:flex-row gap-5">
        {/* Left: Interactive Map Blueprint Canvas */}
        <div className="relative flex-1 flex items-center justify-center bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasPing}
            className="w-full max-w-[520px] aspect-square cursor-crosshair block"
          />
          <div className="absolute top-3 left-3 bg-slate-950/85 border border-cyan-500/40 rounded-md px-2.5 py-1 text-[11px] font-mono text-cyan-300 flex items-center gap-1.5 pointer-events-none">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>CLICK ANYWHERE ON MAP TO PING SECTOR</span>
          </div>
        </div>

        {/* Right: Tactical Legend & Callout Telemetry */}
        <div className="w-full md:w-64 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-[10px] font-mono text-cyan-400 tracking-widest uppercase">
                  {mapData.codename} • SATELLITE UPLINK
                </div>
                <h2 className="text-xl font-bold text-white uppercase tracking-wide">
                  {mapData.name}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase">
                YOUR CURRENT SECTOR
              </span>
              <span className="text-base font-bold text-cyan-300 uppercase">
                {radar?.currentCallout || 'TRANSIT'}
              </span>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                POS: X {radar?.playerX.toFixed(0)}m / Z {radar?.playerZ.toFixed(0)}m
              </span>
            </div>

            {/* Map Legend */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 text-xs">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-0.5">
                TACTICAL LEGEND
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block border border-white" />
                <span>You & Vision Cone</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <span className="w-3 h-3 rounded-full bg-sky-500 inline-block border border-sky-200" />
                <span>Alpha Team Operatives</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <span className="w-3 h-3 rotate-45 bg-red-500 inline-block border border-red-200" />
                <span>Spotted Omega Hostiles</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <span className="w-3 h-3 rounded-full bg-cyan-500/40 border border-cyan-400 inline-block" />
                <span>Site A Objective Zone</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <span className="w-3 h-3 rounded-full bg-amber-500/40 border border-amber-400 inline-block" />
                <span>Site B Objective Zone</span>
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <span className="w-3 h-3 bg-red-500 inline-block rounded-xs" />
                <span>Explosive Hazard Barrels</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold uppercase tracking-wider text-sm transition-all cursor-pointer"
          >
            RESUME COMBAT [M / ESC]
          </button>
        </div>
      </div>
    </div>
  );
};
