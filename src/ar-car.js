/**
 * AERO-RC // Three.js 3D AR Scene & Car Model Engine
 * High-detail procedural supercar model, realistic shadows, dynamic headlight beams,
 * suspension dynamics, tire smoke particles, and AR ground plane.
 */

import * as THREE from 'three';

export class ARCarScene {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Car 3D Objects
    this.carRoot = null;
    this.carBody = null;
    this.carPaintMaterial = null;
    this.underglowLight = null;
    this.underglowMaterial = null;

    // Headlight entities
    this.headlights = [];
    this.headlightSpotlights = [];
    this.taillightMaterial = null;
    this.reverseLightMaterial = null;
    this.areHeadlightsOn = true;

    // Wheel nodes
    this.frontLeftPivot = null;
    this.frontRightPivot = null;
    this.wheels = []; // All 4 wheel meshes for rolling rotation

    // Ground plane
    this.groundPlane = null;
    this.arReticleMesh = null;

    // Particle systems
    this.smokeParticles = [];
    this.nitroParticles = [];
    this.smokeGeo = null;
    this.smokeMat = null;

    // Raycaster for tap-to-place
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Scale & Camera View Mode
    this.currentScale = 1.0;
    this.cameraTrackingMode = 'fixed-ar'; // 'fixed-ar' (ground lock) or 'chase'

    this.init();
  }

  init() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera: Perspective AR Camera
    this.camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 100);
    this.camera.position.set(0, 3.8, 6.2);
    this.camera.lookAt(0, 0.5, 0);

    // 3. Renderer with transparent background for AR camera overlay
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true // Required for photo snapshots
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    // 4. Lighting Environment
    this.setupLighting();

    // 5. Shadow Catcher Ground Plane
    this.setupGround();

    // 6. Build Procedural 3D Supercar Model
    this.buildSupercar();

    // 7. Particle Systems
    this.setupParticles();

    // Resize handler
    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupLighting() {
    // Ambient light with cool sky tint
    const ambientLight = new THREE.AmbientLight(0xddeeff, 1.2);
    this.scene.add(ambientLight);

    // Main directional sun light
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight.position.set(10, 18, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 40;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Soft sky hemisphere light for realistic ambient reflection
    const hemiLight = new THREE.HemisphereLight(0x4466aa, 0x111122, 0.8);
    this.scene.add(hemiLight);
  }

  setupGround() {
    // Transparent ground plane that ONLY catches shadows from car & headlights
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.ShadowMaterial({
      opacity: 0.42
    });
    this.groundPlane = new THREE.Mesh(groundGeo, groundMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);

    // Subtle holographic AR tracking grid ring
    const reticleGeo = new THREE.RingGeometry(0.8, 0.85, 32);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25
    });
    this.arReticleMesh = new THREE.Mesh(reticleGeo, reticleMat);
    this.arReticleMesh.rotation.x = -Math.PI / 2;
    this.arReticleMesh.position.y = 0.01;
    this.scene.add(this.arReticleMesh);
  }

  buildSupercar() {
    this.carRoot = new THREE.Group();
    this.carBody = new THREE.Group();
    this.carRoot.add(this.carBody);

    // Common Materials
    this.carPaintMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x00f3ff,
      metalness: 0.85,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 0.9
    });

    const carbonMaterial = new THREE.MeshStandardMaterial({
      color: 0x181a20,
      roughness: 0.5,
      metalness: 0.3
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x111a24,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.7,
      transparent: true,
      opacity: 0.85
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      metalness: 0.95,
      roughness: 0.1
    });

    // 1. Lower Chassis base
    const baseGeo = new THREE.BoxGeometry(1.6, 0.25, 3.8);
    const baseMesh = new THREE.Mesh(baseGeo, carbonMaterial);
    baseMesh.position.y = 0.28;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    this.carBody.add(baseMesh);

    // 2. Main Aerodynamic Cockpit Fuselage
    const cockpitGeo = new THREE.BoxGeometry(1.4, 0.45, 2.2);
    const cockpitMesh = new THREE.Mesh(cockpitGeo, this.carPaintMaterial);
    cockpitMesh.position.set(0, 0.55, -0.1);
    cockpitMesh.castShadow = true;
    this.carBody.add(cockpitMesh);

    // 3. Sloped Hood
    const hoodGeo = new THREE.CylinderGeometry(0.75, 0.82, 1.2, 4);
    hoodGeo.rotateY(Math.PI / 4);
    hoodGeo.scale(1, 0.3, 1);
    const hoodMesh = new THREE.Mesh(hoodGeo, this.carPaintMaterial);
    hoodMesh.position.set(0, 0.42, 1.4);
    hoodMesh.rotation.x = 0.08;
    hoodMesh.castShadow = true;
    this.carBody.add(hoodMesh);

    // 4. Front Splitter
    const splitterGeo = new THREE.BoxGeometry(1.65, 0.05, 0.4);
    const splitter = new THREE.Mesh(splitterGeo, carbonMaterial);
    splitter.position.set(0, 0.15, 2.05);
    splitter.castShadow = true;
    this.carBody.add(splitter);

    // 5. Cabin Canopy (Windshield + Roof)
    const canopyGeo = new THREE.CylinderGeometry(0.55, 0.7, 1.3, 4);
    canopyGeo.rotateY(Math.PI / 4);
    canopyGeo.scale(1, 0.45, 1.1);
    const canopyMesh = new THREE.Mesh(canopyGeo, glassMaterial);
    canopyMesh.position.set(0, 0.88, -0.15);
    canopyMesh.castShadow = true;
    this.carBody.add(canopyMesh);

    // 6. Rear Engine Deck & Diffuser
    const rearDeckGeo = new THREE.BoxGeometry(1.5, 0.35, 1.1);
    const rearDeck = new THREE.Mesh(rearDeckGeo, this.carPaintMaterial);
    rearDeck.position.set(0, 0.52, -1.35);
    rearDeck.castShadow = true;
    this.carBody.add(rearDeck);

    // 7. Racing GT Wing / Spoiler
    const wingGeo = new THREE.BoxGeometry(1.7, 0.04, 0.35);
    const wing = new THREE.Mesh(wingGeo, carbonMaterial);
    wing.position.set(0, 1.05, -1.8);
    wing.castShadow = true;
    this.carBody.add(wing);

    // Wing Struts (Supports)
    const strutGeo = new THREE.BoxGeometry(0.04, 0.3, 0.15);
    const leftStrut = new THREE.Mesh(strutGeo, carbonMaterial);
    leftStrut.position.set(-0.5, 0.85, -1.75);
    const rightStrut = new THREE.Mesh(strutGeo, carbonMaterial);
    rightStrut.position.set(0.5, 0.85, -1.75);
    this.carBody.add(leftStrut);
    this.carBody.add(rightStrut);

    // 8. Dual Exhaust Pipes
    const exhaustGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.25, 16);
    exhaustGeo.rotateX(Math.PI / 2);
    const exhaustLeft = new THREE.Mesh(exhaustGeo, chromeMaterial);
    exhaustLeft.position.set(-0.25, 0.24, -1.98);
    const exhaustRight = new THREE.Mesh(exhaustGeo, chromeMaterial);
    exhaustRight.position.set(0.25, 0.24, -1.98);
    this.carBody.add(exhaustLeft);
    this.carBody.add(exhaustRight);

    // 9. Wheels & Suspension Assembly
    this.buildWheels(carbonMaterial, chromeMaterial);

    // 10. Headlights & Spotlights
    this.setupHeadlights();

    // 11. Taillights & Brake lights
    this.setupTaillights();

    // 12. Neon Underglow
    this.setupUnderglow();

    this.scene.add(this.carRoot);
  }

  buildWheels(tireMat, rimMat) {
    const wheelRadius = 0.36;
    const wheelWidth = 0.24;

    const createWheelMesh = () => {
      const wheelGroup = new THREE.Group();

      // Tire Rubber
      const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      wheelGroup.add(tire);

      // Alloy Rim
      const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.72, wheelRadius * 0.72, wheelWidth + 0.01, 16);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wheelGroup.add(rim);

      // Brake Caliper (Red)
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

    const hGeo = new THREE.BoxGeometry(0.24, 0.08, 0.05);
    const hLeft = new THREE.Mesh(hGeo, headlightMat);
    hLeft.position.set(-0.55, 0.44, 2.0);
    this.carBody.add(hLeft);

    const hRight = new THREE.Mesh(hGeo, headlightMat);
    hRight.position.set(0.55, 0.44, 2.0);
    this.carBody.add(hRight);

    this.headlights = [hLeft, hRight];

    // Real dynamic SpotLights casting forward onto AR camera ground
    const createSpot = (x) => {
      const spot = new THREE.SpotLight(0xf0f8ff, 6, 18, Math.PI / 6, 0.4, 1.2);
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
      color: 0xaa0000,
      emissive: 0xff0022,
      emissiveIntensity: 1.0,
      roughness: 0.2
    });

    const tailGeo = new THREE.BoxGeometry(1.4, 0.06, 0.05);
    const tailMesh = new THREE.Mesh(tailGeo, this.taillightMaterial);
    tailMesh.position.set(0, 0.58, -1.98);
    this.carBody.add(tailMesh);
  }

  setupUnderglow() {
    this.underglowLight = new THREE.PointLight(0x00f3ff, 4, 3.5, 1.8);
    this.underglowLight.position.set(0, 0.12, 0);
    this.carBody.add(this.underglowLight);

    // Glowing emitter strip under the chassis
    const stripGeo = new THREE.PlaneGeometry(1.2, 2.4);
    this.underglowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const strip = new THREE.Mesh(stripGeo, this.underglowMaterial);
    strip.rotation.x = Math.PI / 2;
    strip.position.set(0, 0.08, 0);
    this.carBody.add(strip);
  }

  setupParticles() {
    // Tire smoke particle pool
    const smokeCount = 35;
    this.smokeGeo = new THREE.SphereGeometry(0.12, 6, 6);
    this.smokeMat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0
    });

    for (let i = 0; i < smokeCount; i++) {
      const p = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
      p.visible = false;
      this.scene.add(p);
      this.smokeParticles.push({
        mesh: p,
        life: 0,
        maxLife: 1.0,
        velocity: new THREE.Vector3()
      });
    }

    // Nitro flame particles
    const nitroCount = 20;
    const nitroGeo = new THREE.SphereGeometry(0.06, 6, 6);
    for (let i = 0; i < nitroCount; i++) {
      const np = new THREE.Mesh(nitroGeo, new THREE.MeshBasicMaterial({
        color: 0x00f3ff,
        transparent: true,
        opacity: 0
      }));
      np.visible = false;
      this.scene.add(np);
      this.nitroParticles.push({
        mesh: np,
        life: 0,
        maxLife: 0.4,
        velocity: new THREE.Vector3()
      });
    }
  }

  emitSmoke(pos, driftStrength = 1.0) {
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

  /**
   * Update Car 3D Transform and Visual Effects from Physics Engine
   */
  update(physics, dt) {
    if (!this.carRoot) return;

    // 1. Position & Heading
    this.carRoot.position.set(physics.x, 0, physics.z);
    this.carRoot.rotation.y = physics.heading;

    // Follow Reticle position follows car
    if (this.arReticleMesh) {
      this.arReticleMesh.position.x = physics.x;
      this.arReticleMesh.position.z = physics.z;
    }

    // 2. Steer Front Wheels Pivot
    if (this.frontLeftPivot && this.frontRightPivot) {
      this.frontLeftPivot.rotation.y = -physics.currentSteerAngle;
      this.frontRightPivot.rotation.y = -physics.currentSteerAngle;
    }

    // 3. Roll all 4 wheels based on speed
    const wheelRollSpeed = (physics.speed / 0.36) * dt;
    this.wheels.forEach(w => {
      w.rotation.x += wheelRollSpeed;
    });

    // 4. Suspension Dynamics (Pitch and Roll)
    // Pitch forward on braking, backward on acceleration
    const targetPitch = (physics.throttleInput > 0 ? -0.04 : 0.06 * Math.abs(physics.throttleInput)) * (Math.abs(physics.speed) > 1 ? 1 : 0.3);
    // Roll into turns
    const targetRoll = -physics.currentSteerAngle * (Math.abs(physics.speed) / physics.maxSpeedForward) * 0.15;

    this.carBody.rotation.x += (targetPitch - this.carBody.rotation.x) * 6 * dt;
    this.carBody.rotation.z += (targetRoll - this.carBody.rotation.z) * 6 * dt;

    // 5. Taillight / Brake light brightness
    if (this.taillightMaterial) {
      if (physics.throttleInput < -0.1 && physics.speed > 0.5) {
        // High intensity brake light
        this.taillightMaterial.emissiveIntensity = 3.5;
        this.taillightMaterial.emissive.setHex(0xff0022);
      } else if (physics.speed < -0.2) {
        // Reverse light (white-ish)
        this.taillightMaterial.emissiveIntensity = 2.0;
        this.taillightMaterial.emissive.setHex(0xffffff);
      } else {
        // Normal taillight
        this.taillightMaterial.emissiveIntensity = 1.0;
        this.taillightMaterial.emissive.setHex(0xff0022);
      }
    }

    // 6. Drift Smoke Emitter
    if (physics.isDrifting && Math.abs(physics.speed) > 3) {
      const carWorldPos = new THREE.Vector3();
      this.carRoot.getWorldPosition(carWorldPos);

      // Emit from rear left and rear right wheels
      this.emitSmoke(carWorldPos);
    }

    // Update active smoke particles
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

    // Camera Tracking Mode
    if (this.cameraTrackingMode === 'chase') {
      // Dynamic chaser cam follows behind car heading
      const camDist = 5.2 * this.currentScale;
      const camHeight = 2.4 * this.currentScale;
      const targetCamX = physics.x - Math.sin(physics.heading) * camDist;
      const targetCamZ = physics.z - Math.cos(physics.heading) * camDist;

      this.camera.position.x += (targetCamX - this.camera.position.x) * 4 * dt;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * 4 * dt;
      this.camera.position.y += (camHeight - this.camera.position.y) * 4 * dt;
      this.camera.lookAt(physics.x, 0.5 * this.currentScale, physics.z);
    } else {
      // Fixed AR Ground-Lock Mode: Perfect for true camera AR view
      this.camera.position.set(0, 3.2, 5.8);
      this.camera.lookAt(0, 0.3, 0);
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
      physics.resetPosition(hit.x, hit.z, physics.heading);
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
