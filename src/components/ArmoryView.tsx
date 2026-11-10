import React, { useState } from 'react';
import { Weapon, WeaponCategory } from '../types/game';
import { WEAPONS } from '../data/weapons';
import { Crosshair, Volume2, ArrowLeft, Check, Zap } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface ArmoryViewProps {
  selectedWeapon: Weapon;
  onSelectWeapon: (weapon: Weapon) => void;
  onBack: () => void;
}

export const ArmoryView: React.FC<ArmoryViewProps> = ({
  selectedWeapon,
  onSelectWeapon,
  onBack
}) => {
  const [activeCategory, setActiveCategory] = useState<WeaponCategory>('Assault Rifles');

  const categories: WeaponCategory[] = [
    'Melee',
    'Pistols',
    'SMGs',
    'Shotguns',
    'Assault Rifles',
    'Sniper Rifles',
    'LMGs',
    'Heavy Weapons'
  ];

  const filteredWeapons = WEAPONS.filter(w => w.category === activeCategory);

  const testFire = (w: Weapon) => {
    soundEngine.playGunshot(w.category);
  };

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-b from-slate-950 via-slate-900 to-black p-4 md:p-8 flex flex-col justify-between font-chakra select-none overflow-y-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-xs font-mono-tactical text-cyan-400 tracking-widest uppercase">
              WEAPONS SYSTEM ({WEAPONS.length} BESPOKE WEAPONS & SPECIAL ABILITIES)
            </span>
            <h2 className="text-3xl font-black tracking-wider text-white uppercase">
              TACTICAL ARMORY & BALLISTICS
            </h2>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                soundEngine.playUIClick();
                setActiveCategory(cat);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-[0_0_12px_rgba(0,240,255,0.5)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Armory Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 flex-1 items-stretch">
        {/* Weapon List (Left 5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3 overflow-y-auto max-h-[65vh] pr-1">
          {filteredWeapons.map((weapon) => {
            const isEquipped = selectedWeapon.id === weapon.id;
            return (
              <div
                key={weapon.id}
                onClick={() => {
                  soundEngine.playUIClick();
                  onSelectWeapon(weapon);
                }}
                className={`p-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  isEquipped
                    ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <div>
                  <h4 className="font-black text-slate-100 text-base">{weapon.name}</h4>
                  <span className="text-xs text-slate-400 font-mono-tactical">
                    {weapon.fireMode.toUpperCase()} · {weapon.fireRate} RPS · {weapon.magazineSize} RDS
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono-tactical font-black text-amber-300 text-sm">
                    {weapon.cost === 0 ? 'FREE' : `$${weapon.cost}`}
                  </span>
                  {isEquipped && (
                    <span className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Weapon Technical Dossier (Right 7 Cols) */}
        <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-2xl">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono-tactical text-cyan-400 tracking-wider uppercase">
                  {selectedWeapon.category} · {selectedWeapon.penetration.toUpperCase()} PENETRATION
                </span>
                <h3 className="text-3xl font-black text-white uppercase mt-1">
                  {selectedWeapon.name}
                </h3>
              </div>

              {/* Test Fire Audio Button */}
              <button
                onClick={() => testFire(selectedWeapon)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-cyan-500/20 border border-slate-800 hover:border-cyan-400 text-cyan-300 font-bold text-xs tracking-wider uppercase flex items-center gap-2 cursor-pointer transition-all"
              >
                <Volume2 className="w-4 h-4" /> TEST FIRE AUDIO
              </button>
            </div>

            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              {selectedWeapon.description}
            </p>

            {selectedWeapon.specialAbility && (
              <div className="mt-4 p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40">
                <div className="flex items-center gap-2 text-xs font-black text-cyan-300 uppercase tracking-wider">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>WEAPON ABILITY: {selectedWeapon.specialAbility.name}</span>
                </div>
                <p className="text-xs text-slate-200 mt-1">
                  {selectedWeapon.specialAbility.description}
                </p>
              </div>
            )}

            {/* Ballistics & Damage Matrix */}
            <div className="mt-6">
              <span className="text-xs font-bold tracking-widest text-slate-400 uppercase block mb-3 font-mono-tactical">
                BALLISTICS & DAMAGE PROFILE
              </span>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 font-mono-tactical uppercase">HEADSHOT</span>
                  <span className="text-2xl font-black text-amber-300 font-mono-tactical mt-1">
                    {selectedWeapon.damageHead}
                  </span>
                  <span className="text-[10px] text-slate-400">2.5x Multiplier</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 font-mono-tactical uppercase">TORSO / BODY</span>
                  <span className="text-2xl font-black text-cyan-300 font-mono-tactical mt-1">
                    {selectedWeapon.damageBody}
                  </span>
                  <span className="text-[10px] text-slate-400">1.0x Base</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 font-mono-tactical uppercase">LEGS</span>
                  <span className="text-2xl font-black text-slate-300 font-mono-tactical mt-1">
                    {selectedWeapon.damageLeg}
                  </span>
                  <span className="text-[10px] text-slate-400">0.75x Reduction</span>
                </div>
              </div>
            </div>

            {/* Performance Sliders */}
            <div className="mt-6 space-y-3 font-mono-tactical text-xs">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>FIRE RATE</span>
                  <span className="text-cyan-300 font-bold">{selectedWeapon.fireRate} rounds/sec</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400" style={{ width: `${(selectedWeapon.fireRate / 15) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>FIRST SHOT ACCURACY</span>
                  <span className="text-cyan-300 font-bold">{(selectedWeapon.firstShotAccuracy * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400" style={{ width: `${selectedWeapon.firstShotAccuracy * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>MAGAZINE CAPACITY</span>
                  <span className="text-cyan-300 font-bold">{selectedWeapon.magazineSize} rounds</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400" style={{ width: `${(selectedWeapon.magazineSize / 120) * 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>RELOAD SPEED</span>
                  <span className="text-cyan-300 font-bold">{selectedWeapon.reloadTime}s</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: `${(1 - selectedWeapon.reloadTime / 6) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => {
                soundEngine.playUIClick();
                onBack();
              }}
              className="px-8 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,240,255,0.6)] cursor-pointer active:scale-98 transition-all"
            >
              EQUIP AS PRIMARY
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
