import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MatchPlayer, MapData, GameMode } from '../types/game';
import { AGENTS } from '../data/agents';
import { createCharacterBotModel } from '../engine/proceduralModels';
import { soundEngine } from '../audio/soundEngine';
import { Trophy, Crosshair, Skull, RotateCcw, Home, Award, Shield } from 'lucide-react';

interface MatchSummaryScreenProps {
  allPlayers: MatchPlayer[];
  alphaScore: number;
  omegaScore: number;
  mapData: MapData;
  gameMode: GameMode;
  onPlayAgain: () => void;
  onReturnToMenu: () => void;
}

function getTopTeamPlayer(players: MatchPlayer[], team: 'alpha' | 'omega'): MatchPlayer {
  const teamPlayers = players.filter(p => p.team === team);
  if (teamPlayers.length === 0) {
    return {
      id: `fallback_${team}`,
      name: team === 'alpha' ? 'VORTEX [ALPHA]' : 'KAGE [OMEGA]',
      agentId: team === 'alpha' ? 'agent_vortex' : 'agent_kage',
      isBot: true,
      team,
      health: 100,
      maxHealth: 100,
      armor: 50,
      maxArmor: 50,
      credits: 2400,
      isAlive: true,
      isPlanting: false,
      isDefusing: false,
      ultPoints: 0,
      currentWeaponId: 'wpn_apexar',
      sidearmWeaponId: 'wpn_vector9',
      inventory: ['wpn_apexar'],
      abilityCooldowns: {},
      abilityCharges: {},
      stats: { kills: 0, deaths: 0, assists: 0, score: 0, headshots: 0, damageDealt: 0, plants: 0, defuses: 0 }
    };
  }

  return [...teamPlayers].sort((a, b) => {
    if (b.stats.kills !== a.stats.kills) return b.stats.kills - a.stats.kills;
    if (b.stats.headshots !== a.stats.headshots) return b.stats.headshots - a.stats.headshots;
    if (b.stats.score !== a.stats.score) return b.stats.score - a.stats.score;
    return b.stats.damageDealt - a.stats.damageDealt;
  })[0];
}

export const MatchSummaryScreen: React.FC<MatchSummaryScreenProps> = ({
  allPlayers,
  alphaScore,
  omegaScore,
  mapData,
  gameMode,
  onPlayAgain,
  onReturnToMenu
}) => {
  const showcaseMountRef = useRef<HTMLDivElement>(null);
  const [showFullScoreboard, setShowFullScoreboard] = useState(false);
  const rotationOffsetRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const lastPointerXRef = useRef<number>(0);

  const topAlpha = getTopTeamPlayer(allPlayers, 'alpha');
  const topOmega = getTopTeamPlayer(allPlayers, 'omega');

  const alphaAgent = AGENTS.find(a => a.id === topAlpha.agentId) || AGENTS[0];
  const omegaAgent = AGENTS.find(a => a.id === topOmega.agentId) || AGENTS[8];

  const winningTeam: 'alpha' | 'omega' | 'draw' =
    alphaScore > omegaScore ? 'alpha' : omegaScore > alphaScore ? 'omega' : 'draw';

  const matchMvp =
    topAlpha.stats.kills > topOmega.stats.kills ||
    (topAlpha.stats.kills === topOmega.stats.kills && topAlpha.stats.score >= topOmega.stats.score)
      ? topAlpha
      : topOmega;

  useEffect(() => {
    const container = showcaseMountRef.current;
    if (!container) return;

    while (container.children.length > 0) {
      container.removeChild(container.children[0]);
    }

    // Software WebGL detection per threejs skill guidelines
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(260, container.clientHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a12);
    scene.fog = new THREE.FogExp2(0x070a12, 0.045);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 60);
    camera.position.set(0, 1.55, 5.4);
    camera.lookAt(0, 1.15, 0);

    // Mandatory Studio Environment Map
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 3-Point Studio Lighting Rig
    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.4);
    keyLight.position.set(4, 7, 5);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const hemiFill = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.95);
    scene.add(hemiFill);

    const alphaRimLight = new THREE.PointLight(0x00f0ff, 3.2, 8);
    alphaRimLight.position.set(-2.4, 2.2, -1.5);
    scene.add(alphaRimLight);

    const omegaRimLight = new THREE.PointLight(0xef4444, 3.2, 8);
    omegaRimLight.position.set(2.4, 2.2, -1.5);
    scene.add(omegaRimLight);

    // Studio Floor & Dual Champion Podiums
    const floorGeom = new THREE.PlaneGeometry(24, 24);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0b0f19,
      roughness: 0.35,
      metalness: 0.6
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const createPodium = (x: number, accentHex: number, isMvp: boolean) => {
      const podGroup = new THREE.Group();
      podGroup.position.set(x, 0, 0);

      const baseCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 1.12, 0.18, 24),
        new THREE.MeshStandardMaterial({
          color: 0x161e2e,
          roughness: 0.25,
          metalness: 0.85
        })
      );
      baseCyl.position.y = 0.09;
      baseCyl.receiveShadow = true;
      podGroup.add(baseCyl);

      const neonRing = new THREE.Mesh(
        new THREE.RingGeometry(0.86, 0.94, 32),
        new THREE.MeshBasicMaterial({
          color: accentHex,
          side: THREE.DoubleSide
        })
      );
      neonRing.rotation.x = -Math.PI / 2;
      neonRing.position.y = 0.185;
      podGroup.add(neonRing);

      if (isMvp) {
        const outerHalo = new THREE.Mesh(
          new THREE.RingGeometry(1.06, 1.11, 32),
          new THREE.MeshBasicMaterial({
            color: 0xfacc15,
            side: THREE.DoubleSide
          })
        );
        outerHalo.rotation.x = -Math.PI / 2;
        outerHalo.position.y = 0.02;
        podGroup.add(outerHalo);
      }

      scene.add(podGroup);
      return podGroup;
    };

    createPodium(-1.35, 0x00f0ff, matchMvp.id === topAlpha.id);
    createPodium(1.35, 0xef4444, matchMvp.id === topOmega.id);

    // Create 3D Character Models for Top Alpha & Top Omega Players
    const alphaModel = createCharacterBotModel('alpha', alphaAgent.callsign, alphaAgent.gender);
    alphaModel.group.position.set(-1.35, 0.18, 0);
    alphaModel.group.rotation.y = 0.28;
    if (alphaModel.healthBarFill?.parent) {
      alphaModel.healthBarFill.parent.visible = false;
    }
    scene.add(alphaModel.group);

    const omegaModel = createCharacterBotModel('omega', omegaAgent.callsign, omegaAgent.gender);
    omegaModel.group.position.set(1.35, 0.18, 0);
    omegaModel.group.rotation.y = -0.28;
    if (omegaModel.healthBarFill?.parent) {
      omegaModel.healthBarFill.parent.visible = false;
    }
    scene.add(omegaModel.group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let isRunning = true;
    let frameId = 0;
    const clock = new THREE.Clock();

    const afterDraw = (cb: () => void) => {
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
        gl.flush();
        if (!sync) {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const poll = () => {
          if (!isRunning) return;
          const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } catch {
        frameId = window.setTimeout(cb, 80);
      }
    };

    const tick = () => {
      if (!isRunning) return;
      const t = clock.getElapsedTime();

      // Subtle heroic breathing & weapon pose animation
      const rotOffset = rotationOffsetRef.current;
      alphaModel.group.rotation.y = 0.28 + Math.sin(t * 0.7) * 0.12 + rotOffset;
      omegaModel.group.rotation.y = -0.28 - Math.sin(t * 0.7) * 0.12 + rotOffset;

      alphaModel.torso.position.y = (alphaAgent.gender === 'Female' ? 1.2 : 1.25) + Math.sin(t * 2.2) * 0.015;
      omegaModel.torso.position.y = (omegaAgent.gender === 'Female' ? 1.2 : 1.25) + Math.cos(t * 2.2) * 0.015;

      alphaModel.rightArm.rotation.x = -0.22 + Math.sin(t * 1.6) * 0.04;
      omegaModel.rightArm.rotation.x = -0.22 + Math.cos(t * 1.6) * 0.04;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    const onResize = () => {
      if (!container) return;
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(260, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      isRunning = false;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, [topAlpha.id, topOmega.id, alphaAgent, omegaAgent, matchMvp.id]);

  const alphaHsRate =
    topAlpha.stats.kills > 0
      ? Math.min(100, Math.round((topAlpha.stats.headshots / topAlpha.stats.kills) * 100))
      : 0;
  const omegaHsRate =
    topOmega.stats.kills > 0
      ? Math.min(100, Math.round((topOmega.stats.headshots / topOmega.stats.kills) * 100))
      : 0;

  return (
    <div className="relative w-full h-full bg-slate-950 text-slate-100 flex flex-col justify-between overflow-y-auto p-4 md:p-6">
      {/* Top Header: Match Outcome & Final Score */}
      <header className="w-full max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{mapData.name}</span>
            <span aria-hidden="true">·</span>
            <span>{gameMode.replace('_', ' ').toUpperCase()}</span>
            <span aria-hidden="true">·</span>
            <span>Post-Action Debrief</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight mt-0.5 text-white">
            {winningTeam === 'alpha'
              ? 'Alpha Squad Victory'
              : winningTeam === 'omega'
              ? 'Omega Vanguard Victory'
              : 'Tactical Stalemate'}
          </h1>
        </div>

        {/* Final Score Readout */}
        <div className="flex items-center gap-6 px-6 py-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-right">
            <span className="block text-xs text-cyan-400 font-medium">Alpha Squad</span>
            <span className="text-3xl font-mono font-bold text-white tabular-nums">{alphaScore}</span>
          </div>
          <span className="text-slate-600 font-mono text-xl">:</span>
          <div className="text-left">
            <span className="block text-xs text-red-400 font-medium">Omega Vanguard</span>
            <span className="text-3xl font-mono font-bold text-white tabular-nums">{omegaScore}</span>
          </div>
        </div>
      </header>

      {/* Center Stage: Top Players from Both Teams + 3D Character Model Showcase */}
      <main className="w-full max-w-6xl mx-auto my-auto py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Alpha Squad Top Operative Card */}
        <section className="lg:col-span-4 rounded-xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-medium text-cyan-400">
                Alpha Squad Top Operative
              </span>
              {matchMvp.id === topAlpha.id && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
                  <Trophy className="w-3.5 h-3.5" />
                  Match MVP
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold text-white tracking-tight">
              {topAlpha.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span className="text-cyan-300 font-medium">{alphaAgent.callsign}</span>
              <span aria-hidden="true">·</span>
              <span>{alphaAgent.role}</span>
              <span aria-hidden="true">·</span>
              <span>{alphaAgent.country}</span>
            </div>

            <p className="text-xs text-slate-400 italic mt-3 leading-relaxed">
              {alphaAgent.quote}
            </p>
          </div>

          {/* Primary Combat Telemetry: Total Kills & Headshots */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Skull className="w-3.5 h-3.5 text-cyan-400" />
                <span>Total Kills</span>
              </div>
              <div className="text-3xl font-mono font-bold text-white tabular-nums mt-1">
                {topAlpha.stats.kills}
              </div>
              <div className="text-[11px] font-mono text-slate-400 tabular-nums mt-0.5">
                {topAlpha.stats.deaths} Deaths · {topAlpha.stats.assists} Assists
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                <span>Headshots</span>
              </div>
              <div className="text-3xl font-mono font-bold text-amber-300 tabular-nums mt-1">
                {topAlpha.stats.headshots}
              </div>
              <div className="text-[11px] font-mono text-slate-400 tabular-nums mt-0.5">
                {alphaHsRate}% Headshot Ratio
              </div>
            </div>

            <div className="col-span-2 flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
              <span className="text-slate-400">Combat Score & Damage</span>
              <span className="font-mono font-semibold text-slate-200 tabular-nums">
                {topAlpha.stats.score} PTS · {topAlpha.stats.damageDealt} DMG
              </span>
            </div>
          </div>
        </section>

        {/* Center Column: Interactive 3D Character Model Showcase */}
        <section className="lg:col-span-4 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col min-h-[320px] relative">
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-200">3D Operative Showcase</span>
            <span>Drag horizontally to rotate</span>
          </div>

          <div
            ref={showcaseMountRef}
            onPointerDown={(e) => {
              isDraggingRef.current = true;
              lastPointerXRef.current = e.clientX;
            }}
            onPointerMove={(e) => {
              if (!isDraggingRef.current) return;
              const dx = e.clientX - lastPointerXRef.current;
              lastPointerXRef.current = e.clientX;
              rotationOffsetRef.current += dx * 0.012;
            }}
            onPointerUp={() => {
              isDraggingRef.current = false;
            }}
            onPointerLeave={() => {
              isDraggingRef.current = false;
            }}
            className="flex-1 w-full h-full min-h-[270px] cursor-grab active:cursor-grabbing"
          />

          <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-cyan-400 font-semibold">{alphaAgent.callsign}</span>
            <span className="text-slate-500 font-mono">VS</span>
            <span className="text-red-400 font-semibold">{omegaAgent.callsign}</span>
          </div>
        </section>

        {/* Right Column: Omega Vanguard Top Operative Card */}
        <section className="lg:col-span-4 rounded-xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-medium text-red-400">
                Omega Vanguard Top Operative
              </span>
              {matchMvp.id === topOmega.id && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
                  <Trophy className="w-3.5 h-3.5" />
                  Match MVP
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold text-white tracking-tight">
              {topOmega.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span className="text-red-300 font-medium">{omegaAgent.callsign}</span>
              <span aria-hidden="true">·</span>
              <span>{omegaAgent.role}</span>
              <span aria-hidden="true">·</span>
              <span>{omegaAgent.country}</span>
            </div>

            <p className="text-xs text-slate-400 italic mt-3 leading-relaxed">
              {omegaAgent.quote}
            </p>
          </div>

          {/* Primary Combat Telemetry: Total Kills & Headshots */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Skull className="w-3.5 h-3.5 text-red-400" />
                <span>Total Kills</span>
              </div>
              <div className="text-3xl font-mono font-bold text-white tabular-nums mt-1">
                {topOmega.stats.kills}
              </div>
              <div className="text-[11px] font-mono text-slate-400 tabular-nums mt-0.5">
                {topOmega.stats.deaths} Deaths · {topOmega.stats.assists} Assists
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                <span>Headshots</span>
              </div>
              <div className="text-3xl font-mono font-bold text-amber-300 tabular-nums mt-1">
                {topOmega.stats.headshots}
              </div>
              <div className="text-[11px] font-mono text-slate-400 tabular-nums mt-0.5">
                {omegaHsRate}% Headshot Ratio
              </div>
            </div>

            <div className="col-span-2 flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
              <span className="text-slate-400">Combat Score & Damage</span>
              <span className="font-mono font-semibold text-slate-200 tabular-nums">
                {topOmega.stats.score} PTS · {topOmega.stats.damageDealt} DMG
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Optional Expandable Full Squad Standings Table */}
      {showFullScoreboard && (
        <section className="w-full max-w-6xl mx-auto mb-4 rounded-xl bg-slate-900 border border-slate-800 p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Full Match Roster Standings
          </h3>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 px-3">Operative</th>
                <th className="py-2 px-3">Squad</th>
                <th className="py-2 px-3 text-right">Kills</th>
                <th className="py-2 px-3 text-right">Deaths</th>
                <th className="py-2 px-3 text-right">Headshots</th>
                <th className="py-2 px-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
              {[...allPlayers]
                .sort((a, b) => b.stats.kills - a.stats.kills || b.stats.score - a.stats.score)
                .map(p => (
                  <tr key={p.id} className={p.id === 'player' ? 'bg-slate-800/50 text-white' : 'text-slate-300'}>
                    <td className="py-2 px-3 font-sans font-medium">{p.name}</td>
                    <td className="py-2 px-3 font-sans text-slate-400">
                      {p.team === 'alpha' ? 'Alpha' : 'Omega'}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold">{p.stats.kills}</td>
                    <td className="py-2 px-3 text-right text-slate-400">{p.stats.deaths}</td>
                    <td className="py-2 px-3 text-right text-amber-300">{p.stats.headshots}</td>
                    <td className="py-2 px-3 text-right">{p.stats.score}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Footer Actions */}
      <footer className="w-full max-w-6xl mx-auto pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => {
            soundEngine.playUIClick();
            setShowFullScoreboard(prev => !prev);
          }}
          className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Award className="w-4 h-4 text-cyan-400" />
          <span>{showFullScoreboard ? 'Hide Full Roster' : 'View Full Match Roster'}</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEngine.playUIClick();
              onReturnToMenu();
            }}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Main Menu</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playUIClick();
              onPlayAgain();
            }}
            className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
