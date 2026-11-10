import { Weapon } from '../types/game';

export const DEFAULT_SIDEARM_ID = 'wpn_vector9';
export const DEFAULT_MELEE_ID = 'wpn_tac_knife';

export const WEAPONS: Weapon[] = [
  // ============================================================================
  // 1. MELEE / KNIVES (4)
  // ============================================================================
  {
    id: 'wpn_tac_knife',
    name: 'Apex Tactical Knife',
    category: 'Melee',
    archetype: 'tac_knife',
    isMelee: true,
    meleeRange: 3.6,
    cost: 0, // Free default starting knife
    magazineSize: 1,
    reserveAmmo: 999,
    fireRate: 2.4,
    damageHead: 150,
    damageBody: 75,
    damageLeg: 65,
    reloadTime: 0.4,
    recoilVertical: 0.01,
    recoilHorizontal: 0.01,
    spread: 0.0,
    firstShotAccuracy: 1.0,
    falloffStart: 4,
    falloffEnd: 5,
    penetration: 'High',
    fireMode: 'melee',
    zoomRatio: 1.05,
    specialAbility: {
      name: 'Swift Stride',
      effect: 'swift_stride',
      description: 'Grants +15% movement & sprint speed while wielding this combat blade.',
      procValue: 1.15
    },
    description: 'Standard-issue serrated titanium combat knife with a mono-molecular plasma edge. Boosts operative sprint mobility.',
    colorScheme: {
      primary: '#1e293b',
      secondary: '#00f0ff',
      glow: '#00f0ff'
    }
  },
  {
    id: 'wpn_karambit_prime',
    name: 'Cyber Karambit Prime',
    category: 'Melee',
    archetype: 'karambit',
    isMelee: true,
    meleeRange: 4.2,
    cost: 650,
    magazineSize: 1,
    reserveAmmo: 999,
    fireRate: 3.0,
    damageHead: 165,
    damageBody: 85,
    damageLeg: 75,
    reloadTime: 0.4,
    recoilVertical: 0.01,
    recoilHorizontal: 0.01,
    spread: 0.0,
    firstShotAccuracy: 1.0,
    falloffStart: 4,
    falloffEnd: 6,
    penetration: 'High',
    fireMode: 'melee',
    zoomRatio: 1.08,
    specialAbility: {
      name: 'Phase Lunge',
      effect: 'phase_lunge',
      description: 'Slashing propels you forward in a kinetic micro-dash and grants +18% movement speed.',
      procValue: 8.5
    },
    description: 'Curved claw talon with finger retention ring. Triggers a forward kinetic dash-lunge on every strike.',
    colorScheme: {
      primary: '#0f172a',
      secondary: '#a855f7',
      glow: '#e879f9'
    }
  },
  {
    id: 'wpn_katana_zero',
    name: 'Ronin Vibro-Katana',
    category: 'Melee',
    archetype: 'katana',
    isMelee: true,
    meleeRange: 5.5,
    cost: 1200,
    magazineSize: 1,
    reserveAmmo: 999,
    fireRate: 2.1,
    damageHead: 210,
    damageBody: 125,
    damageLeg: 105,
    reloadTime: 0.5,
    recoilVertical: 0.015,
    recoilHorizontal: 0.015,
    spread: 0.0,
    firstShotAccuracy: 1.0,
    falloffStart: 5,
    falloffEnd: 7,
    penetration: 'High',
    fireMode: 'melee',
    zoomRatio: 1.1,
    specialAbility: {
      name: 'Shockwave Cleave',
      effect: 'shockwave_slash',
      description: 'Projects a 5.5m crimson energy wave on every swing that cleaves through shields.',
      procValue: 45
    },
    description: 'High-frequency ultrasonic katana blade that projects a lethal ranged energy arc with every slash.',
    colorScheme: {
      primary: '#09090b',
      secondary: '#ef4444',
      glow: '#f43f5e'
    }
  },
  {
    id: 'wpn_butterfly_neon',
    name: 'Viper Balisong Knife',
    category: 'Melee',
    archetype: 'butterfly',
    isMelee: true,
    meleeRange: 4.0,
    cost: 850,
    magazineSize: 1,
    reserveAmmo: 999,
    fireRate: 3.4,
    damageHead: 160,
    damageBody: 82,
    damageLeg: 70,
    reloadTime: 0.4,
    recoilVertical: 0.01,
    recoilHorizontal: 0.01,
    spread: 0.0,
    firstShotAccuracy: 1.0,
    falloffStart: 4,
    falloffEnd: 5,
    penetration: 'High',
    fireMode: 'melee',
    zoomRatio: 1.06,
    specialAbility: {
      name: 'Vampiric Edge',
      effect: 'vampiric_siphon',
      description: 'Restores +40 Health and +15 Shield immediately on every melee hit.',
      procValue: 40
    },
    description: 'Twin-pivot skeletonized butterfly knife coated in nanite siphon alloy. Steals enemy vitals on contact.',
    colorScheme: {
      primary: '#18181b',
      secondary: '#10b981',
      glow: '#34d399'
    }
  },

  // ============================================================================
  // 2. PISTOLS (6)
  // ============================================================================
  {
    id: 'wpn_vector9',
    name: 'Vector-9 Sidearm',
    category: 'Pistols',
    archetype: 'tac_pistol',
    cost: 0, // Free default starting sidearm
    magazineSize: 12,
    reserveAmmo: 48,
    fireRate: 6.8,
    damageHead: 78,
    damageBody: 28,
    damageLeg: 22,
    reloadTime: 1.4,
    recoilVertical: 0.016,
    recoilHorizontal: 0.007,
    spread: 0.013,
    firstShotAccuracy: 0.96,
    falloffStart: 20,
    falloffEnd: 40,
    penetration: 'Low',
    fireMode: 'semi',
    zoomRatio: 1.15,
    specialAbility: {
      name: 'Quickdraw Stride',
      effect: 'swift_stride',
      description: 'Lightweight polymer frame grants +8% movement speed while equipped.',
      procValue: 1.08
    },
    description: 'Reliable standard-issue tactical sidearm with crisp trigger reset and enhanced mobility.',
    colorScheme: {
      primary: '#334155',
      secondary: '#00f0ff',
      glow: '#00f0ff'
    }
  },
  {
    id: 'wpn_dominator50',
    name: 'Dominator .50 Magnum',
    category: 'Pistols',
    archetype: 'revolver',
    cost: 800,
    magazineSize: 6,
    reserveAmmo: 30,
    fireRate: 2.6,
    damageHead: 165,
    damageBody: 58,
    damageLeg: 48,
    reloadTime: 2.0,
    recoilVertical: 0.05,
    recoilHorizontal: 0.018,
    spread: 0.02,
    firstShotAccuracy: 0.95,
    falloffStart: 25,
    falloffEnd: 50,
    penetration: 'High',
    fireMode: 'semi',
    zoomRatio: 1.25,
    specialAbility: {
      name: 'Tungsten Core',
      effect: 'armor_shred',
      description: 'Depleted tungsten rounds deal 200% damage against enemy shields and armor.',
      procValue: 2.0
    },
    description: 'Heavy 6-cylinder magnum revolver engineered to punish peeks with lethal 1-tap headshots and armor-shredding rounds.',
    colorScheme: {
      primary: '#1e293b',
      secondary: '#eab308',
      glow: '#f59e0b'
    }
  },
  {
    id: 'wpn_ghost45',
    name: 'Ghost .45 Silent',
    category: 'Pistols',
    archetype: 'suppressed_pistol',
    cost: 500,
    magazineSize: 15,
    reserveAmmo: 60,
    fireRate: 7.2,
    damageHead: 108,
    damageBody: 32,
    damageLeg: 26,
    reloadTime: 1.5,
    recoilVertical: 0.015,
    recoilHorizontal: 0.005,
    spread: 0.01,
    firstShotAccuracy: 0.98,
    falloffStart: 20,
    falloffEnd: 40,
    penetration: 'Low',
    fireMode: 'semi',
    zoomRatio: 1.18,
    specialAbility: {
      name: 'Subsonic Telemetry',
      effect: 'radar_lock',
      description: 'Hits silently tag the target on your tactical radar for 5 seconds.',
      procValue: 5.0
    },
    description: 'Suppressed high-precision pistol. Conceals bullet tracers and tags hit enemies on squad radar.',
    colorScheme: {
      primary: '#0f172a',
      secondary: '#38bdf8',
      glow: '#38bdf8'
    }
  },
  {
    id: 'wpn_staccato',
    name: 'Staccato Tri-Burst',
    category: 'Pistols',
    archetype: 'burst_pistol',
    cost: 450,
    magazineSize: 18,
    reserveAmmo: 54,
    fireRate: 9.5,
    damageHead: 76,
    damageBody: 26,
    damageLeg: 21,
    reloadTime: 1.6,
    recoilVertical: 0.024,
    recoilHorizontal: 0.01,
    spread: 0.018,
    firstShotAccuracy: 0.92,
    falloffStart: 15,
    falloffEnd: 32,
    penetration: 'Low',
    fireMode: 'burst',
    burstCount: 3,
    zoomRatio: 1.2,
    specialAbility: {
      name: 'Kinetic Recharge',
      effect: 'overdrive_refund',
      description: 'Eliminations instantly refill the magazine and restore +20 Shield.',
      procValue: 20
    },
    description: 'Compensated micro-burst machine pistol that fires 3 rapid rounds and recharges shields on kill.',
    colorScheme: {
      primary: '#475569',
      secondary: '#ec4899',
      glow: '#f43f5e'
    }
  },
  {
    id: 'wpn_arc_pistol',
    name: 'Volt-9 Arc Pistol',
    category: 'Pistols',
    archetype: 'arc_pistol',
    cost: 700,
    magazineSize: 14,
    reserveAmmo: 56,
    fireRate: 6.2,
    damageHead: 96,
    damageBody: 35,
    damageLeg: 29,
    reloadTime: 1.6,
    recoilVertical: 0.018,
    recoilHorizontal: 0.008,
    spread: 0.012,
    firstShotAccuracy: 0.96,
    falloffStart: 22,
    falloffEnd: 42,
    penetration: 'Medium',
    fireMode: 'semi',
    zoomRatio: 1.2,
    specialAbility: {
      name: 'Chain Lightning',
      effect: 'chain_lightning',
      description: 'Shots discharge a 5.5m electric arc that jolts nearby enemies for +22 shock damage.',
      procValue: 22
    },
    description: 'Experimental Tesla-coil sidearm. Rounds release high-voltage arcs that jump to adjacent targets.',
    colorScheme: {
      primary: '#083344',
      secondary: '#22d3ee',
      glow: '#00f0ff'
    }
  },
  {
    id: 'wpn_judge_pistol',
    name: 'Shorty Twin-Buckshot',
    category: 'Pistols',
    archetype: 'pocket_shotgun',
    pelletCount: 8,
    cost: 350,
    magazineSize: 2,
    reserveAmmo: 16,
    fireRate: 4.0,
    damageHead: 144,
    damageBody: 96,
    damageLeg: 72,
    reloadTime: 1.6,
    recoilVertical: 0.06,
    recoilHorizontal: 0.025,
    spread: 0.06,
    firstShotAccuracy: 0.82,
    falloffStart: 7,
    falloffEnd: 14,
    penetration: 'Low',
    fireMode: 'semi',
    zoomRatio: 1.1,
    specialAbility: {
      name: 'Incendiary Shells',
      effect: 'incendiary_burn',
      description: 'Buckshot pellets ignite targets for +18 bonus thermal burn damage.',
      procValue: 18
    },
    description: 'Sawed-off double-barrel pocket shotgun loaded with white-phosphorus incendiary shells.',
    colorScheme: {
      primary: '#292524',
      secondary: '#f97316',
      glow: '#fb923c'
    }
  },

  // ============================================================================
  // 3. SMGS (5)
  // ============================================================================
  {
    id: 'wpn_specter9',
    name: 'Specter-9 Silenced SMG',
    category: 'SMGs',
    archetype: 'suppressed_smg',
    cost: 1600,
    magazineSize: 30,
    reserveAmmo: 90,
    fireRate: 13.5,
    damageHead: 72,
    damageBody: 27,
    damageLeg: 22,
    reloadTime: 2.0,
    recoilVertical: 0.022,
    recoilHorizontal: 0.014,
    spread: 0.025,
    firstShotAccuracy: 0.9,
    falloffStart: 16,
    falloffEnd: 32,
    penetration: 'Medium',
    fireMode: 'auto',
    zoomRatio: 1.25,
    specialAbility: {
      name: 'Sonar Subsonics',
      effect: 'radar_lock',
      description: 'Suppressed rounds reveal damaged enemies on the tactical radar for 4s.',
      procValue: 4.0
    },
    description: 'Ultra-fast cycling suppressed submachine gun with run-and-gun precision and acoustic tagging.',
    colorScheme: {
      primary: '#18181b',
      secondary: '#a855f7',
      glow: '#c084fc'
    }
  },
  {
    id: 'wpn_viperpdw',
    name: 'Viper Vector PDW',
    category: 'SMGs',
    archetype: 'vector_smg',
    cost: 1100,
    magazineSize: 25,
    reserveAmmo: 75,
    fireRate: 15.0,
    damageHead: 66,
    damageBody: 25,
    damageLeg: 20,
    reloadTime: 1.6,
    recoilVertical: 0.02,
    recoilHorizontal: 0.01,
    spread: 0.02,
    firstShotAccuracy: 0.92,
    falloffStart: 18,
    falloffEnd: 35,
    penetration: 'Medium',
    fireMode: 'auto',
    zoomRatio: 1.2,
    specialAbility: {
      name: 'Hyper-Strafe Drive',
      effect: 'swift_stride',
      description: 'Grants +10% movement speed for aggressive entry fragging.',
      procValue: 1.1
    },
    description: 'Recoil-mitigated Kriss-style personal defense weapon with blistering 15 RPS fire rate.',
    colorScheme: {
      primary: '#27272a',
      secondary: '#10b981',
      glow: '#34d399'
    }
  },
  {
    id: 'wpn_cyclone45',
    name: 'Cyclone-45 Drum SMG',
    category: 'SMGs',
    archetype: 'drum_smg',
    cost: 1850,
    magazineSize: 42,
    reserveAmmo: 126,
    fireRate: 12.2,
    damageHead: 80,
    damageBody: 30,
    damageLeg: 25,
    reloadTime: 2.1,
    recoilVertical: 0.028,
    recoilHorizontal: 0.016,
    spread: 0.024,
    firstShotAccuracy: 0.88,
    falloffStart: 15,
    falloffEnd: 30,
    penetration: 'Medium',
    fireMode: 'auto',
    zoomRatio: 1.25,
    specialAbility: {
      name: 'Hollow-Point Shred',
      effect: 'armor_shred',
      description: 'Heavy .45 drum rounds deal 180% damage to enemy shields.',
      procValue: 1.8
    },
    description: 'Drum-fed .45 caliber Tommy-style tactical SMG with brutal stopping power.',
    colorScheme: {
      primary: '#1c1917',
      secondary: '#f97316',
      glow: '#fb923c'
    }
  },
  {
    id: 'wpn_frost_smg',
    name: 'Cryo-Vector Submachine',
    category: 'SMGs',
    archetype: 'vector_smg',
    cost: 1750,
    magazineSize: 28,
    reserveAmmo: 84,
    fireRate: 13.0,
    damageHead: 74,
    damageBody: 28,
    damageLeg: 23,
    reloadTime: 1.8,
    recoilVertical: 0.021,
    recoilHorizontal: 0.012,
    spread: 0.02,
    firstShotAccuracy: 0.92,
    falloffStart: 18,
    falloffEnd: 36,
    penetration: 'Medium',
    fireMode: 'auto',
    zoomRatio: 1.25,
    specialAbility: {
      name: 'Sub-Zero Cryo Rounds',
      effect: 'cryo_rounds',
      description: 'Liquid-nitrogen jacketed bullets chill enemies, slowing their movement by 45% for 2.5s.',
      procValue: 2.5
    },
    description: 'Cryogenic submachine gun that flash-freezes enemy leg actuators on hit, locking targets in place.',
    colorScheme: {
      primary: '#0f172a',
      secondary: '#38bdf8',
      glow: '#7dd3fc'
    }
  },
  {
    id: 'wpn_p90_hyper',
    name: 'Hyperion P-90 Overdrive',
    category: 'SMGs',
    archetype: 'p90_bullpup',
    cost: 2100,
    magazineSize: 50,
    reserveAmmo: 150,
    fireRate: 14.2,
    damageHead: 76,
    damageBody: 28,
    damageLeg: 24,
    reloadTime: 2.2,
    recoilVertical: 0.022,
    recoilHorizontal: 0.013,
    spread: 0.021,
    firstShotAccuracy: 0.91,
    falloffStart: 20,
    falloffEnd: 38,
    penetration: 'High',
    fireMode: 'auto',
    zoomRatio: 1.3,
    specialAbility: {
      name: 'Overdrive Siphon',
      effect: 'overdrive_refund',
      description: 'Kills instantly refill the 50-round top magazine and grant +25 Shield.',
      procValue: 25
    },
    description: '50-round horizontal top-fed bullpup PDW built for multi-kill site rushes without reloading.',
    colorScheme: {
      primary: '#1e1b4b',
      secondary: '#f43f5e',
      glow: '#fb7185'
    }
  },

  // ============================================================================
  // 4. SHOTGUNS (4)
  // ============================================================================
  {
    id: 'wpn_bulldog',
    name: 'Bulldog Double-Barrel',
    category: 'Shotguns',
    archetype: 'double_barrel',
    pelletCount: 10,
    cost: 900,
    magazineSize: 2,
    reserveAmmo: 18,
    fireRate: 3.8,
    damageHead: 185,
    damageBody: 125,
    damageLeg: 95,
    reloadTime: 2.0,
    recoilVertical: 0.075,
    recoilHorizontal: 0.028,
    spread: 0.065,
    firstShotAccuracy: 0.8,
    falloffStart: 9,
    falloffEnd: 18,
    penetration: 'Low',
    fireMode: 'semi',
    zoomRatio: 1.1,
    specialAbility: {
      name: 'Concussive Blast',
      effect: 'explosive_rounds',
      description: 'Heavy buckshot creates a 3.5m kinetic shockwave dealing +25 splash damage.',
      procValue: 25
    },
    description: 'Side-by-side double-barrel breacher shotgun. Delivers immediate room-clearing devastation.',
    colorScheme: {
      primary: '#3f3f46',
      secondary: '#f59e0b',
      glow: '#fbbf24'
    }
  },
  {
    id: 'wpn_striker12',
    name: 'Striker Auto-12 Drum',
    category: 'Shotguns',
    archetype: 'drum_shotgun',
    pelletCount: 8,
    cost: 1700,
    magazineSize: 8,
    reserveAmmo: 32,
    fireRate: 4.5,
    damageHead: 145,
    damageBody: 92,
    damageLeg: 70,
    reloadTime: 2.8,
    recoilVertical: 0.06,
    recoilHorizontal: 0.024,
    spread: 0.06,
    firstShotAccuracy: 0.82,
    falloffStart: 10,
    falloffEnd: 22,
    penetration: 'Medium',
    fireMode: 'auto',
    zoomRatio: 1.15,
    specialAbility: {
      name: 'Bloodhound Siphon',
      effect: 'vampiric_siphon',
      description: 'Restores +20 Health on every close-quarters blast that connects.',
      procValue: 20
    },
    description: 'Drum-fed full-auto combat shotgun engineered for relentless site-anchor suppression.',
    colorScheme: {
      primary: '#27272a',
      secondary: '#d97706',
      glow: '#f59e0b'
    }
  },
  {
    id: 'wpn_dragon_breath',
    name: 'Hellfire Breacher 12G',
    category: 'Shotguns',
    archetype: 'pump_breacher',
    pelletCount: 10,
    cost: 1850,
    magazineSize: 6,
    reserveAmmo: 24,
    fireRate: 2.4,
    damageHead: 175,
    damageBody: 115,
    damageLeg: 88,
    reloadTime: 2.5,
    recoilVertical: 0.07,
    recoilHorizontal: 0.025,
    spread: 0.055,
    firstShotAccuracy: 0.85,
    falloffStart: 11,
    falloffEnd: 24,
    penetration: 'Medium',
    fireMode: 'semi',
    zoomRatio: 1.15,
    specialAbility: {
      name: "Dragon's Breath",
      effect: 'incendiary_burn',
      description: 'Fires 3000°C magnesium pellets that ignite targets for +32 thermal burn damage.',
      procValue: 32
    },
    description: 'Tactical pump-action shotgun loaded with exothermic Dragon’s Breath shells that engulf targets in flame.',
    colorScheme: {
      primary: '#450a0a',
      secondary: '#f97316',
      glow: '#ef4444'
    }
  },
  {
    id: 'wpn_nova_slug',
    name: 'Nova Shock-Slug 12G',
    category: 'Shotguns',
    archetype: 'slug_cannon',
    pelletCount: 6,
    cost: 1650,
    magazineSize: 6,
    reserveAmmo: 24,
    fireRate: 2.8,
    damageHead: 168,
    damageBody: 105,
    damageLeg: 82,
    reloadTime: 2.4,
    recoilVertical: 0.065,
    recoilHorizontal: 0.02,
    spread: 0.038,
    firstShotAccuracy: 0.9,
    falloffStart: 14,
    falloffEnd: 28,
    penetration: 'High',
    fireMode: 'semi',
    zoomRatio: 1.25,
    specialAbility: {
      name: 'EMP Arc Slug',
      effect: 'chain_lightning',
      description: 'Electro-slugs chain +28 lightning damage to enemies within 5.5m of the target.',
      procValue: 28
    },
    description: 'Tight-choke electromagnetic shotgun that fires clustered arc-slugs capable of mid-range headshots.',
    colorScheme: {
      primary: '#0c4a6e',
      secondary: '#38bdf8',
      glow: '#00f0ff'
    }
  },

  // ============================================================================
  // 5. ASSAULT RIFLES (6)
  // ============================================================================
  {
    id: 'wpn_apexar',
    name: 'Apex-AR Combat Rifle',
    category: 'Assault Rifles',
    archetype: 'tac_ar',
    cost: 2900,
    magazineSize: 25,
    reserveAmmo: 75,
    fireRate: 9.75,
    damageHead: 160,
    damageBody: 40,
    damageLeg: 34,
    reloadTime: 2.3,
    recoilVertical: 0.036,
    recoilHorizontal: 0.02,
    spread: 0.015,
    firstShotAccuracy: 0.98,
    falloffStart: 50,
    falloffEnd: 80,
    penetration: 'High',
    fireMode: 'auto',
    zoomRatio: 1.35,
    specialAbility: {
      name: 'Apex Protocol Overdrive',
      effect: 'overdrive_refund',
      description: 'Eliminations automatically reload your magazine and restore +25 Shield.',
      procValue: 25
    },
    description: 'The premier tactical rifle of the APEX protocol. Unforgiving first-shot precision with lethal 1-tap headshots.',
    colorScheme: {
      primary: '#09090b',
      secondary: '#00f0ff',
      glow: '#00f0ff'
    }
  },
  {
    id: 'wpn_phantom',
    name: 'Phantom Silenced Carbine',
    category: 'Assault Rifles',
    archetype: 'phantom_carbine',
    cost: 2900,
    magazineSize: 30,
    reserveAmmo: 90,
    fireRate: 11.0,
    damageHead: 145,
    damageBody: 36,
    damageLeg: 30,
    reloadTime: 2.1,
    recoilVertical: 0.03,
    recoilHorizontal: 0.016,
    spread: 0.013,
    firstShotAccuracy: 0.97,
    falloffStart: 25,
    falloffEnd: 50,
    penetration: 'Medium',
    fireMode: 'auto',
    zoomRatio: 1.3,
    specialAbility: {
      name: 'Ghost Recon Link',
      effect: 'radar_lock',
      description: 'Suppressed hits mark the enemy on squad radar for 5s and hide bullet tracers.',
      procValue: 5.0
    },
    description: 'Suppressed military carbine. Erases bullet tracers through smoke and offers silky recoil control.',
    colorScheme: {
      primary: '#1e293b',
      secondary: '#6366f1',
      glow: '#818cf8'
    }
  },
  {
    id: 'wpn_manticore7',
    name: 'Manticore-7 Battle Rifle',
    category: 'Assault Rifles',
    archetype: 'vandal_ak',
    cost: 3200,
    magazineSize: 20,
    reserveAmmo: 60,
    fireRate: 8.0,
    damageHead: 170,
    damageBody: 48,
    damageLeg: 40,
    reloadTime: 2.5,
    recoilVertical: 0.044,
    recoilHorizontal: 0.022,
    spread: 0.014,
    firstShotAccuracy: 0.99,
    falloffStart: 60,
    falloffEnd: 100,
    penetration: 'High',
    fireMode: 'auto',
    zoomRatio: 1.45,
    specialAbility: {
      name: '7.62mm Armor Piercer',
      effect: 'armor_shred',
      description: 'Heavy 7.62x39mm rounds deal 200% damage to enemy armor plates.',
      procValue: 2.0
    },
    description: 'Heavy Kalashnikov-pattern battle rifle with curved magazine and punishing wall-banging power.',
    colorScheme: {
      primary: '#292524',
      secondary: '#ef4444',
      glow: '#f87171'
    }
  },
  {
    id: 'wpn_pulse14',
    name: 'Pulse Rifle PR-14',
    category: 'Assault Rifles',
    archetype: 'bullpup_ar',
    cost: 2200,
    magazineSize: 24,
    reserveAmmo: 72,
    fireRate: 10.8,
    damageHead: 120,
    damageBody: 35,
    damageLeg: 29,
    reloadTime: 1.9,
    recoilVertical: 0.024,
    recoilHorizontal: 0.011,
    spread: 0.012,
    firstShotAccuracy: 0.96,
    falloffStart: 35,
    falloffEnd: 70,
    penetration: 'Medium',
    fireMode: 'burst',
    burstCount: 3,
    zoomRatio: 1.4,
    specialAbility: {
      name: 'Cryo-Pulse Inhibitor',
      effect: 'cryo_rounds',
      description: 'Bursts chill enemy nerves, slowing their movement speed by 45% for 2s.',
      procValue: 2.0
    },
    description: 'Triple-round bullpup burst rifle designed for competitive mid-range lane holds with laser grouping.',
    colorScheme: {
      primary: '#172554',
      secondary: '#38bdf8',
      glow: '#0284c7'
    }
  },
  {
    id: 'wpn_nemesis_vandal',
    name: 'Nemesis-V Crimson',
    category: 'Assault Rifles',
    archetype: 'vandal_ak',
    cost: 3100,
    magazineSize: 25,
    reserveAmmo: 75,
    fireRate: 9.5,
    damageHead: 162,
    damageBody: 42,
    damageLeg: 35,
    reloadTime: 2.4,
    recoilVertical: 0.038,
    recoilHorizontal: 0.02,
    spread: 0.014,
    firstShotAccuracy: 0.98,
    falloffStart: 55,
    falloffEnd: 95,
    penetration: 'High',
    fireMode: 'auto',
    zoomRatio: 1.35,
    specialAbility: {
      name: 'Crimson Nanite Siphon',
      effect: 'vampiric_siphon',
      description: 'Siphons +18 Health on every bullet hit (+35 HP on headshot).',
      procValue: 18
    },
    description: 'Experimental bio-linked assault rifle that converts kinetic impact energy directly into operative healing.',
    colorScheme: {
      primary: '#18181b',
      secondary: '#e11d48',
      glow: '#f43f5e'
    }
  },
  {
    id: 'wpn_chronos_ar',
    name: 'Chronos-X Arc Bullpup',
    category: 'Assault Rifles',
    archetype: 'bullpup_ar',
    cost: 3000,
    magazineSize: 28,
    reserveAmmo: 84,
    fireRate: 10.2,
    damageHead: 148,
    damageBody: 38,
    damageLeg: 32,
    reloadTime: 2.0,
    recoilVertical: 0.028,
    recoilHorizontal: 0.014,
    spread: 0.012,
    firstShotAccuracy: 0.98,
    falloffStart: 45,
    falloffEnd: 85,
    penetration: 'High',
    fireMode: 'auto',
    zoomRatio: 1.5,
    specialAbility: {
      name: 'Tesla Arc Discharge',
      effect: 'chain_lightning',
      description: 'Every hit arcs +20 lightning damage to enemies within 5.5m of the target.',
      procValue: 20
    },
    description: 'Futuristic bullpup rifle with integrated 1.5x optic and electro-capacitors that punish stacked defenders.',
    colorScheme: {
      primary: '#0f172a',
      secondary: '#eab308',
      glow: '#fde047'
    }
  },

  // ============================================================================
  // 6. SNIPER RIFLES (5)
  // ============================================================================
  {
    id: 'wpn_longbow',
    name: 'Longbow Marksman DMR',
    category: 'Sniper Rifles',
    archetype: 'dmr_sniper',
    cost: 2250,
    magazineSize: 10,
    reserveAmmo: 30,
    fireRate: 3.4,
    damageHead: 155,
    damageBody: 68,
    damageLeg: 56,
    reloadTime: 2.3,
    recoilVertical: 0.042,
    recoilHorizontal: 0.014,
    spread: 0.008,
    firstShotAccuracy: 0.99,
    falloffStart: 60,
    falloffEnd: 120,
    penetration: 'High',
    fireMode: 'semi',
    zoomRatio: 2.5,
    specialAbility: {
      name: 'Target Telemetry',
      effect: 'radar_lock',
      description: 'Hits paint the enemy on your squad radar for 6 seconds.',
      procValue: 6.0
    },
    description: 'Semi-automatic designated marksman rifle with crisp 2.5x scope and recon telemetry rounds.',
    colorScheme: {
      primary: '#111827',
      secondary: '#10b981',
      glow: '#34d399'
    }
  },
  {
    id: 'wpn_outlaw_double',
    name: 'Outlaw Twin-Barrel Sniper',
    category: 'Sniper Rifles',
    archetype: 'double_sniper',
    cost: 2400,
    magazineSize: 2,
    reserveAmmo: 16,
    fireRate: 2.6,
    damageHead: 235,
    damageBody: 140,
    damageLeg: 115,
    reloadTime: 2.2,
    recoilVertical: 0.075,
    recoilHorizontal: 0.02,
    spread: 0.003,
    firstShotAccuracy: 1.0,
    falloffStart: 80,
    falloffEnd: 160,
    penetration: 'High',
    fireMode: 'semi',
    zoomRatio: 3.5,
    specialAbility: {
      name: 'Twin-Tap Armor Shatter',
      effect: 'armor_shred',
      description: 'Fires two rapid break-action sniper slugs that deal 250% damage to shields.',
      procValue: 2.5
    },
    description: 'Over-under double-barrel break-action sniper rifle. Fires two ultra-fast lethal follow-up shots.',
    colorScheme: {
      primary: '#27272a',
      secondary: '#f59e0b',
      glow: '#fbbf24'
    }
  },
  {
    id: 'wpn_valkyrie',
    name: 'Apex Valkyrie .50cal',
    category: 'Sniper Rifles',
    archetype: 'bolt_50cal',
    cost: 4700,
    magazineSize: 5,
    reserveAmmo: 15,
    fireRate: 0.85,
    damageHead: 265,
    damageBody: 155,
    damageLeg: 125,
    reloadTime: 3.4,
    recoilVertical: 0.11,
    recoilHorizontal: 0.035,
    spread: 0.001,
    firstShotAccuracy: 1.0,
    falloffStart: 100,
    falloffEnd: 200,
    penetration: 'High',
    fireMode: 'semi',
    zoomRatio: 5.0,
    specialAbility: {
      name: 'Anti-Materiel Detonation',
      effect: 'explosive_rounds',
      description: '.50 BMG rounds detonate on impact, dealing 45 splash damage in a 4m radius.',
      procValue: 45
    },
    description: 'Bolt-action anti-materiel sniper rifle. Guarantees 1-shot torso & head eliminations with explosive splash.',
    colorScheme: {
      primary: '#09090b',
      secondary: '#e11d48',
      glow: '#f43f5e'
    }
  },
  {
    id: 'wpn_railgun',
    name: 'Shadowstrike Railgun',
    category: 'Sniper Rifles',
    archetype: 'railgun_sniper',
    cost: 4900,
    magazineSize: 4,
    reserveAmmo: 16,
    fireRate: 1.0,
    damageHead: 280,
    damageBody: 165,
    damageLeg: 135,
    reloadTime: 3.6,
    recoilVertical: 0.12,
    recoilHorizontal: 0.025,
    spread: 0.001,
    firstShotAccuracy: 1.0,
    falloffStart: 150,
    falloffEnd: 300,
    penetration: 'High',
    fireMode: 'semi',
    zoomRatio: 4.5,
    specialAbility: {
      name: 'Hyper-Velocity Arc',
      effect: 'chain_lightning',
      description: 'Electromagnetic rail slugs arc +50 lightning damage to all nearby enemies within 6m.',
      procValue: 50
    },
    description: 'Split-rail electromagnetic accelerator that fires Mach-7 plasma darts with chain-lightning discharge.',
    colorScheme: {
      primary: '#030712',
      secondary: '#00f0ff',
      glow: '#38bdf8'
    }
  },
  {
    id: 'wpn_gauss_cannon',
    name: 'Singularity Gauss Sniper',
    category: 'Sniper Rifles',
    archetype: 'railgun_sniper',
    cost: 4800,
    magazineSize: 5,
    reserveAmmo: 15,
    fireRate: 1.1,
    damageHead: 260,
    damageBody: 150,
    damageLeg: 120,
    reloadTime: 3.5,
    recoilVertical: 0.1,
    recoilHorizontal: 0.02,
    spread: 0.001,
    firstShotAccuracy: 1.0,
    falloffStart: 120,
    falloffEnd: 240,
    penetration: 'High',
    fireMode: 'semi',
    zoomRatio: 4.5,
    specialAbility: {
      name: 'Cryo-Singularity',
      effect: 'cryo_rounds',
      description: 'Freezes hit targets and slows their movement by 45% for 3.5 seconds.',
      procValue: 3.5
    },
    description: 'Cryo-magnetic coil sniper that flash-freezes the impact zone and immobilizes survivors.',
    colorScheme: {
      primary: '#0f172a',
      secondary: '#a855f7',
      glow: '#d8b4fe'
    }
  },

  // ============================================================================
  // 7. LMGS / MACHINE GUNS (4)
  // ============================================================================
  {
    id: 'wpn_titan100',
    name: 'Titan-100 Belt LMG',
    category: 'LMGs',
    archetype: 'belt_lmg',
    cost: 3200,
    magazineSize: 100,
    reserveAmmo: 200,
    fireRate: 10.5,
    damageHead: 128,
    damageBody: 39,
    damageLeg: 32,
    reloadTime: 4.5,
    recoilVertical: 0.042,
    recoilHorizontal: 0.026,
    spread: 0.022,
    firstShotAccuracy: 0.93,
    falloffStart: 30,
    falloffEnd: 60,
    penetration: 'High',
    fireMode: 'auto',
    zoomRatio: 1.35,
    specialAbility: {
      name: 'Depleted Uranium Belt',
      effect: 'armor_shred',
      description: '100-round armor-piercing belt deals 200% damage against enemy shields.',
      procValue: 2.0
    },
    description: '100-round belt-fed light machine gun for unrelenting suppressive fire through walls and smoke.',
    colorScheme: {
      primary: '#27272a',
      secondary: '#eab308',
      glow: '#fbbf24'
    }
  },
  {
    id: 'wpn_dreadnought',
    name: 'Dreadnought Heavy MG',
    category: 'LMGs',
    archetype: 'belt_lmg',
    cost: 3600,
    magazineSize: 120,
    reserveAmmo: 240,
    fireRate: 12.8,
    damageHead: 115,
    damageBody: 36,
    damageLeg: 30,
    reloadTime: 4.8,
    recoilVertical: 0.038,
    recoilHorizontal: 0.024,
    spread: 0.023,
    firstShotAccuracy: 0.91,
    falloffStart: 28,
    falloffEnd: 58,
    penetration: 'High',
    fireMode: 'auto',
    zoomRatio: 1.3,
    specialAbility: {
      name: 'Incendiary Tracer Belt',
      effect: 'incendiary_burn',
      description: 'Every round ignites targets for +16 bonus thermal burn damage.',
      procValue: 16
    },
    description: 'High-volume squad automatic machine gun loaded with exothermic incendiary tracer belts.',
    colorScheme: {
      primary: '#1c1917',
      secondary: '#dc2626',
      glow: '#ef4444'
    }
  },
  {
    id: 'wpn_vulcan_minigun',
    name: 'Vulcan-6 Rotary Minigun',
    category: 'LMGs',
    archetype: 'rotary_minigun',
    cost: 4100,
    magazineSize: 150,
    reserveAmmo: 300,
    fireRate: 16.5,
    damageHead: 105,
    damageBody: 34,
    damageLeg: 28,
    reloadTime: 5.0,
    recoilVertical: 0.035,
    recoilHorizontal: 0.025,
    spread: 0.025,
    firstShotAccuracy: 0.9,
    falloffStart: 25,
    falloffEnd: 55,
    penetration: 'High',
    fireMode: 'auto',
    zoomRatio: 1.25,
    specialAbility: {
      name: 'Ballistic Gun-Shield',
      effect: 'ballistic_shield',
      description: 'Mounted frontal hardlight gun-shield reduces incoming enemy damage by 25% while held.',
      procValue: 0.75
    },
    description: '6-barrel electric rotary gatling gun fitted with a frontal ballistic energy shield.',
    colorScheme: {
      primary: '#09090b',
      secondary: '#f59e0b',
      glow: '#fde047'
    }
  },
  {
    id: 'wpn_tempest_mg',
    name: 'Tempest Arc-Machine Gun',
    category: 'LMGs',
    archetype: 'arc_lmg',
    cost: 3800,
    magazineSize: 85,
    reserveAmmo: 170,
    fireRate: 11.5,
    damageHead: 122,
    damageBody: 37,
    damageLeg: 31,
    reloadTime: 4.2,
    recoilVertical: 0.034,
    recoilHorizontal: 0.02,
    spread: 0.018,
    firstShotAccuracy: 0.94,
    falloffStart: 32,
    falloffEnd: 65,
    penetration: 'High',
    fireMode: 'auto',
    zoomRatio: 1.35,
    specialAbility: {
      name: 'Storm Coil Overload',
      effect: 'chain_lightning',
      description: 'Electrified rounds chain +22 lightning damage to nearby enemies within 5.5m.',
      procValue: 22
    },
    description: 'Twin-drum electromagnetic machine gun that saturates bomb sites with chaining lightning arcs.',
    colorScheme: {
      primary: '#083344',
      secondary: '#00f0ff',
      glow: '#38bdf8'
    }
  },

  // ============================================================================
  // 8. HEAVY WEAPONS (3)
  // ============================================================================
  {
    id: 'wpn_havoc',
    name: 'Havoc Rocket Ordinance',
    category: 'Heavy Weapons',
    archetype: 'rocket_launcher',
    cost: 4500,
    magazineSize: 2,
    reserveAmmo: 6,
    fireRate: 1.1,
    damageHead: 210,
    damageBody: 145,
    damageLeg: 115,
    reloadTime: 3.2,
    recoilVertical: 0.09,
    recoilHorizontal: 0.04,
    spread: 0.012,
    firstShotAccuracy: 0.98,
    falloffStart: 40,
    falloffEnd: 80,
    penetration: 'High',
    fireMode: 'semi',
    zoomRatio: 1.4,
    specialAbility: {
      name: 'High-Yield Warhead',
      effect: 'explosive_rounds',
      description: 'Detonates on wall or target impact with a 5.5m blast radius dealing 75 splash damage.',
      procValue: 75
    },
    description: 'Tactical shoulder-fired rocket launcher. Fires shaped-charge warheads that detonate across entire choke points.',
    colorScheme: {
      primary: '#18181b',
      secondary: '#f97316',
      glow: '#ea580c'
    }
  },
  {
    id: 'wpn_plasmaionx',
    name: 'Plasma Cannon Ion-X',
    category: 'Heavy Weapons',
    archetype: 'plasma_cannon',
    cost: 5000,
    magazineSize: 15,
    reserveAmmo: 45,
    fireRate: 4.2,
    damageHead: 195,
    damageBody: 98,
    damageLeg: 82,
    reloadTime: 3.4,
    recoilVertical: 0.045,
    recoilHorizontal: 0.018,
    spread: 0.01,
    firstShotAccuracy: 0.99,
    falloffStart: 50,
    falloffEnd: 100,
    penetration: 'High',
    fireMode: 'semi',
    zoomRatio: 1.5,
    specialAbility: {
      name: 'Ionized Supernova',
      effect: 'explosive_rounds',
      description: 'Superheated plasma orbs explode in a 4.5m radius for +55 splash damage.',
      procValue: 55
    },
    description: 'Magnetic-containment particle cannon that discharges exploding ionized plasma bolts.',
    colorScheme: {
      primary: '#0f172a',
      secondary: '#06b6d4',
      glow: '#22d3ee'
    }
  },
  {
    id: 'wpn_grenade_thumper',
    name: 'M-79 Swarm Grenade Launcher',
    category: 'Heavy Weapons',
    archetype: 'grenade_launcher',
    cost: 4200,
    magazineSize: 6,
    reserveAmmo: 18,
    fireRate: 2.2,
    damageHead: 175,
    damageBody: 118,
    damageLeg: 95,
    reloadTime: 3.0,
    recoilVertical: 0.065,
    recoilHorizontal: 0.025,
    spread: 0.015,
    firstShotAccuracy: 0.96,
    falloffStart: 35,
    falloffEnd: 70,
    penetration: 'High',
    fireMode: 'semi',
    zoomRatio: 1.3,
    specialAbility: {
      name: 'Thermite Cluster Blast',
      effect: 'explosive_rounds',
      description: '40mm rotary grenades detonate in a 5m radius for +60 blast damage.',
      procValue: 60
    },
    description: '6-cylinder revolving 40mm grenade launcher built to flush defenders from deep site corners.',
    colorScheme: {
      primary: '#1c1917',
      secondary: '#eab308',
      glow: '#f97316'
    }
  }
];

/**
 * Picks a random primary/featured weapon for the 1-minute Buy Phase randomization
 */
export function pickRandomBuyPhaseWeapon(excludeId?: string): Weapon {
  const pool = WEAPONS.filter(
    w => w.id !== DEFAULT_SIDEARM_ID && w.id !== DEFAULT_MELEE_ID && w.id !== excludeId
  );
  return pool[Math.floor(Math.random() * pool.length)] || WEAPONS[0];
}
