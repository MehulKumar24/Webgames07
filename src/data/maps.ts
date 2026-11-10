import { MapData } from '../types/game';

export const MAPS: MapData[] = [
  // 1. Neon District
  {
    id: 'map_neon_district',
    name: 'Neon District',
    codename: 'SECTOR-09',
    location: 'Neo Tokyo Megacity, Japan',
    description: 'A rain-slick neon district with a contested skybridge mid, open boulevard approaches, and covered service lanes around the substation and arcade.',
    theme: 'cyberpunk',
    ambientColor: 0x64748b,
    skyColor: 0x1e293b,
    fogColor: 0x26354d,
    fogDensity: 0.0028,
    sunPosition: [28, 55, 28],
    sunColor: 0xe0f2fe,
    sunIntensity: 1.45,
    siteA: { x: 26, z: -22, radius: 7.0, label: 'SITE A - SUBSTATION' },
    siteB: { x: -26, z: -22, radius: 7.0, label: 'SITE B - NEON ARCADE' },
    attackerSpawn: { x: 0, z: 40, yaw: 0 },
    defenderSpawn: { x: 0, z: -40, yaw: Math.PI },
    callouts: [
      { name: 'Attacker Plaza', x: 0, z: 38 },
      { name: 'A Long Boulevard', x: 24, z: 12 },
      { name: 'A Substation Gate', x: 25, z: -8 },
      { name: 'Site A Substation', x: 26, z: -22 },
      { name: 'Mid Skybridge', x: 0, z: 0 },
      { name: 'Mid Underpass', x: 0, z: -10 },
      { name: 'East Service Lane', x: 38, z: 2 },
      { name: 'West Service Lane', x: -38, z: 2 },
      { name: 'B Cyber Market', x: -22, z: 12 },
      { name: 'B Arcade Alley', x: -24, z: -6 },
      { name: 'Site B Arcade', x: -26, z: -22 },
      { name: 'Defender Metro', x: 0, z: -38 }
    ]
  },

  // 2. Dustfall
  {
    id: 'map_dustfall',
    name: 'Dustfall',
    codename: 'FACILITY-42',
    location: 'Atacama Desert, Chile',
    description: 'A sunlit geothermal plant split by a hazardous crater, with raised catwalk mid, sandstone side routes, and distinct solar and refinery sites.',
    theme: 'desert',
    ambientColor: 0x8c6d53,
    skyColor: 0x7dd3fc,
    fogColor: 0xd6b490,
    fogDensity: 0.0025,
    sunPosition: [35, 58, 22],
    sunColor: 0xfffbeb,
    sunIntensity: 1.4,
    siteA: { x: 28, z: -20, radius: 7.0, label: 'SITE A - SOLAR SPIRE' },
    siteB: { x: -28, z: -20, radius: 7.0, label: 'SITE B - REFINERY SILOS' },
    attackerSpawn: { x: 0, z: 41, yaw: 0 },
    defenderSpawn: { x: 0, z: -41, yaw: Math.PI },
    callouts: [
      { name: 'Dune Outpost', x: 0, z: 38 },
      { name: 'A Canyon Arch', x: 24, z: 12 },
      { name: 'Site A Solar Spire', x: 28, z: -20 },
      { name: 'Magma Crater Bridge', x: 0, z: 0 },
      { name: 'Mid Bastion', x: 0, z: -12 },
      { name: 'East Canyon Route', x: 38, z: 2 },
      { name: 'West Canyon Route', x: -38, z: 2 },
      { name: 'B Sandstone Pass', x: -24, z: 12 },
      { name: 'Site B Silos', x: -28, z: -20 },
      { name: 'Defender Command', x: 0, z: -38 }
    ]
  },

  // 3. Frostline
  {
    id: 'map_frostline',
    name: 'Frostline',
    codename: 'OUTPOST-ZERO',
    location: 'Svalbard Archipelago, Arctic',
    description: 'A glacier airbase built around an exposed cryo-bridge, ice-ridge flank routes, a fortified VTOL hangar, and radar-dome cover.',
    theme: 'arctic',
    ambientColor: 0x435b73,
    skyColor: 0x1e344a,
    fogColor: 0x324a62,
    fogDensity: 0.0011,
    sunPosition: [-32, 55, -24],
    sunColor: 0xd7e9f5,
    sunIntensity: 0.82,
    siteA: { x: 25, z: -22, radius: 7.0, label: 'SITE A - VTOL HANGAR' },
    siteB: { x: -25, z: -22, radius: 7.0, label: 'SITE B - RADAR DOMES' },
    attackerSpawn: { x: 0, z: 40, yaw: 0 },
    defenderSpawn: { x: 0, z: -40, yaw: Math.PI },
    callouts: [
      { name: 'Glacier Helipad', x: 0, z: 38 },
      { name: 'A Ice Ridge', x: 22, z: 10 },
      { name: 'Site A VTOL Hangar', x: 25, z: -22 },
      { name: 'Mid Cryo Bridge', x: 0, z: 0 },
      { name: 'Pipeline Trench', x: 0, z: -10 },
      { name: 'East Ice Shelf', x: 38, z: 2 },
      { name: 'West Ice Shelf', x: -38, z: 2 },
      { name: 'B Frost Tunnel', x: -22, z: 10 },
      { name: 'Site B Radar Domes', x: -25, z: -22 },
      { name: 'Defender Bunker', x: 0, z: -38 }
    ]
  },

  // 4. Black Harbor
  {
    id: 'map_black_harbor',
    name: 'Black Harbor',
    codename: 'DOCK-7',
    location: 'Rotterdam Offshore Terminal, Netherlands',
    description: 'A working container port with staggered cargo cover, a long sightline beneath the gantry, and separate crane and drydock approaches.',
    theme: 'harbor',
    ambientColor: 0x64788c,
    skyColor: 0x29435c,
    fogColor: 0x36526d,
    fogDensity: 0.0028,
    sunPosition: [28, 54, -24],
    sunColor: 0xe0f2fe,
    sunIntensity: 1.45,
    siteA: { x: 25, z: -23, radius: 7.0, label: 'SITE A - CRANE GANTRY' },
    siteB: { x: -25, z: -23, radius: 7.0, label: 'SITE B - DRYDOCK CARGO' },
    attackerSpawn: { x: 0, z: 40, yaw: 0 },
    defenderSpawn: { x: 0, z: -40, yaw: Math.PI },
    callouts: [
      { name: 'South Pier', x: 0, z: 38 },
      { name: 'A Container Stack', x: 20, z: 12 },
      { name: 'Site A Crane Gantry', x: 25, z: -23 },
      { name: 'Mid Container Maze', x: 0, z: 0 },
      { name: 'East Pier Lane', x: 38, z: 2 },
      { name: 'West Pier Lane', x: -38, z: 2 },
      { name: 'B Customs Deck', x: -20, z: 12 },
      { name: 'Site B Drydock', x: -25, z: -23 },
      { name: 'North Berth', x: 0, z: -38 }
    ]
  },

  // 5. Verdant
  {
    id: 'map_verdant',
    name: 'Verdant',
    codename: 'BIOME-OMEGA',
    location: 'Sinharaja Biosphere, Sri Lanka',
    description: 'An overgrown research sanctuary with a climbable ziggurat mid, broken-stone flank paths, amber bio-lab cover, and temple ruins.',
    theme: 'overgrown',
    ambientColor: 0x5c7a62,
    skyColor: 0x2b5339,
    fogColor: 0x396647,
    fogDensity: 0.0026,
    sunPosition: [22, 56, 26],
    sunColor: 0xf7fee7,
    sunIntensity: 1.45,
    siteA: { x: 25, z: -22, radius: 7.0, label: 'SITE A - BIO-LABS' },
    siteB: { x: -25, z: -22, radius: 7.0, label: 'SITE B - TEMPLE RUINS' },
    attackerSpawn: { x: 0, z: 40, yaw: 0 },
    defenderSpawn: { x: 0, z: -40, yaw: Math.PI },
    callouts: [
      { name: 'Sanctuary Gate', x: 0, z: 38 },
      { name: 'A Botanical Walk', x: 20, z: 12 },
      { name: 'Site A Bio-Labs', x: 25, z: -22 },
      { name: 'Mid Stone Ziggurat', x: 0, z: 0 },
      { name: 'East Canopy Trail', x: 38, z: 2 },
      { name: 'West Canopy Trail', x: -38, z: 2 },
      { name: 'B Canopy Trail', x: -20, z: 12 },
      { name: 'Site B Temple Ruins', x: -25, z: -22 },
      { name: 'Defender Atrium', x: 0, z: -38 }
    ]
  }
];
