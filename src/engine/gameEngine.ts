import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { 
  MapData, 
  Weapon, 
  Agent, 
  GameMode, 
  BotDifficulty,
  MatchPlayer, 
  KillFeedEntry, 
  DamageNumber,
  ControlSettings,
  GraphicsSettings,
  TeamSide,
  TacticalChatEntry,
  TacticalChatCategory
} from '../types/game';
import { WEAPONS, DEFAULT_SIDEARM_ID, DEFAULT_MELEE_ID, pickRandomBuyPhaseWeapon } from '../data/weapons';
import { AGENTS } from '../data/agents';
import { buildMap, BuiltMap } from './mapBuilder';
import { 
  createFirstPersonWeaponModel, 
  createCharacterBotModel, 
  createNexusCoreObjective,
  createAbilityMesh,
  createDroppedSpikePickupModel
} from './proceduralModels';
import { BotState, createBotState, updateBotAI, AlphaIntel, OmegaIntel, reportGunshot } from './botAI';
import { soundEngine } from '../audio/soundEngine';
import confetti from 'canvas-confetti';
import { ParticleSystem } from './particleSystem';
import { AgentAbilityManager } from './agentAbilities';
import { pickRandomVoiceLine, VoiceLineEvent, VoiceLinePayload } from '../data/voiceLines';

export interface RadarWallRect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  isWall: boolean;
  isCover: boolean;
  isExplosiveBarrel?: boolean;
}

export interface RadarEntityBlip {
  id: string;
  name: string;
  agentId: string;
  team: 'alpha' | 'omega';
  x: number;
  z: number;
  yaw: number;
  isAlive: boolean;
  isPlayer: boolean;
  isSpotted: boolean;
  health: number;
  fsmState?: string;
}

export interface RadarAbilityZone {
  id: string;
  type: string;
  team: 'alpha' | 'omega';
  x: number;
  z: number;
}

export interface RadarTacticalPing {
  id: string;
  x: number;
  z: number;
  label: string;
  createdAt: number;
}

export interface RadarTelemetry {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  currentCallout: string;
  walls: RadarWallRect[];
  blips: RadarEntityBlip[];
  abilities: RadarAbilityZone[];
  spikePosition: { x: number; z: number } | null;
  droppedSpikePosition?: { x: number; z: number } | null;
  spikeCarrierId?: string | null;
  pings: RadarTacticalPing[];
}

export interface GameEngineEvents {
  onScoreUpdate: (alphaScore: number, omegaScore: number) => void;
  onRoundStateChange: (state: 'buy_phase' | 'in_progress' | 'round_end' | 'match_end', message?: string) => void;
  onPlayerStatsChange: (player: MatchPlayer) => void;
  onKillFeed: (entry: KillFeedEntry) => void;
  onDamageNumber: (dmg: DamageNumber) => void;
  onSpikeStateChange: (planted: boolean, timeRemaining: number, defusing: boolean) => void;
  onCrosshairBloom: (bloom: number) => void;
  onPlayerTakeDamage: (amount: number, isHeadshot: boolean) => void;
  onBuyMenuToggle?: (open: boolean) => void;
  onFlashUpdate?: (intensity: number) => void;
  onMultikill?: (text: string) => void;
  onMapToggle?: () => void;
  onScoreboardToggle?: () => void;
  onHitmarker?: (isHeadshot: boolean) => void;
  onVoiceLine?: (payload: VoiceLinePayload) => void;
  onTacticalChat?: (entry: TacticalChatEntry) => void;
  onInspectChange?: (isInspecting: boolean) => void;
  onMatchEnd?: (
    winner: 'alpha' | 'omega',
    allPlayers: MatchPlayer[],
    alphaScore: number,
    omegaScore: number
  ) => void;
}

export class GameEngine {
  public renderer: THREE.WebGLRenderer;
  public composer: EffectComposer | null = null;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  private container: HTMLElement;
  private isRunning: boolean = false;
  private frameId: number = 0;
  private clock: THREE.Clock = new THREE.Clock();
  public isSoftwareGl: boolean = false;

  // Game data
  public activeMap: MapData;
  public activeMode: GameMode;
  public botDifficulty: BotDifficulty;
  public playerAgent: Agent;
  public currentWeapon: Weapon;
  public primaryWeapon: Weapon;
  public sidearmWeapon: Weapon;
  public meleeWeapon: Weapon;
  public controlsSettings: ControlSettings;
  public graphicsSettings: GraphicsSettings;
  public events: GameEngineEvents;

  // 3D Scene Components
  public particleSystem!: ParticleSystem;
  public abilityManager!: AgentAbilityManager;
  public builtMap!: BuiltMap;
  public tacticalPings: RadarTacticalPing[] = [];
  private fpWeaponGroup: THREE.Group = new THREE.Group();
  private fpMuzzleLight: THREE.PointLight;
  private fpSightGlow: THREE.Mesh | null = null;
  private fpMagMesh: THREE.Mesh | null = null;
  private fpWeaponDefaultPos = new THREE.Vector3(0.24, -0.22, -0.42);
  private fpWeaponAdsPos = new THREE.Vector3(0, -0.165, -0.32);
  private fpWeaponCurrentPos = new THREE.Vector3().copy(this.fpWeaponDefaultPos);

  // Player Kinematics
  public isSliding: boolean = false;
  private slideTimer: number = 0;
  private multikillCount: number = 0;
  private lastKillTimestamp: number = 0;
  public playerPosition = new THREE.Vector3(0, 1.6, 36);
  public playerVelocity = new THREE.Vector3();
  public playerYaw: number = 0;
  public playerPitch: number = 0;
  public isGrounded: boolean = true;
  public isCrouched: boolean = false;
  public isSprinting: boolean = false;
  public isAds: boolean = false;
  public isFiring: boolean = false;
  public cameraFov: number = 90;
  private footstepTimer: number = 0;
  private speedBoostTimer: number = 0;
  private speedBoostMultiplier: number = 1.0;
  private lastEmittedBloom: number = 0;
  private lastEmittedFlash: number = 0;
  private spikeBeepTimer: number = 0;

  // Weapons & Recoil State
  public currentAmmo: number = 25;
  public reserveAmmo: number = 75;
  public isReloading: boolean = false;
  private reloadProgress: number = 0;
  private fireTimer: number = 0;
  private recoilPitch: number = 0;
  private recoilYaw: number = 0;
  private crosshairBloom: number = 0;

  // Inspect Weapon State
  public isInspecting: boolean = false;
  private inspectTimer: number = 0;
  private inspectDuration: number = 2.8;

  // Pointer Lock & Mouse Look State
  public isPointerLocked: boolean = false;

  // Objective / Spike State
  public isSpikePlanted: boolean = false;
  public spikePosition: THREE.Vector3 | null = null;
  public spikeTimer: number = 45;
  public spikeModel: { group: THREE.Group; rings: THREE.Group; coreGlow: THREE.Mesh } | null = null;
  public droppedSpikePosition: THREE.Vector3 | null = null;
  private droppedSpikeModel: { group: THREE.Group; beaconRing: THREE.Mesh; coreMesh: THREE.Mesh } | null = null;
  public spikeCarrierId: string | null = 'player';
  public isPlayerPlanting: boolean = false;
  public plantProgress: number = 0;
  public isPlayerDefusing: boolean = false;
  public defuseProgress: number = 0;

  // Round & Match State (6 Attacker Rounds + 6 Defender Rounds, First to 7 Wins + Overtime on Ties)
  public roundTimeRemaining: number = 100;
  public roundState: 'buy_phase' | 'in_progress' | 'round_end' | 'match_end' = 'buy_phase';
  public buyPhaseTime: number = 60;
  public roundNumber: number = 0;
  public alphaSide: TeamSide = 'attackers';
  public targetWins: number = 7;
  public isOvertime: boolean = false;
  private invulnerableTimer: number = 0;
  private spawnProtectionTimer: number = 4.5;
  public lastKillerInfo: { killerName: string; weaponName: string; isHeadshot: boolean } | null = null;
  public alphaScore: number = 0;
  public omegaScore: number = 0;
  public allPlayers: MatchPlayer[] = [];
  public bots: BotState[] = [];
  public playerMatchData!: MatchPlayer;

  // Input states (Desktop & Mobile)
  public inputMove = new THREE.Vector2(); // x: strafe, y: forward/back
  public inputLook = new THREE.Vector2(); // x: yaw delta, y: pitch delta
  public inputJumpJustPressed: boolean = false;
  private heldKeys = new Set<string>();

  constructor(
    container: HTMLElement,
    mapData: MapData,
    mode: GameMode,
    agent: Agent,
    weapon: Weapon,
    controls: ControlSettings,
    graphics: GraphicsSettings,
    events: GameEngineEvents,
    botDifficulty: BotDifficulty = 'Normal'
  ) {
    this.container = container;
    this.activeMap = mapData;
    this.activeMode = mode;
    this.botDifficulty = botDifficulty;
    this.playerAgent = agent;
    this.currentWeapon = weapon;
    this.primaryWeapon = weapon;
    this.sidearmWeapon = WEAPONS.find(w => w.id === DEFAULT_SIDEARM_ID) || WEAPONS[0];
    this.meleeWeapon = WEAPONS.find(w => w.id === DEFAULT_MELEE_ID) || WEAPONS[0];
    this.controlsSettings = controls;
    this.graphicsSettings = graphics;
    this.events = events;

    // Detect software WebGL
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // Initialize WebGL Renderer (with mobile pixel-ratio cap for high FPS alongside static geometry batching)
    const isMobileDevice = this.isTouchDevice();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && !isMobileDevice && graphics.preset !== 'Low',
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, isMobileDevice ? 1.35 : 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && graphics.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(mapData.skyColor);
    this.scene.fog = new THREE.FogExp2(mapData.fogColor, mapData.fogDensity);

    this.particleSystem = new ParticleSystem(this.scene);
    this.abilityManager = new AgentAbilityManager(this.scene);

    this.camera = new THREE.PerspectiveCamera(
      graphics.fov,
      container.clientWidth / container.clientHeight,
      0.05,
      300
    );
    this.camera.rotation.order = 'YXZ';

    // Balanced Studio Environment map via PMREMGenerator
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const isArcticMap = mapData.theme === 'arctic';
    this.scene.environmentIntensity = isArcticMap ? 0.42 : 0.72;
    pmrem.dispose();

    // Post-Processing Pipeline (EffectComposer + UnrealBloomPass + OutputPass on hardware GPUs)
    if (!this.isSoftwareGl && (graphics.postProcessing || graphics.preset === 'High' || graphics.preset === 'Ultra')) {
      this.composer = new EffectComposer(this.renderer);
      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        0.24, // controlled bloom strength to prevent highlight blowout
        0.3,  // bloom radius
        0.9   // high threshold so only emissive neon/lasers bloom, never walls or sky
      );
      this.composer.addPass(bloomPass);

      const outputPass = new OutputPass();
      this.composer.addPass(outputPass);
    }

    // 360° Balanced Global Illumination Rig (Eliminates harsh shadow contrast & dark wall faces)
    // 1. Primary Key Sun Light
    const sunLight = new THREE.DirectionalLight(mapData.sunColor, mapData.sunIntensity);
    sunLight.position.set(...mapData.sunPosition);
    if (!this.isSoftwareGl && graphics.shadows) {
      sunLight.castShadow = true;
      const shadowRes = isMobileDevice ? 512 : 1024;
      sunLight.shadow.mapSize.width = shadowRes;
      sunLight.shadow.mapSize.height = shadowRes;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 150;
      const d = 55;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    this.scene.add(sunLight);

    // 2. Opposite-Azimuth Fill Light (Ensures North/South & shadow-facing walls are evenly illuminated)
    const fillLight = new THREE.DirectionalLight(0xf8fafc, mapData.sunIntensity * (isArcticMap ? 0.32 : 0.68));
    fillLight.position.set(
      -mapData.sunPosition[0],
      mapData.sunPosition[1] * 0.85,
      -mapData.sunPosition[2]
    );
    this.scene.add(fillLight);

    // 3. Cross-Axis Bounce Light (Smooths contrast between East/West corridors)
    const crossLight = new THREE.DirectionalLight(mapData.ambientColor, isArcticMap ? 0.2 : 0.55);
    crossLight.position.set(-mapData.sunPosition[2], 42, mapData.sunPosition[0]);
    this.scene.add(crossLight);

    // 4. High-Visibility Sky/Ground Hemisphere + Soft Ambient Base Light
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, mapData.ambientColor, isArcticMap ? 0.6 : 1.15);
    this.scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, isArcticMap ? 0.35 : 0.72);
    this.scene.add(ambientLight);

    // Weapon Muzzle Flash Light
    this.fpMuzzleLight = new THREE.PointLight(0xffeedd, 0, 8);
    this.camera.add(this.fpMuzzleLight);
    this.scene.add(this.camera);

    // Build Map & Load Players
    this.initMap();
    this.initPlayers();
    this.setupFirstPersonWeapon();
    this.setupDesktopInputs();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Resize listener
    window.addEventListener('resize', this.onWindowResize);
  }

  private initMap() {
    this.builtMap = buildMap(this.activeMap);
    // Freeze static map root group transform updates since all static map meshes are pre-batched in world space
    this.builtMap.sceneGroup.matrixAutoUpdate = false;
    this.builtMap.sceneGroup.updateMatrix();
    this.scene.add(this.builtMap.sceneGroup);

    // Initial player position based on team (Alpha = Attackers)
    this.playerPosition.set(
      this.activeMap.attackerSpawn.x,
      1.6,
      this.activeMap.attackerSpawn.z
    );
    this.playerYaw = this.activeMap.attackerSpawn.yaw;
  }

  private initPlayers() {
    this.allPlayers = [];
    this.bots = [];

    // Player Match Object (starts with default Sidearm + Melee Knife + Primary)
    this.playerMatchData = {
      id: 'player',
      name: 'OPERATIVE',
      agentId: this.playerAgent.id,
      isBot: false,
      team: 'alpha',
      side: 'attackers',
      hasSpike: true,
      health: 100,
      maxHealth: 100,
      armor: 50,
      maxArmor: 50,
      credits: 2400,
      isAlive: true,
      isPlanting: false,
      isDefusing: false,
      ultPoints: 3,
      currentWeaponId: this.currentWeapon.id,
      sidearmWeaponId: DEFAULT_SIDEARM_ID,
      meleeWeaponId: DEFAULT_MELEE_ID,
      inventory: [this.currentWeapon.id, DEFAULT_SIDEARM_ID, DEFAULT_MELEE_ID],
      abilityCooldowns: {},
      abilityCharges: {
        ability_1: 2,
        ability_2: 2,
        ability_3: 1
      },
      stats: {
        kills: 0,
        deaths: 0,
        assists: 0,
        score: 0,
        headshots: 0,
        damageDealt: 0,
        plants: 0,
        defuses: 0
      }
    };
    this.allPlayers.push(this.playerMatchData);

    // Populate 4 friendly bots (Alpha) & 5 enemy bots (Omega)
    const agentPool = AGENTS.filter(a => a.id !== this.playerAgent.id);
    let agentIdx = 0;

    // 4 Allies (In Practice Range, skip ally bots so player can focus on targets)
    const allyCount = this.activeMode === 'practice_range' ? 0 : 4;
    for (let i = 1; i <= allyCount; i++) {
      const agent = agentPool[agentIdx % agentPool.length];
      agentIdx++;
      const randWpn = pickRandomBuyPhaseWeapon();
      const botPlayer: MatchPlayer = {
        id: `bot_alpha_${i}`,
        name: `${agent.callsign} [BOT]`,
        agentId: agent.id,
        isBot: true,
        botDifficulty: this.botDifficulty,
        team: 'alpha',
        side: 'attackers',
        hasSpike: false,
        health: 100,
        maxHealth: 100,
        armor: 50,
        maxArmor: 50,
        credits: 2400,
        isAlive: true,
        isPlanting: false,
        isDefusing: false,
        ultPoints: 2,
        currentWeaponId: randWpn.id,
        sidearmWeaponId: DEFAULT_SIDEARM_ID,
        meleeWeaponId: DEFAULT_MELEE_ID,
        inventory: [randWpn.id, DEFAULT_SIDEARM_ID, DEFAULT_MELEE_ID],
        abilityCooldowns: {},
        abilityCharges: {},
        stats: { kills: 0, deaths: 0, assists: 0, score: 0, headshots: 0, damageDealt: 0, plants: 0, defuses: 0 }
      };
      this.allPlayers.push(botPlayer);

      const botModel = createCharacterBotModel('alpha', agent.callsign, agent.gender);
      this.scene.add(botModel.group);

      const spawnPos = new THREE.Vector3(
        this.activeMap.attackerSpawn.x + (i - 2.5) * 4,
        0,
        this.activeMap.attackerSpawn.z + 4
      );
      const botState = createBotState(botPlayer, botModel, spawnPos, Math.PI);
      this.bots.push(botState);
    }

    // 5 Enemies (Omega)
    for (let i = 1; i <= 5; i++) {
      const agent = agentPool[agentIdx % agentPool.length];
      agentIdx++;
      const randWpn = pickRandomBuyPhaseWeapon();
      const botPlayer: MatchPlayer = {
        id: `bot_omega_${i}`,
        name: `${agent.callsign} [BOT]`,
        agentId: agent.id,
        isBot: true,
        botDifficulty: this.activeMode === 'practice_range' ? 'Beginner' : this.botDifficulty,
        team: 'omega',
        side: 'defenders',
        hasSpike: false,
        health: 100,
        maxHealth: 100,
        armor: 50,
        maxArmor: 50,
        credits: 2400,
        isAlive: true,
        isPlanting: false,
        isDefusing: false,
        ultPoints: 2,
        currentWeaponId: randWpn.id,
        sidearmWeaponId: DEFAULT_SIDEARM_ID,
        meleeWeaponId: DEFAULT_MELEE_ID,
        inventory: [randWpn.id, DEFAULT_SIDEARM_ID, DEFAULT_MELEE_ID],
        abilityCooldowns: {},
        abilityCharges: {},
        stats: { kills: 0, deaths: 0, assists: 0, score: 0, headshots: 0, damageDealt: 0, plants: 0, defuses: 0 }
      };
      this.allPlayers.push(botPlayer);

      const botModel = createCharacterBotModel('omega', agent.callsign, agent.gender);
      this.scene.add(botModel.group);

      const spawnPos = new THREE.Vector3(
        this.activeMap.defenderSpawn.x + (i - 3) * 4,
        0,
        this.activeMap.defenderSpawn.z - 4
      );
      const botState = createBotState(botPlayer, botModel, spawnPos, 0);
      this.bots.push(botState);
    }
  }

  public setupFirstPersonWeapon(newWeapon?: Weapon) {
    if (newWeapon) {
      this.currentWeapon = newWeapon;
      this.playerMatchData.currentWeaponId = newWeapon.id;
      if (newWeapon.category === 'Melee') {
        this.meleeWeapon = newWeapon;
        this.playerMatchData.meleeWeaponId = newWeapon.id;
      } else if (newWeapon.category === 'Pistols') {
        this.sidearmWeapon = newWeapon;
        this.playerMatchData.sidearmWeaponId = newWeapon.id;
      } else {
        this.primaryWeapon = newWeapon;
      }
      if (!this.playerMatchData.inventory.includes(newWeapon.id)) {
        this.playerMatchData.inventory.push(newWeapon.id);
      }
    }

    // Remove old weapon
    while (this.fpWeaponGroup.children.length > 0) {
      this.fpWeaponGroup.remove(this.fpWeaponGroup.children[0]);
    }
    this.camera.remove(this.fpWeaponGroup);

    const fpModel = createFirstPersonWeaponModel(this.currentWeapon, this.playerAgent.callsign);
    this.fpWeaponGroup = fpModel.group;
    this.fpSightGlow = fpModel.sightGlow;
    this.fpMagMesh = fpModel.magMesh;

    this.fpMuzzleLight.position.copy(fpModel.muzzlePos);

    this.fpWeaponGroup.position.copy(this.fpWeaponDefaultPos);
    this.camera.add(this.fpWeaponGroup);

    this.currentAmmo = this.currentWeapon.magazineSize;
    this.reserveAmmo = this.currentWeapon.reserveAmmo;
    this.isReloading = false;
    this.cancelInspect();
    this.events.onPlayerStatsChange(this.playerMatchData);
  }

  public switchWeapon(targetWeapon: Weapon) {
    if (!this.playerMatchData.isAlive) return;
    this.cancelInspect();
    if (targetWeapon.id !== this.currentWeapon.id) {
      soundEngine.playWeaponSwitch();
      this.setupFirstPersonWeapon(targetWeapon);
    }
  }

  /**
   * Toggles the weapon inspection animation on/off
   */
  public toggleInspectWeapon() {
    if (!this.playerMatchData.isAlive || this.isReloading) return;
    if (this.isInspecting) {
      this.cancelInspect();
    } else {
      this.inspectWeapon();
    }
  }

  /**
   * Triggers the full inspection animation and audio playback for the equipped weapon
   */
  public inspectWeapon() {
    if (!this.playerMatchData.isAlive || this.isReloading) return;
    this.isInspecting = true;
    this.inspectTimer = 0;
    const isMelee = this.currentWeapon.category === 'Melee';
    soundEngine.playWeaponInspect(this.currentWeapon.category, isMelee);
    this.events.onInspectChange?.(true);
    this.events.onRoundStateChange?.(
      this.roundState,
      `INSPECTING [${this.currentWeapon.name.toUpperCase()}]`
    );
  }

  /**
   * Immediately interrupts/cancels weapon inspection so combat is never sluggish
   */
  public cancelInspect() {
    if (!this.isInspecting) return;
    this.isInspecting = false;
    this.inspectTimer = 0;
    this.events.onInspectChange?.(false);
  }

  /**
   * Cycles equipped weapon up or down (Mouse Wheel or quick switch)
   */
  public cycleWeapon(direction: 1 | -1) {
    if (!this.playerMatchData.isAlive) return;
    this.cancelInspect();
    const loadout: Weapon[] = [
      this.primaryWeapon,
      this.sidearmWeapon,
      this.meleeWeapon
    ].filter(Boolean);

    if (loadout.length <= 1) return;

    let currentIndex = loadout.findIndex(w => w.id === this.currentWeapon.id);
    if (currentIndex === -1) currentIndex = 0;

    const nextIndex = (currentIndex + direction + loadout.length) % loadout.length;
    const targetWeapon = loadout[nextIndex];
    this.switchWeapon(targetWeapon);
  }

  /**
   * Requests browser Pointer Lock for FPS mouse control
   */
  public requestPointerLock() {
    try {
      const canvas = this.renderer.domElement;
      if (document.pointerLockElement !== canvas && document.pointerLockElement !== this.container) {
        if (canvas.requestPointerLock) {
          canvas.requestPointerLock();
        } else if (this.container.requestPointerLock) {
          this.container.requestPointerLock();
        }
      }
    } catch {}
  }

  /**
   * Rolls a random weapon during the 1-minute Buy Phase (or Practice Range)
   */
  public rollRandomWeapon(): Weapon {
    const rolled = pickRandomBuyPhaseWeapon(this.currentWeapon.id);
    this.primaryWeapon = rolled;
    this.setupFirstPersonWeapon(rolled);
    soundEngine.playUIClick();
    this.events.onRoundStateChange(
      this.roundState,
      `RANDOMIZED LOADOUT: ${rolled.name.toUpperCase()} (${(rolled.specialAbility?.name || 'TACTICAL').toUpperCase()})`
    );
    return rolled;
  }

  /**
   * Allows player to immediately end the 60s Buy Phase and start combat
   */
  public skipBuyPhase() {
    if (this.roundState !== 'buy_phase') return;
    this.buyPhaseTime = 0;
    this.roundState = 'in_progress';
    this.spawnProtectionTimer = 2.5;
    soundEngine.playUIClick();
    this.events.onRoundStateChange('in_progress', 'COMBAT PHASE ENGAGED');
  }

  private isMouseDraggingLook: boolean = false;
  private onKeyDownHandler!: (e: KeyboardEvent) => void;
  private onKeyUpHandler!: (e: KeyboardEvent) => void;
  private onMouseMoveHandler!: (e: MouseEvent) => void;
  private onMouseDownHandler!: (e: MouseEvent) => void;
  private onMouseUpHandler!: (e: MouseEvent) => void;
  private onBlurHandler!: () => void;
  private onContextMenuHandler!: (e: MouseEvent) => void;
  private onPointerLockChangeHandler!: () => void;
  private onWheelHandler!: (e: WheelEvent) => void;
  private onViewportClickHandler!: (e: MouseEvent) => void;

  private setupDesktopInputs() {
    this.onKeyDownHandler = (e: KeyboardEvent) => {
      // Don't intercept game shortcuts if typing in text inputs or chat
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // Prevent browser shortcuts or focused button activation from hijacking simultaneous game keys
      if (
        ['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)
      ) {
        e.preventDefault();
      }
      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }

      this.heldKeys.add(e.code);
      this.heldKeys.add(e.key.toLowerCase());

      if (e.code === 'Space') {
        this.inputJumpJustPressed = true;
      }
      if (e.code === 'KeyR' && !this.isReloading && this.currentAmmo < this.currentWeapon.magazineSize) {
        this.cancelInspect();
        this.reload();
      }
      if (e.code === 'KeyY' || e.code === 'KeyI') {
        this.toggleInspectWeapon();
      }
      if (e.code === 'Escape') {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
      if (e.code === 'KeyB') {
        if (document.pointerLockElement) document.exitPointerLock();
        this.events.onBuyMenuToggle?.(true);
      }
      if (e.code === 'KeyM') {
        if (document.pointerLockElement) document.exitPointerLock();
        this.events.onMapToggle?.();
      }
      if (e.code === 'Tab') {
        if (document.pointerLockElement) document.exitPointerLock();
        this.events.onScoreboardToggle?.();
      }
      if (e.code === 'KeyF' || e.code === 'Digit4') {
        this.cancelInspect();
        if (this.playerMatchData.side === 'attackers' && !this.isSpikePlanted) {
          if (!this.playerMatchData.hasSpike) {
            this.pickupSpike();
          } else {
            this.plantSpike();
          }
        } else if (this.playerMatchData.side === 'defenders' && this.isSpikePlanted) {
          this.defuseSpike();
        }
      }
      if (e.code === 'KeyV' && !e.repeat) {
        this.cancelInspect();
        if (this.playerMatchData.side === 'attackers' && !this.isSpikePlanted) {
          if (this.playerMatchData.hasSpike) {
            this.dropSpike();
          } else {
            this.pickupSpike();
          }
        }
      }
      if (e.code === 'KeyG' && !e.repeat) {
        if (this.roundState === 'buy_phase' || this.activeMode === 'practice_range') {
          this.rollRandomWeapon();
        }
      }
      if (e.code === 'KeyZ') {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const mapMeshes = this.builtMap.colliders.map(c => c.mesh);
        const hits = raycaster.intersectObjects(mapMeshes, true);
        if (hits.length > 0) {
          this.placeTacticalPing(hits[0].point.x, hits[0].point.z, 'TACTICAL PING');
        } else {
          const forward = new THREE.Vector3(0, 0, -18).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerYaw);
          this.placeTacticalPing(this.playerPosition.x + forward.x, this.playerPosition.z + forward.z, 'TACTICAL PING');
        }
      }
      if (e.code === 'Digit1') {
        this.switchWeapon(this.primaryWeapon);
      }
      if (e.code === 'Digit2') {
        this.switchWeapon(this.sidearmWeapon);
      }
      if (e.code === 'Digit3') {
        this.switchWeapon(this.meleeWeapon);
      }
      if (e.code === 'KeyQ' && !e.repeat) {
        this.cancelInspect();
        this.triggerAbility('ability_1');
      }
      if (e.code === 'KeyE' && !e.repeat) {
        this.cancelInspect();
        this.triggerAbility('ability_2');
      }
      if (e.code === 'KeyC' && !e.repeat && !this.heldKeys.has('ShiftLeft') && !this.heldKeys.has('shift')) {
        this.cancelInspect();
        this.triggerAbility('ability_3');
      }
      if (e.code === 'KeyX' && !e.repeat) {
        this.cancelInspect();
        this.triggerUltimate();
      }
    };

    this.onKeyUpHandler = (e: KeyboardEvent) => {
      this.heldKeys.delete(e.code);
      this.heldKeys.delete(e.key.toLowerCase());
    };

    this.onBlurHandler = () => {
      this.heldKeys.clear();
      this.isFiring = false;
      this.isMouseDraggingLook = false;
    };

    // Track Pointer Lock state reliably across all desktop browsers
    this.onPointerLockChangeHandler = () => {
      this.isPointerLocked = (
        document.pointerLockElement === this.container ||
        document.pointerLockElement === this.renderer.domElement
      );
    };
    document.addEventListener('pointerlockchange', this.onPointerLockChangeHandler);

    // Click anywhere on viewport to request pointer lock on PC
    this.onViewportClickHandler = (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.closest('button') ||
          targetEl.closest('input') ||
          targetEl.closest('textarea') ||
          targetEl.closest('.no-pointer-lock'))
      ) {
        return;
      }
      this.requestPointerLock();
    };
    window.addEventListener('click', this.onViewportClickHandler);

    // Mouse look with pointer lock or drag-look
    this.onMouseMoveHandler = (e: MouseEvent) => {
      if (this.isPointerLocked || this.isMouseDraggingLook) {
        // Discard abnormal delta spikes from pointerlock focus changes
        if (Math.abs(e.movementX) > 350 || Math.abs(e.movementY) > 350) return;

        const sensX = this.controlsSettings.lookSensitivityX * 0.0022;
        const sensY = this.controlsSettings.lookSensitivityY * 0.0022;
        const adsMultiplier = this.isAds ? this.controlsSettings.adsSensitivityMultiplier : 1.0;

        this.playerYaw -= e.movementX * sensX * adsMultiplier;
        const invert = this.controlsSettings.invertY ? -1 : 1;
        this.playerPitch -= e.movementY * sensY * adsMultiplier * invert;
        this.playerPitch = THREE.MathUtils.clamp(this.playerPitch, -1.45, 1.45);
      }
    };

    this.onMouseDownHandler = (e: MouseEvent) => {
      // Ignore clicks on UI buttons overlay
      const targetEl = e.target as HTMLElement | null;
      if (targetEl && (targetEl.closest('button') || targetEl.closest('input') || targetEl.closest('textarea'))) return;

      if (e.button === 0) {
        if (!this.isPointerLocked) {
          this.requestPointerLock();
        }
        this.isFiring = true;
        this.isMouseDraggingLook = true;
        this.cancelInspect();
        if (this.fireTimer <= 0) {
          this.shootWeapon();
        }
      } else if (e.button === 2) {
        this.cancelInspect();
        this.toggleAds();
      }
    };

    this.onMouseUpHandler = (e: MouseEvent) => {
      if (e.button === 0) {
        this.isFiring = false;
        this.isMouseDraggingLook = false;
      }
    };

    // Mouse wheel weapon switching (Scroll up = Next, Scroll down = Prev)
    this.onWheelHandler = (e: WheelEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.closest('.overflow-y-auto') || targetEl.closest('input') || targetEl.closest('textarea'))
      ) {
        return;
      }
      if (e.deltaY < 0) {
        this.cycleWeapon(1);
      } else if (e.deltaY > 0) {
        this.cycleWeapon(-1);
      }
    };

    this.onContextMenuHandler = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('keydown', this.onKeyDownHandler);
    window.addEventListener('keyup', this.onKeyUpHandler);
    window.addEventListener('blur', this.onBlurHandler);
    window.addEventListener('mousemove', this.onMouseMoveHandler);
    window.addEventListener('mousedown', this.onMouseDownHandler);
    window.addEventListener('mouseup', this.onMouseUpHandler);
    window.addEventListener('wheel', this.onWheelHandler, { passive: true });
    window.addEventListener('contextmenu', this.onContextMenuHandler);
  }

  public isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  public toggleAds() {
    if (!this.playerMatchData.isAlive) return;
    this.isAds = !this.isAds;
    soundEngine.playUIClick();
  }

  public triggerAbility(type: 'ability_1' | 'ability_2' | 'ability_3') {
    if (!this.playerMatchData.isAlive) return;
    const charges = this.playerMatchData.abilityCharges[type] ?? 1;
    if (charges <= 0) {
      // Auto-recharge signature ability after round action so player never feels stuck
      this.playerMatchData.abilityCharges[type] = 1;
    } else {
      this.playerMatchData.abilityCharges[type] = Math.max(0, charges - 1);
    }

    const ability = type === 'ability_1' 
      ? this.playerAgent.ability1 
      : type === 'ability_2' 
      ? this.playerAgent.ability2 
      : this.playerAgent.ability3;

    // Weapon cast animation dip
    this.weaponJumpDip = -0.14;
    this.fpWeaponGroup.rotation.z = 0.35;

    const lookDir = new THREE.Vector3();
    this.camera.getWorldDirection(lookDir);

    const result = this.abilityManager.castAbility(
      ability.id,
      this.playerAgent,
      this.playerMatchData,
      this.playerPosition,
      lookDir,
      this.playerYaw,
      this.builtMap.colliders,
      this.bots,
      (bot, dmg, abilityName, attacker) => {
        this.applyDamageToBot(
          bot,
          dmg,
          false,
          bot.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
          attacker || this.playerMatchData,
          abilityName,
          true
        );
      }
    );

    if (result.dashVelocity) {
      this.abilityManager.physicsEngine.triggerAbilityImpulse(result.dashVelocity, 0.28, 0.45);
      if (result.dashVelocity.y > 0.5) {
        this.playerVelocity.y = result.dashVelocity.y;
        this.isGrounded = false;
      }
    }
    if (result.speedBoost) {
      this.speedBoostMultiplier = result.speedBoost;
      this.speedBoostTimer = 6.0;
    }
    if (result.invulnerableTime) {
      this.invulnerableTimer = Math.max(this.invulnerableTimer, result.invulnerableTime);
    }

    this.triggerVoiceLine('ability');
    this.events.onPlayerStatsChange(this.playerMatchData);
  }

  /**
   * Hook to trigger randomized agent-specific voice line audio clips & HUD radio comms
   */
  public triggerVoiceLine(event: VoiceLineEvent, speakerAgent?: Agent, force: boolean = false) {
    const agent = speakerAgent || this.playerAgent;
    const text = pickRandomVoiceLine(agent, event);
    const played = soundEngine.playAgentVoiceLine(agent, event, text, force);

    if (played) {
      this.events.onVoiceLine?.({
        id: Math.random().toString(36).slice(2, 9),
        agentId: agent.id,
        callsign: agent.callsign,
        agentName: agent.name,
        themeColor: agent.themeColor,
        event,
        text,
        timestamp: Date.now()
      });
    }
  }

  public triggerUltimate() {
    if (!this.playerMatchData.isAlive) return;
    const ult = this.playerAgent.ultimate;
    const req = ult.ultPointsRequired || 7;
    if (this.playerMatchData.ultPoints < req) {
      // Allow testing ultimate if in buy phase, otherwise require points
      if (this.roundState !== 'buy_phase') return;
    }

    this.playerMatchData.ultPoints = 0;
    this.weaponJumpDip = -0.2;
    this.fpWeaponGroup.rotation.z = -0.45;

    const lookDir = new THREE.Vector3();
    this.camera.getWorldDirection(lookDir);

    const result = this.abilityManager.castAbility(
      ult.id,
      this.playerAgent,
      this.playerMatchData,
      this.playerPosition,
      lookDir,
      this.playerYaw,
      this.builtMap.colliders,
      this.bots,
      (bot, dmg, abilityName, attacker) => {
        this.applyDamageToBot(
          bot,
          dmg,
          false,
          bot.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
          attacker || this.playerMatchData,
          abilityName,
          true
        );
      }
    );

    if (result.dashVelocity) {
      this.abilityManager.physicsEngine.triggerAbilityImpulse(result.dashVelocity, 0.32, 0.45);
      if (result.dashVelocity.y > 0.5) {
        this.playerVelocity.y = result.dashVelocity.y;
        this.isGrounded = false;
      }
    }
    if (result.speedBoost) {
      this.speedBoostMultiplier = result.speedBoost;
      this.speedBoostTimer = 8.0;
    }
    if (result.invulnerableTime) {
      this.invulnerableTimer = Math.max(this.invulnerableTimer, result.invulnerableTime);
    }

    this.triggerVoiceLine('ultimate', undefined, true);
    this.events.onPlayerStatsChange(this.playerMatchData);
  }

  public reload() {
    if (this.currentWeapon.category === 'Melee') return;
    if (this.isReloading || this.currentAmmo >= this.currentWeapon.magazineSize || this.reserveAmmo <= 0) return;
    this.isReloading = true;
    this.reloadProgress = 0;
    soundEngine.playReload('magOut');
    this.triggerVoiceLine('reload');
  }

  public shootWeapon() {
    if (!this.playerMatchData.isAlive || this.isReloading) return;
    const isMelee = this.currentWeapon.isMelee ?? (this.currentWeapon.category === 'Melee');
    if (!isMelee && this.currentAmmo <= 0) {
      this.reload();
      this.fireTimer = 0;
      return;
    }

    // If player fires during buy phase, start combat immediately with spawn protection!
    if (this.roundState === 'buy_phase') {
      this.roundState = 'in_progress';
      this.spawnProtectionTimer = 3.5;
      this.events.onRoundStateChange('in_progress', 'COMBAT ENGAGED');
    }

    if (!isMelee) {
      this.currentAmmo--;
    }
    this.fireTimer = 1 / this.currentWeapon.fireRate;

    // Procedural gunshot/melee audio & physical shell casing ejection
    soundEngine.playGunshot(
      this.currentWeapon.category,
      this.currentWeapon.archetype === 'suppressed_pistol' ||
        this.currentWeapon.archetype === 'phantom_carbine' ||
        this.currentWeapon.archetype === 'suppressed_smg'
    );
    if (!isMelee) {
      reportGunshot(this.playerMatchData.team, this.playerMatchData.id, this.playerPosition);
    }
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    if (!isMelee) {
      this.particleSystem.spawnShellCasing(this.playerPosition, camDir);
    }

    const abilityEffect = this.currentWeapon.specialAbility?.effect;
    const abilityValue = this.currentWeapon.specialAbility?.procValue ?? 20;

    // Special Ability: Phase Lunge (Karambit forward dash on slash)
    if (isMelee && abilityEffect === 'phase_lunge') {
      const lungeDir = camDir.clone().setY(0.08).normalize().multiplyScalar(11.5);
      this.abilityManager.physicsEngine.triggerAbilityImpulse(lungeDir, 0.18, 0.45);
    }

    // Special Ability: Shockwave Slash (Vibro-Katana 3D energy arc wave)
    if (isMelee && abilityEffect === 'shockwave_slash') {
      const arcGroup = new THREE.Group();
      const startArc = this.camera.position.clone().addScaledVector(camDir, 1.1);
      arcGroup.position.copy(startArc);
      arcGroup.rotation.y = this.playerYaw;
      const arcMesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.045, 8, 24, Math.PI * 0.85),
        new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.9 })
      );
      arcMesh.rotation.x = Math.PI / 2;
      arcGroup.add(arcMesh);
      this.scene.add(arcGroup);
      setTimeout(() => {
        arcGroup.position.addScaledVector(camDir, 2.2);
        arcGroup.scale.setScalar(1.4);
      }, 45);
      setTimeout(() => this.scene.remove(arcGroup), 140);
    }

    // Recoil kick & melee swing animation
    if (isMelee) {
      this.fpWeaponGroup.position.z -= 0.16;
      this.fpWeaponGroup.rotation.z = -0.82;
      this.fpWeaponGroup.rotation.x = 0.42;
      this.crosshairBloom = Math.min(this.crosshairBloom + 5, 16);
      this.events.onCrosshairBloom(this.crosshairBloom);
    } else {
      const recoilV = this.currentWeapon.recoilVertical * (this.isAds ? 0.55 : 0.9);
      const recoilH = (Math.random() - 0.5) * this.currentWeapon.recoilHorizontal;
      this.recoilPitch += recoilV;
      this.recoilYaw += recoilH;
      this.crosshairBloom = Math.min(this.crosshairBloom + 7, 26);
      this.events.onCrosshairBloom(this.crosshairBloom);

      // Muzzle flash light pulse
      this.fpMuzzleLight.intensity = 6;
      setTimeout(() => { this.fpMuzzleLight.intensity = 0; }, 55);

      // Weapon kickback animation
      this.fpWeaponGroup.position.z += 0.085;
      this.fpWeaponGroup.rotation.x += 0.085;
    }

    // Multi-pellet support for Shotguns (or single ray for Rifles/Snipers/Melee)
    const pellets = isMelee ? 1 : (this.currentWeapon.pelletCount || 1);
    const maxRange = isMelee ? (this.currentWeapon.meleeRange || 3.5) : 160;

    const uniqueMapTargets = new Set<THREE.Object3D>(this.builtMap.batchedMeshes);
    for (const c of this.builtMap.colliders) {
      uniqueMapTargets.add(c.mesh);
    }
    const mapTargetArray = Array.from(uniqueMapTargets);
    const enemyBots = this.bots.filter(b => b.player.team !== this.playerMatchData.team && b.player.isAlive);

    // For Melee wide arc check, also allow hitting an enemy within meleeRange in front of player cone
    if (isMelee) {
      let meleeHitBot: BotState | null = null;
      let bestMeleeDist = maxRange;
      for (const b of enemyBots) {
        const botCenter = b.position.clone().add(new THREE.Vector3(0, 1.1, 0));
        const toBot = botCenter.clone().sub(this.camera.position);
        const dist = toBot.length();
        if (dist <= maxRange) {
          const dot = camDir.dot(toBot.normalize());
          if (dot > 0.45 && dist < bestMeleeDist) {
            bestMeleeDist = dist;
            meleeHitBot = b;
          }
        }
      }
      if (meleeHitBot) {
        const hitPt = meleeHitBot.position.clone().add(new THREE.Vector3(0, 1.25, 0));
        const dmg = Math.round(this.currentWeapon.damageBody * 1.15);
        this.particleSystem.spawnSparks(hitPt, new THREE.Vector3(0, 1, 0), 20);
        this.applyWeaponSpecialEffectOnHit(meleeHitBot, hitPt, abilityEffect, abilityValue);
        this.applyDamageToBot(meleeHitBot, dmg, false, hitPt, this.playerMatchData, this.currentWeapon.name, false);
        this.events.onPlayerStatsChange(this.playerMatchData);
        return;
      }
    }

    for (let pIdx = 0; pIdx < pellets; pIdx++) {
      const raycaster = new THREE.Raycaster();
      const centerScreen = new THREE.Vector2(0, 0);

      const spreadAngle = (1 - this.currentWeapon.firstShotAccuracy) * this.currentWeapon.spread * (this.isAds ? 0.25 : 0.7);
      const pelletSpread = pellets > 1 ? this.currentWeapon.spread * 1.15 : spreadAngle;
      centerScreen.x += (Math.random() - 0.5) * pelletSpread * 6;
      centerScreen.y += (Math.random() - 0.5) * pelletSpread * 6;

      raycaster.setFromCamera(centerScreen, this.camera);

      const mapHits = raycaster.intersectObjects(mapTargetArray, true);
      const wallDist = mapHits.length > 0 ? Math.min(maxRange, mapHits[0].distance) : maxRange;

      let hitBot: BotState | null = null;
      const hitPoint = new THREE.Vector3();
      let bestBotDist = wallDist;
      let isHeadshot = false;

      for (const b of enemyBots) {
        if (!b.player.isAlive) continue;
        const meshHits = raycaster.intersectObject(b.model.group, true);
        if (meshHits.length > 0 && meshHits[0].distance < bestBotDist) {
          bestBotDist = meshHits[0].distance;
          hitBot = b;
          hitPoint.copy(meshHits[0].point);
          const relY = hitPoint.y - b.position.y;
          isHeadshot = relY >= 1.38 || meshHits[0].object === b.model.head;
          continue;
        }

        const botBox = new THREE.Box3(
          new THREE.Vector3(b.position.x - 0.52, b.position.y, b.position.z - 0.52),
          new THREE.Vector3(b.position.x + 0.52, b.position.y + 1.92, b.position.z + 0.52)
        );
        const boxHitPt = new THREE.Vector3();
        if (raycaster.ray.intersectBox(botBox, boxHitPt)) {
          const d = this.camera.position.distanceTo(boxHitPt);
          if (d < bestBotDist) {
            bestBotDist = d;
            hitBot = b;
            hitPoint.copy(boxHitPt);
            isHeadshot = boxHitPt.y - b.position.y >= 1.38;
          }
        }
      }

      // Spawn visible 3D bullet tracer line (for non-melee)
      if (!isMelee && pIdx < 4) {
        const tracerStart = this.camera.position
          .clone()
          .addScaledVector(camDir, 0.6)
          .add(new THREE.Vector3(0, -0.12, 0));
        const tracerEnd = hitBot
          ? hitPoint
          : mapHits.length > 0 && mapHits[0].distance <= maxRange
          ? mapHits[0].point
          : this.camera.position.clone().addScaledVector(raycaster.ray.direction, Math.min(45, maxRange));

        const tracerColor =
          abilityEffect === 'incendiary_burn'
            ? 0xf97316
            : abilityEffect === 'cryo_rounds'
            ? 0x38bdf8
            : abilityEffect === 'vampiric_siphon'
            ? 0xec4899
            : abilityEffect === 'explosive_rounds'
            ? 0xfacc15
            : 0x38bdf8;

        const tracerGeom = new THREE.BufferGeometry().setFromPoints([tracerStart, tracerEnd]);
        const tracerMat = new THREE.LineBasicMaterial({
          color: tracerColor,
          transparent: true,
          opacity: 0.78
        });
        const tracerLine = new THREE.Line(tracerGeom, tracerMat);
        this.scene.add(tracerLine);
        setTimeout(() => this.scene.remove(tracerLine), 65);
      }

      if (hitBot) {
        const rawDamage = isHeadshot ? this.currentWeapon.damageHead : this.currentWeapon.damageBody;
        const pelletDivisor = pellets > 1 ? pellets * 0.62 : 1;
        let damage = Math.round((rawDamage / pelletDivisor) * 1.15);

        if (abilityEffect === 'armor_shred' && hitBot.player.armor > 0) {
          hitBot.player.armor = Math.max(0, hitBot.player.armor - abilityValue);
          damage = Math.round(damage * 1.25);
        }

        this.particleSystem.spawnSparks(hitPoint, new THREE.Vector3(0, 1, 0), isHeadshot ? 20 : 10);
        if (pIdx === 0) {
          this.applyWeaponSpecialEffectOnHit(hitBot, hitPoint, abilityEffect, abilityValue);
        }
        this.applyDamageToBot(hitBot, damage, isHeadshot, hitPoint, this.playerMatchData, this.currentWeapon.name, false);
      } else if (mapHits.length > 0 && mapHits[0].distance <= maxRange) {
        const hit = mapHits[0];
        if (pIdx === 0 && abilityEffect === 'explosive_rounds') {
          this.triggerWeaponExplosiveSplash(hit.point, abilityValue);
        }
        const collider = this.builtMap.colliders.find(
          c => c.mesh === hit.object || c.mesh.children.includes(hit.object)
        );

        if (collider && collider.isExplosiveBarrel) {
          collider.barrelHealth = (collider.barrelHealth ?? 40) - this.currentWeapon.damageBody;
          if (collider.barrelHealth <= 0) {
            soundEngine.playDetonation();
            this.particleSystem.spawnExplosion(hit.point);
            this.scene.remove(collider.mesh);
            const idx = this.builtMap.colliders.indexOf(collider);
            if (idx !== -1) this.builtMap.colliders.splice(idx, 1);

            this.bots.forEach(b => {
              const d = b.position.distanceTo(hit.point);
              if (d < 9.0 && b.player.isAlive && b.player.team !== this.playerMatchData.team) {
                this.applyDamageToBot(
                  b,
                  Math.floor((1 - d / 9.0) * 135),
                  false,
                  hit.point,
                  this.playerMatchData,
                  'Explosive Barrel',
                  true
                );
              }
            });
          }
        } else if (pIdx === 0) {
          const normal = hit.face?.normal ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
          if (hit.object instanceof THREE.Mesh) {
            normal.transformDirection(hit.object.matrixWorld);
          }
          this.particleSystem.spawnSparks(hit.point, normal, 12);
          if (!isMelee) {
            this.particleSystem.spawnBulletDecal(hit.point, normal);
          }
        }
      }
    }

    this.events.onPlayerStatsChange(this.playerMatchData);
  }

  /**
   * Executes Weapon Special Ability on enemy hit
   */
  private applyWeaponSpecialEffectOnHit(
    hitBot: BotState,
    hitPoint: THREE.Vector3,
    abilityEffect: string | undefined,
    abilityValue: number
  ) {
    if (!abilityEffect) return;

    switch (abilityEffect) {
      case 'vampiric_siphon': {
        this.playerMatchData.health = Math.min(
          this.playerMatchData.maxHealth,
          this.playerMatchData.health + abilityValue
        );
        break;
      }
      case 'cryo_rounds': {
        hitBot.slowTimer = Math.max(hitBot.slowTimer || 0, abilityValue);
        break;
      }
      case 'radar_lock': {
        this.abilityManager.revealedEnemyIds.add(hitBot.player.id);
        setTimeout(() => {
          this.abilityManager.revealedEnemyIds.delete(hitBot.player.id);
        }, abilityValue * 1000);
        break;
      }
      case 'incendiary_burn': {
        this.particleSystem.spawnExplosion(hitPoint);
        this.applyDamageToBot(
          hitBot,
          abilityValue,
          false,
          hitPoint,
          this.playerMatchData,
          this.currentWeapon.specialAbility?.name || this.currentWeapon.name,
          true
        );
        break;
      }
      case 'chain_lightning': {
        // Arc electric jolt to nearby enemy within 6.5m
        const nearbyEnemy = this.bots.find(
          b =>
            b.player.id !== hitBot.player.id &&
            b.player.team !== this.playerMatchData.team &&
            b.player.isAlive &&
            b.position.distanceTo(hitBot.position) < 6.5
        );
        if (nearbyEnemy) {
          const arcStart = hitPoint.clone();
          const arcEnd = nearbyEnemy.position.clone().add(new THREE.Vector3(0, 1.2, 0));
          const boltGeom = new THREE.BufferGeometry().setFromPoints([arcStart, arcEnd]);
          const boltLine = new THREE.Line(
            boltGeom,
            new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.95 })
          );
          this.scene.add(boltLine);
          setTimeout(() => this.scene.remove(boltLine), 140);
          this.applyDamageToBot(
            nearbyEnemy,
            abilityValue,
            false,
            arcEnd,
            this.playerMatchData,
            this.currentWeapon.specialAbility?.name || this.currentWeapon.name,
            true
          );
        }
        break;
      }
      case 'explosive_rounds': {
        this.triggerWeaponExplosiveSplash(hitPoint, abilityValue);
        break;
      }
    }
  }

  private triggerWeaponExplosiveSplash(center: THREE.Vector3, radius: number) {
    this.particleSystem.spawnExplosion(center);
    soundEngine.playDetonation();
    for (const b of this.bots) {
      if (!b.player.isAlive || b.player.team === this.playerMatchData.team) continue;
      const d = b.position.distanceTo(center);
      if (d <= radius) {
        const splashDmg = Math.max(18, Math.round((1 - d / (radius + 0.5)) * 65));
        this.applyDamageToBot(
          b,
          splashDmg,
          false,
          center,
          this.playerMatchData,
          this.currentWeapon.specialAbility?.name || this.currentWeapon.name,
          true
        );
      }
    }
  }

  private applyDamageToBot(
    bot: BotState,
    damage: number,
    isHeadshot: boolean,
    hitPoint: THREE.Vector3,
    attacker: MatchPlayer = this.playerMatchData,
    weaponOrAbilityName: string = this.currentWeapon.name,
    isAbility: boolean = false
  ) {
    if (!bot.player.isAlive) return;
    // Strict no-friendly-fire guard: teammates & player abilities never harm allied operatives
    if (attacker && attacker.team === bot.player.team) return;

    if (attacker.id === 'player') {
      if (isHeadshot) {
        soundEngine.playHeadshotDink();
      } else {
        soundEngine.playHitmarker();
      }
      this.events.onHitmarker?.(isHeadshot);

      const dmgEntry: DamageNumber = {
        id: Math.random().toString(),
        amount: damage,
        isHeadshot,
        position: [hitPoint.x, hitPoint.y + 0.5, hitPoint.z],
        createdAt: Date.now()
      };
      this.events.onDamageNumber(dmgEntry);
    }

    attacker.stats.damageDealt += damage;

    // Armor absorption (35% absorbed by armor so TTK is crisp and responsive)
    let remainingDamage = damage;
    if (bot.player.armor > 0) {
      const absorbed = Math.min(bot.player.armor, Math.floor(damage * 0.35));
      bot.player.armor -= absorbed;
      remainingDamage -= absorbed;
    }
    bot.player.health = Math.max(0, bot.player.health - remainingDamage);

    // Elimination check
    if (bot.player.health <= 0 && bot.player.isAlive) {
      bot.player.isAlive = false;
      bot.player.stats.deaths++;
      attacker.stats.kills++;
      if (isHeadshot) {
        attacker.stats.headshots++;
      }
      attacker.stats.score += isHeadshot ? 250 : 200;
      attacker.credits += 300;
      attacker.ultPoints = Math.min(7, attacker.ultPoints + 1);

      // If an Attacker bot carrying the Spike dies, drop the Spike at their location!
      if (bot.player.hasSpike && !this.isSpikePlanted) {
        bot.player.hasSpike = false;
        this.spawnDroppedSpikeAt(bot.position.clone());
      }

      if (attacker.id === 'player') {
        // Weapon Special Ability: Overdrive Refund (refill mag + bonus shield on kill)
        if (this.currentWeapon.specialAbility?.effect === 'overdrive_refund') {
          this.currentAmmo = this.currentWeapon.magazineSize;
          this.playerMatchData.armor = Math.min(
            this.playerMatchData.maxArmor,
            this.playerMatchData.armor + (this.currentWeapon.specialAbility.procValue || 25)
          );
        }

        // Vortex Passive: Kinetic Momentum reset dash & speed boost on kill
        if (this.playerAgent.id === 'agent_vortex') {
          this.playerMatchData.abilityCharges['ability_1'] = Math.min(
            2,
            (this.playerMatchData.abilityCharges['ability_1'] ?? 0) + 1
          );
        }

        // Deathmatch & Practice Range: Instant Combat Siphon (Heal + Ammo Refill on Kill)
        if (this.activeMode === 'deathmatch' || this.activeMode === 'practice_range') {
          this.playerMatchData.health = 100;
          this.playerMatchData.armor = 50;
          this.currentAmmo = this.currentWeapon.magazineSize;
          this.reserveAmmo = this.currentWeapon.reserveAmmo;
          if (this.activeMode === 'practice_range') {
            this.playerMatchData.ultPoints = 7;
            this.playerMatchData.abilityCharges = { ability_1: 2, ability_2: 2, ability_3: 2 };
          }
        }

        const now = Date.now();
        if (now - this.lastKillTimestamp < 5000) {
          this.multikillCount++;
        } else {
          this.multikillCount = 1;
        }
        this.lastKillTimestamp = now;

        if (this.multikillCount === 2) this.events.onMultikill?.('DOUBLE KILL');
        else if (this.multikillCount === 3) this.events.onMultikill?.('TRIPLE KILL');
        else if (this.multikillCount === 4) this.events.onMultikill?.('QUADRA KILL');
        else if (this.multikillCount >= 5) this.events.onMultikill?.('ACE - SQUAD WIPED!');

        // Trigger agent-specific kill or headshot kill voice line
        this.triggerVoiceLine(isHeadshot ? 'headshot_kill' : 'kill', undefined, true);
      }

      const killFeed: KillFeedEntry = {
        id: Math.random().toString(),
        killerName: attacker.name,
        killerTeam: attacker.team,
        victimName: bot.player.name,
        victimTeam: bot.player.team,
        weaponName: weaponOrAbilityName,
        isHeadshot,
        isAbility,
        timestamp: Date.now()
      };
      this.events.onKillFeed(killFeed);
      this.events.onPlayerStatsChange(this.playerMatchData);

      // Respawn modes (Team Elimination, Deathmatch, Practice Range)
      if (
        this.activeMode === 'team_elimination' ||
        this.activeMode === 'deathmatch' ||
        this.activeMode === 'practice_range'
      ) {
        if (attacker.team === 'alpha') this.alphaScore++;
        else this.omegaScore++;
        this.events.onScoreUpdate(this.alphaScore, this.omegaScore);

        if (this.activeMode === 'team_elimination' && (this.alphaScore >= 25 || this.omegaScore >= 25)) {
          this.endRound(this.alphaScore >= 25 ? 'alpha' : 'omega', 'ELIMINATION TARGET REACHED (25)');
          return;
        }

        // Schedule bot respawn after 2.4 seconds
        setTimeout(() => {
          if (!this.isRunning) return;
          bot.player.health = 100;
          bot.player.armor = 50;
          bot.player.isAlive = true;
          const isAlpha = bot.player.team === 'alpha';
          const spawnBase = isAlpha ? this.activeMap.attackerSpawn : this.activeMap.defenderSpawn;
          const randOffset = (Math.random() - 0.5) * 18;
          if (this.activeMode === 'practice_range') {
            bot.position.set(randOffset, 0, (Math.random() - 0.5) * 16);
          } else {
            bot.position.set(spawnBase.x + randOffset, 0, spawnBase.z + (isAlpha ? 3 : -3));
          }
          bot.model.group.rotation.x = 0;
          bot.model.group.visible = true;
        }, 2400);
      } else {
        this.checkRoundWinConditions();
      }
    }
  }

  public applyDamageToPlayer(
    damage: number,
    isHeadshot: boolean,
    attacker?: MatchPlayer,
    weaponOrAbilityName: string = 'VANDAL-X',
    isAbility: boolean = false
  ) {
    if (!this.playerMatchData.isAlive) return;
    if (this.roundState !== 'in_progress') return;
    if (this.spawnProtectionTimer > 0 || this.invulnerableTimer > 0) return;
    // Strict no-friendly-fire guard: ONLY enemy ('omega') operatives or enemy abilities can ever damage the player
    if (!attacker || attacker.team === this.playerMatchData.team) return;

    attacker.stats.damageDealt += damage;
    if (this.activeMode === 'practice_range') {
      // In Practice Range, player armor regenerates so training is uninterrupted
      this.playerMatchData.health = Math.max(25, this.playerMatchData.health - Math.floor(damage * 0.2));
      this.events.onPlayerStatsChange(this.playerMatchData);
      return;
    }

    // Weapon Special Ability: Ballistic Gun-Shield (Vulcan Minigun reduces incoming frontal damage by 25%)
    let effectiveDamage = damage;
    if (this.currentWeapon.specialAbility?.effect === 'ballistic_shield') {
      effectiveDamage = Math.max(1, Math.round(damage * 0.75));
    }

    let remaining = effectiveDamage;
    if (this.playerMatchData.armor > 0) {
      const absorbed = Math.min(this.playerMatchData.armor, Math.floor(effectiveDamage * 0.45));
      this.playerMatchData.armor -= absorbed;
      remaining -= absorbed;
    }
    this.playerMatchData.health = Math.max(0, this.playerMatchData.health - remaining);

    this.events.onPlayerTakeDamage(effectiveDamage, isHeadshot);
    this.events.onPlayerStatsChange(this.playerMatchData);

    // Trigger agent-specific damage voice line when taking combat hits while alive
    if (this.playerMatchData.health > 0 && effectiveDamage >= 10) {
      this.triggerVoiceLine('damage');
    }

    // Low HP heartbeat cue
    soundEngine.setHeartbeatActive(this.playerMatchData.health > 0 && this.playerMatchData.health <= 30);

    if (this.playerMatchData.health <= 0) {
      this.playerMatchData.isAlive = false;
      this.playerMatchData.stats.deaths++;
      this.isFiring = false;
      this.isAds = false;
      this.inputMove.set(0, 0);

      // If Player was carrying the Spike, drop it on the ground for allied Attackers!
      if (this.playerMatchData.hasSpike && !this.isSpikePlanted) {
        this.playerMatchData.hasSpike = false;
        this.spawnDroppedSpikeAt(new THREE.Vector3(this.playerPosition.x, 0, this.playerPosition.z));
      }

      this.events.onPlayerStatsChange(this.playerMatchData);
      soundEngine.setHeartbeatActive(false);
      soundEngine.playPlayerDeath();
      this.particleSystem.spawnSparks(this.playerPosition.clone(), new THREE.Vector3(0, 1, 0), 28);

      this.lastKillerInfo = {
        killerName: attacker.name,
        weaponName: weaponOrAbilityName,
        isHeadshot
      };

      attacker.stats.kills++;
      if (isHeadshot) {
        attacker.stats.headshots++;
      }
      attacker.stats.score += isHeadshot ? 250 : 200;
      attacker.credits += 300;
      attacker.ultPoints = Math.min(7, attacker.ultPoints + 1);
      this.events.onKillFeed({
        id: Math.random().toString(),
        killerName: attacker.name,
        killerTeam: attacker.team,
        victimName: this.playerMatchData.name,
        victimTeam: this.playerMatchData.team,
        weaponName: weaponOrAbilityName,
        isHeadshot,
        isAbility,
        timestamp: Date.now()
      });

      if (this.activeMode === 'team_elimination' || this.activeMode === 'deathmatch') {
        this.omegaScore++;
        this.events.onScoreUpdate(this.alphaScore, this.omegaScore);
        if (this.activeMode === 'team_elimination' && (this.alphaScore >= 25 || this.omegaScore >= 25)) {
          this.endRound(this.alphaScore >= 25 ? 'alpha' : 'omega', 'ELIMINATION TARGET REACHED (25)');
          return;
        }
        this.events.onRoundStateChange('in_progress', 'RESPAWNING IN 2.5 SECONDS...');
        setTimeout(() => {
          if (!this.isRunning) return;
          const mySpawn = this.alphaSide === 'attackers' ? this.activeMap.attackerSpawn : this.activeMap.defenderSpawn;
          this.playerPosition.set(mySpawn.x, 1.6, mySpawn.z);
          this.camera.rotation.z = 0;
          this.lastKillerInfo = null;
          this.spawnProtectionTimer = 3.0;
          this.playerMatchData.health = 100;
          this.playerMatchData.armor = 50;
          this.playerMatchData.isAlive = true;
          this.currentAmmo = this.currentWeapon.magazineSize;
          this.reserveAmmo = this.currentWeapon.reserveAmmo;
          this.events.onPlayerStatsChange(this.playerMatchData);
        }, 2500);
      } else {
        this.checkRoundWinConditions();
      }
    }
  }

  private checkRoundWinConditions() {
    if (this.roundState !== 'in_progress') return;

    const attackerTeam: 'alpha' | 'omega' = this.alphaSide === 'attackers' ? 'alpha' : 'omega';
    const defenderTeam: 'alpha' | 'omega' = this.alphaSide === 'defenders' ? 'alpha' : 'omega';

    const attackersAlive = this.allPlayers.filter(p => p.team === attackerTeam && p.isAlive).length;
    const defendersAlive = this.allPlayers.filter(p => p.team === defenderTeam && p.isAlive).length;

    // Valorant Objective Rule:
    // 1. If Spike is NOT planted:
    //    - If all Attackers die: Defenders immediately win!
    //    - If all Defenders die: Attackers immediately win!
    // 2. If Spike IS planted:
    //    - If all Attackers die: The round does NOT end! Defenders MUST still defuse the Spike before it bursts!
    //    - If all Defenders die: If Spike is planted, Attackers win once the Spike explodes or instantly if no Defenders remain to defuse.
    if (!this.isSpikePlanted) {
      if (attackersAlive === 0) {
        this.endRound(defenderTeam, 'DEFENDERS WIN — ALL ATTACKERS ELIMINATED BEFORE PLANT');
      } else if (defendersAlive === 0) {
        this.endRound(attackerTeam, 'ATTACKERS WIN — ALL DEFENDERS ELIMINATED');
      }
    } else {
      // Spike is armed on site:
      if (defendersAlive === 0) {
        // No defenders left alive to defuse the planted spike
        this.endRound(attackerTeam, 'ATTACKERS WIN — ALL DEFENDERS ELIMINATED & SPIKE ARMED');
      }
      // Note: If attackersAlive === 0 while spike is planted, do NOT end the round!
      // Defenders must still race against the 45s timer to defuse the spike before detonation!
    }
  }

  private spawnDroppedSpikeAt(pos: THREE.Vector3) {
    if (this.droppedSpikeModel) {
      this.scene.remove(this.droppedSpikeModel.group);
      this.droppedSpikeModel = null;
    }
    const dropVec = new THREE.Vector3(pos.x, 0, pos.z);
    this.droppedSpikePosition = dropVec;
    this.spikeCarrierId = null;
    const model = createDroppedSpikePickupModel();
    model.group.position.copy(dropVec);
    this.scene.add(model.group);
    this.droppedSpikeModel = model;
    this.events.onPlayerStatsChange(this.playerMatchData);
  }

  /**
   * Drops the Spike on the ground (Only Attackers carrying the Spike can drop it)
   */
  public dropSpike(): boolean {
    if (
      this.isSpikePlanted ||
      this.playerMatchData.side !== 'attackers' ||
      !this.playerMatchData.hasSpike ||
      !this.playerMatchData.isAlive
    ) {
      return false;
    }

    this.playerMatchData.hasSpike = false;
    const forward = new THREE.Vector3(0, 0, -1.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerYaw);
    const dropPos = new THREE.Vector3(
      THREE.MathUtils.clamp(this.playerPosition.x + forward.x, -48, 48),
      0,
      THREE.MathUtils.clamp(this.playerPosition.z + forward.z, -48, 48)
    );
    this.spawnDroppedSpikeAt(dropPos);
    soundEngine.playUIClick();
    this.events.onRoundStateChange(this.roundState, 'SPIKE DROPPED — PRESS [F] / [V] TO PICK UP');
    this.sendTeamComm(
      `Dropped the Spike at ${this.getClosestCallout(dropPos.x, dropPos.z)}. Teammates can recover it.`,
      'objective',
      this.playerMatchData.name,
      this.getClosestCallout(dropPos.x, dropPos.z),
      false
    );
    return true;
  }

  /**
   * Picks up the dropped Spike or claims it from an allied Attacker bot (Only Attackers can pick up the Spike)
   */
  public pickupSpike(): boolean {
    if (
      this.isSpikePlanted ||
      this.playerMatchData.side !== 'attackers' ||
      !this.playerMatchData.isAlive ||
      this.playerMatchData.hasSpike
    ) {
      return false;
    }

    // 1. If Spike is dropped on the ground within 6.5m (or anywhere during Buy Phase)
    if (this.droppedSpikePosition) {
      const dist = Math.hypot(
        this.playerPosition.x - this.droppedSpikePosition.x,
        this.playerPosition.z - this.droppedSpikePosition.z
      );
      if (dist <= 6.5 || this.roundState === 'buy_phase') {
        if (this.droppedSpikeModel) {
          this.scene.remove(this.droppedSpikeModel.group);
          this.droppedSpikeModel = null;
        }
        this.droppedSpikePosition = null;
        this.playerMatchData.hasSpike = true;
        this.spikeCarrierId = 'player';
        soundEngine.playUIClick();
        this.events.onPlayerStatsChange(this.playerMatchData);
        this.events.onRoundStateChange(this.roundState, 'SPIKE RECOVERED — PLANT AT SITE A OR B');
        this.sendTeamComm(
          'Spike recovered! Moving to plant on site.',
          'objective',
          this.playerMatchData.name,
          this.getClosestCallout(this.playerPosition.x, this.playerPosition.z),
          false
        );
        return true;
      }
    }

    // 2. If an allied Attacker bot is carrying the Spike, transfer it to the Player!
    const carrierBot = this.bots.find(
      b => b.player.team === this.playerMatchData.team && b.player.hasSpike && b.player.isAlive
    );
    if (carrierBot) {
      const dist = Math.hypot(
        this.playerPosition.x - carrierBot.position.x,
        this.playerPosition.z - carrierBot.position.z
      );
      if (dist <= 12 || this.roundState === 'buy_phase') {
        carrierBot.player.hasSpike = false;
        this.playerMatchData.hasSpike = true;
        this.spikeCarrierId = 'player';
        soundEngine.playUIClick();
        this.events.onPlayerStatsChange(this.playerMatchData);
        this.events.onRoundStateChange(this.roundState, 'SPIKE CLAIMED FROM SQUADMATE');
        this.sendTeamComm(
          `Claimed Spike from ${carrierBot.player.name}. Ready to plant.`,
          'objective',
          this.playerMatchData.name,
          this.getClosestCallout(this.playerPosition.x, this.playerPosition.z),
          false
        );
        return true;
      }
    }

    return false;
  }

  public plantSpike() {
    if (this.isSpikePlanted || this.roundState !== 'in_progress') return;
    // Only Attackers can plant the Spike!
    if (this.playerMatchData.side !== 'attackers') return;
    if (!this.playerMatchData.hasSpike) {
      // Try claiming it if nearby
      if (!this.pickupSpike()) {
        this.events.onRoundStateChange('in_progress', 'YOU MUST PICK UP THE SPIKE [F] TO PLANT!');
        return;
      }
    }

    // Check distance to Site A or Site B
    const distA = Math.hypot(this.playerPosition.x - this.activeMap.siteA.x, this.playerPosition.z - this.activeMap.siteA.z);
    const distB = Math.hypot(this.playerPosition.x - this.activeMap.siteB.x, this.playerPosition.z - this.activeMap.siteB.z);

    if (distA <= this.activeMap.siteA.radius || distB <= this.activeMap.siteB.radius) {
      this.isSpikePlanted = true;
      this.playerMatchData.hasSpike = false;
      this.spikeCarrierId = null;
      this.spikePosition = this.playerPosition.clone();
      this.spikePosition.y = 0;
      this.spikeTimer = 45;

      this.spikeModel = createNexusCoreObjective();
      this.spikeModel.group.position.copy(this.spikePosition);
      this.scene.add(this.spikeModel.group);

      soundEngine.playPlantEvent('success');
      this.triggerVoiceLine('plant', undefined, true);
      this.events.onSpikeStateChange(true, 45, false);
      this.playerMatchData.credits += 300;
      this.playerMatchData.stats.plants++;
      this.playerMatchData.stats.score += 150;
      this.events.onPlayerStatsChange(this.playerMatchData);
      this.events.onRoundStateChange('in_progress', 'SPIKE PLANTED — DEFEND THE NEXUS CORE!');
      const plantedSiteLabel = distA <= this.activeMap.siteA.radius ? 'SITE A' : 'SITE B';
      this.sendTeamComm(
        `Spike planted at ${plantedSiteLabel}! Hold post-plant crossfires!`,
        'objective',
        this.playerMatchData.name,
        plantedSiteLabel,
        true
      );
    }
  }

  public defuseSpike() {
    if (!this.isSpikePlanted || !this.spikePosition) return;
    // Only Defenders can defuse the planted Spike!
    if (this.playerMatchData.side !== 'defenders') return;

    const dist = Math.hypot(
      this.playerPosition.x - this.spikePosition.x,
      this.playerPosition.z - this.spikePosition.z
    );
    if (dist < 4.0) {
      this.isSpikePlanted = false;
      if (this.spikeModel) {
        this.scene.remove(this.spikeModel.group);
        this.spikeModel = null;
      }
      soundEngine.playPlantEvent('defuse_success');
      this.triggerVoiceLine('defuse', undefined, true);
      this.events.onSpikeStateChange(false, 0, false);
      this.playerMatchData.stats.defuses++;
      this.playerMatchData.stats.score += 200;
      this.events.onPlayerStatsChange(this.playerMatchData);
      this.sendTeamComm(
        'Nexus Core defused! Area secured.',
        'objective',
        this.playerMatchData.name,
        this.getClosestCallout(this.playerPosition.x, this.playerPosition.z),
        false
      );
      const defenderTeam: 'alpha' | 'omega' = this.alphaSide === 'defenders' ? 'alpha' : 'omega';
      this.endRound(defenderTeam, 'DEFENDERS DEFUSED THE NEXUS CORE');
    }
  }

  private endRound(winner: 'alpha' | 'omega', message: string) {
    if (this.roundState === 'round_end' || this.roundState === 'match_end') return;
    this.roundState = 'round_end';
    if (winner === 'alpha') {
      this.alphaScore++;
      soundEngine.playAnnouncer('victory');
      try {
        confetti({
          particleCount: 80,
          spread: 75,
          origin: { y: 0.6 }
        });
      } catch {
        // Safe fallback if canvas-confetti context is unavailable
      }
    } else {
      this.omegaScore++;
      soundEngine.playAnnouncer('defeat');
    }

    this.events.onScoreUpdate(this.alphaScore, this.omegaScore);

    const isRespawnMode = this.activeMode === 'team_elimination' || this.activeMode === 'deathmatch';
    if (isRespawnMode) {
      this.targetWins = 25;
    } else {
      // Valorant-style 6 Attacker + 6 Defender rounds (First to 7 wins; if tied at 6-6, 7-7, etc., add Overtime matches!)
      if (this.alphaScore === this.omegaScore && this.alphaScore >= 6) {
        this.isOvertime = true;
        this.targetWins = this.alphaScore + 2;
        message = `OVERTIME TIEBREAKER (${this.alphaScore}-${this.omegaScore}) — FIRST TO ${this.targetWins} WINS!`;
      }
    }

    if (this.alphaScore >= this.targetWins || this.omegaScore >= this.targetWins) {
      this.roundState = 'match_end';
      this.events.onRoundStateChange(
        'match_end',
        `${winner === 'alpha' ? 'ALPHA SQUAD' : 'OMEGA VANGUARD'} WINS THE MATCH (${this.alphaScore}-${this.omegaScore})!`
      );
      setTimeout(() => {
        if (!this.isRunning) return;
        this.events.onMatchEnd?.(winner, this.allPlayers, this.alphaScore, this.omegaScore);
      }, 2500);
      return;
    }

    this.events.onRoundStateChange('round_end', message);

    setTimeout(() => {
      if (!this.isRunning) return;
      this.startNewRound();
    }, 4500);
  }

  public startNewRound() {
    this.roundNumber++;
    this.roundState = 'buy_phase';
    this.buyPhaseTime = 60; // 1-Minute Buy Phase as requested
    this.roundTimeRemaining = 100;
    this.isSpikePlanted = false;
    this.spawnProtectionTimer = 4.5;
    this.invulnerableTimer = 0;
    this.lastKillerInfo = null;
    this.camera.rotation.z = 0;

    // Valorant-Style 6+6 Match Halftime Swap & Overtime Side Alternation:
    // Rounds 1-6: Alpha = Attackers, Omega = Defenders
    // Rounds 7-12: Alpha = Defenders, Omega = Attackers
    // Rounds 13+ (Overtime Tiebreakers): Alternate Attackers/Defenders every round
    let isHalftimeSwap = false;
    if (this.roundNumber <= 6) {
      this.alphaSide = 'attackers';
    } else if (this.roundNumber <= 12) {
      if (this.roundNumber === 7) isHalftimeSwap = true;
      this.alphaSide = 'defenders';
    } else {
      this.isOvertime = true;
      this.alphaSide = this.roundNumber % 2 === 1 ? 'attackers' : 'defenders';
    }

    const omegaSide: TeamSide = this.alphaSide === 'attackers' ? 'defenders' : 'attackers';
    this.playerMatchData.side = this.alphaSide;

    if (this.spikeModel) {
      this.scene.remove(this.spikeModel.group);
      this.spikeModel = null;
    }
    if (this.droppedSpikeModel) {
      this.scene.remove(this.droppedSpikeModel.group);
      this.droppedSpikeModel = null;
    }
    this.droppedSpikePosition = null;

    this.abilityManager.clearAll(this.builtMap.colliders);

    // Ensure default Sidearm + Melee Knife are always in inventory, and randomly choose primary weapon for 1-min Buy Phase
    const defaultSidearm = WEAPONS.find(w => w.id === DEFAULT_SIDEARM_ID) || WEAPONS[0];
    const defaultMelee = WEAPONS.find(w => w.id === DEFAULT_MELEE_ID) || WEAPONS[0];
    this.sidearmWeapon = defaultSidearm;
    this.meleeWeapon = defaultMelee;
    this.playerMatchData.sidearmWeaponId = defaultSidearm.id;
    this.playerMatchData.meleeWeaponId = defaultMelee.id;

    const randomPrimary = pickRandomBuyPhaseWeapon(this.primaryWeapon?.id);
    this.primaryWeapon = randomPrimary;
    this.playerMatchData.inventory = [randomPrimary.id, defaultSidearm.id, defaultMelee.id];
    this.setupFirstPersonWeapon(randomPrimary);

    // Determine spawn points based on current Attacker / Defender side
    const alphaSpawn = this.alphaSide === 'attackers' ? this.activeMap.attackerSpawn : this.activeMap.defenderSpawn;
    const omegaSpawn = omegaSide === 'attackers' ? this.activeMap.attackerSpawn : this.activeMap.defenderSpawn;

    this.playerPosition.set(alphaSpawn.x, 1.6, alphaSpawn.z);
    this.playerYaw = alphaSpawn.yaw;
    this.playerPitch = 0;
    this.playerVelocity.set(0, 0, 0);
    this.playerMatchData.health = 100;
    this.playerMatchData.armor = 50;
    this.playerMatchData.isAlive = true;
    this.playerMatchData.credits = Math.min(9000, this.playerMatchData.credits + 1800);
    this.playerMatchData.abilityCharges = {
      ability_1: this.playerAgent.ability1.charges || 2,
      ability_2: this.playerAgent.ability2.charges || 2,
      ability_3: this.playerAgent.ability3.charges || 1
    };

    // Assign Spike to Attackers
    this.playerMatchData.hasSpike = this.alphaSide === 'attackers';
    this.spikeCarrierId = this.alphaSide === 'attackers' ? 'player' : null;

    // Reset bots & FSM state
    AlphaIntel.utilityQueue = [];
    OmegaIntel.utilityQueue = [];
    AlphaIntel.enemyLastKnownPos.clear();
    OmegaIntel.enemyLastKnownPos.clear();
    AlphaIntel.chosenAttackSite = 'A';
    OmegaIntel.chosenAttackSite = 'A';
    AlphaIntel.activeSpikeSite = null;
    OmegaIntel.activeSpikeSite = null;
    AlphaIntel.tacticalState = 'EARLY_SETUP';
    OmegaIntel.tacticalState = 'EARLY_SETUP';
    AlphaIntel.lastRotationTime = 0;
    OmegaIntel.lastRotationTime = 0;
    AlphaIntel.executeTimestamp = 0;
    OmegaIntel.executeTimestamp = 0;
    AlphaIntel.designatedDefuserId = null;
    OmegaIntel.designatedDefuserId = null;

    let assignedOmegaSpike = false;
    this.bots.forEach((b, i) => {
      b.player.health = 100;
      b.player.armor = 50;
      b.player.isAlive = true;
      const isAlpha = b.player.team === 'alpha';
      b.player.side = isAlpha ? this.alphaSide : omegaSide;

      // Randomly choose a weapon for each bot during the 1-minute Buy Phase
      const botRandomWpn = pickRandomBuyPhaseWeapon();
      b.player.currentWeaponId = botRandomWpn.id;
      b.player.sidearmWeaponId = DEFAULT_SIDEARM_ID;
      b.player.meleeWeaponId = DEFAULT_MELEE_ID;
      b.player.inventory = [botRandomWpn.id, DEFAULT_SIDEARM_ID, DEFAULT_MELEE_ID];

      // If Omega is Attackers (Rounds 7-12 or Overtime), give the Spike to the first Omega bot
      if (!isAlpha && omegaSide === 'attackers' && !assignedOmegaSpike) {
        b.player.hasSpike = true;
        this.spikeCarrierId = b.player.id;
        assignedOmegaSpike = true;
      } else {
        b.player.hasSpike = false;
      }

      const spawnBase = isAlpha ? alphaSpawn : omegaSpawn;
      const zOffset = b.player.side === 'attackers' ? 4 : -4;
      b.position.set(spawnBase.x + ((i % 4) - 2) * 4, 0, spawnBase.z + zOffset);
      b.yaw = b.player.side === 'attackers' ? Math.PI : 0;
      b.targetYaw = b.yaw;
      b.fsmState = 'PATROL_ADVANCE';
      b.fsmStateTimer = 0;
      b.targetEnemy = null;
      b.hasLineOfSight = false;
      b.lastSeenTargetPos = null;
      b.reactionTimer = 0;
      b.shootCooldown = 1.2 + Math.random() * 0.8;
      b.abilityCooldown = 5.5 + Math.random() * 4.5;
      b.anchorSpot = null;
      b.retreatCoverPos = null;
      b.pathWaypoints = [];
      b.currentWaypointIdx = 0;
      b.model.group.rotation.x = 0;
      b.model.group.position.set(b.position.x, 0, b.position.z);
      b.model.group.visible = true;
    });

    if (this.activeMode === 'practice_range') {
      this.playerMatchData.credits = 9999;
      this.playerMatchData.ultPoints = 7;
      this.roundState = 'in_progress';
      this.events.onRoundStateChange('in_progress', 'PRACTICE RANGE — INFINITE CREDITS & ABILITIES');
    } else if (this.activeMode === 'deathmatch' || this.activeMode === 'team_elimination') {
      this.roundState = 'in_progress';
      this.events.onRoundStateChange(
        'in_progress',
        this.activeMode === 'deathmatch' ? 'DEATHMATCH — FREE FOR ALL' : 'TEAM ELIMINATION — FIRST TO 25'
      );
    } else {
      const sideLabel = this.alphaSide === 'attackers' ? 'ATTACKERS' : 'DEFENDERS';
      const bannerMsg = isHalftimeSwap
        ? `HALFTIME SIDE SWAP (ROUND ${this.roundNumber}) — YOU ARE NOW ${sideLabel}!`
        : this.isOvertime
        ? `OVERTIME ROUND ${this.roundNumber} (${sideLabel}) — RANDOMIZED: ${randomPrimary.name.toUpperCase()}`
        : `ROUND ${this.roundNumber} (${sideLabel}) — 60s BUY PHASE | RANDOMIZED: ${randomPrimary.name.toUpperCase()}`;
      this.events.onRoundStateChange('buy_phase', bannerMsg);
    }

    this.events.onPlayerStatsChange(this.playerMatchData);
    soundEngine.playAnnouncer('round_start');
    const sideRoleText = this.alphaSide === 'attackers' ? 'ATTACKERS (Plant Spike at Site A/B)' : 'DEFENDERS (Hold Sites & Defuse)';
    this.sendTeamComm(
      `Round ${this.roundNumber} initialized — Alpha Squad assigned to ${sideRoleText}. Randomized primary: ${randomPrimary.name}.`,
      'status',
      'TAC-COM',
      this.alphaSide === 'attackers' ? 'ATK SPAWN' : 'DEF SPAWN',
      false
    );
    setTimeout(() => {
      if (this.isRunning) {
        this.triggerVoiceLine('round_start');
      }
    }, 650);
  }

  public start() {
    this.isRunning = true;
    this.clock.start();
    this.startNewRound();
    this.tick();
  }

  public stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('keydown', this.onKeyDownHandler);
    window.removeEventListener('keyup', this.onKeyUpHandler);
    window.removeEventListener('blur', this.onBlurHandler);
    window.removeEventListener('mousemove', this.onMouseMoveHandler);
    window.removeEventListener('mousedown', this.onMouseDownHandler);
    window.removeEventListener('mouseup', this.onMouseUpHandler);
    window.removeEventListener('wheel', this.onWheelHandler);
    window.removeEventListener('click', this.onViewportClickHandler);
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeHandler);
    window.removeEventListener('contextmenu', this.onContextMenuHandler);
    this.composer?.dispose();
    this.renderer.dispose();
  }

  private onWindowResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
  };

  private afterDraw = (cb: () => void) => {
    try {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        this.frameId = window.setTimeout(cb, 16);
        return;
      }
      const poll = () => {
        if (!this.isRunning) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 4);
        } else {
          gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 16);
        }
      };
      this.frameId = window.setTimeout(poll, 4);
    } catch {
      this.frameId = window.setTimeout(cb, 16);
    }
  };

  private tick = () => {
    if (!this.isRunning) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05); // Frame delta clamp

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    }
    if (this.roundState === 'in_progress' && this.spawnProtectionTimer > 0) {
      this.spawnProtectionTimer = Math.max(0, this.spawnProtectionTimer - dt);
    }

    this.updateGameLogic(dt);
    this.updatePlayerMovement(dt);
    this.updateWeaponAnimation(dt);
    this.updateBots(dt);
    this.particleSystem.update(dt);
    this.abilityManager.update(
      dt,
      this.builtMap.colliders,
      this.allPlayers,
      this.bots,
      this.playerPosition,
      (bot, dmg, abilityName, attacker) => {
        this.applyDamageToBot(
          bot,
          dmg,
          false,
          bot.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
          attacker || this.playerMatchData,
          abilityName,
          true
        );
      },
      (dmg, abilityName, attacker) => {
        this.applyDamageToPlayer(dmg, false, attacker, abilityName, true);
      },
      (upVel) => {
        this.playerVelocity.y = upVel;
        this.isGrounded = false;
      },
      () => {
        this.events.onPlayerStatsChange(this.playerMatchData);
      }
    );

    const flashVal = this.abilityManager.flashIntensity;
    if (Math.abs(flashVal - this.lastEmittedFlash) > 0.02 || (flashVal === 0 && this.lastEmittedFlash !== 0)) {
      this.lastEmittedFlash = flashVal;
      this.events.onFlashUpdate?.(flashVal);
    }

    if (this.isSoftwareGl || !this.composer) {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private updateGameLogic(dt: number) {
    if (this.droppedSpikeModel) {
      this.droppedSpikeModel.beaconRing.rotation.z += dt * 2.2;
    }

    if (this.roundState === 'buy_phase') {
      this.buyPhaseTime -= dt;
      if (this.buyPhaseTime <= 0) {
        this.roundState = 'in_progress';
        this.spawnProtectionTimer = 2.5;
        this.events.onRoundStateChange('in_progress', 'ROUND STARTED');
      }
    } else if (this.roundState === 'in_progress') {
      const attackerTeam: 'alpha' | 'omega' = this.alphaSide === 'attackers' ? 'alpha' : 'omega';
      const defenderTeam: 'alpha' | 'omega' = this.alphaSide === 'defenders' ? 'alpha' : 'omega';

      if (this.isSpikePlanted) {
        this.spikeTimer -= dt;
        this.spikeBeepTimer -= dt;
        if (this.spikeBeepTimer <= 0) {
          soundEngine.playSpikeBeep(1 + (45 - this.spikeTimer) / 15);
          this.events.onSpikeStateChange(true, Math.max(0, this.spikeTimer), this.isPlayerDefusing);
          this.spikeBeepTimer = this.spikeTimer > 20 ? 1.0 : this.spikeTimer > 10 ? 0.5 : 0.22;
        }

        if (this.spikeModel) {
          this.spikeModel.rings.rotation.y += dt * 3;
          this.spikeModel.rings.rotation.x += dt * 2;
        }

        if (this.spikeTimer <= 0) {
          soundEngine.playDetonation();
          this.endRound(attackerTeam, 'NEXUS CORE DETONATED — ATTACKERS WIN');
        }
      } else {
        this.roundTimeRemaining -= dt;
        if (this.roundTimeRemaining <= 0) {
          this.endRound(defenderTeam, 'TIME EXPIRED — DEFENDERS WIN');
        }
      }
    }
  }

  // Weapon Sway & Inertia State
  private weaponSway = new THREE.Vector2();
  private weaponJumpDip: number = 0;
  private prevYaw: number = 0;
  private prevPitch: number = 0;
  private coyoteTimer: number = 0;
  private jumpBufferTimer: number = 0;

  private updatePlayerMovement(dt: number) {
    if (!this.playerMatchData.isAlive) {
      // 3D First-Person Death Animation: camera collapses to floor, tilts sideways, and weapon drops out of view
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 0.34, 6, dt);
      this.camera.rotation.z = THREE.MathUtils.damp(this.camera.rotation.z, 0.52, 5, dt);
      this.camera.rotation.x = THREE.MathUtils.damp(this.camera.rotation.x, 0.24, 5, dt);
      this.fpWeaponGroup.position.y = THREE.MathUtils.damp(this.fpWeaponGroup.position.y, -0.55, 8, dt);
      this.fpWeaponGroup.rotation.z = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.z, 0.85, 8, dt);
      return;
    }
    this.camera.rotation.z = THREE.MathUtils.damp(this.camera.rotation.z, 0, 10, dt);

    // Step decoupled Continuous Collision Detection (CCD) Ability Dash / Impulse Channel
    this.abilityManager.physicsEngine.updatePlayerImpulseCCD(
      dt,
      this.playerPosition,
      this.builtMap.colliders
    );

    // Movement Input Vector (combine mobile joystick + desktop keys simultaneously)
    let moveX = this.inputMove.x;
    let moveZ = this.inputMove.y;

    if (this.heldKeys.has('KeyW') || this.heldKeys.has('w') || this.heldKeys.has('ArrowUp')) moveZ += 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('s') || this.heldKeys.has('ArrowDown')) moveZ -= 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('a') || this.heldKeys.has('ArrowLeft')) moveX -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('d') || this.heldKeys.has('ArrowRight')) moveX += 1;

    const joystickMagnitude = Math.hypot(this.inputMove.x, this.inputMove.y);
    const wantsSprint =
      (
        this.heldKeys.has('ShiftLeft') ||
        this.heldKeys.has('ShiftRight') ||
        this.heldKeys.has('shift') ||
        this.isSprinting ||
        (joystickMagnitude > 0.85 && this.inputMove.y > 0.35 && !this.isAds && !this.isCrouched)
      ) && moveZ > 0.1;

    const wantsCrouch =
      this.heldKeys.has('ControlLeft') ||
      this.heldKeys.has('ControlRight') ||
      this.heldKeys.has('control') ||
      this.isCrouched;

    // Tactical combat slide activation
    if (wantsSprint && wantsCrouch && !this.isSliding && this.isGrounded) {
      this.isSliding = true;
      this.slideTimer = 1.1;
      soundEngine.playFootstep(true);
    }

    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= dt;
      if (this.speedBoostTimer <= 0) {
        this.speedBoostMultiplier = 1.0;
      }
    }

    let targetSpeed = 5.6;
    if (this.isSliding) {
      this.slideTimer -= dt;
      targetSpeed = 10.8 * Math.max(0.28, this.slideTimer);
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      }
    } else {
      if (wantsSprint) targetSpeed = 7.6;
      else if (wantsCrouch) targetSpeed = 2.8;
      else if (this.isAds) targetSpeed = 3.2;
      else targetSpeed = 5.6;
    }
    // Weapon Special Ability: Swift Stride (+18% movement speed while equipped)
    if (this.currentWeapon.specialAbility?.effect === 'swift_stride') {
      targetSpeed *= this.currentWeapon.specialAbility.procValue || 1.18;
    }
    targetSpeed *= this.speedBoostMultiplier;

    // Auto-pickup dropped Spike when Attacker walks within 1.7m of it
    if (
      this.playerMatchData.side === 'attackers' &&
      !this.playerMatchData.hasSpike &&
      !this.isSpikePlanted &&
      this.droppedSpikePosition
    ) {
      const dSpike = Math.hypot(
        this.playerPosition.x - this.droppedSpikePosition.x,
        this.playerPosition.z - this.droppedSpikePosition.z
      );
      if (dSpike < 1.7) {
        this.pickupSpike();
      }
    }

    const inputDir = new THREE.Vector3(moveX, 0, -moveZ);
    if (inputDir.lengthSq() > 1) inputDir.normalize();

    // Rotate input vector by camera yaw
    inputDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.playerYaw);

    // Crisp PC Tactical FPS ground acceleration & instant counter-strafe stopping friction
    const isStopping = inputDir.lengthSq() < 0.01;
    const accel = this.isGrounded ? (isStopping ? 26.0 : 20.0) : 4.5;
    const targetVelX = inputDir.x * targetSpeed;
    const targetVelZ = inputDir.z * targetSpeed;

    this.playerVelocity.x = THREE.MathUtils.damp(this.playerVelocity.x, targetVelX, accel, dt);
    this.playerVelocity.z = THREE.MathUtils.damp(this.playerVelocity.z, targetVelZ, accel, dt);

    // Coyote time & Jump Buffering
    if (this.isGrounded) {
      this.coyoteTimer = 0.1;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.inputJumpJustPressed) {
      this.jumpBufferTimer = 0.15;
      this.inputJumpJustPressed = false;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    // Jump execution
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.playerVelocity.y = 6.4;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.weaponJumpDip = 0.08;
      soundEngine.playJump();
    }

    // Gravity
    if (!this.isGrounded) {
      this.playerVelocity.y -= 19.6 * dt;
    }

    // Continuous Collision Resolution with Wall Sliding & Platform Step-Up (Separate X and Z axes)
    const radius = 0.45;
    const playerHeight = wantsCrouch ? 1.1 : 1.7;
    const footY = this.playerPosition.y - 1.6;
    const stepUpAllowance = 0.58; // Allows stepping up stairs/ramps/low crates

    // Test X movement
    let nextX = this.playerPosition.x + this.playerVelocity.x * dt;
    let boxX = new THREE.Box3(
      new THREE.Vector3(nextX - radius, footY + stepUpAllowance, this.playerPosition.z - radius),
      new THREE.Vector3(nextX + radius, footY + playerHeight, this.playerPosition.z + radius)
    );

    let hitX = false;
    for (const c of this.builtMap.colliders) {
      if (c.box.intersectsBox(boxX)) {
        hitX = true;
        break;
      }
    }
    if (!hitX) {
      this.playerPosition.x = nextX;
    } else {
      this.playerVelocity.x = 0; // Slide along wall
    }

    // Test Z movement
    let nextZ = this.playerPosition.z + this.playerVelocity.z * dt;
    let boxZ = new THREE.Box3(
      new THREE.Vector3(this.playerPosition.x - radius, footY + stepUpAllowance, nextZ - radius),
      new THREE.Vector3(this.playerPosition.x + radius, footY + playerHeight, nextZ + radius)
    );

    let hitZ = false;
    for (const c of this.builtMap.colliders) {
      if (c.box.intersectsBox(boxZ)) {
        hitZ = true;
        break;
      }
    }
    if (!hitZ) {
      this.playerPosition.z = nextZ;
    } else {
      this.playerVelocity.z = 0; // Slide along wall
    }

    // Find highest walkable surface (floor, crate, ramp, bridge) beneath player footprint
    let supportSurfaceY = 0;
    for (const c of this.builtMap.colliders) {
      if (
        this.playerPosition.x + radius * 0.85 >= c.box.min.x &&
        this.playerPosition.x - radius * 0.85 <= c.box.max.x &&
        this.playerPosition.z + radius * 0.85 >= c.box.min.z &&
        this.playerPosition.z - radius * 0.85 <= c.box.max.z
      ) {
        const topY = c.box.max.y;
        // Can stand on surface if feet are above it or within stepUpAllowance
        if (topY <= footY + stepUpAllowance && topY > supportSurfaceY) {
          supportSurfaceY = topY;
        }
      }
    }

    // Vertical Movement & Platform/Ground Landing
    const targetEyeBaseY = supportSurfaceY + 1.6;
    this.playerPosition.y += this.playerVelocity.y * dt;

    if (this.playerPosition.y <= targetEyeBaseY) {
      if (!this.isGrounded && this.playerVelocity.y < -3.0) {
        soundEngine.playFootstep(false);
        this.weaponJumpDip = -0.06;
      }
      this.playerPosition.y = THREE.MathUtils.damp(this.playerPosition.y, targetEyeBaseY, 22, dt);
      if (Math.abs(this.playerPosition.y - targetEyeBaseY) < 0.05) {
        this.playerPosition.y = targetEyeBaseY;
      }
      this.playerVelocity.y = 0;
      this.isGrounded = true;
    } else if (this.playerPosition.y > targetEyeBaseY + 0.12) {
      this.isGrounded = false;
    }

    // View Bobbing & Lissajous Footsteps
    const horizontalSpeed = Math.hypot(this.playerVelocity.x, this.playerVelocity.z);
    const isMoving = horizontalSpeed > 0.5;
    let bobY = 0;
    let bobX = 0;

    if (isMoving && this.isGrounded) {
      const bobFreq = wantsSprint ? 12 : 8;
      const t = this.clock.getElapsedTime() * bobFreq;
      bobY = Math.sin(t) * 0.035;
      bobX = Math.cos(t * 0.5) * 0.02;

      this.footstepTimer += dt;
      if (this.footstepTimer >= (wantsSprint ? 0.32 : 0.48)) {
        soundEngine.playFootstep(wantsSprint);
        this.footstepTimer = 0;
      }
    }

    // Camera Height Lerp (Smooth Crouch Transition)
    const targetHeight = wantsCrouch ? 1.05 : 1.6;
    this.camera.position.x = this.playerPosition.x + bobX;
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.playerPosition.y + (targetHeight - 1.6) + bobY, 14, dt);
    this.camera.position.z = this.playerPosition.z;

    // Recoil Recovery & Camera Rotation
    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 10, dt);
    this.recoilYaw = THREE.MathUtils.damp(this.recoilYaw, 0, 10, dt);
    this.crosshairBloom = THREE.MathUtils.damp(this.crosshairBloom, 0, 8, dt);
    if (
      Math.abs(this.crosshairBloom - this.lastEmittedBloom) > 0.15 ||
      (this.crosshairBloom < 0.05 && this.lastEmittedBloom !== 0)
    ) {
      this.lastEmittedBloom = this.crosshairBloom < 0.05 ? 0 : this.crosshairBloom;
      this.events.onCrosshairBloom(this.lastEmittedBloom);
    }

    this.camera.rotation.y = this.playerYaw + this.recoilYaw;
    this.camera.rotation.x = this.playerPitch + this.recoilPitch;

    // Weapon Sway (Inertial lag based on look velocity)
    const deltaYaw = this.playerYaw - this.prevYaw;
    const deltaPitch = this.playerPitch - this.prevPitch;
    this.prevYaw = this.playerYaw;
    this.prevPitch = this.playerPitch;

    const swayFactor = this.isAds ? 0.08 : 0.25;
    this.weaponSway.x = THREE.MathUtils.damp(this.weaponSway.x, -deltaYaw * swayFactor, 12, dt);
    this.weaponSway.y = THREE.MathUtils.damp(this.weaponSway.y, deltaPitch * swayFactor, 12, dt);
    this.weaponJumpDip = THREE.MathUtils.damp(this.weaponJumpDip, 0, 8, dt);

    // FOV Lerp for ADS
    const targetFov = this.isAds ? this.graphicsSettings.fov / this.currentWeapon.zoomRatio : this.graphicsSettings.fov;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, dt);
    this.camera.updateProjectionMatrix();

    // Store global pos for bot LOS checks
    (window as unknown as { __playerPos?: THREE.Vector3 }).__playerPos = this.playerPosition;
  }

  private updateWeaponAnimation(dt: number) {
    // Weapon ADS position lerp
    const targetPos = this.isAds ? this.fpWeaponAdsPos : this.fpWeaponDefaultPos;
    this.fpWeaponCurrentPos.lerp(targetPos, THREE.MathUtils.clamp(dt * 14, 0, 1));
    
    // Apply Sway & Jump Dip
    this.fpWeaponGroup.position.x = this.fpWeaponCurrentPos.x + this.weaponSway.x;
    this.fpWeaponGroup.position.y = this.fpWeaponCurrentPos.y + this.weaponSway.y + this.weaponJumpDip;
    this.fpWeaponGroup.position.z = THREE.MathUtils.damp(this.fpWeaponGroup.position.z, targetPos.z, 16, dt);

    // Inspect Weapon Animation (Melee twirl/flourish & Primary/Sidearm multi-angle showcase)
    if (this.isInspecting) {
      this.inspectTimer += dt;
      const progress = Math.min(1.0, this.inspectTimer / this.inspectDuration);
      const isMelee = this.currentWeapon.category === 'Melee';

      if (isMelee) {
        // Melee Blade inspection kinematics:
        // Stage 1 (0 to 0.3): raise and turn edge towards camera
        // Stage 2 (0.3 to 0.72): 360-degree twirl/flourish flip
        // Stage 3 (0.72 to 1.0): smooth return to combat ready stance
        if (progress < 0.3) {
          const t = progress / 0.3;
          this.fpWeaponGroup.position.x = this.fpWeaponCurrentPos.x - 0.06 * Math.sin(t * Math.PI * 0.5);
          this.fpWeaponGroup.position.y = this.fpWeaponCurrentPos.y + Math.sin(t * Math.PI) * 0.08;
          this.fpWeaponGroup.rotation.x = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.x, 0.45, 14, dt);
          this.fpWeaponGroup.rotation.z = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.z, -0.65, 14, dt);
          this.fpWeaponGroup.rotation.y = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.y, 0.38, 14, dt);
        } else if (progress < 0.72) {
          const t = (progress - 0.3) / 0.42;
          // Full 360-degree blade spin on Z-axis with flourish arc
          this.fpWeaponGroup.rotation.z = -0.65 + t * (Math.PI * 2);
          this.fpWeaponGroup.rotation.y = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.y, Math.sin(t * Math.PI) * 0.55, 14, dt);
          this.fpWeaponGroup.position.y = this.fpWeaponCurrentPos.y + Math.sin(t * Math.PI) * 0.06;
        } else {
          this.fpWeaponGroup.rotation.x = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.x, this.weaponSway.y * 1.5, 12, dt);
          this.fpWeaponGroup.rotation.y = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.y, this.weaponSway.x * 1.8, 12, dt);
          this.fpWeaponGroup.rotation.z = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.z, 0, 12, dt);
        }
      } else {
        // Primary / Sidearm Firearm inspection kinematics:
        // Stage 1 (0 to 0.35): lift toward center-screen and tilt left receiver to inspect skin, optics & chamber
        // Stage 2 (0.35 to 0.74): roll weapon over to inspect right-side ejection port, barrel & magazine check
        // Stage 3 (0.74 to 1.0): bolt snap forward and settle smoothly into combat stance
        if (progress < 0.35) {
          const t = progress / 0.35;
          const easeIn = Math.sin((t * Math.PI) / 2);
          this.fpWeaponGroup.position.x = this.fpWeaponCurrentPos.x - 0.085 * easeIn;
          this.fpWeaponGroup.position.y = this.fpWeaponCurrentPos.y + 0.055 * easeIn;
          this.fpWeaponGroup.position.z = this.fpWeaponCurrentPos.z - 0.04 * easeIn;
          this.fpWeaponGroup.rotation.z = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.z, 0.65 * easeIn, 12, dt);
          this.fpWeaponGroup.rotation.y = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.y, -0.48 * easeIn, 12, dt);
          this.fpWeaponGroup.rotation.x = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.x, 0.18 * easeIn, 12, dt);
        } else if (progress < 0.74) {
          const t = (progress - 0.35) / 0.39;
          const magCheckPulse = Math.sin(t * Math.PI);
          this.fpWeaponGroup.position.x = THREE.MathUtils.damp(this.fpWeaponGroup.position.x, this.fpWeaponCurrentPos.x - 0.03, 10, dt);
          this.fpWeaponGroup.position.y = THREE.MathUtils.damp(this.fpWeaponGroup.position.y, this.fpWeaponCurrentPos.y + 0.04, 10, dt);
          this.fpWeaponGroup.rotation.z = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.z, -0.58, 12, dt);
          this.fpWeaponGroup.rotation.y = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.y, 0.52, 12, dt);
          this.fpWeaponGroup.rotation.x = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.x, 0.22, 12, dt);
          if (this.fpMagMesh) {
            this.fpMagMesh.position.y = -0.11 - magCheckPulse * 0.035;
          }
        } else {
          if (this.fpMagMesh) {
            this.fpMagMesh.position.y = -0.11;
          }
          this.fpWeaponGroup.rotation.x = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.x, this.weaponSway.y * 1.5, 12, dt);
          this.fpWeaponGroup.rotation.y = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.y, this.weaponSway.x * 1.8, 12, dt);
          this.fpWeaponGroup.rotation.z = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.z, 0, 12, dt);
        }
      }

      if (progress >= 1.0) {
        if (this.fpMagMesh) {
          this.fpMagMesh.position.y = -0.11;
        }
        this.cancelInspect();
      }
    } else if (this.isReloading) {
      const prevProg = this.reloadProgress;
      this.reloadProgress += dt / this.currentWeapon.reloadTime;

      if (prevProg < 0.55 && this.reloadProgress >= 0.55) {
        soundEngine.playReload('magIn');
      }

      // Tilt weapon slightly for tactical reload inspection
      const reloadTilt = Math.sin(Math.min(1, this.reloadProgress) * Math.PI);
      this.fpWeaponGroup.rotation.z = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.z, reloadTilt * 0.42, 14, dt);
      this.fpWeaponGroup.rotation.x = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.x, reloadTilt * 0.22, 14, dt);

      // Animate magazine dropping out and snapping back in
      if (this.fpMagMesh) {
        const magDrop =
          this.reloadProgress < 0.45
            ? (this.reloadProgress / 0.45) * -0.26
            : this.reloadProgress < 0.78
            ? (1 - (this.reloadProgress - 0.45) / 0.33) * -0.26
            : 0;
        this.fpMagMesh.position.y = -0.11 + magDrop;
      }

      if (this.reloadProgress >= 1.0) {
        this.isReloading = false;
        if (this.fpMagMesh) {
          this.fpMagMesh.position.y = -0.11;
        }
        const needed = this.currentWeapon.magazineSize - this.currentAmmo;
        const available = Math.min(needed, this.reserveAmmo);
        this.currentAmmo += available;
        this.reserveAmmo -= available;
        soundEngine.playReload('bolt');
        this.events.onPlayerStatsChange(this.playerMatchData);
      }
    } else {
      this.fpWeaponGroup.rotation.x = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.x, this.weaponSway.y * 1.5, 16, dt);
      this.fpWeaponGroup.rotation.y = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.y, this.weaponSway.x * 1.8, 16, dt);
      this.fpWeaponGroup.rotation.z = THREE.MathUtils.damp(this.fpWeaponGroup.rotation.z, 0, 14, dt);
    }

    // Auto-fire handling
    this.fireTimer -= dt;
    if (this.isFiring && this.fireTimer <= 0) {
      if (this.currentWeapon.fireMode === 'auto' || this.currentAmmo === this.currentWeapon.magazineSize) {
        this.shootWeapon();
      }
    }
  }

  private updateBots(dt: number) {
    // Freeze bot movement, shooting, and ability casting during Buy Phase & Round End!
    if (this.roundState !== 'in_progress') {
      for (const b of this.bots) {
        if (b.player.isAlive) {
          b.model.group.position.set(b.position.x, b.position.y, b.position.z);
          b.model.group.rotation.y = b.yaw;
        }
      }
      return;
    }

    for (const b of this.bots) {
      updateBotAI(
        b,
        this.allPlayers,
        this.bots,
        this.playerPosition,
        this.activeMap,
        this.builtMap.colliders,
        this.isSpikePlanted,
        this.spikePosition,
        dt,
        (shooterBot, targetEnemy, hitPos, isHeadshot) => {
          const startPt = shooterBot.position.clone().add(new THREE.Vector3(0, 1.45, 0));

          // Check if sightline is blocked by any active Smoke / Toxic Cloud sphere
          if (this.abilityManager.isSightlineBlockedBySmoke(startPt, hitPos)) {
            return;
          }

          // Check if bullet path hits a solid map wall before reaching target
          const wallCheck = this.abilityManager.physicsEngine.sweepSphereCCD(
            startPt,
            hitPos,
            0.03,
            this.builtMap.colliders
          );
          const finalBulletEnd = wallCheck.hit ? wallCheck.point : hitPos;

          // 1. Spatialized Distance-Attenuated Audio (prevents distant bot shots from hurting headphones)
          const botDistToPlayer = shooterBot.position.distanceTo(this.playerPosition);
          if (botDistToPlayer < 62) {
            const botShotVol = Math.max(0.06, Math.min(0.32, 0.32 * (1 - botDistToPlayer / 62)));
            const relativeX = shooterBot.position.x - this.playerPosition.x;
            const relativeZ = shooterBot.position.z - this.playerPosition.z;
            const relativeLength = Math.max(0.001, Math.hypot(relativeX, relativeZ));
            const pan = (relativeX * Math.cos(this.playerYaw) - relativeZ * Math.sin(this.playerYaw)) / relativeLength;
            const botWeapon = WEAPONS.find(w => w.id === shooterBot.player.currentWeaponId) || WEAPONS[0];
            const isSuppressed = ['suppressed_pistol', 'phantom_carbine', 'suppressed_smg'].includes(
              botWeapon.archetype || ''
            );
            soundEngine.playGunshot(botWeapon.category, isSuppressed, botShotVol, pan);
          }
          reportGunshot(shooterBot.player.team, shooterBot.player.id, shooterBot.position);

          // 2. Visual 3D Bullet Tracer
          const tracerMat = new THREE.LineBasicMaterial({
            color: shooterBot.player.team === 'alpha' ? 0x00f0ff : 0xef4444,
            transparent: true,
            opacity: 0.85
          });
          const geom = new THREE.BufferGeometry().setFromPoints([startPt, finalBulletEnd]);
          const tracer = new THREE.Line(geom, tracerMat);
          this.scene.add(tracer);
          setTimeout(() => this.scene.remove(tracer), 60);

          if (wallCheck.hit) return;

          // 3. Accurate Hitbox & Distance Falloff Damage Application
          const dist = startPt.distanceTo(hitPos);
          const distFalloff = Math.max(0.45, 1 - dist / 68);

          if (targetEnemy.id === 'player') {
            // Verify the shot (with spread/jitter) actually intersected the player's body capsule
            const horizontalDist = Math.hypot(
              hitPos.x - this.playerPosition.x,
              hitPos.z - this.playerPosition.z
            );
            const verticalDist = Math.abs(hitPos.y - (this.playerPosition.y - 0.35));
            if (horizontalDist < 0.62 && verticalDist < 1.15) {
              const rawPlayerDmg = isHeadshot ? 24 : 10;
              const finalDmg = Math.max(4, Math.round(rawPlayerDmg * distFalloff));
              this.applyDamageToPlayer(finalDmg, isHeadshot, shooterBot.player);
            }
          } else {
            const targetBot = this.bots.find(tb => tb.player.id === targetEnemy.id);
            if (targetBot && targetBot.player.isAlive) {
              const horizontalDist = Math.hypot(
                hitPos.x - targetBot.position.x,
                hitPos.z - targetBot.position.z
              );
              if (horizontalDist < 0.68) {
                const botDmg = Math.max(8, Math.round((isHeadshot ? 46 : 19) * distFalloff));
                this.applyDamageToBot(
                  targetBot,
                  botDmg,
                  isHeadshot,
                  hitPos,
                  shooterBot.player,
                  'VANDAL-X',
                  false
                );
              }
            }
          }
        },
        (casterBot, abilityId, targetPos) => {
          // Bot Tactical Ability Deployment via AbilityManager (Coordinated by FSM)
          const botAgent = AGENTS.find(a => a.id === casterBot.player.agentId) || AGENTS[0];
          const lookDir = targetPos.clone().sub(casterBot.position).setY(0);
          if (lookDir.lengthSq() < 0.01) lookDir.set(0, 0, -1);
          else lookDir.normalize();

          this.abilityManager.castAbility(
            abilityId || botAgent.ability1.id,
            botAgent,
            casterBot.player,
            casterBot.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
            lookDir,
            casterBot.yaw,
            this.builtMap.colliders,
            this.bots,
            (bot, dmg, abilityName, attacker) => {
              this.applyDamageToBot(
                bot,
                dmg,
                false,
                bot.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
                attacker || casterBot.player,
                abilityName,
                true
              );
            },
            this.playerMatchData,
            this.playerPosition,
            (dmg, abilityName, attacker) => {
              this.applyDamageToPlayer(dmg, false, attacker || casterBot.player, abilityName, true);
            }
          );
          this.events.onPlayerStatsChange(this.playerMatchData);
        },
        (plantingBot) => {
          // Bot Planted the Spike (Only Attackers can plant)
          if (!this.isSpikePlanted && plantingBot.player.side === 'attackers') {
            this.isSpikePlanted = true;
            plantingBot.player.hasSpike = false;
            this.spikeCarrierId = null;
            this.spikePosition = plantingBot.position.clone();
            this.spikePosition.y = 0;
            this.spikeTimer = 45;

            this.spikeModel = createNexusCoreObjective();
            this.spikeModel.group.position.copy(this.spikePosition);
            this.scene.add(this.spikeModel.group);

            soundEngine.playPlantEvent('success');
            const botAgent = AGENTS.find(a => a.id === plantingBot.player.agentId);
            this.triggerVoiceLine('plant', botAgent, true);
            this.events.onSpikeStateChange(true, 45, false);
            this.events.onRoundStateChange('in_progress', `${plantingBot.player.name} PLANTED THE NEXUS CORE`);
          }
        },
        (defusingBot) => {
          // Bot Defused the Spike (Only Defenders can defuse)
          if (this.isSpikePlanted && defusingBot.player.side === 'defenders') {
            this.isSpikePlanted = false;
            if (this.spikeModel) {
              this.scene.remove(this.spikeModel.group);
              this.spikeModel = null;
            }
            soundEngine.playPlantEvent('defuse_success');
            const botAgent = AGENTS.find(a => a.id === defusingBot.player.agentId);
            this.triggerVoiceLine('defuse', botAgent, true);
            this.events.onSpikeStateChange(false, 0, false);
            const defenderTeam: 'alpha' | 'omega' = this.alphaSide === 'defenders' ? 'alpha' : 'omega';
            this.endRound(defenderTeam, `${defusingBot.player.name} DEFUSED THE NEXUS CORE`);
          }
        },
        this.droppedSpikePosition,
        (pickupBot) => {
          if (!this.isSpikePlanted && pickupBot.player.side === 'attackers' && this.droppedSpikePosition) {
            if (this.droppedSpikeModel) {
              this.scene.remove(this.droppedSpikeModel.group);
              this.droppedSpikeModel = null;
            }
            this.droppedSpikePosition = null;
            pickupBot.player.hasSpike = true;
            this.spikeCarrierId = pickupBot.player.id;
            this.events.onPlayerStatsChange(this.playerMatchData);
          }
        }
      );
    }
  }

  public getClosestCallout(x: number, z: number): string {
    const distA = Math.hypot(x - this.activeMap.siteA.x, z - this.activeMap.siteA.z);
    if (distA <= this.activeMap.siteA.radius + 3) return 'SITE A';
    const distB = Math.hypot(x - this.activeMap.siteB.x, z - this.activeMap.siteB.z);
    if (distB <= this.activeMap.siteB.radius + 3) return 'SITE B';

    let bestCallout = 'TRANSIT SECTOR';
    let bestDist = Infinity;
    for (const c of this.activeMap.callouts) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < bestDist) {
        bestDist = d;
        bestCallout = c.name.toUpperCase();
      }
    }
    return bestCallout;
  }

  /**
   * Broadcasts a tactical team communication or callout to the Team Chat Log Box,
   * and coordinates allied Alpha Squad bots to respond to strategic directives.
   */
  public sendTeamComm(
    message: string,
    category: TacticalChatCategory = 'callout',
    senderName: string = this.playerMatchData.name,
    calloutLocation?: string,
    triggerBotResponse: boolean = true
  ) {
    const loc = calloutLocation || this.getClosestCallout(this.playerPosition.x, this.playerPosition.z);
    const entry: TacticalChatEntry = {
      id: Math.random().toString(36).slice(2, 9),
      senderName,
      senderRole: senderName === this.playerMatchData.name ? this.playerAgent.role : 'SQUAD',
      team: 'alpha',
      category,
      calloutLocation: loc,
      message,
      timestamp: Date.now()
    };
    this.events.onTacticalChat?.(entry);

    // Coordinate allied Alpha Squad bots when player issues a tactical strategy or callout
    if (triggerBotResponse && senderName === this.playerMatchData.name) {
      const aliveAllies = this.bots.filter(b => b.player.team === 'alpha' && b.player.isAlive);
      if (aliveAllies.length > 0) {
        const responder = aliveAllies[Math.floor(Math.random() * aliveAllies.length)];
        const msgUpper = message.toUpperCase();

        if (msgUpper.includes('SITE A') || loc === 'SITE A') {
          AlphaIntel.chosenAttackSite = 'A';
        } else if (msgUpper.includes('SITE B') || loc === 'SITE B') {
          AlphaIntel.chosenAttackSite = 'B';
        }

        setTimeout(() => {
          if (!this.isRunning || !responder.player.isAlive) return;
          const responderLoc = this.getClosestCallout(responder.position.x, responder.position.z);
          let replyText = `Copy that, holding ${responderLoc} and covering your angle.`;
          if (msgUpper.includes('SITE A')) {
            replyText = 'Affirmative — converging on Site A with utility ready!';
          } else if (msgUpper.includes('SITE B')) {
            replyText = 'Copy! Pushing toward Site B together.';
          } else if (msgUpper.includes('ROTATE')) {
            replyText = `Rotating from ${responderLoc} now!`;
          } else if (msgUpper.includes('BACKUP') || msgUpper.includes('HELP') || msgUpper.includes('SPOTTED')) {
            replyText = `En route from ${responderLoc} to reinforce your position!`;
          } else if (msgUpper.includes('ECO') || msgUpper.includes('SAVE')) {
            replyText = 'Understood, playing disciplined angles for economy.';
          }

          this.events.onTacticalChat?.({
            id: Math.random().toString(36).slice(2, 9),
            senderName: responder.player.name,
            senderRole: 'ALLY BOT',
            team: 'alpha',
            category: 'strategy',
            calloutLocation: responderLoc,
            message: replyText,
            timestamp: Date.now()
          });
        }, 650);
      }
    }
  }

  public placeTacticalPing(x: number, z: number, label: string = 'TACTICAL PING') {
    soundEngine.playUIClick();
    const id = Math.random().toString(36).slice(2, 9);
    const now = Date.now();

    // Find closest callout for automatic smart ping label
    const sectorName = this.getClosestCallout(x, z);
    const smartLabel = label === 'TACTICAL PING' ? `PING: ${sectorName}` : label;

    this.tacticalPings.push({
      id,
      x,
      z,
      label: smartLabel,
      createdAt: now
    });

    this.sendTeamComm(
      `Pinging tactical marker at ${sectorName} (${Math.round(x)}m, ${Math.round(z)}m)`,
      'ping',
      this.playerMatchData.name,
      sectorName,
      false
    );

    // Spawn 3D Holographic Tactical Beacon in Scene
    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(x, 0.05, z);

    const beamGeom = new THREE.CylinderGeometry(0.08, 0.08, 18, 12);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.55
    });
    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.position.y = 9;
    beaconGroup.add(beam);

    const ringGeom = new THREE.RingGeometry(0.6, 0.85, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    beaconGroup.add(ring);

    this.scene.add(beaconGroup);
    setTimeout(() => {
      this.scene.remove(beaconGroup);
    }, 8000);
  }

  public getRadarState(): RadarTelemetry {
    const now = Date.now();
    this.tacticalPings = this.tacticalPings.filter(p => now - p.createdAt < 8000);

    // 1. Determine current callout sector for player
    let currentCallout = 'TRANSIT SECTOR';
    let minCalloutDist = Infinity;
    for (const c of this.activeMap.callouts) {
      const d = Math.hypot(this.playerPosition.x - c.x, this.playerPosition.z - c.z);
      if (d < minCalloutDist) {
        minCalloutDist = d;
        currentCallout = c.name;
      }
    }

    // 2. Map geometry walls & cover rects
    const walls: RadarWallRect[] = [];
    for (const c of this.builtMap.colliders) {
      walls.push({
        minX: c.box.min.x,
        minZ: c.box.min.z,
        maxX: c.box.max.x,
        maxZ: c.box.max.z,
        isWall: c.isWall,
        isCover: c.isCover,
        isExplosiveBarrel: c.isExplosiveBarrel
      });
    }

    // 3. Build entity blips (Player + Allies + Spotted Enemies)
    const blips: RadarEntityBlip[] = [
      {
        id: this.playerMatchData.id,
        name: this.playerMatchData.name,
        agentId: this.playerMatchData.agentId,
        team: this.playerMatchData.team,
        x: this.playerPosition.x,
        z: this.playerPosition.z,
        yaw: this.playerYaw,
        isAlive: this.playerMatchData.isAlive,
        isPlayer: true,
        isSpotted: true,
        health: this.playerMatchData.health
      }
    ];

    const alliedBots = this.bots.filter(b => b.player.team === this.playerMatchData.team && b.player.isAlive);

    for (const b of this.bots) {
      const isAlly = b.player.team === this.playerMatchData.team;
      let isSpotted = isAlly;

      if (!isAlly && b.player.isAlive) {
        if (
          this.abilityManager.isEnemiesRevealed ||
          this.abilityManager.revealedEnemyIds.has(b.player.id) ||
          b.mode === 'engage'
        ) {
          isSpotted = true;
        } else {
          // Check proximity/sight from player
          const distToPlayer = Math.hypot(b.position.x - this.playerPosition.x, b.position.z - this.playerPosition.z);
          if (distToPlayer < 26) {
            isSpotted = true;
          } else {
            // Check proximity from living allied bots
            for (const ally of alliedBots) {
              if (Math.hypot(b.position.x - ally.position.x, b.position.z - ally.position.z) < 24) {
                isSpotted = true;
                break;
              }
            }
          }
        }
      }

      blips.push({
        id: b.player.id,
        name: b.player.name,
        agentId: b.player.agentId,
        team: b.player.team,
        x: b.position.x,
        z: b.position.z,
        yaw: b.yaw,
        isAlive: b.player.isAlive,
        isPlayer: false,
        isSpotted,
        health: b.player.health,
        fsmState: b.fsmState
      });
    }

    // 4. Active Ability Zones
    const abilities: RadarAbilityZone[] = this.abilityManager.entities.map(ent => ({
      id: ent.id,
      type: ent.type,
      team: ent.team,
      x: ent.position.x,
      z: ent.position.z
    }));

    return {
      playerX: this.playerPosition.x,
      playerZ: this.playerPosition.z,
      playerYaw: this.playerYaw,
      currentCallout,
      walls,
      blips,
      abilities,
      spikePosition: this.isSpikePlanted && this.spikePosition
        ? { x: this.spikePosition.x, z: this.spikePosition.z }
        : null,
      droppedSpikePosition: this.droppedSpikePosition
        ? { x: this.droppedSpikePosition.x, z: this.droppedSpikePosition.z }
        : null,
      spikeCarrierId: this.spikeCarrierId,
      pings: this.tacticalPings
    };
  }
}
