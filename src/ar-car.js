/**
 * AERO-RC // Three.js 3D AR Scene & 360° Spatial Tracking Engine
 * Features:
 * - 360° Gyroscope & Compass Camera AR Tracking (car stays locked to your room floor)
 * - Photorealistic RoomEnvironment PMREM reflections & metallic clearcoat materials
 * - Realistic Ground Ambient Occlusion Contact Shadow (no floating)
 * - 360° Touch Orbit fallback (drag on screen to look around)
 * - Off-Screen 360° Car Direction Radar (guides you back to the car if you look away)
 * - Headlight SpotLight ground projection, tire smoke, and suspension dynamics
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class ARCarScene {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // World Anchor & Car 3D Objects
    this.worldRoot = null; // Anchors the entire AR coordinate system to your physical room
    this.carRoot = null;
    this.carBody = null;
    this.carPaintMaterial = null;
    this.contactShadowMesh = null;
    this.underglowLight = null;
    this.underglowMaterial = null;

    // Headlight entities
    this.headlights = [];
    this.headlightSpotlights = [];
    this.taillightMaterial = null;
    this.areHeadlightsOn = true;

    // Wheel nodes
    this.frontLeftPivot = null;
    this.frontRightPivot = null;
    this.wheels = [];

    // Ground plane
    this.groundPlane = null;
    this.arReticleMesh = null;

    // Particle systems
    this.smokeParticles = [];
    this.nitroParticles = [];

    // Raycaster for tap-to-place
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // 360° Spatial Camera Tracking State
    this.cameraTrackingMode = 'gyro-360'; // 'gyro-360', 'orbit-360', 'chase'
    this.currentScale = 1.0;
    this.deviceOrientation = { alpha: 0, beta: 75, gamma: 0 };
    this.screenOrientation = 0;
    this.hasGyroData = false;
    this.targetCameraQuat = new THREE.Quaternion();
    this.baseYawOffset = 0; // Calibration offset for true 360° anchor

    // Manual Touch Orbit State (for desktop or when touch dragging)
    this.touchOrbit = {
      yaw: 0,
      pitch: 0.45,
      isDragging: false,
      lastX: 0,
      lastY: 0
    };

    // 360° Off-Screen Radar Callback
    this.onCarRadarUpdate = null;

    this.init();
  }

  init() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera: Perspective AR Camera positioned at human standing/sitting eye-level (1.35m)
    this.camera = new THREE.PerspectiveCamera(56, width / height, 0.05, 100);
    this.camera.position.set(0, 1.35, 0);

    // 3. Renderer with transparent background for AR camera overlay
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    // 4. Photorealistic Environment Map (RoomEnvironment PMREM)
    this.setupEnvironment();

    // 5. Lighting Environment
    this.setupLighting();

    // 6. World Anchor Group
    this.worldRoot = new THREE.Group();
    this.scene.add(this.worldRoot);

    // 7. Ground Plane with Soft Contact Shadow
    this.setupGround();

    // 8. Build Procedural 3D Supercar Model
    this.buildSupercar();

    // 9. Particle Systems
    this.setupParticles();

    // 10. Setup 360° DeviceOrientation & Touch Orbit Listeners
    this.setupTrackingListeners();

    // Resize handler
    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupEnvironment() {
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      pmremGenerator.compileEquirectangularShader();
      const roomEnv = new RoomEnvironment();
      const envTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
      this.scene.environment = envTexture;
    } catch (e) {
      console.warn('Could not initialize PMREM RoomEnvironment:', e);
    }
  }

  setupLighting() {
    // Ambient light with natural daylight tone
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    // Main directional sunlight casting crisp soft shadows
    const dirLight = new THREE.DirectionalLight(0xfff8ee, 2.8);
    dirLight.position.set(6, 14, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 30;
    dirLight.shadow.camera.left = -10;
    dirLight.shadow.camera.right = 10;
    dirLight.shadow.camera.top = 10;
    dirLight.shadow.camera.bottom = -10;
    dirLight.shadow.bias = -0.0004;
    this.scene.add(dirLight);

    // Secondary soft fill light for realistic rim highlights
    const fillLight = new THREE.DirectionalLight(0x88bbff, 1.2);
    fillLight.position.set(-6, 8, -6);
    this.scene.add(fillLight);
  }

  setupGround() {
    // 1. Transparent ground plane that catches dynamic directional light & spotlight shadows
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.ShadowMaterial({
      opacity: 0.5
    });
    this.groundPlane = new THREE.Mesh(groundGeo, groundMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.receiveShadow = true;
    this.worldRoot.add(this.groundPlane);

    // 2. Holographic AR Floor Tracking Ring
    const reticleGeo = new THREE.RingGeometry(0.85, 0.9, 48);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35
    });
    this.arReticleMesh = new THREE.Mesh(reticleGeo, reticleMat);
    this.arReticleMesh.rotation.x = -Math.PI / 2;
    this.arReticleMesh.position.y = 0.005;
    this.worldRoot.add(this.arReticleMesh);

    // 3. Baked Ambient Occlusion Contact Shadow Texture under the car
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sctx = shadowCanvas.getContext('2d');

    // Smooth radial falloff
    const grad = sctx.createRadialGradient(128, 128, 30, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 256, 256);

    const contactTexture = new THREE.CanvasTexture(shadowCanvas);
    const contactGeo = new THREE.PlaneGeometry(2.6, 4.8);
    const contactMat = new THREE.MeshBasicMaterial({
      map: contactTexture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    this.contactShadowMesh = new THREE.Mesh(contactGeo, contactMat);
    this.contactShadowMesh.rotation.x = -Math.PI / 2;
    this.contactShadowMesh.position.y = 0.008;
    this.worldRoot.add(this.contactShadowMesh);
  }

  buildSupercar() {
    this.carRoot = new THREE.Group();
    this.carBody = new THREE.Group();
    this.carRoot.add(this.carBody);

    // Start car anchored at 3.2 meters in front of the camera on the floor
    this.carRoot.position.set(0, 0, -3.2);

    // High-end Photorealistic Materials
    this.carPaintMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x00f3ff,
      metalness: 0.9,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 1.0
    });

    const carbonMaterial = new THREE.MeshStandardMaterial({
      color: 0x14161b,
      roughness: 0.45,
      metalness: 0.5
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0d131a,
      metalness: 0.2,
      roughness: 0.05,
      transmission: 0.8,
      transparent: true,
      opacity: 0.88,
      reflectivity: 0.9
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      metalness: 0.98,
      roughness: 0.08
    });

    // 1. Lower Carbon Splitter Base
    const baseGeo = new THREE.BoxGeometry(1.65, 0.22, 3.8);
    const baseMesh = new THREE.Mesh(baseGeo, carbonMaterial);
    baseMesh.position.y = 0.26;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    this.carBody.add(baseMesh);

    // 2. Aerodynamic Main Fuselage
    const cockpitGeo = new THREE.BoxGeometry(1.42, 0.46, 2.2);
    const cockpitMesh = new THREE.Mesh(cockpitGeo, this.carPaintMaterial);
    cockpitMesh.position.set(0, 0.54, -0.1);
    cockpitMesh.castShadow = true;
    this.carBody.add(cockpitMesh);

    // 3. Sloped Hood
    const hoodGeo = new THREE.CylinderGeometry(0.76, 0.84, 1.25, 4);
    hoodGeo.rotateY(Math.PI / 4);
    hoodGeo.scale(1, 0.28, 1);
    const hoodMesh = new THREE.Mesh(hoodGeo, this.carPaintMaterial);
    hoodMesh.position.set(0, 0.42, 1.4);
    hoodMesh.rotation.x = 0.08;
    hoodMesh.castShadow = true;
    this.carBody.add(hoodMesh);

    // 4. Front Aerodynamic Splitter Winglet
    const splitterGeo = new THREE.BoxGeometry(1.7, 0.05, 0.45);
    const splitter = new THREE.Mesh(splitterGeo, carbonMaterial);
    splitter.position.set(0, 0.14, 2.05);
    splitter.castShadow = true;
    this.carBody.add(splitter);

    // 5. Tinted Glass Cabin Canopy (Windshield & Roof)
    const canopyGeo = new THREE.CylinderGeometry(0.56, 0.72, 1.35, 4);
    canopyGeo.rotateY(Math.PI / 4);
    canopyGeo.scale(1, 0.44, 1.15);
    const canopyMesh = new THREE.Mesh(canopyGeo, glassMaterial);
    canopyMesh.position.set(0, 0.86, -0.15);
    canopyMesh.castShadow = true;
    this.carBody.add(canopyMesh);

    // 6. Rear Engine Deck
    const rearDeckGeo = new THREE.BoxGeometry(1.52, 0.36, 1.15);
    const rearDeck = new THREE.Mesh(rearDeckGeo, this.carPaintMaterial);
    rearDeck.position.set(0, 0.51, -1.35);
    rearDeck.castShadow = true;
    this.carBody.add(rearDeck);

    // 7. Carbon Fiber Racing Wing / Spoiler
    const wingGeo = new THREE.BoxGeometry(1.75, 0.05, 0.38);
    const wing = new THREE.Mesh(wingGeo, carbonMaterial);
    wing.position.set(0, 1.04, -1.82);
    wing.castShadow = true;
    this.carBody.add(wing);

    const strutGeo = new THREE.BoxGeometry(0.04, 0.32, 0.16);
    const leftStrut = new THREE.Mesh(strutGeo, carbonMaterial);
    leftStrut.position.set(-0.52, 0.84, -1.78);
    const rightStrut = new THREE.Mesh(strutGeo, carbonMaterial);
    rightStrut.position.set(0.52, 0.84, -1.78);
    this.carBody.add(leftStrut);
    this.carBody.add(rightStrut);

    // 8. Dual Polished Chrome Exhaust
    const exhaustGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.28, 16);
    exhaustGeo.rotateX(Math.PI / 2);
    const exhaustLeft = new THREE.Mesh(exhaustGeo, chromeMaterial);
    exhaustLeft.position.set(-0.26, 0.23, -1.98);
    const exhaustRight = new THREE.Mesh(exhaustGeo, chromeMaterial);
    exhaustRight.position.set(0.26, 0.23, -1.98);
    this.carBody.add(exhaustLeft);
    this.carBody.add(exhaustRight);

    // 9. Wheels & Suspension Assembly
    this.buildWheels(carbonMaterial, chromeMaterial);

    // 10. Headlights & Dynamic Ground Spotlights
    this.setupHeadlights();

    // 11. Taillights & Brake lights
    this.setupTaillights();

    // 12. Neon Underglow
    this.setupUnderglow();

    this.worldRoot.add(this.carRoot);
  }

  buildWheels(tireMat, rimMat) {
    const wheelRadius = 0.36;
    const wheelWidth = 0.24;

    const createWheelMesh = () => {
      const wheelGroup = new THREE.Group();

      // Tire Rubber
      const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 28);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      wheelGroup.add(tire);

      // Alloy Rim
      const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.74, wheelRadius * 0.74, wheelWidth + 0.015, 18);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wheelGroup.add(rim);

      // Red Brake Caliper
      const caliperGeo = new THREE.BoxGeometry(0.08, 0.16, 0.12);
      const caliperMat = new THREE.MeshStandardMaterial({ color: 0xff0033 });
      const caliper = new THREE.Mesh(caliperGeo, caliperMat);
      caliper.position.set(0, 0.12, 0);
      wheelGroup.add(caliper);

      return wheelGroup;
    };

    const posX = 0.88;
    const posY = 0.36;
    const posZFront = 1.25;
    const posZRear = -1.25;

    // Front Left (Steering Pivot)
    this.frontLeftPivot = new THREE.Group();
    this.frontLeftPivot.position.set(-posX, posY, posZFront);
    const flWheel = createWheelMesh();
    this.frontLeftPivot.add(flWheel);
    this.carBody.add(this.frontLeftPivot);
    this.wheels.push(flWheel);

    // Front Right (Steering Pivot)
    this.frontRightPivot = new THREE.Group();
    this.frontRightPivot.position.set(posX, posY, posZFront);
    const frWheel = createWheelMesh();
    this.frontRightPivot.add(frWheel);
    this.carBody.add(this.frontRightPivot);
    this.wheels.push(frWheel);

    // Rear Left
    const rlGroup = new THREE.Group();
    rlGroup.position.set(-posX, posY, posZRear);
    const rlWheel = createWheelMesh();
    rlGroup.add(rlWheel);
    this.carBody.add(rlGroup);
    this.wheels.push(rlWheel);

    // Rear Right
    const rrGroup = new THREE.Group();
    rrGroup.position.set(posX, posY, posZRear);
    const rrWheel = createWheelMesh();
    rrGroup.add(rrWheel);
    this.carBody.add(rrGroup);
    this.wheels.push(rrWheel);
  }

  setupHeadlights() {
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xe6f7ff });

    const hGeo = new THREE.BoxGeometry(0.25, 0.08, 0.05);
    const hLeft = new THREE.Mesh(hGeo, headlightMat);
    hLeft.position.set(-0.55, 0.44, 2.0);
    this.carBody.add(hLeft);

    const hRight = new THREE.Mesh(hGeo, headlightMat);
    hRight.position.set(0.55, 0.44, 2.0);
    this.carBody.add(hRight);

    this.headlights = [hLeft, hRight];

    // Real dynamic SpotLights projecting onto the floor in front of the car
    const createSpot = (x) => {
      const spot = new THREE.SpotLight(0xf2f8ff, 6.5, 18, Math.PI / 6, 0.35, 1.2);
      spot.position.set(x, 0.5, 2.1);
      spot.target.position.set(x, 0, 8);
      spot.castShadow = true;
      spot.shadow.mapSize.width = 512;
      spot.shadow.mapSize.height = 512;
      this.carBody.add(spot);
      this.carBody.add(spot.target);
      return spot;
    };

    this.headlightSpotlights = [createSpot(-0.55), createSpot(0.55)];
  }

  setupTaillights() {
    this.taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xbb0000,
      emissive: 0xff0022,
      emissiveIntensity: 1.2,
      roughness: 0.2
    });

    const tailGeo = new THREE.BoxGeometry(1.42, 0.06, 0.05);
    const tailMesh = new THREE.Mesh(tailGeo, this.taillightMaterial);
    tailMesh.position.set(0, 0.58, -1.98);
    this.carBody.add(tailMesh);
  }

  setupUnderglow() {
    this.underglowLight = new THREE.PointLight(0x00f3ff, 4, 3.5, 1.8);
    this.underglowLight.position.set(0, 0.12, 0);
    this.carBody.add(this.underglowLight);

    const stripGeo = new THREE.PlaneGeometry(1.2, 2.4);
    this.underglowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });
    const strip = new THREE.Mesh(stripGeo, this.underglowMaterial);
    strip.rotation.x = Math.PI / 2;
    strip.position.set(0, 0.08, 0);
    this.carBody.add(strip);
  }

  setupParticles() {
    const smokeCount = 35;
    const smokeGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xd8d8d8,
      transparent: true,
      opacity: 0
    });

    for (let i = 0; i < smokeCount; i++) {
      const p = new THREE.Mesh(smokeGeo, smokeMat.clone());
      p.visible = false;
      this.worldRoot.add(p);
      this.smokeParticles.push({
        mesh: p,
        life: 0,
        maxLife: 1.0,
        velocity: new THREE.Vector3()
      });
    }

    const nitroCount = 20;
    const nitroGeo = new THREE.SphereGeometry(0.06, 6, 6);
    for (let i = 0; i < nitroCount; i++) {
      const np = new THREE.Mesh(nitroGeo, new THREE.MeshBasicMaterial({
        color: 0x00f3ff,
        transparent: true,
        opacity: 0
      }));
      np.visible = false;
      this.worldRoot.add(np);
      this.nitroParticles.push({
        mesh: np,
        life: 0,
        maxLife: 0.4,
        velocity: new THREE.Vector3()
      });
    }
  }

  // ==========================================================================
  // 360° Spatial Gyroscope & Touch Tracking Listeners
  // ==========================================================================

  setupTrackingListeners() {
    // 1. DeviceOrientation for true 360° phone rotation around your room
    window.addEventListener('deviceorientation', (e) => {
      if (e.alpha !== null && e.beta !== null) {
        this.deviceOrientation.alpha = e.alpha; // 0 to 360 (compass heading)
        this.deviceOrientation.beta = e.beta;   // -180 to 180 (front/back pitch)
        this.deviceOrientation.gamma = e.gamma; // -90 to 90 (left/right roll)
        
        if (!this.hasGyroData) {
          this.hasGyroData = true;
          // Set initial calibration base heading so the car spawns directly ahead in your room
          this.calibrateAnchor();
        }
      }
    }, true);

    // 2. Screen orientation changes
    window.addEventListener('orientationchange', () => {
      this.screenOrientation = window.orientation || (screen.orientation ? screen.orientation.angle : 0) || 0;
    });

    // 3. Touch / Pointer 360° Orbit Drag (for desktop or when dragging outside controls)
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#hud-interface button') || e.target.closest('.thumb-cluster')) return;
      this.touchOrbit.isDragging = true;
      this.touchOrbit.lastX = e.clientX;
      this.touchOrbit.lastY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.touchOrbit.isDragging) return;
      const dx = e.clientX - this.touchOrbit.lastX;
      const dy = e.clientY - this.touchOrbit.lastY;
      this.touchOrbit.lastX = e.clientX;
      this.touchOrbit.lastY = e.clientY;

      // Pan 360° horizontally & vertically
      this.touchOrbit.yaw -= dx * 0.006;
      this.touchOrbit.pitch = Math.max(0.1, Math.min(1.2, this.touchOrbit.pitch + dy * 0.005));
    });

    window.addEventListener('pointerup', () => {
      this.touchOrbit.isDragging = false;
    });
  }

  /**
   * Calibrates the AR World Anchor directly in front of the current phone heading
   */
  calibrateAnchor() {
    this.baseYawOffset = this.deviceOrientation.alpha || 0;
    this.touchOrbit.yaw = 0;
    if (this.worldRoot) {
      this.worldRoot.rotation.y = THREE.MathUtils.degToRad(-this.baseYawOffset);
    }
  }

  /**
   * Convert W3C DeviceOrientation (alpha, beta, gamma, orient) to Three.js Quaternion
   */
  computeDeviceQuaternion() {
    const degToRad = THREE.MathUtils.degToRad;
    const alpha = degToRad(this.deviceOrientation.alpha);
    const beta = degToRad(this.deviceOrientation.beta);
    const gamma = degToRad(this.deviceOrientation.gamma);
    const orient = degToRad(this.screenOrientation);

    const zee = new THREE.Vector3(0, 0, 1);
    const euler = new THREE.Euler();
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -PI/2 around X axis

    euler.set(beta, alpha, -gamma, 'YXZ');
    const quat = new THREE.Quaternion();
    quat.setFromEuler(euler);
    quat.multiply(q1); // Orient camera down -Z
    quat.multiply(q0.setFromAxisAngle(zee, -orient));
    return quat;
  }

  emitSmoke(pos) {
    const p = this.smokeParticles.find(item => item.life <= 0);
    if (!p) return;

    p.mesh.position.copy(pos);
    p.mesh.position.x += (Math.random() - 0.5) * 0.3;
    p.mesh.position.z += (Math.random() - 0.5) * 0.3;
    p.mesh.scale.setScalar(0.4 + Math.random() * 0.4);
    p.mesh.visible = true;

    p.life = 0.01;
    p.maxLife = 0.8 + Math.random() * 0.4;
    p.velocity.set(
      (Math.random() - 0.5) * 0.4,
      0.3 + Math.random() * 0.4,
      (Math.random() - 0.5) * 0.4
    );
  }

  emitNitro(pos) {
    const np = this.nitroParticles.find(item => item.life <= 0);
    if (!np) return;

    np.mesh.position.copy(pos);
    np.mesh.scale.setScalar(0.8 + Math.random() * 0.5);
    np.mesh.visible = true;
    np.life = 0.01;
    np.maxLife = 0.3 + Math.random() * 0.2;
    np.velocity.set(
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2,
      -1.2 - Math.random() * 0.8
    );
  }

  // ==========================================================================
  // Main Simulation & Render Tick
  // ==========================================================================

  update(physics, dt) {
    if (!this.carRoot) return;

    // 1. Position & Heading of Car in 3D AR Space
    // Physics operates relative to initial anchor position
    const carAnchorZ = -3.2;
    this.carRoot.position.set(physics.x, 0, carAnchorZ + physics.z);
    this.carRoot.rotation.y = physics.heading;

    // Contact shadow follows car on the floor
    if (this.contactShadowMesh) {
      this.contactShadowMesh.position.x = this.carRoot.position.x;
      this.contactShadowMesh.position.z = this.carRoot.position.z;
      this.contactShadowMesh.rotation.z = -physics.heading;
      this.contactShadowMesh.scale.setScalar(this.currentScale);
    }

    if (this.arReticleMesh) {
      this.arReticleMesh.position.x = this.carRoot.position.x;
      this.arReticleMesh.position.z = this.carRoot.position.z;
    }

    // 2. Steer Front Wheels Pivot
    if (this.frontLeftPivot && this.frontRightPivot) {
      this.frontLeftPivot.rotation.y = -physics.currentSteerAngle;
      this.frontRightPivot.rotation.y = -physics.currentSteerAngle;
    }

    // 3. Roll Wheels based on velocity
    const wheelRollSpeed = (physics.speed / 0.36) * dt;
    this.wheels.forEach(w => {
      w.rotation.x += wheelRollSpeed;
    });

    // 4. Suspension Dynamics (Pitch and Roll)
    const targetPitch = (physics.throttleInput > 0 ? -0.04 : 0.06 * Math.abs(physics.throttleInput)) * (Math.abs(physics.speed) > 1 ? 1 : 0.3);
    const targetRoll = -physics.currentSteerAngle * (Math.abs(physics.speed) / physics.maxSpeedForward) * 0.15;

    this.carBody.rotation.x += (targetPitch - this.carBody.rotation.x) * 6 * dt;
    this.carBody.rotation.z += (targetRoll - this.carBody.rotation.z) * 6 * dt;

    // 5. Taillight / Brake light brightness
    if (this.taillightMaterial) {
      if (physics.throttleInput < -0.1 && physics.speed > 0.5) {
        this.taillightMaterial.emissiveIntensity = 3.5;
        this.taillightMaterial.emissive.setHex(0xff0022);
      } else if (physics.speed < -0.2) {
        this.taillightMaterial.emissiveIntensity = 2.0;
        this.taillightMaterial.emissive.setHex(0xffffff);
      } else {
        this.taillightMaterial.emissiveIntensity = 1.2;
        this.taillightMaterial.emissive.setHex(0xff0022);
      }
    }

    // 6. Drift Smoke Emitter
    if (physics.isDrifting && Math.abs(physics.speed) > 3) {
      const carWorldPos = new THREE.Vector3();
      this.carRoot.getWorldPosition(carWorldPos);
      this.emitSmoke(carWorldPos);
    }

    this.smokeParticles.forEach(p => {
      if (p.life > 0) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.life = 0;
          p.mesh.visible = false;
        } else {
          p.mesh.position.addScaledVector(p.velocity, dt);
          const progress = p.life / p.maxLife;
          p.mesh.scale.multiplyScalar(1 + 0.8 * dt);
          p.mesh.material.opacity = (1 - progress) * 0.5;
        }
      }
    });

    // 7. Nitro Particle Emitter
    if (physics.nitroActive && physics.nitroEnergy > 5 && physics.throttleInput > 0.1) {
      const carWorldPos = new THREE.Vector3();
      this.carRoot.getWorldPosition(carWorldPos);
      this.emitNitro(carWorldPos);
    }

    this.nitroParticles.forEach(np => {
      if (np.life > 0) {
        np.life += dt;
        if (np.life >= np.maxLife) {
          np.life = 0;
          np.mesh.visible = false;
        } else {
          np.mesh.position.addScaledVector(np.velocity, dt);
          const progress = np.life / np.maxLife;
          np.mesh.material.opacity = (1 - progress) * 0.8;
        }
      }
    });

    // ========================================================================
    // 8. 360° AR Camera Spatial Update (Keeps the car locked in your room)
    // ========================================================================

    if (this.cameraTrackingMode === 'chase') {
      // Chaser Cam (follows behind car heading)
      const camDist = 5.0 * this.currentScale;
      const camHeight = 2.2 * this.currentScale;
      const targetCamX = this.carRoot.position.x - Math.sin(physics.heading) * camDist;
      const targetCamZ = this.carRoot.position.z - Math.cos(physics.heading) * camDist;

      this.camera.position.x += (targetCamX - this.camera.position.x) * 4 * dt;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * 4 * dt;
      this.camera.position.y += (camHeight - this.camera.position.y) * 4 * dt;
      this.camera.lookAt(this.carRoot.position.x, 0.4 * this.currentScale, this.carRoot.position.z);

    } else if (this.hasGyroData) {
      // True 360° Gyroscope AR Floor Anchor
      // The camera rotates with your real physical phone in 360 degrees!
      const deviceQuat = this.computeDeviceQuaternion();
      this.camera.quaternion.slerp(deviceQuat, 0.25);
      this.camera.position.set(0, 1.35, 0); // Eye-height anchor

    } else {
      // Touch Orbit 360° / Desktop Mode
      const camDist = 4.2 * this.currentScale;
      const camY = Math.sin(this.touchOrbit.pitch) * camDist;
      const groundRadius = Math.cos(this.touchOrbit.pitch) * camDist;
      const camX = Math.sin(this.touchOrbit.yaw) * groundRadius;
      const camZ = this.carRoot.position.z + Math.cos(this.touchOrbit.yaw) * groundRadius;

      this.camera.position.set(camX, camY + 0.4, camZ);
      this.camera.lookAt(this.carRoot.position.x, 0.35, this.carRoot.position.z);
    }

    // ========================================================================
    // 9. 360° Off-Screen Car Radar Indicator (Never lose the car in your room)
    // ========================================================================
    if (this.onCarRadarUpdate) {
      const carWorld = new THREE.Vector3();
      this.carRoot.getWorldPosition(carWorld);

      // Project car 3D position to 2D screen space
      const screenProj = carWorld.clone().project(this.camera);

      // Check if car is inside camera view frustum
      const isVisible = (
        screenProj.z < 1.0 &&
        screenProj.x >= -0.9 && screenProj.x <= 0.9 &&
        screenProj.y >= -0.9 && screenProj.y <= 0.9
      );

      // Angle from center of screen to car
      const angleDeg = Math.round(Math.atan2(screenProj.x, screenProj.y) * (180 / Math.PI));
      const distanceMeters = (this.camera.position.distanceTo(carWorld)).toFixed(1);

      this.onCarRadarUpdate({
        isVisible,
        angleDeg,
        screenX: (screenProj.x * 0.5 + 0.5) * window.innerWidth,
        screenY: (-screenProj.y * 0.5 + 0.5) * window.innerHeight,
        distanceMeters,
        isBehind: screenProj.z > 1.0
      });
    }

    // Render 3D Frame
    this.renderer.render(this.scene, this.camera);
  }

  // Toggles Headlights
  setHeadlights(on) {
    this.areHeadlightsOn = on;
    this.headlights.forEach(h => {
      h.visible = on;
    });
    this.headlightSpotlights.forEach(spot => {
      spot.visible = on;
    });
    return this.areHeadlightsOn;
  }

  // Sets Paint Color
  setCarPaint(hexString) {
    if (this.carPaintMaterial) {
      this.carPaintMaterial.color.set(hexString);
    }
  }

  // Sets Underglow Color or 'none'
  setUnderglowColor(hexString) {
    if (hexString === 'none') {
      this.underglowLight.visible = false;
      this.underglowMaterial.visible = false;
    } else {
      this.underglowLight.visible = true;
      this.underglowMaterial.visible = true;
      this.underglowLight.color.set(hexString);
      this.underglowMaterial.color.set(hexString);
    }
  }

  // Sets AR Scale factor (1:18, 1:10, 1:5)
  setScale(scaleFactor) {
    this.currentScale = scaleFactor;
    if (this.carRoot) {
      this.carRoot.scale.setScalar(scaleFactor);
    }
  }

  // Tap-to-Place Raycaster
  placeCarAtScreenCoords(clientX, clientY, physics) {
    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.groundPlane);

    if (intersects.length > 0) {
      const hit = intersects[0].point;
      // Reposition in world space
      physics.resetPosition(hit.x, hit.z - (-3.2), physics.heading);
      return true;
    }
    return false;
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
