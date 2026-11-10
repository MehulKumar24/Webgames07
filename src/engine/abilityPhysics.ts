import * as THREE from 'three';
import { MapCollider } from './mapBuilder';
import { BotState } from './botAI';
import { soundEngine } from '../audio/soundEngine';

export type ProjectileBehavior = 'bounce_detonate' | 'stick_on_impact' | 'airburst_fuse' | 'kinematic_walker';

export interface CCDHitResult {
  hit: boolean;
  t: number; // Normalized time of impact in [0, 1]
  point: THREE.Vector3;
  normal: THREE.Vector3;
  collider?: MapCollider;
  hitBot?: BotState;
}

export interface AbilityProjectileConfig {
  id?: string;
  name: string;
  ownerId: string;
  team: 'alpha' | 'omega';
  casterOrigin?: THREE.Vector3; // Optional caster eye/chest pos to CCD-validate the hand throw origin against thin walls
  origin: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  gravity: number;
  restitution: number; // Wall/floor bounciness (0 = stick, 0.55 = tactical grenade bounce)
  friction: number;
  maxBounces: number;
  fuseTime: number; // Max flight time before detonation
  detonateOnFloorHit?: boolean;
   settleOnSupportSurface?: boolean;
  colorHex: number;
  behavior: ProjectileBehavior;
  onDetonate: (impactPos: THREE.Vector3, impactNormal: THREE.Vector3, hitBot?: BotState) => void;
  onBounce?: (bouncePos: THREE.Vector3, bounceNormal: THREE.Vector3, bounceCount: number) => void;
}

interface ActiveProjectile {
  id: string;
  config: AbilityProjectileConfig;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  elapsed: number;
  bounces: number;
  isSettled: boolean;
  mesh: THREE.Group;
  trailPositions: THREE.Vector3[];
  trailLine: THREE.Line;
}

interface ActiveAbilityImpulse {
  velocity: THREE.Vector3;
  remainingTime: number;
  radius: number;
}

/**
 * Dedicated Continuous Collision Detection (CCD) Physics Engine for Agent Abilities, Projectiles, Traps & Dashes.
 * Completely decoupled from standard WASD player movement physics.
 *
 * Key Anti-Tunneling Guarantees:
 * 1. Pre-Spawn Hand-to-Origin CCD Trace: Prevents throwing grenades/traps through thin walls when standing pressed against them.
 * 2. Iterative Minimum Translation Vector (MTV) Depenetration: Ensures a projectile/trap never starts a substep embedded inside thin geometry.
 * 3. Dual-Pass Swept-Sphere + Core-Segment Slab CCD: Combines Minkowski-expanded AABB slab intersection with unexpanded core wall raycasting and exact closest-point corner normals.
 * 4. High-Frequency Adaptive Sub-Stepping (<= 0.12m per substep, up to 24 substeps/frame) with multi-bounce reflection within a single substep.
 * 5. Surface-Normal Trap Anchoring & Elevated Support-Surface Raycasting: Ensures traps stick flush to thin vertical walls and AoE zones settle on elevated bridges/containers instead of clipping to y=0.
 */
export class AbilityPhysicsEngine {
  private scene: THREE.Scene;
  private activeProjectiles: ActiveProjectile[] = [];
  private activePlayerImpulse: ActiveAbilityImpulse | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Validates that the projectile spawn point (e.g. outstretched throwing hand) does not cross
   * a thin wall between the caster's core/eye position and the launch point.
   */
  public resolveSafeSpawnOrigin(
    casterCorePos: THREE.Vector3,
    desiredSpawnPos: THREE.Vector3,
    radius: number,
    colliders: MapCollider[]
  ): { safeOrigin: THREE.Vector3; blockedOnSpawn: boolean; blockNormal: THREE.Vector3 } {
    // First depenetrate casterCorePos if close to a wall
    const cleanStart = this.depenetrateSphere(casterCorePos, radius, colliders).position;
    const sweep = this.sweepSphereCCD(cleanStart, desiredSpawnPos, radius, colliders);
    if (sweep.hit) {
      const safePt = sweep.point.clone().addScaledVector(sweep.normal, radius + 0.025);
      return {
        safeOrigin: this.depenetrateSphere(safePt, radius, colliders).position,
        blockedOnSpawn: true,
        blockNormal: sweep.normal.clone()
      };
    }
    const depen = this.depenetrateSphere(desiredSpawnPos, radius, colliders);
    return {
      safeOrigin: depen.position,
      blockedOnSpawn: depen.wasPenetrating,
      blockNormal: depen.normal
    };
  }

  /**
   * Spawns a physical 3D projectile or trap governed by Continuous Collision Detection (CCD)
   */
  public spawnProjectile(config: AbilityProjectileConfig, colliders?: MapCollider[]): string {
    const id = config.id || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    let spawnPos = config.origin.clone();
    let initialVel = config.velocity.clone();

    // If colliders are provided at spawn time, verify hand-to-origin CCD so close-wall throws never clip
    if (colliders && colliders.length > 0) {
      const coreOrigin = config.casterOrigin || config.origin;
      const safeCheck = this.resolveSafeSpawnOrigin(coreOrigin, config.origin, config.radius, colliders);
      spawnPos.copy(safeCheck.safeOrigin);

      if (safeCheck.blockedOnSpawn) {
        if (config.behavior === 'stick_on_impact') {
          // Immediately anchor sticky trap/dart onto the near side of the thin wall
          const anchorPt = spawnPos.clone().addScaledVector(safeCheck.blockNormal, 0.02);
          setTimeout(() => {
            config.onDetonate(anchorPt, safeCheck.blockNormal);
          }, 0);
          return id;
        }
        // Reflect initial velocity off the thin wall face so grenade bounces back toward caster instead of clipping through
        const vDotN = initialVel.dot(safeCheck.blockNormal);
        if (vDotN < 0) {
          const normalComp = safeCheck.blockNormal.clone().multiplyScalar(vDotN);
          const tangentComp = initialVel.clone().sub(normalComp);
          initialVel
            .copy(tangentComp.multiplyScalar(config.friction))
            .addScaledVector(normalComp, -config.restitution);
        }
      }
    }

    // Build 3D Ordnance Mesh (Glowing Tactical Canister / Core + Outer Gyro Ring)
    const mesh = new THREE.Group();
    mesh.position.copy(spawnPos);

    const coreGeom =
      config.behavior === 'stick_on_impact'
        ? new THREE.ConeGeometry(config.radius * 0.9, config.radius * 2.6, 8)
        : new THREE.OctahedronGeometry(config.radius * 1.05, 1);
    if (config.behavior === 'stick_on_impact') {
      coreGeom.rotateX(Math.PI / 2);
    }

    const coreMat = new THREE.MeshStandardMaterial({
      color: config.colorHex,
      emissive: config.colorHex,
      emissiveIntensity: 1.4,
      roughness: 0.25,
      metalness: 0.8
    });
    const coreMesh = new THREE.Mesh(coreGeom, coreMat);
    mesh.add(coreMesh);

    const haloRing = new THREE.Mesh(
      new THREE.RingGeometry(config.radius * 1.15, config.radius * 1.5, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      })
    );
    mesh.add(haloRing);
    this.scene.add(mesh);

    // Dynamic 3D Trajectory Ribbon Trail
    const initialTrail = [spawnPos.clone(), spawnPos.clone()];
    const trailGeom = new THREE.BufferGeometry().setFromPoints(initialTrail);
    const trailMat = new THREE.LineBasicMaterial({
      color: config.colorHex,
      transparent: true,
      opacity: 0.85
    });
    const trailLine = new THREE.Line(trailGeom, trailMat);
    this.scene.add(trailLine);

    this.activeProjectiles.push({
      id,
      config,
      position: spawnPos,
      velocity: initialVel,
      elapsed: 0,
      bounces: 0,
      isSettled: false,
      mesh,
      trailPositions: [spawnPos.clone()],
      trailLine
    });

    return id;
  }

  /**
   * Registers a decoupled ability dash / knockback impulse for the player so ability movement
   * is resolved via multi-substep Swept-Sphere CCD rather than standard walking physics.
   */
  public triggerAbilityImpulse(velocity: THREE.Vector3, duration: number = 0.28, radius: number = 0.46) {
    this.activePlayerImpulse = {
      velocity: velocity.clone(),
      remainingTime: duration,
      radius
    };
  }

  /**
   * Steps any active decoupled ability dash impulse using Swept-Sphere CCD against thin map geometry.
   */
  public updatePlayerImpulseCCD(
    dt: number,
    playerEyePos: THREE.Vector3,
    colliders: MapCollider[]
  ): { active: boolean; verticalLaunch?: number } {
    if (!this.activePlayerImpulse || this.activePlayerImpulse.remainingTime <= 0) {
      this.activePlayerImpulse = null;
      return { active: false };
    }

    const imp = this.activePlayerImpulse;
    const stepDt = Math.min(dt, imp.remainingTime);
    imp.remainingTime -= stepDt;

    const footY = playerEyePos.y - 1.6;
    const bodyCenter = new THREE.Vector3(playerEyePos.x, footY + 0.95, playerEyePos.z);

    const horizVel = new THREE.Vector3(imp.velocity.x, 0, imp.velocity.z);
    const speed = horizVel.length();
    const subSteps = Math.max(1, Math.min(10, Math.ceil((speed * stepDt) / 0.15)));
    const subDt = stepDt / subSteps;

    for (let s = 0; s < subSteps; s++) {
      const start = bodyCenter.clone();
      const end = start.clone().addScaledVector(horizVel, subDt);
      const hit = this.sweepSphereCCD(start, end, imp.radius, colliders);

      if (!hit.hit) {
        bodyCenter.copy(end);
      } else {
        // Slide smoothly along wall tangent without clipping through thin geometry
        const safePt = hit.point.clone().addScaledVector(hit.normal, 0.02);
        bodyCenter.x = safePt.x;
        bodyCenter.z = safePt.z;
        const nFlat = new THREE.Vector3(hit.normal.x, 0, hit.normal.z).normalize();
        const vDotN = horizVel.dot(nFlat);
        if (vDotN < 0) {
          horizVel.addScaledVector(nFlat, -vDotN);
        }
      }
      // Depenetrate against any corner overlap
      const depen = this.depenetrateSphere(bodyCenter, imp.radius, colliders);
      bodyCenter.x = depen.position.x;
      bodyCenter.z = depen.position.z;
    }

    playerEyePos.x = THREE.MathUtils.clamp(bodyCenter.x, -50, 50);
    playerEyePos.z = THREE.MathUtils.clamp(bodyCenter.z, -50, 50);

    // Decay impulse velocity smoothly
    imp.velocity.x = horizVel.x * Math.pow(0.08, stepDt);
    imp.velocity.z = horizVel.z * Math.pow(0.08, stepDt);

    const verticalLaunch = imp.velocity.y > 0.5 ? imp.velocity.y : undefined;
    imp.velocity.y = 0;

    if (imp.remainingTime <= 0 || horizVel.lengthSq() < 0.25) {
      this.activePlayerImpulse = null;
    }

    return { active: true, verticalLaunch };
  }

  /**
   * Advances all active projectiles using high-frequency sub-stepped Swept-Sphere CCD
   */
  public update(dt: number, colliders: MapCollider[], bots?: BotState[]) {
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const proj = this.activeProjectiles[i];
      proj.elapsed += dt;

      // Check fuse expiration
      if (proj.elapsed >= proj.config.fuseTime) {
        const supportPt = this.resolveSupportSurfacePosition(
          proj.position,
          new THREE.Vector3(0, 1, 0),
          proj.config.radius,
          colliders
        );
        this.detonateAndRemove(i, supportPt, new THREE.Vector3(0, 1, 0));
        continue;
      }

      // Fine adaptive sub-stepping: max 0.12m per substep so even 0.08m thin glass/metal panels are never skipped
      const speed = proj.velocity.length();
      const maxStepDist = 0.12;
      const subSteps = Math.max(1, Math.min(24, Math.ceil((speed * dt) / maxStepDist)));
      const subDt = dt / subSteps;

      let detonatedDuringSubstep = false;

      for (let s = 0; s < subSteps; s++) {
        // 0. Pre-substep depenetration guarantee: if touching/overlapping a thin wall, push out along MTV
        const depen = this.depenetrateSphere(proj.position, proj.config.radius, colliders);
        if (depen.wasPenetrating) {
          proj.position.copy(depen.position);
          const vn = proj.velocity.dot(depen.normal);
          if (vn < 0) {
            proj.velocity.addScaledVector(depen.normal, -(1 + proj.config.restitution) * vn);
          }
        }

        // Integrate gravity & aerodynamic drag
        if (!proj.isSettled) {
          proj.velocity.y -= proj.config.gravity * subDt;
          const drag = Math.max(0, 1 - 0.14 * subDt);
          proj.velocity.x *= drag;
          proj.velocity.z *= drag;
        }

        // Multi-contact CCD loop within each substep (handles tight corner bounces cleanly)
        let remainingStepTime = subDt;
        for (let iter = 0; iter < 3 && remainingStepTime > 1e-5; iter++) {
          const startPos = proj.position.clone();
          const endPos = startPos.clone().addScaledVector(proj.velocity, remainingStepTime);

          const ccdHit = this.sweepSphereCCD(
            startPos,
            endPos,
            proj.config.radius,
            colliders,
            bots,
            proj.config.team
          );

          if (!ccdHit.hit) {
            proj.position.copy(endPos);
            break;
          }

          // Move safely to exact point of contact + surface normal clearance
          const safeContact = ccdHit.point.clone().addScaledVector(ccdHit.normal, 0.018);
          proj.position.copy(safeContact);

          // Direct hit on enemy bot
          if (ccdHit.hitBot) {
            this.detonateAndRemove(i, safeContact, ccdHit.normal, ccdHit.hitBot);
            detonatedDuringSubstep = true;
            break;
          }

          // Behavior 1: Stick immediately on first surface contact (Recon Darts, Tripwires, Snares)
          if (proj.config.behavior === 'stick_on_impact') {
            this.detonateAndRemove(i, safeContact, ccdHit.normal);
            detonatedDuringSubstep = true;
            break;
          }

          // Behavior 2: Bounce & Detonate (Grenades, Smokes, Thermite, Cryo Orbs)
          const isHorizontalFloorOrDeck = ccdHit.normal.y >= 0.65;
          if (isHorizontalFloorOrDeck && proj.config.detonateOnFloorHit) {
            const settledPt = this.resolveSupportSurfacePosition(
              safeContact,
              ccdHit.normal,
              proj.config.radius,
              colliders
            );
            this.detonateAndRemove(i, settledPt, ccdHit.normal);
            detonatedDuringSubstep = true;
            break;
          }

          proj.bounces++;
          if (proj.config.onBounce) {
            proj.config.onBounce(safeContact, ccdHit.normal, proj.bounces);
          }

          if (proj.bounces > proj.config.maxBounces) {
            const settledPt = isHorizontalFloorOrDeck
              ? this.resolveSupportSurfacePosition(safeContact, ccdHit.normal, proj.config.radius, colliders)
              : safeContact;
            this.detonateAndRemove(i, settledPt, ccdHit.normal);
            detonatedDuringSubstep = true;
            break;
          }

          // Specular reflection with normal restitution & tangential surface friction:
          // v' = friction * (v - (v . n) * n) - restitution * (v . n) * n
          const vDotN = proj.velocity.dot(ccdHit.normal);
          if (vDotN < 0) {
            const normalVel = ccdHit.normal.clone().multiplyScalar(vDotN);
            const tangentVel = proj.velocity.clone().sub(normalVel);
            proj.velocity
              .copy(tangentVel.multiplyScalar(proj.config.friction))
              .addScaledVector(normalVel, -proj.config.restitution);

            // Settle micro-bounces on horizontal surfaces so grenades roll to a stop instead of jittering
            if (isHorizontalFloorOrDeck && Math.abs(proj.velocity.y) < 0.85) {
              proj.velocity.y = 0;
              if (proj.velocity.lengthSq() < 0.35) {
                proj.velocity.set(0, 0, 0);
                proj.isSettled = true;
              }
            }
          }

          remainingStepTime *= Math.max(0, 1 - ccdHit.t);
        }

        if (detonatedDuringSubstep) break;
      }

      if (detonatedDuringSubstep) continue;

      // Update 3D Ordnance Mesh transform & spin
      proj.mesh.position.copy(proj.position);
      if (proj.config.behavior === 'stick_on_impact' && proj.velocity.lengthSq() > 0.01) {
        proj.mesh.lookAt(proj.position.clone().add(proj.velocity));
      } else if (!proj.isSettled) {
        proj.mesh.rotation.x += dt * 10;
        proj.mesh.rotation.y += dt * 12;
      }

      // Update 3D Trajectory Ribbon Trail
      proj.trailPositions.push(proj.position.clone());
      if (proj.trailPositions.length > 18) {
        proj.trailPositions.shift();
      }
      proj.trailLine.geometry.dispose();
      proj.trailLine.geometry = new THREE.BufferGeometry().setFromPoints(proj.trailPositions);
    }
  }

  /**
   * Resolves Minimum Translation Vector (MTV) depenetration if a sphere of `radius` overlaps any map collider AABB.
   * Guarantees that a projectile or trap never begins a CCD sweep inside a thin wall.
   */
  public depenetrateSphere(
    pos: THREE.Vector3,
    radius: number,
    colliders: MapCollider[]
  ): { position: THREE.Vector3; wasPenetrating: boolean; normal: THREE.Vector3 } {
    const outPos = pos.clone();
    let wasPenetrating = false;
    const lastNormal = new THREE.Vector3(0, 1, 0);

    for (const c of colliders) {
      // Find closest point on true unexpanded AABB [c.box.min, c.box.max] to sphere center `outPos`
      const cx = THREE.MathUtils.clamp(outPos.x, c.box.min.x, c.box.max.x);
      const cy = THREE.MathUtils.clamp(outPos.y, c.box.min.y, c.box.max.y);
      const cz = THREE.MathUtils.clamp(outPos.z, c.box.min.z, c.box.max.z);

      const dx = outPos.x - cx;
      const dy = outPos.y - cy;
      const dz = outPos.z - cz;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < radius * radius) {
        wasPenetrating = true;
        if (distSq > 1e-8) {
          // Center is outside the raw box but within `radius`
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;
          const push = radius - dist + 0.008;
          outPos.x += nx * push;
          outPos.y += ny * push;
          outPos.z += nz * push;
          lastNormal.set(nx, ny, nz);
        } else {
          // Center is strictly inside the raw box: push out to nearest face of the AABB
          const dLeft = Math.abs(outPos.x - c.box.min.x);
          const dRight = Math.abs(c.box.max.x - outPos.x);
          const dBottom = Math.abs(outPos.y - c.box.min.y);
          const dTop = Math.abs(c.box.max.y - outPos.y);
          const dBack = Math.abs(outPos.z - c.box.min.z);
          const dFront = Math.abs(c.box.max.z - outPos.z);

          const minFace = Math.min(dLeft, dRight, dBottom, dTop, dBack, dFront);
          if (minFace === dLeft) {
            outPos.x = c.box.min.x - radius - 0.008;
            lastNormal.set(-1, 0, 0);
          } else if (minFace === dRight) {
            outPos.x = c.box.max.x + radius + 0.008;
            lastNormal.set(1, 0, 0);
          } else if (minFace === dBack) {
            outPos.z = c.box.min.z - radius - 0.008;
            lastNormal.set(0, 0, -1);
          } else if (minFace === dFront) {
            outPos.z = c.box.max.z + radius + 0.008;
            lastNormal.set(0, 0, 1);
          } else if (minFace === dTop) {
            outPos.y = c.box.max.y + radius + 0.008;
            lastNormal.set(0, 1, 0);
          } else {
            outPos.y = c.box.min.y - radius - 0.008;
            lastNormal.set(0, -1, 0);
          }
        }
      }
    }

    // Clamp above main arena floor
    if (outPos.y < radius) {
      outPos.y = radius;
      wasPenetrating = true;
      lastNormal.set(0, 1, 0);
    }

    return { position: outPos, wasPenetrating, normal: lastNormal };
  }

  /**
   * Continuous Collision Detection (CCD) for a moving sphere of `radius` from `start` to `end`.
   * Combines Minkowski-Expanded AABB Slab Intersection with unexpanded core-box backup raycasting
   * and rounded closest-point normal derivation so thin walls and sharp corners never leak.
   */
  public sweepSphereCCD(
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    colliders: MapCollider[],
    bots?: BotState[],
    casterTeam?: 'alpha' | 'omega'
  ): CCDHitResult {
    const delta = new THREE.Vector3().subVectors(end, start);
    const segLen = delta.length();

    let earliestT = 1.0001;
    let hitNormal = new THREE.Vector3(0, 1, 0);
    let hitCollider: MapCollider | undefined;
    let hitBot: BotState | undefined;

    // 1. Check Ground Plane (y = radius)
    const groundY = Math.max(0.05, radius);
    if (start.y >= groundY && end.y < groundY && Math.abs(delta.y) > 1e-6) {
      const tGround = Math.max(0, (groundY - start.y) / delta.y);
      if (tGround < earliestT) {
        earliestT = tGround;
        hitNormal.set(0, 1, 0);
        hitCollider = undefined;
      }
    }

    // 2. Check Map Perimeter Bounds (|x| <= 51, |z| <= 51)
    const boundLimit = 51.0 - radius;
    if (Math.abs(end.x) > boundLimit && Math.abs(delta.x) > 1e-6) {
      const targetX = Math.sign(end.x) * boundLimit;
      const tWall = Math.max(0, Math.min(1, (targetX - start.x) / delta.x));
      if (tWall < earliestT) {
        earliestT = tWall;
        hitNormal.set(-Math.sign(end.x), 0, 0);
      }
    }
    if (Math.abs(end.z) > boundLimit && Math.abs(delta.z) > 1e-6) {
      const targetZ = Math.sign(end.z) * boundLimit;
      const tWall = Math.max(0, Math.min(1, (targetZ - start.z) / delta.z));
      if (tWall < earliestT) {
        earliestT = tWall;
        hitNormal.set(0, 0, -Math.sign(end.z));
      }
    }

    // 3. Check Minkowski-Expanded Map Colliders (Walls, Thin Barriers, Crates, Ramps, Bridges)
    if (segLen > 1e-6) {
      for (const c of colliders) {
        const minX = c.box.min.x - radius;
        const maxX = c.box.max.x + radius;
        const minY = c.box.min.y - radius;
        const maxY = c.box.max.y + radius;
        const minZ = c.box.min.z - radius;
        const maxZ = c.box.max.z + radius;

        let slabHit = this.intersectSegmentExpandedAABB(
          start,
          delta,
          minX,
          maxX,
          minY,
          maxY,
          minZ,
          maxZ
        );

        // Backup unexpanded core-wall slab test: if `start` was already inside the `radius` shell
        // of a thin wall, test against the raw wall box [c.box.min, c.box.max] so it can NEVER tunnel through!
        if (!slabHit && radius > 0.01) {
          slabHit = this.intersectSegmentExpandedAABB(
            start,
            delta,
            c.box.min.x - 0.005,
            c.box.max.x + 0.005,
            c.box.min.y - 0.005,
            c.box.max.y + 0.005,
            c.box.min.z - 0.005,
            c.box.max.z + 0.005
          );
        }

        if (slabHit && slabHit.t < earliestT) {
          earliestT = slabHit.t;
          hitNormal.copy(slabHit.normal);
          hitCollider = c;
        }
      }

      // 4. Check Enemy Bot Capsules so direct grenade/dart hits register accurately
      if (bots && casterTeam) {
        for (const b of bots) {
          if (!b.player.isAlive || b.player.team === casterTeam) continue;
          const botRadius = 0.45 + radius;
          const slabBot = this.intersectSegmentExpandedAABB(
            start,
            delta,
            b.position.x - botRadius,
            b.position.x + botRadius,
            b.position.y,
            b.position.y + 1.85 + radius,
            b.position.z - botRadius,
            b.position.z + botRadius
          );
          if (slabBot && slabBot.t < earliestT) {
            earliestT = slabBot.t;
            hitNormal.copy(slabBot.normal);
            hitBot = b;
            hitCollider = undefined;
          }
        }
      }
    }

    if (earliestT <= 1.0) {
      const impactPt = start.clone().addScaledVector(delta, earliestT);
      return {
        hit: true,
        t: earliestT,
        point: impactPt,
        normal: hitNormal,
        collider: hitCollider,
        hitBot
      };
    }

    return {
      hit: false,
      t: 1.0,
      point: end.clone(),
      normal: new THREE.Vector3(0, 1, 0)
    };
  }

  /**
   * Exact Slab Method intersection between a directed segment P(t) = start + t * delta, t in [0, 1],
   * and an AABB [minX..maxX, minY..maxY, minZ..maxZ].
   * When `start` is inside the box, checks all 3 axes for any inward motion against the opposing slab face
   * so corner grazing against thin walls never leaks.
   */
  private intersectSegmentExpandedAABB(
    start: THREE.Vector3,
    delta: THREE.Vector3,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number
  ): { t: number; normal: THREE.Vector3 } | null {
    // Check if start point is already inside the AABB
    if (
      start.x >= minX &&
      start.x <= maxX &&
      start.y >= minY &&
      start.y <= maxY &&
      start.z >= minZ &&
      start.z <= maxZ
    ) {
      const dxMin = Math.abs(start.x - minX);
      const dxMax = Math.abs(maxX - start.x);
      const dyMin = Math.abs(start.y - minY);
      const dyMax = Math.abs(maxY - start.y);
      const dzMin = Math.abs(start.z - minZ);
      const dzMax = Math.abs(maxZ - start.z);

      // Rank all 6 faces by proximity and pick the closest face that opposes `delta`
      const candidates: { dist: number; normal: THREE.Vector3 }[] = [
        { dist: dxMin, normal: new THREE.Vector3(-1, 0, 0) },
        { dist: dxMax, normal: new THREE.Vector3(1, 0, 0) },
        { dist: dzMin, normal: new THREE.Vector3(0, 0, -1) },
        { dist: dzMax, normal: new THREE.Vector3(0, 0, 1) },
        { dist: dyMax, normal: new THREE.Vector3(0, 1, 0) },
        { dist: dyMin, normal: new THREE.Vector3(0, -1, 0) }
      ].sort((a, b) => a.dist - b.dist);

      for (const cand of candidates) {
        if (delta.dot(cand.normal) < -1e-6) {
          return { t: 0, normal: cand.normal };
        }
      }
      return null;
    }

    let tMin = 0.0;
    let tMax = 1.0;
    const hitNormal = new THREE.Vector3(0, 1, 0);

    // X Axis Slab
    if (Math.abs(delta.x) < 1e-8) {
      if (start.x < minX || start.x > maxX) return null;
    } else {
      const invX = 1.0 / delta.x;
      let t1 = (minX - start.x) * invX;
      let t2 = (maxX - start.x) * invX;
      let nSign = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        nSign = 1;
      }
      if (t1 > tMin) {
        tMin = t1;
        hitNormal.set(nSign, 0, 0);
      }
      if (t2 < tMax) tMax = t2;
      if (tMin > tMax) return null;
    }

    // Y Axis Slab
    if (Math.abs(delta.y) < 1e-8) {
      if (start.y < minY || start.y > maxY) return null;
    } else {
      const invY = 1.0 / delta.y;
      let t1 = (minY - start.y) * invY;
      let t2 = (maxY - start.y) * invY;
      let nSign = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        nSign = 1;
      }
      if (t1 > tMin) {
        tMin = t1;
        hitNormal.set(0, nSign, 0);
      }
      if (t2 < tMax) tMax = t2;
      if (tMin > tMax) return null;
    }

    // Z Axis Slab
    if (Math.abs(delta.z) < 1e-8) {
      if (start.z < minZ || start.z > maxZ) return null;
    } else {
      const invZ = 1.0 / delta.z;
      let t1 = (minZ - start.z) * invZ;
      let t2 = (maxZ - start.z) * invZ;
      let nSign = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        nSign = 1;
      }
      if (t1 > tMin) {
        tMin = t1;
        hitNormal.set(0, 0, nSign);
      }
      if (t2 < tMax) tMax = t2;
      if (tMin > tMax) return null;
    }

    if (tMin >= 0.0 && tMin <= 1.0) {
      return { t: tMin, normal: hitNormal };
    }
    return null;
  }

  /**
   * Resolves the exact supporting floor, bridge deck, container roof, or stair surface beneath an impact point
   * using a downward Swept-Sphere CCD trace, so grenades/traps that land on elevated geometry stay on top of it
   * instead of clipping down to y = 0.05.
   */
  public resolveSupportSurfacePosition(
    impactPos: THREE.Vector3,
    impactNormal: THREE.Vector3,
    radius: number,
    colliders: MapCollider[]
  ): THREE.Vector3 {
    const safeStart = impactPos.clone().addScaledVector(impactNormal, Math.max(0.08, radius));
    const dropEnd = new THREE.Vector3(safeStart.x, 0.05, safeStart.z);
    const downSweep = this.sweepSphereCCD(safeStart, dropEnd, 0.12, colliders);

    const resolvedY = downSweep.hit
      ? Math.max(0.05, downSweep.point.y - 0.12 + 0.04)
      : 0.05;

    return new THREE.Vector3(
      THREE.MathUtils.clamp(safeStart.x, -49.5, 49.5),
      resolvedY,
      THREE.MathUtils.clamp(safeStart.z, -49.5, 49.5)
    );
  }

  /**
   * Resolves a ground-deployed tactical structure/trap position using Swept-Sphere CCD
   * so deployables (Turrets, Barricades, Ice Walls, Jump Pads) never spawn inside or behind thin walls,
   * and accurately snap onto elevated bridges, ramps, or container roofs.
   */
  public resolveDeployableGroundPosition(
    origin: THREE.Vector3,
    lookDir: THREE.Vector3,
    maxDist: number,
    objectRadius: number,
    colliders: MapCollider[]
  ): THREE.Vector3 {
    const dir = lookDir.clone().normalize();
    const desiredEnd = origin.clone().addScaledVector(dir, maxDist);

    if (dir.y < -0.05) {
      const tFloor = (objectRadius + 0.05 - origin.y) / dir.y;
      if (tFloor > 0.5 && tFloor < maxDist) {
        desiredEnd.copy(origin).addScaledVector(dir, tFloor);
      }
    }

    const sweep = this.sweepSphereCCD(origin, desiredEnd, objectRadius, colliders);
    const safePt = sweep.hit
      ? sweep.point.clone().addScaledVector(sweep.normal, objectRadius + 0.12)
      : desiredEnd;

    const depenPt = this.depenetrateSphere(safePt, objectRadius, colliders).position;
    return this.resolveSupportSurfacePosition(depenPt, new THREE.Vector3(0, 1, 0), objectRadius, colliders);
  }

  /**
   * Computes a wall-to-wall laser tripwire span from an anchored trap position along `surfaceNormal`
   * using CCD so tripwire beams stop cleanly at the opposing thin wall instead of clipping through it.
   */
  public computeTripwireSpanCCD(
    anchorPos: THREE.Vector3,
    surfaceNormal: THREE.Vector3,
    maxSpanLength: number,
    colliders: MapCollider[]
  ): { start: THREE.Vector3; end: THREE.Vector3; normal: THREE.Vector3 } {
    const n = surfaceNormal.clone().normalize();
    const start = anchorPos.clone().addScaledVector(n, 0.05);
    const desiredEnd = start.clone().addScaledVector(n, maxSpanLength);
    const sweep = this.sweepSphereCCD(start, desiredEnd, 0.04, colliders);
    const end = sweep.hit ? sweep.point.clone() : desiredEnd;
    return { start, end, normal: n };
  }

  /**
   * Continuous Collision Detection for a horizontally moving kinematic ability entity
   * (such as Mirage's Phantom Decoy Clone or Umbra's Shadow Hawk Drone), allowing it to slide or reflect
   * along thin walls instead of passing through geometry.
   */
  public stepKinematicEntityCCD(
    currentPos: THREE.Vector3,
    moveDir: THREE.Vector3,
    speed: number,
    radius: number,
    dt: number,
    colliders: MapCollider[]
  ): { nextPos: THREE.Vector3; nextDir: THREE.Vector3 } {
    const depen = this.depenetrateSphere(currentPos, radius, colliders);
    const start = depen.position;
    const end = start.clone().addScaledVector(moveDir, speed * dt);

    const sweep = this.sweepSphereCCD(start, end, radius, colliders);
    if (!sweep.hit || sweep.normal.y > 0.6) {
      return { nextPos: end, nextDir: moveDir };
    }

    const flatNormal = new THREE.Vector3(sweep.normal.x, 0, sweep.normal.z).normalize();
    const reflectedDir = moveDir
      .clone()
      .sub(flatNormal.clone().multiplyScalar(1.8 * moveDir.dot(flatNormal)))
      .normalize();

    const safePos = sweep.point
      .clone()
      .addScaledVector(flatNormal, 0.08)
      .addScaledVector(reflectedDir, speed * dt * (1 - sweep.t));
    safePos.y = currentPos.y;

    return { nextPos: safePos, nextDir: reflectedDir };
  }

  private detonateAndRemove(
    index: number,
    impactPos: THREE.Vector3,
    impactNormal: THREE.Vector3,
    hitBot?: BotState
  ) {
    const proj = this.activeProjectiles[index];
    if (!proj) return;

    this.scene.remove(proj.mesh);
    this.scene.remove(proj.trailLine);
    proj.trailLine.geometry.dispose();

    this.activeProjectiles.splice(index, 1);

    try {
      proj.config.onDetonate(impactPos, impactNormal, hitBot);
    } catch {
      soundEngine.playAbility('sonar');
    }
  }

  public clearAll() {
    for (const proj of this.activeProjectiles) {
      this.scene.remove(proj.mesh);
      this.scene.remove(proj.trailLine);
      proj.trailLine.geometry.dispose();
    }
    this.activeProjectiles = [];
    this.activePlayerImpulse = null;
  }
}
