import * as THREE from 'three';
import { Weapon } from '../types/game';

// Shared material cache
const matCache = new Map<string, THREE.Material>();

function getMaterial(key: string, creator: () => THREE.Material): THREE.Material {
  if (!matCache.has(key)) {
    matCache.set(key, creator());
  }
  return matCache.get(key)!;
}

interface AgentVisualConfig {
  suitColor: number;
  armorColor: number;
  accentColor: number;
  glowColor: number;
  skinColor: number;
  bulkScale: number;
}

const AGENT_VISUAL_CONFIGS: Record<string, AgentVisualConfig> = {
  VORTEX: {
    suitColor: 0x0c2d48,
    armorColor: 0x164e63,
    accentColor: 0x0284c7,
    glowColor: 0x00f0ff,
    skinColor: 0xd4a373,
    bulkScale: 1.0
  },
  UMBRA: {
    suitColor: 0x1a1025,
    armorColor: 0x2e1065,
    accentColor: 0x7e22ce,
    glowColor: 0xa855f7,
    skinColor: 0xf1dca7,
    bulkScale: 0.94
  },
  CRYO: {
    suitColor: 0xe2e8f0,
    armorColor: 0x94a3b8,
    accentColor: 0x0284c7,
    glowColor: 0x38bdf8,
    skinColor: 0xf3d5b5,
    bulkScale: 0.96
  },
  BUNKER: {
    suitColor: 0x27272a,
    armorColor: 0x52525b,
    accentColor: 0xca8a04,
    glowColor: 0xfacc15,
    skinColor: 0xd4a373,
    bulkScale: 1.14
  },
  AETHER: {
    suitColor: 0xf1f5f9,
    armorColor: 0x065f46,
    accentColor: 0x059669,
    glowColor: 0x10b981,
    skinColor: 0xc68b59,
    bulkScale: 0.94
  },
  IGNIS: {
    suitColor: 0x431407,
    armorColor: 0x7c2d12,
    accentColor: 0xea580c,
    glowColor: 0xf97316,
    skinColor: 0xc68b59,
    bulkScale: 1.03
  },
  MIRAGE: {
    suitColor: 0x3b0764,
    armorColor: 0x701a75,
    accentColor: 0xdb2777,
    glowColor: 0xec4899,
    skinColor: 0xf3d5b5,
    bulkScale: 0.94
  },
  ROOK: {
    suitColor: 0x1e293b,
    armorColor: 0x334155,
    accentColor: 0x475569,
    glowColor: 0x38bdf8,
    skinColor: 0xd4a373,
    bulkScale: 1.06
  },
  KAGE: {
    suitColor: 0x09090b,
    armorColor: 0x18181b,
    accentColor: 0x991b1b,
    glowColor: 0xef4444,
    skinColor: 0xf3d5b5,
    bulkScale: 0.92
  },
  PULSE: {
    suitColor: 0x083344,
    armorColor: 0x155e75,
    accentColor: 0x0891b2,
    glowColor: 0x06b6d4,
    skinColor: 0xd4a373,
    bulkScale: 0.99
  },
  FLORA: {
    suitColor: 0x14532d,
    armorColor: 0x365314,
    accentColor: 0x65a30d,
    glowColor: 0x84cc16,
    skinColor: 0x8d5524,
    bulkScale: 0.95
  },
  TITAN: {
    suitColor: 0x451a03,
    armorColor: 0x78350f,
    accentColor: 0xb45309,
    glowColor: 0xf59e0b,
    skinColor: 0xd4a373,
    bulkScale: 1.18
  }
};

/**
 * Creates Bespoke, Visually Distinct 3D First-Person Weapon & Melee Models for all 26 Weapon Archetypes
 * with agent-matched tactical gloves, sleeves, and wrist holo-watch!
 */
export function createFirstPersonWeaponModel(
  weapon: Weapon,
  agentCallsign: string = 'VORTEX'
): {
  group: THREE.Group;
  muzzlePos: THREE.Vector3;
  magMesh: THREE.Mesh | null;
  sightGlow: THREE.Mesh | null;
} {
  const group = new THREE.Group();
  group.name = `fp_weapon_${weapon.id}`;

  const primaryCol = new THREE.Color(weapon.colorScheme.primary);
  const secondaryCol = new THREE.Color(weapon.colorScheme.secondary);
  const glowCol = new THREE.Color(weapon.colorScheme.glow);
  const agentVis = AGENT_VISUAL_CONFIGS[agentCallsign.toUpperCase()] || AGENT_VISUAL_CONFIGS.VORTEX;

  const gunMetalMat = new THREE.MeshStandardMaterial({
    color: primaryCol,
    roughness: 0.26,
    metalness: 0.9
  });

  const polymerMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.68,
    metalness: 0.18
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: secondaryCol,
    roughness: 0.32,
    metalness: 0.78
  });

  const chromeBladeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.12,
    metalness: 0.98
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.25,
    metalness: 0.92
  });

  const opticGlowMat = new THREE.MeshBasicMaterial({
    color: glowCol,
    side: THREE.DoubleSide
  });

  const glassLensMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.35,
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.9,
    ior: 1.5
  });

  const shieldGlassMat = new THREE.MeshPhysicalMaterial({
    color: glowCol,
    transparent: true,
    opacity: 0.38,
    roughness: 0.1,
    metalness: 0.2,
    side: THREE.DoubleSide
  });

  let magMesh: THREE.Mesh | null = null;
  let sightGlow: THREE.Mesh | null = null;
  const muzzlePos = new THREE.Vector3(0, 0, -0.6);
  const arch = weapon.archetype || 'tac_ar';

  // ============================================================================
  // 1. MELEE / KNIVES (Tactical Knife, Karambit, Vibro-Katana, Butterfly Knife)
  // ============================================================================
  if (weapon.category === 'Melee' || weapon.isMelee) {
    const meleeRig = new THREE.Group();
    meleeRig.position.set(0.03, -0.02, -0.08);
    meleeRig.rotation.set(-0.22, 0.25, -0.15);

    if (arch === 'karambit') {
      // Curved Talon Karambit with Index Retention Ring & Glowing Plasma Edge
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 10, 20), accentMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(0, -0.075, 0.05);
      meleeRig.add(ring);

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.11, 10), polymerMat);
      handle.position.set(0, -0.01, 0.02);
      handle.rotation.x = -0.35;
      meleeRig.add(handle);

      // Curved claw blade segments
      const clawGroup = new THREE.Group();
      clawGroup.position.set(0, 0.045, -0.01);
      for (let i = 0; i < 5; i++) {
        const seg = new THREE.Mesh(
          new THREE.BoxGeometry(0.007, 0.038 - i * 0.005, 0.028 - i * 0.004),
          chromeBladeMat
        );
        seg.position.set(0, i * 0.026, -i * 0.022);
        seg.rotation.x = -0.35 - i * 0.22;
        clawGroup.add(seg);

        const edge = new THREE.Mesh(
          new THREE.BoxGeometry(0.009, 0.036 - i * 0.005, 0.005),
          opticGlowMat
        );
        edge.position.set(0, i * 0.026, -i * 0.022 - 0.012);
        edge.rotation.x = -0.35 - i * 0.22;
        clawGroup.add(edge);
      }
      meleeRig.add(clawGroup);
      sightGlow = clawGroup.children[1] as THREE.Mesh;
    } else if (arch === 'katana') {
      // High-Frequency Cyber Katana with Ornate Tsuba Handguard & Long Glowing Blade
      const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.22, 12), polymerMat);
      tsuka.position.set(0, -0.06, 0.06);
      tsuka.rotation.x = -0.45;
      meleeRig.add(tsuka);

      // Diamond tsuka-ito grip wraps
      for (let i = 0; i < 5; i++) {
        const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.003, 6, 12), accentMat);
        wrap.position.set(0, -0.12 + i * 0.032, 0.09 - i * 0.015);
        wrap.rotation.x = Math.PI / 2 - 0.45;
        meleeRig.add(wrap);
      }

      // Circular Tsuba Guard
      const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.008, 16), accentMat);
      tsuba.position.set(0, 0.035, 0.01);
      tsuba.rotation.x = -0.45;
      meleeRig.add(tsuba);

      // Long Katana Blade + Crimson Energy Edge
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.56, 0.028), chromeBladeMat);
      blade.position.set(0, 0.29, -0.12);
      blade.rotation.x = -0.48;
      meleeRig.add(blade);

      const plasmaEdge = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.56, 0.006), opticGlowMat);
      plasmaEdge.position.set(0, 0.29, -0.134);
      plasmaEdge.rotation.x = -0.48;
      meleeRig.add(plasmaEdge);
      sightGlow = plasmaEdge;
    } else if (arch === 'butterfly') {
      // Twin-Pivot Balisong Butterfly Knife with Skeletonized Handles
      for (const side of [-1, 1]) {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.13, 0.014), accentMat);
        handle.position.set(0, -0.02, side * 0.011 + 0.02);
        handle.rotation.x = -0.3 + side * 0.04;
        meleeRig.add(handle);

        const pivotPin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.016, 8), opticGlowMat);
        pivotPin.rotation.z = Math.PI / 2;
        pivotPin.position.set(0, 0.04, side * 0.011);
        meleeRig.add(pivotPin);
      }

      const spearBlade = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.21, 4), chromeBladeMat);
      spearBlade.position.set(0, 0.14, -0.03);
      spearBlade.rotation.x = -0.32;
      spearBlade.scale.set(0.35, 1, 1);
      meleeRig.add(spearBlade);

      const fullerGlow = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.18, 0.004), opticGlowMat);
      fullerGlow.position.set(0, 0.13, -0.032);
      fullerGlow.rotation.x = -0.32;
      meleeRig.add(fullerGlow);
      sightGlow = fullerGlow;
    } else {
      // Default Apex Tactical Tanto Knife with Sawback Spine & Cyan Plasma Edge
      const pommelRing = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 8, 16), accentMat);
      pommelRing.rotation.y = Math.PI / 2;
      pommelRing.position.set(0, -0.09, 0.05);
      meleeRig.add(pommelRing);

      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.032), polymerMat);
      handle.position.set(0, -0.02, 0.02);
      handle.rotation.x = -0.32;
      meleeRig.add(handle);

      const crossGuard = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, 0.068), gunMetalMat);
      crossGuard.position.set(0, 0.038, 0.0);
      crossGuard.rotation.x = -0.32;
      meleeRig.add(crossGuard);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.22, 0.034), chromeBladeMat);
      blade.position.set(0, 0.14, -0.038);
      blade.rotation.x = -0.32;
      meleeRig.add(blade);

      // Serrated spine teeth
      for (let i = 0; i < 5; i++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.012, 0.01), accentMat);
        tooth.position.set(0, 0.07 + i * 0.024, -0.005 - i * 0.008);
        tooth.rotation.x = 0.4;
        meleeRig.add(tooth);
      }

      const plasmaEdge = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.22, 0.005), opticGlowMat);
      plasmaEdge.position.set(0, 0.14, -0.055);
      plasmaEdge.rotation.x = -0.32;
      meleeRig.add(plasmaEdge);
      sightGlow = plasmaEdge;
    }

    group.add(meleeRig);
    muzzlePos.set(0.03, 0.08, -0.25);
  }
  // ============================================================================
  // 2. PISTOLS (Revolver, Suppressed, Pocket Shotgun, Arc Pistol, Burst, Sidearm)
  // ============================================================================
  else if (weapon.category === 'Pistols') {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.025, 0.13, 12), polymerMat);
    grip.position.set(0, -0.045, 0.025);
    grip.rotation.x = 0.26;
    group.add(grip);

    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 12, Math.PI), gunMetalMat);
    guard.rotation.y = Math.PI / 2;
    guard.rotation.x = Math.PI / 2;
    guard.position.set(0, 0.0, -0.035);
    group.add(guard);

    if (arch === 'revolver') {
      // Heavy 6-Shot Magnum Revolver with Fluted Cylinder & Vented Rib Barrel
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.055, 0.14), gunMetalMat);
      frame.position.set(0, 0.03, -0.03);
      group.add(frame);

      const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.065, 12), accentMat);
      cylinder.rotation.x = Math.PI / 2;
      cylinder.position.set(0, 0.035, -0.04);
      group.add(cylinder);
      magMesh = cylinder;

      const heavyBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.042, 0.22), gunMetalMat);
      heavyBarrel.position.set(0, 0.042, -0.18);
      group.add(heavyBarrel);

      // Gold vent ribs
      for (let i = 0; i < 4; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.022), accentMat);
        rib.position.set(0, 0.065, -0.11 - i * 0.045);
        group.add(rib);
      }

      const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.025, 0.02), accentMat);
      hammer.position.set(0, 0.062, 0.04);
      hammer.rotation.x = -0.4;
      group.add(hammer);

      sightGlow = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), opticGlowMat);
      sightGlow.position.set(0, 0.072, -0.28);
      group.add(sightGlow);
      muzzlePos.set(0, 0.045, -0.3);
    } else if (arch === 'pocket_shotgun') {
      // Twin Side-by-Side Sawed-Off Pocket Buckshot
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.048, 0.12), gunMetalMat);
      receiver.position.set(0, 0.03, -0.02);
      group.add(receiver);

      for (const side of [-1, 1]) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.24, 14), gunMetalMat);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(side * 0.017, 0.04, -0.16);
        group.add(tube);

        const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.003, 8, 14), opticGlowMat);
        muzzleRing.position.set(side * 0.017, 0.04, -0.28);
        group.add(muzzleRing);
      }
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.028, 0.14), accentMat);
      handguard.position.set(0, 0.018, -0.14);
      group.add(handguard);
      magMesh = handguard;
      muzzlePos.set(0, 0.04, -0.29);
    } else {
      // Semi / Suppressed / Burst / Arc Pistols
      const slideLen = arch === 'burst_pistol' ? 0.26 : 0.22;
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.048, slideLen), gunMetalMat);
      slide.position.set(0, 0.04, -0.06);
      group.add(slide);

      for (let i = 0; i < 4; i++) {
        const serration = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.03, 0.005), accentMat);
        serration.position.set(0, 0.04, -0.11 - i * 0.014);
        group.add(serration);
      }

      if (arch === 'suppressed_pistol') {
        // Long Cylindrical Baffled Silencer + Micro Reflex Sight
        const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.19, 16), polymerMat);
        silencer.rotation.x = Math.PI / 2;
        silencer.position.set(0, 0.04, -0.26);
        group.add(silencer);

        const reflexFrame = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.028, 0.035), accentMat);
        reflexFrame.position.set(0, 0.075, -0.02);
        group.add(reflexFrame);
        muzzlePos.set(0, 0.04, -0.36);
      } else if (arch === 'arc_pistol') {
        // Glowing Tesla Copper/Cyan Coils along the barrel
        for (let i = 0; i < 4; i++) {
          const coil = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.004, 8, 16), opticGlowMat);
          coil.position.set(0, 0.04, -0.08 - i * 0.032);
          group.add(coil);
        }
        muzzlePos.set(0, 0.04, -0.24);
      } else if (arch === 'burst_pistol') {
        // Front Compensator & Extended Mag
        const comp = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.052, 0.055), accentMat);
        comp.position.set(0, 0.04, -0.21);
        group.add(comp);
        muzzlePos.set(0, 0.04, -0.25);
      } else {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 16), gunMetalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.04, -0.18);
        group.add(barrel);
        muzzlePos.set(0, 0.04, -0.22);
      }

      const magHeight = arch === 'burst_pistol' ? 0.18 : 0.12;
      magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.032, magHeight, 0.046), accentMat);
      magMesh.position.set(0, -0.065, 0.025);
      magMesh.rotation.x = 0.26;
      group.add(magMesh);

      sightGlow = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), opticGlowMat);
      sightGlow.position.set(0, 0.068, -0.15);
      group.add(sightGlow);
    }
  }
  // ============================================================================
  // 3. SMGS (Vector PDW, Bullpup P-90, Drum SMG, Suppressed SMG)
  // ============================================================================
  else if (weapon.category === 'SMGs') {
    if (arch === 'vector_smg') {
      // Iconic Kriss Vector Silhouette with Vertical Recoil Block & Angled Stick Mag
      const upperRec = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.065, 0.34), gunMetalMat);
      upperRec.position.set(0, 0.035, -0.08);
      group.add(upperRec);

      const recoilBlock = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.14, 0.095), accentMat);
      recoilBlock.position.set(0, -0.03, -0.15);
      group.add(recoilBlock);

      magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.24, 0.048), polymerMat);
      magMesh.position.set(0, -0.14, -0.17);
      magMesh.rotation.x = 0.28;
      group.add(magMesh);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 12), gunMetalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.025, -0.32);
      group.add(barrel);

      // Side cryo/energy canister tube
      const sideTube = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 10), opticGlowMat);
      sideTube.rotation.x = Math.PI / 2;
      sideTube.position.set(0.034, 0.035, -0.12);
      group.add(sideTube);

      const skelStock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.22), polymerMat);
      skelStock.position.set(0, 0.03, 0.18);
      group.add(skelStock);

      muzzlePos.set(0, 0.025, -0.42);
    } else if (arch === 'p90_bullpup') {
      // Compact Bullpup P-90 with Horizontal Top Magazine & Thumbhole Frame
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.11, 0.42), polymerMat);
      body.position.set(0, 0.0, -0.04);
      group.add(body);

      // Horizontal top magazine with glowing ammo strip
      magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.028, 0.32), accentMat);
      magMesh.position.set(0, 0.068, -0.05);
      group.add(magMesh);

      const ammoGlow = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.008, 0.26), opticGlowMat);
      ammoGlow.position.set(0, 0.068, -0.05);
      group.add(ammoGlow);

      const carryBridge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.16), gunMetalMat);
      carryBridge.position.set(0, 0.1, -0.12);
      group.add(carryBridge);

      muzzlePos.set(0, 0.01, -0.3);
    } else if (arch === 'drum_smg') {
      // Heavy Drum-Fed Submachine Gun
      const rec = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.075, 0.34), gunMetalMat);
      rec.position.set(0, 0.025, -0.06);
      group.add(rec);

      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.065, 18), accentMat);
      drum.rotation.x = Math.PI / 2;
      drum.position.set(0, -0.085, -0.12);
      group.add(drum);
      magMesh = drum;

      const finBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.28, 12), gunMetalMat);
      finBarrel.rotation.x = Math.PI / 2;
      finBarrel.position.set(0, 0.025, -0.34);
      group.add(finBarrel);
      muzzlePos.set(0, 0.025, -0.49);
    } else {
      // Suppressed Specter SMG
      const rec = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.075, 0.3), gunMetalMat);
      rec.position.set(0, 0.025, -0.05);
      group.add(rec);

      const bigSuppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.32, 16), polymerMat);
      bigSuppressor.rotation.x = Math.PI / 2;
      bigSuppressor.position.set(0, 0.025, -0.35);
      group.add(bigSuppressor);

      magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.22, 0.05), accentMat);
      magMesh.position.set(0, -0.11, -0.08);
      magMesh.rotation.x = -0.12;
      group.add(magMesh);
      muzzlePos.set(0, 0.025, -0.52);
    }

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.12, 0.055), polymerMat);
    grip.position.set(0, -0.07, 0.06);
    grip.rotation.x = 0.28;
    group.add(grip);

    sightGlow = new THREE.Mesh(new THREE.RingGeometry(0.003, 0.009, 16), opticGlowMat);
    sightGlow.position.set(0, 0.095, -0.08);
    group.add(sightGlow);
  }
  // ============================================================================
  // 4. SHOTGUNS (Double-Barrel, Drum Auto-12, Pump Breacher, Shock-Slug Cannon)
  // ============================================================================
  else if (weapon.category === 'Shotguns') {
    const rec = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.085, 0.34), gunMetalMat);
    rec.position.set(0, 0.02, -0.04);
    group.add(rec);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.1, 0.24), polymerMat);
    stock.position.set(0, -0.01, 0.22);
    group.add(stock);

    if (arch === 'double_barrel') {
      // Side-by-Side Twin Heavy Shotgun Barrels
      for (const side of [-1, 1]) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.62, 14), gunMetalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(side * 0.022, 0.035, -0.5);
        group.add(barrel);
      }
      const forend = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.042, 0.26), accentMat);
      forend.position.set(0, 0.005, -0.34);
      group.add(forend);
      magMesh = forend;
      muzzlePos.set(0, 0.035, -0.82);
    } else if (arch === 'drum_shotgun') {
      // Auto-Shotgun with Massive Under-Receiver Drum Magazine
      const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.07, 0.46), polymerMat);
      shroud.position.set(0, 0.025, -0.42);
      group.add(shroud);

      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.09, 18), accentMat);
      drum.rotation.x = Math.PI / 2;
      drum.position.set(0, -0.1, -0.1);
      group.add(drum);
      magMesh = drum;
      muzzlePos.set(0, 0.03, -0.68);
    } else {
      // Pump Breacher / Shock-Slug Shotgun with Ribbed Pump & Side Shell Saddle
      const mainBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.58, 14), gunMetalMat);
      mainBarrel.rotation.x = Math.PI / 2;
      mainBarrel.position.set(0, 0.042, -0.48);
      group.add(mainBarrel);

      const tubeMag = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 12), gunMetalMat);
      tubeMag.rotation.x = Math.PI / 2;
      tubeMag.position.set(0, 0.005, -0.45);
      group.add(tubeMag);

      // Ribbed sliding pump grip
      const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.2, 12), accentMat);
      pump.rotation.x = Math.PI / 2;
      pump.position.set(0, 0.005, -0.38);
      group.add(pump);
      magMesh = pump;

      // 4 visible shells on side saddle
      for (let i = 0; i < 4; i++) {
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.048, 8), opticGlowMat);
        shell.position.set(0.038, 0.02, -0.08 + i * 0.024);
        group.add(shell);
      }
      muzzlePos.set(0, 0.042, -0.78);
    }

    sightGlow = new THREE.Mesh(new THREE.RingGeometry(0.005, 0.014, 16), opticGlowMat);
    sightGlow.position.set(0, 0.085, -0.1);
    group.add(sightGlow);
  }
  // ============================================================================
  // 5. SNIPER RIFLES (50cal Bolt, Electromagnetic Railgun, Twin Outlaw, DMR)
  // ============================================================================
  else if (weapon.category === 'Sniper Rifles') {
    const rec = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.09, 0.48), gunMetalMat);
    rec.position.set(0, 0.02, -0.08);
    group.add(rec);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.32), polymerMat);
    stock.position.set(0, -0.02, 0.24);
    group.add(stock);

    const cheekPad = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.032, 0.14), accentMat);
    cheekPad.position.set(0, 0.06, 0.2);
    group.add(cheekPad);

    if (arch === 'railgun_sniper') {
      // Split Twin Electromagnetic Accelerator Rails + Floating Glowing Plasma Rings
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.032, 0.86), gunMetalMat);
        rail.position.set(side * 0.026, 0.038, -0.72);
        group.add(rail);

        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.82), opticGlowMat);
        strip.position.set(side * 0.015, 0.038, -0.72);
        group.add(strip);
      }
      for (let i = 0; i < 5; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.005, 8, 16), opticGlowMat);
        ring.position.set(0, 0.038, -0.42 - i * 0.14);
        group.add(ring);
      }
      muzzlePos.set(0, 0.038, -1.18);
    } else if (arch === 'double_sniper') {
      // Over-and-Under Twin Sniper Barrels
      for (const vOffset of [0.02, -0.018]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.75, 14), gunMetalMat);
        b.rotation.x = Math.PI / 2;
        b.position.set(0, 0.035 + vOffset, -0.68);
        group.add(b);
      }
      muzzlePos.set(0, 0.04, -1.08);
    } else {
      // Heavy Fluted 50cal / DMR Barrel + Arrowhead Muzzle Brake + Bipod
      const barrelLen = arch === 'dmr_sniper' ? 0.65 : 0.85;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, barrelLen, 16), gunMetalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.035, -0.32 - barrelLen / 2);
      group.add(barrel);

      const brake = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.042, 0.11), accentMat);
      brake.position.set(0, 0.035, -0.35 - barrelLen);
      group.add(brake);

      // Folded tactical bipod legs
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.24, 8), polymerMat);
        leg.rotation.x = Math.PI / 2 - 0.15;
        leg.position.set(side * 0.032, -0.02, -0.52);
        group.add(leg);
      }
      muzzlePos.set(0, 0.035, -0.42 - barrelLen);
    }

    // Telescopic Scope Assembly
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.36, 16), polymerMat);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.108, -0.08);
    group.add(scopeTube);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), glassLensMat);
    lens.position.set(0, 0.108, 0.1);
    group.add(lens);

    sightGlow = new THREE.Mesh(new THREE.RingGeometry(0.003, 0.015, 16), opticGlowMat);
    sightGlow.position.set(0, 0.108, 0.101);
    group.add(sightGlow);

    magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.16, 0.11), accentMat);
    magMesh.position.set(0, -0.11, -0.05);
    group.add(magMesh);
  }
  // ============================================================================
  // 6. LMGS / MACHINE GUNS (6-Barrel Rotary Minigun, Belt-Fed Box LMG, Arc LMG)
  // ============================================================================
  else if (weapon.category === 'LMGs') {
    const rec = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.11, 0.44), gunMetalMat);
    rec.position.set(0, 0.01, -0.06);
    group.add(rec);

    if (arch === 'rotary_minigun') {
      // 6-Barrel Gatling Minigun + Frontal Ballistic Energy Gun-Shield!
      const cluster = new THREE.Group();
      cluster.position.set(0, 0.015, -0.58);
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6;
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.62, 10), gunMetalMat);
        b.rotation.x = Math.PI / 2;
        b.position.set(Math.cos(angle) * 0.032, Math.sin(angle) * 0.032, 0);
        cluster.add(b);
      }
      // Barrel clamp discs
      for (const zOff of [-0.22, 0.0, 0.22]) {
        const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.02, 16), accentMat);
        clamp.rotation.x = Math.PI / 2;
        clamp.position.z = zOff;
        cluster.add(clamp);
      }
      group.add(cluster);

      // Frontal Hardlight Gun-Shield Panels
      for (const side of [-1, 1]) {
        const shieldWing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.01), shieldGlassMat);
        shieldWing.position.set(side * 0.11, 0.04, -0.34);
        shieldWing.rotation.y = side * 0.28;
        group.add(shieldWing);
      }
      muzzlePos.set(0, 0.015, -0.92);
    } else {
      // Heavy Finned LMG Barrel + Side Ammo Box & Brass Cartridge Belt
      const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.078, 0.45), polymerMat);
      shroud.position.set(0, 0.02, -0.44);
      group.add(shroud);

      const heavyBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.35, 14), gunMetalMat);
      heavyBarrel.rotation.x = Math.PI / 2;
      heavyBarrel.position.set(0, 0.025, -0.74);
      group.add(heavyBarrel);

      // Visible brass cartridge belt feeding from box into receiver
      for (let i = 0; i < 6; i++) {
        const bullet = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.042, 8), brassMat);
        bullet.rotation.x = Math.PI / 2;
        bullet.position.set(-0.045 - i * 0.004, -0.01 - i * 0.016, -0.08);
        group.add(bullet);
      }
      muzzlePos.set(0, 0.025, -0.94);
    }

    // Large Side/Bottom Box Magazine
    magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.14), accentMat);
    magMesh.position.set(-0.02, -0.12, -0.08);
    group.add(magMesh);

    sightGlow = new THREE.Mesh(new THREE.RingGeometry(0.004, 0.012, 16), opticGlowMat);
    sightGlow.position.set(0, 0.095, -0.08);
    group.add(sightGlow);
  }
  // ============================================================================
  // 7. HEAVY WEAPONS (Rocket Ordinance, 6-Shot Grenade Launcher, Plasma Cannon)
  // ============================================================================
  else if (weapon.category === 'Heavy Weapons') {
    if (arch === 'rocket_launcher') {
      // Oversized Shoulder-Mounted Rocket Launch Tube with Flared Venturi Exhaust
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.98, 20), gunMetalMat);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0.02, 0.04, -0.35);
      group.add(tube);

      const frontRim = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.012, 10, 20), accentMat);
      frontRim.position.set(0.02, 0.04, -0.84);
      group.add(frontRim);

      // Visible warhead nosecone inside tube
      const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.14, 14), opticGlowMat);
      warhead.rotation.x = -Math.PI / 2;
      warhead.position.set(0.02, 0.04, -0.8);
      group.add(warhead);
      magMesh = warhead;
      sightGlow = warhead;
      muzzlePos.set(0.02, 0.04, -0.88);
    } else if (arch === 'grenade_launcher') {
      // 6-Chamber Revolving 40mm Grenade Launcher
      const rec = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.28), gunMetalMat);
      rec.position.set(0, 0.02, 0.02);
      group.add(rec);

      const revDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.16, 12), accentMat);
      revDrum.rotation.x = Math.PI / 2;
      revDrum.position.set(0, 0.015, -0.18);
      group.add(revDrum);
      magMesh = revDrum;

      const stubBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 0.34, 16), gunMetalMat);
      stubBarrel.rotation.x = Math.PI / 2;
      stubBarrel.position.set(0, 0.035, -0.42);
      group.add(stubBarrel);

      sightGlow = new THREE.Mesh(new THREE.RingGeometry(0.004, 0.012, 16), opticGlowMat);
      sightGlow.position.set(0, 0.095, -0.18);
      group.add(sightGlow);
      muzzlePos.set(0, 0.035, -0.6);
    } else {
      // Plasma Cannon Ion-X with 3 Glowing Toroidal Containment Rings
      const coreChamber = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.72, 16), opticGlowMat);
      coreChamber.rotation.x = Math.PI / 2;
      coreChamber.position.set(0, 0.035, -0.4);
      group.add(coreChamber);
      sightGlow = coreChamber;

      for (let i = 0; i < 4; i++) {
        const torus = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.01, 10, 20), accentMat);
        torus.position.set(0, 0.035, -0.15 - i * 0.16);
        group.add(torus);
      }

      magMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 12), accentMat);
      magMesh.position.set(0, -0.1, -0.06);
      group.add(magMesh);
      muzzlePos.set(0, 0.035, -0.8);
    }
  }
  // ============================================================================
  // 8. ASSAULT RIFLES (Vandal AK, Phantom Silenced, Bullpup AR, Apex Tactical AR)
  // ============================================================================
  else {
    const rec = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.085, 0.38), gunMetalMat);
    rec.position.set(0, 0.02, -0.06);
    group.add(rec);

    if (arch === 'vandal_ak') {
      // AK/Vandal Silhouette: Upper Gas Tube + Curved Banana Mag + Slanted Compensator
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.058, 0.28), accentMat);
      handguard.position.set(0, 0.015, -0.36);
      group.add(handguard);

      const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 10), gunMetalMat);
      gasTube.rotation.x = Math.PI / 2;
      gasTube.position.set(0, 0.052, -0.38);
      group.add(gasTube);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.42, 14), gunMetalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.022, -0.62);
      group.add(barrel);

      // Curved banana magazine
      magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.24, 0.088), accentMat);
      magMesh.position.set(0, -0.125, -0.09);
      magMesh.rotation.x = -0.32;
      group.add(magMesh);
      muzzlePos.set(0, 0.022, -0.85);
    } else if (arch === 'phantom_carbine') {
      // Silenced Carbine with Long Integral Carbon Suppressor
      const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.038, 0.32, 12), polymerMat);
      guard.rotation.x = Math.PI / 2;
      guard.position.set(0, 0.025, -0.38);
      group.add(guard);

      const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.38, 16), accentMat);
      suppressor.rotation.x = Math.PI / 2;
      suppressor.position.set(0, 0.025, -0.7);
      group.add(suppressor);

      magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.21, 0.082), polymerMat);
      magMesh.position.set(0, -0.115, -0.06);
      magMesh.rotation.x = -0.14;
      group.add(magMesh);
      muzzlePos.set(0, 0.025, -0.9);
    } else if (arch === 'bullpup_ar') {
      // Bullpup Assault Rifle: Magazine behind trigger + Raised Scope Bridge
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.042, 0.32), accentMat);
      bridge.position.set(0, 0.085, -0.12);
      group.add(bridge);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.42, 14), gunMetalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.025, -0.45);
      group.add(barrel);

      magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.085), accentMat);
      magMesh.position.set(0, -0.11, 0.16);
      magMesh.rotation.x = -0.1;
      group.add(magMesh);
      muzzlePos.set(0, 0.025, -0.68);
    } else {
      // Apex-AR Tactical Rifle with Quad-Rail & Glowing Cyan Core Strips
      const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.34, 8), polymerMat);
      guard.rotation.x = Math.PI / 2;
      guard.position.set(0, 0.025, -0.4);
      group.add(guard);

      const coreStrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.32), opticGlowMat);
      coreStrip.position.set(0, 0.025, -0.38);
      group.add(coreStrip);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.35, 16), gunMetalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.025, -0.58);
      group.add(barrel);

      const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 0.07, 12), accentMat);
      flashHider.rotation.x = Math.PI / 2;
      flashHider.position.set(0, 0.025, -0.78);
      group.add(flashHider);

      magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.09), accentMat);
      magMesh.position.set(0, -0.12, -0.06);
      magMesh.rotation.x = -0.18;
      group.add(magMesh);
      muzzlePos.set(0, 0.025, -0.82);
    }

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.14, 0.06), polymerMat);
    grip.position.set(0, -0.08, 0.06);
    grip.rotation.x = 0.32;
    group.add(grip);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.09, 0.22), polymerMat);
    stock.position.set(0, 0.01, 0.22);
    group.add(stock);

    const sightHousing = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.05, 0.08), polymerMat);
    sightHousing.position.set(0, 0.095, -0.1);
    group.add(sightHousing);

    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.005), glassLensMat);
    lens.position.set(0, 0.095, -0.075);
    group.add(lens);

    sightGlow = new THREE.Mesh(new THREE.RingGeometry(0.003, 0.01, 16), opticGlowMat);
    sightGlow.position.set(0, 0.095, -0.074);
    group.add(sightGlow);
  }

  // Shared receiver detailing gives every weapon a finished, machined silhouette.
  if (weapon.category !== 'Melee' && !weapon.isMelee) {
    const railMat = new THREE.MeshStandardMaterial({ color: 0x090d14, roughness: 0.42, metalness: 0.72 });
    const receiverPlate = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.038, 0.13), accentMat);
    receiverPlate.position.set(0.039, 0.035, -0.07);
    group.add(receiverPlate);
    const ejectionPort = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.018, 0.055), polymerMat);
    ejectionPort.position.set(0.044, 0.037, -0.07);
    group.add(ejectionPort);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.012, 0.2), railMat);
    topRail.position.set(0, 0.078, -0.12);
    group.add(topRail);
    for (let i = 0; i < 7; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.012), gunMetalMat);
      tooth.position.set(0, 0.087, -0.2 + i * 0.026);
      group.add(tooth);
    }
    for (let i = 0; i < 3; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.018), railMat);
      vent.position.set(0.045, 0.035, -0.01 + i * 0.027);
      group.add(vent);
    }
  }

  // FIRST-PERSON AGENT-SPECIFIC SLEEVES, GAUNTLETS & GLOVES
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: agentVis.suitColor,
    roughness: 0.55,
    metalness: 0.35
  });
  const gloveLeatherMat = new THREE.MeshStandardMaterial({
    color: agentVis.armorColor,
    roughness: 0.45,
    metalness: 0.45
  });
  const knuckleCarbonMat = new THREE.MeshStandardMaterial({
    color: agentVis.accentColor,
    roughness: 0.25,
    metalness: 0.85
  });
  const agentGlowMat = new THREE.MeshBasicMaterial({
    color: agentVis.glowColor
  });

  // Right Hand & Forearm
  const rightArmGroup = new THREE.Group();
  const rPalm = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.065, 0.075), gloveLeatherMat);
  rPalm.position.set(0.015, -0.055, 0.075);
  rPalm.rotation.x = 0.3;
  rightArmGroup.add(rPalm);

  const rKnuckles = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.022, 0.045), knuckleCarbonMat);
  rKnuckles.position.set(0.018, -0.032, 0.06);
  rightArmGroup.add(rKnuckles);

  const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.28, 10), sleeveMat);
  rForearm.rotation.x = Math.PI / 2 - 0.32;
  rForearm.rotation.z = -0.18;
  rForearm.position.set(0.055, -0.11, 0.21);
  rightArmGroup.add(rForearm);
  group.add(rightArmGroup);

  // Left Support Hand & Agent Gauntlet
  const leftArmGroup = new THREE.Group();
  const isCompact = weapon.category === 'Pistols' || weapon.category === 'Melee';
  const supportZ = weapon.category === 'Melee' ? 0.04 : isCompact ? 0.01 : -0.34;
  const supportY = weapon.category === 'Melee' ? -0.095 : isCompact ? -0.055 : -0.015;

  const lPalm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, 0.085), gloveLeatherMat);
  lPalm.position.set(-0.022, supportY, supportZ);
  leftArmGroup.add(lPalm);

  const lThumb = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.025, 0.045), knuckleCarbonMat);
  lThumb.position.set(-0.028, supportY + 0.035, supportZ - 0.01);
  leftArmGroup.add(lThumb);

  const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.044, 0.32, 10), sleeveMat);
  lForearm.rotation.x = Math.PI / 2 - 0.38;
  lForearm.rotation.z = 0.35;
  lForearm.position.set(-0.11, supportY - 0.08, supportZ + 0.14);
  leftArmGroup.add(lForearm);

  // Agent-Themed Biometric Holo-Watch & Energy Conduit Strip on Left Wrist
  const watchBand = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.028, 12), knuckleCarbonMat);
  watchBand.rotation.x = Math.PI / 2 - 0.38;
  watchBand.rotation.z = 0.35;
  watchBand.position.set(-0.055, supportY - 0.03, supportZ + 0.05);
  leftArmGroup.add(watchBand);

  const watchFace = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.009, 0.024), agentGlowMat);
  watchFace.position.set(-0.042, supportY - 0.012, supportZ + 0.045);
  leftArmGroup.add(watchFace);

  group.add(leftArmGroup);

  return { group, muzzlePos, magMesh, sightGlow };
}

/**
 * Creates Bespoke, Visually Distinct 3D Character Operative Models for all 12 Agents!
 * Each Agent features their own signature suit palette, headgear/mask/visor silhouette,
 * shoulder armor, forearm gauntlets, and iconic 3D backpack/wing/weapon rig.
 */
export function createCharacterBotModel(
  team: 'alpha' | 'omega',
  agentCallsign: string,
  gender: 'Male' | 'Female' = 'Male'
): {
  group: THREE.Group;
  head: THREE.Mesh;
  torso: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  healthBarFill?: THREE.Mesh;
} {
  const callsignKey = (agentCallsign || 'VORTEX').toUpperCase();
  const cfg = AGENT_VISUAL_CONFIGS[callsignKey] || AGENT_VISUAL_CONFIGS.VORTEX;

  const group = new THREE.Group();
  group.name = `agent_${callsignKey}_${team}`;

  const isAlpha = team === 'alpha';
  const teamColor = isAlpha ? 0x00f0ff : 0xef4444;

  // Agent-specific materials (distinct per agent callsign!)
  const uniformMat = getMaterial(`suit_${callsignKey}`, () =>
    new THREE.MeshStandardMaterial({
      color: cfg.suitColor,
      roughness: 0.62,
      metalness: 0.22
    })
  );

  const armorMat = getMaterial(`armor_${callsignKey}`, () =>
    new THREE.MeshStandardMaterial({
      color: cfg.armorColor,
      roughness: 0.35,
      metalness: 0.65
    })
  );

  const accentMat = getMaterial(`accent_${callsignKey}`, () =>
    new THREE.MeshStandardMaterial({
      color: cfg.accentColor,
      roughness: 0.3,
      metalness: 0.75
    })
  );

  const agentGlowMat = getMaterial(`glow_${callsignKey}`, () =>
    new THREE.MeshBasicMaterial({
      color: cfg.glowColor
    })
  );

  const visorMat = getMaterial(`visor_${callsignKey}`, () =>
    new THREE.MeshPhysicalMaterial({
      color: cfg.glowColor,
      emissive: cfg.glowColor,
      emissiveIntensity: 0.55,
      roughness: 0.1,
      metalness: 0.9,
      clearcoat: 1.0
    })
  );

  const skinMat = getMaterial(`skin_${callsignKey}`, () =>
    new THREE.MeshStandardMaterial({
      color: cfg.skinColor,
      roughness: 0.65,
      metalness: 0.05
    })
  );

  const darkMetalMat = getMaterial('dark_metal_shared', () =>
    new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.35,
      metalness: 0.8
    })
  );

  const teamBadgeMat = getMaterial(`iff_${team}`, () =>
    new THREE.MeshBasicMaterial({
      color: teamColor
    })
  );

  const isFemale = gender === 'Female';
  const bulk = cfg.bulkScale;
  const chestWidth = (isFemale ? 0.52 : 0.62) * bulk;
  const waistWidth = (isFemale ? 0.42 : 0.54) * bulk;
  const heightScale = (isFemale ? 0.96 : 1.0) * (callsignKey === 'TITAN' ? 1.06 : callsignKey === 'BUNKER' ? 1.03 : 1.0);

  // ==========================================================================
  // 1. TORSO, AGENT CHEST RIG & BESPOKE BACKPACK / WINGS / KATANA ATTACHMENT
  // ==========================================================================
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(chestWidth / 2, waistWidth / 2, 0.76, 12),
    uniformMat
  );
  torso.position.y = 1.25 * heightScale;
  torso.castShadow = true;
  group.add(torso);

  // Contoured Chest Armor Plate
  const plateCarrier = new THREE.Mesh(
    new THREE.BoxGeometry(chestWidth * 0.92, 0.52, 0.28 * bulk),
    armorMat
  );
  plateCarrier.position.set(0, 0.06, 0.02);
  plateCarrier.castShadow = true;
  torso.add(plateCarrier);

  const harnessMat = darkMetalMat;
  for (const side of [-1, 1]) {
    const harnessStrap = new THREE.Mesh(
      new THREE.BoxGeometry(0.052 * bulk, 0.48, 0.035),
      harnessMat
    );
    harnessStrap.position.set(side * chestWidth * 0.24, 0.07, 0.17 * bulk);
    harnessStrap.rotation.z = side * -0.12;
    torso.add(harnessStrap);
  }
  const utilityBelt = new THREE.Mesh(
    new THREE.BoxGeometry(chestWidth * 0.82, 0.075, 0.34 * bulk),
    darkMetalMat
  );
  utilityBelt.position.set(0, -0.23, 0.015);
  torso.add(utilityBelt);
  for (const side of [-1, 1]) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.13 * bulk, 0.14, 0.11), accentMat);
    pouch.position.set(side * chestWidth * 0.31, -0.25, 0.17 * bulk);
    torso.add(pouch);
  }

  // Agent Signature Glowing Core Emblem on Chest
  const chestCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.065, 0),
    agentGlowMat
  );
  chestCore.position.set(0, 0.1, 0.17 * bulk);
  torso.add(chestCore);

  // Team IFF Collar Trim (so Alpha vs Omega is unmistakable while keeping Agent colors)
  const collarIFF = new THREE.Mesh(
    new THREE.BoxGeometry(chestWidth * 0.72, 0.045, 0.03),
    teamBadgeMat
  );
  collarIFF.position.set(0, 0.28, 0.16 * bulk);
  torso.add(collarIFF);

  // BESPOKE AGENT BACKPACK / SILHOUETTE RIG (Unique per Agent!)
  const backZ = -0.18 * bulk;
  switch (callsignKey) {
    case 'VORTEX': {
      // Twin Angled Kinetic Jump-Jet Thruster Pods with Cyan Plasma Nozzles
      for (const side of [-1, 1]) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.48, 10), armorMat);
        pod.position.set(side * 0.15, 0.08, backZ - 0.06);
        pod.rotation.z = side * -0.22;
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.08, 10), agentGlowMat);
        nozzle.position.y = -0.26;
        pod.add(nozzle);
        const wingFin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.02), accentMat);
        wingFin.position.set(side * 0.12, 0.06, 0);
        pod.add(wingFin);
        torso.add(pod);
      }
      break;
    }
    case 'UMBRA': {
      // Stealth Recon Drone Dock & Flowing Shadow Cape Panels
      const dronePack = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 1), armorMat);
      dronePack.position.set(0, 0.12, backZ - 0.05);
      torso.add(dronePack);
      const sensorRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 20), agentGlowMat);
      sensorRing.position.set(0, 0.12, backZ - 0.08);
      torso.add(sensorRing);
      const cape = new THREE.Mesh(new THREE.BoxGeometry(chestWidth * 0.85, 0.78, 0.025), uniformMat);
      cape.position.set(0, -0.22, backZ - 0.02);
      cape.rotation.x = 0.12;
      torso.add(cape);
      break;
    }
    case 'CRYO': {
      // Twin Pressurized Frost-Blue Liquid Nitrogen Cylinders & Parka Fur Collar
      for (const side of [-1, 1]) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.46, 12), accentMat);
        tank.position.set(side * 0.12, 0.05, backZ - 0.06);
        const frostCap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), agentGlowMat);
        frostCap.position.y = 0.23;
        tank.add(frostCap);
        torso.add(tank);
      }
      const furCollar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.065, 8, 16), uniformMat);
      furCollar.rotation.x = Math.PI / 2;
      furCollar.position.set(0, 0.36, -0.02);
      torso.add(furCollar);
      break;
    }
    case 'BUNKER': {
      // Heavy Munitions & Folded Auto-Turret Backpack + Neck Blast Guard
      const heavyPack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.24), armorMat);
      heavyPack.position.set(0, 0.08, backZ - 0.1);
      torso.add(heavyPack);
      const hazardBar = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.25), accentMat);
      hazardBar.position.set(0, 0.22, backZ - 0.1);
      torso.add(hazardBar);
      const neckShield = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.18, 12, 1, true, Math.PI * 0.65, Math.PI * 1.7), armorMat);
      neckShield.position.set(0, 0.38, 0);
      torso.add(neckShield);
      break;
    }
    case 'AETHER': {
      // Glowing Emerald Nanite Valkyrie Wings & Triage Med-Core
      const medCore = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), armorMat);
      medCore.rotation.x = Math.PI / 2;
      medCore.position.set(0, 0.12, backZ - 0.04);
      torso.add(medCore);
      for (const side of [-1, 1]) {
        const upperWing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.025), agentGlowMat);
        upperWing.position.set(side * 0.26, 0.24, backZ - 0.06);
        upperWing.rotation.z = side * 0.42;
        torso.add(upperWing);

        const lowerWing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.055, 0.025), accentMat);
        lowerWing.position.set(side * 0.22, 0.04, backZ - 0.06);
        lowerWing.rotation.z = side * -0.25;
        torso.add(lowerWing);
      }
      break;
    }
    case 'IGNIS': {
      // Twin Molten Napalm Fuel Drums & Exhaust Stacks
      for (const side of [-1, 1]) {
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.44, 12), accentMat);
        drum.position.set(side * 0.13, 0.06, backZ - 0.07);
        const gauge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.04), agentGlowMat);
        gauge.position.set(0, 0, -0.09);
        drum.add(gauge);
        torso.add(drum);
      }
      break;
    }
    case 'MIRAGE': {
      // Floating Holographic 6-Point Prism Halo Ring behind shoulders
      const holoRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 8, 6), agentGlowMat);
      holoRing.position.set(0, 0.22, backZ - 0.1);
      torso.add(holoRing);
      const innerPrism = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), accentMat);
      innerPrism.position.set(0, 0.22, backZ - 0.1);
      torso.add(innerPrism);
      break;
    }
    case 'ROOK': {
      // Tactical Spec-Ops Command Radio Pack, Whip Antenna & Waist Trench Plates
      const tacPack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.18), armorMat);
      tacPack.position.set(0, 0.08, backZ - 0.06);
      torso.add(tacPack);
      const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.55, 6), darkMetalMat);
      whip.position.set(0.14, 0.42, backZ - 0.06);
      torso.add(whip);
      const coatSkirt = new THREE.Mesh(new THREE.CylinderGeometry(waistWidth * 0.52, waistWidth * 0.64, 0.34, 10), uniformMat);
      coatSkirt.position.set(0, -0.38, 0);
      torso.add(coatSkirt);
      break;
    }
    case 'KAGE': {
      // Crossed Dual High-Frequency Shinobi Katanas on Back + Crimson Scarf Tail
      for (const side of [-1, 1]) {
        const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.78, 0.025), darkMetalMat);
        scabbard.position.set(0, 0.12, backZ - 0.05);
        scabbard.rotation.z = side * 0.52;
        const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, 0.035), agentGlowMat);
        hilt.position.y = 0.45;
        scabbard.add(hilt);
        torso.add(scabbard);
      }
      break;
    }
    case 'PULSE': {
      // Electronic Warfare Radar Dish & Dual Signal Transceivers
      const radarDish = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.08, 0.08, 16), accentMat);
      radarDish.rotation.x = Math.PI / 2;
      radarDish.position.set(0, 0.15, backZ - 0.08);
      torso.add(radarDish);
      const dishCore = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), agentGlowMat);
      dishCore.position.set(0, 0.15, backZ - 0.12);
      torso.add(dishCore);
      break;
    }
    case 'FLORA': {
      // Bioluminescent Botanical Spore Pod & Living Leaf Petals
      const bioPod = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), agentGlowMat);
      bioPod.scale.set(1, 1.3, 0.8);
      bioPod.position.set(0, 0.1, backZ - 0.06);
      torso.add(bioPod);
      for (const side of [-1, 1]) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 5), accentMat);
        leaf.position.set(side * 0.18, 0.22, backZ - 0.04);
        leaf.rotation.z = side * -0.45;
        torso.add(leaf);
      }
      break;
    }
    case 'TITAN': {
      // Colossal Tectonic Seismic Reactor Core & Dual Piston Stabilizers
      const reactor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.48, 8), armorMat);
      reactor.rotation.x = Math.PI / 2;
      reactor.position.set(0, 0.1, backZ - 0.1);
      torso.add(reactor);
      const reactorGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.52, 8), agentGlowMat);
      reactorGlow.rotation.x = Math.PI / 2;
      reactorGlow.position.set(0, 0.1, backZ - 0.1);
      torso.add(reactorGlow);
      break;
    }
  }

  // ==========================================================================
  // 2. NECK & HEAD WITH BESPOKE AGENT HEADGEAR / MASK / VISOR
  // ==========================================================================
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.14, 10), skinMat);
  neck.position.y = 0.44;
  torso.add(neck);

  // Head Mesh (Used for headshot raycasting)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), skinMat);
  head.position.y = 1.92 * heightScale;
  head.scale.set(0.92, 1.05, 1.0);
  head.castShadow = true;
  group.add(head);

  // Agent-Specific Headgear & Visor Silhouette
  switch (callsignKey) {
    case 'VORTEX': {
      // Aerodynamic Swept Pilot Helmet + Dual Cyan Aero Fins + V-Visor
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), armorMat);
      helm.position.set(0, 0.02, 0);
      head.add(helm);
      const vVisor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.16), visorMat);
      vVisor.position.set(0, 0.02, 0.16);
      head.add(vVisor);
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.34), agentGlowMat);
      crest.position.set(0, 0.22, -0.04);
      head.add(crest);
      break;
    }
    case 'UMBRA': {
      // Dark Stealth Hood Cowl + 4-Tube Glowing Purple Night-Vision Goggles (NVGs)
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.255, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.72), uniformMat);
      hood.position.set(0, 0.03, -0.02);
      head.add(hood);
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.18), darkMetalMat);
      mask.position.set(0, -0.06, 0.12);
      head.add(mask);
      for (const lx of [-0.11, -0.04, 0.04, 0.11]) {
        const nvgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.12, 8), agentGlowMat);
        nvgTube.rotation.x = Math.PI / 2;
        nvgTube.position.set(lx, 0.04, 0.22);
        head.add(nvgTube);
      }
      break;
    }
    case 'CRYO': {
      // Full-Face Reflective Ice-Blue Cryo-Dome Helmet
      const cryoDome = new THREE.Mesh(new THREE.SphereGeometry(0.245, 16, 16), visorMat);
      head.add(cryoDome);
      const rebreather = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 10), armorMat);
      rebreather.rotation.x = Math.PI / 2;
      rebreather.position.set(0, -0.08, 0.2);
      head.add(rebreather);
      break;
    }
    case 'BUNKER': {
      // Heavy EOD Juggernaut Blast Helmet with Thick Slit Visor
      const juggHelm = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.38, 12), armorMat);
      juggHelm.position.set(0, 0.02, 0);
      head.add(juggHelm);
      const blastShield = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.14), accentMat);
      blastShield.position.set(0, 0.03, 0.18);
      head.add(blastShield);
      const eyeSlit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.16), agentGlowMat);
      eyeSlit.position.set(0, 0.04, 0.18);
      head.add(eyeSlit);
      break;
    }
    case 'AETHER': {
      // Sculpted Hair + Medical Valkyrie Tiara Crown + Emerald Holo-Visor
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.235, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), darkMetalMat);
      hair.position.set(0, 0.04, -0.02);
      head.add(hair);
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), darkMetalMat);
      bun.position.set(0, 0.12, -0.24);
      head.add(bun);
      const tiara = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 20, Math.PI), agentGlowMat);
      tiara.position.set(0, 0.06, 0.05);
      head.add(tiara);
      const holoVisor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.065, 0.12), visorMat);
      holoVisor.position.set(0, 0.03, 0.18);
      head.add(holoVisor);
      break;
    }
    case 'IGNIS': {
      // Pyrotechnic Respirator Mask + Blazing Orange Fire Goggles + Flame Mohawk Crest
      const respMask = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.2), armorMat);
      respMask.position.set(0, -0.07, 0.12);
      head.add(respMask);
      for (const gx of [-0.08, 0.08]) {
        const goggle = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.08, 12), agentGlowMat);
        goggle.rotation.x = Math.PI / 2;
        goggle.position.set(gx, 0.04, 0.2);
        head.add(goggle);
      }
      const mohawk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.32), accentMat);
      mohawk.position.set(0, 0.22, -0.02);
      head.add(mohawk);
      break;
    }
    case 'MIRAGE': {
      // Sleek Magenta Holo-Crown Visor & Twin Cyber Tails
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.18, 4), accentMat);
      crown.position.set(0, 0.2, 0);
      crown.rotation.y = Math.PI / 4;
      head.add(crown);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.16), visorMat);
      visor.position.set(0, 0.03, 0.16);
      head.add(visor);
      break;
    }
    case 'ROOK': {
      // Commander Tactical Beret + Ballistic Jaw Mask + Cyber Eyepiece
      const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.09, 16), accentMat);
      beret.position.set(0.03, 0.19, 0);
      beret.rotation.z = -0.18;
      head.add(beret);
      const jawMask = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.15, 0.2), armorMat);
      jawMask.position.set(0, -0.07, 0.12);
      head.add(jawMask);
      const eyePiece = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.14), visorMat);
      eyePiece.position.set(0, 0.04, 0.17);
      head.add(eyePiece);
      break;
    }
    case 'KAGE': {
      // Cyber-Shinobi Oni Horned Mask & Glowing Crimson Visor Slit
      const cowl = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), uniformMat);
      head.add(cowl);
      const eyeSlit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.045, 0.16), agentGlowMat);
      eyeSlit.position.set(0, 0.04, 0.17);
      head.add(eyeSlit);
      for (const hx of [-0.11, 0.11]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 6), agentGlowMat);
        horn.position.set(hx, 0.24, 0.08);
        horn.rotation.x = -0.35;
        horn.rotation.z = hx > 0 ? -0.25 : 0.25;
        head.add(horn);
      }
      break;
    }
    case 'PULSE': {
      // Spiky Tech Hair + Wide Cyan LED Matrix Shades & Comms Headset
      const techHair = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), darkMetalMat);
      techHair.position.set(0, 0.1, -0.03);
      head.add(techHair);
      const ledShades = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.075, 0.15), agentGlowMat);
      ledShades.position.set(0, 0.04, 0.17);
      head.add(ledShades);
      break;
    }
    case 'FLORA': {
      // Botanical Crown Crest, Braided Hair & Glowing Lime Bio-Visor
      const bioCrown = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 12), agentGlowMat);
      bioCrown.rotation.x = Math.PI / 2 - 0.25;
      bioCrown.position.set(0, 0.16, 0.02);
      head.add(bioCrown);
      const bioVisor = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.065, 0.14), visorMat);
      bioVisor.position.set(0, 0.03, 0.17);
      head.add(bioVisor);
      break;
    }
    case 'TITAN':
    default: {
      // Angular Tectonic Iron-Jawed Helmet with Glowing Amber T-Visor
      const titanHelm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), armorMat);
      head.add(titanHelm);
      const hVisor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.1), agentGlowMat);
      hVisor.position.set(0, 0.05, 0.16);
      head.add(hVisor);
      const vVisor = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.1), agentGlowMat);
      vVisor.position.set(0, -0.02, 0.16);
      head.add(vVisor);
      break;
    }
  }

  // ==========================================================================
  // 3. ARTICULATED ARMS WITH AGENT PAULDRONS & GAUNTLETS
  // ==========================================================================
  const shoulderRadius = 0.125 * bulk;
  const shoulderGeom =
    callsignKey === 'BUNKER' || callsignKey === 'TITAN'
      ? new THREE.BoxGeometry(shoulderRadius * 2.1, shoulderRadius * 1.8, shoulderRadius * 2.1)
      : new THREE.SphereGeometry(shoulderRadius, 12, 10);

  const upperArmGeom = new THREE.CylinderGeometry(0.08 * bulk, 0.07 * bulk, 0.35, 10);
  const forearmRadius = (callsignKey === 'TITAN' || callsignKey === 'IGNIS' ? 0.095 : 0.072) * bulk;
  const forearmGeom = new THREE.CylinderGeometry(forearmRadius, forearmRadius * 0.92, 0.32, 10);
  const gloveGeom = new THREE.BoxGeometry(0.085 * bulk, 0.1, 0.065 * bulk);

  // Left Arm
  const leftArm = new THREE.Group();
  leftArm.position.set(-chestWidth * 0.58, 1.58 * heightScale, 0);

  const leftShoulder = new THREE.Mesh(shoulderGeom, accentMat);
  leftArm.add(leftShoulder);
  const leftIFF = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.025, 0.035), teamBadgeMat);
  leftIFF.position.set(-shoulderRadius * 0.12, 0.035, shoulderRadius * 0.82);
  leftArm.add(leftIFF);

  const leftUpper = new THREE.Mesh(upperArmGeom, uniformMat);
  leftUpper.position.y = -0.2;
  leftArm.add(leftUpper);

  const leftForearm = new THREE.Mesh(forearmGeom, armorMat);
  leftForearm.position.set(0, -0.52, 0.05);
  leftForearm.rotation.x = -0.3;
  leftArm.add(leftForearm);

  const leftGlove = new THREE.Mesh(gloveGeom, accentMat);
  leftGlove.position.set(0, -0.7, 0.12);
  leftArm.add(leftGlove);
  group.add(leftArm);

  // Right Arm + Held 3D Carbine
  const rightArm = new THREE.Group();
  rightArm.position.set(chestWidth * 0.58, 1.58 * heightScale, 0);

  const rightShoulder = new THREE.Mesh(shoulderGeom, accentMat);
  rightArm.add(rightShoulder);
  const rightIFF = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.025, 0.035), teamBadgeMat);
  rightIFF.position.set(shoulderRadius * 0.12, 0.035, shoulderRadius * 0.82);
  rightArm.add(rightIFF);

  const rightUpper = new THREE.Mesh(upperArmGeom, uniformMat);
  rightUpper.position.y = -0.2;
  rightArm.add(rightUpper);

  const rightForearm = new THREE.Mesh(forearmGeom, armorMat);
  rightForearm.position.set(0, -0.52, 0.12);
  rightForearm.rotation.x = -0.5;
  rightArm.add(rightForearm);

  const rightGlove = new THREE.Mesh(gloveGeom, accentMat);
  rightGlove.position.set(0, -0.7, 0.22);
  rightArm.add(rightGlove);

  // 3D Carbine in Hands (pointing forward along +Z)
  const carbineGroup = new THREE.Group();
  carbineGroup.position.set(-0.12, -0.64, 0.34);
  carbineGroup.rotation.y = 0.08;

  const carbineRec = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.45), darkMetalMat);
  carbineGroup.add(carbineRec);

  const carbineBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 10), darkMetalMat);
  carbineBarrel.rotation.x = Math.PI / 2;
  carbineBarrel.position.set(0, 0.02, 0.35);
  carbineGroup.add(carbineBarrel);

  const carbineMuzzleGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.055, 8),
    agentGlowMat
  );
  carbineMuzzleGlow.rotation.x = Math.PI / 2;
  carbineMuzzleGlow.position.set(0, 0.02, 0.52);
  carbineGroup.add(carbineMuzzleGlow);

  const carbineMag = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.16, 0.08), accentMat);
  carbineMag.position.set(0, -0.1, 0.06);
  carbineMag.rotation.x = 0.2;
  carbineGroup.add(carbineMag);

  rightArm.add(carbineGroup);
  group.add(rightArm);

  // ==========================================================================
  // 4. ARTICULATED LEGS WITH AGENT KNEE PADS & BOOTS
  // ==========================================================================
  const legSpacing = chestWidth * 0.24;
  const thighGeom = new THREE.CylinderGeometry(0.12 * bulk, 0.1 * bulk, 0.45, 10);
  const kneeGeom = new THREE.CylinderGeometry(0.105 * bulk, 0.095 * bulk, 0.12, 10);
  const shinGeom = new THREE.CylinderGeometry(0.092 * bulk, 0.082 * bulk, 0.38, 10);
  const bootGeom = new THREE.BoxGeometry(0.135 * bulk, 0.12, 0.25);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-legSpacing, 0.9 * heightScale, 0);

  const leftThigh = new THREE.Mesh(thighGeom, uniformMat);
  leftThigh.position.y = -0.22;
  leftLeg.add(leftThigh);

  const leftKnee = new THREE.Mesh(kneeGeom, accentMat);
  leftKnee.position.set(0, -0.44, 0.04);
  leftLeg.add(leftKnee);

  const leftShin = new THREE.Mesh(shinGeom, armorMat);
  leftShin.position.y = -0.65;
  leftLeg.add(leftShin);

  const leftBoot = new THREE.Mesh(bootGeom, darkMetalMat);
  leftBoot.position.set(0, -0.85, 0.04);
  leftLeg.add(leftBoot);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(legSpacing, 0.9 * heightScale, 0);

  const rightThigh = new THREE.Mesh(thighGeom, uniformMat);
  rightThigh.position.y = -0.22;
  rightLeg.add(rightThigh);

  const rightKnee = new THREE.Mesh(kneeGeom, accentMat);
  rightKnee.position.set(0, -0.44, 0.04);
  rightLeg.add(rightKnee);

  const rightShin = new THREE.Mesh(shinGeom, armorMat);
  rightShin.position.y = -0.65;
  rightLeg.add(rightShin);

  const rightBoot = new THREE.Mesh(bootGeom, darkMetalMat);
  rightBoot.position.set(0, -0.85, 0.04);
  rightLeg.add(rightBoot);
  group.add(rightLeg);

  // ==========================================================================
  // 5. CONTACT SHADOW DISC & 3D OVERHEAD HEALTH BAR + AGENT ACCENT PIP
  // ==========================================================================
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.48 * bulk, 20),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  group.add(shadowDisc);

  const hbGroup = new THREE.Group();
  hbGroup.position.set(0, 2.38 * heightScale, 0);

  const hbBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.08),
    new THREE.MeshBasicMaterial({
      color: 0x090d16,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88
    })
  );
  hbGroup.add(hbBg);

  const healthBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.66, 0.052),
    new THREE.MeshBasicMaterial({
      color: teamColor,
      side: THREE.DoubleSide
    })
  );
  healthBarFill.position.z = 0.004;
  hbGroup.add(healthBarFill);

  // Agent Identity Diamond above Health Bar in Agent's signature glow color
  const agentPip = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.055, 0),
    agentGlowMat
  );
  agentPip.position.set(0, 0.11, 0);
  hbGroup.add(agentPip);

  group.add(hbGroup);

  return { group, head, torso, leftArm, rightArm, leftLeg, rightLeg, healthBarFill };
}

/**
 * Creates 3D Nexus Core (Spike Objective)
 */
export function createNexusCoreObjective(): {
  group: THREE.Group;
  rings: THREE.Group;
  coreGlow: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.name = 'nexus_core_objective';

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.25,
    metalness: 0.85
  });

  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff
  });

  const baseGeom = new THREE.CylinderGeometry(0.42, 0.52, 0.22, 8);
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = 0.11;
  group.add(base);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const pylonGeom = new THREE.BoxGeometry(0.09, 0.65, 0.09);
    const pylon = new THREE.Mesh(pylonGeom, baseMat);
    pylon.position.set(Math.cos(angle) * 0.35, 0.42, Math.sin(angle) * 0.35);
    group.add(pylon);
  }

  const rings = new THREE.Group();
  rings.position.y = 0.52;

  const ring1Geom = new THREE.TorusGeometry(0.28, 0.022, 12, 32);
  const ring1 = new THREE.Mesh(ring1Geom, baseMat);
  rings.add(ring1);

  const ring2Geom = new THREE.TorusGeometry(0.2, 0.018, 12, 32);
  const ring2 = new THREE.Mesh(ring2Geom, baseMat);
  ring2.rotation.x = Math.PI / 3;
  rings.add(ring2);

  group.add(rings);

  const coreGeom = new THREE.OctahedronGeometry(0.14, 2);
  const coreGlow = new THREE.Mesh(coreGeom, coreMat);
  coreGlow.position.y = 0.52;
  group.add(coreGlow);

  return { group, rings, coreGlow };
}

/**
 * Creates 3D Ability Deployables (Ice Wall, Barricade, Sonar Dart, Smoke Sphere)
 */
export function createAbilityMesh(abilityType: string, position: THREE.Vector3, yaw: number = 0): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = yaw;

  if (abilityType === 'ice_wall') {
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.8,
      transparent: true,
      opacity: 0.88,
      ior: 1.31
    });
    for (let i = -2; i <= 2; i++) {
      const pillarGeom = new THREE.BoxGeometry(1.2, 4.0, 0.8);
      const pillar = new THREE.Mesh(pillarGeom, iceMat);
      pillar.position.set(i * 1.25, 2.0, 0);
      group.add(pillar);
    }
  } else if (abilityType === 'smoke_sphere') {
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.95,
      metalness: 0.05,
      transparent: true,
      opacity: 0.96
    });
    const sphereGeom = new THREE.SphereGeometry(4.8, 24, 24);
    const sphere = new THREE.Mesh(sphereGeom, smokeMat);
    sphere.position.y = 2.5;
    group.add(sphere);
  } else if (abilityType === 'hardlight_shield') {
    const shieldMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.75,
      transmission: 0.6
    });
    const shieldGeom = new THREE.BoxGeometry(3.2, 1.8, 0.15);
    const shield = new THREE.Mesh(shieldGeom, shieldMat);
    shield.position.y = 0.9;
    group.add(shield);
  }

  return group;
}

/**
 * Creates 3D Dropped Spike (Nexus Core) Pickup Canister Model with Holographic Beacon Ring
 */
export function createDroppedSpikePickupModel(): {
  group: THREE.Group;
  beaconRing: THREE.Mesh;
  coreMesh: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.name = 'dropped_spike_pickup';

  const casingMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.25,
    metalness: 0.85
  });

  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.2,
    metalness: 0.9
  });

  const coreGlowMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24
  });

  // Ground Beacon Ring so Attackers & Defenders can spot the dropped Spike from across the site
  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(0.65, 0.85, 24),
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    })
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.03;
  group.add(beaconRing);

  // Vertical Holographic Light Pillar
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 3.6, 12),
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.35
    })
  );
  pillar.position.y = 1.8;
  group.add(pillar);

  // Tilted Spike Canister Assembly
  const canister = new THREE.Group();
  canister.position.y = 0.36;
  canister.rotation.z = 0.32;

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.52, 8), casingMat);
  canister.add(base);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 8, 16), goldTrimMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.16;
  canister.add(collar);

  const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 1), coreGlowMat);
  coreMesh.position.y = 0.38;
  canister.add(coreMesh);

  group.add(canister);

  return { group, beaconRing, coreMesh };
}
