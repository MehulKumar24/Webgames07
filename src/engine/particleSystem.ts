import * as THREE from 'three';

export interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  type: 'spark' | 'smoke' | 'ember' | 'casing' | 'blood' | 'ring';
  rotation?: number;
  rotSpeed?: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private pointGeometry: THREE.BufferGeometry;
  private pointMaterial: THREE.PointsMaterial;
  private pointCloud: THREE.Points;
  private casingMeshGroup: THREE.Group;
  private casingMeshes: THREE.Mesh[] = [];
  private decalGroup: THREE.Group;
  private decalMeshes: THREE.Mesh[] = [];
  private decalIndex: number = 0;
  private maxParticles = 600;

  constructor(scene: THREE.Scene) {
    this.pointGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxParticles * 3);
    const colors = new Float32Array(this.maxParticles * 3);

    this.pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.pointGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.pointMaterial = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.pointCloud = new THREE.Points(this.pointGeometry, this.pointMaterial);
    this.pointCloud.frustumCulled = false;
    scene.add(this.pointCloud);

    // Group for physically bouncing brass shell casings
    this.casingMeshGroup = new THREE.Group();
    scene.add(this.casingMeshGroup);

    const casingGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.035, 8);
    const casingMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      metalness: 0.95,
      roughness: 0.2
    });

    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(casingGeom, casingMat);
      mesh.visible = false;
      this.casingMeshGroup.add(mesh);
      this.casingMeshes.push(mesh);
    }

    // Pooled 3D Bullet Impact Scorch Decals (with polygonOffset to prevent coplanar Z-fighting)
    this.decalGroup = new THREE.Group();
    scene.add(this.decalGroup);

    const decalGeom = new THREE.CircleGeometry(0.065, 12);
    const decalMat = new THREE.MeshBasicMaterial({
      color: 0x090d16,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide
    });
    const emberRingGeom = new THREE.RingGeometry(0.032, 0.052, 12);
    const emberRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
      side: THREE.DoubleSide
    });

    for (let i = 0; i < 48; i++) {
      const decalMesh = new THREE.Mesh(decalGeom, decalMat);
      const emberRing = new THREE.Mesh(emberRingGeom, emberRingMat);
      decalMesh.add(emberRing);
      decalMesh.visible = false;
      this.decalGroup.add(decalMesh);
      this.decalMeshes.push(decalMesh);
    }
  }

  public spawnBulletDecal(position: THREE.Vector3, normal: THREE.Vector3) {
    const decal = this.decalMeshes[this.decalIndex % this.decalMeshes.length];
    this.decalIndex++;
    if (!decal) return;

    decal.visible = true;
    decal.position.copy(position).addScaledVector(normal, 0.012);
    const target = decal.position.clone().add(normal);
    decal.lookAt(target);
  }

  public spawnSparks(position: THREE.Vector3, normal: THREE.Vector3, count = 12, colorHex = 0xffeedd) {
    const col = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 4 + normal.x * 3,
        (Math.random() - 0.5) * 4 + normal.y * 3 + 2,
        (Math.random() - 0.5) * 4 + normal.z * 3
      );

      this.particles.push({
        position: position.clone(),
        velocity: spread,
        color: col,
        size: 0.12 + Math.random() * 0.1,
        alpha: 1.0,
        life: 0,
        maxLife: 0.25 + Math.random() * 0.35,
        gravity: 12.0,
        type: 'spark'
      });
    }
  }

  public spawnExplosion(position: THREE.Vector3, _radius = 6.0) {
    // Fire burst & shockwave particles
    for (let i = 0; i < 65; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const angle = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const speed = 4 + Math.random() * 10;
      const vel = new THREE.Vector3(
        Math.cos(angle) * Math.cos(phi) * speed,
        Math.sin(phi) * speed + 3,
        Math.sin(angle) * Math.cos(phi) * speed
      );

      this.particles.push({
        position: position.clone(),
        velocity: vel,
        color: new THREE.Color(Math.random() > 0.4 ? 0xf97316 : 0xfacc15),
        size: 0.35 + Math.random() * 0.4,
        alpha: 1.0,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.6,
        gravity: 4.0,
        type: 'ember'
      });
    }
  }

  public spawnShellCasing(position: THREE.Vector3, forwardDir: THREE.Vector3) {
    // Eject to the right and slightly back/up
    const right = new THREE.Vector3(-forwardDir.z, 0, forwardDir.x).normalize();
    const vel = right.multiplyScalar(2.5 + Math.random() * 1.5);
    vel.y = 2.0 + Math.random() * 1.2;
    vel.addScaledVector(forwardDir, -0.6);

    const availableMesh = this.casingMeshes.find(m => !m.visible);
    if (!availableMesh) return;

    availableMesh.position.copy(position);
    availableMesh.visible = true;

    this.particles.push({
      position: availableMesh.position,
      velocity: vel,
      color: new THREE.Color(0xeab308),
      size: 0.05,
      alpha: 1.0,
      life: 0,
      maxLife: 2.0,
      gravity: 15.0,
      type: 'casing',
      rotation: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 20
    });
  }

  public update(dt: number) {
    const posAttr = this.pointGeometry.attributes.position as THREE.BufferAttribute;
    const colAttr = this.pointGeometry.attributes.color as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const colors = colAttr.array as Float32Array;

    let activePoints = 0;
    let casingIdx = 0;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        if (p.type === 'casing') {
          // Hide casing
          const mesh = this.casingMeshes.find(m => m.position === p.position);
          if (mesh) mesh.visible = false;
        }
        this.particles.splice(i, 1);
        continue;
      }

      // Physics integration
      p.velocity.y -= p.gravity * dt;
      p.position.addScaledVector(p.velocity, dt);

      // Floor bounce for shell casings
      if (p.type === 'casing') {
        if (p.position.y <= 0.03) {
          p.position.y = 0.03;
          p.velocity.y = -p.velocity.y * 0.45;
          p.velocity.x *= 0.6;
          p.velocity.z *= 0.6;
        }
        const mesh = this.casingMeshes[casingIdx % this.casingMeshes.length];
        if (mesh) {
          mesh.position.copy(p.position);
          if (p.rotation !== undefined && p.rotSpeed !== undefined) {
            p.rotation += p.rotSpeed * dt;
            mesh.rotation.z = p.rotation;
          }
        }
        casingIdx++;
      } else {
        // Point particles
        if (activePoints < this.maxParticles) {
          const idx = activePoints * 3;
          positions[idx] = p.position.x;
          positions[idx + 1] = p.position.y;
          positions[idx + 2] = p.position.z;

          const fade = 1 - (p.life / p.maxLife);
          colors[idx] = p.color.r * fade;
          colors[idx + 1] = p.color.g * fade;
          colors[idx + 2] = p.color.b * fade;

          activePoints++;
        }
      }
    }

    // Clear remaining buffer
    for (let i = activePoints; i < this.maxParticles; i++) {
      const idx = i * 3;
      positions[idx] = 0;
      positions[idx + 1] = -999;
      positions[idx + 2] = 0;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }
}
