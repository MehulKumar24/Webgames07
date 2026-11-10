import React, { useState, useEffect, useRef } from 'react';
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
import { GameEngine, RadarTelemetry } from './engine/gameEngine';
import { MainMenu } from './components/MainMenu';
import { AgentSelect } from './components/AgentSelect';
import { ArmoryView } from './components/ArmoryView';
import { SettingsModal } from './components/SettingsModal';
import { DesktopHUD } from './components/DesktopHUD';
import { TouchHUD } from './components/TouchHUD';
import { BuyMenu } from './components/BuyMenu';
import { ScoreboardModal } from './components/ScoreboardModal';
import { TacticalFullMapModal } from './components/TacticalMap';
import { MatchSummaryScreen } from './components/MatchSummaryScreen';
import { soundEngine } from './audio/soundEngine';
import { pickRandomVoiceLine } from './data/voiceLines';
import { Menu, Smartphone, Monitor, Trophy } from 'lucide-react';

// Deep-clone player data for UI snapshot (avoids nested object reference aliasing with engine state)
function clonePlayerData(data: MatchPlayer): MatchPlayer {
  return JSON.parse(JSON.stringify(data)) as MatchPlayer;
}

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
  const lastHudValues = useRef<any>({
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
    playerData: null,
    allPlayersLen: -1,
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

    const mount = canvasMountRef.current;
    while (mount.children.length > 0) {
      mount.removeChild(mount.children[0]);
    }

    const engine = new GameEngine(
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
            setTimeout(() => setRoundMessage(''), 4200);
          }
        },
        onPlayerStatsChange: (pData) => {
          setPlayerData(clonePlayerData(pData));
        },
        onKillFeed: (entry) => {
          setKillFeed(prev => [...prev.slice(-3), entry]);
          setTimeout(() => {
            setKillFeed(prev => prev.filter(k => k.id !== entry.id));
          }, 2600);
        },
        onDamageNumber: (dmg) => {
          setDamageNumbers(prev => [...prev.slice(-4), dmg]);
          setTimeout(() => {
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
          setTimeout(() => setIsTakingDamage(false), 200);
        },
        onBuyMenuToggle: (open) => {
          setIsBuyMenuOpen(open);
        },
        onFlashUpdate: (intensity) => {
          setFlashIntensity(intensity);
        },
        onMultikill: (text) => {
          setMultikillBanner(text);
          setTimeout(() => {
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
          setTimeout(() => {
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

    engineRef.current = engine;
    engine.start();

    setAllPlayers(engine.allPlayers);
    setActiveWeapon(engine.currentWeapon);
    setSelectedWeapon(engine.primaryWeapon);
    setSidearmWeapon(engine.sidearmWeapon);
    setMeleeWeapon(engine.meleeWeapon);
    setRadarData(engine.getRadarState());

    // Sync loop for HUD telemetry
    const hudInterval = setInterval(() => {
      if (!engine) return;
      const engineRef = engine;

      // Only update React state when values actually change
      if (engineRef.currentAmmo !== lastHudValues.current.currentAmmo) setCurrentAmmo(engineRef.currentAmmo);
      if (engineRef.reserveAmmo !== lastHudValues.current.reserveAmmo) setReserveAmmo(engineRef.reserveAmmo);
      if (engineRef.isReloading !== lastHudValues.current.isReloading) setIsReloading(engineRef.isReloading);
      if (engineRef.isAds !== lastHudValues.current.isAds) setIsAds(engineRef.isAds);
      if (engineRef.isCrouched !== lastHudValues.current.isCrouched) setIsCrouched(engineRef.isCrouched);
      if (engineRef.isSliding !== lastHudValues.current.isSliding) setIsSliding(engineRef.isSliding);
      if (engineRef.isSprinting !== lastHudValues.current.isSprinting) setIsSprinting(engineRef.isSprinting);
      if (engineRef.currentWeapon !== lastHudValues.current.activeWeapon) {
        setActiveWeapon(engineRef.currentWeapon);
        lastHudValues.current.activeWeapon = engineRef.currentWeapon;
      }
      if (engineRef.primaryWeapon !== lastHudValues.current.primaryWeapon) {
        setSelectedWeapon(engineRef.primaryWeapon);
        lastHudValues.current.primaryWeapon = engineRef.primaryWeapon;
      }
      if (engineRef.sidearmWeapon !== lastHudValues.current.sidearmWeapon) {
        setSidearmWeapon(engineRef.sidearmWeapon);
        lastHudValues.current.sidearmWeapon = engineRef.sidearmWeapon;
      }
      if (engineRef.meleeWeapon !== lastHudValues.current.meleeWeapon) {
        setMeleeWeapon(engineRef.meleeWeapon);
        lastHudValues.current.meleeWeapon = engineRef.meleeWeapon;
      }
      if (engineRef.roundTimeRemaining !== lastHudValues.current.roundTime) setRoundTime(engineRef.roundTimeRemaining);
      if (engineRef.buyPhaseTime !== lastHudValues.current.buyPhaseTime) setBuyPhaseTime(engineRef.buyPhaseTime);
      if (engineRef.roundNumber !== lastHudValues.current.roundNumber) setRoundNumber(engineRef.roundNumber);
      if (engineRef.targetWins !== lastHudValues.current.targetWins) setTargetWins(engineRef.targetWins);
      if (engineRef.isOvertime !== lastHudValues.current.isOvertime) setIsOvertime(engineRef.isOvertime);
      if (engineRef.playerMatchData !== lastHudValues.current.playerData) {
        setPlayerData(clonePlayerData(engineRef.playerMatchData));
        lastHudValues.current.playerData = engineRef.playerMatchData;
      }
      if (engineRef.allPlayers.length !== lastHudValues.current.allPlayersLen) setAllPlayers([...engineRef.allPlayers]);
      if (engineRef.getRadarState() !== lastHudValues.current.radarData) {
        setRadarData(engineRef.getRadarState());
        lastHudValues.current.radarData = engineRef.getRadarState();
      }
      if (engineRef.isInspecting !== lastHudValues.current.isInspecting) setIsInspecting(engineRef.isInspecting);
      if (engineRef.isPointerLocked !== lastHudValues.current.isPointerLocked) setIsPointerLocked(engineRef.isPointerLocked);
    }, 90);

      // Bomb-site proximity check
      const pos = engine.playerPosition;
      const distA = Math.hypot(pos.x - selectedMap.siteA.x, pos.z - selectedMap.siteA.z);
      const distB = Math.hypot(pos.x - selectedMap.siteB.x, pos.z - selectedMap.siteB.z);
      const inSite = distA <= selectedMap.siteA.radius || distB <= selectedMap.siteB.radius;
      if (inSite !== (lastHudValues.current.isInBombSite ?? false)) setIsInBombSite(inSite);
      lastHudValues.current.isInBombSite = inSite;
    }, 90);

    return () => {
      clearInterval(hudInterval);
      engine.stop();
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
  );
}
