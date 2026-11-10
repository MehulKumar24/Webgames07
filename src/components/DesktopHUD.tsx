import React, { useState, useEffect, useRef } from 'react';
import { 
  Agent, 
  Weapon, 
  MatchPlayer, 
  KillFeedEntry, 
  DamageNumber, 
  MapData,
  TacticalChatEntry,
  TacticalChatCategory
} from '../types/game';
import { RadarTelemetry } from '../engine/gameEngine';
import { TacticalMiniMap } from './TacticalMap';
import { 
  Shield, 
  Heart, 
  DollarSign, 
  Skull, 
  Zap, 
  Eye, 
  Sparkles, 
  Map as MapIcon, 
  ShoppingBag, 
  BarChart2,
  Bomb,
  RotateCw,
  Shuffle,
  Play,
  Radio,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Send,
  Crosshair
} from 'lucide-react';

interface TacticalCommTemplate {
  id: string;
  shortLabel: string;
  category: TacticalChatCategory;
  message: string;
}

const TEAM_COMM_TEMPLATES: TacticalCommTemplate[] = [
  {
    id: 'rush_a',
    shortLabel: 'Rush Site A',
    category: 'strategy',
    message: 'Execute fast hit on Site A — push together with utility!'
  },
  {
    id: 'push_b',
    shortLabel: 'Push Site B',
    category: 'strategy',
    message: 'Group up and breach Site B together!'
  },
  {
    id: 'enemy_spotted',
    shortLabel: 'Enemy Spotted',
    category: 'callout',
    message: 'Hostile contact spotted in my sector — watch crossfire!'
  },
  {
    id: 'need_backup',
    shortLabel: 'Need Backup',
    category: 'callout',
    message: 'Taking heavy fire at my position — need immediate backup!'
  },
  {
    id: 'rotate_now',
    shortLabel: 'Rotate Now',
    category: 'strategy',
    message: 'Rotate to the other site immediately!'
  },
  {
    id: 'hold_angles',
    shortLabel: 'Hold Angles',
    category: 'strategy',
    message: 'Hold crossfires and play disciplined for picks.'
  },
  {
    id: 'spike_status',
    shortLabel: 'Spike Callout',
    category: 'objective',
    message: 'Secure the Spike objective — cover the carrier / site!'
  },
  {
    id: 'eco_save',
    shortLabel: 'Eco / Save',
    category: 'status',
    message: 'Manage economy this round — coordinate team buy next.'
  }
];

interface DesktopHUDProps {
  agent: Agent;
  currentWeapon: Weapon;
  primaryWeapon: Weapon;
  sidearmWeapon?: Weapon;
  meleeWeapon?: Weapon;
  playerData: MatchPlayer;
  mapData: MapData;
  radar: RadarTelemetry | null;
  alphaScore: number;
  omegaScore: number;
  roundTime: number;
  buyPhaseTime?: number;
  roundNumber?: number;
  targetWins?: number;
  isOvertime?: boolean;
  isSpikePlanted: boolean;
  spikeTime: number;
  roundPhase: 'buy_phase' | 'in_progress' | 'round_end' | 'match_end';
  roundMessage?: string;
  crosshairBloom: number;
  hitmarker: { active: boolean; isHeadshot: boolean };
  killFeed: KillFeedEntry[];
  tacticalChatLog?: TacticalChatEntry[];
  damageNumbers: DamageNumber[];
  currentAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  isAds: boolean;
  isCrouched: boolean;
  isSprinting: boolean;
  isSliding: boolean;
  isInBombSite: boolean;
  allPlayers: MatchPlayer[];
  onOpenBuyMenu: () => void;
  onOpenScoreboard: () => void;
  onOpenFullMap: () => void;
  onPlacePing: (x: number, z: number) => void;
  onSendTeamComm?: (message: string, category: TacticalChatCategory, calloutLocation?: string) => void;
  onAbilityTrigger: (type: 'ability_1' | 'ability_2' | 'ability_3') => void;
  onUltimateTrigger: () => void;
  onWeaponSwitch: (type: 'primary' | 'secondary' | 'melee') => void;
  onPlantSpike: () => void;
  onDefuseSpike: () => void;
  onDropSpike?: () => void;
  onPickupSpike?: () => void;
  onRollRandomWeapon?: () => void;
  onSkipBuyPhase?: () => void;
  isInspecting?: boolean;
  isPointerLocked?: boolean;
  onInspectWeapon?: () => void;
  isMobileHUD?: boolean;
}

export const DesktopHUD: React.FC<DesktopHUDProps> = ({
  agent,
  currentWeapon,
  primaryWeapon,
  sidearmWeapon,
  meleeWeapon,
  playerData,
  mapData,
  radar,
  alphaScore,
  omegaScore,
  roundTime,
  buyPhaseTime = 60,
  roundNumber = 1,
  targetWins = 7,
  isOvertime = false,
  isSpikePlanted,
  spikeTime,
  roundPhase,
  roundMessage,
  crosshairBloom,
  hitmarker,
  killFeed,
  tacticalChatLog = [],
  damageNumbers,
  currentAmmo,
  reserveAmmo,
  isReloading,
  isAds,
  isCrouched,
  isSprinting,
  isSliding,
  isInBombSite,
  allPlayers,
  onOpenBuyMenu,
  onOpenScoreboard,
  onOpenFullMap,
  onPlacePing,
  onSendTeamComm,
  onAbilityTrigger,
  onUltimateTrigger,
  onWeaponSwitch,
  onPlantSpike,
  onDefuseSpike,
  onDropSpike,
  onPickupSpike,
  onRollRandomWeapon,
  onSkipBuyPhase,
  isInspecting = false,
  isPointerLocked = false,
  onInspectWeapon,
  isMobileHUD = false
}) => {
  const [isChatExpanded, setIsChatExpanded] = useState<boolean>(true);
  const [showCommTemplates, setShowCommTemplates] = useState<boolean>(true);
  const [commTab, setCommTab] = useState<'templates' | 'callouts'>('templates');
  const [customCommInput, setCustomCommInput] = useState<string>('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll tactical chat log to newest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [tacticalChatLog.length, isChatExpanded]);

  const alphaTeam = allPlayers.filter(p => p.team === 'alpha');
  const omegaTeam = allPlayers.filter(p => p.team === 'omega');
  const currentSectorCallout = (radar?.currentCallout || 'TRANSIT SECTOR').toUpperCase();

  // Compute compass heading in degrees (0 = North/-Z, 90 = East/+X, 180 = South/+Z, 270 = West/-X)
  const rawYaw = radar?.playerYaw ?? 0;
  const headingDeg = Math.round((((-rawYaw * 180) / Math.PI) % 360 + 360) % 360);

  const getCardinalLabel = (deg: number) => {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
  };

  // Relative angle helper for Site A / Site B markers on the compass
  const getSiteRelativeOffset = (targetX: number, targetZ: number) => {
    if (!radar) return 0;
    const dx = targetX - radar.playerX;
    const dz = targetZ - radar.playerZ;
    // World angle where -Z is 0, +X is +PI/2
    const targetYaw = Math.atan2(-dx, -dz);
    let diff = radar.playerYaw - targetYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Clamp to [-1, 1] for 120-degree compass strip
    return Math.max(-1, Math.min(1, diff / (Math.PI / 2.2)));
  };

  const siteAOffset = getSiteRelativeOffset(mapData.siteA.x, mapData.siteA.z);
  const siteBOffset = getSiteRelativeOffset(mapData.siteB.x, mapData.siteB.z);
  const distToSiteA = radar ? Math.round(Math.hypot(mapData.siteA.x - radar.playerX, mapData.siteA.z - radar.playerZ)) : 0;
  const distToSiteB = radar ? Math.round(Math.hypot(mapData.siteB.x - radar.playerX, mapData.siteB.z - radar.playerZ)) : 0;

  const ultRequired = agent.ultimate.ultPointsRequired || 7;
  const isUltReady = playerData.ultPoints >= ultRequired;

  const postureLabel = isSliding
    ? 'SLIDING'
    : isSprinting
    ? 'SPRINTING'
    : isCrouched
    ? 'CROUCHED'
    : isAds
    ? 'ADS FOCUS'
    : 'STANDING';

  // Magazine bullet pips (up to 30 ticks)
  const maxPips = Math.min(30, currentWeapon.magazineSize);
  const filledPips = Math.round((currentAmmo / Math.max(1, currentWeapon.magazineSize)) * maxPips);

  return (
    <div className="absolute inset-0 pointer-events-none z-10 select-none overflow-hidden font-chakra">
      {/* 1. DYNAMIC TACTICAL CROSSHAIR & HITMARKER (Hidden when player is dead) */}
      {playerData.isAlive && (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        {!isAds ? (
          <>
            {/* Center Dot */}
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 absolute -translate-x-1/2 -translate-y-1/2 shadow-[0_0_5px_rgba(0,240,255,0.9)]" />
            {/* Top Hair */}
            <div 
              className="w-0.5 h-2.5 bg-cyan-400 absolute -translate-x-1/2 shadow-[0_0_4px_rgba(0,240,255,0.9)] transition-all duration-75"
              style={{ top: `-${7 + crosshairBloom}px` }}
            />
            {/* Bottom Hair */}
            <div 
              className="w-0.5 h-2.5 bg-cyan-400 absolute -translate-x-1/2 shadow-[0_0_4px_rgba(0,240,255,0.9)] transition-all duration-75"
              style={{ top: `${5 + crosshairBloom}px` }}
            />
            {/* Left Hair */}
            <div 
              className="h-0.5 w-2.5 bg-cyan-400 absolute -translate-y-1/2 shadow-[0_0_4px_rgba(0,240,255,0.9)] transition-all duration-75"
              style={{ left: `-${7 + crosshairBloom}px` }}
            />
            {/* Right Hair */}
            <div 
              className="h-0.5 w-2.5 bg-cyan-400 absolute -translate-y-1/2 shadow-[0_0_4px_rgba(0,240,255,0.9)] transition-all duration-75"
              style={{ left: `${5 + crosshairBloom}px` }}
            />
          </>
        ) : (
          <>
            {/* ADS Holographic Sight Reticle */}
            <div className="w-2 h-2 rounded-full bg-red-500 absolute -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_rgba(239,68,68,1)] animate-pulse" />
            <div className="w-9 h-9 rounded-full border border-red-500/50 absolute -translate-x-1/2 -translate-y-1/2" />
            <div className="w-16 h-[1px] bg-red-500/30 absolute -translate-x-1/2 -translate-y-1/2" />
            <div className="h-16 w-[1px] bg-red-500/30 absolute -translate-x-1/2 -translate-y-1/2" />
          </>
        )}

        {/* Hitmarker X Flash */}
        {hitmarker.active && (
          <div className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 pointer-events-none">
            <div
              className={`absolute top-1/2 left-1/2 w-6 h-0.5 -translate-x-1/2 -translate-y-1/2 rotate-45 ${
                hitmarker.isHeadshot
                  ? 'bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,1)]'
                  : 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]'
              }`}
            />
            <div
              className={`absolute top-1/2 left-1/2 w-6 h-0.5 -translate-x-1/2 -translate-y-1/2 -rotate-45 ${
                hitmarker.isHeadshot
                  ? 'bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,1)]'
                  : 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]'
              }`}
            />
          </div>
        )}

        {/* Reloading or Inspecting Indicator under Crosshair */}
        {isReloading ? (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded bg-slate-950/85 border border-amber-500/50 text-[10px] font-mono-tactical font-bold text-amber-300 tracking-widest uppercase whitespace-nowrap">
            RELOADING...
          </div>
        ) : isInspecting ? (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded bg-slate-950/85 border border-cyan-400/60 text-[10px] font-mono-tactical font-bold text-cyan-300 tracking-widest uppercase whitespace-nowrap">
            INSPECTING {currentWeapon.name}
          </div>
        ) : !isPointerLocked && !isMobileHUD ? (
          <div className="absolute top-7 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-slate-950/90 border border-cyan-500/40 text-[10px] font-mono-tactical text-slate-300 tracking-wider uppercase whitespace-nowrap shadow-lg">
            CLICK TO LOCK MOUSE AIM • [Y] INSPECT WEAPON • [SCROLL] SWAP
          </div>
        ) : null}
      </div>
      )}

      {/* 2. TOP CENTER: TACTICAL COMPASS RIBBON & 5v5 ROSTER MATCH BAR */}
      <div className="w-full flex flex-col items-center pt-1.5 gap-1">
        {/* Horizontal Compass & Objective Waypoint Strip */}
        <div className="relative w-72 md:w-96 h-6 bg-slate-950/85 border border-slate-800/90 rounded-full px-4 flex items-center justify-between overflow-hidden shadow-lg backdrop-blur-xs">
          {/* Center Heading Readout */}
          <div className="mx-auto flex items-center gap-1.5 z-10 bg-slate-950/90 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
            <span className="text-[10px] font-mono-tactical font-black text-cyan-400">
              {headingDeg.toString().padStart(3, '0')}°
            </span>
            <span className="text-[10px] font-black text-white">
              {getCardinalLabel(headingDeg)}
            </span>
          </div>

          {/* Relative Site A Waypoint Pip on Compass */}
          <div
            className="absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[9px] font-mono-tactical font-black text-cyan-300 bg-cyan-950/90 border border-cyan-400/70 rounded px-1 transition-all duration-75"
            style={{ left: `calc(50% + ${siteAOffset * 42}% - 18px)` }}
          >
            <span>A</span>
            <span className="text-[8px] text-cyan-200/80">{distToSiteA}m</span>
          </div>

          {/* Relative Site B Waypoint Pip on Compass */}
          <div
            className="absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[9px] font-mono-tactical font-black text-amber-300 bg-amber-950/90 border border-amber-400/70 rounded px-1 transition-all duration-75"
            style={{ left: `calc(50% + ${siteBOffset * 42}% - 18px)` }}
          >
            <span>B</span>
            <span className="text-[8px] text-amber-200/80">{distToSiteB}m</span>
          </div>
        </div>

        {/* 5v5 Team Roster & Scoreboard Header (Tappable on Mobile to open Scoreboard) */}
        <div
          onClick={onOpenScoreboard}
          title="Tap to view Match Scoreboard"
          className="flex items-center gap-2 md:gap-4 bg-slate-950/90 border border-slate-800 hover:border-cyan-500/50 rounded-xl px-4 py-1.5 shadow-2xl backdrop-blur-sm pointer-events-auto cursor-pointer transition-all active:scale-95"
        >
          {/* Alpha Team Operative Slots */}
          <div className="hidden sm:flex items-center gap-1.5">
            {alphaTeam.map((ally) => (
              <div
                key={ally.id}
                className={`relative w-8 h-9 rounded-md border flex flex-col items-center justify-between p-0.5 transition-all ${
                  ally.isAlive
                    ? ally.id === 'player'
                      ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                      : 'bg-slate-900/90 border-cyan-500/40'
                    : 'bg-slate-950/60 border-slate-800 opacity-40'
                }`}
                title={`${ally.name} (${ally.health} HP)`}
              >
                <span className="text-[9px] font-black text-cyan-300 uppercase">
                  {ally.name.slice(0, 3)}
                </span>
                {ally.isAlive ? (
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400"
                      style={{ width: `${Math.max(0, ally.health)}%` }}
                    />
                  </div>
                ) : (
                  <Skull className="w-3 h-3 text-slate-500" />
                )}
              </div>
            ))}
          </div>

          {/* Alpha Team Score & Side Role */}
          <div className="flex flex-col items-center px-2">
            <span className="text-[9px] font-mono-tactical font-bold text-cyan-400 tracking-widest">
              ALPHA ({playerData.side === 'defenders' ? 'DEF' : 'ATK'})
            </span>
            <span className="text-2xl font-black text-cyan-400 font-mono-tactical leading-none">
              {alphaScore}
            </span>
          </div>

          {/* Center Round Clock / Buy Phase / Spike Fuse */}
          <div className="flex flex-col items-center px-3 border-x border-slate-800 min-w-34">
            {isSpikePlanted ? (
              <div className="flex items-center gap-1 text-red-500 font-black animate-pulse text-lg font-mono-tactical">
                <Bomb className="w-4 h-4" />
                {spikeTime.toFixed(1)}s
              </div>
            ) : roundPhase === 'buy_phase' ? (
              <div className="text-xl font-black font-mono-tactical text-amber-300 leading-tight">
                0:{Math.max(0, Math.ceil(buyPhaseTime)).toString().padStart(2, '0')}
              </div>
            ) : (
              <div className="text-xl font-black font-mono-tactical text-white leading-tight">
                {Math.floor(roundTime / 60)}:{(Math.floor(roundTime % 60)).toString().padStart(2, '0')}
              </div>
            )}
            <span className="text-[9px] tracking-widest uppercase font-bold text-slate-400">
              {roundPhase === 'buy_phase'
                ? `BUY PHASE • R${roundNumber}`
                : isSpikePlanted
                ? 'CORE ARMED'
                : isOvertime
                ? `OT R${roundNumber} • FT${targetWins}`
                : `R${roundNumber}/12 • FT${targetWins}`}
            </span>
          </div>

          {/* Omega Team Score & Side Role */}
          <div className="flex flex-col items-center px-2">
            <span className="text-[9px] font-mono-tactical font-bold text-red-400 tracking-widest">
              OMEGA ({playerData.side === 'defenders' ? 'ATK' : 'DEF'})
            </span>
            <span className="text-2xl font-black text-red-400 font-mono-tactical leading-none">
              {omegaScore}
            </span>
          </div>

          {/* Omega Team Operative Slots */}
          <div className="hidden sm:flex items-center gap-1.5">
            {omegaTeam.map((enemy) => (
              <div
                key={enemy.id}
                className={`relative w-8 h-9 rounded-md border flex flex-col items-center justify-between p-0.5 transition-all ${
                  enemy.isAlive
                    ? 'bg-slate-900/90 border-red-500/40'
                    : 'bg-slate-950/60 border-slate-800 opacity-40'
                }`}
                title={enemy.name}
              >
                <span className="text-[9px] font-black text-red-300 uppercase">
                  {enemy.name.slice(0, 3)}
                </span>
                {enemy.isAlive ? (
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 w-full" />
                  </div>
                ) : (
                  <Skull className="w-3 h-3 text-slate-500" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 1-Minute Buy Phase Action Bar (Randomize Weapon [G] + Skip Buy Phase) */}
        {roundPhase === 'buy_phase' && playerData.isAlive && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1 pointer-events-auto">
            {onRollRandomWeapon && (
              <button
                onClick={onRollRandomWeapon}
                className="px-3 py-1 rounded-lg bg-purple-600/80 hover:bg-purple-500 border border-purple-300 text-white text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5 shadow-lg cursor-pointer transition-all"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>RANDOMIZE WEAPON [G]</span>
              </button>
            )}
            {onSkipBuyPhase && (
              <button
                onClick={onSkipBuyPhase}
                className="px-3 py-1 rounded-lg bg-emerald-500/90 hover:bg-emerald-400 border border-emerald-200 text-slate-950 text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5 shadow-lg cursor-pointer transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>START COMBAT NOW</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Round Announcement Banner */}
      {roundMessage && (
        <div className="w-full flex justify-center mt-2">
          <div className="bg-slate-950/90 border border-cyan-400/70 px-6 py-1.5 rounded-lg text-cyan-300 font-chakra font-black tracking-widest text-sm shadow-[0_0_20px_rgba(0,240,255,0.35)]">
            {roundMessage}
          </div>
        </div>
      )}

      {/* 3. TOP LEFT: REAL-TIME 2D TACTICAL MINI-MAP & CALLOUT */}
      <div className="absolute top-3 left-3 z-20">
        <TacticalMiniMap
          mapData={mapData}
          radar={radar}
          onOpenFullMap={onOpenFullMap}
          onPlacePing={onPlacePing}
        />
      </div>

      {/* 4. TOP RIGHT: TACTICAL SHORTCUTS, TRANSPARENT SCROLLABLE TEAM CHAT LOG BOX & KILL FEED */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-20 max-w-xs sm:max-w-sm">
        {!isMobileHUD && playerData.isAlive && (
          <div className="flex items-center gap-1.5 mb-0.5 pointer-events-auto">
            <button
              onClick={onOpenFullMap}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950/85 border border-slate-700 hover:border-cyan-400 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-xs"
            >
              <MapIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>MAP [M]</span>
            </button>
            <button
              onClick={onOpenBuyMenu}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950/85 border border-cyan-500/50 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-xs"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>BUY [B]</span>
            </button>
            <button
              onClick={onOpenScoreboard}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950/85 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-xs"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>TAB</span>
            </button>
          </div>
        )}

        {/* TRANSPARENT, SCROLLABLE TACTICAL TEAM CHAT LOG BOX (Appears directly above the Killfeed) */}
        <div className="w-72 sm:w-82 rounded-xl bg-slate-950/40 hover:bg-slate-950/75 border border-cyan-500/30 shadow-[0_4px_24px_rgba(0,0,0,0.45)] backdrop-blur-xs transition-all duration-200 pointer-events-auto overflow-hidden">
          {/* Chat Box Header Bar */}
          <div className="px-2.5 py-1.5 bg-slate-950/55 border-b border-slate-800/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-[10px] font-mono-tactical font-black tracking-wider text-cyan-300 uppercase">
                TEAM COMMS
              </span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 border border-cyan-400/40 text-[9px] font-mono-tactical font-bold text-cyan-200 truncate max-w-26">
                @ {currentSectorCallout}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowCommTemplates(prev => !prev)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono-tactical font-bold uppercase border transition-all cursor-pointer ${
                  showCommTemplates
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                    : 'bg-slate-900/70 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="Toggle Pre-Defined Tactical Templates & Callouts"
              >
                <MessageSquare className="w-3 h-3 inline mr-0.5" />
                CALLOUTS
              </button>
              <button
                onClick={() => setIsChatExpanded(prev => !prev)}
                className="p-0.5 rounded bg-slate-900/70 border border-slate-700 hover:border-cyan-400 text-slate-300 cursor-pointer"
                title={isChatExpanded ? 'Minimize Team Chat Log' : 'Expand Team Chat Log'}
              >
                {isChatExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Scrollable Tactical Message History */}
          {isChatExpanded && (
            <div
              ref={chatScrollRef}
              className="max-h-28 sm:max-h-32 overflow-y-auto px-2.5 py-1.5 space-y-1 scrollbar-thin scrollbar-thumb-cyan-500/40 scrollbar-track-transparent"
            >
              {tacticalChatLog.length === 0 ? (
                <div className="text-[10px] font-mono-tactical text-slate-400/80 italic py-1">
                  [TAC-NET ONLINE] Select a template or sector callout below to coordinate with Alpha Squad.
                </div>
              ) : (
                tacticalChatLog.map((msg) => {
                  const categoryBadge =
                    msg.category === 'strategy'
                      ? { label: 'STRAT', cls: 'bg-purple-500/25 border-purple-400/60 text-purple-200' }
                      : msg.category === 'objective'
                      ? { label: 'OBJ', cls: 'bg-amber-500/25 border-amber-400/60 text-amber-200' }
                      : msg.category === 'ping'
                      ? { label: 'PING', cls: 'bg-cyan-500/25 border-cyan-400/60 text-cyan-200' }
                      : msg.category === 'status'
                      ? { label: 'SYS', cls: 'bg-slate-700/50 border-slate-500/60 text-slate-200' }
                      : { label: 'INTEL', cls: 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200' };

                  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  return (
                    <div
                      key={msg.id}
                      className="text-[11px] leading-snug bg-slate-950/35 hover:bg-slate-900/60 rounded px-1.5 py-1 border border-slate-800/40 flex flex-col gap-0.5 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={`px-1 py-0.1 rounded border text-[8px] font-mono-tactical font-black uppercase ${categoryBadge.cls}`}>
                            {categoryBadge.label}
                          </span>
                          <span className="font-black text-cyan-300 text-[10px] truncate">
                            {msg.senderName}
                          </span>
                          {msg.calloutLocation && (
                            <span className="text-[9px] font-mono-tactical font-bold text-amber-300/95 truncate">
                              [{msg.calloutLocation}]
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] font-mono-tactical text-slate-500 shrink-0">
                          {timeStr}
                        </span>
                      </div>
                      <div className="text-slate-100/95 text-[10px] pl-0.5 break-words">
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Pre-Defined Team Communication Templates & Map Sector Callouts Drawer */}
          {showCommTemplates && (
            <div className="px-2 py-1.5 bg-slate-950/60 border-t border-slate-800/70 flex flex-col gap-1.5">
              {/* Sub-tabs: Tactical Templates vs. Map Sector Callouts */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCommTab('templates')}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono-tactical font-bold uppercase cursor-pointer transition-all ${
                      commTab === 'templates'
                        ? 'bg-cyan-500/25 border border-cyan-400 text-cyan-200'
                        : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    QUICK TEMPLATES
                  </button>
                  <button
                    onClick={() => setCommTab('callouts')}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono-tactical font-bold uppercase cursor-pointer transition-all ${
                      commTab === 'callouts'
                        ? 'bg-amber-500/25 border border-amber-400 text-amber-200'
                        : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    SECTOR CALLOUTS
                  </button>
                </div>

                {/* Instant Current Sector Enemy Callout Button */}
                <button
                  onClick={() => {
                    onSendTeamComm?.(
                      `Enemy contact spotted at ${currentSectorCallout}!`,
                      'callout',
                      currentSectorCallout
                    );
                  }}
                  className="px-1.5 py-0.5 rounded bg-red-500/25 hover:bg-red-500/40 border border-red-400/70 text-[9px] font-mono-tactical font-black text-red-200 uppercase flex items-center gap-1 cursor-pointer transition-all"
                  title="Broadcast enemy contact at your current map callout"
                >
                  <Crosshair className="w-2.5 h-2.5" />
                  <span>PING HERE</span>
                </button>
              </div>

              {commTab === 'templates' ? (
                <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto pr-0.5">
                  {TEAM_COMM_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => {
                        onSendTeamComm?.(tpl.message, tpl.category, currentSectorCallout);
                      }}
                      className="px-2 py-1 rounded bg-slate-900/75 hover:bg-cyan-950/80 border border-slate-700/80 hover:border-cyan-400/70 text-left text-[10px] font-bold text-slate-200 hover:text-cyan-200 truncate cursor-pointer transition-all"
                      title={tpl.message}
                    >
                      • {tpl.shortLabel}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto pr-0.5">
                  <button
                    onClick={() => {
                      onSendTeamComm?.('Hostile activity spotted at SITE A — converge!', 'callout', 'SITE A');
                    }}
                    className="px-2 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/50 text-left text-[10px] font-bold text-cyan-200 truncate cursor-pointer"
                  >
                    @ SITE A (Contact)
                  </button>
                  <button
                    onClick={() => {
                      onSendTeamComm?.('Hostile activity spotted at SITE B — converge!', 'callout', 'SITE B');
                    }}
                    className="px-2 py-1 rounded bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/50 text-left text-[10px] font-bold text-amber-200 truncate cursor-pointer"
                  >
                    @ SITE B (Contact)
                  </button>
                  {mapData.callouts.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => {
                        onSendTeamComm?.(
                          `Check ${c.name.toUpperCase()} — enemy movement reported in sector.`,
                          'callout',
                          c.name.toUpperCase()
                        );
                      }}
                      className="px-2 py-1 rounded bg-slate-900/75 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-400/70 text-left text-[10px] font-bold text-slate-200 hover:text-amber-200 truncate cursor-pointer transition-all"
                    >
                      @ {c.name.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}

              {/* Quick Custom Tactical Message Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = customCommInput.trim();
                  if (!trimmed) return;
                  onSendTeamComm?.(trimmed, 'callout', currentSectorCallout);
                  setCustomCommInput('');
                }}
                onKeyDown={(e) => e.stopPropagation()}
                className="flex items-center gap-1 pt-0.5"
              >
                <input
                  type="text"
                  value={customCommInput}
                  onChange={(e) => setCustomCommInput(e.target.value)}
                  placeholder={`Transmit radio callout (@ ${currentSectorCallout})...`}
                  className="flex-1 bg-slate-900/80 border border-slate-700/80 focus:border-cyan-400 rounded px-2 py-1 text-[10px] text-white placeholder-slate-500 outline-none"
                />
                <button
                  type="submit"
                  className="px-2 py-1 rounded bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400/70 text-cyan-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  title="Send Team Radio Callout"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Transient Kill Feed Notifications (Vanish automatically after showing once) */}
        {killFeed.slice(-3).map((entry) => {
          const isPlayerKill = entry.killerName === playerData.name;
          return (
            <div
              key={entry.id}
              className={`rounded-lg px-3 py-1 flex items-center gap-2 text-xs shadow-lg transition-all duration-300 ${
                isPlayerKill
                  ? 'bg-cyan-950/90 border border-cyan-400/80 shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                  : 'bg-slate-950/90 border border-slate-800'
              }`}
            >
              <span className={`font-bold ${entry.killerTeam === 'alpha' ? 'text-cyan-400' : 'text-red-400'}`}>
                {entry.killerName}
              </span>
              <span className="text-[10px] font-mono-tactical text-slate-300 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                {entry.weaponName}
              </span>
              {entry.isHeadshot && (
                <Skull className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className={`font-bold ${entry.victimTeam === 'alpha' ? 'text-cyan-400' : 'text-red-400'}`}>
                {entry.victimName}
              </span>
            </div>
          );
        })}
      </div>

      {/* 4B. PLAYER ELIMINATION / DEATH ANIMATION OVERLAY */}
      {!playerData.isAlive && (
        <div className="absolute inset-0 pointer-events-none z-30 flex flex-col items-center justify-center bg-radial from-red-950/25 via-red-950/55 to-slate-950/90 backdrop-blur-[2px] animate-fade-in">
          {/* Top & Bottom Tactical Warning Scanlines */}
          <div className="w-full max-w-md px-6 py-5 rounded-2xl bg-slate-950/92 border-2 border-red-500/80 shadow-[0_0_50px_rgba(239,68,68,0.45)] flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center animate-pulse">
              <Skull className="w-6 h-6 text-red-400" />
            </div>
            <div className="text-xs font-mono-tactical font-bold tracking-[0.3em] text-red-400 uppercase">
              CRITICAL SUIT FAILURE // VITALS FLATLINED
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-wider text-white uppercase">
              OPERATIVE ELIMINATED
            </div>
            {/* Flatline ECG Pulse Bar */}
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden my-1 border border-red-500/30">
              <div className="h-full bg-red-500 w-full animate-pulse" />
            </div>
            <div className="text-[11px] font-mono-tactical text-slate-300 tracking-wider uppercase">
              ALLIED ALPHA SQUAD CONTINUING TACTICAL OPERATION
            </div>
          </div>
        </div>
      )}

      {/* 5. FLOATING DAMAGE NUMBERS */}
      {damageNumbers.map((dmg, idx) => {
        const offsetX = (((dmg.id.charCodeAt(dmg.id.length - 1) || 0) + idx * 17) % 48) - 24;
        return (
          <div
            key={dmg.id}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none font-mono-tactical font-black text-xl animate-bounce ${
              dmg.isHeadshot ? 'text-amber-300 text-2xl drop-shadow-[0_0_10px_rgba(245,158,11,0.9)]' : 'text-white'
            }`}
            style={{
              transform: `translate(calc(-50% + ${offsetX}px), calc(-50% - 42px))`
            }}
          >
            -{dmg.amount} {dmg.isHeadshot ? 'CRIT' : ''}
          </div>
        );
      })}

      {/* 6–9. DESKTOP BOTTOM CONTROLS HUD (Removed once player dies or when Mobile Touch HUD is active) */}
      {!isMobileHUD && playerData.isAlive && (
        <>
          {/* 6. CONTEXTUAL OBJECTIVE ACTION PROMPT (Plant / Defuse / Pick Up / Drop Spike) */}
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 pointer-events-auto z-20">
            {isInBombSite && !isSpikePlanted && playerData.side === 'attackers' && playerData.hasSpike && roundPhase === 'in_progress' && (
              <button
                onClick={onPlantSpike}
                className="px-5 py-2 rounded-xl bg-red-600/90 hover:bg-red-500 border-2 border-red-300 text-white font-chakra font-black text-xs tracking-widest uppercase flex items-center gap-2 shadow-[0_0_25px_rgba(239,68,68,0.7)] cursor-pointer animate-pulse"
              >
                <Bomb className="w-4 h-4" />
                <span>PRESS [F] TO PLANT NEXUS CORE</span>
              </button>
            )}

            {!isSpikePlanted && playerData.side === 'attackers' && (
              playerData.hasSpike ? (
                <button
                  onClick={onDropSpike}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-950/90 hover:bg-amber-500/20 border border-amber-400/70 text-amber-300 font-chakra font-bold text-[11px] tracking-wider uppercase flex items-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <Bomb className="w-3.5 h-3.5" />
                  <span>CARRYING SPIKE • DROP [V]</span>
                </button>
              ) : (
                <button
                  onClick={onPickupSpike}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600/85 hover:bg-emerald-500 border border-emerald-300 text-white font-chakra font-bold text-[11px] tracking-wider uppercase flex items-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <Bomb className="w-3.5 h-3.5" />
                  <span>PICK UP SPIKE [F / V]</span>
                </button>
              )
            )}

            {isSpikePlanted && playerData.side === 'defenders' && (
              <button
                onClick={onDefuseSpike}
                className="px-5 py-2 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 border-2 border-cyan-300 text-white font-chakra font-black text-xs tracking-widest uppercase flex items-center gap-2 shadow-[0_0_25px_rgba(6,182,212,0.7)] cursor-pointer"
              >
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>PRESS [F] NEAR CORE TO DEFUSE</span>
              </button>
            )}
          </div>

      {/* 7. BOTTOM LEFT: BIOMETRICS, SHIELD, POSTURE & CREDITS */}
      <div className="absolute bottom-4 left-4 flex items-end gap-3 pointer-events-auto">
        <div className="bg-slate-950/92 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2.5 min-w-56 shadow-2xl backdrop-blur-md">
          {/* Operative Header & Posture Badge */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center font-black text-cyan-300 text-xs">
                {agent.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-black text-white uppercase tracking-wider leading-none">
                  {agent.name}
                </div>
                <div className="text-[9px] font-mono-tactical text-cyan-400 uppercase">
                  {agent.role}
                </div>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded text-[9px] font-mono-tactical font-bold uppercase border ${
                isSliding
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : isSprinting
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : isCrouched
                  ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              {postureLabel}
            </span>
          </div>

          {/* Health & Armor Bars */}
          <div className="flex flex-col gap-2">
            {/* Health Readout */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                  <Heart className="w-3.5 h-3.5 fill-emerald-400" /> HEALTH
                </span>
                <span
                  className={`font-mono-tactical font-black text-lg leading-none ${
                    playerData.health <= 30 ? 'text-red-500 animate-pulse' : 'text-emerald-300'
                  }`}
                >
                  {playerData.health}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className={`h-full transition-all duration-150 ${
                    playerData.health <= 30
                      ? 'bg-gradient-to-r from-red-600 to-amber-500'
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                  }`}
                  style={{ width: `${Math.max(0, playerData.health)}%` }}
                />
              </div>
            </div>

            {/* Armor Readout */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1 text-cyan-400 font-bold text-[11px]">
                  <Shield className="w-3.5 h-3.5 fill-cyan-400" /> SHIELD
                </span>
                <span className="font-mono-tactical font-black text-sm leading-none text-cyan-300">
                  {playerData.armor}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-sky-300 transition-all duration-150"
                  style={{ width: `${(playerData.armor / 50) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Credits Balance */}
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-xs">
            <span className="text-slate-400 text-[10px] font-mono-tactical flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-amber-400" /> TACTICAL CREDITS
            </span>
            <span className="font-mono-tactical font-black text-amber-300 text-sm">
              ${playerData.credits}
            </span>
          </div>
        </div>
      </div>

      {/* 8. BOTTOM CENTER: TACTICAL ABILITY & ULTIMATE DOCK */}
      <div className="hidden md:flex absolute bottom-4 left-1/2 -translate-x-1/2 items-end gap-2.5 pointer-events-auto">
        {/* Ability 1 [Q] */}
        <button
          onClick={() => onAbilityTrigger('ability_1')}
          className={`group relative bg-slate-950/90 border rounded-xl px-3.5 py-2 flex flex-col items-center min-w-22 transition-all cursor-pointer backdrop-blur-md ${
            (playerData.abilityCharges['ability_1'] ?? 0) > 0
              ? 'border-cyan-500/50 hover:border-cyan-400 shadow-lg'
              : 'border-slate-800 opacity-50'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono-tactical font-bold text-cyan-300">
              Q
            </span>
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <span className="text-[11px] font-bold text-white uppercase tracking-wide truncate max-w-20">
            {agent.ability1.name}
          </span>
          {/* Charge Dots */}
          <div className="flex items-center gap-1 mt-1.5">
            {Array.from({ length: agent.ability1.charges }).map((_, idx) => (
              <span
                key={idx}
                className={`w-2 h-2 rounded-full ${
                  idx < (playerData.abilityCharges['ability_1'] ?? 0)
                    ? 'bg-cyan-400 shadow-[0_0_6px_rgba(0,240,255,0.9)]'
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </button>

        {/* Ability 2 [E] */}
        <button
          onClick={() => onAbilityTrigger('ability_2')}
          className={`group relative bg-slate-950/90 border rounded-xl px-3.5 py-2 flex flex-col items-center min-w-22 transition-all cursor-pointer backdrop-blur-md ${
            (playerData.abilityCharges['ability_2'] ?? 0) > 0
              ? 'border-purple-500/50 hover:border-purple-400 shadow-lg'
              : 'border-slate-800 opacity-50'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono-tactical font-bold text-purple-300">
              E
            </span>
            <Eye className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-[11px] font-bold text-white uppercase tracking-wide truncate max-w-20">
            {agent.ability2.name}
          </span>
          <div className="flex items-center gap-1 mt-1.5">
            {Array.from({ length: agent.ability2.charges }).map((_, idx) => (
              <span
                key={idx}
                className={`w-2 h-2 rounded-full ${
                  idx < (playerData.abilityCharges['ability_2'] ?? 0)
                    ? 'bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.9)]'
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </button>

        {/* Ability 3 [C] */}
        <button
          onClick={() => onAbilityTrigger('ability_3')}
          className={`group relative bg-slate-950/90 border rounded-xl px-3.5 py-2 flex flex-col items-center min-w-22 transition-all cursor-pointer backdrop-blur-md ${
            (playerData.abilityCharges['ability_3'] ?? 0) > 0
              ? 'border-emerald-500/50 hover:border-emerald-400 shadow-lg'
              : 'border-slate-800 opacity-50'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono-tactical font-bold text-emerald-300">
              C
            </span>
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-[11px] font-bold text-white uppercase tracking-wide truncate max-w-20">
            {agent.ability3.name}
          </span>
          <div className="flex items-center gap-1 mt-1.5">
            {Array.from({ length: agent.ability3.charges }).map((_, idx) => (
              <span
                key={idx}
                className={`w-2 h-2 rounded-full ${
                  idx < (playerData.abilityCharges['ability_3'] ?? 0)
                    ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]'
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </button>

        {/* Ultimate Ability [X] */}
        <button
          onClick={onUltimateTrigger}
          className={`group relative bg-slate-950/95 border-2 rounded-xl px-4 py-2 flex flex-col items-center min-w-26 transition-all cursor-pointer backdrop-blur-md ${
            isUltReady
              ? 'border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.5)] animate-pulse'
              : 'border-slate-800 opacity-75'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/60 text-[10px] font-mono-tactical font-bold text-amber-300">
              X
            </span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="text-[11px] font-black text-amber-300 uppercase tracking-wide truncate max-w-24">
            {agent.ultimate.name}
          </span>
          <span className="text-[10px] font-mono-tactical font-bold text-slate-300 mt-1">
            {isUltReady ? 'READY' : `${playerData.ultPoints} / ${ultRequired} PTS`}
          </span>
        </button>
      </div>

      {/* 9. BOTTOM RIGHT: WEAPON, MAGAZINE PIPS & LOADOUT SLOTS */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 pointer-events-auto">
        {/* Loadout Weapon Slot Tabs [1] Primary / [2] Sidearm / [3] Melee Knife + [Y] Inspect */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onWeaponSwitch('primary')}
            className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono-tactical font-bold uppercase transition-all cursor-pointer ${
              currentWeapon.id === primaryWeapon.id
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-600'
            }`}
          >
            [1] {primaryWeapon.name}
          </button>
          <button
            onClick={() => onWeaponSwitch('secondary')}
            className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono-tactical font-bold uppercase transition-all cursor-pointer ${
              currentWeapon.category === 'Pistols' && currentWeapon.id !== primaryWeapon.id
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-600'
            }`}
          >
            [2] {sidearmWeapon?.name || 'VECTOR-9'}
          </button>
          <button
            onClick={() => onWeaponSwitch('melee')}
            className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono-tactical font-bold uppercase transition-all cursor-pointer ${
              currentWeapon.category === 'Melee'
                ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-600'
            }`}
          >
            [3] {meleeWeapon?.name || 'TAC-KNIFE'}
          </button>
          <button
            onClick={onInspectWeapon}
            className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono-tactical font-bold uppercase transition-all cursor-pointer flex items-center gap-1 ${
              isInspecting
                ? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-[0_0_14px_rgba(245,158,11,0.5)] animate-pulse'
                : 'bg-slate-950/80 border-slate-700/80 text-slate-300 hover:border-cyan-400 hover:text-cyan-200'
            }`}
            title="Inspect current weapon model and flourish (Hotkey: Y or I)"
          >
            <RotateCw className={`w-3 h-3 ${isInspecting ? 'animate-spin' : ''}`} />
            [Y] INSPECT
          </button>
        </div>

        {/* Main Ballistics Readout Card */}
        <div className="bg-slate-950/92 border border-slate-800 rounded-2xl p-3.5 flex flex-col items-end min-w-56 shadow-2xl backdrop-blur-md">
          {/* Weapon Name & Category */}
          <div className="flex items-center justify-between w-full border-b border-slate-800/80 pb-1.5 mb-1.5 gap-3">
            <span className="text-[10px] font-mono-tactical font-bold text-slate-400 uppercase">
              {currentWeapon.category}
            </span>
            <span className="text-sm font-black text-cyan-300 uppercase tracking-wider">
              {currentWeapon.name}
            </span>
          </div>

          {/* Active Weapon Special Ability Chip */}
          {currentWeapon.specialAbility && (
            <div className="w-full mb-2 px-2 py-1 rounded bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-between gap-2">
              <span className="text-[9px] font-mono-tactical font-black text-amber-300 uppercase flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                {currentWeapon.specialAbility.name}
              </span>
              <span className="text-[9px] text-slate-300 truncate max-w-34">
                {currentWeapon.specialAbility.description}
              </span>
            </div>
          )}

          {/* Ammo Digital Counter */}
          {currentWeapon.category === 'Melee' ? (
            <div className="flex items-baseline gap-1.5 font-mono-tactical py-1">
              <span className="text-2xl font-black text-amber-300 tracking-wider uppercase">
                MELEE BLADE
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-1.5 font-mono-tactical">
                <span
                  className={`text-4xl font-black leading-none ${
                    currentAmmo <= 5 ? 'text-red-500 animate-pulse' : 'text-white'
                  }`}
                >
                  {currentAmmo.toString().padStart(2, '0')}
                </span>
                <span className="text-slate-600 text-lg font-bold">/</span>
                <span className="text-slate-400 text-lg font-bold">
                  {reserveAmmo}
                </span>
              </div>

              {/* Visual Magazine Bullet Pips */}
              <div className="flex items-center gap-0.5 mt-2 w-full justify-end">
                {Array.from({ length: maxPips }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2.5 w-1 rounded-xs transition-all duration-75 ${
                      idx < filledPips
                        ? currentAmmo <= 5
                          ? 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]'
                          : 'bg-cyan-400 shadow-[0_0_4px_rgba(0,240,255,0.6)]'
                        : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Reloading, Inspecting, or Firemode Status */}
          <div className="flex items-center justify-between w-full mt-2 pt-1 border-t border-slate-800/80 text-[10px] font-mono-tactical">
            <span className="text-slate-500 uppercase">
              {currentWeapon.fireMode.toUpperCase()} MODE
            </span>
            {isInspecting ? (
              <span className="font-bold text-cyan-300 tracking-wider uppercase animate-pulse">
                INSPECTING • [Y] CANCEL
              </span>
            ) : currentWeapon.category === 'Melee' ? (
              <span className="text-amber-300 font-bold">SLASH READY • [Y] INSPECT</span>
            ) : isReloading ? (
              <span className="font-bold text-amber-400 tracking-widest uppercase animate-pulse">
                RELOADING...
              </span>
            ) : (
              <span className="text-slate-400">[R] RELOAD • [Y] INSPECT</span>
            )}
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
