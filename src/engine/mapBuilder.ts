import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapData } from '../types/game';
import { createBumpTexture, getProceduralTexture } from './realisticTextures';

export interface MapCollider {
  box: THREE.Box3;
  mesh: THREE.Object3D;
  isCover: boolean;
  isWall: boolean;
  isExplosiveBarrel?: boolean;
  barrelHealth?: number;
}

export interface BuiltMap {
  sceneGroup: THREE.Group;
  colliders: MapCollider[];
  batchedMeshes: THREE.Mesh[];
  siteAMesh: THREE.Group;
  siteBMesh: THREE.Group;
  batchStats: {
    originalMeshCount: number;
    batchedDrawCalls: number;
  };
}

/**
 * Ensures a cloned BufferGeometry is non-indexed and has consistent (position, normal, uv) attributes
 * before baking its world transform so BufferGeometryUtils.mergeGeometries succeeds across all primitive types.
 */
function prepareGeometryForStaticBatch(
  sourceGeom: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4
): THREE.BufferGeometry {
  const geom = sourceGeom.index ? sourceGeom.toNonIndexed() : sourceGeom.clone();
  geom.applyMatrix4(worldMatrix);

  if (!geom.attributes.normal) {
    geom.computeVertexNormals();
  }
  const vertexCount = geom.attributes.position.count;
  if (!geom.attributes.uv) {
    const uvs = new Float32Array(vertexCount * 2);
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }

  // Strip any extra attributes (like uv1) so all geometries in a material bucket have identical attribute schemas
  for (const attrName of Object.keys(geom.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
      geom.deleteAttribute(attrName);
    }
  }
  return geom;
}

/**
 * Builds 5 radically distinct, bespoke 3D competitive tactical maps
 * and performs Static Geometry Batching by material to minimize draw calls on desktop and mobile GPUs.
 */
export function buildMap(mapData: MapData): BuiltMap {
  const sceneGroup = new THREE.Group();
  sceneGroup.name = `map_${mapData.id}`;
  const colliders: MapCollider[] = [];

  // Helper to add solid architectural geometry with AABB collision
  const addSolid = (
    geom: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: THREE.Vector3,
    rotY = 0,
    isWall = false,
    isCover = true
  ) => {
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(pos);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    sceneGroup.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    colliders.push({ box, mesh, isCover, isWall });
    return mesh;
  };

  // Helper to add visual-only architectural detail (skyboxes, arches, overhead beams, foliage)
  const addDecor = (
    geom: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: THREE.Vector3,
    rotX = 0,
    rotY = 0,
    rotZ = 0
  ) => {
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(pos);
    mesh.rotation.set(rotX, rotY, rotZ);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    sceneGroup.add(mesh);
    return mesh;
  };

  // Helper to build walkable stepped ramps (each step rises <= 0.40m so player & bots smoothly walk up!)
  const addWalkableStairs = (
    startX: number,
    startZ: number,
    dirX: number,
    dirZ: number,
    width: number,
    stepDepth: number,
    numSteps: number,
    stepRise: number,
    mat: THREE.Material
  ) => {
    const isAlongZ = Math.abs(dirZ) >= Math.abs(dirX);
    for (let i = 1; i <= numSteps; i++) {
      const h = i * stepRise;
      const sx = startX + dirX * (i - 0.5) * stepDepth;
      const sz = startZ + dirZ * (i - 0.5) * stepDepth;
      const geom = isAlongZ
        ? new THREE.BoxGeometry(width, h, stepDepth + 0.08)
        : new THREE.BoxGeometry(stepDepth + 0.08, h, width);
      addSolid(geom, mat, new THREE.Vector3(sx, h / 2, sz), 0, false, true);
    }
  };

  // Shared Material Pool for Containers & Building Cornices (maximizes static batch merging)
  const containerColors = ['#0284c7', '#dc2626', '#d97706', '#059669', '#334155'];
  const containerMatPool = containerColors.map(
    contColor =>
      new THREE.MeshStandardMaterial({
        map: getProceduralTexture('container_ribs', { color: contColor }),
        roughness: 0.45,
        metalness: 0.25
      })
  );
  const sharedCornerMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.4 });
  const corniceMatCache = new Map<number, THREE.MeshStandardMaterial>();
  const getCorniceMat = (trimColor: number) => {
    if (!corniceMatCache.has(trimColor)) {
      corniceMatCache.set(
        trimColor,
        new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.45, metalness: 0.25 })
      );
    }
    return corniceMatCache.get(trimColor)!;
  };

  // Track dynamic/destructible root objects that must NOT be merged into static geometry batches
  const dynamicRoots = new Set<THREE.Object3D>();

  const addShippingContainer = (x: number, y: number, z: number, rotY = 0, colorIdx = 0) => {
    const contMat = containerMatPool[colorIdx % containerMatPool.length];
    const contMesh = addSolid(
      new THREE.BoxGeometry(2.6, 2.66, 6.2),
      contMat,
      new THREE.Vector3(x, y, z),
      rotY,
      false,
      true
    );
    for (const cx of [-1.3, 1.3]) {
      for (const cz of [-3.1, 3.1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.68, 0.14), sharedCornerMat);
        pillar.position.set(cx, 0, cz);
        contMesh.add(pillar);
      }
    }
    return contMesh;
  };

  // Helper for Multi-Story Building Complexes with Rooftop Cornices
  const addBuilding = (
    w: number,
    h: number,
    d: number,
    x: number,
    z: number,
    mat: THREE.Material,
    trimColor = 0x0f172a
  ) => {
    const mesh = addSolid(new THREE.BoxGeometry(w, h, d), mat, new THREE.Vector3(x, h / 2, z), 0, true, true);
    const cornice = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5),
      getCorniceMat(trimColor)
    );
    cornice.position.set(0, h / 2 + 0.25, 0);
    mesh.add(cornice);
    return mesh;
  };

  // Helper for Pressurized Red Explosive Hazard Barrels (Dynamic / Destructible — Excluded from Static Batch)
  const explBarrelMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.28,
    metalness: 0.6,
    emissive: 0x450a0a
  });
  const barrelBandMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const addExplosiveBarrel = (x: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.35, 16), explBarrelMat);
    mesh.position.set(x, 0.675, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 0.22, 16),
      barrelBandMat
    );
    mesh.add(band);
    sceneGroup.add(mesh);
    dynamicRoots.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    colliders.push({
      box,
      mesh,
      isCover: true,
      isWall: false,
      isExplosiveBarrel: true,
      barrelHealth: 40
    });
  };

  // ============================================================================
  // 1. THEME MATERIALS, GROUND & BESPOKE PERIMETER SKYBOX
  // ============================================================================
  const groundSize = 112;
  let groundTexture: THREE.Texture;
  let wallMat: THREE.MeshStandardMaterial;
  let accentWallMat: THREE.MeshStandardMaterial;
  const facadeMat = new THREE.MeshStandardMaterial({
    map: getProceduralTexture('building_facade'),
    bumpMap: createBumpTexture(getProceduralTexture('building_facade')),
    bumpScale: 0.045,
    roughness: 0.55,
    metalness: 0.15
  });
  const stepMat = new THREE.MeshStandardMaterial({
    map: getProceduralTexture('hazard_stripes'),
    bumpMap: createBumpTexture(getProceduralTexture('hazard_stripes')),
    bumpScale: 0.025,
    roughness: 0.55,
    metalness: 0.15
  });

  if (mapData.theme === 'cyberpunk') {
    groundTexture = getProceduralTexture('asphalt_wet', { roadLine: true });
    groundTexture.repeat.set(16, 16);
    wallMat = new THREE.MeshStandardMaterial({
      map: getProceduralTexture('concrete_panels', { color: '#475569' }),
      roughness: 0.58,
      metalness: 0.15
    });
    accentWallMat = new THREE.MeshStandardMaterial({
      map: getProceduralTexture('concrete_panels', { color: '#334155' }),
      roughness: 0.5,
      metalness: 0.2
    });
  } else if (mapData.theme === 'desert') {
    groundTexture = getProceduralTexture('sandstone_weathered', { color: '#c49a6c' });
    groundTexture.repeat.set(18, 18);
    wallMat = new THREE.MeshStandardMaterial({
      map: getProceduralTexture('sandstone_weathered', { color: '#b88655' }),
      roughness: 0.78,
      metalness: 0.08
    });
    accentWallMat = new THREE.MeshStandardMaterial({
      map: getProceduralTexture('concrete_panels', { color: '#854d27' }),
      roughness: 0.68,
      metalness: 0.12
    });
  } else if (mapData.theme === 'arctic') {
    groundTexture = getProceduralTexture('glacier_ice', { color: '#718ba5' });
    groundTexture.repeat.set(16, 16);
    wallMat = new THREE.MeshStandardMaterial({
      map: getProceduralTexture('concrete_panels', { color: '#64748b' }),
      roughness: 0.72,
      metalness: 0.08
    });
    accentWallMat = new THREE.MeshStandardMaterial({
      map: getProceduralTexture('glacier_ice', { color: '#52718f' }),
      roughness: 0.76,
      metalness: 0.06
    });
  } else if (mapData.theme === 'harbor') {
    groundTexture = getProceduralTexture('industrial_diamond_plate', { color: '#475569' });
    groundTexture.repeat.set(22, 22);
    wallMat = new THREE.MeshStandardMaterial({
      map: getProceduralTexture('concrete_panels', { color: '#64748b' }),
      roughness: 0.6,
      metalness: 0.16
    });
    accentWallMat = new THREE.MeshStandardMaterial({
      map: getProceduralTexture('container_ribs', { color: '#b91c1c' }),
      roughness: 0.52,
      metalness: 0.22
    });
  } else {
    groundTexture = getProceduralTexture('overgrown_stone', { color: '#4d6645' });
    groundTexture.repeat.set(16, 16);
    wallMat = new THREE.MeshStandardMaterial({
      map: getProceduralTexture('overgrown_stone', { color: '#5c7851' }),
      roughness: 0.72,
      metalness: 0.1
    });
    accentWallMat = new THREE.MeshStandardMaterial({
      map: getProceduralTexture('concrete_panels', { color: '#b45309' }),
      roughness: 0.55,
      metalness: 0.16
    });
  }

  for (const [material, bumpScale] of [[wallMat, 0.045], [accentWallMat, 0.035]] as const) {
    if (material.map) {
      material.bumpMap = createBumpTexture(material.map);
      material.bumpScale = bumpScale;
    }
  }

  // Main Tactical Arena Floor (balanced roughness & low metalness so exposure is completely even across all angles)
  const mainFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize),
    new THREE.MeshStandardMaterial({
      map: groundTexture,
      bumpMap: createBumpTexture(groundTexture),
      bumpScale: mapData.theme === 'arctic' ? 0.035 : 0.055,
      roughness: mapData.theme === 'arctic' ? 0.82 : 0.68,
      metalness: mapData.theme === 'arctic' ? 0.025 : 0.1
    })
  );
  mainFloor.rotation.x = -Math.PI / 2;
  mainFloor.receiveShadow = true;
  sceneGroup.add(mainFloor);

  // Outer Low Tactical Perimeter Walls (6m high so the 360° distant skyline & vista are clearly visible!)
  const perimMat = mapData.theme === 'cyberpunk' ? facadeMat : wallMat;
  addBuilding(110, 6.5, 4, 0, -54, perimMat);
  addBuilding(110, 6.5, 4, 0, 54, perimMat);
  addBuilding(4, 6.5, 110, -54, 0, perimMat);
  addBuilding(4, 6.5, 110, 54, 0, perimMat);

  // Tactical Spawn-Exit Sightline Shields (Blocks direct x=0 spawn-to-spawn sightline while leaving wide dual flank lanes)
  addSolid(new THREE.BoxGeometry(6.4, 3.4, 1.4), accentWallMat, new THREE.Vector3(0, 1.7, 29.5));
  addSolid(new THREE.BoxGeometry(6.4, 3.4, 1.4), accentWallMat, new THREE.Vector3(0, 1.7, -29.5));

  // ============================================================================
  // 2. BESPOKE ARCHITECTURAL LAYOUTS & 360° DISTANT VISTAS PER MAP
  // ============================================================================

  if (mapData.theme === 'cyberpunk') {
    // ------------------------------------------------------------------------
    // MAP 1: NEON DISTRICT — Walkable Shibuya Skybridge, Holographic Towers & Tesla Substation
    // ------------------------------------------------------------------------
    const neonCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const neonMagenta = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const neonPurple = new THREE.MeshBasicMaterial({ color: 0xa855f7 });

    // Distant 360° Neo-Tokyo Skyscraper Skyline outside arena perimeter
    const skylinePositions = [
      [-70, -70, 22, 65, 22], [0, -75, 28, 82, 24], [70, -70, 24, 60, 24],
      [-75, 0, 22, 55, 28], [75, 0, 24, 72, 26],
      [-68, 68, 24, 58, 22], [68, 68, 24, 64, 22]
    ];
    skylinePositions.forEach(([sx, sz, sw, sh, sd], idx) => {
      const tower = addDecor(new THREE.BoxGeometry(sw, sh, sd), facadeMat, new THREE.Vector3(sx, sh / 2, sz));
      const roofBeacon = new THREE.Mesh(
        new THREE.BoxGeometry(sw + 0.6, 0.8, sd + 0.6),
        idx % 2 === 0 ? neonCyan : neonMagenta
      );
      roofBeacon.position.y = sh / 2;
      tower.add(roofBeacon);
    });

    // WALKABLE MID SHIBUYA NEON SKYBRIDGE (Height = 2.66m, accessible via East & West Stairs!)
    // Players can walk UNDER the bridge along Z (height > 2.6m at center, or around pillars) AND climb ON TOP of it!
    const bridgeDeck = addSolid(
      new THREE.BoxGeometry(20, 0.45, 5.5),
      accentWallMat,
      new THREE.Vector3(0, 2.45, 0),
      0,
      false,
      true
    );
    // Glowing neon trim along Skybridge
    const trimNorth = new THREE.Mesh(new THREE.BoxGeometry(20.2, 0.18, 0.18), neonCyan);
    trimNorth.position.set(0, 0.25, -2.75);
    bridgeDeck.add(trimNorth);
    const trimSouth = new THREE.Mesh(new THREE.BoxGeometry(20.2, 0.18, 0.18), neonMagenta);
    trimSouth.position.set(0, 0.25, 2.75);
    bridgeDeck.add(trimSouth);

    // Walkable Stairs leading up to the Skybridge from South-West (-10, 8) and North-East (10, -8)
    addWalkableStairs(-10, 9.8, 0, -1, 4.0, 1.0, 7, 0.38, stepMat);
    addWalkableStairs(10, -9.8, 0, 1, 4.0, 1.0, 7, 0.38, stepMat);

    // Mid Supporting Cyber Kiosks & Holographic Tori Gates
    addBuilding(6, 5.5, 6, -13, -6, facadeMat, 0x00f0ff);
    addBuilding(6, 5.5, 6, 13, 6, facadeMat, 0xf43f5e);

    // Giant Holographic Billboards visible directly from Attacker Spawn!
    const holoSign1 = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 6.5),
      new THREE.MeshBasicMaterial({
        map: getProceduralTexture('cyber_billboard', { text: 'SECTOR-09 // SHIBUYA', subtext: 'MEGA-GRID UPLINK', hue: 190 }),
        side: THREE.DoubleSide
      })
    );
    holoSign1.position.set(0, 8.5, 0);
    sceneGroup.add(holoSign1);

    // SITE A (East): High-Voltage Tesla Substation
    addBuilding(10, 9, 10, mapData.siteA.x + 8, mapData.siteA.z, facadeMat, 0x00f0ff);
    addBuilding(3.0, 4.2, 14, 18, 12, wallMat, 0x00f0ff);
    for (const tz of [-25, -18]) {
      const coilBase = addSolid(
        new THREE.CylinderGeometry(1.5, 1.8, 4.8, 16),
        accentWallMat,
        new THREE.Vector3(mapData.siteA.x + 1, 2.4, tz)
      );
      for (const ringY of [-1.2, 0, 1.2]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.14, 8, 24), neonCyan);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = ringY;
        coilBase.add(ring);
      }
    }

    // SITE B (West): Neon Arcade Tower & Cyber Market
    const arcadeTower = addBuilding(11, 16, 11, mapData.siteB.x - 8, mapData.siteB.z - 2, facadeMat, 0xf43f5e);
    const signB = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 5.5),
      new THREE.MeshBasicMaterial({
        map: getProceduralTexture('cyber_billboard', { text: 'ARCADE // ZERO', subtext: 'HYPER-LINK ZONE', hue: 330 }),
        side: THREE.DoubleSide
      })
    );
    signB.position.set(5.6, 3, 0);
    signB.rotation.y = Math.PI / 2;
    arcadeTower.add(signB);

    addBuilding(3.0, 4.2, 14, -18, 12, wallMat, 0xf43f5e);
    addShippingContainer(mapData.siteB.x + 2, 1.33, mapData.siteB.z + 2, 0.25, 0);

    // Futuristic Cyber-Cars parked in Attacker Plaza & Lanes (instead of generic grey boxes!)
    const carMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.18, metalness: 0.88 });
    const addCyberVehicle = (x: number, z: number, rotY: number) => {
      const chassis = addSolid(new THREE.BoxGeometry(2.2, 1.35, 4.6), carMat, new THREE.Vector3(x, 0.68, z), rotY);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.4), new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.9 }));
      cabin.position.set(0, 0.9, -0.2);
      chassis.add(cabin);
      const lightBar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.14, 0.1), neonCyan);
      lightBar.position.set(0, 0.15, -2.31);
      chassis.add(lightBar);
      const tailBar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.14, 0.1), neonMagenta);
      tailBar.position.set(0, 0.15, 2.31);
      chassis.add(tailBar);
    };
    addCyberVehicle(-6, 30, 0.35);
    addCyberVehicle(6, 30, -0.35);
    addCyberVehicle(16, 20, -0.15);
    addCyberVehicle(-16, 20, 0.25);
    addCyberVehicle(0, -26, 1.57);

    // Neon Street Portals
    for (const pz of [22, -16]) {
      const arch = addDecor(new THREE.BoxGeometry(14, 0.4, 0.4), neonPurple, new THREE.Vector3(0, 6.2, pz));
      const pL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6.2, 0.4), accentWallMat);
      pL.position.set(-6.8, -3.1, 0);
      arch.add(pL);
      const pR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6.2, 0.4), accentWallMat);
      pR.position.set(6.8, -3.1, 0);
      arch.add(pR);
    }

    addExplosiveBarrel(15, 4);
    addExplosiveBarrel(-15, 4);
    addExplosiveBarrel(mapData.siteA.x - 3, mapData.siteA.z + 2);
    addExplosiveBarrel(mapData.siteB.x + 3, mapData.siteB.z - 2);

  } else if (mapData.theme === 'desert') {
    // ------------------------------------------------------------------------
    // MAP 2: DUSTFALL — Glowing Lava Borehole Bridge, Red-Rock Canyon Arches & Solar Spire
    // ------------------------------------------------------------------------
    const magmaGlow = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const lavaYellow = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const mesaMat = new THREE.MeshStandardMaterial({
      map: getProceduralTexture('sandstone_weathered', { color: '#9a3412' }),
      roughness: 0.9,
      metalness: 0.05
    });

    // Distant Atacama Red-Rock Mesas & Blazing Desert Sun Sphere
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(14, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    sunDisc.position.set(65, 68, -95);
    sceneGroup.add(sunDisc);

    for (const [mx, mz, mr, mh] of [
      [-75, -65, 22, 34], [0, -80, 28, 42], [75, -65, 24, 38],
      [-80, 15, 20, 30], [80, 15, 22, 32]
    ]) {
      addDecor(new THREE.CylinderGeometry(mr * 0.65, mr, mh, 10), mesaMat, new THREE.Vector3(mx, mh / 2, mz));
    }

    // MID: Glowing Molten Geothermal Lava Crater with a Walkable Steel Grating Bridge Over It!
    const pitRim = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 7.4, 0.65, 28), accentWallMat);
    pitRim.position.set(0, 0.32, 0);
    sceneGroup.add(pitRim);
    const magmaPool = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 5.8, 0.7, 28), magmaGlow);
    magmaPool.position.set(0, 0.35, 0);
    sceneGroup.add(magmaPool);
    const magmaCenter = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.74, 20), lavaYellow);
    magmaCenter.position.set(0, 0.37, 0);
    sceneGroup.add(magmaCenter);

    // Walkable Steel Bridge spanning North-South directly over the Lava Crater (Height = 1.9m)
    const steelBridgeMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.8 });
    addSolid(new THREE.BoxGeometry(4.2, 0.35, 14), steelBridgeMat, new THREE.Vector3(0, 1.75, 0), 0, false, true);
    addWalkableStairs(0, 12.0, 0, -1, 4.2, 1.0, 5, 0.38, stepMat);
    addWalkableStairs(0, -12.0, 0, 1, 4.2, 1.0, 5, 0.38, stepMat);

    // 4 Angled Sandstone Bastion Bunkers framing Mid Canyon
    addSolid(new THREE.BoxGeometry(6.5, 3.6, 3.2), wallMat, new THREE.Vector3(-11, 1.8, 9), 0.35, true, true);
    addSolid(new THREE.BoxGeometry(6.5, 3.6, 3.2), wallMat, new THREE.Vector3(11, 1.8, 9), -0.35, true, true);
    addSolid(new THREE.BoxGeometry(6.5, 3.6, 3.2), wallMat, new THREE.Vector3(-11, 1.8, -9), -0.35, true, true);
    addSolid(new THREE.BoxGeometry(6.5, 3.6, 3.2), wallMat, new THREE.Vector3(11, 1.8, -9), 0.35, true, true);

    // Towering Red-Rock Canyon Arches along A & B Lanes
    const addSandstoneArch = (x: number, z: number, rotY = 0) => {
      addSolid(new THREE.BoxGeometry(3.5, 7.5, 3.5), mesaMat, new THREE.Vector3(x - 6, 3.75, z), rotY, true, true);
      addSolid(new THREE.BoxGeometry(3.5, 7.5, 3.5), mesaMat, new THREE.Vector3(x + 6, 3.75, z), rotY, true, true);
      addDecor(new THREE.BoxGeometry(16, 2.6, 3.8), mesaMat, new THREE.Vector3(x, 8.2, z), 0, rotY, 0);
    };
    addSandstoneArch(24, 10, 0);
    addSandstoneArch(-24, 10, 0);
    addSandstoneArch(0, 28, 0);

    // SITE A: Towering 24m Solar Receiver Spire, Walkable Sniper Deck & Mirror Heliostats
    const solarSpire = addSolid(
      new THREE.CylinderGeometry(1.8, 3.4, 24, 12),
      accentWallMat,
      new THREE.Vector3(mapData.siteA.x + 5, 12, mapData.siteA.z - 3),
      0,
      true,
      true
    );
    const solarCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 4.0, 16),
      lavaYellow
    );
    solarCrown.position.y = 10.5;
    solarSpire.add(solarCrown);

    // Walkable Solar Overlook Platform on Site A
    addSolid(new THREE.BoxGeometry(7, 1.9, 6), wallMat, new THREE.Vector3(mapData.siteA.x - 7, 0.95, mapData.siteA.z + 8), 0, false, true);
    addWalkableStairs(mapData.siteA.x - 7, mapData.siteA.z + 16, 0, -1, 4.0, 1.0, 5, 0.38, stepMat);

    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.08, metalness: 0.92 });
    for (const [mx, mz] of [
      [mapData.siteA.x - 3, mapData.siteA.z + 1],
      [mapData.siteA.x + 1, mapData.siteA.z + 4],
      [mapData.siteA.x - 4, mapData.siteA.z - 4]
    ]) {
      addSolid(new THREE.BoxGeometry(3.8, 2.2, 0.8), mirrorMat, new THREE.Vector3(mx, 1.1, mz), 0.45, false, true);
    }

    // SITE B: Geothermal Refinery Silos & Adobe Compound
    addBuilding(12, 7.5, 10, mapData.siteB.x - 7, mapData.siteB.z, mesaMat, 0x78350f);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.35, metalness: 0.65 });
    addSolid(new THREE.CylinderGeometry(2.8, 2.8, 7.0, 20), tankMat, new THREE.Vector3(mapData.siteB.x + 2, 3.5, mapData.siteB.z - 2));
    addSolid(new THREE.CylinderGeometry(2.2, 2.2, 5.0, 20), tankMat, new THREE.Vector3(mapData.siteB.x - 2, 2.5, mapData.siteB.z + 3));

    addExplosiveBarrel(18, 2);
    addExplosiveBarrel(-18, 2);
    addExplosiveBarrel(mapData.siteA.x - 2, mapData.siteA.z - 2);
    addExplosiveBarrel(mapData.siteB.x + 4, mapData.siteB.z + 2);

  } else if (mapData.theme === 'arctic') {
    // ------------------------------------------------------------------------
    // MAP 3: FROSTLINE — Aurora Sky, Glacier Bridge, VTOL Dropship Hangar & Radar Domes
    // ------------------------------------------------------------------------
    const pipelineMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.58, metalness: 0.35 });
    const heaterMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const auroraMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide
    });

    // Distant Jagged Snow-Capped Glacier Mountains & Aurora Borealis Ribbons
    for (const [gx, gz, gr, gh] of [
      [-70, -70, 26, 48], [0, -78, 32, 56], [70, -70, 26, 46],
      [-78, 0, 24, 42], [78, 0, 24, 44]
    ]) {
      addDecor(new THREE.ConeGeometry(gr, gh, 6), accentWallMat, new THREE.Vector3(gx, gh / 2, gz));
    }
    const auroraRibbon = new THREE.Mesh(new THREE.TorusGeometry(68, 3.2, 8, 48, Math.PI), auroraMat);
    auroraRibbon.position.set(0, 42, -30);
    auroraRibbon.rotation.x = 0.35;
    sceneGroup.add(auroraRibbon);

    // MID: Walkable Cryo Ice Bridge spanning over Twin Sub-Zero Pipelines (Height = 2.28m)
    addDecor(new THREE.CylinderGeometry(1.1, 1.1, 52, 16), pipelineMat, new THREE.Vector3(0, 1.1, -2), 0, 0, Math.PI / 2);
    addDecor(new THREE.CylinderGeometry(1.1, 1.1, 52, 16), pipelineMat, new THREE.Vector3(0, 1.1, 2), 0, 0, Math.PI / 2);

    addSolid(new THREE.BoxGeometry(6.0, 2.28, 8.0), accentWallMat, new THREE.Vector3(0, 1.14, 0), 0, false, true);
    addWalkableStairs(0, 10.0, 0, -1, 5.0, 1.0, 6, 0.38, accentWallMat);
    addWalkableStairs(0, -10.0, 0, 1, 5.0, 1.0, 6, 0.38, accentWallMat);

    // Translucent Crystalline Ice Spires framing Mid & Spawn Approach
    addSolid(new THREE.ConeGeometry(2.6, 7.5, 6), accentWallMat, new THREE.Vector3(-12, 3.75, 16), 0.2, true, true);
    addSolid(new THREE.ConeGeometry(2.6, 7.5, 6), accentWallMat, new THREE.Vector3(12, 3.75, 16), -0.2, true, true);
    addSolid(new THREE.BoxGeometry(4.0, 5.0, 14), accentWallMat, new THREE.Vector3(-12, 2.5, -6), 0.25, true, true);
    addSolid(new THREE.BoxGeometry(4.0, 5.0, 14), accentWallMat, new THREE.Vector3(12, 2.5, -6), -0.25, true, true);

    // SITE A: Fortified Arctic Hangar with Parked 3D VTOL Tilt-Rotor Gunship!
    addBuilding(16, 9, 3.5, mapData.siteA.x + 6, mapData.siteA.z - 8, wallMat);
    addBuilding(3.5, 9, 16, mapData.siteA.x + 12, mapData.siteA.z, wallMat);
    addDecor(new THREE.BoxGeometry(16, 1.2, 16), wallMat, new THREE.Vector3(mapData.siteA.x + 4, 9.0, mapData.siteA.z));

    // Parked VTOL Aircraft on Site A Helipad
    const vtolMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.8 });
    const vtolHull = addSolid(
      new THREE.BoxGeometry(3.2, 2.1, 7.8),
      vtolMat,
      new THREE.Vector3(mapData.siteA.x + 1, 1.35, mapData.siteA.z),
      0.4,
      false,
      true
    );
    const vtolWings = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.28, 2.0), vtolMat);
    vtolWings.position.set(0, 0.6, -0.4);
    vtolHull.add(vtolWings);
    const cockpitGlass = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.9, 2.2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    cockpitGlass.position.set(0, 0.35, 2.9);
    vtolHull.add(cockpitGlass);

    // SITE B: Twin Geodesic Arctic Radar Domes & Thermal Beacon Tower
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0xaabbd0,
      roughness: 0.72,
      metalness: 0.05,
      flatShading: true
    });
    addSolid(
      new THREE.IcosahedronGeometry(5.2, 1),
      domeMat,
      new THREE.Vector3(mapData.siteB.x - 5, 2.5, mapData.siteB.z - 3),
      0,
      true,
      true
    );
    addSolid(
      new THREE.IcosahedronGeometry(3.6, 1),
      domeMat,
      new THREE.Vector3(mapData.siteB.x + 3, 1.8, mapData.siteB.z - 5),
      0,
      true,
      true
    );
    const beaconPillar = addSolid(
      new THREE.CylinderGeometry(0.6, 0.8, 6.5, 12),
      wallMat,
      new THREE.Vector3(mapData.siteB.x, 3.25, mapData.siteB.z + 2)
    );
    const heaterRing = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.4, 12), heaterMat);
    heaterRing.position.y = 1.6;
    beaconPillar.add(heaterRing);

    // Glacier Ice Flank Barriers
    addSolid(new THREE.BoxGeometry(4.5, 4.2, 12), accentWallMat, new THREE.Vector3(22, 2.1, 12), -0.2, true, true);
    addSolid(new THREE.BoxGeometry(4.5, 4.2, 12), accentWallMat, new THREE.Vector3(-22, 2.1, 12), 0.2, true, true);

    addExplosiveBarrel(7, 4);
    addExplosiveBarrel(-7, -4);
    addExplosiveBarrel(mapData.siteA.x - 4, mapData.siteA.z - 2);
    addExplosiveBarrel(mapData.siteB.x + 4, mapData.siteB.z + 1);

  } else if (mapData.theme === 'harbor') {
    // ------------------------------------------------------------------------
    // MAP 4: BLACK HARBOR — Offshore Ocean Surround, Climbable Container Stacks & Gantry Crane
    // ------------------------------------------------------------------------
    const craneRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.65 });
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.15,
      metalness: 0.75
    });

    // Surrounding Offshore Deep Ocean Water Surface outside Port Pier
    const oceanPlane = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), waterMat);
    oceanPlane.rotation.x = -Math.PI / 2;
    oceanPlane.position.y = -0.35;
    sceneGroup.add(oceanPlane);

    // MID: Multi-Tier Asymmetrical Shipping Container Yard with Walkable Ramp Up onto Container Roofs!
    addShippingContainer(-7, 1.33, 8, 0, 0);
    addShippingContainer(-7, 3.99, 8, 0, 1); // Double-stacked West Tower!
    addShippingContainer(7, 1.33, 8, 0, 2);
    // Walkable stairs onto the East Mid Container (7, 8) so players can climb on top of it (height = 2.66m)!
    addWalkableStairs(7, 18.1, 0, -1, 2.6, 1.0, 7, 0.38, stepMat);

    addShippingContainer(0, 1.33, -4, 1.57, 3);
    addShippingContainer(-12, 1.33, -8, 0.35, 1);
    addShippingContainer(12, 1.33, -8, -0.35, 0);

    // Attacker Pier Container Gateways (instead of plain walls)
    addShippingContainer(-8, 1.33, 28, 1.57, 2);
    addShippingContainer(8, 1.33, 28, 1.57, 0);

    // SITE A: Colossal Red Ship-to-Shore Gantry Crane Straddling Site A
    const cx = mapData.siteA.x;
    const cz = mapData.siteA.z;
    addSolid(new THREE.BoxGeometry(1.8, 18, 1.8), craneRedMat, new THREE.Vector3(cx - 5.5, 9, cz - 5.5), 0, true, true);
    addSolid(new THREE.BoxGeometry(1.8, 18, 1.8), craneRedMat, new THREE.Vector3(cx + 5.5, 9, cz - 5.5), 0, true, true);
    addSolid(new THREE.BoxGeometry(1.8, 18, 1.8), craneRedMat, new THREE.Vector3(cx - 5.5, 9, cz + 5.5), 0, true, true);
    addSolid(new THREE.BoxGeometry(1.8, 18, 1.8), craneRedMat, new THREE.Vector3(cx + 5.5, 9, cz + 5.5), 0, true, true);
    addDecor(new THREE.BoxGeometry(26, 2.4, 13), craneRedMat, new THREE.Vector3(cx + 3, 18.5, cz));
    addShippingContainer(cx, 1.33, cz, 0.55, 2);

    // SITE B: Drydock Cargo Warehouse & Maritime Mooring Bulkhead
    addBuilding(15, 8.5, 3.5, mapData.siteB.x - 6, mapData.siteB.z - 6, accentWallMat);
    addBuilding(3.5, 8.5, 15, mapData.siteB.x - 12, mapData.siteB.z, wallMat);
    addShippingContainer(mapData.siteB.x + 2, 1.33, mapData.siteB.z + 2, 1.57, 0);
    addShippingContainer(mapData.siteB.x - 3, 1.33, mapData.siteB.z - 1, 0, 1);

    // Lane Divider Containers
    addShippingContainer(22, 1.33, 12, 0, 3);
    addShippingContainer(-22, 1.33, 12, 0, 4);

    addExplosiveBarrel(4, 2);
    addExplosiveBarrel(-4, -8);
    addExplosiveBarrel(cx - 3, cz + 2);
    addExplosiveBarrel(mapData.siteB.x + 4, mapData.siteB.z - 3);

  } else {
    // ------------------------------------------------------------------------
    // MAP 5: VERDANT — Enclosing Geodesic Bio-Dome, Climbable Stone Ziggurat & Bio-Vats
    // ------------------------------------------------------------------------
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });
    const bioGlowMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
    const amberVatMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      roughness: 0.15,
      transmission: 0.6,
      transparent: true,
      opacity: 0.88
    });

    // Enclosing Geodesic Bio-Dome Structural Arch Ribs Spanning the Entire Sanctuary
    const ribMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.75 });
    for (const rz of [-24, -8, 8, 24]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(48, 0.75, 8, 40, Math.PI), ribMat);
      arch.position.set(0, 0, rz);
      sceneGroup.add(arch);
    }

    // MID: Climbable Stepped Ancient Stone Ziggurat Pyramid in the Center of Mid!
    // Players and bots can walk up from any side onto the 2.28m Ziggurat Altar!
    const tiers = [
      { size: 14, h: 0.38 },
      { size: 11.5, h: 0.76 },
      { size: 9.0, h: 1.14 },
      { size: 6.5, h: 1.52 },
      { size: 4.2, h: 1.90 }
    ];
    for (const t of tiers) {
      addSolid(new THREE.BoxGeometry(t.size, t.h, t.size), wallMat, new THREE.Vector3(0, t.h / 2, 0), 0, false, true);
    }
    // Glowing Bioluminescent Crystal Obelisk on top of the Mid Ziggurat
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), bioGlowMat);
    crystal.position.set(0, 3.4, 0);
    sceneGroup.add(crystal);

    // Mossy Stone Temple Pillars flanking Mid
    addSolid(new THREE.CylinderGeometry(1.4, 1.6, 6.5, 8), wallMat, new THREE.Vector3(-12, 3.25, 8), 0, true, true);
    addSolid(new THREE.CylinderGeometry(1.4, 1.6, 6.5, 8), wallMat, new THREE.Vector3(12, 3.25, 8), 0, true, true);
    addSolid(new THREE.CylinderGeometry(1.4, 1.6, 6.5, 8), wallMat, new THREE.Vector3(-12, 3.25, -8), 0, true, true);
    addSolid(new THREE.CylinderGeometry(1.4, 1.6, 6.5, 8), wallMat, new THREE.Vector3(12, 3.25, -8), 0, true, true);

    // SITE A: Hydroponic Research Labs & Glowing Amber Bio-Containment Vats
    addBuilding(12, 7.5, 10, mapData.siteA.x + 8, mapData.siteA.z, accentWallMat);
    for (const [vx, vz] of [
      [mapData.siteA.x - 2, mapData.siteA.z - 3],
      [mapData.siteA.x + 2, mapData.siteA.z + 2],
      [mapData.siteA.x - 3, mapData.siteA.z + 3]
    ]) {
      const vat = addSolid(new THREE.CylinderGeometry(1.7, 1.7, 5.4, 20), amberVatMat, new THREE.Vector3(vx, 2.7, vz));
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 12), bioGlowMat);
      core.position.y = 0.2;
      vat.add(core);
    }

    // SITE B: Ancient Temple Ruins & Giant Buttress Canopy Trees
    addBuilding(12, 4.5, 12, mapData.siteB.x - 7, mapData.siteB.z - 2, wallMat);
    addBuilding(7.5, 8.0, 7.5, mapData.siteB.x - 7, mapData.siteB.z - 2, wallMat);

    const addJungleTree = (tx: number, tz: number) => {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.9 });
      const trunk = addSolid(new THREE.CylinderGeometry(1.1, 1.9, 8.5, 10), trunkMat, new THREE.Vector3(tx, 4.25, tz), 0, true, true);
      const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(5.8, 1), foliageMat);
      canopy.position.y = 5.4;
      trunk.add(canopy);
    };
    addJungleTree(mapData.siteB.x + 2, mapData.siteB.z - 2);
    addJungleTree(-18, 16);
    addJungleTree(18, 16);
    addJungleTree(-8, 28);
    addJungleTree(8, 28);

    addExplosiveBarrel(10, 0);
    addExplosiveBarrel(mapData.siteA.x - 4, mapData.siteA.z + 2);
    addExplosiveBarrel(mapData.siteB.x + 3, mapData.siteB.z + 3);
  }

  // Open mid remains the fastest rotation; staggered edge cover creates safer,
  // slower flank routes without sealing the central lane.
  const routeAccentMat = mapData.theme === 'cyberpunk'
    ? new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    : mapData.theme === 'desert'
      ? new THREE.MeshStandardMaterial({ color: 0xd6a66f, roughness: 0.9 })
      : mapData.theme === 'arctic'
        ? new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.38, metalness: 0.18 })
        : mapData.theme === 'harbor'
          ? new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.52, metalness: 0.28 })
          : new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.88 });
  const routeCoverMat = mapData.theme === 'harbor'
    ? containerMatPool[4]
    : mapData.theme === 'arctic'
        ? accentWallMat
        : mapData.theme === 'overgrown'
          ? wallMat
          : accentWallMat;
  for (const side of [-1, 1]) {
    for (const [index, z] of [18, 0, -18].entries()) {
      const cover = addSolid(
        new THREE.BoxGeometry(3.8, 1.65, 1.35),
        routeCoverMat,
        new THREE.Vector3(side * 40, 0.825, z),
        side * (index % 2 === 0 ? 0.12 : -0.12),
        false,
        true
      );
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.08, 1.42), sharedCornerMat);
      topRail.position.y = 0.86;
      cover.add(topRail);
      const identityStripe = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.06, 0.045),
        routeAccentMat
      );
      identityStripe.position.set(0, 0.35, 0.69);
      cover.add(identityStripe);

      if (mapData.theme === 'arctic') {
        const shard = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 0), routeAccentMat);
        shard.position.set(side * 1.1, 0.82, 0);
        shard.scale.set(0.7, 1.45, 0.7);
        cover.add(shard);
      } else if (mapData.theme === 'overgrown') {
        const root = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.1, 6), routeAccentMat);
        root.position.set(side * 0.9, 0.45, 0.54);
        root.rotation.z = side * 0.5;
        cover.add(root);
      } else if (mapData.theme === 'harbor') {
        const cornerPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 1.38), sharedCornerMat);
        cornerPost.position.x = -side * 1.82;
        cover.add(cornerPost);
      }
    }
  }

  // Mid-route cheek walls create two readable peeking positions with a clean center crossing.
  for (const side of [-1, 1]) {
    for (const z of [14, -14]) {
      const cheekWall = addSolid(
        new THREE.BoxGeometry(2.8, 1.45, 0.9),
        accentWallMat,
        new THREE.Vector3(side * 6.2, 0.725, z),
        side * (z > 0 ? -0.2 : 0.2),
        false,
        true
      );
      const trim = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.07, 0.06), routeAccentMat);
      trim.position.set(0, 0.42, 0.47);
      cheekWall.add(trim);
    }
  }

  // Give each site a readable, cover-rich entry without closing its main approach.
  const coverAccent = new THREE.MeshStandardMaterial({
    color: mapData.theme === 'desert' ? 0xfbbf24 : mapData.theme === 'overgrown' ? 0x84cc16 : 0x38bdf8,
    roughness: 0.42,
    metalness: mapData.theme === 'overgrown' || mapData.theme === 'desert' ? 0.12 : 0.48,
    emissive: mapData.theme === 'cyberpunk' || mapData.theme === 'arctic' ? 0x082f49 : 0x000000,
    emissiveIntensity: 0.35
  });
  const laneMarkMat = new THREE.MeshBasicMaterial({
    color: mapData.theme === 'desert' ? 0xfef3c7 : mapData.theme === 'overgrown' ? 0xa3e635 : 0x67e8f9,
    transparent: true,
    opacity: 0.58
  });
  const sandbagMat = new THREE.MeshStandardMaterial({ color: 0xc8a77a, roughness: 0.94 });
  const addApproachCover = (x: number, z: number, rotation: number, mirrored: boolean) => {
    const cover = addSolid(
      new THREE.BoxGeometry(3.2, 1.25, 0.72),
      mapData.theme === 'harbor' ? containerMatPool[mirrored ? 1 : 0] : accentWallMat,
      new THREE.Vector3(x, 0.625, z),
      rotation,
      false,
      true
    );
    const cap = new THREE.Mesh(new THREE.BoxGeometry(3.28, 0.08, 0.78), sharedCornerMat);
    cap.position.set(0, 0.66, 0);
    cover.add(cap);

    const marker = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.045, 0.06), coverAccent);
    marker.position.set(0, 0.18, 0.37);
    cover.add(marker);

    if (mapData.theme === 'arctic') {
      for (const side of [-1, 1]) {
        const iceShard = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 0), coverAccent);
        iceShard.position.set(side * 1.05, 0.78, 0.08);
        iceShard.scale.set(0.68, 1.35, 0.72);
        cover.add(iceShard);
      }
    } else if (mapData.theme === 'desert') {
      for (let i = 0; i < 3; i++) {
        const sandbag = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.24, 0.3), sandbagMat);
        sandbag.position.set(-0.88 + i * 0.88, 1.15, 0.28);
        sandbag.rotation.y = (i - 1) * 0.04;
        cover.add(sandbag);
      }
    } else if (mapData.theme === 'harbor') {
      for (const side of [-1, 1]) {
        const cornerPost = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.18, 0.78), sharedCornerMat);
        cornerPost.position.set(side * 1.48, 0, 0);
        cover.add(cornerPost);
      }
    } else if (mapData.theme === 'overgrown') {
      const moss = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.78), coverAccent);
      moss.position.set(0, 0.56, 0);
      cover.add(moss);
      for (const side of [-1, 1]) {
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.62, 6), coverAccent);
        vine.position.set(side * 1.2, 0.38, 0.39);
        vine.rotation.z = side * 0.26;
        cover.add(vine);
      }
    }
  };
  for (const [site, direction] of [[mapData.siteA, 1], [mapData.siteB, -1]] as const) {
    const approachZ = site.z + site.radius + 7.5;
    addApproachCover(site.x - 3.9, approachZ, direction * 0.08, false);
    addApproachCover(site.x + 3.9, approachZ, -direction * 0.08, true);

    for (const side of [-1, 1]) {
      const laneMark = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.018, 2.4), laneMarkMat);
      laneMark.position.set(site.x + side * 2.1, 0.025, site.z + site.radius + 3.2);
      laneMark.rotation.y = side * direction * 0.04;
      sceneGroup.add(laneMark);
    }
  }

  // ============================================================================
  // 3. BOMB SITE A & SITE B HOLOGRAPHIC PERIMETERS & BEACONS
  // ============================================================================
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
  const buildBombSiteZone = (site: { x: number; z: number; radius: number; label: string }, colorHex: number) => {
    const group = new THREE.Group();
    group.position.set(site.x, 0.03, site.z);

    const ringGeom = new THREE.RingGeometry(site.radius - 0.3, site.radius, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    const innerGeom = new THREE.CircleGeometry(site.radius - 0.3, 48);
    const innerMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.14
    });
    const inner = new THREE.Mesh(innerGeom, innerMat);
    inner.rotation.x = -Math.PI / 2;
    group.add(inner);

    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.3, 16), poleMat);
    ped.position.y = 0.15;
    group.add(ped);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 26, 12),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.32 })
    );
    beam.position.y = 13;
    group.add(beam);

    sceneGroup.add(group);
    return group;
  };

  const siteAMesh = buildBombSiteZone(mapData.siteA, 0x00f0ff);
  const siteBMesh = buildBombSiteZone(mapData.siteB, 0xf59e0b);
  dynamicRoots.add(siteAMesh);
  dynamicRoots.add(siteBMesh);

  // ============================================================================
  // 4. UNIFORM TACTICAL ZONE FILL LIGHTS (Eliminates dark corners & underpasses)
  // ============================================================================
  const zoneLightPositions: [number, number, number][] = [
    [0, 10, 0], // Mid Bridge / Underpass fill
    [0, 12, 32], // Attacker Spawn Plaza fill
    [0, 12, -32], // Defender Spawn Plaza fill
    [mapData.siteA.x, 12, mapData.siteA.z], // Site A Hangar / Spire fill
    [mapData.siteB.x, 12, mapData.siteB.z]  // Site B Arcade / Silos fill
  ];
  for (const [lx, ly, lz] of zoneLightPositions) {
    const zoneLight = new THREE.PointLight(0xf8fafc, 1.1, 48, 1.2);
    zoneLight.position.set(lx, ly, lz);
    sceneGroup.add(zoneLight);
  }

  // ============================================================================
  // 5. STATIC GEOMETRY BATCHING PASS (Merges static meshes by shared material)
  // ============================================================================
  sceneGroup.updateMatrixWorld(true);

  const isInsideDynamicRoot = (obj: THREE.Object3D): boolean => {
    let curr: THREE.Object3D | null = obj;
    while (curr && curr !== sceneGroup) {
      if (dynamicRoots.has(curr)) return true;
      curr = curr.parent;
    }
    return false;
  };

  interface StaticBatchBucket {
    material: THREE.Material;
    castShadow: boolean;
    receiveShadow: boolean;
    geometries: THREE.BufferGeometry[];
    sourceMeshes: THREE.Mesh[];
  }

  const buckets = new Map<string, StaticBatchBucket>();
  const allStaticMeshes: THREE.Mesh[] = [];

  sceneGroup.traverse((child) => {
    if (child instanceof THREE.Mesh && !Array.isArray(child.material) && !isInsideDynamicRoot(child)) {
      allStaticMeshes.push(child);
      const mat = child.material as THREE.Material;
      const key = `${mat.uuid}_${child.castShadow ? 1 : 0}_${child.receiveShadow ? 1 : 0}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          material: mat,
          castShadow: child.castShadow,
          receiveShadow: child.receiveShadow,
          geometries: [],
          sourceMeshes: []
        };
        buckets.set(key, bucket);
      }
      bucket.geometries.push(prepareGeometryForStaticBatch(child.geometry, child.matrixWorld));
      bucket.sourceMeshes.push(child);
    }
  });

  const batchedMeshes: THREE.Mesh[] = [];
  const sourceMeshToBatchMesh = new Map<THREE.Object3D, THREE.Mesh>();

  buckets.forEach((bucket) => {
    if (bucket.geometries.length === 0) return;
    const mergedGeometry = mergeGeometries(bucket.geometries, false);
    for (const g of bucket.geometries) {
      g.dispose();
    }
    if (!mergedGeometry) return;

    mergedGeometry.computeBoundingBox();
    mergedGeometry.computeBoundingSphere();

    const batchedMesh = new THREE.Mesh(mergedGeometry, bucket.material);
    batchedMesh.name = `static_batch_${bucket.material.uuid.slice(0, 6)}`;
    batchedMesh.castShadow = bucket.castShadow;
    batchedMesh.receiveShadow = bucket.receiveShadow;
    // Freeze static matrix updates to eliminate per-frame CPU matrix recalculations on mobile
    batchedMesh.matrixAutoUpdate = false;
    batchedMesh.matrixWorldAutoUpdate = false;
    batchedMesh.updateMatrix();
    batchedMesh.updateMatrixWorld(true);

    sceneGroup.add(batchedMesh);
    batchedMeshes.push(batchedMesh);

    for (const srcMesh of bucket.sourceMeshes) {
      sourceMeshToBatchMesh.set(srcMesh, batchedMesh);
    }
  });

  // Remap static MapCollider mesh references to their merged batch mesh (keeping exact individual Box3 bounds)
  for (const col of colliders) {
    if (!col.isExplosiveBarrel && sourceMeshToBatchMesh.has(col.mesh)) {
      col.mesh = sourceMeshToBatchMesh.get(col.mesh)!;
    }
  }

  // Remove and dispose original unbatched static meshes from scene graph
  for (const oldMesh of allStaticMeshes) {
    if (oldMesh.parent) {
      oldMesh.parent.remove(oldMesh);
    }
    oldMesh.geometry.dispose();
  }

  return {
    sceneGroup,
    colliders,
    batchedMeshes,
    siteAMesh,
    siteBMesh,
    batchStats: {
      originalMeshCount: allStaticMeshes.length,
      batchedDrawCalls: batchedMeshes.length
    }
  };
}
