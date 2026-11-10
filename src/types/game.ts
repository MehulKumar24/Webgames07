export type AgentRole = 'Assault' | 'Recon' | 'Control' | 'Support' | 'Sentinel';

export type WeaponCategory = 
  | 'Melee'
  | 'Pistols' 
  | 'SMGs' 
  | 'Shotguns' 
  | 'Assault Rifles' 
  | 'Sniper Rifles' 
  | 'LMGs' 
  | 'Heavy Weapons';

export type WeaponArchetype =
  | 'tac_knife'
  | 'karambit'
  | 'katana'
  | 'butterfly'
  | 'tac_pistol'
  | 'revolver'
  | 'suppressed_pistol'
  | 'burst_pistol'
  | 'arc_pistol'
  | 'pocket_shotgun'
  | 'suppressed_smg'
  | 'vector_smg'
  | 'drum_smg'
  | 'p90_bullpup'
  | 'tac_ar'
  | 'phantom_carbine'
  | 'vandal_ak'
  | 'bullpup_ar'
  | 'double_barrel'
  | 'drum_shotgun'
  | 'pump_breacher'
  | 'slug_cannon'
  | 'dmr_sniper'
  | 'bolt_50cal'
  | 'railgun_sniper'
  | 'double_sniper'
  | 'belt_lmg'
  | 'rotary_minigun'
  | 'arc_lmg'
  | 'rocket_launcher'
  | 'plasma_cannon'
  | 'grenade_launcher';

export type WeaponAbilityEffect =
  | 'swift_stride'       // +Movement speed while equipped
  | 'phase_lunge'        // Dash lunge forward on attack
  | 'shockwave_slash'    // Extended 4.8m energy wave cleave
  | 'vampiric_siphon'    // Restores HP on hit/kill
  | 'chain_lightning'    // Jolts nearby enemies within 5.5m
  | 'incendiary_burn'    // Ignites enemy for burn DoT
  | 'cryo_rounds'        // Slows enemy movement & fire rate
  | 'explosive_rounds'   // Deals AoE blast splash on impact
  | 'radar_lock'         // Reveals hit enemy on radar for 5s
  | 'armor_shred'        // Deals bonus damage to armor/shields
  | 'ballistic_shield'   // Reduces incoming damage by 25% while held
  | 'overdrive_refund';  // Refunds ammo & restores shield on kill

export interface WeaponSpecialAbility {
  name: string;
  effect: WeaponAbilityEffect;
  description: string;
  procValue: number;
}

export interface Ability {
  id: string;
  name: string;
  type: 'passive' | 'ability_1' | 'ability_2' | 'ability_3' | 'ultimate';
  icon: string;
  description: string;
  cooldown: number; // in seconds
  charges: number; // max charges per round
  cost: number; // buy cost in credits (0 for passive & ult)
  ultPointsRequired?: number; // for ultimate
  duration?: number;
  tacticalCounter: string;
}

export interface Agent {
  id: string;
  name: string;
  callsign: string;
  gender: 'Male' | 'Female';
  role: AgentRole;
  country: string;
  biography: string;
  personality: string;
  quote: string;
  themeColor: string;
  accentColor: string;
  passive: Ability;
  ability1: Ability;
  ability2: Ability;
  ability3: Ability;
  ultimate: Ability;
}

export interface Weapon {
  id: string;
  name: string;
  category: WeaponCategory;
  archetype?: WeaponArchetype;
  isMelee?: boolean;
  pelletCount?: number;
  meleeRange?: number;
  specialAbility?: WeaponSpecialAbility;
  cost: number;
  magazineSize: number;
  reserveAmmo: number;
  fireRate: number; // rounds or slashes per second
  damageHead: number;
  damageBody: number;
  damageLeg: number;
  reloadTime: number; // in seconds
  recoilVertical: number;
  recoilHorizontal: number;
  spread: number;
  firstShotAccuracy: number; // 0 - 1
  falloffStart: number; // meters
  falloffEnd: number; // meters
  penetration: 'Low' | 'Medium' | 'High';
  fireMode: 'auto' | 'semi' | 'burst' | 'melee';
  burstCount?: number;
  zoomRatio: number; // for ADS
  description: string;
  colorScheme: {
    primary: string;
    secondary: string;
    glow: string;
  };
}

export interface MapData {
  id: string;
  name: string;
  codename: string;
  location: string;
  description: string;
  theme: 'cyberpunk' | 'desert' | 'arctic' | 'harbor' | 'overgrown';
  ambientColor: number;
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  sunPosition: [number, number, number];
  sunColor: number;
  sunIntensity: number;
  siteA: { x: number; z: number; radius: number; label: string };
  siteB: { x: number; z: number; radius: number; label: string };
  attackerSpawn: { x: number; z: number; yaw: number };
  defenderSpawn: { x: number; z: number; yaw: number };
  callouts: Array<{ name: string; x: number; z: number }>;
}

export type GameMode = 
  | 'tactical_plant' 
  | 'team_elimination' 
  | 'deathmatch' 
  | 'practice_range' 
  | 'custom_match';

export type BotDifficulty = 'Beginner' | 'Easy' | 'Normal' | 'Hard' | 'Expert';

export type TeamSide = 'attackers' | 'defenders';

export interface PlayerStats {
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  headshots: number;
  damageDealt: number;
  plants: number;
  defuses: number;
}

export interface MatchPlayer {
  id: string;
  name: string;
  agentId: string;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  team: 'alpha' | 'omega';
  side?: TeamSide;
  hasSpike?: boolean;
  health: number;
  maxHealth: number;
  armor: number; // 0, 25 (light), 50 (heavy)
  maxArmor: number;
  credits: number;
  isAlive: boolean;
  isPlanting: boolean;
  isDefusing: boolean;
  ultPoints: number;
  stats: PlayerStats;
  currentWeaponId: string;
  sidearmWeaponId: string;
  meleeWeaponId?: string;
  inventory: string[]; // weapon IDs
  abilityCooldowns: { [abilityId: string]: number };
  abilityCharges: { [abilityId: string]: number };
}

export interface KillFeedEntry {
  id: string;
  killerName: string;
  killerTeam: 'alpha' | 'omega';
  victimName: string;
  victimTeam: 'alpha' | 'omega';
  weaponName: string;
  isHeadshot: boolean;
  isAbility: boolean;
  timestamp: number;
}

export type TacticalChatCategory = 'strategy' | 'callout' | 'objective' | 'status' | 'ping';

export interface TacticalChatEntry {
  id: string;
  senderName: string;
  senderRole?: string;
  team: 'alpha' | 'omega';
  category: TacticalChatCategory;
  calloutLocation?: string;
  message: string;
  timestamp: number;
}

export interface DamageNumber {
  id: string;
  amount: number;
  isHeadshot: boolean;
  position: [number, number, number];
  createdAt: number;
}

export interface ControlSettings {
  lookSensitivityX: number;
  lookSensitivityY: number;
  adsSensitivityMultiplier: number;
  invertY: boolean;
  buttonScale: number; // 0.8 to 1.4
  buttonOpacity: number; // 0.3 to 1.0
  gyroscopeEnabled: boolean;
  gyroSensitivity: number;
  leftHandedMode: boolean;
  autoReload: boolean;
  tapToFire: boolean;
}

export interface GraphicsSettings {
  preset: 'Low' | 'Medium' | 'High' | 'Ultra';
  shadows: boolean;
  particleQuality: 'low' | 'med' | 'high';
  fov: number; // 75 - 105
  postProcessing: boolean;
  targetFps: number;
}

export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  musicVolume: number;
  muted: boolean;
}
