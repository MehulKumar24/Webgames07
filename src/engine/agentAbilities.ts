import * as THREE from 'three';
import { Agent, MatchPlayer } from '../types/game';
import { MapCollider } from './mapBuilder';
import { BotState } from './botAI';
import { soundEngine } from '../audio/soundEngine';
import { AbilityPhysicsEngine } from './abilityPhysics';

export interface ActiveAbilityEntity {
  id: string;
  type: string;
  name: string;
  ownerId: string;
  caster?: MatchPlayer;
  team: 'alpha' | 'omega';
  position: THREE.Vector3;
  radius: number;
  dps: number;
  healPerSec?: number;
  pullStrength?: number;
  slowBots?: boolean;
  blocksVision?: boolean;
  mesh: THREE.Object3D;
  collider?: MapCollider;
  duration: number;
  timeAlive: number;
  tickAccum: number;
  onTick?: (dt: number, colliders: MapCollider[]) => void;
  onDestroy?: () => void;
}

export class AgentAbilityManager {
  private scene: THREE.Scene;
  public physicsEngine: AbilityPhysicsEngine;
  public entities: ActiveAbilityEntity[] = [];
  public isPlayerFlashed: boolean = false;
  public flashIntensity: number = 0;
  public isEnemiesRevealed: boolean = false;
  public revealedEnemyIds = new Set<string>();
  public lastCastBanner: string = '';
  private reconMarkers = new Map<string, THREE.Group>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.physicsEngine = new AbilityPhysicsEngine(scene);
  }

  /**
   * Clears all active ability zones, walls, turrets, recon markers, and projectiles on round reset
   */
  public clearAll(colliders?: MapCollider[]) {
    this.physicsEngine.clearAll();
    for (const ent of this.entities) {
      if (ent.collider && colliders) {
        const idx = colliders.indexOf(ent.collider);
        if (idx !== -1) colliders.splice(idx, 1);
      }
      this.scene.remove(ent.mesh);
    }
    this.entities = [];
    this.reconMarkers.forEach(marker => this.scene.remove(marker));
    this.reconMarkers.clear();
    this.revealedEnemyIds.clear();
    this.isEnemiesRevealed = false;
    this.flashIntensity = 0;
    this.isPlayerFlashed = false;
  }

  /**
   * Checks whether a sightline segment passes through any active Smoke Cloud / Firewall
   */
  public isSightlineBlockedBySmoke(start: THREE.Vector3, end: THREE.Vector3): boolean {
    const rayDir = new THREE.Vector3().subVectors(end, start);
    const maxDist = rayDir.length();
    if (maxDist < 0.1) return false;
    rayDir.normalize();
    const ray = new THREE.Ray(start, rayDir);
    const closestPt = new THREE.Vector3();

    for (const ent of this.entities) {
      if (!ent.blocksVision) continue;
      ray.closestPointToPoint(ent.position, closestPt);
      const distAlongRay = start.distanceTo(closestPt);
      if (distAlongRay <= maxDist && closestPt.distanceTo(ent.position) <= ent.radius) {
        return true;
      }
    }
    return false;
  }

  public update(
    dt: number,
    colliders: MapCollider[],
    allPlayers: MatchPlayer[],
    bots?: BotState[],
    playerPos?: THREE.Vector3,
    onDamageBot?: (bot: BotState, damage: number, abilityName: string, attacker?: MatchPlayer) => void,
    onDamagePlayer?: (damage: number, abilityName: string, attacker?: MatchPlayer) => void,
    onLaunchPlayer?: (upVelocity: number) => void,
    onPlayerVitalsChanged?: () => void
  ) {
    // 0. Step the decoupled Continuous Collision Detection (CCD) Projectile Physics Engine
    this.physicsEngine.update(dt, colliders, bots);

    // 1. Fade out flashbang intensity
    if (this.flashIntensity > 0) {
      this.flashIntensity = Math.max(0, this.flashIntensity - dt * 1.15);
      this.isPlayerFlashed = this.flashIntensity > 0.05;
    }

    // 2. Update 3D Recon Wall-Hack Diamonds above Revealed Enemy Bots
    if (bots) {
      for (const b of bots) {
        const shouldReveal =
          b.player.isAlive &&
          b.player.team === 'omega' &&
          (this.isEnemiesRevealed || this.revealedEnemyIds.has(b.player.id));

        if (shouldReveal) {
          let marker = this.reconMarkers.get(b.player.id);
          if (!marker) {
            marker = this.createReconTargetMarker();
            this.scene.add(marker);
            this.reconMarkers.set(b.player.id, marker);
          }
          marker.position.set(
            b.position.x,
            b.position.y + 2.75 + Math.sin(Date.now() * 0.008) * 0.12,
            b.position.z
          );
          marker.rotation.y += dt * 3.5;
        } else {
          const marker = this.reconMarkers.get(b.player.id);
          if (marker) {
            this.scene.remove(marker);
            this.reconMarkers.delete(b.player.id);
          }
        }
      }
    }

    // 3. Update active ability entities, tick AoE damage, healing, slows, pulls, and turrets
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i];
      entity.timeAlive += dt;
      entity.tickAccum += dt;

      if (entity.onTick) {
        entity.onTick(dt, colliders);
      }

      // Repulsor Jump Pad launch for caster's own movement or launching enemy bots
      if (entity.type === 'repulsor_pad') {
        if (playerPos && onLaunchPlayer && entity.ownerId === 'player') {
          const d = Math.hypot(playerPos.x - entity.position.x, playerPos.z - entity.position.z);
          if (d < entity.radius && playerPos.y < entity.position.y + 2.2) {
            soundEngine.playAbility('dash');
            onLaunchPlayer(12.5);
          }
        }
        if (bots) {
          for (const b of bots) {
            if (!b.player.isAlive || b.player.team === entity.team) continue;
            const d = Math.hypot(b.position.x - entity.position.x, b.position.z - entity.position.z);
            if (d < entity.radius) {
              b.slowTimer = 1.5;
              b.reactionTimer = -0.8;
              b.model.group.position.y = 2.4 + Math.sin(Date.now() * 0.01) * 0.4;
            }
          }
        }
      }

      // Gravitational pull & Crowd-Control Slow on Enemy Bots (verified against walls via CCD)
      if (bots) {
        for (const b of bots) {
          if (!b.player.isAlive || b.player.team === entity.team) continue;
          const dist = Math.hypot(b.position.x - entity.position.x, b.position.z - entity.position.z);
          if (dist <= entity.radius) {
            if (entity.slowBots) {
              b.slowTimer = 0.75;
            }
            if (entity.pullStrength && dist > 0.65) {
              const pullDir = new THREE.Vector3(
                entity.position.x - b.position.x,
                0,
                entity.position.z - b.position.z
              ).normalize();
              const desiredPullPos = b.position.clone().addScaledVector(pullDir, entity.pullStrength * dt);
              const pullCheck = this.physicsEngine.sweepSphereCCD(
                b.position.clone().add(new THREE.Vector3(0, 0.9, 0)),
                desiredPullPos.clone().add(new THREE.Vector3(0, 0.9, 0)),
                0.42,
                colliders
              );
              if (!pullCheck.hit) {
                b.position.copy(desiredPullPos);
              }
            }
          }
        }
      }

      // Every 0.25s apply AoE DPS, Healing, or Auto-Turret bursts
      if (entity.tickAccum >= 0.25) {
        const tickDt = entity.tickAccum;
        entity.tickAccum = 0;

        // Auto-Turret target acquisition & CCD Line-of-Sight laser fire
        if (entity.type === 'auto_turret' && bots && playerPos) {
          const turretMuzzle = entity.position.clone().add(new THREE.Vector3(0, 0.78, 0));
          const playerRef = allPlayers.find(p => p.id === 'player');
          if (entity.team === 'alpha') {
            let closestBot: BotState | null = null;
            let minDist = 28;
            for (const b of bots) {
              if (b.player.team !== 'alpha' && b.player.isAlive) {
                const d = entity.position.distanceTo(b.position);
                if (d < minDist) {
                  const targetChest = b.position.clone().add(new THREE.Vector3(0, 1.25, 0));
                  const losCheck = this.physicsEngine.sweepSphereCCD(turretMuzzle, targetChest, 0.04, colliders);
                  if (!losCheck.hit) {
                    minDist = d;
                    closestBot = b;
                  }
                }
              }
            }
            if (closestBot && onDamageBot) {
              entity.mesh.lookAt(closestBot.position.x, entity.position.y, closestBot.position.z);
              this.spawnLaserBeam(
                turretMuzzle,
                closestBot.position.clone().add(new THREE.Vector3(0, 1.25, 0)),
                0x00f0ff,
                0.04,
                110
              );
              onDamageBot(closestBot, 14, 'Sentinel Turret', entity.caster);
            }
          } else if (entity.team === 'omega') {
            // Enemy turret targets closest living Alpha operative (bot or player) with clear LOS
            let closestAlphaBot: BotState | null = null;
            let minDist = 22;
            for (const b of bots) {
              if (b.player.team === 'alpha' && b.player.isAlive) {
                const d = entity.position.distanceTo(b.position);
                if (d < minDist) {
                  const targetChest = b.position.clone().add(new THREE.Vector3(0, 1.25, 0));
                  const losCheck = this.physicsEngine.sweepSphereCCD(turretMuzzle, targetChest, 0.04, colliders);
                  if (!losCheck.hit) {
                    minDist = d;
                    closestAlphaBot = b;
                  }
                }
              }
            }
            if (closestAlphaBot && onDamageBot && entity.caster) {
              entity.mesh.lookAt(closestAlphaBot.position.x, entity.position.y, closestAlphaBot.position.z);
              this.spawnLaserBeam(
                turretMuzzle,
                closestAlphaBot.position.clone().add(new THREE.Vector3(0, 1.25, 0)),
                0xef4444,
                0.04,
                110
              );
              onDamageBot(closestAlphaBot, 10, 'Enemy Turret', entity.caster);
            } else if (
              playerRef &&
              playerRef.isAlive &&
              playerRef.team === 'alpha' &&
              entity.caster &&
              entity.caster.team === 'omega' &&
              onDamagePlayer
            ) {
              const d = Math.hypot(playerPos.x - entity.position.x, playerPos.z - entity.position.z);
              if (d < 20) {
                const targetChest = new THREE.Vector3(playerPos.x, playerPos.y - 0.35, playerPos.z);
                const losCheck = this.physicsEngine.sweepSphereCCD(turretMuzzle, targetChest, 0.04, colliders);
                if (!losCheck.hit) {
                  entity.mesh.lookAt(playerPos.x, entity.position.y, playerPos.z);
                  this.spawnLaserBeam(turretMuzzle, targetChest, 0xef4444, 0.04, 110);
                  onDamagePlayer(4, 'Enemy Turret', entity.caster);
                }
              }
            }
          }
        }

        // AoE Damage zones (STRICT: NEVER damage teammates or self — ONLY enemy team!)
        if (entity.dps > 0 && entity.caster) {
          const dmgAmount = Math.max(1, Math.round(entity.dps * tickDt));
          if (bots && onDamageBot) {
            for (const b of bots) {
              if (!b.player.isAlive || b.player.team === entity.team) continue;
              const d = Math.hypot(b.position.x - entity.position.x, b.position.z - entity.position.z);
              if (d <= entity.radius) {
                onDamageBot(b, dmgAmount, entity.name, entity.caster);
              }
            }
          }
          const playerRef = allPlayers.find(p => p.id === 'player');
          if (
            playerRef &&
            playerRef.isAlive &&
            entity.team === 'omega' &&
            entity.caster.team === 'omega' &&
            playerRef.team === 'alpha' &&
            playerPos &&
            onDamagePlayer
          ) {
            const d = Math.hypot(playerPos.x - entity.position.x, playerPos.z - entity.position.z);
            if (d <= entity.radius) {
              onDamagePlayer(Math.max(2, Math.min(6, Math.round(dmgAmount * 0.4))), entity.name, entity.caster);
            }
          }
        }

        // AoE Healing zones (Heals player and allied bots & immediately syncs HUD!)
        if (entity.healPerSec && entity.healPerSec > 0) {
          const healAmount = Math.max(1, Math.round(entity.healPerSec * tickDt));
          for (const p of allPlayers) {
            if (!p.isAlive || p.team !== entity.team) continue;
            if (p.id === 'player' && playerPos) {
              const d = Math.hypot(playerPos.x - entity.position.x, playerPos.z - entity.position.z);
              if (d <= entity.radius && p.health < p.maxHealth) {
                p.health = Math.min(p.maxHealth, p.health + healAmount);
                onPlayerVitalsChanged?.();
              }
            } else if (bots) {
              const b = bots.find(bt => bt.player.id === p.id);
              if (b) {
                const d = Math.hypot(b.position.x - entity.position.x, b.position.z - entity.position.z);
                if (d <= entity.radius) {
                  p.health = Math.min(p.maxHealth, p.health + healAmount);
                }
              }
            }
          }
        }
      }

      // Remove expired ability entities
      if (entity.timeAlive >= entity.duration) {
        if (entity.collider) {
          const idx = colliders.indexOf(entity.collider);
          if (idx !== -1) colliders.splice(idx, 1);
        }
        if (entity.onDestroy) entity.onDestroy();
        this.scene.remove(entity.mesh);
        this.entities.splice(i, 1);
      }
    }
  }

  /**
   * Computes a safe initial launch origin outside the caster's body and uses CCD to ensure
   * throwing while pressed right up against a thin wall never spawns the projectile on the other side of the wall.
   */
  private getSafeLaunchOrigin(
    originPos: THREE.Vector3,
    lookDir: THREE.Vector3,
    radius: number,
    colliders: MapCollider[]
  ): THREE.Vector3 {
    const desiredHand = originPos
      .clone()
      .addScaledVector(lookDir.clone().normalize(), 0.52)
      .add(new THREE.Vector3(0, -0.12, 0));

    const sweep = this.physicsEngine.sweepSphereCCD(originPos, desiredHand, radius, colliders);
    if (sweep.hit) {
      return sweep.point.clone().addScaledVector(sweep.normal, radius + 0.02);
    }
    return desiredHand;
  }

  /**
   * Launches a physical bouncing tactical grenade/orb using the decoupled CCD Physics Engine
   */
  private launchBouncingOrdnance(
    name: string,
    caster: MatchPlayer,
    originPos: THREE.Vector3,
    lookDir: THREE.Vector3,
    speed: number,
    upwardArc: number,
    colorHex: number,
    fuseTime: number,
    detonateOnFloorHit: boolean,
    colliders: MapCollider[],
    onDetonate: (impactPos: THREE.Vector3, impactNormal: THREE.Vector3) => void
  ) {
    const radius = 0.16;
    const safeStart = this.getSafeLaunchOrigin(originPos, lookDir, radius, colliders);
    const vel = lookDir.clone().normalize().multiplyScalar(speed);
    vel.y += upwardArc;

    this.physicsEngine.spawnProjectile(
      {
        name,
        ownerId: caster.id,
        team: caster.team,
        casterOrigin: originPos.clone(),
        origin: safeStart,
        velocity: vel,
        radius,
        gravity: 17.5,
        restitution: 0.52,
        friction: 0.78,
        maxBounces: 3,
        fuseTime,
        detonateOnFloorHit,
        colorHex,
        behavior: 'bounce_detonate',
        onBounce: () => {
          soundEngine.playUIClick();
        },
        onDetonate: (impactPos, impactNormal) => {
          onDetonate(impactPos, impactNormal);
        }
      },
      colliders
    );
  }

  /**
   * Launches a high-velocity sticky tactical trap/dart using Swept-Sphere CCD
   * so it sticks onto the exact surface normal of thin walls, pillars, or floors.
   */
  private launchStickyTrapOrDart(
    name: string,
    caster: MatchPlayer,
    originPos: THREE.Vector3,
    lookDir: THREE.Vector3,
    speed: number,
    gravity: number,
    colorHex: number,
    colliders: MapCollider[],
    onStick: (stickPos: THREE.Vector3, surfaceNormal: THREE.Vector3) => void
  ) {
    const radius = 0.14;
    const safeStart = this.getSafeLaunchOrigin(originPos, lookDir, radius, colliders);
    const vel = lookDir.clone().normalize().multiplyScalar(speed);

    this.physicsEngine.spawnProjectile(
      {
        name,
        ownerId: caster.id,
        team: caster.team,
        casterOrigin: originPos.clone(),
        origin: safeStart,
        velocity: vel,
        radius,
        gravity,
        restitution: 0,
        friction: 1.0,
        maxBounces: 0,
        fuseTime: 2.2,
        detonateOnFloorHit: true,
        colorHex,
        behavior: 'stick_on_impact',
        onDetonate: (impactPos, impactNormal) => {
          onStick(impactPos, impactNormal);
        }
      },
      colliders
    );
  }

  /**
   * Triggers any of the 48 abilities across all 12 Agents using Continuous Collision Detection (CCD)
   * projectile physics and surface-validated deployment.
   */
  public castAbility(
    abilityId: string,
    agent: Agent,
    caster: MatchPlayer,
    originPos: THREE.Vector3,
    lookDir: THREE.Vector3,
    yaw: number,
    colliders: MapCollider[],
    bots?: BotState[],
    onDamageBot?: (bot: BotState, damage: number, abilityName: string, attacker?: MatchPlayer) => void,
    playerRef?: MatchPlayer,
    playerPos?: THREE.Vector3,
    onDamagePlayer?: (damage: number, abilityName: string, attacker?: MatchPlayer) => void
  ): {
    dashVelocity?: THREE.Vector3;
    speedBoost?: number;
    invulnerableTime?: number;
    jumpPadLaunch?: boolean;
    abilityBanner?: string;
  } {
    const result: {
      dashVelocity?: THREE.Vector3;
      speedBoost?: number;
      invulnerableTime?: number;
      jumpPadLaunch?: boolean;
      abilityBanner?: string;
    } = {};

    const forwardFlat = new THREE.Vector3(lookDir.x, 0, lookDir.z);
    if (forwardFlat.lengthSq() < 0.001) forwardFlat.set(0, 0, -1);
    else forwardFlat.normalize();

    // Helper: if an ENEMY bot (omega) casts a burst ability near the player (alpha), apply balanced enemy ability damage
    const checkEnemyAbilityHitOnPlayer = (center: THREE.Vector3, radius: number, rawDmg: number, abilName: string) => {
      if (
        caster.team === 'omega' &&
        playerRef &&
        playerRef.team === 'alpha' &&
        playerRef.isAlive &&
        playerPos &&
        onDamagePlayer
      ) {
        const d = Math.hypot(playerPos.x - center.x, playerPos.z - center.z);
        if (d <= radius) {
          const pChest = new THREE.Vector3(playerPos.x, playerPos.y - 0.35, playerPos.z);
          const los = this.physicsEngine.sweepSphereCCD(
            new THREE.Vector3(center.x, center.y + 0.5, center.z),
            pChest,
            0.05,
            colliders
          );
          if (!los.hit) {
            onDamagePlayer(Math.min(24, Math.max(8, Math.round(rawDmg * 0.32))), abilName, caster);
          }
        }
      }
    };

    // Helper: if an ALLIED bot (alpha) casts a heal/shield ability near the player, boost the player too!
    const applyAlliedSupportToPlayer = (center: THREE.Vector3, radius: number, healHp: number, addArmor: number) => {
      if (
        caster.team === 'alpha' &&
        caster.id !== 'player' &&
        playerRef &&
        playerRef.team === 'alpha' &&
        playerRef.isAlive &&
        playerPos
      ) {
        const d = Math.hypot(playerPos.x - center.x, playerPos.z - center.z);
        if (d <= radius) {
          if (healHp > 0) playerRef.health = Math.min(playerRef.maxHealth, playerRef.health + healHp);
          if (addArmor > 0) playerRef.armor = Math.min(playerRef.maxArmor, playerRef.armor + addArmor);
        }
      }
    };

    switch (abilityId) {
      // ======================================================================
      // 1. VORTEX (Assault)
      // ======================================================================
      case 'vortex_dash': {
        soundEngine.playAbility('dash');
        result.dashVelocity = forwardFlat.clone().multiplyScalar(22.0).setY(2.4);
        result.invulnerableTime = 0.6;
        result.speedBoost = 1.25;
        result.abilityBanner = 'SHOCK BURST DASH';
        this.spawnKineticRing(originPos.clone(), 0x00f0ff);
        const dashEnd = originPos.clone().addScaledVector(forwardFlat, 5.5);
        this.spawnKineticRing(dashEnd, 0x00f0ff);
        // Shockwave damage to enemies directly in the dash path
        if (bots && onDamageBot) {
          for (const b of bots) {
            if (b.player.team !== caster.team && b.player.isAlive && b.position.distanceTo(dashEnd) < 4.5) {
              b.slowTimer = 1.5;
              onDamageBot(b, 45, 'Shock Burst', caster);
            }
          }
        }
        break;
      }
      case 'vortex_grenade': {
        soundEngine.playAbility('sonar');
        this.launchBouncingOrdnance(
          'Graviton Flash',
          caster,
          originPos,
          lookDir,
          21.0,
          2.2,
          0x00f0ff,
          0.65,
          false,
          colliders,
          (impactPos) => {
            const flashPos = impactPos.clone().add(new THREE.Vector3(0, 0.35, 0));
            this.spawnFlashBurstMesh(flashPos, 0x00f0ff);
            this.applyFlashAndDamageWithLOS(
              flashPos,
              16.0,
              45,
              'Graviton Flash',
              caster,
              colliders,
              bots,
              onDamageBot
            );
          }
        );
        result.abilityBanner = 'GRAVITON FLASH THROWN';
        break;
      }
      case 'vortex_rift': {
        soundEngine.playAbility('sonar');
        const padPos = this.physicsEngine.resolveDeployableGroundPosition(
          originPos,
          lookDir,
          8.5,
          0.65,
          colliders
        );
        this.spawnRepulsorPad(padPos, caster);
        if (bots && onDamageBot) {
          for (const b of bots) {
            if (b.player.team !== caster.team && b.player.isAlive && b.position.distanceTo(padPos) < 4.5) {
              b.slowTimer = 2.2;
              onDamageBot(b, 40, 'Repulsor Well', caster);
            }
          }
        }
        result.abilityBanner = 'REPULSOR JUMP WELL DEPLOYED';
        break;
      }
      case 'vortex_ult': {
        soundEngine.playAbility('ultimate');
        result.dashVelocity = forwardFlat.clone().multiplyScalar(15.0).setY(2.2);
        this.launchStickyTrapOrDart(
          'Singularity Core',
          caster,
          originPos,
          lookDir,
          25.0,
          7.5,
          0x00f0ff,
          colliders,
          (impactPos) => {
            const centerPos = new THREE.Vector3(impactPos.x, Math.max(0.05, impactPos.y), impactPos.z);
            this.spawnSingularity(centerPos, caster);
            if (bots && onDamageBot) {
              for (const b of bots) {
                if (
                  b.player.team !== caster.team &&
                  b.player.isAlive &&
                  b.position.distanceTo(centerPos) < 11.5
                ) {
                  b.slowTimer = 3.0;
                  onDamageBot(b, 95, 'Singularity Crash', caster);
                }
              }
            }
          }
        );
        result.abilityBanner = 'SINGULARITY CRASH UNLEASHED';
        break;
      }

      // ======================================================================
      // 2. UMBRA (Recon)
      // ======================================================================
      case 'umbra_dart': {
        soundEngine.playAbility('sonar');
        this.launchStickyTrapOrDart(
          'Sonar Recon Dart',
          caster,
          originPos,
          lookDir,
          29.0,
          4.0,
          0xa855f7,
          colliders,
          (stickPos, surfaceNormal) => {
            const anchoredPos = stickPos.clone().addScaledVector(surfaceNormal, 0.12);
            this.spawnSonarDart(anchoredPos, caster);
            if (bots) {
              for (const b of bots) {
                if (
                  b.player.team !== caster.team &&
                  b.player.isAlive &&
                  b.position.distanceTo(anchoredPos) < 32
                ) {
                  this.revealedEnemyIds.add(b.player.id);
                  setTimeout(() => this.revealedEnemyIds.delete(b.player.id), 7500);
                  if (onDamageBot) {
                    onDamageBot(b, 25, 'Sonar Dart', caster);
                  }
                }
              }
            }
          }
        );
        result.abilityBanner = 'SONAR RECON DART LAUNCHED';
        break;
      }
      case 'umbra_drone': {
        soundEngine.playAbility('sonar');
        const droneStart = originPos.clone().addScaledVector(forwardFlat, 1.4).setY(1.85);
        this.spawnShadowHawkDrone(droneStart, yaw, caster, bots, onDamageBot);
        result.abilityBanner = 'SHADOW HAWK RECON DRONE AIRBORNE';
        break;
      }
      case 'umbra_mine': {
        soundEngine.playAbility('sonar');
        this.launchStickyTrapOrDart(
          'Sensor Web Trap',
          caster,
          originPos,
          lookDir,
          24.0,
          6.5,
          0xa855f7,
          colliders,
          (stickPos, surfaceNormal) => {
            const trapPos = this.physicsEngine.resolveSupportSurfacePosition(
              stickPos,
              surfaceNormal,
              0.18,
              colliders
            );
            this.spawnAoEZone(
              trapPos,
              5.5,
              32,
              0,
              12.0,
              0xa855f7,
              'Sensor Web',
              caster,
              true
            );
            if (bots) {
              for (const b of bots) {
                if (b.player.team !== caster.team && b.player.isAlive && b.position.distanceTo(trapPos) < 9.5) {
                  this.revealedEnemyIds.add(b.player.id);
                  setTimeout(() => this.revealedEnemyIds.delete(b.player.id), 7000);
                  b.slowTimer = 2.5;
                  if (onDamageBot) {
                    onDamageBot(b, 55, 'Sensor Web', caster);
                  }
                }
              }
            }
          }
        );
        result.abilityBanner = 'SENSOR WEB PROXIMITY MINE ARMED';
        break;
      }
      case 'umbra_ult': {
        soundEngine.playAbility('ultimate');
        this.isEnemiesRevealed = true;
        this.spawnKineticRing(originPos.clone(), 0xa855f7);
        setTimeout(() => {
          this.isEnemiesRevealed = false;
        }, 8500);
        if (bots && onDamageBot) {
          for (const b of bots) {
            if (b.player.team !== caster.team && b.player.isAlive && b.position.distanceTo(originPos) < 38) {
              this.revealedEnemyIds.add(b.player.id);
              onDamageBot(b, 35, 'All-Seeing Void', caster);
            }
          }
        }
        result.abilityBanner = 'ALL-SEEING VOID — ALL HOSTILES EXPOSED';
        break;
      }

      // ======================================================================
      // 3. CRYO (Control)
      // ======================================================================
      case 'cryo_wall': {
        soundEngine.playAbility('freeze');
        const wallPos = this.physicsEngine.resolveDeployableGroundPosition(
          originPos,
          lookDir,
          7.5,
          0.85,
          colliders
        );
        this.spawnIceWall(wallPos, yaw, colliders, caster);
        result.abilityBanner = 'GLACIAL RAMPART ERECTED';
        break;
      }
      case 'cryo_slick': {
        soundEngine.playAbility('freeze');
        this.launchBouncingOrdnance(
          'Sub-Zero Slick',
          caster,
          originPos,
          lookDir,
          19.5,
          2.6,
          0x38bdf8,
          1.4,
          true,
          colliders,
          (impactPos, impactNormal) => {
            const floorPos = this.physicsEngine.resolveSupportSurfacePosition(
              impactPos,
              impactNormal,
              0.18,
              colliders
            );
            this.spawnAoEZone(floorPos, 6.5, 36, 0, 8.5, 0x38bdf8, 'Sub-Zero Slick', caster, true);
          }
        );
        result.abilityBanner = 'SUB-ZERO FROST SLICK THROWN';
        break;
      }
      case 'cryo_cloud': {
        soundEngine.playAbility('freeze');
        this.launchBouncingOrdnance(
          'Cryo Smoke Orb',
          caster,
          originPos,
          lookDir,
          20.5,
          2.5,
          0x7dd3fc,
          1.2,
          true,
          colliders,
          (impactPos, impactNormal) => {
            const floorPos = this.physicsEngine.resolveSupportSurfacePosition(
              impactPos,
              impactNormal,
              0.18,
              colliders
            );
            this.spawnSmokeSphere(floorPos, 0x38bdf8, 14.0, caster, 24);
          }
        );
        result.abilityBanner = 'CRYO SMOKE ORB DEPLOYED';
        break;
      }
      case 'cryo_ult': {
        soundEngine.playAbility('ultimate');
        this.launchBouncingOrdnance(
          'Absolute Blizzard',
          caster,
          originPos,
          lookDir,
          21.0,
          2.8,
          0x0284c7,
          1.1,
          true,
          colliders,
          (impactPos, impactNormal) => {
            const floorPos = this.physicsEngine.resolveSupportSurfacePosition(
              impactPos,
              impactNormal,
              0.2,
              colliders
            );
            this.spawnAoEZone(
              floorPos,
              10.5,
              45,
              0,
              10.0,
              0x0284c7,
              'Absolute Blizzard',
              caster,
              true
            );
            this.spawnSmokeSphere(floorPos, 0x7dd3fc, 10.0, caster, 0);
            if (bots && onDamageBot) {
              for (const b of bots) {
                if (b.player.team !== caster.team && b.player.isAlive && b.position.distanceTo(floorPos) < 10.5) {
                  b.slowTimer = 3.5;
                  b.shootCooldown = 1.8;
                  onDamageBot(b, 55, 'Absolute Blizzard', caster);
                }
              }
            }
          }
        );
        result.abilityBanner = 'ABSOLUTE BLIZZARD STORM';
        break;
      }

      // ======================================================================
      // 4. BUNKER (Sentinel)
      // ======================================================================
      case 'bunker_barricade': {
        soundEngine.playAbility('shield');
        const barPos = this.physicsEngine.resolveDeployableGroundPosition(
          originPos,
          lookDir,
          5.5,
          0.7,
          colliders
        );
        this.spawnHardlightBarricade(barPos, yaw, colliders, caster);
        result.abilityBanner = 'HARDLIGHT BARRICADE DEPLOYED';
        break;
      }
      case 'bunker_turret': {
        soundEngine.playAbility('shield');
        const turretPos = this.physicsEngine.resolveDeployableGroundPosition(
          originPos,
          lookDir,
          5.0,
          0.6,
          colliders
        );
        this.spawnAutoTurret(turretPos, yaw, caster);
        result.abilityBanner = 'SENTINEL AUTO-CANNON ONLINE';
        break;
      }
      case 'bunker_tripwire': {
        soundEngine.playAbility('sonar');
        this.launchStickyTrapOrDart(
          'Concussion Tripbeam',
          caster,
          originPos,
          lookDir,
          22.0,
          9.5,
          0xfacc15,
          colliders,
          (stickPos, surfaceNormal) => {
            const span = this.physicsEngine.computeTripwireSpanCCD(stickPos, surfaceNormal, 6.0, colliders);
            this.spawnLaserBeam(span.start, span.end, 0xfacc15, 0.035, 14000);
            const trapPos = this.physicsEngine.resolveSupportSurfacePosition(
              stickPos,
              surfaceNormal,
              0.18,
              colliders
            );
            this.spawnAoEZone(
              trapPos,
              5.2,
              38,
              0,
              14.0,
              0xfacc15,
              'Concussion Tripbeam',
              caster,
              true
            );
            if (bots && onDamageBot) {
              for (const b of bots) {
                if (b.player.team !== caster.team && b.player.isAlive && b.position.distanceTo(trapPos) < 5.5) {
                  b.slowTimer = 2.5;
                  b.reactionTimer = -1.5;
                  onDamageBot(b, 55, 'Concussion Tripbeam', caster);
                }
              }
            }
          }
        );
        result.abilityBanner = 'CONCUSSION TRIPBEAM ARMED';
        break;
      }
      case 'bunker_ult': {
        soundEngine.playAbility('ultimate');
        caster.armor = caster.maxArmor;
        caster.health = Math.min(caster.maxHealth, caster.health + 45);
        this.spawnAegisDome(originPos.clone().setY(0), caster);
        result.abilityBanner = 'AEGIS FORTRESS SHIELD ACTIVE (+45 HP & FULL SHIELD)';
        break;
      }

      // ======================================================================
      // 5. AETHER (Support)
      // ======================================================================
      case 'aether_nanites': {
        soundEngine.playAbility('heal');
        caster.health = Math.min(caster.maxHealth, caster.health + 65);
        applyAlliedSupportToPlayer(originPos, 12.0, 45, 15);
        this.spawnAoEZone(
          originPos.clone().setY(0.05),
          6.5,
          0,
          30,
          6.5,
          0x10b981,
          'Nanite Infusion',
          caster
        );
        result.abilityBanner = 'NANITE INFUSION (+65 HP)';
        break;
      }
      case 'aether_stim': {
        soundEngine.playAbility('heal');
        caster.armor = Math.min(caster.maxArmor, caster.armor + 35);
        caster.health = Math.min(caster.maxHealth, caster.health + 25);
        applyAlliedSupportToPlayer(originPos, 12.0, 25, 30);
        result.speedBoost = 1.4;
        const mistPos = this.physicsEngine.resolveDeployableGroundPosition(
          originPos,
          lookDir,
          6.5,
          0.5,
          colliders
        );
        this.spawnAoEZone(
          mistPos,
          6.5,
          0,
          25,
          8.0,
          0xfbbf24,
          'Adrenaline Mist',
          caster
        );
        result.abilityBanner = 'ADRENALINE MIST (+40% SPEED & +35 SHIELD)';
        break;
      }
      case 'aether_ward': {
        soundEngine.playAbility('shield');
        caster.armor = caster.maxArmor;
        applyAlliedSupportToPlayer(originPos, 12.0, 20, 50);
        const pylonPos = this.physicsEngine.resolveDeployableGroundPosition(
          originPos,
          lookDir,
          5.5,
          0.55,
          colliders
        );
        this.spawnAoEZone(
          pylonPos,
          6.5,
          28,
          20,
          10.0,
          0x10b981,
          'Deflection Pylon',
          caster
        );
        result.abilityBanner = 'DEFLECTION PYLON DEPLOYED (SHIELD RESTORED)';
        break;
      }
      case 'aether_ult': {
        soundEngine.playAbility('ultimate');
        caster.health = caster.maxHealth;
        caster.armor = caster.maxArmor;
        applyAlliedSupportToPlayer(originPos, 24.0, 100, 50);
        // Revive any fallen teammate & heal all living teammates to full!
        let revivedCount = 0;
        if (bots) {
          for (const b of bots) {
            if (b.player.team === caster.team) {
              if (!b.player.isAlive) {
                b.player.isAlive = true;
                b.model.group.visible = true;
                b.model.group.rotation.x = 0;
                revivedCount++;
              }
              b.player.health = b.player.maxHealth;
              b.player.armor = b.player.maxArmor;
            }
          }
        }
        this.spawnAoEZone(
          originPos.clone().setY(0.05),
          11.0,
          0,
          38,
          8.5,
          0x34d399,
          'Nanite Resurgence',
          caster
        );
        result.abilityBanner =
          revivedCount > 0
            ? `NANITE RESURGENCE — ${revivedCount} ALLY REVIVED & SQUAD RESTORED!`
            : 'NANITE RESURGENCE — SQUAD FULL HP & SHIELD!';
        break;
      }

      // ======================================================================
      // 6. IGNIS (Assault)
      // ======================================================================
      case 'ignis_thermite': {
        soundEngine.playAbility('dash');
        this.launchBouncingOrdnance(
          'Thermite Canister',
          caster,
          originPos,
          lookDir,
          20.0,
          2.6,
          0xf97316,
          1.35,
          true,
          colliders,
          (impactPos, impactNormal) => {
            const floorPos = this.physicsEngine.resolveSupportSurfacePosition(
              impactPos,
              impactNormal,
              0.18,
              colliders
            );
            this.spawnAoEZone(floorPos, 6.0, 54, 0, 7.5, 0xf97316, 'Thermite Core', caster);
            if (bots && onDamageBot) {
              for (const b of bots) {
                if (b.player.team !== caster.team && b.player.isAlive && b.position.distanceTo(floorPos) < 6.0) {
                  onDamageBot(b, 35, 'Thermite Core', caster);
                }
              }
            }
          }
        );
        result.abilityBanner = 'THERMITE NAPALM CANISTER THROWN';
        break;
      }
      case 'ignis_wall': {
        soundEngine.playAbility('dash');
        const wallPos = this.physicsEngine.resolveDeployableGroundPosition(
          originPos,
          lookDir,
          8.0,
          0.7,
          colliders
        );
        this.spawnFirewall(wallPos, yaw, caster);
        result.abilityBanner = 'BLAZING FIREWALL CAST';
        break;
      }
      case 'ignis_flash': {
        soundEngine.playAbility('sonar');
        this.launchBouncingOrdnance(
          'Solar Flare',
          caster,
          originPos,
          lookDir,
          21.0,
          2.0,
          0xf97316,
          0.6,
          false,
          colliders,
          (impactPos) => {
            const flashPos = impactPos.clone().add(new THREE.Vector3(0, 0.35, 0));
            this.spawnFlashBurstMesh(flashPos, 0xf97316);
            this.applyFlashAndDamageWithLOS(
              flashPos,
              16.0,
              48,
              'Solar Flare',
              caster,
              colliders,
              bots,
              onDamageBot
            );
          }
        );
        result.abilityBanner = 'SOLAR FLARE FLASH THROWN';
        break;
      }
      case 'ignis_ult': {
        soundEngine.playAbility('ultimate');
        const desiredEnd = originPos.clone().addScaledVector(lookDir, 38);
        const beamCheck = this.physicsEngine.sweepSphereCCD(originPos, desiredEnd, 0.18, colliders);
        const endPt = beamCheck.hit ? beamCheck.point : desiredEnd;

        this.spawnLaserBeam(
          originPos.clone().add(new THREE.Vector3(0, -0.1, 0)),
          endPt,
          0xf97316,
          0.42,
          950
        );
        if (bots && onDamageBot) {
          const maxBeamDist = originPos.distanceTo(endPt);
          const ray = new THREE.Ray(originPos, lookDir.clone().normalize());
          for (const b of bots) {
            if (b.player.team !== caster.team && b.player.isAlive) {
              if (originPos.distanceTo(b.position) <= maxBeamDist + 2.0) {
                const pt = new THREE.Vector3();
                ray.closestPointToPoint(b.position.clone().add(new THREE.Vector3(0, 1, 0)), pt);
                if (pt.distanceTo(b.position.clone().add(new THREE.Vector3(0, 1, 0))) < 3.2) {
                  onDamageBot(b, 145, 'Supernova Beam', caster);
                }
              }
            }
          }
        }
        result.abilityBanner = 'SUPERNOVA PLASMA BEAM (145 DMG)';
        break;
      }

      // ======================================================================
      // 7. MIRAGE (Control)
      // ======================================================================
      case 'mirage_clone': {
        soundEngine.playAbility('sonar');
        const clonePos = this.physicsEngine.resolveDeployableGroundPosition(
          originPos,
          forwardFlat,
          2.2,
          0.45,
          colliders
        );
        this.spawnHologramClone(clonePos, yaw, caster);
        result.abilityBanner = 'PHANTOM DECOY DEPLOYED';
        break;
      }
      case 'mirage_smoke': {
        soundEngine.playAbility('sonar');
        this.launchBouncingOrdnance(
          'Prism Smoke',
          caster,
          originPos,
          lookDir,
          20.5,
          2.4,
          0xdb2777,
          1.15,
          true,
          colliders,
          (impactPos, impactNormal) => {
            const floorPos = this.physicsEngine.resolveSupportSurfacePosition(
              impactPos,
              impactNormal,
              0.18,
              colliders
            );
            this.spawnSmokeSphere(floorPos, 0xdb2777, 15.0, caster, 24);
          }
        );
        result.abilityBanner = 'PRISM ECLIPSE SMOKE THROWN';
        break;
      }
      case 'mirage_swap': {
        soundEngine.playAbility('dash');
        caster.armor = Math.min(caster.maxArmor, caster.armor + 30);
        caster.health = Math.min(caster.maxHealth, caster.health + 25);
        result.dashVelocity = forwardFlat.clone().multiplyScalar(-19.0).setY(2.2);
        this.spawnKineticRing(originPos.clone(), 0xec4899);
        if (bots && onDamageBot) {
          for (const b of bots) {
            if (b.player.team !== caster.team && b.player.isAlive && b.position.distanceTo(originPos) < 6.5) {
              onDamageBot(b, 45, 'Phase Swap', caster);
            }
          }
        }
        result.abilityBanner = 'PHASE SWAP RETREAT (+30 SHIELD)';
        break;
      }
      case 'mirage_ult': {
        soundEngine.playAbility('ultimate');
        caster.armor = caster.maxArmor;
        for (let a = -0.5; a <= 0.5; a += 0.33) {
          const cloneDir = forwardFlat.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
          const safePos = this.physicsEngine.resolveDeployableGroundPosition(
            originPos,
            cloneDir,
            2.0,
            0.42,
            colliders
          );
          this.spawnHologramClone(safePos, yaw + a, caster);
        }
        result.speedBoost = 1.45;
        result.abilityBanner = 'HALL OF MIRRORS ACTIVE';
        break;
      }

      // ======================================================================
      // 8. ROOK (Sentinel)
      // ======================================================================
      case 'rook_gravmine': {
        soundEngine.playAbility('sonar');
        this.launchStickyTrapOrDart(
          'Gravity Snare',
          caster,
          originPos,
          lookDir,
          21.5,
          9.0,
          0x38bdf8,
          colliders,
          (stickPos) => {
            const snarePos = new THREE.Vector3(stickPos.x, Math.max(0.05, stickPos.y), stickPos.z);
            this.spawnSingularity(snarePos, caster);
            if (bots && onDamageBot) {
              for (const b of bots) {
                if (b.player.team !== caster.team && b.player.isAlive && b.position.distanceTo(snarePos) < 8.5) {
                  b.slowTimer = 2.5;
                  onDamageBot(b, 40, 'Gravity Snare', caster);
                }
              }
            }
          }
        );
        result.abilityBanner = 'GRAVITY SNARE DEPLOYED';
        break;
      }
      case 'rook_suppression': {
        soundEngine.playAbility('shield');
        caster.armor = Math.min(caster.maxArmor, caster.armor + 40);
        this.spawnAoEZone(
          originPos.clone().setY(0.05),
          7.5,
          32,
          0,
          10.0,
          0x64748b,
          'Suppressor Field',
          caster,
          true
        );
        result.abilityBanner = 'SUPPRESSOR FIELD ACTIVE (+40 SHIELD)';
        break;
      }
      case 'rook_shockplate': {
        soundEngine.playAbility('shield');
        const doorPos = this.physicsEngine.resolveDeployableGroundPosition(
          originPos,
          lookDir,
          5.5,
          0.7,
          colliders
        );
        this.spawnHardlightBarricade(doorPos, yaw, colliders, caster);
        result.abilityBanner = 'RIOT BLAST DOOR LOCKED';
        break;
      }
      case 'rook_ult': {
        soundEngine.playAbility('ultimate');
        const strikePos = this.physicsEngine.resolveDeployableGroundPosition(
          originPos,
          lookDir,
          18.0,
          0.8,
          colliders
        );
        this.spawnOrbitalStrike(strikePos, caster);
        if (bots && onDamageBot) {
          for (const b of bots) {
            if (
              b.player.team !== caster.team &&
              b.player.isAlive &&
              b.position.distanceTo(strikePos) < 10.5
            ) {
              b.slowTimer = 3.0;
              onDamageBot(b, 115, 'Orbital Lockdown', caster);
            }
          }
        }
        result.abilityBanner = 'ORBITAL LANCE STRIKE (115 DMG)';
        break;
      }

      // ======================================================================
      // 9. KAGE (Assault)
      // ======================================================================
      case 'kage_shuriken': {
        soundEngine.playAbility('dash');
        // 3-Blade Shuriken Fan Barrage
        const hitBotsInVolley = new Set<string>();
        for (const spreadAngle of [-0.055, 0, 0.055]) {
          const bladeDir = lookDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngle).normalize();
          const desiredEnd = originPos.clone().addScaledVector(bladeDir, 34);
          const ccdCheck = this.physicsEngine.sweepSphereCCD(
            originPos,
            desiredEnd,
            0.14,
            colliders,
            bots,
            caster.team
          );
          const endPt = ccdCheck.hit ? ccdCheck.point : desiredEnd;
          this.spawnLaserBeam(
            originPos.clone().add(new THREE.Vector3(0, -0.1, 0)),
            endPt,
            0xef4444,
            0.07,
            260
          );
          if (ccdCheck.hitBot && onDamageBot) {
            hitBotsInVolley.add(ccdCheck.hitBot.player.id);
            onDamageBot(ccdCheck.hitBot, 55, 'Shuriken Barrage', caster);
          } else if (bots && onDamageBot) {
            const maxLen = originPos.distanceTo(endPt);
            const ray = new THREE.Ray(originPos, bladeDir);
            for (const b of bots) {
              if (
                b.player.team !== caster.team &&
                b.player.isAlive &&
                !hitBotsInVolley.has(b.player.id) &&
                originPos.distanceTo(b.position) <= maxLen
              ) {
                const pt = new THREE.Vector3();
                ray.closestPointToPoint(b.position.clone().add(new THREE.Vector3(0, 1.1, 0)), pt);
                if (pt.distanceTo(b.position.clone().add(new THREE.Vector3(0, 1.1, 0))) < 2.3) {
                  hitBotsInVolley.add(b.player.id);
                  onDamageBot(b, 85, 'Shuriken Barrage', caster);
                }
              }
            }
          }
        }
        result.abilityBanner = 'SHURIKEN 3-BLADE BARRAGE';
        break;
      }
      case 'kage_fade': {
        soundEngine.playAbility('dash');
        caster.health = Math.min(caster.maxHealth, caster.health + 30);
        result.dashVelocity = forwardFlat.clone().multiplyScalar(23.0).setY(1.8);
        result.invulnerableTime = 2.0;
        result.speedBoost = 1.4;
        this.spawnKineticRing(originPos.clone(), 0xef4444);
        result.abilityBanner = 'MIST STEP PHASE DASH (+30 HP)';
        break;
      }
      case 'kage_smokescreen': {
        soundEngine.playAbility('sonar');
        this.launchBouncingOrdnance(
          'Obsidian Veil',
          caster,
          originPos,
          lookDir,
          20.0,
          2.2,
          0xef4444,
          1.1,
          true,
          colliders,
          (impactPos, impactNormal) => {
            const floorPos = this.physicsEngine.resolveSupportSurfacePosition(
              impactPos,
              impactNormal,
              0.18,
              colliders
            );
            this.spawnSmokeSphere(floorPos, 0x1e293b, 12.0, caster, 22);
          }
        );
        result.abilityBanner = 'OBSIDIAN VEIL SMOKE THROWN';
        break;
      }
      case 'kage_ult': {
        soundEngine.playAbility('ultimate');
        const desiredEnd = originPos.clone().addScaledVector(lookDir, 34);
        const ccdCheck = this.physicsEngine.sweepSphereCCD(originPos, desiredEnd, 0.2, colliders);
        const endPt = ccdCheck.hit ? ccdCheck.point : desiredEnd;
        this.spawnLaserBeam(originPos.clone(), endPt, 0xdc2626, 0.28, 500);
        result.dashVelocity = forwardFlat.clone().multiplyScalar(21.0).setY(3.0);
        if (bots && onDamageBot) {
          const maxLen = originPos.distanceTo(endPt);
          const ray = new THREE.Ray(originPos, lookDir.clone().normalize());
          for (const b of bots) {
            if (b.player.team !== caster.team && b.player.isAlive && originPos.distanceTo(b.position) <= maxLen + 2) {
              const pt = new THREE.Vector3();
              ray.closestPointToPoint(b.position.clone().add(new THREE.Vector3(0, 1.1, 0)), pt);
              if (pt.distanceTo(b.position.clone().add(new THREE.Vector3(0, 1.1, 0))) < 3.4) {
                onDamageBot(b, 160, 'Blade of the Eclipse', caster);
              }
            }
          }
        }
        result.abilityBanner = 'BLADE OF THE ECLIPSE (160 DMG)';
        break;
      }

      // ======================================================================
      // 10. PULSE (Recon)
      // ======================================================================
      case 'pulse_tracker': {
        soundEngine.playAbility('sonar');
        this.launchStickyTrapOrDart(
          'EM Tracker Dart',
          caster,
          originPos,
          lookDir,
          28.0,
          4.2,
          0x06b6d4,
          colliders,
          (stickPos, surfaceNormal) => {
            const scanPos = stickPos.clone().addScaledVector(surfaceNormal, 0.12);
            this.spawnSonarDart(scanPos, caster);
            if (bots && onDamageBot) {
              for (const b of bots) {
                if (
                  b.player.team !== caster.team &&
                  b.player.isAlive &&
                  b.position.distanceTo(scanPos) < 28
                ) {
                  this.revealedEnemyIds.add(b.player.id);
                  setTimeout(() => this.revealedEnemyIds.delete(b.player.id), 7500);
                  onDamageBot(b, 45, 'Acoustic Tag', caster);
                }
              }
            }
          }
        );
        result.abilityBanner = 'ACOUSTIC TAG TRACKER LAUNCHED';
        break;
      }
      case 'pulse_jammer': {
        soundEngine.playAbility('sonar');
        const jammerPos = this.physicsEngine.resolveDeployableGroundPosition(
          originPos,
          lookDir,
          9.5,
          0.55,
          colliders
        );
        this.spawnAoEZone(
          jammerPos,
          8.5,
          32,
          0,
          12.0,
          0x06b6d4,
          'Signal Jammer',
          caster,
          true
        );
        if (bots) {
          for (const b of bots) {
            if (b.player.team !== caster.team && b.player.isAlive && b.position.distanceTo(jammerPos) < 18) {
              b.reactionTimer = -2.2;
              b.slowTimer = 2.0;
              this.revealedEnemyIds.add(b.player.id);
              setTimeout(() => this.revealedEnemyIds.delete(b.player.id), 6000);
            }
          }
        }
        result.abilityBanner = 'SIGNAL JAMMER DEPLOYED (ENEMY HUD SCRAMBLED)';
        break;
      }
      case 'pulse_flash': {
        soundEngine.playAbility('sonar');
        this.launchBouncingOrdnance(
          'Strobe Flash',
          caster,
          originPos,
          lookDir,
          21.5,
          2.0,
          0x06b6d4,
          0.6,
          false,
          colliders,
          (impactPos) => {
            const flashPos = impactPos.clone().add(new THREE.Vector3(0, 0.35, 0));
            this.spawnFlashBurstMesh(flashPos, 0x06b6d4);
            this.applyFlashAndDamageWithLOS(
              flashPos,
              16.0,
              42,
              'Strobe Flash',
              caster,
              colliders,
              bots,
              onDamageBot
            );
          }
        );
        result.abilityBanner = 'STROBE FLASH DETONATED';
        break;
      }
      case 'pulse_ult': {
        soundEngine.playAbility('ultimate');
        this.isEnemiesRevealed = true;
        setTimeout(() => {
          this.isEnemiesRevealed = false;
        }, 8500);
        this.spawnKineticRing(originPos.clone(), 0x06b6d4);
        if (bots && onDamageBot) {
          for (const b of bots) {
            if (b.player.team !== caster.team && b.player.isAlive && b.position.distanceTo(originPos) < 32) {
              b.player.armor = 0;
              b.slowTimer = 2.5;
              b.abilityCooldown = 12.0;
              onDamageBot(b, 60, 'EMP Storm', caster);
            }
          }
        }
        result.abilityBanner = 'EMP STORM — ENEMY SHIELDS SHATTERED (60 DMG)';
        break;
      }

      // ======================================================================
      // 11. FLORA (Support)
      // ======================================================================
      case 'flora_bramble': {
        soundEngine.playAbility('freeze');
        this.launchBouncingOrdnance(
          'Entangling Vines',
          caster,
          originPos,
          lookDir,
          19.5,
          2.6,
          0x65a30d,
          1.3,
          true,
          colliders,
          (impactPos, impactNormal) => {
            const floorPos = this.physicsEngine.resolveSupportSurfacePosition(
              impactPos,
              impactNormal,
              0.18,
              colliders
            );
            this.spawnAoEZone(
              floorPos,
              6.5,
              38,
              0,
              8.5,
              0x65a30d,
              'Entangling Vines',
              caster,
              true
            );
            if (bots && onDamageBot) {
              for (const b of bots) {
                if (b.player.team !== caster.team && b.player.isAlive && b.position.distanceTo(floorPos) < 6.5) {
                  b.slowTimer = 3.0;
                  onDamageBot(b, 35, 'Entangling Vines', caster);
                }
              }
            }
          }
        );
        result.abilityBanner = 'ENTANGLING VINES LAUNCHED';
        break;
      }
      case 'flora_spores': {
        soundEngine.playAbility('heal');
        caster.health = Math.min(caster.maxHealth, caster.health + 55);
        applyAlliedSupportToPlayer(originPos, 12.0, 40, 15);
        this.spawnAoEZone(
          originPos.clone().setY(0.05),
          7.5,
          0,
          32,
          7.5,
          0x84cc16,
          'Restorative Spores',
          caster
        );
        result.abilityBanner = 'RESTORATIVE SPORE CLOUD (+55 HP)';
        break;
      }
      case 'flora_bark': {
        soundEngine.playAbility('shield');
        caster.armor = caster.maxArmor;
        caster.health = Math.min(caster.maxHealth, caster.health + 30);
        applyAlliedSupportToPlayer(originPos, 14.0, 30, 50);
        if (bots) {
          for (const b of bots) {
            if (b.player.team === caster.team && b.player.isAlive && b.position.distanceTo(originPos) < 12) {
              b.player.armor = b.player.maxArmor;
              b.player.health = Math.min(b.player.maxHealth, b.player.health + 30);
            }
          }
        }
        this.spawnKineticRing(originPos.clone(), 0x84cc16);
        result.abilityBanner = 'IRONWOOD BARK ARMOR (+50 SHIELD & +30 HP)';
        break;
      }
      case 'flora_ult': {
        soundEngine.playAbility('ultimate');
        caster.health = caster.maxHealth;
        caster.armor = caster.maxArmor;
        this.launchBouncingOrdnance(
          'Verdant Seed',
          caster,
          originPos,
          lookDir,
          20.0,
          2.8,
          0x4ade80,
          1.15,
          true,
          colliders,
          (impactPos, impactNormal) => {
            const floorPos = this.physicsEngine.resolveSupportSurfacePosition(
              impactPos,
              impactNormal,
              0.18,
              colliders
            );
            this.spawnAoEZone(
              floorPos,
              10.5,
              42,
              32,
              10.0,
              0x4ade80,
              'Verdant Overgrowth',
              caster,
              true
            );
            if (bots && onDamageBot) {
              for (const b of bots) {
                if (b.player.team !== caster.team && b.player.isAlive && b.position.distanceTo(floorPos) < 10.5) {
                  b.slowTimer = 3.0;
                  onDamageBot(b, 50, 'Verdant Overgrowth', caster);
                }
              }
            }
          }
        );
        result.abilityBanner = 'VERDANT OVERGROWTH UNLEASHED';
        break;
      }

      // ======================================================================
      // 12. TITAN (Control)
      // ======================================================================
      case 'titan_shockwave': {
        soundEngine.playAbility('ultimate');
        this.launchBouncingOrdnance(
          'Tectonic Charge',
          caster,
          originPos,
          lookDir,
          19.0,
          2.5,
          0xd97706,
          1.0,
          true,
          colliders,
          (impactPos, impactNormal) => {
            const floorPos = this.physicsEngine.resolveSupportSurfacePosition(
              impactPos,
              impactNormal,
              0.18,
              colliders
            );
            this.spawnAoEZone(floorPos, 7.0, 48, 0, 5.5, 0xd97706, 'Tectonic Slam', caster, true);
            if (bots && onDamageBot) {
              for (const b of bots) {
                if (
                  b.player.team !== caster.team &&
                  b.player.isAlive &&
                  b.position.distanceTo(floorPos) < 8.5
                ) {
                  b.slowTimer = 2.5;
                  b.reactionTimer = -1.2;
                  onDamageBot(b, 75, 'Tectonic Slam', caster);
                }
              }
            }
          }
        );
        result.abilityBanner = 'TECTONIC SEISMIC SLAM (75 DMG)';
        break;
      }
      case 'titan_barricade': {
        soundEngine.playAbility('shield');
        const wallPos = this.physicsEngine.resolveDeployableGroundPosition(
          originPos,
          lookDir,
          6.5,
          0.85,
          colliders
        );
        this.spawnIceWall(wallPos, yaw, colliders, caster, 0x92400e);
        result.abilityBanner = 'TECTONIC RUBBLE WALL';
        break;
      }
      case 'titan_dust': {
        soundEngine.playAbility('sonar');
        this.launchBouncingOrdnance(
          'Sandstorm Mortar',
          caster,
          originPos,
          lookDir,
          20.5,
          2.6,
          0xd97706,
          1.2,
          true,
          colliders,
          (impactPos, impactNormal) => {
            const floorPos = this.physicsEngine.resolveSupportSurfacePosition(
              impactPos,
              impactNormal,
              0.18,
              colliders
            );
            this.spawnSmokeSphere(floorPos, 0xd97706, 12.0, caster, 28);
          }
        );
        result.abilityBanner = 'SANDSTORM MORTAR LAUNCHED';
        break;
      }
      case 'titan_ult': {
        soundEngine.playAbility('ultimate');
        // 3-Stage Cascading Cataclysm Earthquake along forward look vector
        for (const distStage of [7.0, 13.5, 20.0]) {
          const quakePos = this.physicsEngine.resolveDeployableGroundPosition(
            originPos,
            lookDir,
            distStage,
            0.8,
            colliders
          );
          this.spawnAoEZone(quakePos, 7.5, 45, 0, 7.5, 0xb45309, 'Cataclysm Quake', caster, true);
          if (bots && onDamageBot) {
            for (const b of bots) {
              if (
                b.player.team !== caster.team &&
                b.player.isAlive &&
                b.position.distanceTo(quakePos) < 8.5
              ) {
                b.slowTimer = 3.0;
                b.reactionTimer = -1.5;
                onDamageBot(b, 115, 'Cataclysm Quake', caster);
              }
            }
          }
        }
        result.abilityBanner = 'CATACLYSM 3-STAGE EARTHQUAKE (115 DMG)';
        break;
      }

      default: {
        soundEngine.playAbility('dash');
        const defaultPos = this.physicsEngine.resolveDeployableGroundPosition(
          originPos,
          lookDir,
          12.0,
          0.5,
          colliders
        );
        this.spawnAoEZone(defaultPos, 5.5, 38, 0, 6.0, 0x00f0ff, agent.ability1.name, caster);
        result.abilityBanner = `${agent.ability1.name.toUpperCase()} ACTIVATED`;
      }
    }

    return {
      ...result,
      // Trigger enemy-only hit check on player when an Omega bot casts an offensive burst ability
      ...(() => {
        if (caster.team === 'omega') {
          checkEnemyAbilityHitOnPlayer(originPos.clone().addScaledVector(forwardFlat, 7.0), 6.5, 40, agent.ability1.name);
        }
        return {};
      })()
    };
  }

  /**
   * Verifies Continuous Collision Detection Line-of-Sight from a detonating Flashbang
   * to each enemy bot (and player if cast by an enemy bot) so walls block flashbangs realistically!
   */
  private applyFlashAndDamageWithLOS(
    flashPos: THREE.Vector3,
    radius: number,
    damage: number,
    abilityName: string,
    caster: MatchPlayer,
    colliders: MapCollider[],
    bots?: BotState[],
    onDamageBot?: (bot: BotState, damage: number, abilityName: string, attacker?: MatchPlayer) => void
  ) {
    if (!bots || !onDamageBot) return;
    for (const b of bots) {
      // Strictly never flash or damage bots on the same team as the caster
      if (b.player.team !== caster.team && b.player.isAlive) {
        const dist = b.position.distanceTo(flashPos);
        if (dist <= radius) {
          const botEye = b.position.clone().add(new THREE.Vector3(0, 1.5, 0));
          const los = this.physicsEngine.sweepSphereCCD(flashPos, botEye, 0.05, colliders);
          if (!los.hit) {
            b.reactionTimer = -2.8;
            b.slowTimer = 2.0;
            onDamageBot(b, damage, abilityName, caster);
          }
        }
      }
    }
  }

  // ==========================================================================
  // 3D ABILITY MESH & RECON MARKER SPAWNERS
  // ==========================================================================

  private createReconTargetMarker(): THREE.Group {
    const group = new THREE.Group();
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e, depthTest: false })
    );
    diamond.renderOrder = 999;
    group.add(diamond);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.36, 0.44, 16),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        side: THREE.DoubleSide,
        depthTest: false
      })
    );
    ring.renderOrder = 999;
    group.add(ring);
    return group;
  }

  private spawnShadowHawkDrone(
    pos: THREE.Vector3,
    yaw: number,
    caster: MatchPlayer,
    bots?: BotState[],
    onDamageBot?: (bot: BotState, damage: number, abilityName: string, attacker?: MatchPlayer) => void
  ) {
    const droneGroup = new THREE.Group();
    droneGroup.position.copy(pos);
    droneGroup.rotation.y = yaw;

    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.85, 6),
      new THREE.MeshStandardMaterial({ color: 0x2e1065, roughness: 0.3, metalness: 0.8 })
    );
    body.rotation.x = -Math.PI / 2;
    droneGroup.add(body);

    const wings = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.05, 0.32),
      new THREE.MeshBasicMaterial({ color: 0xa855f7 })
    );
    droneGroup.add(wings);

    const scanRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.65, 16),
      new THREE.MeshBasicMaterial({ color: 0xc084fc, side: THREE.DoubleSide })
    );
    scanRing.rotation.x = Math.PI / 2;
    droneGroup.add(scanRing);

    this.scene.add(droneGroup);

    let moveDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const taggedIds = new Set<string>();

    this.entities.push({
      id: Math.random().toString(),
      type: 'recon_drone',
      name: 'Shadow Hawk',
      ownerId: caster.id,
      caster,
      team: caster.team,
      position: pos,
      radius: 16.0,
      dps: 0,
      mesh: droneGroup,
      duration: 6.5,
      timeAlive: 0,
      tickAccum: 0,
      onTick: (dt, colliders) => {
        const step = this.physicsEngine.stepKinematicEntityCCD(
          droneGroup.position,
          moveDir,
          9.5,
          0.4,
          dt,
          colliders
        );
        droneGroup.position.copy(step.nextPos);
        moveDir = step.nextDir;
        droneGroup.rotation.y = Math.atan2(-moveDir.x, -moveDir.z);
        pos.copy(droneGroup.position);

        if (bots) {
          for (const b of bots) {
            if (
              b.player.team !== caster.team &&
              b.player.isAlive &&
              !taggedIds.has(b.player.id) &&
              b.position.distanceTo(droneGroup.position) < 16.0
            ) {
              taggedIds.add(b.player.id);
              this.revealedEnemyIds.add(b.player.id);
              setTimeout(() => this.revealedEnemyIds.delete(b.player.id), 7500);
              if (onDamageBot) {
                onDamageBot(b, 35, 'Shadow Hawk', caster);
              }
            }
          }
        }
      }
    });
  }

  private spawnLaserBeam(
    start: THREE.Vector3,
    end: THREE.Vector3,
    colorHex: number,
    thickness = 0.05,
    durationMs = 140
  ) {
    const dist = Math.max(0.1, start.distanceTo(end));
    const geom = new THREE.CylinderGeometry(thickness, thickness, dist, 8);
    geom.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9
    });
    const beam = new THREE.Mesh(geom, mat);
    beam.position.copy(start).lerp(end, 0.5);
    beam.lookAt(end);
    this.scene.add(beam);
    setTimeout(() => {
      this.scene.remove(beam);
      geom.dispose();
      mat.dispose();
    }, durationMs);
  }

  private spawnFlashBurstMesh(pos: THREE.Vector3, colorHex: number) {
    const group = new THREE.Group();
    group.position.copy(pos);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 16, 16),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85 })
    );
    group.add(sphere);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.4, 0.14, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    this.scene.add(group);
    setTimeout(() => {
      this.scene.remove(group);
    }, 380);
  }

  private spawnKineticRing(pos: THREE.Vector3, colorHex: number) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.08, 8, 24),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85 })
    );
    ring.position.copy(pos);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);

    this.entities.push({
      id: Math.random().toString(),
      type: 'kinetic_ring',
      name: 'Kinetic Pulse',
      ownerId: '',
      team: 'alpha',
      position: pos,
      radius: 2.5,
      dps: 0,
      mesh: ring,
      duration: 0.55,
      timeAlive: 0,
      tickAccum: 0,
      onTick: (dt) => {
        ring.scale.addScalar(dt * 4.8);
      }
    });
  }

  private spawnAoEZone(
    pos: THREE.Vector3,
    radius: number,
    dps: number,
    healPerSec: number,
    duration: number,
    colorHex: number,
    name: string,
    caster: MatchPlayer,
    slowBots = false
  ) {
    const group = new THREE.Group();
    group.position.copy(pos);

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.14, 28),
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.45
      })
    );
    group.add(disc);

    const rim = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.28, radius, 32),
      new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95
      })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.09;
    group.add(rim);

    const pulseRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.72, 0.07, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
    );
    pulseRing.rotation.x = Math.PI / 2;
    pulseRing.position.y = 0.4;
    group.add(pulseRing);

    this.scene.add(group);

    this.entities.push({
      id: Math.random().toString(),
      type: 'aoe_zone',
      name,
      ownerId: caster.id,
      caster,
      team: caster.team,
      position: pos,
      radius,
      dps,
      healPerSec,
      slowBots,
      mesh: group,
      duration,
      timeAlive: 0,
      tickAccum: 0,
      onTick: (dt) => {
        rim.rotation.z += dt * 1.8;
        pulseRing.position.y = 0.25 + ((Date.now() * 0.002) % 1.4);
      }
    });
  }

  private spawnOrbitalStrike(pos: THREE.Vector3, caster: MatchPlayer) {
    const group = new THREE.Group();
    group.position.copy(pos);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.4, 34, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.55
      })
    );
    pillar.position.y = 17;
    group.add(pillar);

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 34, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.92
      })
    );
    core.position.y = 17;
    group.add(core);

    this.scene.add(group);

    this.entities.push({
      id: Math.random().toString(),
      type: 'orbital_strike',
      name: 'Orbital Lockdown',
      ownerId: caster.id,
      caster,
      team: caster.team,
      position: pos,
      radius: 7.5,
      dps: 50,
      slowBots: true,
      mesh: group,
      duration: 5.5,
      timeAlive: 0,
      tickAccum: 0,
      onTick: (dt) => {
        pillar.rotation.y += dt * 4;
      }
    });
  }

  private spawnAegisDome(pos: THREE.Vector3, caster: MatchPlayer) {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(7.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        wireframe: true,
        transparent: true,
        opacity: 0.68
      })
    );
    dome.position.copy(pos);
    this.scene.add(dome);

    this.entities.push({
      id: Math.random().toString(),
      type: 'aegis_dome',
      name: 'Aegis Fortress',
      ownerId: caster.id,
      caster,
      team: caster.team,
      position: pos,
      radius: 7.2,
      dps: 36,
      healPerSec: 24,
      mesh: dome,
      duration: 12.0,
      timeAlive: 0,
      tickAccum: 0
    });
  }

  private spawnIceWall(
    pos: THREE.Vector3,
    yaw: number,
    colliders: MapCollider[],
    caster: MatchPlayer,
    colorHex = 0x38bdf8
  ) {
    const wallGroup = new THREE.Group();
    wallGroup.position.copy(pos);
    wallGroup.rotation.y = yaw;

    const iceMat = new THREE.MeshPhysicalMaterial({
      color: colorHex,
      roughness: 0.15,
      metalness: 0.1,
      transmission: colorHex === 0x38bdf8 ? 0.65 : 0.1,
      transparent: true,
      opacity: 0.92
    });

    const boxGeom = new THREE.BoxGeometry(5.8, 3.6, 0.95);
    const mesh = new THREE.Mesh(boxGeom, iceMat);
    mesh.position.y = 1.8;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    wallGroup.add(mesh);

    this.scene.add(wallGroup);

    const box = new THREE.Box3().setFromObject(wallGroup);
    const collider: MapCollider = { box, mesh: wallGroup, isCover: true, isWall: true };
    colliders.push(collider);

    this.entities.push({
      id: Math.random().toString(),
      type: 'ice_wall',
      name: 'Glacial Rampart',
      ownerId: caster.id,
      caster,
      team: caster.team,
      position: pos,
      radius: 3.0,
      dps: 0,
      mesh: wallGroup,
      collider,
      duration: 16.0,
      timeAlive: 0,
      tickAccum: 0
    });
  }

  private spawnHardlightBarricade(
    pos: THREE.Vector3,
    yaw: number,
    colliders: MapCollider[],
    caster: MatchPlayer
  ) {
    const barGroup = new THREE.Group();
    barGroup.position.copy(pos);
    barGroup.rotation.y = yaw;

    const shieldMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      roughness: 0.2,
      metalness: 0.4,
      transparent: true,
      opacity: 0.78,
      transmission: 0.45
    });

    const geom = new THREE.BoxGeometry(4.0, 2.0, 0.28);
    const mesh = new THREE.Mesh(geom, shieldMat);
    mesh.position.y = 1.0;
    mesh.castShadow = true;
    barGroup.add(mesh);

    this.scene.add(barGroup);

    const box = new THREE.Box3().setFromObject(barGroup);
    const collider: MapCollider = { box, mesh: barGroup, isCover: true, isWall: true };
    colliders.push(collider);

    this.entities.push({
      id: Math.random().toString(),
      type: 'hardlight_barricade',
      name: 'Hardlight Barricade',
      ownerId: caster.id,
      caster,
      team: caster.team,
      position: pos,
      radius: 2.2,
      dps: 0,
      mesh: barGroup,
      collider,
      duration: 20.0,
      timeAlive: 0,
      tickAccum: 0
    });
  }

  private spawnAutoTurret(pos: THREE.Vector3, yaw: number, caster: MatchPlayer) {
    const turretGroup = new THREE.Group();
    turretGroup.position.copy(pos);
    turretGroup.rotation.y = yaw;

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.9 });
    const laserMat = new THREE.MeshBasicMaterial({ color: caster.team === 'alpha' ? 0x00f0ff : 0xef4444 });

    const tripod = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.48, 0.68, 6), baseMat);
    tripod.position.y = 0.34;
    turretGroup.add(tripod);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.58), headMat);
    head.position.y = 0.78;
    turretGroup.add(head);

    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.45, 8), laserMat);
    b1.rotation.x = Math.PI / 2;
    b1.position.set(-0.1, 0.78, 0.35);
    turretGroup.add(b1);

    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.45, 8), laserMat);
    b2.rotation.x = Math.PI / 2;
    b2.position.set(0.1, 0.78, 0.35);
    turretGroup.add(b2);

    this.scene.add(turretGroup);

    this.entities.push({
      id: Math.random().toString(),
      type: 'auto_turret',
      name: 'Sentinel Turret',
      ownerId: caster.id,
      caster,
      team: caster.team,
      position: pos,
      radius: 26.0,
      dps: 0,
      mesh: turretGroup,
      duration: 28.0,
      timeAlive: 0,
      tickAccum: 0
    });
  }

  private spawnFirewall(pos: THREE.Vector3, yaw: number, caster: MatchPlayer) {
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xea580c,
      transparent: true,
      opacity: 0.85
    });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(10.5, 3.5, 0.6), fireMat);
    wall.position.copy(pos).setY(1.75);
    wall.rotation.y = yaw;
    this.scene.add(wall);

    this.entities.push({
      id: Math.random().toString(),
      type: 'firewall',
      name: 'Firewall',
      ownerId: caster.id,
      caster,
      team: caster.team,
      position: pos,
      radius: 5.8,
      dps: 50,
      blocksVision: true,
      mesh: wall,
      duration: 8.5,
      timeAlive: 0,
      tickAccum: 0
    });
  }

  private spawnSonarDart(pos: THREE.Vector3, caster: MatchPlayer) {
    const dartGroup = new THREE.Group();
    dartGroup.position.copy(pos);

    const dart = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xa855f7 })
    );
    dartGroup.add(dart);

    const ring = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        wireframe: true,
        transparent: true,
        opacity: 0.6
      })
    );
    dartGroup.add(ring);

    this.scene.add(dartGroup);

    this.entities.push({
      id: Math.random().toString(),
      type: 'sonar_dart',
      name: 'Sonar Recon',
      ownerId: caster.id,
      caster,
      team: caster.team,
      position: pos,
      radius: 24.0,
      dps: 0,
      mesh: dartGroup,
      duration: 9.0,
      timeAlive: 0,
      tickAccum: 0,
      onTick: () => {
        const s = 1.0 + ((Date.now() * 0.005) % 12);
        ring.scale.set(s, s, s);
      }
    });
  }

  private spawnHologramClone(pos: THREE.Vector3, yaw: number, caster: MatchPlayer) {
    const cloneMat = new THREE.MeshStandardMaterial({
      color: caster.team === 'alpha' ? 0xec4899 : 0xef4444,
      emissive: caster.team === 'alpha' ? 0xdb2777 : 0x991b1b,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.72,
      wireframe: true
    });
    const clone = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.8, 0.45), cloneMat);
    clone.position.copy(pos).setY(0.9);
    clone.rotation.y = yaw;
    this.scene.add(clone);

    let moveDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    this.entities.push({
      id: Math.random().toString(),
      type: 'hologram_clone',
      name: 'Phantom Decoy',
      ownerId: caster.id,
      caster,
      team: caster.team,
      position: pos,
      radius: 3.5,
      dps: 32,
      mesh: clone,
      duration: 7.5,
      timeAlive: 0,
      tickAccum: 0,
      onTick: (dt, colliders) => {
        const step = this.physicsEngine.stepKinematicEntityCCD(
          clone.position,
          moveDir,
          5.4,
          0.42,
          dt,
          colliders
        );
        clone.position.copy(step.nextPos);
        moveDir = step.nextDir;
        clone.rotation.y = Math.atan2(-moveDir.x, -moveDir.z);
        pos.copy(clone.position);
      }
    });
  }

  private spawnSmokeSphere(
    pos: THREE.Vector3,
    colorHex: number,
    duration: number,
    caster: MatchPlayer,
    dps = 0
  ) {
    const smokeMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.92,
      metalness: 0.05,
      transparent: true,
      opacity: 0.92
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(4.8, 20, 20), smokeMat);
    sphere.position.copy(pos).setY(2.2);
    this.scene.add(sphere);

    this.entities.push({
      id: Math.random().toString(),
      type: 'smoke_sphere',
      name: 'Tactical Smoke',
      ownerId: caster.id,
      caster,
      team: caster.team,
      position: pos,
      radius: 4.8,
      dps,
      slowBots: dps > 0,
      blocksVision: true,
      mesh: sphere,
      duration,
      timeAlive: 0,
      tickAccum: 0
    });
  }

  private spawnRepulsorPad(pos: THREE.Vector3, caster: MatchPlayer) {
    const group = new THREE.Group();
    group.position.copy(pos);

    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(2.0, 2.2, 0.18, 20),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true })
    );
    group.add(pad);

    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.3, 0.08, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.15;
    group.add(innerRing);

    this.scene.add(group);

    this.entities.push({
      id: Math.random().toString(),
      type: 'repulsor_pad',
      name: 'Repulsor Well',
      ownerId: caster.id,
      caster,
      team: caster.team,
      position: pos,
      radius: 2.8,
      dps: 22,
      mesh: group,
      duration: 18.0,
      timeAlive: 0,
      tickAccum: 0,
      onTick: (dt) => {
        pad.rotation.y += dt * 3;
      }
    });
  }

  private spawnSingularity(pos: THREE.Vector3, caster: MatchPlayer) {
    const group = new THREE.Group();
    group.position.copy(pos).setY(1.3);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x090d16 })
    );
    group.add(core);

    const vortex = new THREE.Mesh(
      new THREE.TorusGeometry(3.8, 0.28, 12, 32),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true })
    );
    vortex.rotation.x = Math.PI / 2;
    group.add(vortex);

    this.scene.add(group);

    this.entities.push({
      id: Math.random().toString(),
      type: 'singularity',
      name: 'Singularity Vortex',
      ownerId: caster.id,
      caster,
      team: caster.team,
      position: pos,
      radius: 8.5,
      dps: 38,
      pullStrength: 8.0,
      slowBots: true,
      mesh: group,
      duration: 6.5,
      timeAlive: 0,
      tickAccum: 0,
      onTick: (dt) => {
        vortex.rotation.z += dt * 8.0;
      }
    });
  }
}
