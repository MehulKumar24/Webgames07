import React, { useState, useRef, useEffect } from 'react';
import { Agent, Weapon, MatchPlayer, ControlSettings } from '../types/game';
import {
  Crosshair,
  RotateCw,
  Zap,
  Flame,
  Shield,
  Eye,
  Sparkles,
  Bomb,
  Heart,
  ShoppingBag,
  Map as MapIcon,
  BarChart2,
  Sliders,
  Navigation,
  ChevronUp,
  ChevronsUp,
  ArrowDownToLine,
  Smartphone,
  Check,
  Shuffle
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

export type MobileGripPreset = 'thumb_arc' | 'claw_3finger' | 'claw_4finger';

interface TouchHUDProps {
  agent: Agent;
  currentWeapon: Weapon;
  primaryWeapon: Weapon;
  sidearmWeapon: Weapon;
  meleeWeapon?: Weapon;
  playerData: MatchPlayer;
  controlsSettings: ControlSettings;
  currentAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  isAds: boolean;
  isCrouched: boolean;
  isSprinting: boolean;
  isSliding: boolean;
  isSpikePlanted: boolean;
  isInBombSite: boolean;
  roundPhase: 'buy_phase' | 'in_progress' | 'round_end' | 'match_end';
  onMoveInput: (x: number, y: number) => void;
  onLookInput: (dx: number, dy: number) => void;
  onFireStart: () => void;
  onFireEnd: () => void;
  onAdsToggle: () => void;
  onJump: () => void;
  onCrouchToggle: () => void;
  onSprintToggle: () => void;
  onSprintSet?: (sprinting: boolean) => void;
  onReload: () => void;
  onAbilityTrigger: (type: 'ability_1' | 'ability_2' | 'ability_3') => void;
  onUltimateTrigger: () => void;
  onPlantSpike: () => void;
  onDefuseSpike: () => void;
  onDropSpike?: () => void;
  onPickupSpike?: () => void;
  onRollRandomWeapon?: () => void;
  isInspecting?: boolean;
  onInspectWeapon?: () => void;
  onWeaponSwitch: (type: 'primary' | 'secondary' | 'melee') => void;
  onOpenBuyMenu: () => void;
  onOpenScoreboard: () => void;
  onOpenFullMap: () => void;
  onQuickPing: () => void;
  onUpdateControls: (newControls: ControlSettings) => void;
}

export const TouchHUD: React.FC<TouchHUDProps> = ({
  agent,
  currentWeapon,
  primaryWeapon,
  sidearmWeapon,
  meleeWeapon,
  playerData,
  controlsSettings,
  currentAmmo,
  reserveAmmo,
  isReloading,
  isAds,
  isCrouched,
  isSprinting,
  isSliding,
  isSpikePlanted,
  isInBombSite,
  roundPhase,
  isInspecting = false,
  onInspectWeapon,
  onMoveInput,
  onLookInput,
  onFireStart,
  onFireEnd,
  onAdsToggle,
  onJump,
  onCrouchToggle,
  onSprintToggle,
  onSprintSet,
  onReload,
  onAbilityTrigger,
  onUltimateTrigger,
  onPlantSpike,
  onDefuseSpike,
  onDropSpike,
  onPickupSpike,
  onRollRandomWeapon,
  onWeaponSwitch,
  onOpenBuyMenu,
  onOpenScoreboard,
  onOpenFullMap,
  onQuickPing,
  onUpdateControls
}) => {
  // Mobile HUD Layout Preset & Live Customizer Drawer
  const [gripPreset, setGripPreset] = useState<MobileGripPreset>('claw_3finger');
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const [isFiringActive, setIsFiringActive] = useState<boolean>(false);
  const [isSprintLocked, setIsSprintLocked] = useState<boolean>(false);

  // Independent Multi-Touch & Pointer Identifiers
  const joystickRef = useRef<HTMLDivElement>(null);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const joystickTouchId = useRef<number | null>(null);
  const isMouseJoystickActive = useRef<boolean>(false);
  const joystickCenter = useRef({ x: 0, y: 0 });

  // Free-look swipe touch identifier
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });

  // Fire-button drag-aim touch identifier (allows aiming while holding Fire!)
  const fireTouchId = useRef<number | null>(null);
  const lastFireLookPos = useRef({ x: 0, y: 0 });
  const onLookInputRef = useRef(onLookInput);
  useEffect(() => {
    onLookInputRef.current = onLookInput;
  }, [onLookInput]);

  // Gyroscope DeviceOrientation Listener when enabled
  useEffect(() => {
    if (!controlsSettings.gyroscopeEnabled) return;
    let lastBeta: number | null = null;
    let lastGamma: number | null = null;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      if (lastBeta !== null && lastGamma !== null) {
        const dGamma = e.gamma - lastGamma;
        const dBeta = e.beta - lastBeta;
        const gyroSens = (controlsSettings.gyroSensitivity || 1.5) * 0.008;
        if (Math.abs(dGamma) < 25 && Math.abs(dBeta) < 25) {
          onLookInputRef.current(dGamma * gyroSens, dBeta * gyroSens);
        }
      }
      lastBeta = e.beta;
      lastGamma = e.gamma;
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [controlsSettings.gyroscopeEnabled, controlsSettings.gyroSensitivity]);

  // Update analog stick position + Auto-Sprint Lock detection
  const updateJoystickCoords = (clientX: number, clientY: number) => {
    const maxRadius = 56;
    const dx = clientX - joystickCenter.current.x;
    const dy = clientY - joystickCenter.current.y;
    const dist = Math.hypot(dx, dy);

    let clampedX = dx;
    let clampedY = dy;
    if (dist > maxRadius) {
      clampedX = (dx / dist) * maxRadius;
      clampedY = (dy / dist) * maxRadius;
    }

    const normX = clampedX / maxRadius;
    const normY = -clampedY / maxRadius;

    setJoystickPos({ x: clampedX, y: clampedY });
    onMoveInput(normX, normY);

    // Auto-Sprint when pushing thumb stick deep into forward zone (dy < -44px)
    const shouldAutoSprint = dy < -44 && Math.abs(normX) < 0.75;
    if (shouldAutoSprint && !isSprintLocked) {
      setIsSprintLocked(true);
      onSprintSet?.(true);
    } else if (normY < 0.2 && isSprintLocked) {
      setIsSprintLocked(false);
      onSprintSet?.(false);
    }
  };

  // 1. Left Movement Joystick Multi-Touch & Mouse Handlers
  const handleJoystickStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (joystickTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    joystickTouchId.current = touch.identifier;

    if (joystickRef.current) {
      const rect = joystickRef.current.getBoundingClientRect();
      joystickCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    }
    setIsJoystickActive(true);
    updateJoystickCoords(touch.clientX, touch.clientY);
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchId.current) {
        updateJoystickCoords(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId.current) {
        joystickTouchId.current = null;
        setIsJoystickActive(false);
        setJoystickPos({ x: 0, y: 0 });
        onMoveInput(0, 0);
        if (isSprintLocked) {
          setIsSprintLocked(false);
          onSprintSet?.(false);
        }
        break;
      }
    }
  };

  // Mouse support for Joystick so users can test Mobile HUD on desktop preview
  const handleJoystickMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    isMouseJoystickActive.current = true;
    if (joystickRef.current) {
      const rect = joystickRef.current.getBoundingClientRect();
      joystickCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    }
    setIsJoystickActive(true);
    updateJoystickCoords(e.clientX, e.clientY);

    const onWindowMouseMove = (moveEvt: MouseEvent) => {
      if (!isMouseJoystickActive.current) return;
      updateJoystickCoords(moveEvt.clientX, moveEvt.clientY);
    };
    const onWindowMouseUp = () => {
      isMouseJoystickActive.current = false;
      setIsJoystickActive(false);
      setJoystickPos({ x: 0, y: 0 });
      onMoveInput(0, 0);
      setIsSprintLocked(false);
      onSprintSet?.(false);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
  };

  // 2. Full-Screen Free Look Touch Swipe Handlers
  const handleLookStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (
        touch.identifier !== joystickTouchId.current &&
        touch.identifier !== fireTouchId.current &&
        lookTouchId.current === null
      ) {
        lookTouchId.current = touch.identifier;
        lastLookPos.current = { x: touch.clientX, y: touch.clientY };
        break;
      }
    }
  };

  const handleLookMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchId.current) {
        const dx = touch.clientX - lastLookPos.current.x;
        const dy = touch.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: touch.clientX, y: touch.clientY };

        const sensX = controlsSettings.lookSensitivityX * 0.0048;
        const sensY = controlsSettings.lookSensitivityY * 0.0048;
        const adsMult = isAds ? controlsSettings.adsSensitivityMultiplier : 1.0;

        onLookInput(dx * sensX * adsMult, dy * sensY * adsMult);
        break;
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
        break;
      }
    }
  };

  // 3. Fire Button Multi-Touch + Simultaneous Drag-to-Aim
  const handleFireTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.changedTouches[0];
    if (touch && fireTouchId.current === null) {
      fireTouchId.current = touch.identifier;
      lastFireLookPos.current = { x: touch.clientX, y: touch.clientY };
    }
    setIsFiringActive(true);
    onFireStart();
  };

  const handleFireTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === fireTouchId.current) {
        const dx = touch.clientX - lastFireLookPos.current.x;
        const dy = touch.clientY - lastFireLookPos.current.y;
        lastFireLookPos.current = { x: touch.clientX, y: touch.clientY };

        const sensX = controlsSettings.lookSensitivityX * 0.0042;
        const sensY = controlsSettings.lookSensitivityY * 0.0042;
        const adsMult = isAds ? controlsSettings.adsSensitivityMultiplier : 1.0;
        onLookInput(dx * sensX * adsMult, dy * sensY * adsMult);
        break;
      }
    }
  };

  const handleFireTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === fireTouchId.current) {
        fireTouchId.current = null;
        break;
      }
    }
    setIsFiringActive(false);
    onFireEnd();
  };

  const handleFireMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    isMouseFireActive.current = true;
    setIsFiringActive(true);
    onFireStart();

    const onWindowUp = () => {
      if (!isMouseFireActive.current) return;
      isMouseFireActive.current = false;
      setIsFiringActive(false);
      onFireEnd();
      window.removeEventListener('mouseup', onWindowUp);
    };
    window.addEventListener('mouseup', onWindowUp);
  };

  // Instant-response touch/mouse button binder
  const bindInstantAction = (action: () => void) => ({
    onTouchStart: (e: React.TouchEvent) => {
      e.stopPropagation();
      soundEngine.playUIClick();
      action();
    },
    onMouseDown: (e: React.MouseEvent) => {
      e.stopPropagation();
      soundEngine.playUIClick();
      action();
    }
  });

  const scale = controlsSettings.buttonScale || 1.0;
  const opacity = controlsSettings.buttonOpacity || 0.92;
  const isLeftHanded = controlsSettings.leftHandedMode;
  const ultPointsNeeded = agent.ultimate.ultPointsRequired || 7;
  const isUltReady = playerData.ultPoints >= ultPointsNeeded;
  const ultPercent = Math.min(1, playerData.ultPoints / Math.max(1, ultPointsNeeded));
  const isPrimaryActive = currentWeapon.id === primaryWeapon.id;
  const ammoRatio = Math.max(0, Math.min(1, currentAmmo / Math.max(1, currentWeapon.magazineSize)));

  // Joystick angle for vector indicator
  const stickAngleRad = Math.atan2(joystickPos.y, joystickPos.x);
  const stickDist = Math.hypot(joystickPos.x, joystickPos.y);

  const postureText = isSliding
    ? 'SLIDING'
    : isSprinting || isSprintLocked
    ? 'SPRINTING'
    : isCrouched
    ? 'CROUCHED'
    : isAds
    ? 'SCOPED'
    : 'STANDING';

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none overflow-hidden z-20 flex flex-col justify-between font-chakra"
      style={{ opacity }}
    >
      {/* FULL-SCREEN MULTI-TOUCH SWIPE LOOK LAYER */}
      <div
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
        className="absolute inset-0 pointer-events-auto z-0 touch-none"
      />

      {/* TOP BAR: CLAW TRIGGERS & MOBILE TACTICAL COMMAND STRIP */}
      <div className="w-full flex justify-between items-start px-3 pt-14 z-20 pointer-events-none">
        {/* TOP-LEFT ZONE: 3-Finger / 4-Finger Index Claw Fire Trigger (placed below Mini-Map) */}
        <div className="flex flex-col items-start gap-2 mt-36 pointer-events-auto">
          {(gripPreset === 'claw_3finger' || gripPreset === 'claw_4finger') && (
            <button
              onTouchStart={handleFireTouchStart}
              onTouchMove={handleFireTouchMove}
              onTouchEnd={handleFireTouchEnd}
              onTouchCancel={handleFireTouchEnd}
              onMouseDown={handleFireMouseDown}
              style={{ transform: `scale(${scale})` }}
              className={`w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center text-white font-black text-[10px] tracking-wider transition-all touch-none cursor-pointer shadow-lg ${
                isFiringActive
                  ? 'bg-red-500 border-amber-300 scale-95 shadow-[0_0_24px_rgba(239,68,68,0.95)]'
                  : 'bg-gradient-to-br from-red-600/85 to-orange-600/80 border-red-300/80 shadow-[0_0_16px_rgba(239,68,68,0.5)]'
              }`}
              title="Index Claw Fire Trigger (Drag to Aim while Firing)"
            >
              <Flame className="w-6 h-6 text-amber-200" />
              <span>L-FIRE</span>
            </button>
          )}
        </div>

        {/* TOP-RIGHT ZONE: Mobile Tactical Toolbar (Buy Shop, Map, Scoreboard, Ping, HUD Config) */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto -mt-11">
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800/90 rounded-xl p-1 shadow-xl backdrop-blur-md">
            {/* Quick Buy Button (Pulses during Buy Phase) */}
            <button
              {...bindInstantAction(onOpenBuyMenu)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all touch-none cursor-pointer ${
                roundPhase === 'buy_phase'
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.5)] animate-pulse'
                  : 'bg-slate-900/90 border-cyan-500/40 text-cyan-300 hover:border-cyan-400'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="font-mono-tactical font-black">${playerData.credits}</span>
            </button>

            {/* Tactical Map Modal Button */}
            <button
              {...bindInstantAction(onOpenFullMap)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 active:border-cyan-400 text-slate-200 text-[11px] font-bold flex items-center gap-1 transition-all touch-none cursor-pointer"
            >
              <MapIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">MAP</span>
            </button>

            {/* Scoreboard Button */}
            <button
              {...bindInstantAction(onOpenScoreboard)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 active:border-cyan-400 text-slate-200 text-[11px] font-bold flex items-center gap-1 transition-all touch-none cursor-pointer"
            >
              <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">SCORE</span>
            </button>

            {/* Quick Waypoint Ping Button */}
            <button
              {...bindInstantAction(onQuickPing)}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/60 active:bg-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1 transition-all touch-none cursor-pointer"
              title="Ping Current Location / Crosshair"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>PING</span>
            </button>

            {/* Live Mobile HUD Layout Customizer Toggle */}
            <button
              {...bindInstantAction(() => setIsCustomizerOpen(!isCustomizerOpen))}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-all touch-none cursor-pointer ${
                isCustomizerOpen
                  ? 'bg-cyan-500 border-cyan-300 text-slate-950 shadow-[0_0_12px_rgba(0,240,255,0.6)]'
                  : 'bg-slate-900/90 border-slate-700 text-cyan-300'
              }`}
              title="Customize Mobile HUD Layout & Grip Preset"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden md:inline">HUD</span>
            </button>
          </div>

          {/* 4-Finger Esports Right-Index Scope Trigger */}
          {gripPreset === 'claw_4finger' && (
            <button
              {...bindInstantAction(onAdsToggle)}
              style={{ transform: `scale(${scale})` }}
              className={`mt-14 mr-2 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center font-black text-[10px] tracking-wider transition-all touch-none cursor-pointer shadow-lg ${
                isAds
                  ? 'bg-cyan-500/45 border-cyan-300 text-cyan-100 shadow-[0_0_20px_rgba(0,240,255,0.8)]'
                  : 'bg-slate-900/85 border-cyan-500/60 text-cyan-300'
              }`}
            >
              <Crosshair className="w-6 h-6" />
              <span>R-SCOPE</span>
            </button>
          )}
        </div>
      </div>

      {/* INTERACTIVE IN-GAME MOBILE HUD CUSTOMIZER DRAWER */}
      {isCustomizerOpen && (
        <div
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="self-center z-40 pointer-events-auto bg-slate-950/95 border border-cyan-500/60 rounded-2xl p-4 w-[92vw] max-w-md shadow-[0_0_40px_rgba(0,0,0,0.85)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-black tracking-wider uppercase text-white">
                MOBILE TOUCH HUD CUSTOMIZER
              </span>
            </div>
            <button
              onClick={() => setIsCustomizerOpen(false)}
              className="px-2.5 py-1 rounded-lg bg-cyan-500 text-slate-950 font-black text-[10px] uppercase tracking-wider cursor-pointer flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> DONE
            </button>
          </div>

          {/* Grip Layout Presets */}
          <div className="mb-3">
            <span className="text-[10px] font-mono-tactical text-slate-400 uppercase block mb-1.5">
              ERGONOMIC GRIP LAYOUT PRESET
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'thumb_arc', label: '2-THUMB ARC', desc: 'Standard Dual-Thumb' },
                  { id: 'claw_3finger', label: '3-FINGER CLAW', desc: '+ Top-Left Fire' },
                  { id: 'claw_4finger', label: '4-FINGER PRO', desc: '+ Top L-Fire & R-Scope' }
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    soundEngine.playUIClick();
                    setGripPreset(preset.id);
                  }}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    gripPreset === preset.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                      : 'bg-slate-900/90 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-[10px] font-black uppercase">{preset.label}</div>
                  <div className="text-[8px] font-mono-tactical text-slate-400 mt-0.5">{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Button Size & Opacity Sliders */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="flex justify-between text-[10px] text-slate-300 mb-1">
                <span>BUTTON SCALE</span>
                <span className="font-mono-tactical text-cyan-300 font-bold">
                  {Math.round(controlsSettings.buttonScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.3"
                step="0.05"
                value={controlsSettings.buttonScale}
                onChange={(e) =>
                  onUpdateControls({ ...controlsSettings, buttonScale: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-slate-300 mb-1">
                <span>HUD OPACITY</span>
                <span className="font-mono-tactical text-cyan-300 font-bold">
                  {Math.round(controlsSettings.buttonOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="1.0"
                step="0.05"
                value={controlsSettings.buttonOpacity}
                onChange={(e) =>
                  onUpdateControls({ ...controlsSettings, buttonOpacity: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-400"
              />
            </div>
          </div>

          {/* Handedness & Gyro Toggles */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() =>
                onUpdateControls({
                  ...controlsSettings,
                  leftHandedMode: !controlsSettings.leftHandedMode
                })
              }
              className={`py-2 px-3 rounded-xl border text-[10px] font-bold uppercase flex items-center justify-between cursor-pointer ${
                controlsSettings.leftHandedMode
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <span>LEFT-HANDED FLIP</span>
              <span>{controlsSettings.leftHandedMode ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() =>
                onUpdateControls({
                  ...controlsSettings,
                  gyroscopeEnabled: !controlsSettings.gyroscopeEnabled
                })
              }
              className={`py-2 px-3 rounded-xl border text-[10px] font-bold uppercase flex items-center justify-between cursor-pointer ${
                controlsSettings.gyroscopeEnabled
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <span>GYRO AIMING</span>
              <span>{controlsSettings.gyroscopeEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      )}

      {/* CENTER CONTEXTUAL OBJECTIVE PROMPT (PLANT / DEFUSE / DROP / PICK UP SPIKE) */}
      <div className="self-center z-30 pointer-events-auto flex flex-wrap items-center justify-center gap-2 my-auto">
        {isInBombSite && !isSpikePlanted && playerData.side === 'attackers' && playerData.hasSpike && roundPhase === 'in_progress' && (
          <button
            {...bindInstantAction(onPlantSpike)}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 border-2 border-red-200 text-white font-chakra font-black text-xs tracking-widest uppercase flex items-center gap-2 shadow-[0_0_30px_rgba(239,68,68,0.85)] active:scale-95 transition-all touch-none animate-bounce cursor-pointer"
          >
            <Bomb className="w-4 h-4" />
            <span>PLANT NEXUS CORE</span>
          </button>
        )}

        {!isSpikePlanted && playerData.side === 'attackers' && (
          playerData.hasSpike && onDropSpike ? (
            <button
              {...bindInstantAction(onDropSpike)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-950/90 border border-amber-400/80 text-amber-300 font-chakra font-bold text-[10px] tracking-wider uppercase flex items-center gap-1.5 shadow-lg active:scale-95 touch-none cursor-pointer"
            >
              <Bomb className="w-3.5 h-3.5" />
              <span>DROP SPIKE</span>
            </button>
          ) : !playerData.hasSpike && onPickupSpike ? (
            <button
              {...bindInstantAction(onPickupSpike)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600/90 border border-emerald-300 text-white font-chakra font-bold text-[10px] tracking-wider uppercase flex items-center gap-1.5 shadow-lg active:scale-95 touch-none cursor-pointer"
            >
              <Bomb className="w-3.5 h-3.5" />
              <span>PICK UP SPIKE</span>
            </button>
          ) : null
        )}

        {roundPhase === 'buy_phase' && onRollRandomWeapon && (
          <button
            {...bindInstantAction(onRollRandomWeapon)}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600/85 border border-purple-300 text-white font-chakra font-bold text-[10px] tracking-wider uppercase flex items-center gap-1.5 shadow-lg active:scale-95 touch-none cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>RANDOM WPN</span>
          </button>
        )}

        {isSpikePlanted && playerData.side === 'defenders' && (
          <button
            {...bindInstantAction(onDefuseSpike)}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-sky-500 border-2 border-cyan-200 text-white font-chakra font-black text-xs tracking-widest uppercase flex items-center gap-2 shadow-[0_0_30px_rgba(6,182,212,0.85)] active:scale-95 transition-all touch-none cursor-pointer"
          >
            <RotateCw className="w-4 h-4 animate-spin" />
            <span>TAP NEAR CORE TO DEFUSE</span>
          </button>
        )}
      </div>

      {/* BOTTOM MULTI-TOUCH ERGONOMIC CONTROL DECK */}
      <div
        className={`w-full flex items-end justify-between px-4 pb-3 pt-2 z-20 pointer-events-none ${
          isLeftHanded ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* =====================================================================
            1. ANALOG MOVEMENT JOYSTICK CLUSTER + AUTO-SPRINT LOCK
           ===================================================================== */}
        <div
          className="flex flex-col items-center gap-2 pointer-events-auto origin-bottom-left"
          style={{ transform: `scale(${scale})` }}
        >
          {/* Auto-Sprint Lock Pill Indicator */}
          <button
            {...bindInstantAction(onSprintToggle)}
            className={`px-3 py-1 rounded-full border text-[10px] font-mono-tactical font-black tracking-widest uppercase flex items-center gap-1 transition-all touch-none cursor-pointer ${
              isSprinting || isSprintLocked
                ? 'bg-cyan-500/35 border-cyan-300 text-cyan-200 shadow-[0_0_14px_rgba(0,240,255,0.65)]'
                : 'bg-slate-950/80 border-slate-700/80 text-slate-400'
            }`}
          >
            <ChevronsUp className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isSprinting || isSprintLocked ? 'SPRINT ACTIVE' : 'SPRINT'}</span>
          </button>

          {/* 360° Virtual Analog Stick Ring */}
          <div
            ref={joystickRef}
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
            onTouchCancel={handleJoystickEnd}
            onMouseDown={handleJoystickMouseDown}
            className={`w-36 h-36 rounded-full relative flex items-center justify-center backdrop-blur-md touch-none cursor-pointer transition-colors ${
              isJoystickActive
                ? 'bg-slate-950/75 border-2 border-cyan-400 shadow-[0_0_25px_rgba(0,240,255,0.3)]'
                : 'bg-slate-950/60 border-2 border-cyan-500/40'
            }`}
          >
            {/* Cardinal Compass Ticks on Stick Rim */}
            <span className="absolute top-1.5 text-[8px] font-mono-tactical font-bold text-cyan-400/80 pointer-events-none">
              ▲
            </span>
            <span className="absolute bottom-1.5 text-[8px] font-mono-tactical font-bold text-slate-600 pointer-events-none">
              ▼
            </span>
            <span className="absolute left-2 text-[8px] font-mono-tactical font-bold text-slate-600 pointer-events-none">
              ◀
            </span>
            <span className="absolute right-2 text-[8px] font-mono-tactical font-bold text-slate-600 pointer-events-none">
              ▶
            </span>

            {/* Inner Deadzone Ring */}
            <div className="w-20 h-20 rounded-full border border-dashed border-cyan-500/25 pointer-events-none" />

            {/* Live Direction Vector Beam */}
            {isJoystickActive && stickDist > 6 && (
              <div
                className="absolute h-0.5 bg-gradient-to-r from-cyan-400/20 to-cyan-300 pointer-events-none origin-left"
                style={{
                  width: `${stickDist}px`,
                  left: '50%',
                  top: '50%',
                  transform: `rotate(${(stickAngleRad * 180) / Math.PI}deg)`
                }}
              />
            )}

            {/* Tactile Thumb Puck */}
            <div
              className={`w-14 h-14 rounded-full transition-transform duration-75 flex items-center justify-center pointer-events-none border-2 ${
                isSprinting || isSprintLocked
                  ? 'bg-gradient-to-br from-amber-400 to-cyan-400 border-white shadow-[0_0_20px_rgba(245,158,11,0.85)]'
                  : isJoystickActive
                  ? 'bg-gradient-to-br from-cyan-400 to-sky-500 border-cyan-100 shadow-[0_0_20px_rgba(0,240,255,0.85)]'
                  : 'bg-cyan-500/70 border-cyan-300/60'
              }`}
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`
              }}
            >
              <div className="w-5 h-5 rounded-full bg-slate-950/60 border border-white/40" />
            </div>
          </div>
        </div>

        {/* =====================================================================
            2. BOTTOM-CENTER MOBILE TACTICAL CONSOLE
               (Abilities + Dual Weapon Switcher Cards + Biometrics Bar)
           ===================================================================== */}
        <div className="flex flex-col items-center gap-2 pointer-events-auto max-w-[48vw]">
          {/* ROW A: AGENT ABILITIES & RADIAL ULTIMATE DOCK */}
          <div className="flex items-center gap-2">
            {/* Ability 1 [Q] */}
            <button
              {...bindInstantAction(() => onAbilityTrigger('ability_1'))}
              className={`relative px-2.5 py-1.5 rounded-xl bg-slate-950/90 border flex flex-col items-center min-w-14 transition-all active:scale-90 touch-none cursor-pointer backdrop-blur-md ${
                (playerData.abilityCharges['ability_1'] ?? 0) > 0
                  ? 'border-cyan-500/60 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                  : 'border-slate-800 opacity-45'
              }`}
            >
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-mono-tactical font-black text-white">
                  {playerData.abilityCharges['ability_1'] ?? 0}
                </span>
              </div>
              <span className="text-[8px] font-bold text-cyan-200 uppercase truncate max-w-14 mt-0.5">
                {agent.ability1.name.split(' ')[0]}
              </span>
            </button>

            {/* Ability 2 [E] */}
            <button
              {...bindInstantAction(() => onAbilityTrigger('ability_2'))}
              className={`relative px-2.5 py-1.5 rounded-xl bg-slate-950/90 border flex flex-col items-center min-w-14 transition-all active:scale-90 touch-none cursor-pointer backdrop-blur-md ${
                (playerData.abilityCharges['ability_2'] ?? 0) > 0
                  ? 'border-purple-500/60 shadow-[0_0_12px_rgba(192,132,252,0.2)]'
                  : 'border-slate-800 opacity-45'
              }`}
            >
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4 text-purple-400" />
                <span className="text-[10px] font-mono-tactical font-black text-white">
                  {playerData.abilityCharges['ability_2'] ?? 0}
                </span>
              </div>
              <span className="text-[8px] font-bold text-purple-200 uppercase truncate max-w-14 mt-0.5">
                {agent.ability2.name.split(' ')[0]}
              </span>
            </button>

            {/* Ability 3 [C] */}
            <button
              {...bindInstantAction(() => onAbilityTrigger('ability_3'))}
              className={`relative px-2.5 py-1.5 rounded-xl bg-slate-950/90 border flex flex-col items-center min-w-14 transition-all active:scale-90 touch-none cursor-pointer backdrop-blur-md ${
                (playerData.abilityCharges['ability_3'] ?? 0) > 0
                  ? 'border-emerald-500/60 shadow-[0_0_12px_rgba(52,211,153,0.2)]'
                  : 'border-slate-800 opacity-45'
              }`}
            >
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-mono-tactical font-black text-white">
                  {playerData.abilityCharges['ability_3'] ?? 0}
                </span>
              </div>
              <span className="text-[8px] font-bold text-emerald-200 uppercase truncate max-w-14 mt-0.5">
                {agent.ability3.name.split(' ')[0]}
              </span>
            </button>

            {/* Ultimate Ability [X] with Radial Gauge */}
            <button
              {...bindInstantAction(onUltimateTrigger)}
              disabled={!isUltReady}
              className={`relative px-3 py-1.5 rounded-xl border-2 flex flex-col items-center min-w-16 transition-all active:scale-90 touch-none cursor-pointer backdrop-blur-md ${
                isUltReady
                  ? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.75)] animate-pulse'
                  : 'bg-slate-950/90 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-1">
                <Sparkles className={`w-4 h-4 ${isUltReady ? 'text-amber-300' : 'text-slate-500'}`} />
                <span className="text-[10px] font-mono-tactical font-black">
                  {isUltReady ? 'MAX' : `${Math.round(ultPercent * 100)}%`}
                </span>
              </div>
              <span className="text-[8px] font-black uppercase truncate max-w-16 mt-0.5">
                {isUltReady ? 'ULT READY' : agent.ultimate.name.split(' ')[0]}
              </span>
            </button>
          </div>

          {/* ROW B: DUAL INTERACTIVE WEAPON DECK (Tap Active Weapon to Reload, Tap Other to Swap) */}
          <div className="flex items-stretch gap-1.5 w-full justify-center">
            {/* Primary Weapon Card */}
            <button
              {...bindInstantAction(() => {
                if (isPrimaryActive) {
                  onReload();
                } else {
                  onWeaponSwitch('primary');
                }
              })}
              className={`px-3 py-1.5 rounded-xl border flex flex-col justify-between min-w-32 transition-all active:scale-95 touch-none cursor-pointer backdrop-blur-md ${
                isPrimaryActive
                  ? 'bg-slate-950/95 border-cyan-400 shadow-[0_0_16px_rgba(0,240,255,0.28)]'
                  : 'bg-slate-950/75 border-slate-800 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <span className="text-[10px] font-black text-white uppercase tracking-wider truncate">
                  {primaryWeapon.name}
                </span>
                <span className="text-[8px] font-mono-tactical text-cyan-400 uppercase">
                  1 • PRI
                </span>
              </div>
              {isPrimaryActive ? (
                <>
                  <div className="flex items-baseline justify-between w-full mt-0.5">
                    <span className="text-[9px] font-mono-tactical text-slate-400">
                      {isReloading ? 'RELOADING' : 'TAP RELOAD'}
                    </span>
                    <div className="font-mono-tactical">
                      <span
                        className={`text-sm font-black ${
                          currentAmmo <= 5 ? 'text-red-500 animate-pulse' : 'text-cyan-300'
                        }`}
                      >
                        {currentAmmo}
                      </span>
                      <span className="text-[10px] text-slate-500">/{reserveAmmo}</span>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all duration-100 ${
                        currentAmmo <= 5 ? 'bg-red-500' : 'bg-cyan-400'
                      }`}
                      style={{ width: `${ammoRatio * 100}%` }}
                    />
                  </div>
                </>
              ) : (
                <span className="text-[9px] font-mono-tactical text-slate-400 mt-1 text-left">
                  TAP TO EQUIP
                </span>
              )}
            </button>

            {/* Sidearm Weapon Card */}
            <button
              {...bindInstantAction(() => {
                if (currentWeapon.id === sidearmWeapon.id) {
                  onReload();
                } else {
                  onWeaponSwitch('secondary');
                }
              })}
              className={`px-2.5 py-1.5 rounded-xl border flex flex-col justify-between min-w-24 transition-all active:scale-95 touch-none cursor-pointer backdrop-blur-md ${
                currentWeapon.id === sidearmWeapon.id
                  ? 'bg-slate-950/95 border-cyan-400 shadow-[0_0_16px_rgba(0,240,255,0.28)]'
                  : 'bg-slate-950/75 border-slate-800 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between w-full gap-1.5">
                <span className="text-[10px] font-black text-white uppercase tracking-wider truncate">
                  {sidearmWeapon.name}
                </span>
                <span className="text-[8px] font-mono-tactical text-amber-400 uppercase">
                  2 • SIDE
                </span>
              </div>
              {currentWeapon.id === sidearmWeapon.id ? (
                <div className="flex items-baseline justify-between w-full mt-0.5 font-mono-tactical">
                  <span className="text-[9px] text-slate-400">ACTIVE</span>
                  <span className="text-xs font-black text-cyan-300">{currentAmmo}/{reserveAmmo}</span>
                </div>
              ) : (
                <span className="text-[9px] font-mono-tactical text-slate-400 mt-1 text-left">
                  EQUIP
                </span>
              )}
            </button>

            {/* Melee Knife Card */}
            <button
              {...bindInstantAction(() => onWeaponSwitch('melee'))}
              className={`px-2.5 py-1.5 rounded-xl border flex flex-col justify-between min-w-22 transition-all active:scale-95 touch-none cursor-pointer backdrop-blur-md ${
                currentWeapon.category === 'Melee'
                  ? 'bg-slate-950/95 border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.35)]'
                  : 'bg-slate-950/75 border-slate-800 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between w-full gap-1">
                <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider truncate">
                  {meleeWeapon?.name || 'KNIFE'}
                </span>
                <span className="text-[8px] font-mono-tactical text-amber-400 uppercase">
                  3
                </span>
              </div>
              <span className="text-[9px] font-mono-tactical text-slate-300 mt-1 text-left">
                {currentWeapon.category === 'Melee' ? 'BLADE OUT' : 'MELEE'}
              </span>
            </button>

            {/* Weapon Inspect Touch Button */}
            <button
              {...bindInstantAction(() => onInspectWeapon?.())}
              className={`px-2.5 py-1.5 rounded-xl border flex flex-col items-center justify-center min-w-14 transition-all active:scale-90 touch-none cursor-pointer backdrop-blur-md ${
                isInspecting
                  ? 'bg-amber-500/30 border-amber-400 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.6)] animate-pulse'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400'
              }`}
              title="Inspect weapon"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isInspecting ? 'animate-spin text-amber-300' : 'text-slate-400'}`} />
              <span className="text-[7.5px] font-mono-tactical font-black uppercase mt-0.5">
                {isInspecting ? 'CHECK' : 'INSPECT'}
              </span>
            </button>
          </div>

          {/* ROW C: COMPACT MOBILE BIOMETRICS (HEALTH + SHIELD + POSTURE) */}
          <div className="w-full bg-slate-950/92 border border-slate-800/90 rounded-xl px-3 py-1.5 flex items-center gap-3 shadow-xl backdrop-blur-md">
            {/* Health Bar & Readout */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="flex items-center gap-1 font-bold text-emerald-400">
                  <Heart className="w-3 h-3 fill-emerald-400" /> HP
                </span>
                <span
                  className={`font-mono-tactical font-black text-xs ${
                    playerData.health <= 30 ? 'text-red-500 animate-pulse' : 'text-emerald-300'
                  }`}
                >
                  {playerData.health}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
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

            {/* Shield Bar & Readout */}
            <div className="w-24 flex flex-col">
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="flex items-center gap-1 font-bold text-cyan-400">
                  <Shield className="w-3 h-3 fill-cyan-400" /> AP
                </span>
                <span className="font-mono-tactical font-black text-xs text-cyan-300">
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

            {/* Operative Posture Badge */}
            <span
              className={`px-2 py-0.5 rounded text-[9px] font-mono-tactical font-black uppercase border ${
                isSliding
                  ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                  : isSprinting || isSprintLocked
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300'
                  : isCrouched
                  ? 'bg-purple-500/25 border-purple-400 text-purple-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              {postureText}
            </span>
          </div>
        </div>

        {/* =====================================================================
            3. RIGHT-THUMB ERGONOMIC COMBAT ARC
               (Radial Arc of Scope, Jump, Reload, Crouch/Slide around Primary Fire)
           ===================================================================== */}
        <div
          className="relative w-48 h-44 pointer-events-auto origin-bottom-right"
          style={{ transform: `scale(${scale})` }}
        >
          {/* ARC BUTTON 1 (12:30 Top-Right): JUMP / MANTLE */}
          <button
            {...bindInstantAction(onJump)}
            className="absolute top-0 right-3 w-13 h-13 rounded-full bg-slate-950/90 border-2 border-cyan-500/70 active:border-cyan-300 active:bg-cyan-500/35 flex flex-col items-center justify-center text-cyan-300 transition-all active:scale-90 touch-none cursor-pointer shadow-lg"
            title="Jump / Vault"
          >
            <ChevronUp className="w-5 h-5 -mb-1" />
            <span className="text-[9px] font-black tracking-wider">JUMP</span>
          </button>

          {/* ARC BUTTON 2 (10:30 Top-Left): ADS HOLOGRAPHIC SCOPE TOGGLE */}
          <button
            {...bindInstantAction(onAdsToggle)}
            className={`absolute top-4 left-7 w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center transition-all active:scale-90 touch-none cursor-pointer shadow-lg ${
              isAds
                ? 'bg-cyan-500/45 border-cyan-300 text-white shadow-[0_0_20px_rgba(0,240,255,0.75)]'
                : 'bg-slate-950/90 border-slate-600 text-slate-300'
            }`}
            title="Aim Down Sights (ADS)"
          >
            <Crosshair className="w-5 h-5 text-cyan-300" />
            <span className="text-[8px] font-mono-tactical font-black mt-0.5">
              {isAds ? `${currentWeapon.zoomRatio}x ON` : 'SCOPE'}
            </span>
          </button>

          {/* ARC BUTTON 3 (8:30 Mid-Left): TACTICAL RELOAD */}
          <button
            {...bindInstantAction(onReload)}
            className={`absolute top-19 left-0 w-12 h-12 rounded-full border flex flex-col items-center justify-center transition-all active:scale-90 touch-none cursor-pointer shadow-lg ${
              isReloading
                ? 'bg-amber-500/35 border-amber-400 text-amber-200'
                : currentAmmo <= 5
                ? 'bg-red-500/30 border-red-400 text-red-200 animate-pulse'
                : 'bg-slate-950/90 border-slate-700 text-slate-300'
            }`}
            title="Reload Magazine"
          >
            <RotateCw className={`w-4 h-4 ${isReloading ? 'animate-spin text-amber-300' : ''}`} />
            <span className="text-[8px] font-mono-tactical font-bold mt-0.5">RLD</span>
          </button>

          {/* ARC BUTTON 4 (7:00 Bottom-Left): CROUCH / COMBAT SLIDE */}
          <button
            {...bindInstantAction(onCrouchToggle)}
            className={`absolute bottom-0 left-6 w-13 h-13 rounded-full border-2 flex flex-col items-center justify-center transition-all active:scale-90 touch-none cursor-pointer shadow-lg ${
              isSliding
                ? 'bg-amber-500/45 border-amber-300 text-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.85)]'
                : isSprinting || isSprintLocked
                ? 'bg-amber-500/25 border-amber-400/80 text-amber-300'
                : isCrouched
                ? 'bg-purple-500/40 border-purple-300 text-purple-200 shadow-[0_0_15px_rgba(192,132,252,0.6)]'
                : 'bg-slate-950/90 border-slate-600 text-slate-300'
            }`}
            title="Crouch (or Slide while Sprinting)"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span className="text-[8px] font-black tracking-wider mt-0.5">
              {isSprinting || isSprintLocked || isSliding ? 'SLIDE' : 'CROUCH'}
            </span>
          </button>

          {/* CENTER-ANCHOR OF ARC: PRIMARY 3D TACTILE FIRE TRIGGER (Drag-to-Aim) */}
          <button
            onTouchStart={handleFireTouchStart}
            onTouchMove={handleFireTouchMove}
            onTouchEnd={handleFireTouchEnd}
            onTouchCancel={handleFireTouchEnd}
            onMouseDown={handleFireMouseDown}
            className={`absolute bottom-1 right-1 w-22 h-22 rounded-full border-3 flex flex-col items-center justify-center text-white font-chakra font-black tracking-wider transition-all touch-none cursor-pointer ${
              isFiringActive
                ? 'bg-gradient-to-tr from-red-500 via-orange-500 to-amber-400 border-white scale-95 shadow-[0_0_36px_rgba(239,68,68,1)]'
                : 'bg-gradient-to-tr from-red-600/95 via-red-500/90 to-amber-500/90 border-red-200 shadow-[0_0_25px_rgba(239,68,68,0.75)]'
            }`}
            title="Primary Fire Trigger (Hold & Drag to Aim)"
          >
            {/* Outer Tactical Grip Ring */}
            <div className="absolute inset-1.5 rounded-full border border-dashed border-white/35 pointer-events-none" />
            <Flame className="w-8 h-8 drop-shadow" />
            <span className="text-xs font-black tracking-widest">FIRE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
