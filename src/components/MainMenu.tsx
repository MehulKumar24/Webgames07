import React from 'react';
import { GameMode, MapData, Agent, Weapon, BotDifficulty } from '../types/game';
import { MAPS } from '../data/maps';
import { 
  Play, 
  Users, 
  Crosshair, 
  Sliders, 
  Shield, 
  Flame, 
  MapPin, 
  Cpu, 
  Award,
  ChevronRight,
  Target
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface MainMenuProps {
  selectedMode: GameMode;
  selectedMap: MapData;
  selectedAgent: Agent;
  selectedWeapon: Weapon;
  botDifficulty: BotDifficulty;
  onSelectMode: (mode: GameMode) => void;
  onSelectMap: (map: MapData) => void;
  onSelectDifficulty: (diff: BotDifficulty) => void;
  onStartGame: () => void;
  onOpenAgentSelect: () => void;
  onOpenArmory: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  selectedMode,
  selectedMap,
  selectedAgent,
  selectedWeapon,
  botDifficulty,
  onSelectMode,
  onSelectMap,
  onSelectDifficulty,
  onStartGame,
  onOpenAgentSelect,
  onOpenArmory,
  onOpenSettings
}) => {
  const modes: Array<{ id: GameMode; name: string; desc: string; icon: React.ReactNode }> = [
    {
      id: 'tactical_plant',
      name: '5v5 TACTICAL PLANT',
      desc: 'Plant or defuse the Nexus Core. Includes economy buy phases, site holds, and side swap.',
      icon: <Crosshair className="w-5 h-5 text-cyan-400" />
    },
    {
      id: 'team_elimination',
      name: 'TEAM ELIMINATION',
      desc: '5v5 combat elimination. First team to reach target eliminations wins.',
      icon: <Flame className="w-5 h-5 text-orange-400" />
    },
    {
      id: 'practice_range',
      name: 'PRACTICE RANGE',
      desc: 'Weapon recoil testing wall, moving target dummies, and ability cooldown sandbox.',
      icon: <Target className="w-5 h-5 text-emerald-400" />
    },
    {
      id: 'deathmatch',
      name: 'FREE-FOR-ALL DM',
      desc: 'Warmup deathmatch with instant respawns and instant full weapon selection.',
      icon: <Award className="w-5 h-5 text-amber-400" />
    }
  ];

  const difficulties: BotDifficulty[] = ['Beginner', 'Easy', 'Normal', 'Hard', 'Expert'];
  const difficultySummaries: Record<BotDifficulty, string> = {
    Beginner: 'Forgiving aim and slower rotations for clean practice runs.',
    Easy: 'Bots press mid lane but give space for learning site timing.',
    Normal: 'Balanced pressure with opportunistic flanks and site control.',
    Hard: 'Aggressive angles and faster reactions with tighter aim tracking.',
    Expert: 'Heavy pressure, sharper peeks, and punishing crosshair discipline.'
  };

  const handleStart = () => {
    soundEngine.init();
    soundEngine.playUIClick();
    onStartGame();
  };

  return (
    <div className="fixed inset-0 z-30 bg-gradient-to-br from-slate-950 via-slate-900 to-black p-4 md:p-8 flex flex-col justify-between font-chakra select-none overflow-y-auto">
      {/* Background Cyber Grid Accent */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00f0ff08_1px,transparent_1px),linear-gradient(to_bottom,#00f0ff08_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* TOP HEADER */}
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        {/* Title lockup */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.6)]">
            <Shield className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-widest text-white uppercase italic">
              PROTOCOL: <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">APEX</span>
            </h1>
            <span className="text-[11px] font-mono-tactical text-slate-400 tracking-wider uppercase block">
              ORIGINAL TACTICAL HERO-BASED FPS // ANDROID & BROWSER ENGINE
            </span>
          </div>
        </div>

        {/* Quick Nav Links */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundEngine.playUIClick();
              onOpenAgentSelect();
            }}
            className="px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-200 text-xs font-bold tracking-wider uppercase flex items-center gap-2 transition-all cursor-pointer"
          >
            <Users className="w-4 h-4 text-cyan-400" />
            <span>AGENTS ({selectedAgent.callsign})</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playUIClick();
              onOpenArmory();
            }}
            className="px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-200 text-xs font-bold tracking-wider uppercase flex items-center gap-2 transition-all cursor-pointer"
          >
            <Crosshair className="w-4 h-4 text-cyan-400" />
            <span>ARMORY ({selectedWeapon.name})</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playUIClick();
              onOpenSettings();
            }}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Settings & Hardware"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CENTER WORKSPACE: GAME MODES & MAP SELECTION */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 items-start">
        {/* Game Modes (Left 5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <span className="text-xs font-bold tracking-widest text-slate-400 uppercase font-mono-tactical">
            TACTICAL GAME MODES
          </span>

          <div className="space-y-2.5">
            {modes.map((mode) => {
              const isSelected = selectedMode === mode.id;
              return (
                <div
                  key={mode.id}
                  onClick={() => {
                    soundEngine.playUIClick();
                    onSelectMode(mode.id);
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-950/30 border-cyan-400/90 shadow-[0_0_20px_rgba(0,240,255,0.25)] translate-x-1'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {mode.icon}
                      <h4 className="font-black text-sm text-slate-100 tracking-wider">{mode.name}</h4>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-mono-tactical font-black text-cyan-400 bg-cyan-950 border border-cyan-500/40 px-2 py-0.5 rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{mode.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Bot Difficulty Selector */}
          <div className="mt-2 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-mono-tactical">
                <Cpu className="w-4 h-4 text-cyan-400" /> OFFLINE BOT DIFFICULTY
              </span>
              <span className="text-xs font-black text-cyan-400 font-mono-tactical">{botDifficulty}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {difficulties.map((diff) => (
                <button
                  key={diff}
                  onClick={() => {
                    soundEngine.playUIClick();
                    onSelectDifficulty(diff);
                  }}
                  className={`py-1.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    botDifficulty === diff
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {diff.slice(0, 4)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400 uppercase tracking-wide">
              Adaptive pressure: <span className="text-cyan-300">{difficultySummaries[botDifficulty]}</span>
            </p>
          </div>
        </div>

        {/* Competitive Maps (Right 7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <span className="text-xs font-bold tracking-widest text-slate-400 uppercase font-mono-tactical">
            COMPETITIVE MAP SELECTION (5 ARENAS)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MAPS.map((map) => {
              const isSelected = selectedMap.id === map.id;
              return (
                <div
                  key={map.id}
                  onClick={() => {
                    soundEngine.playUIClick();
                    onSelectMap(map);
                  }}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-950/30 border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.3)] scale-101'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono-tactical text-cyan-400 font-bold uppercase">
                        {map.codename}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-mono-tactical">
                        {map.theme}
                      </span>
                    </div>
                    <h4 className="text-lg font-black text-white uppercase mt-0.5">{map.name}</h4>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-cyan-400" /> {map.location}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {map.description}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60 text-[10px] font-mono-tactical text-slate-400">
                    <span>SITES: A & B</span>
                    {isSelected && <span className="text-cyan-400 font-bold">SELECTED ARENA</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM CTA BAR */}
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-800/80 pt-4">
        {/* Selected Loadout Summary */}
        <div className="flex items-center gap-4 text-xs font-mono-tactical text-slate-400">
          <div>
            <span className="text-slate-500 block text-[10px]">OPERATIVE</span>
            <span className="text-cyan-300 font-bold">{selectedAgent.callsign} ({selectedAgent.role})</span>
          </div>
          <div className="h-6 w-[1px] bg-slate-800" />
          <div>
            <span className="text-slate-500 block text-[10px]">PRIMARY WEAPON</span>
            <span className="text-slate-200 font-bold">{selectedWeapon.name}</span>
          </div>
          <div className="h-6 w-[1px] bg-slate-800" />
          <div>
            <span className="text-slate-500 block text-[10px]">ARENA</span>
            <span className="text-slate-200 font-bold">{selectedMap.name}</span>
          </div>
        </div>

        {/* Primary Deploy CTA Button */}
        <button
          onClick={handleStart}
          className="w-full md:w-auto px-10 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-base uppercase tracking-widest shadow-[0_0_30px_rgba(0,240,255,0.6)] flex items-center justify-center gap-3 cursor-pointer active:scale-98 transition-all"
        >
          <Play className="w-5 h-5 fill-slate-950" />
          DEPLOY INTO COMBAT
        </button>
      </div>
    </div>
  );
};
