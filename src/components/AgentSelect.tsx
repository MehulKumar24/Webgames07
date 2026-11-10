import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Agent, AgentRole } from '../types/game';
import { AGENTS } from '../data/agents';
import { createCharacterBotModel } from '../engine/proceduralModels';
import { pickRandomVoiceLine } from '../data/voiceLines';
import { 
  Shield, 
  Crosshair, 
  Flame, 
  Eye, 
  Heart, 
  Volume2, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface AgentSelectProps {
  selectedAgent: Agent;
  onSelectAgent: (agent: Agent) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export const AgentSelect: React.FC<AgentSelectProps> = ({
  selectedAgent,
  onSelectAgent,
  onConfirm,
  onBack
}) => {
  const [roleFilter, setRoleFilter] = useState<AgentRole | 'ALL'>('ALL');
  const mountRef = useRef<HTMLDivElement>(null);

  const filteredAgents = AGENTS.filter(
    a => roleFilter === 'ALL' || a.role === roleFilter
  );

  // Interactive 3D Agent Turntable Showcase
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    while (container.children.length > 0) {
      container.removeChild(container.children[0]);
    }

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 360;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);
    camera.position.set(0, 1.48, 3.35);
    camera.lookAt(0, 1.18, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(new THREE.Color(selectedAgent.themeColor), 3.5, 10);
    rimLight.position.set(-2.2, 2.5, -2.0);
    scene.add(rimLight);

    const ambLight = new THREE.AmbientLight(0x94a3b8, 1.2);
    scene.add(ambLight);

    // Holographic Pedestal
    const pedGroup = new THREE.Group();
    const baseDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.98, 0.12, 32),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.85 })
    );
    baseDisc.position.y = -0.06;
    pedGroup.add(baseDisc);

    const glowRing = new THREE.Mesh(
      new THREE.RingGeometry(0.76, 0.84, 32),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(selectedAgent.themeColor),
        side: THREE.DoubleSide
      })
    );
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = 0.01;
    pedGroup.add(glowRing);
    scene.add(pedGroup);

    // Build Bespoke 3D Character Model for Selected Agent
    const botModel = createCharacterBotModel('alpha', selectedAgent.callsign, selectedAgent.gender);
    if (botModel.healthBarFill?.parent) {
      botModel.healthBarFill.parent.visible = false;
    }
    scene.add(botModel.group);

    let animId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      botModel.group.rotation.y = Math.sin(t * 0.65) * 0.65;
      botModel.torso.position.y =
        (selectedAgent.gender === 'Female' ? 1.2 : 1.25) + Math.sin(t * 2.2) * 0.015;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 320;
      const h = container.clientHeight || 360;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [selectedAgent]);

  const getRoleIcon = (role: AgentRole) => {
    switch (role) {
      case 'Assault': return <Flame className="w-4 h-4 text-orange-400" />;
      case 'Recon': return <Eye className="w-4 h-4 text-purple-400" />;
      case 'Control': return <Crosshair className="w-4 h-4 text-blue-400" />;
      case 'Support': return <Heart className="w-4 h-4 text-emerald-400" />;
      case 'Sentinel': return <Shield className="w-4 h-4 text-amber-400" />;
    }
  };

  const handlePickAgent = (agent: Agent) => {
    soundEngine.playUIClick();
    onSelectAgent(agent);
  };

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-b from-slate-950 via-slate-900 to-black p-4 md:p-6 flex flex-col justify-between font-chakra select-none overflow-y-auto">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div>
          <span className="text-xs font-mono-tactical text-cyan-400 tracking-widest uppercase">
            PROTOCOL: APEX // OPERATIVE ROSTER (12 BESPOKE 3D AGENTS)
          </span>
          <h2 className="text-2xl md:text-3xl font-black tracking-wider text-white uppercase">
            SELECT COMBAT AGENT
          </h2>
        </div>

        {/* Tactical Role Filters */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          {(['ALL', 'Assault', 'Recon', 'Control', 'Support', 'Sentinel'] as const).map((role) => (
            <button
              key={role}
              onClick={() => {
                soundEngine.playUIClick();
                setRoleFilter(role);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                roleFilter === role
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-[0_0_12px_rgba(0,240,255,0.5)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Main Agent Selection Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 my-4 flex-1 items-stretch">
        {/* Agent Cards Grid (Left 4 Columns) */}
        <div className="lg:col-span-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-2.5 content-start overflow-y-auto max-h-[64vh] pr-1">
          {filteredAgents.map((agent) => {
            const isSelected = selectedAgent.id === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => handlePickAgent(agent)}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-between transition-all cursor-pointer aspect-square ${
                  isSelected
                    ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.4)] scale-102'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <div 
                  className="w-11 h-11 rounded-full border-2 flex items-center justify-center font-black text-lg shadow-lg mt-0.5"
                  style={{ 
                    borderColor: agent.themeColor,
                    backgroundColor: agent.themeColor + '22',
                    color: agent.themeColor 
                  }}
                >
                  {agent.callsign.slice(0, 2)}
                </div>

                <div className="text-center w-full mt-1.5">
                  <span className="block font-black text-xs tracking-wider text-slate-100 truncate">
                    {agent.callsign}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono-tactical block">
                    {agent.role}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Center 3D Live Character Turntable Showcase (3 Columns) */}
        <div className="lg:col-span-3 bg-slate-950/85 border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-between relative overflow-hidden min-h-72">
          <div className="w-full flex items-center justify-between z-10 px-1">
            <span
              className="text-[10px] font-mono-tactical font-bold uppercase tracking-widest px-2 py-0.5 rounded border"
              style={{
                color: selectedAgent.themeColor,
                borderColor: selectedAgent.themeColor + '55',
                backgroundColor: selectedAgent.themeColor + '15'
              }}
            >
              3D MODEL RIG
            </span>
            <span className="text-[10px] font-mono-tactical text-slate-400">
              {selectedAgent.country}
            </span>
          </div>

          <div ref={mountRef} className="w-full flex-1 min-h-64" />

          <div className="w-full text-center border-t border-slate-800/80 pt-2">
            <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">
              {selectedAgent.callsign} — {selectedAgent.role.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Selected Agent Dossier & Tactical Kit (Right 5 Columns) */}
        <div className="lg:col-span-5 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xl">
          <div>
            {/* Header Lockup */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 flex items-center gap-1">
                    {getRoleIcon(selectedAgent.role)}
                    {selectedAgent.role}
                  </span>
                  <span className="text-xs text-slate-400 font-mono-tactical">
                    {selectedAgent.gender} · {selectedAgent.country}
                  </span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white uppercase mt-1 tracking-wider">
                  {selectedAgent.callsign}
                </h3>
                <span className="text-xs text-cyan-400 font-mono-tactical">
                  {selectedAgent.name}
                </span>
              </div>

              {/* Voice test button — plays this Agent's distinct voice! */}
              <button
                onClick={() => {
                  soundEngine.init();
                  const line = pickRandomVoiceLine(selectedAgent, 'round_start');
                  soundEngine.playAgentVoiceLine(selectedAgent, 'round_start', line, true);
                }}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Test Agent Unique Voice"
              >
                <Volume2 className="w-4 h-4" />
                <span>VOICE</span>
              </button>
            </div>

            {/* Biography */}
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {selectedAgent.biography}
            </p>

            {/* Tactical Abilities Kit */}
            <div className="mt-4">
              <span className="text-xs font-bold tracking-widest text-slate-400 uppercase block mb-2.5 font-mono-tactical">
                TACTICAL ABILITIES LOADOUT
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {/* Passive */}
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-200 uppercase">
                      PASSIVE: {selectedAgent.passive.name}
                    </span>
                    <span className="text-[10px] text-cyan-400 font-mono-tactical font-bold">INNATE</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{selectedAgent.passive.description}</p>
                </div>

                {/* Ability 1 */}
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-200 uppercase">
                      Q: {selectedAgent.ability1.name}
                    </span>
                    <span className="text-[10px] text-amber-300 font-mono-tactical font-bold">
                      {selectedAgent.ability1.cost === 0 ? 'SIGNATURE' : `$${selectedAgent.ability1.cost}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{selectedAgent.ability1.description}</p>
                </div>

                {/* Ability 2 */}
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-200 uppercase">
                      E: {selectedAgent.ability2.name}
                    </span>
                    <span className="text-[10px] text-amber-300 font-mono-tactical font-bold">
                      {selectedAgent.ability2.cost === 0 ? 'SIGNATURE' : `$${selectedAgent.ability2.cost}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{selectedAgent.ability2.description}</p>
                </div>

                {/* Ability 3 */}
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-200 uppercase">
                      C: {selectedAgent.ability3.name}
                    </span>
                    <span className="text-[10px] text-amber-300 font-mono-tactical font-bold">
                      {selectedAgent.ability3.cost === 0 ? 'SIGNATURE' : `$${selectedAgent.ability3.cost}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{selectedAgent.ability3.description}</p>
                </div>
              </div>

              {/* Ultimate Banner */}
              <div className="mt-2.5 p-3 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-slate-900/40 border border-amber-500/40 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                      ULTIMATE (X): {selectedAgent.ultimate.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">{selectedAgent.ultimate.description}</p>
                </div>
                <div className="text-right pl-3 font-mono-tactical">
                  <span className="text-xs font-bold text-amber-400 block">COST</span>
                  <span className="text-lg font-black text-white">
                    {selectedAgent.ultimate.ultPointsRequired || 7} PTS
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
            <button
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
            >
              BACK TO MENU
            </button>

            <button
              onClick={() => {
                soundEngine.playUIClick();
                onConfirm();
              }}
              className="px-7 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,240,255,0.6)] flex items-center gap-2 cursor-pointer active:scale-98 transition-all"
            >
              LOCK IN & DEPLOY <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
