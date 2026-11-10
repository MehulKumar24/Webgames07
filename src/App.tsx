import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { 
  GameMode, 
  MapData, 
  Agent, 
  Weapon, 
  BotDifficulty, 
  ControlSettings, 
  GraphicsSettings, 
  AudioSettings, 
  MatchPlayer,
  KillFeedEntry,
  DamageNumber,
  TacticalChatEntry
} from './types/game';
import { AGENTS } from './data/agents';
import { WEAPONS } from './data/weapons';
import { MAPS } from './data/maps';
import type { GameEngine, RadarTelemetry } from './engine/gameEngine';
const MainMenu = lazy(() => import('./components/MainMenu').then(module => ({ default: module.MainMenu })));
const AgentSelect = lazy(() => import('./components/AgentSelect').then(module => ({ default: module.AgentSelect })));
const ArmoryView = lazy(() => import('./components/ArmoryView').then(module => ({ default: module.ArmoryView })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(module => ({ default: module.SettingsModal })));
import { DesktopHUD } from './components/DesktopHUD';
import { TouchHUD } from './components/TouchHUD';
import { BuyMenu } from './components/BuyMenu';
import { ScoreboardModal } from './components/ScoreboardModal';
import { TacticalFullMapModal } from './components/TacticalMap';
const MatchSummaryScreen = lazy(() =>
  import('./components/MatchSummaryScreen').then(module => ({ default: module.MatchSummaryScreen }))
);
import { soundEngine } from './audio/soundEngine';
import { pickRandomVoiceLine } from './data/voiceLines';
import { Menu, Smartphone, Monitor, Trophy } from 'lucide-react';

// Deep-clone player data for UI snapshot (avoids nested object reference aliasing with engine state)
function clonePlayerData(data: MatchPlayer): MatchPlayer {
  return JSON.parse(JSON.stringify(data)) as MatchPlayer;
}

function areRadarStatesEqual(a: RadarTelemetry | null, b: RadarTelemetry): boolean {
  if (!a) return false;
  const samePosition = (
    left: { x: number; z: number } | null | undefined,
    right: { x: number; z: number } | null | undefined
  ) => left === right || (!!left && !!right && left.x === right.x && left.z === right.z);
  const sameArray = <T,>(left: T[], right: T[], equals: (a: T, b: T) => boolean) =>
    left.length === right.length && left.every((item, index) => equals(item, right[index]));

  return (
    a.playerX === b.playerX &&
    a.playerZ === b.playerZ &&
    a.playerYaw === b.playerYaw &&
    a.currentCallout === b.currentCallout &&
    a.spikeCarrierId === b.spikeCarrierId &&
    samePosition(a.spikePosition, b.spikePosition) &&
    samePosition(a.droppedSpikePosition, b.droppedSpikePosition) &&
    sameArray(a.walls, b.walls, (left, right) =>
      left.minX === right.minX &&
      left.minZ === right.minZ &&
      left.maxX === right.maxX &&
      left.maxZ === right.maxZ &&
      left.isWall === right.isWall &&
      left.isCover === right.isCover &&
      left.isExplosiveBarrel === right.isExplosiveBarrel
    ) &&
    sameArray(a.blips, b.blips, (left, right) =>
      left.id === right.id &&
      left.name === right.name &&
      left.agentId === right.agentId &&
      left.team === right.team &&
      left.x === right.x &&
      left.z === right.z &&
      left.yaw === right.yaw &&
      left.isAlive === right.isAlive &&
      left.isPlayer === right.isPlayer &&
      left.isSpotted === right.isSpotted &&
      left.health === right.health &&
      left.fsmState === right.fsmState
    ) &&
    sameArray(a.abilities, b.abilities, (left, right) =>
      left.id === right.id &&
      left.type === right.type &&
      left.team === right.team &&
      left.x === right.x &&
      left.z === right.z
    ) &&
    sameArray(a.pings, b.pings, (left, right) =>
      left.id === right.id &&
      left.x === right.x &&
      left.z === right.z &&
      left.label === right.label &&
      left.createdAt === right.createdAt
    )
  );
}

type HudSnapshot = {
  currentAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  isAds: boolean;
  isCrouched: boolean;
  isSliding: boolean;
  isSprinting: boolean;
  activeWeapon: Weapon | null;
  primaryWeapon: Weapon | null;
  sidearmWeapon: Weapon | null;
  meleeWeapon: Weapon | null;
  roundTime: number;
  buyPhaseTime: number;
  roundNumber: number;
  targetWins: number;
  isOvertime: boolean;
  playerDataSignature: string;
  allPlayersSignature: string;
  radarData: RadarTelemetry | null;
  isInspecting: boolean;
  isPointerLocked: boolean;
  isInBombSite: boolean;
};

export default function App() {
  // Navigation & Screen View State
  const [currentView, setCurrentView] = useState<'menu' | 'playing' | 'agent_select' | 'armory' | 'match_summary'>('menu');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBuyMenuOpen, setIsBuyMenuOpen] = useState<boolean>(false);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState<boolean>(false);
  const [isFullMapOpen, setIsFullMapOpen] = useState<boolean>(false);
  const [forceTouchHUD, setForceTouchHUD] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 840;
  });
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);

  // Match Configuration
  const [selectedMode, setSelectedMode] = useState<GameMode>('tactical_plant');
  const [selectedMap, setSelectedMap] = useState<MapData>(MAPS[0]);
  const [selectedAgent, setSelectedAgent] = useState<Agent>(AGENTS[0]); // Vortex
  const [selectedWeapon, setSelectedWeapon] = useState<Weapon>(
    WEAPONS.find(w => w.id === 'wpn_apexar') || WEAPONS[0]
  );
  const [sidearmWeapon, setSidearmWeapon] = useState<Weapon>(
    WEAPONS.find(w => w.id === 'wpn_vector9') || WEAPONS[0]
  );
  const [meleeWeapon, setMeleeWeapon] = useState<Weapon>(
    WEAPONS.find(w => w.id === 'wpn_tac_knife') || WEAPONS[0]
  );
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('Normal');

  // Hardware & Controls Settings
  const [controlsSettings, setControlsSettings] = useState<ControlSettings>({
    lookSensitivityX: 2.0,
    lookSensitivityY: 2.0,
    adsSensitivityMultiplier: 0.75,
    invertY: false,
    buttonScale: 1.0,
    buttonOpacity: 0.9,
    gyroscopeEnabled: false,
    gyroSensitivity: 1.5,
    leftHandedMode: false,
    autoReload: true,
    tapToFire: false
  });

  const [graphicsSettings, setGraphicsSettings] = useState<GraphicsSettings>({
    preset: 'High',
    shadows: true,
    particleQuality: 'high',
    fov: 90,
    postProcessing: false,
    targetFps: 60
  });

  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    masterVolume: 0.8,
    sfxVolume: 0.9,
    voiceVolume: 0.8,
    musicVolume: 0.5,
    muted: false
  });

  // Game Runtime State
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const uiTimeouts = useRef(new Set<number>());
  const scheduleUiTimeout = (callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(() => {
      uiTimeouts.current.delete(timeoutId);
      callback();
    }, delay);
    uiTimeouts.current.add(timeoutId);
    return timeoutId;
  };
  const lastHudValues = useRef<HudSnapshot>({
    currentAmmo: -1,
    reserveAmmo: -1,
    isReloading: false,
    isAds: false,
    isCrouched: false,
    isSliding: false,
    isSprinting: false,
    activeWeapon: null,
    primaryWeapon: null,
    sidearmWeapon: null,
    meleeWeapon: null,
    roundTime: -1,
    buyPhaseTime: -1,
    roundNumber: -1,
    targetWins: -1,
    isOvertime: false,
    playerDataSignature: '',
    allPlayersSignature: '',
    radarData: null,
    isInspecting: false,
    isPointerLocked: false,
    isInBombSite: false,
  });

  // HUD Realtime State
  const [alphaScore, setAlphaScore] = useState<number>(0);
  const [omegaScore, setOmegaScore] = useState<number>(0);
  const [roundTime, setRoundTime] = useState<number>(100);
  const [buyPhaseTime, setBuyPhaseTime] = useState<number>(60);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [targetWins, setTargetWins] = useState<number>(7);
  const [isOvertime, setIsOvertime] = useState<boolean>(false);
  const [roundPhase, setRoundPhase] = useState<'buy_phase' | 'in_progress' | 'round_end' | 'match_end'>('buy_phase');
  const [roundMessage, setRoundMessage] = useState<string>('BUY PHASE - 60 SECONDS');
  const [isSpikePlanted, setIsSpikePlanted] = useState<boolean>(false);
  const [spikeTime, setSpikeTime] = useState<number>(45);
  const [crosshairBloom, setCrosshairBloom] = useState<number>(0);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const [tacticalChatLog, setTacticalChatLog] = useState<TacticalChatEntry[]>([]);
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [currentAmmo, setCurrentAmmo] = useState<number>(25);
  const [reserveAmmo, setReserveAmmo] = useState<number>(75);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [isAds, setIsAds] = useState<boolean>(false);
  const [isCrouched, setIsCrouched] = useState<boolean>(false);
  const [isInBombSite, setIsInBombSite] = useState<boolean>(false);
  const [isTakingDamage, setIsTakingDamage] = useState<boolean>(false);
  const [flashIntensity, setFlashIntensity] = useState<number>(0);
  const [multikillBanner, setMultikillBanner] = useState<string | null>(null);
  const [isSliding, setIsSliding] = useState<boolean>(false);
  const [isSprinting, setIsSprinting] = useState<boolean>(false);
  const [radarData, setRadarData] = useState<RadarTelemetry | null>(null);
  const [hitmarker, setHitmarker] = useState<{ active: boolean; isHeadshot: boolean }>({
    active: false,
    isHeadshot: false
  });
  const [activeWeapon, setActiveWeapon] = useState<Weapon>(selectedWeapon);

  // Player Telemetry Data
  const [playerData, setPlayerData] = useState<MatchPlayer>({
    id: 'player',
    name: 'OPERATIVE',
    agentId: selectedAgent.id,
    isBot: false,
    team: 'alpha',
    side: 'attackers',
    hasSpike: true,
    health: 100,
    maxHealth: 100,
    armor: 50,
    maxArmor: 50,
    credits: 2400,
    isAlive: true,
    isPlanting: false,
    isDefusing: false,
    ultPoints: 3,
    currentWeaponId: selectedWeapon.id,
    sidearmWeaponId: 'wpn_vector9',
    meleeWeaponId: 'wpn_tac_knife',
    inventory: [selectedWeapon.id, 'wpn_vector9', 'wpn_tac_knife'],
    abilityCooldowns: {},
    abilityCharges: {
      ability_1: 2,
      ability_2: 2,
      ability_3: 1
    },
    stats: {
      kills: 0,
      deaths: 0,
      assists: 0,
      score: 0,
      headshots: 0,
      damageDealt: 0,
      plants: 0,
      defuses: 0
    }
  });

  const [allPlayers, setAllPlayers] = useState<MatchPlayer[]>([]);

  // Detect touch capability (desktop mice take priority unless user explicitly toggles mobile HUD or screen is mobile)
  const isTouchDevice = () => {
    if (forceTouchHUD) return true;
    if (typeof window !== 'undefined') {
      return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 840;
    }
    return false;
  };

  // Sync audio volume settings with SoundEngine
  useEffect(() => {
    soundEngine.setVolumes(
      audioSettings.masterVolume,
      audioSettings.sfxVolume,
      audioSettings.musicVolume,
      audioSettings.muted,
      audioSettings.voiceVolume
    );
  }, [audioSettings]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.controlsSettings = controlsSettings;
    engine.graphicsSettings = graphicsSettings;
  }, [controlsSettings, graphicsSettings]);

  // Start game session
  const startGame = () => {
    soundEngine.init();
    soundEngine.setVolumes(
      audioSettings.masterVolume,
      audioSettings.sfxVolume,
      audioSettings.musicVolume,
      audioSettings.muted,
      audioSettings.voiceVolume
    );
    setCurrentView('playing');
  };

  // Mount 3D GameEngine when entering 'playing' view
  useEffect(() => {
    if (currentView !== 'playing' || !canvasMountRef.current) return;

    let cancelled = false;
    let engineInstance: GameEngine | null = null;
    let hudInterval: number | undefined;

    void import('./engine/gameEngine').then(({ GameEngine: GameEngineClass }) => {
      if (cancelled || !canvasMountRef.current) return;

    const mount = canvasMountRef.current;
    while (mount.children.length > 0) {
      mount.removeChild(mount.children[0]);
    }

    const engine = new GameEngineClass(
      mount,
      selectedMap,
      selectedMode,
      selectedAgent,
      selectedWeapon,
      controlsSettings,
      graphicsSettings,
      {
        onScoreUpdate: (alpha, omega) => {
          setAlphaScore(alpha);
          setOmegaScore(omega);
        },
        onRoundStateChange: (state, message) => {
          setRoundPhase(state);
          if (state === 'buy_phase') {
            setKillFeed([]);
          }
          if (message) {
            setRoundMessage(message);
            scheduleUiTimeout(() => setRoundMessage(''), 4200);
          }
        },
        onPlayerStatsChange: (pData) => {
          setPlayerData(clonePlayerData(pData));
        },
        onKillFeed: (entry) => {
          setKillFeed(prev => [...prev.slice(-3), entry]);
          scheduleUiTimeout(() => {
            setKillFeed(prev => prev.filter(k => k.id !== entry.id));
          }, 2600);
        },
        onDamageNumber: (dmg) => {
          setDamageNumbers(prev => [...prev.slice(-4), dmg]);
          scheduleUiTimeout(() => {
            setDamageNumbers(prev => prev.filter(d => d.id !== dmg.id));
          }, 1200);
        },
        onSpikeStateChange: (planted, time) => {
          setIsSpikePlanted(planted);
          setSpikeTime(time);
        },
        onCrosshairBloom: (bloom) => {
          setCrosshairBloom(bloom);
        },
        onPlayerTakeDamage: () => {
          setIsTakingDamage(true);
          scheduleUiTimeout(() => setIsTakingDamage(false), 200);
        },
        onBuyMenuToggle: (open) => {
          setIsBuyMenuOpen(open);
        },
        onFlashUpdate: (intensity) => {
          setFlashIntensity(intensity);
        },
        onMultikill: (text) => {
          setMultikillBanner(text);
          scheduleUiTimeout(() => {
            setMultikillBanner(null);
          }, 2400);
        },
        onMapToggle: () => {
          setIsFullMapOpen(prev => !prev);
        },
        onScoreboardToggle: () => {
          setIsScoreboardOpen(prev => !prev);
        },
        onHitmarker: (isHeadshot) => {
          setHitmarker({ active: true, isHeadshot });
          scheduleUiTimeout(() => {
            setHitmarker({ active: false, isHeadshot: false });
          }, 180);
        },
        onVoiceLine: () => {
          // Audio-only voice lines (no on-screen dialogue text popup)
        },
        onTacticalChat: (entry) => {
          setTacticalChatLog(prev => [...prev.slice(-45), entry]);
        },
        onMatchEnd: (_winner, finalPlayers, finalAlpha, finalOmega) => {
          if (document.pointerLockElement) {
            document.exitPointerLock();
          }
          setAllPlayers([...finalPlayers]);
          setAlphaScore(finalAlpha);
          setOmegaScore(finalOmega);
          setCurrentView('match_summary');
        }
      },
      botDifficulty
    );

    engineInstance = engine;
    engineRef.current = engine;
    engine.start();

    setAllPlayers(engine.allPlayers);
    setActiveWeapon(engine.currentWeapon);
    setSelectedWeapon(engine.primaryWeapon);
    setSidearmWeapon(engine.sidearmWeapon);
    setMeleeWeapon(engine.meleeWeapon);
    setRadarData(engine.getRadarState());

    // Sync loop for HUD telemetry
    hudInterval = window.setInterval(() => {
      const currentEngine = engine;
      if (!currentEngine) return;

      // Only update React state when values actually change
      if (currentEngine.currentAmmo !== lastHudValues.current.currentAmmo) {
        setCurrentAmmo(currentEngine.currentAmmo);
        lastHudValues.current.currentAmmo = currentEngine.currentAmmo;
      }
      if (currentEngine.reserveAmmo !== lastHudValues.current.reserveAmmo) {
        setReserveAmmo(currentEngine.reserveAmmo);
        lastHudValues.current.reserveAmmo = currentEngine.reserveAmmo;
      }
      if (currentEngine.isReloading !== lastHudValues.current.isReloading) {
        setIsReloading(currentEngine.isReloading);
        lastHudValues.current.isReloading = currentEngine.isReloading;
      }
      if (currentEngine.isAds !== lastHudValues.current.isAds) {
        setIsAds(currentEngine.isAds);
        lastHudValues.current.isAds = currentEngine.isAds;
      }
      if (currentEngine.isCrouched !== lastHudValues.current.isCrouched) {
        setIsCrouched(currentEngine.isCrouched);
        lastHudValues.current.isCrouched = currentEngine.isCrouched;
      }
      if (currentEngine.isSliding !== lastHudValues.current.isSliding) {
        setIsSliding(currentEngine.isSliding);
        lastHudValues.current.isSliding = currentEngine.isSliding;
      }
      if (currentEngine.isSprinting !== lastHudValues.current.isSprinting) {
        setIsSprinting(currentEngine.isSprinting);
        lastHudValues.current.isSprinting = currentEngine.isSprinting;
      }
      if (currentEngine.currentWeapon !== lastHudValues.current.activeWeapon) {
        setActiveWeapon(currentEngine.currentWeapon);
        lastHudValues.current.activeWeapon = currentEngine.currentWeapon;
      }
      if (currentEngine.primaryWeapon !== lastHudValues.current.primaryWeapon) {
        setSelectedWeapon(currentEngine.primaryWeapon);
        lastHudValues.current.primaryWeapon = currentEngine.primaryWeapon;
      }
      if (currentEngine.sidearmWeapon !== lastHudValues.current.sidearmWeapon) {
        setSidearmWeapon(currentEngine.sidearmWeapon);
        lastHudValues.current.sidearmWeapon = currentEngine.sidearmWeapon;
      }
      if (currentEngine.meleeWeapon !== lastHudValues.current.meleeWeapon) {
        setMeleeWeapon(currentEngine.meleeWeapon);
        lastHudValues.current.meleeWeapon = currentEngine.meleeWeapon;
      }
      if (currentEngine.roundTimeRemaining !== lastHudValues.current.roundTime) {
        setRoundTime(currentEngine.roundTimeRemaining);
        lastHudValues.current.roundTime = currentEngine.roundTimeRemaining;
      }
      if (currentEngine.buyPhaseTime !== lastHudValues.current.buyPhaseTime) {
        setBuyPhaseTime(currentEngine.buyPhaseTime);
        lastHudValues.current.buyPhaseTime = currentEngine.buyPhaseTime;
      }
      if (currentEngine.roundNumber !== lastHudValues.current.roundNumber) {
        setRoundNumber(currentEngine.roundNumber);
        lastHudValues.current.roundNumber = currentEngine.roundNumber;
      }
      if (currentEngine.targetWins !== lastHudValues.current.targetWins) {
        setTargetWins(currentEngine.targetWins);
        lastHudValues.current.targetWins = currentEngine.targetWins;
      }
      if (currentEngine.isOvertime !== lastHudValues.current.isOvertime) {
        setIsOvertime(currentEngine.isOvertime);
        lastHudValues.current.isOvertime = currentEngine.isOvertime;
      }
      const playerDataSignature = JSON.stringify(currentEngine.playerMatchData);
      if (playerDataSignature !== lastHudValues.current.playerDataSignature) {
        setPlayerData(clonePlayerData(currentEngine.playerMatchData));
        lastHudValues.current.playerDataSignature = playerDataSignature;
      }
      const allPlayersSignature = JSON.stringify(currentEngine.allPlayers);
      if (allPlayersSignature !== lastHudValues.current.allPlayersSignature) {
        setAllPlayers([...currentEngine.allPlayers]);
        lastHudValues.current.allPlayersSignature = allPlayersSignature;
      }
      const nextRadarData = currentEngine.getRadarState();
      if (!areRadarStatesEqual(lastHudValues.current.radarData, nextRadarData)) {
        setRadarData(nextRadarData);
        lastHudValues.current.radarData = nextRadarData;
      }
      if (currentEngine.isInspecting !== lastHudValues.current.isInspecting) {
        setIsInspecting(currentEngine.isInspecting);
        lastHudValues.current.isInspecting = currentEngine.isInspecting;
      }
      if (currentEngine.isPointerLocked !== lastHudValues.current.isPointerLocked) {
        setIsPointerLocked(currentEngine.isPointerLocked);
        lastHudValues.current.isPointerLocked = currentEngine.isPointerLocked;
      }

      // Bomb-site proximity check
      const pos = currentEngine.playerPosition;
      const distA = Math.hypot(pos.x - selectedMap.siteA.x, pos.z - selectedMap.siteA.z);
      const distB = Math.hypot(pos.x - selectedMap.siteB.x, pos.z - selectedMap.siteB.z);
      const inSite = distA <= selectedMap.siteA.radius || distB <= selectedMap.siteB.radius;
      if (inSite !== (lastHudValues.current.isInBombSite ?? false)) setIsInBombSite(inSite);
      lastHudValues.current.isInBombSite = inSite;
    }, 90);
    }).catch(error => {
      if (!cancelled) {
        console.error('Failed to load the game engine:', error);
        setCurrentView('menu');
      }
    });

    return () => {
      cancelled = true;
      if (hudInterval !== undefined) window.clearInterval(hudInterval);
      for (const timeoutId of uiTimeouts.current) {
        window.clearTimeout(timeoutId);
      }
      uiTimeouts.current.clear();
      engineInstance?.stop();
      engineRef.current = null;
    };
  }, [currentView, selectedMap, selectedMode, selectedAgent, botDifficulty]);

  // Handle weapon purchase in BuyMenu
  const handleBuyWeapon = (weapon: Weapon) => {
    if (!engineRef.current) return;
    const engine = engineRef.current;
    if (playerData.credits < weapon.cost) return;

    engine.playerMatchData.credits -= weapon.cost;
    if (weapon.category === 'Melee') {
      engine.meleeWeapon = weapon;
      engine.playerMatchData.meleeWeaponId = weapon.id;
      setMeleeWeapon(weapon);
    } else if (weapon.category === 'Pistols') {
      engine.sidearmWeapon = weapon;
      engine.playerMatchData.sidearmWeaponId = weapon.id;
      setSidearmWeapon(weapon);
    } else {
      engine.primaryWeapon = weapon;
      setSelectedWeapon(weapon);
    }
    engine.switchWeapon(weapon);
    setActiveWeapon(weapon);
    setPlayerData(clonePlayerData(engine.playerMatchData));
    setCurrentAmmo(weapon.magazineSize);
    setReserveAmmo(weapon.reserveAmmo);
  };

  // Handle shield purchase
  const handleBuyShield = (type: 'light' | 'heavy') => {
    if (!engineRef.current) return;
    const engine = engineRef.current;
    const cost = type === 'light' ? 400 : 1000;
    const armorAmount = type === 'light' ? 25 : 50;

    if (playerData.credits < cost) return;
    engine.playerMatchData.credits -= cost;
    engine.playerMatchData.armor = armorAmount;
    setPlayerData(clonePlayerData(engine.playerMatchData));
  };

  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-950 text-sm font-bold tracking-widest text-cyan-300">
        LOADING PROTOCOL: APEX...
      </div>
    }>
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-chakra">
      {/* 3D Canvas Mount (Active during match) */}
      <div 
        ref={canvasMountRef} 
        className={`absolute inset-0 w-full h-full ${currentView === 'playing' ? 'block' : 'hidden'}`}
      />

      {/* Screen Damage Red Vignette */}
      {isTakingDamage && (
        <div className="absolute inset-0 pointer-events-none z-30 bg-red-600/30 shadow-[inset_0_0_80px_rgba(239,68,68,0.8)]" />
      )}

      {/* Flashbang Blind Whiteout Overlay */}
      {flashIntensity > 0.01 && (
        <div 
          className="absolute inset-0 pointer-events-none z-45 bg-white transition-opacity duration-75"
          style={{ opacity: Math.min(1, flashIntensity) }}
        />
      )}

      {/* Multikill Banner (Double Kill, Ace, etc.) */}
      {multikillBanner && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center">
          <div className="px-6 py-2 rounded-xl bg-slate-950/95 border border-amber-400 text-amber-300 font-chakra font-bold text-2xl md:text-3xl tracking-wider shadow-[0_0_30px_rgba(245,158,11,0.7)]">
            {multikillBanner}
          </div>
        </div>
      )}

      {/* Tactical Combat Slide Indicator */}
      {isSliding && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-35 pointer-events-none flex items-center gap-2 px-4 py-1.5 rounded-lg bg-slate-950/90 border border-cyan-400/70 text-cyan-300 font-chakra font-semibold tracking-wider text-xs">
          <span>Combat Slide</span>
        </div>
      )}

      {/* IN-GAME TOP ESCAPE & TOUCH TOGGLE BUTTONS */}
      {currentView === 'playing' && (
        <div className="absolute top-3 left-48 z-25 flex items-center gap-2 pointer-events-auto">
          {/* Pause / Return to Menu Button */}
          <button
            onClick={() => {
              soundEngine.playUIClick();
              setCurrentView('menu');
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-950/85 border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-xs"
          >
            <Menu className="w-3.5 h-3.5" />
            <span>MENU</span>
          </button>

          {/* Toggle Mobile Touch HUD mode */}
          <button
            onClick={() => setForceTouchHUD(!forceTouchHUD)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-xs ${
              isTouchDevice()
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-300'
                : 'bg-slate-950/85 border-slate-700 text-slate-400'
            }`}
            title="Toggle Touch HUD layout"
          >
            {isTouchDevice() ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
            <span>{isTouchDevice() ? 'MOBILE HUD' : 'DESKTOP HUD'}</span>
          </button>

          {/* End Match / Post-Match Summary Showcase Button */}
          <button
            onClick={() => {
              soundEngine.playUIClick();
              if (document.pointerLockElement) {
                document.exitPointerLock();
              }
              if (engineRef.current) {
                setAllPlayers([...engineRef.current.allPlayers]);
                setAlphaScore(engineRef.current.alphaScore);
                setOmegaScore(engineRef.current.omegaScore);
              }
              setCurrentView('match_summary');
            }}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/70 hover:bg-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-xs"
            title="Conclude match and view End of Match Summary Screen"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>END MATCH</span>
          </button>
        </div>
      )}

      {/* DESKTOP & MOBILE IN-GAME HUDs */}
      {currentView === 'playing' && (
        <>
          <DesktopHUD
            agent={selectedAgent}
            currentWeapon={activeWeapon}
            primaryWeapon={selectedWeapon}
            sidearmWeapon={sidearmWeapon}
            meleeWeapon={meleeWeapon}
            playerData={playerData}
            mapData={selectedMap}
            radar={radarData}
            alphaScore={alphaScore}
            omegaScore={omegaScore}
            roundTime={roundTime}
            buyPhaseTime={buyPhaseTime}
            roundNumber={roundNumber}
            targetWins={targetWins}
            isOvertime={isOvertime}
            isSpikePlanted={isSpikePlanted}
            spikeTime={spikeTime}
            roundPhase={roundPhase}
            roundMessage={roundMessage}
            crosshairBloom={crosshairBloom}
            hitmarker={hitmarker}
            killFeed={killFeed}
            tacticalChatLog={tacticalChatLog}
            damageNumbers={damageNumbers}
            currentAmmo={currentAmmo}
            reserveAmmo={reserveAmmo}
            isReloading={isReloading}
            isAds={isAds}
            isCrouched={isCrouched}
            isSprinting={isSprinting}
            isSliding={isSliding}
            isInBombSite={isInBombSite}
            allPlayers={allPlayers}
            onOpenBuyMenu={() => setIsBuyMenuOpen(true)}
            onOpenScoreboard={() => setIsScoreboardOpen(true)}
            onOpenFullMap={() => setIsFullMapOpen(true)}
            onPlacePing={(x, z) => {
              if (engineRef.current) {
                engineRef.current.placeTacticalPing(x, z);
              }
            }}
            onSendTeamComm={(msg, category, calloutLocation) => {
              if (engineRef.current) {
                soundEngine.playUIClick();
                engineRef.current.sendTeamComm(msg, category, playerData.name, calloutLocation, true);
              }
            }}
            onAbilityTrigger={(type) => {
              if (engineRef.current) engineRef.current.triggerAbility(type);
            }}
            onUltimateTrigger={() => {
              if (engineRef.current) engineRef.current.triggerUltimate();
            }}
            onWeaponSwitch={(type) => {
              if (!engineRef.current) return;
              const targetWpn =
                type === 'primary'
                  ? engineRef.current.primaryWeapon
                  : type === 'secondary'
                    ? engineRef.current.sidearmWeapon
                    : engineRef.current.meleeWeapon;
              engineRef.current.switchWeapon(targetWpn);
              setActiveWeapon(targetWpn);
            }}
            onPlantSpike={() => {
              if (engineRef.current) engineRef.current.plantSpike();
            }}
            onDefuseSpike={() => {
              if (engineRef.current) engineRef.current.defuseSpike();
            }}
            onDropSpike={() => {
              if (engineRef.current) engineRef.current.dropSpike();
            }}
            onPickupSpike={() => {
              if (engineRef.current) engineRef.current.pickupSpike();
            }}
            onRollRandomWeapon={() => {
              if (engineRef.current) {
                engineRef.current.rollRandomWeapon();
                setSelectedWeapon(engineRef.current.primaryWeapon);
                setActiveWeapon(engineRef.current.currentWeapon);
              }
            }}
            onSkipBuyPhase={() => {
              if (engineRef.current) engineRef.current.skipBuyPhase();
            }}
            isInspecting={isInspecting}
            isPointerLocked={isPointerLocked}
            onInspectWeapon={() => {
              if (engineRef.current) engineRef.current.toggleInspectWeapon();
            }}
            isMobileHUD={isTouchDevice()}
          />

          {/* Touch Overlay HUD (Hidden once player dies) */}
          {isTouchDevice() && playerData.isAlive && (
            <TouchHUD
              agent={selectedAgent}
              currentWeapon={activeWeapon}
              primaryWeapon={selectedWeapon}
              sidearmWeapon={sidearmWeapon}
              meleeWeapon={meleeWeapon}
              playerData={playerData}
              controlsSettings={controlsSettings}
              currentAmmo={currentAmmo}
              reserveAmmo={reserveAmmo}
              isReloading={isReloading}
              isAds={isAds}
              isCrouched={isCrouched}
              isSprinting={isSprinting}
              isSliding={isSliding}
              isSpikePlanted={isSpikePlanted}
              isInBombSite={isInBombSite}
              roundPhase={roundPhase}
              isInspecting={isInspecting}
              onInspectWeapon={() => {
                if (engineRef.current) engineRef.current.toggleInspectWeapon();
              }}
              onMoveInput={(x, y) => {
                if (engineRef.current) {
                  engineRef.current.inputMove.set(x, y);
                }
              }}
              onLookInput={(dx, dy) => {
                if (engineRef.current) {
                  engineRef.current.playerYaw -= dx;
                  const inv = controlsSettings.invertY ? -1 : 1;
                  engineRef.current.playerPitch = Math.max(-1.45, Math.min(1.45, engineRef.current.playerPitch - dy * inv));
                }
              }}
              onFireStart={() => {
                if (engineRef.current) {
                  engineRef.current.isFiring = true;
                  engineRef.current.shootWeapon();
                }
              }}
              onFireEnd={() => {
                if (engineRef.current) engineRef.current.isFiring = false;
              }}
              onAdsToggle={() => {
                if (engineRef.current) engineRef.current.toggleAds();
              }}
              onJump={() => {
                if (engineRef.current) engineRef.current.inputJumpJustPressed = true;
              }}
              onCrouchToggle={() => {
                if (engineRef.current) engineRef.current.isCrouched = !engineRef.current.isCrouched;
              }}
              onSprintToggle={() => {
                if (engineRef.current) engineRef.current.isSprinting = !engineRef.current.isSprinting;
              }}
              onSprintSet={(sprinting) => {
                if (engineRef.current) engineRef.current.isSprinting = sprinting;
              }}
              onReload={() => {
                if (engineRef.current) engineRef.current.reload();
              }}
              onAbilityTrigger={(type) => {
                if (engineRef.current) engineRef.current.triggerAbility(type);
              }}
              onUltimateTrigger={() => {
                if (engineRef.current) engineRef.current.triggerUltimate();
              }}
              onPlantSpike={() => {
                if (engineRef.current) engineRef.current.plantSpike();
              }}
              onDefuseSpike={() => {
                if (engineRef.current) engineRef.current.defuseSpike();
              }}
              onDropSpike={() => {
                if (engineRef.current) engineRef.current.dropSpike();
              }}
              onPickupSpike={() => {
                if (engineRef.current) engineRef.current.pickupSpike();
              }}
              onRollRandomWeapon={() => {
                if (engineRef.current) {
                  engineRef.current.rollRandomWeapon();
                  setSelectedWeapon(engineRef.current.primaryWeapon);
                  setActiveWeapon(engineRef.current.currentWeapon);
                }
              }}
              onWeaponSwitch={(type) => {
                if (!engineRef.current) return;
                const targetWpn =
                  type === 'primary'
                    ? engineRef.current.primaryWeapon
                    : type === 'secondary'
                      ? engineRef.current.sidearmWeapon
                      : engineRef.current.meleeWeapon;
                engineRef.current.switchWeapon(targetWpn);
                setActiveWeapon(targetWpn);
              }}
              onOpenBuyMenu={() => {
                if (document.pointerLockElement) document.exitPointerLock();
                setIsBuyMenuOpen(true);
              }}
              onOpenScoreboard={() => {
                if (document.pointerLockElement) document.exitPointerLock();
                setIsScoreboardOpen(true);
              }}
              onOpenFullMap={() => {
                if (document.pointerLockElement) document.exitPointerLock();
                setIsFullMapOpen(true);
              }}
              onQuickPing={() => {
                if (!engineRef.current) return;
                const pos = engineRef.current.playerPosition;
                const yaw = engineRef.current.playerYaw;
                const pingX = pos.x - Math.sin(yaw) * 14;
                const pingZ = pos.z - Math.cos(yaw) * 14;
                engineRef.current.placeTacticalPing(pingX, pingZ);
              }}
              onUpdateControls={setControlsSettings}
            />
          )}
        </>
      )}

      {/* MAIN MENU SCREEN */}
      {currentView === 'menu' && (
        <MainMenu
          selectedMode={selectedMode}
          selectedMap={selectedMap}
          selectedAgent={selectedAgent}
          selectedWeapon={selectedWeapon}
          botDifficulty={botDifficulty}
          onSelectMode={setSelectedMode}
          onSelectMap={setSelectedMap}
          onSelectDifficulty={setBotDifficulty}
          onStartGame={startGame}
          onOpenAgentSelect={() => setCurrentView('agent_select')}
          onOpenArmory={() => setCurrentView('armory')}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* AGENT SELECTION SCREEN */}
      {currentView === 'agent_select' && (
        <AgentSelect
          selectedAgent={selectedAgent}
          onSelectAgent={(agent) => {
            setSelectedAgent(agent);
            soundEngine.init();
            const line = pickRandomVoiceLine(agent, 'round_start');
            soundEngine.playAgentVoiceLine(agent, 'round_start', line, true);
          }}
          onConfirm={() => setCurrentView('playing')}
          onBack={() => setCurrentView('menu')}
        />
      )}

      {/* ARMORY SCREEN */}
      {currentView === 'armory' && (
        <ArmoryView
          selectedWeapon={selectedWeapon}
          onSelectWeapon={(w) => setSelectedWeapon(w)}
          onBack={() => setCurrentView('menu')}
        />
      )}

      {/* END OF MATCH SUMMARY SCREEN */}
      {currentView === 'match_summary' && (
        <MatchSummaryScreen
          allPlayers={allPlayers.length > 0 ? allPlayers : [playerData]}
          alphaScore={alphaScore}
          omegaScore={omegaScore}
          mapData={selectedMap}
          gameMode={selectedMode}
          onPlayAgain={() => {
            setAlphaScore(0);
            setOmegaScore(0);
            setKillFeed([]);
            setCurrentView('playing');
          }}
          onReturnToMenu={() => {
            setAlphaScore(0);
            setOmegaScore(0);
            setKillFeed([]);
            setCurrentView('menu');
          }}
        />
      )}

      {/* BUY MENU MODAL */}
      <BuyMenu
        playerData={playerData}
        currentWeapon={selectedWeapon}
        buyPhaseTime={buyPhaseTime}
        isOpen={isBuyMenuOpen}
        onClose={() => setIsBuyMenuOpen(false)}
        onBuyWeapon={handleBuyWeapon}
        onBuyShield={handleBuyShield}
        onRollRandomWeapon={() => {
          if (engineRef.current) {
            engineRef.current.rollRandomWeapon();
            setSelectedWeapon(engineRef.current.primaryWeapon);
            setActiveWeapon(engineRef.current.currentWeapon);
          }
        }}
        onSkipBuyPhase={() => {
          if (engineRef.current) {
            engineRef.current.skipBuyPhase();
            setIsBuyMenuOpen(false);
          }
        }}
        onDropSpike={() => {
          if (engineRef.current) engineRef.current.dropSpike();
        }}
        onPickupSpike={() => {
          if (engineRef.current) engineRef.current.pickupSpike();
        }}
      />

      {/* TAB SCOREBOARD MODAL */}
      <ScoreboardModal
        isOpen={isScoreboardOpen}
        onClose={() => setIsScoreboardOpen(false)}
        allPlayers={allPlayers.length > 0 ? allPlayers : [playerData]}
        alphaScore={alphaScore}
        omegaScore={omegaScore}
        mapData={selectedMap}
      />

      {/* FULL TACTICAL COMMAND MAP MODAL [M] */}
      <TacticalFullMapModal
        isOpen={isFullMapOpen}
        mapData={selectedMap}
        radar={radarData}
        onClose={() => setIsFullMapOpen(false)}
        onPlacePing={(x, z) => {
          if (engineRef.current) {
            engineRef.current.placeTacticalPing(x, z);
          }
        }}
      />

      {/* HARDWARE & CONTROLS SETTINGS MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        controls={controlsSettings}
        graphics={graphicsSettings}
        audio={audioSettings}
        onUpdateControls={setControlsSettings}
        onUpdateGraphics={setGraphicsSettings}
        onUpdateAudio={setAudioSettings}
      />
    </div>
    </Suspense>
  );
}
