import { Agent } from '../types/game';

export const AGENTS: Agent[] = [
  // 1. Vortex (Male - Assault)
  {
    id: 'agent_vortex',
    name: 'Kaelen Vance',
    callsign: 'VORTEX',
    gender: 'Male',
    role: 'Assault',
    country: 'United Kingdom',
    personality: 'Aggressive, adrenaline-fueled shock-trooper with razor-sharp reflexes.',
    biography: 'Former Royal Kinetic Corps pilot, Vance survived an experimental hyper-drive catastrophe that left his nervous system infused with localized kinetic charge.',
    quote: '"Blink and the breach is already over."',
    themeColor: '#00f0ff',
    accentColor: '#0077ff',
    passive: {
      id: 'vortex_passive',
      name: 'Kinetic Momentum',
      type: 'passive',
      icon: 'Zap',
      description: 'Scoring an elimination immediately grants a +20% movement speed boost and resets tactical dash for 3 seconds.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      tacticalCounter: 'Vulnerable to slow fields and traps while chaining momentum.'
    },
    ability1: {
      id: 'vortex_dash',
      name: 'Shock Burst',
      type: 'ability_1',
      icon: 'FastForward',
      description: 'Instantly propels forward in the direction of movement, breaking projectile tracking.',
      cooldown: 10,
      charges: 2,
      cost: 150,
      tacticalCounter: 'Audio cue alerts enemies to arrival angle; weapon cannot fire for 0.4s during dash.'
    },
    ability2: {
      id: 'vortex_grenade',
      name: 'Graviton Flash',
      type: 'ability_2',
      icon: 'Sun',
      description: 'Throws a kinetic orb that detonates after bouncing once, emitting a blinding concussive flash (2.2s).',
      cooldown: 14,
      charges: 2,
      cost: 250,
      duration: 2.2,
      tacticalCounter: 'Can be dodged by looking away 90 degrees before detonation.'
    },
    ability3: {
      id: 'vortex_rift',
      name: 'Repulsor Well',
      type: 'ability_3',
      icon: 'Disc',
      description: 'Deploys a ground mine that lifts any agent entering its radius 4 meters into the air for 3s.',
      cooldown: 20,
      charges: 1,
      cost: 200,
      duration: 3.0,
      tacticalCounter: 'Airborne targets can still shoot with decreased hipfire accuracy.'
    },
    ultimate: {
      id: 'vortex_ult',
      name: 'Singularity Crash',
      type: 'ultimate',
      icon: 'Sparkles',
      description: 'Channels hyper-kinetic surge, launching forward into a massive gravity implosion that pulls in enemies and deals 80 damage.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      ultPointsRequired: 7,
      tacticalCounter: 'Telegraphed ground circle gives 0.8s to dash or retreat out of epicenter.'
    }
  },

  // 2. Umbra (Female - Recon)
  {
    id: 'agent_umbra',
    name: 'Nyx Calder',
    callsign: 'UMBRA',
    gender: 'Female',
    role: 'Recon',
    country: 'Norway',
    personality: 'Methodical, cold intelligence specialist who sees through every shadow.',
    biography: 'Svalbard Arctic Observatory chief analyst who engineered acoustic resonance drones to penetrate concrete and military stealth baffling.',
    quote: '"Darkness is merely information waiting to be decoded."',
    themeColor: '#a855f7',
    accentColor: '#3b82f6',
    passive: {
      id: 'umbra_passive',
      name: 'Thermal Sight',
      type: 'passive',
      icon: 'Eye',
      description: 'Damaged enemies remain marked through walls with an ethereal cyan silhouette for 1.5 seconds.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      tacticalCounter: 'Smoke screens and sensor jammers break the silhouette marker.'
    },
    ability1: {
      id: 'umbra_dart',
      name: 'Sonar Dart',
      type: 'ability_1',
      icon: 'Radio',
      description: 'Fires an acoustic micro-dart that latches to surfaces and emits 3 sonar pulses revealing enemies in line-of-sight.',
      cooldown: 35,
      charges: 1,
      cost: 0, // Signature ability recharges
      tacticalCounter: 'Dart has 20 HP and can be shot to destroy the scan early.'
    },
    ability2: {
      id: 'umbra_drone',
      name: 'Shadow Hawk',
      type: 'ability_2',
      icon: 'Navigation',
      description: 'Launches an automated recon bird drone flying forward that tags enemies with an acoustic ping.',
      cooldown: 20,
      charges: 1,
      cost: 300,
      tacticalCounter: 'Easily shot down and has loud propulsion audio.'
    },
    ability3: {
      id: 'umbra_mine',
      name: 'Sensor Web',
      type: 'ability_3',
      icon: 'ShieldAlert',
      description: 'Places a clandestine wall mine that triggers a deafening noise and reveals any sprinting foe passing by.',
      cooldown: 18,
      charges: 2,
      cost: 200,
      tacticalCounter: 'Crouch walking bypasses the trip frequency without detection.'
    },
    ultimate: {
      id: 'umbra_ult',
      name: 'All-Seeing Void',
      type: 'ultimate',
      icon: 'Scan',
      description: 'Calder overcharges the global satellite grid, revealing the real-time position of all alive enemy agents for 6 seconds.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      ultPointsRequired: 8,
      tacticalCounter: 'Does not impair enemy mobility or weapons; enemies know they are revealed.'
    }
  },

  // 3. Cryo (Female - Control)
  {
    id: 'agent_cryo',
    name: 'Dr. Elizabeth Frost',
    callsign: 'CRYO',
    gender: 'Female',
    role: 'Control',
    country: 'Canada',
    personality: 'Pragmatic, icy thermodynamic scientist obsessed with atmospheric control.',
    biography: 'Pioneered cryogenic phase-change polymers for sub-zero planetary terraforming, repurposed into defensive area-denial tactical armaments.',
    quote: '"Let us lower the ambient temperature to absolute zero."',
    themeColor: '#38bdf8',
    accentColor: '#93c5fd',
    passive: {
      id: 'cryo_passive',
      name: 'Permafrost Boots',
      type: 'passive',
      icon: 'Snowflake',
      description: 'Immunized against all ice, slow fields, and friction losses; slides 30% further.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      tacticalCounter: 'Only benefits sliding mechanics, standard sprint is unaffected.'
    },
    ability1: {
      id: 'cryo_wall',
      name: 'Glacial Rampart',
      type: 'ability_1',
      icon: 'Layers',
      description: 'Erects a towering 5-pillar solid ice wall that blocks vision and enemy gunfire for 20 seconds.',
      cooldown: 30,
      charges: 1,
      cost: 400,
      duration: 20,
      tacticalCounter: 'Individual ice pillars can be destroyed with 400 damage each.'
    },
    ability2: {
      id: 'cryo_slick',
      name: 'Sub-Zero Slick',
      type: 'ability_2',
      icon: 'Droplet',
      description: 'Coats a 10m ground zone in friction-less ice, cutting enemy movement control and causing them to slide helplessly.',
      cooldown: 15,
      charges: 2,
      cost: 200,
      duration: 7,
      tacticalCounter: 'Jumping allows players to clear segments of the slick.'
    },
    ability3: {
      id: 'cryo_cloud',
      name: 'Cryo Smoke',
      type: 'ability_3',
      icon: 'Cloud',
      description: 'Deploys a dense freezing smoke sphere that blocks vision and slows enemy entry speed by 40%.',
      cooldown: 25,
      charges: 2,
      cost: 150,
      duration: 14,
      tacticalCounter: 'Cannot block sound or physical projectiles.'
    },
    ultimate: {
      id: 'cryo_ult',
      name: 'Absolute Blizzard',
      type: 'ultimate',
      icon: 'Wind',
      description: 'Unleashes an expanding catastrophic snowstorm across an entire bomb site, freezing weapon fire rates and decaying 70 enemy health.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      ultPointsRequired: 7,
      tacticalCounter: 'Decayed health regenerates slowly once leaving the blizzard radius.'
    }
  },

  // 4. Bunker (Male - Sentinel)
  {
    id: 'agent_bunker',
    name: 'Torin Vance',
    callsign: 'BUNKER',
    gender: 'Male',
    role: 'Sentinel',
    country: 'Germany',
    personality: 'Stoic heavy engineer and fortification architect. Brother to Kaelen Vance.',
    biography: 'Chief defense contractor for orbital sky stations, Torin specializes in hardlight barriers, automatic suppressive turrets, and choke lockouts.',
    quote: '"They will break against this line like water against granite."',
    themeColor: '#eab308',
    accentColor: '#ca8a04',
    passive: {
      id: 'bunker_passive',
      name: 'Reinforced Plating',
      type: 'passive',
      icon: 'Shield',
      description: 'Takes 15% reduced damage from explosive ordinances and environmental damage.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      tacticalCounter: 'Bullet headshot damage remains fully lethal.'
    },
    ability1: {
      id: 'bunker_barricade',
      name: 'Hardlight Barricade',
      type: 'ability_1',
      icon: 'Square',
      description: 'Deploys a chest-high translucent energy shield providing bulletproof cover with peek cutouts.',
      cooldown: 25,
      charges: 1,
      cost: 250,
      duration: 25,
      tacticalCounter: 'Shield has a vulnerable yellow battery core on its rear side.'
    },
    ability2: {
      id: 'bunker_turret',
      name: 'Sentinel Auto-Cannon',
      type: 'ability_2',
      icon: 'Crosshair',
      description: 'Places a 180-degree automated micro-turret that fires warning bursts (8 dmg/shot) and alerts team to flanks.',
      cooldown: 40,
      charges: 1,
      cost: 0, // Signature
      tacticalCounter: 'Has 75 HP and can be disabled with EMP or smoke cover.'
    },
    ability3: {
      id: 'bunker_tripwire',
      name: 'Concussion Tripbeam',
      type: 'ability_3',
      icon: 'ZapOff',
      description: 'Stretches a covert laser across doorways; enemies crossing get concussed and tethered for 3 seconds.',
      cooldown: 20,
      charges: 2,
      cost: 200,
      tacticalCounter: 'Can be spotted by hum and shot before walking across.'
    },
    ultimate: {
      id: 'bunker_ult',
      name: 'Aegis Fortress',
      type: 'ultimate',
      icon: 'ShieldCheck',
      description: 'Overcharges site defense with a hemispherical energy dome that denies enemy bullet penetration and deflects explosives for 15s.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      ultPointsRequired: 7,
      tacticalCounter: 'Enemies can walk through the boundary to fight inside the dome.'
    }
  },

  // 5. Aether (Female - Support)
  {
    id: 'agent_aether',
    name: 'Maya Solano',
    callsign: 'AETHER',
    gender: 'Female',
    role: 'Support',
    country: 'Brazil',
    personality: 'Compassionate combat medic with energetic optimism and steady nerves.',
    biography: 'Field surgeon in Amazonian disaster zones who synthesized cellular nanite suspensions that accelerate tissue and synthetic armor reconstruction.',
    quote: '"Stand back up. Our mission is far from over."',
    themeColor: '#10b981',
    accentColor: '#059669',
    passive: {
      id: 'aether_passive',
      name: 'Triage Aura',
      type: 'passive',
      icon: 'HeartPulse',
      description: 'Allies within 8 meters heal 2 HP every second when out of combat for 4 seconds.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      tacticalCounter: 'Combat damage pauses the regeneration aura for 4 seconds.'
    },
    ability1: {
      id: 'aether_nanites',
      name: 'Nanite Infusion',
      type: 'ability_1',
      icon: 'PlusSquare',
      description: 'Fires a targeted nanite beacon at an ally (or self) to restore 60 HP over 4 seconds.',
      cooldown: 45,
      charges: 1,
      cost: 0, // Signature
      duration: 4,
      tacticalCounter: 'Taking headshot damage interrupts the healing stream.'
    },
    ability2: {
      id: 'aether_stim',
      name: 'Adrenaline Mist',
      type: 'ability_2',
      icon: 'Activity',
      description: 'Throws a pressurized canister creating a gold vapor zone that buffs ally reload speed (+30%) and fire rate (+15%).',
      cooldown: 20,
      charges: 2,
      cost: 150,
      duration: 8,
      tacticalCounter: 'Buff only persists while standing within the mist perimeter.'
    },
    ability3: {
      id: 'aether_ward',
      name: 'Deflection Pylon',
      type: 'ability_3',
      icon: 'RadioTower',
      description: 'Deploys a portable trophy system that intercepts and detonates up to 2 incoming enemy grenades/flashes.',
      cooldown: 30,
      charges: 1,
      cost: 250,
      tacticalCounter: 'Does not stop bullets; destroyed in 2 gunshots.'
    },
    ultimate: {
      id: 'aether_ult',
      name: 'Nanite Resurgence',
      type: 'ultimate',
      icon: 'Sparkle',
      description: 'Channels high-density nanobots to instantly revive a fallen teammate with full 100 HP, or restores 100 HP & 50 Armor to entire living squad.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      ultPointsRequired: 8,
      tacticalCounter: 'Revival channel requires 2.5s stationary cast; vulnerable to snipers.'
    }
  },

  // 6. Ignis (Male - Assault)
  {
    id: 'agent_ignis',
    name: 'Ramiro Cruz',
    callsign: 'IGNIS',
    gender: 'Male',
    role: 'Assault',
    country: 'Mexico',
    personality: 'Fiery, charismatic pyrotechnic daredevil who thrives in close-quarters chaos.',
    biography: 'Former demolitionist in geothermal bore mines, Cruz built wrist-mounted napalm accelerators that ignite choke points in seconds.',
    quote: '"Step into the heat or burn outside the ring."',
    themeColor: '#f97316',
    accentColor: '#ea580c',
    passive: {
      id: 'ignis_passive',
      name: 'Thermal Battery',
      type: 'passive',
      icon: 'Flame',
      description: 'Walking over burning ground restores 10 armor per second up to max.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      tacticalCounter: 'Only triggers on Ignis\'s own flames, does not make him immune to headshots.'
    },
    ability1: {
      id: 'ignis_thermite',
      name: 'Thermite Core',
      type: 'ability_1',
      icon: 'Bomb',
      description: 'Launches a molten grenade that leaves a lingering pool of white-hot fire dealing 45 dps.',
      cooldown: 20,
      charges: 2,
      cost: 250,
      duration: 6,
      tacticalCounter: 'Can be extinguished by Cryo ice walls or smoke clouds.'
    },
    ability2: {
      id: 'ignis_wall',
      name: 'Firewall',
      type: 'ability_2',
      icon: 'AlignJustify',
      description: 'Casts a linear curtain of blazing fire blocking vision and burning any enemy who pushes through.',
      cooldown: 30,
      charges: 1,
      cost: 0, // Signature
      duration: 8,
      tacticalCounter: 'Lasts only 8 seconds; bullet tracers reveal firing positions through it.'
    },
    ability3: {
      id: 'ignis_flash',
      name: 'Solar Flare',
      type: 'ability_3',
      icon: 'SunDim',
      description: 'Curves a blinding fireball around corner angles that explodes on impact with air.',
      cooldown: 12,
      charges: 2,
      cost: 250,
      duration: 2.0,
      tacticalCounter: 'Audio whoosh indicates arrival direction.'
    },
    ultimate: {
      id: 'ignis_ult',
      name: 'Supernova Beam',
      type: 'ultimate',
      icon: 'Zap',
      description: 'Channels a concentrated plasma beam piercing through walls and incinerating everything in a 30m corridor for 120 dmg.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      ultPointsRequired: 7,
      tacticalCounter: 'Wall indicator beam warns enemies 0.6s prior to full ignition.'
    }
  },

  // 7. Mirage (Female - Control)
  {
    id: 'agent_mirage',
    name: 'Sylvia Chen',
    callsign: 'MIRAGE',
    gender: 'Female',
    role: 'Control',
    country: 'Singapore',
    personality: 'Deceptive, witty illusionist who turns enemy certainty into paranoia.',
    biography: 'Architect of advanced photonic metamaterials, Chen developed portable holographic projectors capable of spoofing both optics and ballistics.',
    quote: '"Believe half of what you see, and none of what you think I am."',
    themeColor: '#ec4899',
    accentColor: '#db2777',
    passive: {
      id: 'mirage_passive',
      name: 'Refractive Shimmer',
      type: 'passive',
      icon: 'Sparkles',
      description: 'While standing motionless for 1.5 seconds, becomes semi-translucent until moving or firing.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      tacticalCounter: 'Recon darts and proximity sensors immediately break cloak.'
    },
    ability1: {
      id: 'mirage_clone',
      name: 'Phantom Decoy',
      type: 'ability_1',
      icon: 'Users',
      description: 'Sends forth a running holographic clone that triggers enemy crosshair red indicators and mimics footsteps.',
      cooldown: 18,
      charges: 2,
      cost: 200,
      tacticalCounter: 'Shooting the decoy dissipates it in a minor flash and reveals the shooter.'
    },
    ability2: {
      id: 'mirage_smoke',
      name: 'Prism Eclipse',
      type: 'ability_2',
      icon: 'CircleDot',
      description: 'Deploys a targeted iridescent smoke orb from tactical tablet coordinates that obscures sightlines for 16s.',
      cooldown: 30,
      charges: 3,
      cost: 100,
      duration: 16,
      tacticalCounter: 'Hollow inside; entering the smoke allows seeing other agents inside.'
    },
    ability3: {
      id: 'mirage_swap',
      name: 'Phase Swap',
      type: 'ability_3',
      icon: 'RefreshCw',
      description: 'Leaves a localized beacon, then reactivates within 6s to teleport back to the anchor point.',
      cooldown: 35,
      charges: 1,
      cost: 250,
      tacticalCounter: 'Anchor emits an audible hum and can be camped by alert defenders.'
    },
    ultimate: {
      id: 'mirage_ult',
      name: 'Hall of Mirrors',
      type: 'ultimate',
      icon: 'EyeOff',
      description: 'Creates 4 aggressive duplicates throughout the area while granting Mirage complete invisibility for 8 seconds.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      ultPointsRequired: 7,
      tacticalCounter: 'Firing a weapon cancels the invisibility immediately.'
    }
  },

  // 8. Rook (Male - Sentinel)
  {
    id: 'agent_rook',
    name: 'Garrison Briggs',
    callsign: 'ROOK',
    gender: 'Male',
    role: 'Sentinel',
    country: 'United States',
    personality: 'Hardened veteran urban pacification commander with disciplined tactical grit.',
    biography: 'Decorated tactical squad leader who survived the Megacity Sieges using modular magnetic containment barriers and anti-breach traps.',
    quote: '"Every doorway in this complex belongs to me."',
    themeColor: '#64748b',
    accentColor: '#475569',
    passive: {
      id: 'rook_passive',
      name: 'Tactical Discipline',
      type: 'passive',
      icon: 'CheckCircle',
      description: 'First shot accuracy after switching weapons is increased by 35% with 20% faster weapon draw.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      tacticalCounter: 'Passive only applies to initial bullet after weapon swap.'
    },
    ability1: {
      id: 'rook_gravmine',
      name: 'Gravity Snare',
      type: 'ability_1',
      icon: 'Anchor',
      description: 'Anchors a magnetic mine to floors or walls; approaching enemies get pulled toward the center and anchored for 3s.',
      cooldown: 22,
      charges: 2,
      cost: 200,
      tacticalCounter: 'Mine has 50 HP and can be shot to neutralize.'
    },
    ability2: {
      id: 'rook_suppression',
      name: 'Suppressor Field',
      type: 'ability_2',
      icon: 'Sliders',
      description: 'Deploys an acoustic dampener emitter that silences all friendly weapon fire and footsteps in a 12m perimeter for 15s.',
      cooldown: 30,
      charges: 1,
      cost: 200,
      duration: 15,
      tacticalCounter: 'The central emitter can be spotted and shot down.'
    },
    ability3: {
      id: 'rook_shockplate',
      name: 'Riot Blast Door',
      type: 'ability_3',
      icon: 'Shield',
      description: 'Locks down any narrow corridor with a heavy reinforced blast shutter that requires 800 damage to breach.',
      cooldown: 40,
      charges: 1,
      cost: 0, // Signature
      tacticalCounter: 'Heavy weapons and sniper rifles deal double damage to the shutter.'
    },
    ultimate: {
      id: 'rook_ult',
      name: 'Orbital Lockdown',
      type: 'ultimate',
      icon: 'Crosshair',
      description: 'Calls in a precision orbital kinetic lance that pulses 3 times, disarming and disabling enemy abilities across a 20m sector for 9s.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      ultPointsRequired: 8,
      tacticalCounter: '2-second laser targeting warning allows moving out of the impact zone.'
    }
  },

  // 9. Kage (Female - Assault)
  {
    id: 'agent_kage',
    name: 'Yuki Tanaka',
    callsign: 'KAGE',
    gender: 'Female',
    role: 'Assault',
    country: 'Japan',
    personality: 'Silent, deadly cyber-infiltrator who values absolute precision and speed.',
    biography: 'Former black-ops operative who mastered carbon-fiber stealth suits and high-frequency throwing blades for room clearing.',
    quote: '"The edge speaks swifter than words."',
    themeColor: '#ef4444',
    accentColor: '#b91c1c',
    passive: {
      id: 'kage_passive',
      name: 'Shadowstep',
      type: 'passive',
      icon: 'Footprints',
      description: 'Footstep sound radius while sprinting is 40% quieter than standard agents.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      tacticalCounter: 'Recon darts and sonar pulses still detect her footsteps.'
    },
    ability1: {
      id: 'kage_shuriken',
      name: 'Shuriken Barrage',
      type: 'ability_1',
      icon: 'Play',
      description: 'Fling 3 high-speed monomolecular shurikens dealing 50 damage each with high headshot multiplier.',
      cooldown: 16,
      charges: 2,
      cost: 200,
      tacticalCounter: 'Projectile velocity requires leading moving targets.'
    },
    ability2: {
      id: 'kage_fade',
      name: 'Mist Step',
      type: 'ability_2',
      icon: 'Wind',
      description: 'Dissolves into dark mist for 2 seconds, becoming invulnerable and moving +40% faster.',
      cooldown: 28,
      charges: 1,
      cost: 0, // Signature
      duration: 2,
      tacticalCounter: 'Cannot fire or interact while in mist; loud materialization cue when ending.'
    },
    ability3: {
      id: 'kage_smokescreen',
      name: 'Obsidian Veil',
      type: 'ability_3',
      icon: 'CloudRain',
      description: 'Throws a pressurized capsule creating a pitch-black smoke puff lasting 10 seconds.',
      cooldown: 18,
      charges: 2,
      cost: 150,
      duration: 10,
      tacticalCounter: 'Shorter duration than Controller smokes.'
    },
    ultimate: {
      id: 'kage_ult',
      name: 'Blade of the Eclipse',
      type: 'ultimate',
      icon: 'Sword',
      description: 'Equips 5 high-frequency phantom daggers that instant-kill on headshot, refill on kill, and allow mid-air hovering.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      ultPointsRequired: 7,
      tacticalCounter: 'Missing daggers leaves her vulnerable with no primary weapon in hand.'
    }
  },

  // 10. Pulse (Male - Recon)
  {
    id: 'agent_pulse',
    name: 'Aiden Sterling',
    callsign: 'PULSE',
    gender: 'Male',
    role: 'Recon',
    country: 'Australia',
    personality: 'Tech-savvy electronic warfare specialist with quick wit and sharp intuition.',
    biography: 'Perth telecom hacker recruited into electronic counter-intelligence, Sterling built directional electromagnetic tracking scanners.',
    quote: '"Signal acquired. You cannot hide from frequency."',
    themeColor: '#06b6d4',
    accentColor: '#0891b2',
    passive: {
      id: 'pulse_passive',
      name: 'Heartbeat Scanner',
      type: 'passive',
      icon: 'Activity',
      description: 'Tactical mini-map displays approximate quadrant blips when enemies sprint within 25 meters.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      tacticalCounter: 'Enemies who walk or crouch will not register on the scanner.'
    },
    ability1: {
      id: 'pulse_tracker',
      name: 'Acoustic Tag',
      type: 'ability_1',
      icon: 'Crosshair',
      description: 'Fires a suppression tracker round; tagged enemies have their exact crosshair direction visible for 4s.',
      cooldown: 20,
      charges: 2,
      cost: 200,
      duration: 4,
      tacticalCounter: 'Target is notified of tracking and can take cover.'
    },
    ability2: {
      id: 'pulse_jammer',
      name: 'Signal Jammer',
      type: 'ability_2',
      icon: 'WifiOff',
      description: 'Deploys a jammer beacon that scrambles enemy HUD mini-maps and crosshair indicators within 20m.',
      cooldown: 35,
      charges: 1,
      cost: 0, // Signature
      duration: 18,
      tacticalCounter: 'Beacon can be located by static hum and destroyed in 1 shot.'
    },
    ability3: {
      id: 'pulse_flash',
      name: 'Strobe Flash',
      type: 'ability_3',
      icon: 'Sun',
      description: 'Rolls a high-frequency strobe orb that flashes any player looking at it twice in rapid succession.',
      cooldown: 15,
      charges: 2,
      cost: 250,
      duration: 2.5,
      tacticalCounter: 'Distinctive double flash allows counter-peeking between pulses.'
    },
    ultimate: {
      id: 'pulse_ult',
      name: 'EMP Storm',
      type: 'ultimate',
      icon: 'Zap',
      description: 'Detonates an electromagnetic shockwave across the map, disabling all enemy utility, silencing abilities, and draining 50 armor for 10s.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      ultPointsRequired: 8,
      tacticalCounter: 'Does not impair pure gunplay mechanics; weapon aim remains true.'
    }
  },

  // 11. Flora (Female - Support)
  {
    id: 'agent_flora',
    name: 'Zara Vance',
    callsign: 'FLORA',
    gender: 'Female',
    role: 'Support',
    country: 'Kenya',
    personality: 'Genial botanist turned survival tactician; sister to Kaelen and Torin Vance.',
    biography: 'Nairobi bio-dome lead researcher who weaponized photosynthetic symbionts that root enemies and rapidly regenerate team vital signs.',
    quote: '"Roots run deep. Let life outlast steel."',
    themeColor: '#84cc16',
    accentColor: '#65a30d',
    passive: {
      id: 'flora_passive',
      name: 'Photosynthetic Shield',
      type: 'passive',
      icon: 'Sun',
      description: 'Gains 1 armor point per second while standing in open sunlight or well-lit map sectors (up to +25 armor).',
      cooldown: 0,
      charges: 1,
      cost: 0,
      tacticalCounter: 'Indoor hallways and tunnels do not provide sunlight regeneration.'
    },
    ability1: {
      id: 'flora_bramble',
      name: 'Entangling Vines',
      type: 'ability_1',
      icon: 'GitCommit',
      description: 'Spreads creeping thorny vines across the floor; enemies stepping in receive 30% slow and 15 bleed damage.',
      cooldown: 20,
      charges: 2,
      cost: 200,
      duration: 8,
      tacticalCounter: 'Fire abilities instantly incinerate the vine patch.'
    },
    ability2: {
      id: 'flora_spores',
      name: 'Restorative Spores',
      type: 'ability_2',
      icon: 'Heart',
      description: 'Hurls a bio-pod that emits a 6m healing cloud restoring 15 HP/sec to all friendly operatives for 6s.',
      cooldown: 35,
      charges: 1,
      cost: 0, // Signature
      duration: 6,
      tacticalCounter: 'Enemies standing in the spore cloud receive no benefits.'
    },
    ability3: {
      id: 'flora_bark',
      name: 'Ironwood Bark',
      type: 'ability_3',
      icon: 'ShieldAlert',
      description: 'Applies an organic chitin shield to an ally that absorbs the next incoming instance of bullet damage up to 40.',
      cooldown: 25,
      charges: 1,
      cost: 250,
      duration: 10,
      tacticalCounter: 'Shield expires after 10s if not hit.'
    },
    ultimate: {
      id: 'flora_ult',
      name: 'Verdant Overgrowth',
      type: 'ultimate',
      icon: 'Trees',
      description: 'Erupts massive bio-walls and healing trees throughout an entire bomb site, healing all allies and disorienting enemies for 12 seconds.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      ultPointsRequired: 7,
      tacticalCounter: 'Massive physical foliage can be used by both teams as cover.'
    }
  },

  // 12. Titan (Male - Control)
  {
    id: 'agent_titan',
    name: 'Dmitri Voronov',
    callsign: 'TITAN',
    gender: 'Male',
    role: 'Control',
    country: 'Kazakhstan',
    personality: 'Colossal tectonic warfare operator with unyielding resolve and crushing presence.',
    biography: 'Baikonur heavy launch engineer who adapted seismic stabilization pistons into hand-held geological shock projectors.',
    quote: '"Stand firm, or be crushed under the tectonic shift."',
    themeColor: '#d97706',
    accentColor: '#b45309',
    passive: {
      id: 'titan_passive',
      name: 'Seismic Dampening',
      type: 'passive',
      icon: 'Disc',
      description: 'Aim punch and screen shake from incoming enemy bullets is reduced by 60%.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      tacticalCounter: 'Player hitboxes are slightly broader than lighter agents.'
    },
    ability1: {
      id: 'titan_shockwave',
      name: 'Tectonic Slam',
      type: 'ability_1',
      icon: 'Zap',
      description: 'Slams fists into the ground, sending a linear shockwave forward that knocks up and concusses foes for 2.5s.',
      cooldown: 30,
      charges: 1,
      cost: 0, // Signature
      tacticalCounter: 'Can be avoided by jumping right as the shockwave reaches your position.'
    },
    ability2: {
      id: 'titan_barricade',
      name: 'Rubble Wall',
      type: 'ability_2',
      icon: 'Columns',
      description: 'Raises 3 thick stone barricades from the earth to seal a choke point for 14 seconds.',
      cooldown: 25,
      charges: 2,
      cost: 200,
      duration: 14,
      tacticalCounter: 'Can be climbed over using elevated crates or mobility abilities.'
    },
    ability3: {
      id: 'titan_dust',
      name: 'Sandstorm Mortar',
      type: 'ability_3',
      icon: 'Cloud',
      description: 'Launches a high-arc mortar that blankets a target area in dense choking dust, obscuring sightlines for 12 seconds.',
      cooldown: 20,
      charges: 2,
      cost: 150,
      duration: 12,
      tacticalCounter: 'Reveals mortar trajectory while flying through the air.'
    },
    ultimate: {
      id: 'titan_ult',
      name: 'Cataclysm Quake',
      type: 'ultimate',
      icon: 'Radioactive',
      description: 'Pounds the earth to trigger a cascading 3-stage earthquake spanning 35 meters, dealing 90 damage and toppling enemy crosshairs downward.',
      cooldown: 0,
      charges: 1,
      cost: 0,
      ultPointsRequired: 8,
      tacticalCounter: '3-stage sequential pulse gives defenders time to fall back from stage 1 to safety.'
    }
  }
];
