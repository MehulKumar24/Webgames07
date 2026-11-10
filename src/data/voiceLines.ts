import { Agent } from '../types/game';

export type VoiceLineEvent =
  | 'plant'
  | 'defuse'
  | 'kill'
  | 'headshot_kill'
  | 'damage'
  | 'ability'
  | 'ultimate'
  | 'reload'
  | 'round_start';

export interface VoiceLinePayload {
  id: string;
  agentId: string;
  callsign: string;
  agentName: string;
  themeColor: string;
  event: VoiceLineEvent;
  text: string;
  timestamp: number;
}

export interface AgentVoiceProfile {
  pitch: number; // SpeechSynthesis pitch (0.35 - 1.75)
  rate: number; // SpeechSynthesis rate (0.78 - 1.32)
  baseFreq: number; // Formant synth fundamental frequency (Hz)
  formantFreq: number; // Primary F1 vocal tract resonance (Hz)
  secondFormantFreq: number; // Secondary F2 vocal tract resonance (Hz)
  waveType: OscillatorType;
  subWaveType: OscillatorType;
  vibratoHz: number;
  vibratoDepth: number;
  voiceIndexOffset: number; // Deterministic index offset across installed TTS voices
  lang: string;
}

export const AGENT_VOICE_PROFILES: Record<string, AgentVoiceProfile> = {
  // 1. VORTEX (Male - British Kinetic Pilot: Confident, crisp London delivery)
  agent_vortex: {
    pitch: 1.02,
    rate: 1.08,
    baseFreq: 142,
    formantFreq: 1180,
    secondFormantFreq: 2250,
    waveType: 'sawtooth',
    subWaveType: 'triangle',
    vibratoHz: 5.2,
    vibratoDepth: 3,
    voiceIndexOffset: 0,
    lang: 'en-GB'
  },
  // 2. UMBRA (Female - Norwegian Recon: Calm, measured, low feminine voice)
  agent_umbra: {
    pitch: 0.94,
    rate: 0.96,
    baseFreq: 188,
    formantFreq: 1380,
    secondFormantFreq: 2150,
    waveType: 'triangle',
    subWaveType: 'sine',
    vibratoHz: 4.0,
    vibratoDepth: 2,
    voiceIndexOffset: 1,
    lang: 'en-GB'
  },
  // 3. CRYO (Female - Canadian Scientist: Focused, clear, natural articulate delivery)
  agent_cryo: {
    pitch: 1.06,
    rate: 0.98,
    baseFreq: 210,
    formantFreq: 1680,
    secondFormantFreq: 2600,
    waveType: 'sine',
    subWaveType: 'triangle',
    vibratoHz: 5.0,
    vibratoDepth: 3,
    voiceIndexOffset: 2,
    lang: 'en-US'
  },
  // 4. BUNKER (Male - German Heavy Engineer: Deep resonant baritone, steady and calm)
  agent_bunker: {
    pitch: 0.86,
    rate: 0.94,
    baseFreq: 104,
    formantFreq: 820,
    secondFormantFreq: 1580,
    waveType: 'triangle',
    subWaveType: 'sawtooth',
    vibratoHz: 3.2,
    vibratoDepth: 2,
    voiceIndexOffset: 3,
    lang: 'en-US'
  },
  // 5. AETHER (Female - Brazilian Combat Medic: Warm, supportive natural mezzo-soprano)
  agent_aether: {
    pitch: 1.12,
    rate: 1.02,
    baseFreq: 220,
    formantFreq: 1720,
    secondFormantFreq: 2650,
    waveType: 'triangle',
    subWaveType: 'sine',
    vibratoHz: 4.8,
    vibratoDepth: 3,
    voiceIndexOffset: 4,
    lang: 'en-US'
  },
  // 6. IGNIS (Male - Mexican Pyrotechnic Daredevil: Energetic, punchy, charismatic tenor)
  agent_ignis: {
    pitch: 1.04,
    rate: 1.06,
    baseFreq: 152,
    formantFreq: 1280,
    secondFormantFreq: 2320,
    waveType: 'sawtooth',
    subWaveType: 'triangle',
    vibratoHz: 5.5,
    vibratoDepth: 3,
    voiceIndexOffset: 5,
    lang: 'en-US'
  },
  // 7. MIRAGE (Female - Singaporean Illusionist: Smooth, composed, warm articulation)
  agent_mirage: {
    pitch: 1.14,
    rate: 1.04,
    baseFreq: 228,
    formantFreq: 1780,
    secondFormantFreq: 2700,
    waveType: 'sine',
    subWaveType: 'triangle',
    vibratoHz: 5.0,
    vibratoDepth: 3,
    voiceIndexOffset: 6,
    lang: 'en-SG'
  },
  // 8. ROOK (Male - US Spec-Ops Commander: Low tactical bass-baritone, authoritative)
  agent_rook: {
    pitch: 0.88,
    rate: 0.95,
    baseFreq: 110,
    formantFreq: 880,
    secondFormantFreq: 1680,
    waveType: 'sawtooth',
    subWaveType: 'triangle',
    vibratoHz: 3.8,
    vibratoDepth: 2,
    voiceIndexOffset: 7,
    lang: 'en-US'
  },
  // 9. KAGE (Female - Japanese Cyber-Shinobi: Disciplined, sharp, clear cadence)
  agent_kage: {
    pitch: 1.08,
    rate: 1.05,
    baseFreq: 215,
    formantFreq: 1750,
    secondFormantFreq: 2650,
    waveType: 'triangle',
    subWaveType: 'sine',
    vibratoHz: 4.5,
    vibratoDepth: 2,
    voiceIndexOffset: 8,
    lang: 'en-US'
  },
  // 10. PULSE (Male - Australian Recon Hacker: Relaxed upbeat tactical specialist)
  agent_pulse: {
    pitch: 0.98,
    rate: 1.04,
    baseFreq: 138,
    formantFreq: 1120,
    secondFormantFreq: 2180,
    waveType: 'sawtooth',
    subWaveType: 'triangle',
    vibratoHz: 4.6,
    vibratoDepth: 2,
    voiceIndexOffset: 9,
    lang: 'en-AU'
  },
  // 11. FLORA (Female - Kenyan Botanist: Grounded, warm resonant natural voice)
  agent_flora: {
    pitch: 1.02,
    rate: 0.98,
    baseFreq: 195,
    formantFreq: 1540,
    secondFormantFreq: 2420,
    waveType: 'triangle',
    subWaveType: 'sine',
    vibratoHz: 4.2,
    vibratoDepth: 2,
    voiceIndexOffset: 10,
    lang: 'en-US'
  },
  // 12. TITAN (Male - Heavy Armor Juggernaut: Deep commanding chest resonance)
  agent_titan: {
    pitch: 0.82,
    rate: 0.90,
    baseFreq: 98,
    formantFreq: 750,
    secondFormantFreq: 1480,
    waveType: 'sawtooth',
    subWaveType: 'triangle',
    vibratoHz: 3.0,
    vibratoDepth: 2,
    voiceIndexOffset: 11,
    lang: 'en-US'
  }
};

export const AGENT_VOICE_LINES: Record<string, Record<VoiceLineEvent, string[]>> = {
  agent_vortex: {
    plant: [
      'Nexus Core is down. Hold the angles.',
      'Core set. Watch our flanks, team.',
      'Planted! Form up and cover the site.'
    ],
    defuse: [
      'Core defused. Sector clear.',
      'Defuse complete. Good round, squad.',
      'That is taken care of. Area secure.'
    ],
    kill: [
      'Target down.',
      'One eliminated.',
      'Hostile neutralized, keep pushing.'
    ],
    headshot_kill: [
      'Clean headshot.',
      'Dropped them cold.',
      'Visor cracked, target erased.'
    ],
    damage: [
      'Taking fire!',
      'I am hit—repositioning!',
      'Shield cracked, moving to cover!'
    ],
    ability: [
      'Dashing in!',
      'Popping kinetic cloud—move up!',
      'Shock deployed!'
    ],
    ultimate: [
      'Overdrive active—let us move!',
      'Singularity deployed, push them now!'
    ],
    reload: [
      'Cover me, reloading!',
      'Swapping mag!'
    ],
    round_start: [
      'Weapons hot, team. Check your corners.',
      'Stay together this round. Let us execute.'
    ]
  },

  agent_umbra: {
    plant: [
      'Nexus Core is planted. Watch the shadows.',
      'Core armed on site. I have eyes on the approaches.',
      'Objective set. Stay quiet and hold your angles.'
    ],
    defuse: [
      'Nexus Core defused. Sector is clear.',
      'Core disarmed. Nice work holding them off.',
      'Defuse complete. We control the area.'
    ],
    kill: [
      'Target down.',
      'Hostile eliminated. Moving to the next angle.',
      'One less enemy on the grid.'
    ],
    headshot_kill: [
      'Clean headshot.',
      'One shot, target down.',
      'They never saw that angle coming.'
    ],
    damage: [
      'Taking fire, moving to cover.',
      'I am hit, watch my line of sight.',
      'Enemy spotted me, falling back.'
    ],
    ability: [
      'Scanning the sector ahead.',
      'Recon pulse out, watch for tags.',
      'Deploying sensor.'
    ],
    ultimate: [
      'Global recon online, all enemy positions revealed.',
      'Shadows are clear, I see all of them.'
    ],
    reload: [
      'Reloading, watch the flank.',
      'Swapping magazine.'
    ],
    round_start: [
      'Stay quiet and let them make the first mistake.',
      'I will get us the intel, just be ready to trade.'
    ]
  },

  agent_cryo: {
    plant: [
      'Nexus Core planted. Locking down the entryways.',
      'Core is active. Hold your crossfires.',
      'Objective set on site. Watch the choke points.'
    ],
    defuse: [
      'Nexus Core defused. Temperature stabilized.',
      'Core disarmed. Good defense, everyone.',
      'Defusal complete, the site is safe.'
    ],
    kill: [
      'Enemy neutralized.',
      'Target down, keep holding.',
      'One eliminated in my lane.'
    ],
    headshot_kill: [
      'Clean headshot, target dropped.',
      'Right on the mark.',
      'Precision shot, hostile down.'
    ],
    damage: [
      'Taking fire here, need backup.',
      'I am hit, blocking off the lane.',
      'Under fire at this choke point.'
    ],
    ability: [
      'Slowing down their push.',
      'Ice barrier going up.',
      'Freezing the corridor.'
    ],
    ultimate: [
      'Blizzard deployed, lock down the entire site.',
      'Freezing the zone, push in while they are slowed.'
    ],
    reload: [
      'Reloading now, hold the line.',
      'Fresh magazine in.'
    ],
    round_start: [
      'Let us slow their push and take clean fights.',
      'Cryo units ready. Play smart and hold your ground.'
    ]
  },

  agent_bunker: {
    plant: [
      'Nexus Core planted. Dig in and hold the perimeter.',
      'Core is down. Set up the crossfire.',
      'Objective armed. Nobody gets through us.'
    ],
    defuse: [
      'Nexus Core defused. Solid work, team.',
      'Core disarmed. Our defense held strong.',
      'Threat neutralized, sector is secure.'
    ],
    kill: [
      'Hostile down. Hold your ground.',
      'Target eliminated in my sector.',
      'Enemy dropped, lane is clear.'
    ],
    headshot_kill: [
      'Clean headshot, target is down.',
      'Direct hit, hostile eliminated.',
      'One shot, right on target.'
    ],
    damage: [
      'Taking hits here, returning fire.',
      'Heavy fire on my position.',
      'Armor took a hit, watch this angle.'
    ],
    ability: [
      'Fortifying this lane.',
      'Deploying cover, get behind me.',
      'Locking down the sector.'
    ],
    ultimate: [
      'Fortress shield online, rally on my position.',
      'Dome shield deployed, hold the site.'
    ],
    reload: [
      'Reloading, keep the lane covered.',
      'Swapping mag, cover me.'
    ],
    round_start: [
      'Check your armor. Hold your lanes and trade together.',
      'Stay disciplined. Make them work for every meter.'
    ]
  },

  agent_aether: {
    plant: [
      'Nexus Core is planted. Stay close so I can heal you.',
      'Core armed on site. Hold positions, everyone.',
      'Objective set, let us defend it together.'
    ],
    defuse: [
      'Nexus Core defused. We got it in time.',
      'Core disarmed, great job covering me.',
      'Defuse complete. Everyone regroup.'
    ],
    kill: [
      'Enemy down, area is clear.',
      'Target neutralized, keeping the team safe.',
      'Hostile eliminated.'
    ],
    headshot_kill: [
      'Clean headshot.',
      'Target dropped instantly.',
      'Steady hands, hostile down.'
    ],
    damage: [
      'Taking fire, need cover right now.',
      'I am hit, falling back behind cover.',
      'Enemy on my angle, taking damage.'
    ],
    ability: [
      'Sending out healing support.',
      'Healing pulse deployed, stay close.',
      'Patching up the squad.'
    ],
    ultimate: [
      'Nanite surge active, full team support online.',
      'Restoring squad vitals, stay in the fight.'
    ],
    reload: [
      'Reloading, watch my angle.',
      'Swapping magazine, cover me.'
    ],
    round_start: [
      'Medical reserves are full. Stay close if you take damage.',
      'I have your backs. Play together and we win this.'
    ]
  },

  agent_ignis: {
    plant: [
      'Nexus Core planted. Clearing out the corners.',
      'Core is armed and ticking. Watch the entryways.',
      'Objective set. Keep them off the site.'
    ],
    defuse: [
      'Nexus Core defused. That was close.',
      'Core disarmed. Good cover fire, team.',
      'Defuse complete, round is ours.'
    ],
    kill: [
      'Enemy down, keep up the pressure.',
      'Target eliminated.',
      'Dropped one, pushing forward.'
    ],
    headshot_kill: [
      'Clean headshot, dropped them.',
      'Right on target, one down.',
      'Quick tap, hostile eliminated.'
    ],
    damage: [
      'Took a hit, repositioning.',
      'Under fire here, watch that corner.',
      'Taking damage, throwing utility.'
    ],
    ability: [
      'Throwing fire, clear the corner.',
      'Flushing them out of cover.',
      'Incendiary out.'
    ],
    ultimate: [
      'Thermal beam ready, clearing the whole lane.',
      'Pushing in with full firepower, follow me.'
    ],
    reload: [
      'Reloading, keep the pressure on.',
      'Fresh mag going in.'
    ],
    round_start: [
      'I will clear the tight corners, just follow my entry.',
      'Utility is ready. Let us hit the site fast.'
    ]
  },

  agent_mirage: {
    plant: [
      'Nexus Core planted. Watching the crossfire.',
      'Core is armed. Stay sharp, they will push soon.',
      'Objective set on site.'
    ],
    defuse: [
      'Nexus Core defused. Clean round, everyone.',
      'Core disarmed, site is secure.',
      'Defuse complete.'
    ],
    kill: [
      'Hostile eliminated.',
      'Target down, caught them off guard.',
      'One down in my sector.'
    ],
    headshot_kill: [
      'Clean headshot, target down.',
      'One tap, enemy eliminated.',
      'Precision shot.'
    ],
    damage: [
      'Taking fire, shifting position.',
      'I am hit, blocking their sightline.',
      'Enemy firing on me, falling back.'
    ],
    ability: [
      'Sending out a decoy.',
      'Blinding their angle, push now.',
      'Deploying holo cover.'
    ],
    ultimate: [
      'Mirage field active, scrambling their vision.',
      'Optical cloaking online, making my move.'
    ],
    reload: [
      'Reloading, watch the lane.',
      'Fresh magazine in.'
    ],
    round_start: [
      'I will bait their shots first, then we swing together.',
      'Optics calibrated. Let us take control of mid.'
    ]
  },

  agent_rook: {
    plant: [
      'Nexus Core planted. Set up overlapping crossfires.',
      'Core armed on site. Check your corners.',
      'Objective set. Hold your lanes.'
    ],
    defuse: [
      'Nexus Core defused. Good execution, squad.',
      'Core disarmed. Area is secure.',
      'Objective neutralized. Well played.'
    ],
    kill: [
      'Tango down, sector clear.',
      'Hostile neutralized.',
      'Target dropped, holding the angle.'
    ],
    headshot_kill: [
      'Clean headshot, target neutralized.',
      'One round, one elimination.',
      'Direct hit, enemy down.'
    ],
    damage: [
      'Taking enemy fire, returning shots.',
      'Hit in the armor, watch that lane.',
      'Contact front, taking damage.'
    ],
    ability: [
      'Throwing flash, look away.',
      'Locking down the choke point.',
      'Utility out, clear the room.'
    ],
    ultimate: [
      'Tactical strike inbound, clear the target zone.',
      'Suppressing enemy positions, move in now.'
    ],
    reload: [
      'Reloading weapon, cover my lane.',
      'Swapping mag, hold the angle.'
    ],
    round_start: [
      'Check your corners, call your targets, and stick together.',
      'Weapons hot. Let us run a clean execute.'
    ]
  },

  agent_kage: {
    plant: [
      'Nexus Core planted. Taking an off-angle.',
      'Core is armed. Watch the flank.',
      'Objective set. Stay hidden until they tap it.'
    ],
    defuse: [
      'Nexus Core defused. Sector secure.',
      'Core disarmed quietly.',
      'Defusal complete.'
    ],
    kill: [
      'Target silenced.',
      'Hostile down, moving to a new spot.',
      'Enemy eliminated.'
    ],
    headshot_kill: [
      'Clean headshot, instant drop.',
      'Right on the mark.',
      'One shot, target down.'
    ],
    damage: [
      'Taking fire, dropping smoke.',
      'Spotted, repositioning now.',
      'I am hit, falling back.'
    ],
    ability: [
      'Dropping smoke cover.',
      'Shadow step active.',
      'Cutting off their vision.'
    ],
    ultimate: [
      'Blades drawn, flanking their backline.',
      'Stealth active, hunting them down.'
    ],
    reload: [
      'Reloading, watch the choke.',
      'Chambering fresh rounds.'
    ],
    round_start: [
      'I will lurk and watch the flank. Call if you need help.',
      'Stay calm and make every shot count.'
    ]
  },

  agent_pulse: {
    plant: [
      'Nexus Core planted. Radar is watching the site.',
      'Core is armed. Hold your angles.',
      'Objective set, pinging entry lanes.'
    ],
    defuse: [
      'Nexus Core defused. Circuit bypassed.',
      'Core disarmed, nice cover team.',
      'Defusal complete, we got it.'
    ],
    kill: [
      'Enemy down, one less on radar.',
      'Target eliminated.',
      'Hostile dropped in my lane.'
    ],
    headshot_kill: [
      'Clean headshot.',
      'Direct hit, target down.',
      'Dropped them instantly.'
    ],
    damage: [
      'Taking fire, shields are low.',
      'I am hit, enemy on my ping.',
      'Under heavy fire, backing up.'
    ],
    ability: [
      'Pinging the sector for hostiles.',
      'Throwing EMP grenade.',
      'Sweeping the radar.'
    ],
    ultimate: [
      'EMP wave out, enemy utility is disabled.',
      'Jamming their systems, push the site now.'
    ],
    reload: [
      'Reloading, watch the radar.',
      'Swapping mag, cover me.'
    ],
    round_start: [
      'Wait for my recon scan before you swing the corner.',
      'Sensors online. Let us find out where they are playing.'
    ]
  },

  agent_flora: {
    plant: [
      'Nexus Core planted. Holding the site.',
      'Core is armed. Watch the main choke.',
      'Objective set, stay together squad.'
    ],
    defuse: [
      'Nexus Core defused. Site is safe.',
      'Core disarmed. Good teamwork.',
      'Defuse complete, round won.'
    ],
    kill: [
      'Hostile eliminated.',
      'Target down, lane is clear.',
      'Enemy neutralized.'
    ],
    headshot_kill: [
      'Clean headshot, target down.',
      'Precision shot, enemy dropped.',
      'One tap, hostile eliminated.'
    ],
    damage: [
      'Taking fire, need cover.',
      'I am hit, backing off the angle.',
      'Enemy firing on my position.'
    ],
    ability: [
      'Throwing spore cloud.',
      'Slowing the entryway.',
      'Deploying bio-shield.'
    ],
    ultimate: [
      'Regeneration field active, hold the site inside the zone.',
      'Bio-field deployed, pushing with the team.'
    ],
    reload: [
      'Reloading weapon, hold the line.',
      'Fresh magazine ready.'
    ],
    round_start: [
      'Play off my utility and do not peek alone.',
      'Ready to support. Let us lock down this half.'
    ]
  },

  agent_titan: {
    plant: [
      'Nexus Core planted. Holding the front line.',
      'Core is down. Get behind my cover.',
      'Objective set on site.'
    ],
    defuse: [
      'Nexus Core defused. Good hold, team.',
      'Core disarmed. Area is secure.',
      'Defusal complete.'
    ],
    kill: [
      'Hostile down, lane is clear.',
      'Target eliminated.',
      'Enemy dropped, pushing up.'
    ],
    headshot_kill: [
      'Clean headshot, target dropped.',
      'Heavy hit, hostile down.',
      'Direct headshot.'
    ],
    damage: [
      'Armor taking hits, need crossfire.',
      'Under heavy fire at the front.',
      'Taking damage, holding the choke.'
    ],
    ability: [
      'Sending shockwave down the lane.',
      'Raising cover wall.',
      'Concussing the corner.'
    ],
    ultimate: [
      'Seismic slam out, stunning the entire site.',
      'Breaching the front line, follow me in.'
    ],
    reload: [
      'Reloading heavy mag, cover the front.',
      'Chambering fresh rounds.'
    ],
    round_start: [
      'Stay behind my shield when we entry the site.',
      'Armor is locked in. Let us take space early.'
    ]
  }
};

export function pickRandomVoiceLine(agent: Agent, event: VoiceLineEvent): string {
  const agentLines = AGENT_VOICE_LINES[agent.id] || AGENT_VOICE_LINES['agent_vortex'];
  const pool = agentLines[event] || agentLines['kill'];
  return pool[Math.floor(Math.random() * pool.length)];
}
