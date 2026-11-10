import React, { useState } from 'react';
import { Weapon, MatchPlayer } from '../types/game';
import { WEAPONS } from '../data/weapons';
import { DollarSign, Shield, X, Check, Shuffle, Play, Zap, Bomb } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface BuyMenuProps {
  playerData: MatchPlayer;
  currentWeapon: Weapon;
  isOpen: boolean;
  buyPhaseTime?: number;
  roundState?: 'buy_phase' | 'in_progress' | 'round_end' | 'match_end';
  onClose: () => void;
  onBuyWeapon: (weapon: Weapon) => void;
  onBuyShield: (type: 'light' | 'heavy') => void;
  onRollRandomWeapon?: () => void;
  onSkipBuyPhase?: () => void;
  onDropSpike?: () => void;
  onPickupSpike?: () => void;
}

export const BuyMenu: React.FC<BuyMenuProps> = ({
  playerData,
  isOpen,
  buyPhaseTime = 60,
  roundState = 'buy_phase',
  onClose,
  onBuyWeapon,
  onBuyShield,
  onRollRandomWeapon,
  onSkipBuyPhase,
  onDropSpike,
  onPickupSpike
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Assault Rifles');

  if (!isOpen) return null;

  const categories = [
    'Melee',
    'Pistols',
    'SMGs',
    'Shotguns',
    'Assault Rifles',
    'Sniper Rifles',
    'LMGs',
    'Heavy Weapons'
  ];

  const filteredWeapons = WEAPONS.filter(w => w.category === selectedCategory);

  const handleBuyWeapon = (weapon: Weapon) => {
    if (playerData.credits < weapon.cost) return;
    soundEngine.playUIClick();
    onBuyWeapon(weapon);
  };

  const handleBuyShield = (type: 'light' | 'heavy') => {
    const cost = type === 'light' ? 400 : 1000;
    if (playerData.credits < cost) return;
    soundEngine.playUIClick();
    onBuyShield(type);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none font-chakra">
      <div className="w-full max-w-6xl bg-slate-950 border border-cyan-500/40 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,240,255,0.2)] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xl font-black tracking-wider text-cyan-400">
              TACTICAL ARMORY PROCUREMENT
            </span>
            <div className="flex items-center gap-1.5 bg-slate-950 border border-amber-500/50 px-3 py-1 rounded-lg text-amber-300 font-mono-tactical font-black text-sm">
              <DollarSign className="w-4 h-4 text-amber-400" />
              ${playerData.credits}
            </div>
            {roundState === 'buy_phase' && (
              <div className="px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-mono-tactical text-xs font-bold">
                1-MIN BUY PHASE: {Math.max(0, Math.ceil(buyPhaseTime))}s
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onRollRandomWeapon && (
              <button
                onClick={onRollRandomWeapon}
                className="px-3.5 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-500/40 border border-purple-400/60 text-purple-200 font-bold text-xs tracking-wider uppercase flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Shuffle className="w-3.5 h-3.5" /> RANDOM WEAPON [G]
              </button>
            )}
            {roundState === 'buy_phase' && onSkipBuyPhase && (
              <button
                onClick={() => {
                  onSkipBuyPhase();
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs tracking-wider uppercase flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> START COMBAT NOW
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex overflow-x-auto p-2 bg-slate-900/40 border-b border-slate-800 gap-1.5 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                  : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat === 'Melee' ? 'Knives / Melee' : cat}
            </button>
          ))}
        </div>

        {/* Weapons Grid */}
        <div className="p-5 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredWeapons.map((weapon) => {
            const isEquipped =
              playerData.currentWeaponId === weapon.id ||
              playerData.sidearmWeaponId === weapon.id ||
              playerData.meleeWeaponId === weapon.id;
            const canAfford = playerData.credits >= weapon.cost;

            return (
              <div
                key={weapon.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  isEquipped
                    ? 'bg-cyan-950/25 border-cyan-400/80 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                    : canAfford
                    ? 'bg-slate-900/70 border-slate-800 hover:border-slate-600'
                    : 'bg-slate-900/30 border-slate-800/40 opacity-50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-black text-slate-100 text-base leading-tight">{weapon.name}</h4>
                      <span className="text-[10px] text-slate-400 tracking-wider uppercase">{weapon.category}</span>
                    </div>
                    <span className="font-mono-tactical font-black text-amber-300 text-sm">
                      {weapon.cost === 0 ? 'DEFAULT FREE' : `$${weapon.cost}`}
                    </span>
                  </div>

                  {/* Unique Weapon Special Ability Banner */}
                  {weapon.specialAbility && (
                    <div className="mt-2.5 p-2 rounded-lg bg-cyan-950/50 border border-cyan-500/30">
                      <div className="flex items-center gap-1.5 text-[11px] font-black text-cyan-300 uppercase tracking-wider">
                        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{weapon.specialAbility.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                        {weapon.specialAbility.description}
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">{weapon.description}</p>

                  {/* Weapon Stats Mini-Table */}
                  <div className="grid grid-cols-2 gap-1.5 mt-3 text-xs font-mono-tactical">
                    <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-500 text-[9px] block">HEAD / BODY</span>
                      <span className="text-cyan-300 font-bold">{weapon.damageHead} / {weapon.damageBody}</span>
                    </div>
                    <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-500 text-[9px] block">FIRE RATE</span>
                      <span className="text-slate-200 font-bold">{weapon.fireRate} rps</span>
                    </div>
                    <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-500 text-[9px] block">MAGAZINE</span>
                      <span className="text-slate-200 font-bold">
                        {weapon.category === 'Melee' ? 'INFINITE' : `${weapon.magazineSize} rds`}
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-500 text-[9px] block">PENETRATION</span>
                      <span className="text-slate-200 font-bold">{weapon.penetration}</span>
                    </div>
                  </div>
                </div>

                {/* Purchase / Equip Button */}
                <button
                  onClick={() => handleBuyWeapon(weapon)}
                  disabled={playerData.currentWeaponId === weapon.id || !canAfford}
                  className={`mt-4 w-full py-2 rounded-lg font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 ${
                    playerData.currentWeaponId === weapon.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 cursor-default'
                      : canAfford
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(0,240,255,0.4)] cursor-pointer active:scale-98'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {playerData.currentWeaponId === weapon.id ? (
                    <>
                      <Check className="w-4 h-4" /> ACTIVE IN HAND
                    </>
                  ) : isEquipped ? (
                    'EQUIP IN HAND (FREE)'
                  ) : (
                    'PURCHASE & EQUIP'
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Armor / Shields & Spike Controls Dock at Bottom */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              <span className="text-sm font-bold tracking-wider text-slate-200">BODY ARMOR</span>
            </div>

            {playerData.side === 'attackers' && (
              <div className="flex items-center gap-2 pl-3 border-l border-slate-700">
                <Bomb className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono-tactical text-amber-300 font-bold uppercase">
                  ATTACKER SPIKE:
                </span>
                {playerData.hasSpike ? (
                  <button
                    onClick={onDropSpike}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-200 text-xs font-bold uppercase cursor-pointer"
                  >
                    DROP SPIKE [V]
                  </button>
                ) : (
                  <button
                    onClick={onPickupSpike}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400 text-emerald-200 text-xs font-bold uppercase cursor-pointer"
                  >
                    PICK UP SPIKE [F]
                  </button>
                )}
              </div>
            )}
            {playerData.side === 'defenders' && (
              <div className="flex items-center gap-2 pl-3 border-l border-slate-700 text-xs font-mono-tactical text-cyan-300">
                DEFENDER ROLE: PROTECT SITES A & B · DEFUSE PLANTED SPIKE [F]
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Light Armor */}
            <button
              onClick={() => handleBuyShield('light')}
              disabled={playerData.armor >= 25 || playerData.credits < 400}
              className={`px-4 py-2 rounded-lg border text-xs font-bold tracking-wider flex items-center gap-2 transition-all ${
                playerData.armor === 25
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : playerData.credits >= 400 && playerData.armor < 25
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 cursor-pointer'
                  : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>LIGHT SHIELD (+25)</span>
              <span className="font-mono-tactical text-amber-300 font-bold">$400</span>
            </button>

            {/* Heavy Armor */}
            <button
              onClick={() => handleBuyShield('heavy')}
              disabled={playerData.armor >= 50 || playerData.credits < 1000}
              className={`px-4 py-2 rounded-lg border text-xs font-bold tracking-wider flex items-center gap-2 transition-all ${
                playerData.armor === 50
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : playerData.credits >= 1000 && playerData.armor < 50
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 cursor-pointer'
                  : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>HEAVY SHIELD (+50)</span>
              <span className="font-mono-tactical text-amber-300 font-bold">$1,000</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
