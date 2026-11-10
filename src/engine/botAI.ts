import * as THREE from 'three';
import { MatchPlayer, BotDifficulty, MapData, AgentRole } from '../types/game';
import { MapCollider } from './mapBuilder';
import { WEAPONS } from '../data/weapons';
import { AGENTS } from '../data/agents';

/**
 * High-Level Tactical States for the Bot Finite State Machine (FSM)
 */
export type BotFSMState =
  | 'PATROL_ADVANCE'
  | 'FLANK_ROUTE'
  | 'DEFENSIVE_CAMP'
  | 'COORDINATED_EXECUTE'
  | 'COMBAT_ENGAGE'
  | 'TACTICAL_RETREAT'
  | 'PLANT_OBJECTIVE'
  | 'POST_PLANT_HOLD'
  | 'RETAKE_AND_DEFUSE';

export type TacticalGameState =
  | 'EARLY_SETUP'
  | 'MID_CONTEST'
  | 'SITE_EXECUTE'
  | 'POST_PLANT'
  | 'SITE_RETAKE';

export interface TeamUtilityRequest {
  id: string;
  requesterId: string;
  kind: 'smoke' | 'recon' | 'flash' | 'heal' | 'trap';
  targetPos: THREE.Vector3;
  expiresAt: number;
}

export interface TeamIntel {
  enemyLastKnownPos: Map<string, { pos: THREE.Vector3; time: number }>;
  activeSpikeSite: 'A' | 'B' | null;
  chosenAttackSite: 'A' | 'B';
  spikeCarrierId: string | null;
  tacticalState: TacticalGameState;
  designatedDefuserId: string | null;
  lastRotationTime: number;
  executeTimestamp: number;
  utilityQueue: TeamUtilityRequest[];
}

export const AlphaIntel: TeamIntel = {
  enemyLastKnownPos: new Map(),
  activeSpikeSite: null,
  chosenAttackSite: 'A',
  spikeCarrierId: null,
  tacticalState: 'EARLY_SETUP',
  designatedDefuserId: null,
  lastRotationTime: 0,
  executeTimestamp: 0,
  utilityQueue: []
};

export const OmegaIntel: TeamIntel = {
  enemyLastKnownPos: new Map(),
  activeSpikeSite: null,
  chosenAttackSite: 'A',
  spikeCarrierId: null,
  tacticalState: 'EARLY_SETUP',
  designatedDefuserId: null,
  lastRotationTime: 0,
  executeTimestamp: 0,
  utilityQueue: []
};

export function reportGunshot(
  shooterTeam: 'alpha' | 'omega',
  shooterId: string,
  position: THREE.Vector3,
  now: number = Date.now()
) {
  const intel = shooterTeam === 'alpha' ? OmegaIntel : AlphaIntel;
  intel.enemyLastKnownPos.set(shooterId, { pos: position.clone(), time: now });
}

export interface BotState {
  player: MatchPlayer;
  model: {
    group: THREE.Group;
    head: THREE.Mesh;
    torso: THREE.Mesh;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    leftLeg: THREE.Group;
    rightLeg: THREE.Group;
    healthBarFill?: THREE.Mesh;
  };
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  pitch: number;
  targetYaw: number;
  targetPitch: number;
  mode: 'patrol' | 'engage' | 'pursue' | 'plant' | 'defuse' | 'cover' | 'retake' | 'post_plant';
  fsmState: BotFSMState;
  fsmStateTimer: number;
  tacticalAssignment: 'site_a' | 'site_b' | 'mid' | 'flank';
  anchorSpot: THREE.Vector3 | null;
  anchorLookYaw: number;
  campHoldTimer: number;
  retreatCoverPos: THREE.Vector3 | null;
  targetEnemy: MatchPlayer | null;
  reactionTimer: number;
  shootCooldown: number;
  burstRemaining: number;
  pathWaypoints: THREE.Vector3[];
  currentWaypointIdx: number;
  strafeDir: number;
  strafeTimer: number;
  isCrouchingInFight: boolean;
  isPlantingCore: boolean;
  plantTimer: number;
  isDefusingCore: boolean;
  defuseTimer: number;
  abilityCooldown: number;
  walkCycle: number;
  hasLineOfSight: boolean;
  lastSeenTargetPos: THREE.Vector3 | null;
  lastSeenTimestamp: number;
  stuckTimer: number;
  lastPosition: THREE.Vector3;
  flankSign: number;
  slowTimer?: number;
}

export function createBotState(
  player: MatchPlayer,
  model: BotState['model'],
  initialPos: THREE.Vector3,
  initialYaw: number
): BotState {
  const agent = AGENTS.find(a => a.id === player.agentId);
  const charCode = player.id.charCodeAt(player.id.length - 1) || 0;

  // Assign initial tactical lane based on agent role and squad index
  let tacticalAssignment: BotState['tacticalAssignment'] = 'site_a';
  if (agent?.role === 'Assault' || (agent?.role === 'Recon' && charCode % 2 === 0)) {
    tacticalAssignment = 'flank';
  } else if (charCode % 3 === 0) {
    tacticalAssignment = 'site_a';
  } else if (charCode % 3 === 1) {
    tacticalAssignment = 'site_b';
  } else {
    tacticalAssignment = 'mid';
  }

  return {
    player,
    model,
    position: initialPos.clone(),
    velocity: new THREE.Vector3(),
    yaw: initialYaw,
    pitch: 0,
    targetYaw: initialYaw,
    targetPitch: 0,
    mode: 'patrol',
    fsmState: 'PATROL_ADVANCE',
    fsmStateTimer: 0,
    tacticalAssignment,
    anchorSpot: null,
    anchorLookYaw: initialYaw,
    campHoldTimer: 0,
    retreatCoverPos: null,
    targetEnemy: null,
    reactionTimer: 0,
    shootCooldown: 0.15 + Math.random() * 0.25,
    burstRemaining: 0,
    pathWaypoints: [],
    currentWaypointIdx: 0,
    strafeDir: Math.random() > 0.5 ? 1 : -1,
    strafeTimer: 0,
    isCrouchingInFight: false,
    isPlantingCore: false,
    plantTimer: 0,
    isDefusingCore: false,
    defuseTimer: 0,
    abilityCooldown: 2.5 + Math.random() * 3.5,
    walkCycle: 0,
    hasLineOfSight: false,
    lastSeenTargetPos: null,
    lastSeenTimestamp: 0,
    stuckTimer: 0,
    lastPosition: initialPos.clone(),
    flankSign: Math.random() > 0.5 ? 1 : -1,
    slowTimer: 0
  };
}

/**
 * Shortest-angle interpolation so bots never spin 350 degrees the wrong way
 */
function lerpAngle(current: number, target: number, t: number): number {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * Math.min(1, t);
}

/**
 * Builds multi-lane tactical waypoint graphs for Attackers and Defenders,
 * including wide FLANK_ROUTE paths and site execute lanes.
 */
export function generateTacticalWaypoints(
  sideOrTeam: 'alpha' | 'omega' | 'attackers' | 'defenders',
  role: 'site_a' | 'site_b' | 'mid' | 'flank',
  mapData: MapData,
  flankSign: number = 1
): THREE.Vector3[] {
  const waypoints: THREE.Vector3[] = [];
  const ax = mapData.siteA.x;
  const az = mapData.siteA.z;
  const bx = mapData.siteB.x;
  const bz = mapData.siteB.z;

  const isAttackerSide = sideOrTeam === 'attackers' || sideOrTeam === 'alpha';
  if (isAttackerSide) {
    if (role === 'site_a') {
      waypoints.push(new THREE.Vector3(14, 0, 28));
      waypoints.push(new THREE.Vector3(ax - 2, 0, 12));
      waypoints.push(new THREE.Vector3(ax, 0, -5));
      waypoints.push(new THREE.Vector3(ax, 0, az));
    } else if (role === 'site_b') {
      waypoints.push(new THREE.Vector3(-14, 0, 28));
      waypoints.push(new THREE.Vector3(bx + 2, 0, 12));
      waypoints.push(new THREE.Vector3(bx, 0, -5));
      waypoints.push(new THREE.Vector3(bx, 0, bz));
    } else if (role === 'flank') {
      // Use the outer service lane and re-enter behind the selected site approach.
      const targetSite = flankSign > 0 ? mapData.siteA : mapData.siteB;
      waypoints.push(new THREE.Vector3(flankSign * 34, 0, 24));
      waypoints.push(new THREE.Vector3(flankSign * 34, 0, 8));
      waypoints.push(new THREE.Vector3(flankSign * 34, 0, -8));
      waypoints.push(new THREE.Vector3(targetSite.x + flankSign * 5, 0, targetSite.z + 5));
      waypoints.push(new THREE.Vector3(targetSite.x, 0, targetSite.z));
    } else {
      // Mid lane push & split to sites
      waypoints.push(new THREE.Vector3(0, 0, 24));
      waypoints.push(new THREE.Vector3(0, 0, 8));
      waypoints.push(new THREE.Vector3(0, 0, -8));
      waypoints.push(new THREE.Vector3(ax - 5, 0, az + 3));
      waypoints.push(new THREE.Vector3(bx + 5, 0, bz + 3));
    }
  } else {
    if (role === 'site_a') {
      waypoints.push(new THREE.Vector3(14, 0, -28));
      waypoints.push(new THREE.Vector3(ax - 2, 0, az + 2));
      waypoints.push(new THREE.Vector3(ax - 3, 0, -4));
      waypoints.push(new THREE.Vector3(ax + 2, 0, az - 2));
    } else if (role === 'site_b') {
      waypoints.push(new THREE.Vector3(-14, 0, -28));
      waypoints.push(new THREE.Vector3(bx + 2, 0, bz + 2));
      waypoints.push(new THREE.Vector3(bx + 3, 0, -4));
      waypoints.push(new THREE.Vector3(bx - 2, 0, bz - 2));
    } else if (role === 'flank') {
      // Rotate through the opposite perimeter lane before joining the central retake.
      const sideX = flankSign > 0 ? ax - 4 : bx + 4;
      waypoints.push(new THREE.Vector3(flankSign * 34, 0, -26));
      waypoints.push(new THREE.Vector3(flankSign * 34, 0, -8));
      waypoints.push(new THREE.Vector3(flankSign * 34, 0, 10));
      waypoints.push(new THREE.Vector3(sideX, 0, 18));
      waypoints.push(new THREE.Vector3(0, 0, 24));
    } else {
      waypoints.push(new THREE.Vector3(0, 0, -24));
      waypoints.push(new THREE.Vector3(-4, 0, -10));
      waypoints.push(new THREE.Vector3(4, 0, 2));
      waypoints.push(new THREE.Vector3(0, 0, 12));
    }
  }

  return waypoints;
}

/**
 * Selects a tactical defensive camping / anchor position near the assigned bomb site,
 * prioritizing cover positions with a clear sightline toward the attacker entry chokepoint.
 */
function computeDefensiveAnchorSpot(
  bot: BotState,
  site: { x: number; z: number; radius: number },
  colliders: MapCollider[]
): { pos: THREE.Vector3; lookYaw: number } {
  const slotIdx = (bot.player.id.charCodeAt(bot.player.id.length - 1) || 0) % 4;
  // Offsets around the back and sides of the bomb site facing South (+Z) toward attacker approach
  const anchorOffsets = [
    new THREE.Vector3(-4.2, 0, -3.8),
    new THREE.Vector3(4.2, 0, -3.5),
    new THREE.Vector3(-5.5, 0, 2.2),
    new THREE.Vector3(5.2, 0, 2.5)
  ];
  const offset = anchorOffsets[slotIdx];
  const candidate = new THREE.Vector3(site.x + offset.x, 0, site.z + offset.z);

  // Snap near a low cover crate if one exists within 5.5m of the site anchor
  let bestCoverPos = candidate;
  let bestDist = 5.5;
  for (const c of colliders) {
    if (!c.isCover || c.isExplosiveBarrel) continue;
    const cx = (c.box.min.x + c.box.max.x) * 0.5;
    const cz = c.box.min.z - 0.85; // Stand just behind the north/defender side of cover
    const d = Math.hypot(cx - site.x, cz - site.z);
    if (d < site.radius + 4 && Math.hypot(cx - candidate.x, cz - candidate.z) < bestDist) {
      bestDist = Math.hypot(cx - candidate.x, cz - candidate.z);
      bestCoverPos = new THREE.Vector3(cx, 0, cz);
    }
  }

  // Face toward the main attacker entry lane (+Z South / Mid)
  const chokepointTarget = new THREE.Vector3(site.x * 0.85, 0, site.z + 16);
  const lookDir = chokepointTarget.sub(bestCoverPos).normalize();
  const lookYaw = Math.atan2(lookDir.x, lookDir.z);

  return { pos: bestCoverPos, lookYaw };
}

/**
 * Finds the nearest hard cover position that shields the bot from a known threat position
 */
function findNearestRetreatCover(
  botPos: THREE.Vector3,
  threatPos: THREE.Vector3,
  colliders: MapCollider[]
): THREE.Vector3 {
  const awayFromThreat = new THREE.Vector3().subVectors(botPos, threatPos).setY(0);
  if (awayFromThreat.lengthSq() < 0.01) awayFromThreat.set(0, 0, 1);
  awayFromThreat.normalize();

  let bestSpot = botPos.clone().addScaledVector(awayFromThreat, 7.5);
  let bestScore = Infinity;

  for (const c of colliders) {
    if ((!c.isCover && !c.isWall) || c.isExplosiveBarrel) continue;
    const center = new THREE.Vector3(
      (c.box.min.x + c.box.max.x) * 0.5,
      0,
      (c.box.min.z + c.box.max.z) * 0.5
    );
    const distToBot = botPos.distanceTo(center);
    if (distToBot > 16 || distToBot < 1.2) continue;

    // Position on the side of the collider opposite the enemy threat
    const coverToThreat = new THREE.Vector3().subVectors(threatPos, center).setY(0).normalize();
    const safePos = center.clone().addScaledVector(coverToThreat, -2.1);

    if (distToBot < bestScore) {
      bestScore = distToBot;
      bestSpot = safePos;
    }
  }

  bestSpot.x = THREE.MathUtils.clamp(bestSpot.x, -48, 48);
  bestSpot.z = THREE.MathUtils.clamp(bestSpot.z, -48, 48);
  return bestSpot;
}

/**
 * Updates the Squad Tactical Blackboard (TeamIntel) based on global game state
 * and active enemy sightings.
 */
function updateTeamTacticalBlackboard(
  intel: TeamIntel,
  team: 'alpha' | 'omega',
  side: 'attackers' | 'defenders',
  allBots: BotState[],
  mapData: MapData,
  isSpikePlanted: boolean,
  spikePos: THREE.Vector3 | null,
  now: number
) {
  // Prune expired utility requests
  intel.utilityQueue = intel.utilityQueue.filter(req => req.expiresAt > now);

  if (isSpikePlanted && spikePos) {
    const distA = Math.hypot(spikePos.x - mapData.siteA.x, spikePos.z - mapData.siteA.z);
    const distB = Math.hypot(spikePos.x - mapData.siteB.x, spikePos.z - mapData.siteB.z);
    intel.activeSpikeSite = distA <= distB ? 'A' : 'B';
    intel.tacticalState = side === 'attackers' ? 'POST_PLANT' : 'SITE_RETAKE';

    // Ensure a living defender is assigned as the primary defuser while others guard
    if (side === 'defenders') {
      const currentDefuser = allBots.find(
        b => b.player.id === intel.designatedDefuserId && b.player.isAlive
      );
      if (!currentDefuser) {
        let closestDef: BotState | null = null;
        let minD = Infinity;
        for (const b of allBots) {
          if (b.player.team === team && b.player.isAlive) {
            const d = b.position.distanceTo(spikePos);
            if (d < minD) {
              minD = d;
              closestDef = b;
            }
          }
        }
        intel.designatedDefuserId = closestDef ? closestDef.player.id : null;
      }
    }
    return;
  }

  intel.activeSpikeSite = null;
  intel.designatedDefuserId = null;

  // Count recent enemy sightings near Site A vs Site B
  let enemiesNearA = 0;
  let enemiesNearB = 0;
  intel.enemyLastKnownPos.forEach(sighting => {
    if (now - sighting.time < 8000) {
      const dA = Math.hypot(sighting.pos.x - mapData.siteA.x, sighting.pos.z - mapData.siteA.z);
      const dB = Math.hypot(sighting.pos.x - mapData.siteB.x, sighting.pos.z - mapData.siteB.z);
      if (dA < 22) enemiesNearA++;
      if (dB < 22) enemiesNearB++;
    }
  });

  if (side === 'attackers') {
    // Dynamic Attacker Rotation: if 3+ defenders are stacked on chosen site, rotate to the other site!
    if (now - intel.lastRotationTime > 14000) {
      if (intel.chosenAttackSite === 'A' && enemiesNearA >= 3 && enemiesNearB <= 1) {
        intel.chosenAttackSite = 'B';
        intel.lastRotationTime = now;
      } else if (intel.chosenAttackSite === 'B' && enemiesNearB >= 3 && enemiesNearA <= 1) {
        intel.chosenAttackSite = 'A';
        intel.lastRotationTime = now;
      }
    }

    // Check if attackers are staged near target site to trigger COORDINATED_EXECUTE
    const targetSite = intel.chosenAttackSite === 'A' ? mapData.siteA : mapData.siteB;
    const attackersNearSite = allBots.filter(
      b =>
        b.player.team === team &&
        b.player.isAlive &&
        Math.hypot(b.position.x - targetSite.x, b.position.z - targetSite.z) < 26
    );
    if (attackersNearSite.length >= 2) {
      intel.tacticalState = 'SITE_EXECUTE';
      if (now - intel.executeTimestamp > 12000) {
        intel.executeTimestamp = now;
        const siteCenter = new THREE.Vector3(targetSite.x, 0, targetSite.z);
        enqueueTeamUtility(intel, 'system', 'recon', siteCenter, now);
        enqueueTeamUtility(
          intel,
          'system',
          'smoke',
          new THREE.Vector3(targetSite.x, 0, targetSite.z - 4),
          now
        );
      }
    } else {
      intel.tacticalState = 'MID_CONTEST';
    }
  } else {
    // Defenders: if multiple enemies spotted pushing a site, call site convergence
    if (enemiesNearA >= 2 || enemiesNearB >= 2) {
      intel.chosenAttackSite = enemiesNearA >= enemiesNearB ? 'A' : 'B';
      intel.tacticalState = 'SITE_EXECUTE';
    } else {
      intel.tacticalState = 'EARLY_SETUP';
    }
  }
}

function enqueueTeamUtility(
  intel: TeamIntel,
  requesterId: string,
  kind: TeamUtilityRequest['kind'],
  targetPos: THREE.Vector3,
  now: number
) {
  const alreadyQueued = intel.utilityQueue.some(
    u => u.kind === kind && u.targetPos.distanceTo(targetPos) < 10
  );
  if (!alreadyQueued && intel.utilityQueue.length < 6) {
    intel.utilityQueue.push({
      id: `${kind}_${now}_${Math.random()}`,
      requesterId,
      kind,
      targetPos: targetPos.clone(),
      expiresAt: now + 6000
    });
  }
}

/**
 * Selects the optimal ability ID and target coordinate for a bot based on its Agent Role,
 * current FSM state, and any pending Squad Utility Requests on the Team Blackboard.
 */
function evaluateCoordinatedAbilityCast(
  bot: BotState,
  role: AgentRole,
  agentId: string,
  ability1Id: string,
  ability2Id: string,
  ability3Id: string,
  ultimateId: string,
  intel: TeamIntel,
  mapData: MapData,
  allBots: BotState[],
  allPlayers: MatchPlayer[],
  playerFootPos: THREE.Vector3,
  now: number
): { abilityId: string; targetPos: THREE.Vector3 } | null {
  if (bot.abilityCooldown > 0) return null;

  // 1. SUPPORT OPERATIVES (Aether, Flora): Prioritize reviving fallen allies & healing/shielding Player or Teammates
  if (role === 'Support' || agentId === 'agent_aether' || agentId === 'agent_flora') {
    // Check if an allied bot on the same team has fallen -> Aether casts Nanite Resurgence (Ultimate) to revive!
    if (agentId === 'agent_aether') {
      const fallenAlly = allBots.find(
        ally => ally.player.team === bot.player.team && !ally.player.isAlive
      );
      if (fallenAlly && bot.position.distanceTo(fallenAlly.position) < 22) {
        bot.player.ultPoints = 0;
        return { abilityId: ultimateId, targetPos: fallenAlly.position.clone() };
      }
    }

    // If on Alpha team, check if the human Player needs healing or shields!
    if (bot.player.team === 'alpha') {
      const humanPlayer = allPlayers.find(p => p.id === 'player' && p.isAlive);
      if (humanPlayer && bot.position.distanceTo(playerFootPos) < 16) {
        if (humanPlayer.health < 80) {
          return {
            abilityId: agentId === 'agent_flora' ? ability2Id : ability1Id,
            targetPos: playerFootPos.clone()
          };
        }
        if (humanPlayer.armor < 30) {
          return {
            abilityId: ability3Id,
            targetPos: playerFootPos.clone()
          };
        }
      }
    }

    // Self-heal if wounded
    if (bot.player.health < 75) {
      return {
        abilityId: agentId === 'agent_flora' ? ability2Id : ability1Id,
        targetPos: bot.position.clone()
      };
    }

    // Heal or shield any wounded teammate bot within 18m
    const woundedAlly = allBots.find(
      ally =>
        ally.player.team === bot.player.team &&
        ally.player.isAlive &&
        (ally.player.health < 75 || ally.player.armor < 25) &&
        ally.position.distanceTo(bot.position) < 18
    );
    if (woundedAlly) {
      const healOrShieldId =
        woundedAlly.player.health < 75
          ? agentId === 'agent_flora'
            ? ability2Id
            : ability1Id
          : ability3Id;
      return { abilityId: healOrShieldId, targetPos: woundedAlly.position.clone() };
    }
  }

  // 2. Check Squad Blackboard Utility Queue for coordinated team assistance requests
  for (let i = 0; i < intel.utilityQueue.length; i++) {
    const req = intel.utilityQueue[i];
    if (req.targetPos.distanceTo(bot.position) > 36) continue;

    if (req.kind === 'heal' && role === 'Support') {
      intel.utilityQueue.splice(i, 1);
      return {
        abilityId: agentId === 'agent_flora' ? ability2Id : ability1Id,
        targetPos: req.targetPos
      };
    }
    if (req.kind === 'recon' && role === 'Recon') {
      intel.utilityQueue.splice(i, 1);
      return {
        abilityId: Math.random() < 0.5 ? ability1Id : ability2Id,
        targetPos: req.targetPos
      };
    }
    if (req.kind === 'smoke' && role === 'Control') {
      intel.utilityQueue.splice(i, 1);
      const smokeId =
        agentId === 'agent_cryo'
          ? ability3Id
          : agentId === 'agent_mirage'
          ? ability2Id
          : ability3Id;
      return { abilityId: smokeId, targetPos: req.targetPos };
    }
    if (req.kind === 'flash' && role === 'Assault') {
      intel.utilityQueue.splice(i, 1);
      const flashOrPokeId =
        agentId === 'agent_vortex'
          ? ability2Id
          : agentId === 'agent_ignis'
          ? ability3Id
          : ability1Id;
      return { abilityId: flashOrPokeId, targetPos: req.targetPos };
    }
    if (req.kind === 'trap' && role === 'Sentinel') {
      intel.utilityQueue.splice(i, 1);
      return {
        abilityId: Math.random() < 0.5 ? ability2Id : ability3Id,
        targetPos: req.targetPos
      };
    }
  }

  // 3. State-driven proactive ability usage (Site Setup, Recon Sweeps, Execute & Retake)
  const targetSite = intel.chosenAttackSite === 'A' ? mapData.siteA : mapData.siteB;
  const sitePos = new THREE.Vector3(targetSite.x, 0, targetSite.z);
  const forwardPos = new THREE.Vector3(
    bot.position.x + Math.sin(bot.yaw) * 9,
    0,
    bot.position.z + Math.cos(bot.yaw) * 9
  );

  if (bot.fsmState === 'DEFENSIVE_CAMP' || bot.fsmState === 'POST_PLANT_HOLD') {
    const chokePos = new THREE.Vector3(
      bot.position.x + Math.sin(bot.anchorLookYaw) * 6.5,
      0,
      bot.position.z + Math.cos(bot.anchorLookYaw) * 6.5
    );
    if (role === 'Sentinel') {
      // Deploy turret, barricade, or gravity trap
      const sentinelChoices = [ability1Id, ability2Id, ability3Id];
      return {
        abilityId: sentinelChoices[Math.floor(Math.random() * sentinelChoices.length)],
        targetPos: chokePos
      };
    }
    if (role === 'Control') {
      return {
        abilityId: Math.random() < 0.5 ? ability1Id : ability2Id,
        targetPos: chokePos
      };
    }
    if (role === 'Recon') {
      return { abilityId: ability1Id, targetPos: chokePos };
    }
  }

  if (
    bot.fsmState === 'COORDINATED_EXECUTE' ||
    bot.fsmState === 'RETAKE_AND_DEFUSE' ||
    bot.fsmState === 'PLANT_OBJECTIVE'
  ) {
    const objectivePos =
      bot.fsmState === 'RETAKE_AND_DEFUSE' && intel.activeSpikeSite
        ? new THREE.Vector3(
            intel.activeSpikeSite === 'A' ? mapData.siteA.x : mapData.siteB.x,
            0,
            intel.activeSpikeSite === 'A' ? mapData.siteA.z : mapData.siteB.z
          )
        : sitePos;

    if (bot.position.distanceTo(objectivePos) < 30) {
      if (role === 'Recon') {
        return {
          abilityId: Math.random() < 0.5 ? ability1Id : ability2Id,
          targetPos: objectivePos
        };
      }
      if (role === 'Control') {
        return {
          abilityId: Math.random() < 0.5 ? ability1Id : ability3Id,
          targetPos: objectivePos.clone().add(new THREE.Vector3(0, 0, -3.5))
        };
      }
      if (role === 'Sentinel') {
        return {
          abilityId: Math.random() < 0.5 ? ability1Id : ability2Id,
          targetPos: forwardPos
        };
      }
      if (role === 'Assault') {
        return { abilityId: ability2Id, targetPos: objectivePos };
      }
    }
  }

  // Proactive Recon & Sentinel utility while advancing through Mid/Flank
  if (
    (bot.fsmState === 'PATROL_ADVANCE' || bot.fsmState === 'FLANK_ROUTE') &&
    bot.position.distanceTo(sitePos) < 28
  ) {
    if (role === 'Recon') {
      return { abilityId: ability1Id, targetPos: sitePos };
    }
    if (role === 'Sentinel' && agentId === 'agent_bunker') {
      return { abilityId: ability2Id, targetPos: forwardPos };
    }
  }

  if (
    bot.fsmState === 'COMBAT_ENGAGE' &&
    bot.lastSeenTargetPos &&
    bot.position.distanceTo(bot.lastSeenTargetPos) < 26
  ) {
    // Request backup utility from teammates when engaging an enemy!
    enqueueTeamUtility(intel, bot.player.id, 'flash', bot.lastSeenTargetPos, now);
    if (bot.player.health < 65) {
      enqueueTeamUtility(intel, bot.player.id, 'heal', bot.position, now);
    }

    // Use Ultimate if charged, otherwise cycle through offensive/tactical abilities
    if (bot.player.ultPoints >= 7 && Math.random() < 0.45) {
      bot.player.ultPoints = 0;
      return { abilityId: ultimateId, targetPos: bot.lastSeenTargetPos.clone() };
    }
    const combatPool = [ability1Id, ability2Id, ability3Id];
    const chosenId = combatPool[Math.floor(Math.random() * combatPool.length)];
    return { abilityId: chosenId, targetPos: bot.lastSeenTargetPos.clone() };
  }

  return null;
}

/**
 * Evaluates and transitions the Bot's Finite State Machine (FSM) based on tactical priority
 */
function evaluateFSMTransitions(
  bot: BotState,
  botRole: AgentRole,
  intel: TeamIntel,
  mapData: MapData,
  colliders: MapCollider[],
  isSpikePlanted: boolean,
  spikePos: THREE.Vector3 | null,
  now: number,
  dt: number
) {
  bot.fsmStateTimer += dt;
  const prevState = bot.fsmState;

  // Priority 1: Direct Line-of-Sight Combat or Low-HP Tactical Retreat
  if (bot.hasLineOfSight && bot.targetEnemy && bot.lastSeenTargetPos) {
    if (bot.player.health < 36 && bot.position.distanceTo(bot.lastSeenTargetPos) > 7) {
      bot.fsmState = 'TACTICAL_RETREAT';
      bot.mode = 'cover';
      if (!bot.retreatCoverPos || prevState !== 'TACTICAL_RETREAT') {
        bot.retreatCoverPos = findNearestRetreatCover(bot.position, bot.lastSeenTargetPos, colliders);
        enqueueTeamUtility(intel, bot.player.id, 'heal', bot.retreatCoverPos, now);
        enqueueTeamUtility(intel, bot.player.id, 'smoke', bot.lastSeenTargetPos, now);
      }
      return;
    }

    bot.fsmState = 'COMBAT_ENGAGE';
    bot.mode = 'engage';
    return;
  }

  // Continue retreating briefly until behind cover if critically low HP
  if (
    bot.fsmState === 'TACTICAL_RETREAT' &&
    bot.retreatCoverPos &&
    bot.fsmStateTimer < 3.2 &&
    bot.position.distanceTo(bot.retreatCoverPos) > 1.8
  ) {
    bot.mode = 'cover';
    return;
  }

  // Priority 2: Post-Plant States (Defenders Retake & Defuse / Attackers Hold Crossfires)
  const botSide = bot.player.side || (bot.player.team === 'alpha' ? 'attackers' : 'defenders');
  if (isSpikePlanted && spikePos) {
    if (botSide === 'defenders') {
      bot.fsmState = 'RETAKE_AND_DEFUSE';
      bot.mode = intel.designatedDefuserId === bot.player.id ? 'defuse' : 'retake';
    } else {
      bot.fsmState = 'POST_PLANT_HOLD';
      bot.mode = 'post_plant';
    }
    return;
  }

  // Priority 3: Active Target Pursuit / Pincer Flank when an enemy was recently spotted
  if (bot.lastSeenTargetPos && now - bot.lastSeenTimestamp < 5200) {
    // Assault & Recon bots flank wide; others push or hold angle
    if (botRole === 'Assault' || botRole === 'Recon' || bot.tacticalAssignment === 'flank') {
      bot.fsmState = 'FLANK_ROUTE';
      bot.mode = 'pursue';
      return;
    }
    bot.fsmState = 'COORDINATED_EXECUTE';
    bot.mode = 'pursue';
    return;
  }

  // Priority 4: Team-Specific Objective & Positional States
  if (botSide === 'attackers') {
    const targetSite = intel.chosenAttackSite === 'A' ? mapData.siteA : mapData.siteB;
    const distToSite = Math.hypot(bot.position.x - targetSite.x, bot.position.z - targetSite.z);

    // Only plant if this bot carries the Spike (or no one is holding it on site)
    if (distToSite <= targetSite.radius - 0.6 && bot.player.hasSpike) {
      bot.fsmState = 'PLANT_OBJECTIVE';
      bot.mode = 'plant';
      return;
    }

    if (intel.tacticalState === 'SITE_EXECUTE' || distToSite < 24) {
      bot.fsmState = 'COORDINATED_EXECUTE';
      bot.mode = 'engage';
      return;
    }

    if (bot.tacticalAssignment === 'flank' || botRole === 'Assault') {
      bot.fsmState = 'FLANK_ROUTE';
      bot.mode = 'pursue';
      if (prevState !== 'FLANK_ROUTE' || bot.pathWaypoints.length === 0) {
        bot.pathWaypoints = generateTacticalWaypoints('attackers', 'flank', mapData, bot.flankSign);
        bot.currentWaypointIdx = 0;
      }
      return;
    }

    bot.fsmState = 'PATROL_ADVANCE';
    bot.mode = 'patrol';
  } else {
    // DEFENDERS SIDE
    const assignedSite = bot.tacticalAssignment === 'site_b' ? mapData.siteB : mapData.siteA;
    const distToAssignedSite = Math.hypot(
      bot.position.x - assignedSite.x,
      bot.position.z - assignedSite.z
    );

    // If attackers are executing on a known site, rotate to reinforce!
    if (intel.tacticalState === 'SITE_EXECUTE') {
      const attackedSite = intel.chosenAttackSite === 'A' ? mapData.siteA : mapData.siteB;
      const distToAttacked = Math.hypot(
        bot.position.x - attackedSite.x,
        bot.position.z - attackedSite.z
      );
      if (distToAttacked > attackedSite.radius + 6) {
        bot.fsmState = 'COORDINATED_EXECUTE';
        bot.mode = 'retake';
        return;
      }
    }

    // Assault defenders execute a late flank through Mid/Side lane
    if (botRole === 'Assault' || bot.tacticalAssignment === 'flank') {
      bot.fsmState = 'FLANK_ROUTE';
      bot.mode = 'pursue';
      if (prevState !== 'FLANK_ROUTE' || bot.pathWaypoints.length === 0) {
        bot.pathWaypoints = generateTacticalWaypoints('defenders', 'flank', mapData, bot.flankSign);
        bot.currentWaypointIdx = 0;
      }
      return;
    }

    // Sentinel, Control, and Site-assigned Defenders camp/anchor tactical sightlines near Sites
    if (
      botRole === 'Sentinel' ||
      botRole === 'Control' ||
      botRole === 'Support' ||
      distToAssignedSite < 16
    ) {
      bot.fsmState = 'DEFENSIVE_CAMP';
      bot.mode = 'cover';
      if (!bot.anchorSpot || prevState !== 'DEFENSIVE_CAMP') {
        const anchor = computeDefensiveAnchorSpot(bot, assignedSite, colliders);
        bot.anchorSpot = anchor.pos;
        bot.anchorLookYaw = anchor.lookYaw;
        bot.campHoldTimer = 0;
      }
      return;
    }

    bot.fsmState = 'PATROL_ADVANCE';
    bot.mode = 'patrol';
  }

  if (prevState !== bot.fsmState) {
    bot.fsmStateTimer = 0;
  }
}

/**
 * Intelligent Bot AI Brain driven by a Tactical Finite State Machine (FSM)
 * with Flank Routing, Defensive Site Camping, Coordinated Utility Execution,
 * Whisker Obstacle Steering, and Forward Facing Kinematics (+Z local space).
 */
export function updateBotAI(
  bot: BotState,
  allPlayers: MatchPlayer[],
  allBots: BotState[],
  playerPos: THREE.Vector3,
  mapData: MapData,
  colliders: MapCollider[],
  isSpikePlanted: boolean,
  spikePos: THREE.Vector3 | null,
  dt: number,
  onBotShoot: (bot: BotState, targetEnemy: MatchPlayer, hitPos: THREE.Vector3, isHeadshot: boolean) => void,
  onBotUseAbility: (bot: BotState, abilityId: string, targetPos: THREE.Vector3) => void,
  onBotPlantSpike: (bot: BotState) => void,
  onBotDefuseSpike: (bot: BotState) => void,
  droppedSpikePos: THREE.Vector3 | null = null,
  onBotPickupSpike?: (bot: BotState) => void
) {
  // Ragdoll drop if eliminated
  if (!bot.player.isAlive) {
    bot.model.group.rotation.x = THREE.MathUtils.damp(bot.model.group.rotation.x, -Math.PI / 2.1, 10, dt);
    bot.model.group.position.y = THREE.MathUtils.damp(bot.model.group.position.y, 0.22, 10, dt);
    return;
  }
  bot.model.group.visible = true;
  bot.model.group.rotation.x = 0;

  const difficulty = bot.player.botDifficulty || 'Normal';
  const adaptivePressure = getAdaptiveDifficultyAdjustments(bot.player, allPlayers, difficulty);
  const reactionThreshold = Math.max(0.06, getReactionTime(difficulty) / adaptivePressure.reactionMultiplier);
  const aimAccuracy = Math.min(0.995, getAccuracy(difficulty) * adaptivePressure.accuracyMultiplier);
  const intel = bot.player.team === 'alpha' ? AlphaIntel : OmegaIntel;
  const botSide = bot.player.side || (bot.player.team === 'alpha' ? 'attackers' : 'defenders');
  const botAgent = AGENTS.find(a => a.id === bot.player.agentId) || AGENTS[0];
  const now = Date.now();

  // Update Team Blackboard once per frame from the first active bot on each team
  updateTeamTacticalBlackboard(intel, bot.player.team, botSide, allBots, mapData, isSpikePlanted, spikePos, now);

  // Convert camera eye-level playerPos (y=1.6) to ground foot-level (y=0) to match bot.position space!
  const playerFootPos = new THREE.Vector3(playerPos.x, Math.max(0, playerPos.y - 1.6), playerPos.z);

  // 1. TACTICAL VISION SCANNING & AUDIO AWARENESS
  const enemies = allPlayers.filter(p => p.team !== bot.player.team && p.isAlive);
  let bestTarget: MatchPlayer | null = null;
  let bestTargetPos: THREE.Vector3 | null = null;
  let closestDist = Infinity;

  const botEyePos = new THREE.Vector3(bot.position.x, bot.position.y + 1.55, bot.position.z);
  // Bot model faces +Z in local space, so forward in world space is (sin(yaw), 0, cos(yaw))
  const botForward = new THREE.Vector3(Math.sin(bot.yaw), 0, Math.cos(bot.yaw));

  for (const enemy of enemies) {
    let enemyPos: THREE.Vector3 | null = null;
    if (enemy.id === 'player') {
      enemyPos = playerFootPos;
    } else {
      const eBot = allBots.find(b => b.player.id === enemy.id);
      if (eBot && eBot.player.isAlive) enemyPos = eBot.position;
    }

    if (enemyPos) {
      const dist = bot.position.distanceTo(enemyPos);
      if (dist < 42) {
        const toEnemy = new THREE.Vector3().subVectors(enemyPos, bot.position).normalize();
        const dot = botForward.dot(toEnemy);
        const enemyEye = new THREE.Vector3(enemyPos.x, enemyPos.y + 1.45, enemyPos.z);
        const canSeeEnemy = dot > -0.15 && checkLineOfSight(botEyePos, enemyEye, colliders);
        if (canSeeEnemy && dist < closestDist) {
          closestDist = dist;
          bestTarget = enemy;
          bestTargetPos = enemyPos.clone();
        } else if (dist < 14) {
          // Nearby movement can be heard through cover, but only creates a rough lead, never wall-aim.
          const previousLead = intel.enemyLastKnownPos.get(enemy.id);
          if (!previousLead || now - previousLead.time > 900) {
            intel.enemyLastKnownPos.set(enemy.id, {
              pos: enemyPos.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * 2.4,
                0,
                (Math.random() - 0.5) * 2.4
              )),
              time: now
            });
          }
        }
      }
    }
  }

  // 2. TEAM SHARED RADIO INTEL, CROSSFIRE BACKUP & TARGET MEMORY
  if (bestTarget && bestTargetPos) {
    intel.enemyLastKnownPos.set(bestTarget.id, { pos: bestTargetPos.clone(), time: now });
    bot.lastSeenTargetPos = bestTargetPos.clone();
    bot.lastSeenTimestamp = now;
    bot.targetEnemy = bestTarget;
    bot.hasLineOfSight = true;

    // Broadcast utility assistance request to squadmates (Recon, Smoke, Flash)
    if (closestDist > 14) {
      enqueueTeamUtility(intel, bot.player.id, 'flash', bestTargetPos, now);
      enqueueTeamUtility(intel, bot.player.id, 'recon', bestTargetPos, now);
    }
  } else {
    bot.hasLineOfSight = false;
    let newestTime = bot.lastSeenTimestamp;
    intel.enemyLastKnownPos.forEach((val, id) => {
      if (now - val.time < 6500 && val.time > newestTime) {
        const e = enemies.find(en => en.id === id);
        if (e && e.isAlive) {
          newestTime = val.time;
          bot.targetEnemy = e;
          bot.lastSeenTargetPos = val.pos.clone();
          bot.lastSeenTimestamp = val.time;
        }
      }
    });

    // Squad Backup: if a teammate within 28m is actively fighting an enemy, pivot to assist them!
    const fightingAlly = allBots.find(
      ally =>
        ally.player.id !== bot.player.id &&
        ally.player.team === bot.player.team &&
        ally.player.isAlive &&
        ally.hasLineOfSight &&
        ally.lastSeenTargetPos &&
        ally.position.distanceTo(bot.position) < 28
    );
    if (fightingAlly && fightingAlly.lastSeenTargetPos && fightingAlly.targetEnemy) {
      bot.targetEnemy = fightingAlly.targetEnemy;
      bot.lastSeenTargetPos = fightingAlly.lastSeenTargetPos.clone();
      bot.lastSeenTimestamp = now;
    }
  }

  // 3. EVALUATE FINITE STATE MACHINE (FSM) TRANSITIONS
  evaluateFSMTransitions(
    bot,
    botAgent.role,
    intel,
    mapData,
    colliders,
    isSpikePlanted,
    spikePos,
    now,
    dt
  );

  // 4. COORDINATED ABILITY EVALUATION (Role + FSM State + Squad Utility Queue)
  bot.abilityCooldown -= dt;
  const abilityDecision = evaluateCoordinatedAbilityCast(
    bot,
    botAgent.role,
    botAgent.id,
    botAgent.ability1.id,
    botAgent.ability2.id,
    botAgent.ability3.id,
    botAgent.ultimate.id,
    intel,
    mapData,
    allBots,
    allPlayers,
    playerFootPos,
    now
  );
  if (abilityDecision) {
    bot.abilityCooldown = 6.5 + Math.random() * 4.5;
    onBotUseAbility(bot, abilityDecision.abilityId, abilityDecision.targetPos);
  }

  // 5. EXECUTE ACTIVE FSM STATE BEHAVIOR
  const weapon = WEAPONS.find(w => w.id === bot.player.currentWeaponId) || WEAPONS[0];

  switch (bot.fsmState) {
    case 'COMBAT_ENGAGE': {
      bot.reactionTimer += dt;
      bot.isPlantingCore = false;
      bot.isDefusingCore = false;

      if (bestTargetPos && bot.targetEnemy) {
        // Turn directly toward enemy (+Z model forward => atan2(dx, dz))
        const dirToEnemy = new THREE.Vector3().subVectors(bestTargetPos, bot.position).normalize();
        bot.targetYaw = Math.atan2(dirToEnemy.x, dirToEnemy.z);
        bot.yaw = lerpAngle(bot.yaw, bot.targetYaw, dt * 16);

        if (bot.reactionTimer >= reactionThreshold) {
          const isHeadLevel =
            difficulty === 'Expert'
              ? Math.random() < 0.58
              : difficulty === 'Hard'
              ? Math.random() < 0.42
              : Math.random() < 0.25;
          const targetAimY = isHeadLevel ? 1.65 : 1.25;
          const aimTarget = bestTargetPos.clone().add(new THREE.Vector3(0, targetAimY, 0));

          const jitter = (1 - aimAccuracy) * (0.42 + closestDist * 0.011);
          aimTarget.x += (Math.random() - 0.5) * jitter;
          aimTarget.y += (Math.random() - 0.5) * jitter * 0.6;
          aimTarget.z += (Math.random() - 0.5) * jitter;

          const aimDir = new THREE.Vector3().subVectors(aimTarget, botEyePos).normalize();
          bot.targetYaw = Math.atan2(aimDir.x, aimDir.z);
          bot.targetPitch = Math.asin(THREE.MathUtils.clamp(aimDir.y, -0.8, 0.8));

          bot.yaw = lerpAngle(bot.yaw, bot.targetYaw, dt * (14 + aimAccuracy * 8));
          bot.pitch = THREE.MathUtils.lerp(bot.pitch, bot.targetPitch, dt * 12);

          // Tactical Jiggle-Strafing & Counter-Strafing
          bot.strafeTimer += dt;
          if (bot.strafeTimer > 0.55 + Math.random() * 0.35) {
            bot.strafeDir = -bot.strafeDir;
            bot.strafeTimer = 0;
            bot.isCrouchingInFight = Math.random() < 0.32 && closestDist < 22;
          }

          const forwardVec = new THREE.Vector3(Math.sin(bot.yaw), 0, Math.cos(bot.yaw));
          const rightVec = new THREE.Vector3(-Math.cos(bot.yaw), 0, Math.sin(bot.yaw));
          const strafeSpeed = bot.isCrouchingInFight ? 1.2 : 3.4;
          const forwardPush = closestDist > 22 ? 2.6 : closestDist < 7 ? -1.8 : 0;

          bot.velocity
            .copy(rightVec)
            .multiplyScalar(bot.strafeDir * strafeSpeed)
            .addScaledVector(forwardVec, forwardPush);

          // Fire Weapon with burst cadence
          bot.shootCooldown -= dt;
          if (bot.shootCooldown <= 0) {
            const isHeadshot = isHeadLevel && Math.random() < aimAccuracy;
            onBotShoot(bot, bot.targetEnemy, aimTarget, isHeadshot);

            const baseRate = 1 / Math.max(2, weapon.fireRate);
            bot.shootCooldown = baseRate * (1.15 - aimAccuracy * 0.25) + Math.random() * 0.04;
          }
        }
      }
      break;
    }

    case 'TACTICAL_RETREAT': {
      bot.isPlantingCore = false;
      bot.isDefusingCore = false;
      bot.isCrouchingInFight = false;
      if (bot.retreatCoverPos) {
        const distToCover = bot.position.distanceTo(bot.retreatCoverPos);
        if (distToCover > 1.5) {
          steerTowardWithAvoidance(bot, bot.retreatCoverPos, 5.8, colliders, dt);
        } else {
          // Crouched behind cover watching threat angle
          bot.velocity.set(0, 0, 0);
          bot.isCrouchingInFight = true;
          if (bot.lastSeenTargetPos) {
            const dir = new THREE.Vector3().subVectors(bot.lastSeenTargetPos, bot.position).normalize();
            bot.targetYaw = Math.atan2(dir.x, dir.z);
            bot.yaw = lerpAngle(bot.yaw, bot.targetYaw, dt * 10);
          }
        }
      }
      break;
    }

    case 'DEFENSIVE_CAMP': {
      bot.reactionTimer = Math.max(0, bot.reactionTimer - dt * 1.2);
      bot.isPlantingCore = false;
      bot.isDefusingCore = false;

      if (!bot.anchorSpot) {
        const site = bot.tacticalAssignment === 'site_b' ? mapData.siteB : mapData.siteA;
        const anchor = computeDefensiveAnchorSpot(bot, site, colliders);
        bot.anchorSpot = anchor.pos;
        bot.anchorLookYaw = anchor.lookYaw;
      }

      const distToAnchor = Math.hypot(
        bot.position.x - bot.anchorSpot.x,
        bot.position.z - bot.anchorSpot.z
      );

      if (distToAnchor > 1.6) {
        bot.isCrouchingInFight = false;
        steerTowardWithAvoidance(bot, bot.anchorSpot, 4.6, colliders, dt);
      } else {
        // Camp at anchor spot: micro-jiggle peek and scan entry angles
        bot.campHoldTimer += dt;
        const jiggleOffset = Math.sin(bot.campHoldTimer * 1.8) * 0.55;
        const rightVec = new THREE.Vector3(-Math.cos(bot.anchorLookYaw), 0, Math.sin(bot.anchorLookYaw));
        bot.velocity.copy(rightVec).multiplyScalar(jiggleOffset);

        // Intermittently crouch behind site cover to throw off attacker crosshair placement
        bot.isCrouchingInFight = Math.sin(bot.campHoldTimer * 0.9) > 0.35;

        // Sweep gaze slightly across the chokepoint
        const sweepAngle = Math.sin(bot.campHoldTimer * 1.25) * 0.32;
        bot.targetYaw = bot.anchorLookYaw + sweepAngle;
        bot.yaw = lerpAngle(bot.yaw, bot.targetYaw, dt * 8);

        // Every 14 seconds of quiet camping, shift to an alternate anchor angle on the site
        if (bot.campHoldTimer > 14) {
          const site = bot.tacticalAssignment === 'site_b' ? mapData.siteB : mapData.siteA;
          const newAnchor = computeDefensiveAnchorSpot(bot, site, colliders);
          bot.anchorSpot = newAnchor.pos;
          bot.anchorLookYaw = newAnchor.lookYaw;
          bot.campHoldTimer = 0;
        }
      }
      break;
    }

    case 'FLANK_ROUTE': {
      bot.reactionTimer = Math.max(0, bot.reactionTimer - dt * 1.2);
      bot.isCrouchingInFight = false;
      bot.isPlantingCore = false;
      bot.isDefusingCore = false;

      // If we have a recent enemy position within 22m, compute a lateral pincer offset
      if (bot.lastSeenTargetPos && now - bot.lastSeenTimestamp < 5000) {
        const toTarget = new THREE.Vector3().subVectors(bot.lastSeenTargetPos, bot.position).setY(0);
        const dist = toTarget.length();
        if (dist > 8) {
          toTarget.normalize();
          const perp = new THREE.Vector3(-toTarget.z * bot.flankSign, 0, toTarget.x * bot.flankSign);
          const pincerPoint = bot.lastSeenTargetPos
            .clone()
            .addScaledVector(perp, Math.min(9, dist * 0.45));
          steerTowardWithAvoidance(bot, pincerPoint, 5.5, colliders, dt);
        } else {
          steerTowardWithAvoidance(bot, bot.lastSeenTargetPos, 5.4, colliders, dt);
        }
      } else {
        if (bot.pathWaypoints.length === 0) {
          bot.pathWaypoints = generateTacticalWaypoints(
            botSide,
            'flank',
            mapData,
            bot.flankSign
          );
          bot.currentWaypointIdx = 0;
        }
        followWaypointsWithAvoidance(bot, 5.4, colliders, dt);
      }
      break;
    }

    case 'COORDINATED_EXECUTE': {
      bot.reactionTimer = Math.max(0, bot.reactionTimer - dt * 1.2);
      bot.isCrouchingInFight = false;
      bot.isPlantingCore = false;
      bot.isDefusingCore = false;

      const targetSite = intel.chosenAttackSite === 'A' ? mapData.siteA : mapData.siteB;
      // Spread squad members slightly across the site entry so they don't funnel in a single line
      const slotSpread = ((bot.player.id.charCodeAt(bot.player.id.length - 1) % 3) - 1) * 2.8;
      const executePos = new THREE.Vector3(targetSite.x + slotSpread, 0, targetSite.z);
      steerTowardWithAvoidance(bot, executePos, 5.4, colliders, dt);
      break;
    }

    case 'PLANT_OBJECTIVE': {
      bot.isCrouchingInFight = true;
      bot.velocity.set(0, 0, 0);
      bot.isPlantingCore = true;
      bot.plantTimer += dt;

      if (bot.plantTimer >= 4.0) {
        onBotPlantSpike(bot);
        bot.isPlantingCore = false;
        bot.plantTimer = 0;
      }
      break;
    }

    case 'POST_PLANT_HOLD': {
      bot.isPlantingCore = false;
      bot.isDefusingCore = false;
      if (spikePos) {
        const slotIdx = bot.player.id.charCodeAt(bot.player.id.length - 1) % 5;
        const angle = slotIdx * ((Math.PI * 2) / 5);
        const guardPos = new THREE.Vector3(
          spikePos.x + Math.cos(angle) * 6.5,
          0,
          spikePos.z + Math.sin(angle) * 6.5
        );
        if (bot.position.distanceTo(guardPos) > 1.8) {
          bot.isCrouchingInFight = false;
          steerTowardWithAvoidance(bot, guardPos, 4.8, colliders, dt);
        } else {
          // Hold crossfire angle watching approach toward the planted core
          bot.velocity.set(0, 0, 0);
          bot.isCrouchingInFight = true;
          const watchDir = new THREE.Vector3().subVectors(spikePos, bot.position).normalize();
          bot.targetYaw = Math.atan2(watchDir.x, watchDir.z);
          bot.yaw = lerpAngle(bot.yaw, bot.targetYaw, dt * 8);
        }
      }
      break;
    }

    case 'RETAKE_AND_DEFUSE': {
      bot.isPlantingCore = false;
      if (spikePos) {
        const isDesignatedDefuser =
          intel.designatedDefuserId === bot.player.id || !intel.designatedDefuserId;
        const distToSpike = bot.position.distanceTo(spikePos);

        if (isDesignatedDefuser) {
          if (distToSpike < 2.8) {
            bot.velocity.set(0, 0, 0);
            bot.isCrouchingInFight = true;
            bot.isDefusingCore = true;
            bot.defuseTimer += dt;

            if (bot.defuseTimer >= 6.5) {
              onBotDefuseSpike(bot);
              bot.isDefusingCore = false;
              bot.defuseTimer = 0;
            }
          } else {
            bot.isCrouchingInFight = false;
            steerTowardWithAvoidance(bot, spikePos, 5.6, colliders, dt);
          }
        } else {
          // Overwatch escort: clear perimeter 5m around the defuser
          bot.isDefusingCore = false;
          const escortAngle = (bot.player.id.charCodeAt(bot.player.id.length - 1) % 4) * (Math.PI / 2);
          const escortPos = new THREE.Vector3(
            spikePos.x + Math.cos(escortAngle) * 5.0,
            0,
            spikePos.z + Math.sin(escortAngle) * 5.0
          );
          steerTowardWithAvoidance(bot, escortPos, 5.4, colliders, dt);
        }
      }
      break;
    }

    case 'PATROL_ADVANCE':
    default: {
      bot.reactionTimer = Math.max(0, bot.reactionTimer - dt * 1.5);
      bot.isCrouchingInFight = false;
      bot.isPlantingCore = false;
      bot.isDefusingCore = false;

      // If this bot is an Attacker and the Spike is dropped on the ground, retrieve it if close or if no one else has it!
      if (botSide === 'attackers' && droppedSpikePos && !isSpikePlanted) {
        const distToDropped = Math.hypot(
          bot.position.x - droppedSpikePos.x,
          bot.position.z - droppedSpikePos.z
        );
        if (distToDropped < 2.2 && onBotPickupSpike) {
          onBotPickupSpike(bot);
        } else if (distToDropped < 28) {
          steerTowardWithAvoidance(bot, droppedSpikePos, 5.4, colliders, dt);
          break;
        }
      }

      if (bot.pathWaypoints.length === 0) {
        const lane =
          botSide === 'attackers'
            ? bot.tacticalAssignment === 'mid'
              ? 'mid'
              : intel.chosenAttackSite === 'A'
              ? 'site_a'
              : 'site_b'
            : bot.tacticalAssignment === 'flank'
            ? 'mid'
            : bot.tacticalAssignment;
        bot.pathWaypoints = generateTacticalWaypoints(
          botSide,
          lane,
          mapData,
          bot.flankSign
        );
        bot.currentWaypointIdx = 0;
      }
      followWaypointsWithAvoidance(bot, 4.9, colliders, dt);
      break;
    }
  }

  // Apply slow effect if affected by Cryo Slick / Entangling Vines / Suppressor Field
  if (bot.slowTimer && bot.slowTimer > 0) {
    bot.slowTimer = Math.max(0, bot.slowTimer - dt);
    bot.velocity.multiplyScalar(0.45);
  }

  // 6. AXIS-SEPARATED COLLISION SLIDING, STEP-UP & UNSTUCK RECOVERY
  const radius = 0.42;
  const stepUpAllowance = 0.65;
  const footY = bot.position.y;

  // Test X Axis movement
  const nextX = bot.position.x + bot.velocity.x * dt;
  const boxX = new THREE.Box3(
    new THREE.Vector3(nextX - radius, footY + stepUpAllowance, bot.position.z - radius),
    new THREE.Vector3(nextX + radius, footY + 1.8, bot.position.z + radius)
  );
  let blockedX = false;
  for (const c of colliders) {
    if (c.box.intersectsBox(boxX)) {
      blockedX = true;
      break;
    }
  }
  if (!blockedX) {
    bot.position.x = nextX;
  }

  // Test Z Axis movement
  const nextZ = bot.position.z + bot.velocity.z * dt;
  const boxZ = new THREE.Box3(
    new THREE.Vector3(bot.position.x - radius, footY + stepUpAllowance, nextZ - radius),
    new THREE.Vector3(bot.position.x + radius, footY + 1.8, nextZ + radius)
  );
  let blockedZ = false;
  for (const c of colliders) {
    if (c.box.intersectsBox(boxZ)) {
      blockedZ = true;
      break;
    }
  }
  if (!blockedZ) {
    bot.position.z = nextZ;
  }

  // Support surface height (allows bots to walk onto ramps, bridges, and steps)
  let supportY = 0;
  for (const c of colliders) {
    if (
      bot.position.x + radius * 0.8 >= c.box.min.x &&
      bot.position.x - radius * 0.8 <= c.box.max.x &&
      bot.position.z + radius * 0.8 >= c.box.min.z &&
      bot.position.z - radius * 0.8 <= c.box.max.z
    ) {
      const topY = c.box.max.y;
      if (topY <= footY + stepUpAllowance && topY > supportY) {
        supportY = topY;
      }
    }
  }
  bot.position.y = THREE.MathUtils.damp(bot.position.y, supportY, 16, dt);

  // Keep inside map perimeter
  bot.position.x = THREE.MathUtils.clamp(bot.position.x, -51, 51);
  bot.position.z = THREE.MathUtils.clamp(bot.position.z, -51, 51);

  // Check if stuck against a corner while trying to move
  const movedDist = Math.hypot(bot.position.x - bot.lastPosition.x, bot.position.z - bot.lastPosition.z);
  bot.lastPosition.copy(bot.position);
  if (bot.velocity.lengthSq() > 2.0 && movedDist < 0.015) {
    bot.stuckTimer += dt;
    if (bot.stuckTimer > 0.3) {
      bot.flankSign = -bot.flankSign;
      const sideStep = new THREE.Vector3(-Math.cos(bot.yaw) * bot.flankSign, 0, Math.sin(bot.yaw) * bot.flankSign);
      bot.position.addScaledVector(sideStep, 0.55);
      if (bot.pathWaypoints.length > 0) {
        bot.currentWaypointIdx = (bot.currentWaypointIdx + 1) % bot.pathWaypoints.length;
      }
      bot.stuckTimer = 0;
    }
  } else {
    bot.stuckTimer = Math.max(0, bot.stuckTimer - dt);
  }

  // 7. 3D MODEL TRANSFORMATION & PROCEDURAL ARTICULATED ANIMATIONS
  const crouchDrop = bot.isCrouchingInFight ? -0.35 : 0;
  bot.model.group.position.set(bot.position.x, bot.position.y + crouchDrop, bot.position.z);
  bot.model.group.rotation.y = bot.yaw;

  // Head & weapon arm pitch tracking
  bot.model.head.rotation.x = -bot.pitch;
  bot.model.rightArm.rotation.x = -bot.pitch;

  // Update 3D overhead health bar fill
  if (bot.model.healthBarFill) {
    const hpRatio = THREE.MathUtils.clamp(bot.player.health / Math.max(1, bot.player.maxHealth), 0.01, 1.0);
    bot.model.healthBarFill.scale.x = hpRatio;
    bot.model.healthBarFill.position.x = -0.32 * (1 - hpRatio);
  }

  const speedSq = bot.velocity.lengthSq();
  if (speedSq > 0.15) {
    bot.walkCycle += dt * 11.5;
    const legSwing = Math.sin(bot.walkCycle) * 0.52;
    bot.model.leftLeg.rotation.x = legSwing;
    bot.model.rightLeg.rotation.x = -legSwing;
    bot.model.leftArm.rotation.x = -legSwing * 0.45;
    bot.model.torso.rotation.z = Math.cos(bot.walkCycle) * 0.04;
  } else {
    bot.model.leftLeg.rotation.x = THREE.MathUtils.damp(bot.model.leftLeg.rotation.x, 0, 10, dt);
    bot.model.rightLeg.rotation.x = THREE.MathUtils.damp(bot.model.rightLeg.rotation.x, 0, 10, dt);
    bot.model.leftArm.rotation.x = THREE.MathUtils.damp(bot.model.leftArm.rotation.x, 0, 10, dt);
    bot.model.torso.rotation.z = 0;
  }
}

/**
 * 5-Whisker Raycast Obstacle Avoidance Steering
 * Ensures bots always face forward (+Z model space => atan2(desired.x, desired.z))
 */
function steerTowardWithAvoidance(
  bot: BotState,
  targetPos: THREE.Vector3,
  speed: number,
  colliders: MapCollider[],
  dt: number
) {
  const desired = new THREE.Vector3().subVectors(targetPos, bot.position);
  desired.y = 0;
  const dist = desired.length();

  if (dist < 1.2) {
    bot.velocity.set(0, 0, 0);
    return;
  }

  desired.normalize();
  const origin = new THREE.Vector3(bot.position.x, bot.position.y + 1.0, bot.position.z);
  const feelerDist = 3.4;

  // Check if direct path is blocked within 3.4m
  if (isRayBlocked(origin, desired, feelerDist, colliders)) {
    const angles = [
      0.55 * bot.flankSign,
      -0.55 * bot.flankSign,
      1.1 * bot.flankSign,
      -1.1 * bot.flankSign,
      1.65 * bot.flankSign
    ];
    let steered = desired.clone();
    for (const ang of angles) {
      const candidate = desired.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      if (!isRayBlocked(origin, candidate, feelerDist, colliders)) {
        steered = candidate;
        break;
      }
    }
    desired.copy(steered);
  }

  bot.velocity.copy(desired).multiplyScalar(speed);
  // Bot model faces +Z in local space, so atan2(desired.x, desired.z) faces the movement direction!
  bot.targetYaw = Math.atan2(desired.x, desired.z);
  bot.yaw = lerpAngle(bot.yaw, bot.targetYaw, dt * 11);
}

function followWaypointsWithAvoidance(
  bot: BotState,
  speed: number,
  colliders: MapCollider[],
  dt: number
) {
  if (bot.pathWaypoints.length === 0) return;

  const targetWp = bot.pathWaypoints[bot.currentWaypointIdx];
  const dist = Math.hypot(targetWp.x - bot.position.x, targetWp.z - bot.position.z);

  if (dist < 2.6) {
    bot.currentWaypointIdx = (bot.currentWaypointIdx + 1) % bot.pathWaypoints.length;
  } else {
    steerTowardWithAvoidance(bot, targetWp, speed, colliders, dt);
  }
}

function isRayBlocked(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDist: number,
  colliders: MapCollider[]
): boolean {
  const ray = new THREE.Ray(origin, dir);
  const hitPt = new THREE.Vector3();
  for (const c of colliders) {
    if (c.box.max.y < origin.y - 0.3) continue;
    const hit = ray.intersectBox(c.box, hitPt);
    if (hit && origin.distanceTo(hit) < maxDist) {
      return true;
    }
  }
  return false;
}

function checkLineOfSight(from: THREE.Vector3, to: THREE.Vector3, colliders: MapCollider[]): boolean {
  const dir = new THREE.Vector3().subVectors(to, from);
  const maxDist = dir.length();
  dir.normalize();

  const ray = new THREE.Ray(from, dir);
  const hitPt = new THREE.Vector3();
  for (const c of colliders) {
    if (c.box.max.y < 0.7) continue;
    const intersection = ray.intersectBox(c.box, hitPt);
    if (intersection && from.distanceTo(intersection) < maxDist - 0.45) {
      return false;
    }
  }
  return true;
}

function getReactionTime(diff: BotDifficulty): number {
  switch (diff) {
    case 'Beginner': return 0.55;
    case 'Easy': return 0.38;
    case 'Normal': return 0.24;
    case 'Hard': return 0.14;
    case 'Expert': return 0.08;
  }
}

function getAccuracy(diff: BotDifficulty): number {
  switch (diff) {
    case 'Beginner': return 0.58;
    case 'Easy': return 0.72;
    case 'Normal': return 0.86;
    case 'Hard': return 0.94;
    case 'Expert': return 0.99;
  }
}

function getAdaptiveDifficultyAdjustments(
  player: MatchPlayer,
  allPlayers: MatchPlayer[],
  diff: BotDifficulty
): { reactionMultiplier: number; accuracyMultiplier: number } {
  const skillBias = {
    Beginner: 1.0,
    Easy: 1.05,
    Normal: 1.12,
    Hard: 1.18,
    Expert: 1.24
  }[diff];

  const playerKillDelta = Math.max(0, player.stats.kills - player.stats.deaths);
  const playerPressure = Math.min(1.28, 1 + playerKillDelta * 0.08);
  const teamPressure = allPlayers.filter(p => p.team === player.team).reduce((sum, p) => sum + p.stats.kills, 0);
  const enemyPressure = allPlayers.filter(p => p.team !== player.team).reduce((sum, p) => sum + p.stats.kills, 0);
  const relativePressure = Math.min(1.2, Math.max(0.82, 1 + (enemyPressure - teamPressure) * 0.04));

  const reactionMultiplier = Math.min(1.5, (skillBias * playerPressure * relativePressure));
  const accuracyMultiplier = Math.min(1.35, (skillBias * (1 + Math.max(0, player.stats.kills - 1) * 0.06) * relativePressure));

  if (player.stats.deaths > player.stats.kills) {
    return {
      reactionMultiplier: Math.max(0.78, reactionMultiplier * 0.88),
      accuracyMultiplier: Math.max(0.8, accuracyMultiplier * 0.9)
    };
  }

  return {
    reactionMultiplier: Math.min(1.5, Math.max(0.8, reactionMultiplier)),
    accuracyMultiplier: Math.min(1.35, Math.max(0.82, accuracyMultiplier))
  };
}
