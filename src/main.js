/**
 * AERO-RC // Master Application Orchestrator
 * Integrates Camera, Three.js AR Scene, Vehicle Physics, Web Audio Synthesizer,
 * UI Cockpit HUD, Fullscreen Controls, and Hardware IoT Bridge.
 */

import { sound } from './sound.js';
import { CameraManager } from './camera.js';
import { CarPhysics } from './physics.js';
import { ARCarScene } from './ar-car.js';
import { HardwareLink } from './hardware.js';

// DOM Elements
const videoEl = document.getElementById('camera-stream');
const fallbackEnvEl = document.getElementById('camera-fallback-env');
const arCanvasEl = document.getElementById('ar-canvas');
const reticleEl = document.getElementById('ar-reticle');

// Top Bar Elements
const btnStartAr = document.getElementById('btn-start-ar');
const welcomeOverlay = document.getElementById('welcome-overlay');
const trackingStatusEl = document.getElementById('tracking-status');
const btnFullscreen = document.getElementById('btn-fullscreen');
const iconFsEnter = document.getElementById('icon-fs-enter');
const iconFsExit = document.getElementById('icon-fs-exit');
const btnToggleHud = document.getElementById('btn-toggle-hud');
const iconEyeOpen = document.getElementById('icon-eye-open');
const iconEyeClosed = document.getElementById('icon-eye-closed');
const btnCameraFlip = document.getElementById('btn-camera-flip');
const btnRecenterCar = document.getElementById('btn-recenter-car');
const btnSnapshot = document.getElementById('btn-snapshot');
const btnCustomize = document.getElementById('btn-customize');
const btnSoundToggle = document.getElementById('btn-sound-toggle');
const iconSoundOn = document.getElementById('icon-sound-on');
const iconSoundOff = document.getElementById('icon-sound-off');
const btnHardware = document.getElementById('btn-hardware');

// HUD Telemetry Elements
const rpmBar = document.getElementById('rpm-bar');
const nitroBar = document.getElementById('nitro-bar');
const speedNumber = document.getElementById('speed-number');
const gearItems = document.querySelectorAll('.gear-item');
const steerAngleDisplay = document.getElementById('steer-angle-display');
const fpsCounter = document.getElementById('fps-counter');

// Action Buttons
const btnHeadlights = document.getElementById('btn-headlights');
const btnHorn = document.getElementById('btn-horn');
const btnDrift = document.getElementById('btn-drift');
const btnNitroBoost = document.getElementById('btn-nitro-boost');

// Pedals
const pedalGas = document.getElementById('pedal-gas');
const pedalBrake = document.getElementById('pedal-brake');

// Steering Elements
const joystickBase = document.getElementById('joystick-base');
const joystickHandle = document.getElementById('joystick-handle');
const virtualWheel = document.getElementById('virtual-wheel');
const gyroLine = document.getElementById('gyro-line');

const modeJoystickBtn = document.getElementById('mode-joystick');
const modeWheelBtn = document.getElementById('mode-wheel');
const modeGyroBtn = document.getElementById('mode-gyro');
const steeringJoystickContainer = document.getElementById('steering-joystick-container');
const steeringWheelContainer = document.getElementById('steering-wheel-container');
const gyroContainer = document.getElementById('gyro-indicator-container');

// Modals
const customModal = document.getElementById('customization-modal');
const btnCloseCustomize = document.getElementById('btn-close-customize');
const hardwareModal = document.getElementById('hardware-modal');
const btnCloseHardware = document.getElementById('btn-close-hardware');
const snapshotModal = document.getElementById('snapshot-preview-modal');
const btnCloseSnapshot = document.getElementById('btn-close-snapshot');
const snapshotImg = document.getElementById('snapshot-img');
const btnDownloadPhoto = document.getElementById('btn-download-photo');
const btnRetakePhoto = document.getElementById('btn-retake-photo');

// Hardware Links
const btnBleConnect = document.getElementById('btn-ble-connect');
const btnWsConnect = document.getElementById('btn-ws-connect');
const wsUrlInput = document.getElementById('ws-url-input');
const hwTelemetryLog = document.getElementById('hw-telemetry-log');

// Initialize Core Subsystems
const cameraManager = new CameraManager(videoEl, fallbackEnvEl);
const physics = new CarPhysics();
const arScene = new ARCarScene(arCanvasEl);
const hardware = new HardwareLink(hwTelemetryLog);

// Input State
const keyboardState = {
  w: false,
  s: false,
  a: false,
  d: false,
  space: false,
  shift: false
};

let currentSteerMode = 'joystick';
let isAppStarted = false;
let isCleanView = false;

// FPS tracking
let frameCount = 0;
let lastFpsUpdate = performance.now();

// ==========================================================================
// Fullscreen & Screen Orientation Management
// ==========================================================================

function toggleFullscreen() {
  const doc = window.document;
  const docEl = doc.documentElement;

  const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);

  if (!isFs) {
    const rfs = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
    if (rfs) {
      rfs.call(docEl).catch(err => console.log('Fullscreen request note:', err));
    }
    // Attempt landscape orientation lock on smartphones if supported
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } else {
    const cfs = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
    if (cfs) {
      cfs.call(doc).catch(err => console.log('Exit fullscreen note:', err));
    }
  }
}

function updateFullscreenUI() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
  if (iconFsEnter && iconFsExit) {
    iconFsEnter.classList.toggle('hidden', isFs);
    iconFsExit.classList.toggle('hidden', !isFs);
  }
}

document.addEventListener('fullscreenchange', updateFullscreenUI);
document.addEventListener('webkitfullscreenchange', updateFullscreenUI);
if (btnFullscreen) {
  btnFullscreen.addEventListener('click', () => {
    sound.playClick();
    toggleFullscreen();
  });
}

// Clean View Toggle (Hides secondary chrome so you can see your room & car 100% unobstructed)
if (btnToggleHud) {
  btnToggleHud.addEventListener('click', () => {
    sound.playClick();
    isCleanView = !isCleanView;
    document.body.classList.toggle('minimal-hud', isCleanView);
    if (iconEyeOpen && iconEyeClosed) {
      iconEyeOpen.classList.toggle('hidden', isCleanView);
      iconEyeClosed.classList.toggle('hidden', !isCleanView);
    }
  });
}

// ==========================================================================
// Initialization & Camera Startup
// ==========================================================================

btnStartAr.addEventListener('click', async () => {
  welcomeOverlay.classList.add('hidden');
  sound.init();
  sound.resume();

  // Try auto fullscreen on mobile launch for best immersion
  toggleFullscreen();

  const cameraStarted = await cameraManager.startCamera();
  if (cameraStarted) {
    trackingStatusEl.innerHTML = `
      <span class="status-dot green"></span>
      <span class="status-text">AR ACTIVE</span>
    `;
  } else {
    trackingStatusEl.innerHTML = `
      <span class="status-dot amber"></span>
      <span class="status-text">VIRTUAL AR</span>
    `;
  }

  isAppStarted = true;
});

// Sound Toggle
btnSoundToggle.addEventListener('click', () => {
  const isMuted = sound.toggleMute();
  iconSoundOn.classList.toggle('hidden', isMuted);
  iconSoundOff.classList.toggle('hidden', !isMuted);
});

// Flip Camera
btnCameraFlip.addEventListener('click', async () => {
  sound.playClick();
  await cameraManager.flipCamera();
});

// Recenter Car
btnRecenterCar.addEventListener('click', () => {
  sound.playClick();
  physics.resetPosition(0, 0, 0);
  reticleEl.classList.remove('hidden');
  setTimeout(() => reticleEl.classList.add('hidden'), 2000);
});

// Snapshot Capture
btnSnapshot.addEventListener('click', () => {
  sound.playClick();
  const dataUrl = cameraManager.captureSnapshot(arCanvasEl);
  snapshotImg.src = dataUrl;
  btnDownloadPhoto.href = dataUrl;
  snapshotModal.classList.remove('hidden');
});

btnCloseSnapshot.addEventListener('click', () => snapshotModal.classList.add('hidden'));
btnRetakePhoto.addEventListener('click', () => snapshotModal.classList.add('hidden'));

// Customization Modal
btnCustomize.addEventListener('click', () => {
  sound.playClick();
  customModal.classList.remove('hidden');
});
btnCloseCustomize.addEventListener('click', () => customModal.classList.add('hidden'));

// Hardware Modal
if (btnHardware) {
  btnHardware.addEventListener('click', () => {
    sound.playClick();
    hardwareModal.classList.remove('hidden');
  });
}
btnCloseHardware.addEventListener('click', () => hardwareModal.classList.add('hidden'));

btnBleConnect.addEventListener('click', async () => {
  sound.playClick();
  await hardware.connectBLE();
});

btnWsConnect.addEventListener('click', () => {
  sound.playClick();
  const url = wsUrlInput.value.trim() || 'ws://192.168.4.1:81';
  hardware.connectWebSocket(url);
});

// ==========================================================================
// Customization Handlers (Paint, Underglow, Scale, Filters, Camera View)
// ==========================================================================

// Paint Color
document.querySelectorAll('#color-palette .color-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#color-palette .color-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const color = chip.dataset.color;
    arScene.setCarPaint(color);
    sound.playClick();
  });
});

// Underglow Color
document.querySelectorAll('#underglow-palette .color-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#underglow-palette .color-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const color = chip.dataset.underglow;
    arScene.setUnderglowColor(color);
    sound.playClick();
  });
});

// Scale Presets
document.querySelectorAll('.scale-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const scale = parseFloat(btn.dataset.scale);
    arScene.setScale(scale);
    physics.boundaryRadius = 14 * scale;
    physics.wheelBase = 1.6 * scale;
    document.getElementById('car-scale-readout').textContent = btn.textContent;
    sound.playClick();
  });
});

// Camera Filters
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    document.body.className = '';
    if (filter !== 'normal') {
      document.body.classList.add(`filter-${filter}`);
    }
    sound.playClick();
  });
});

// Camera View Mode (Ground Lock AR vs Chase Cam)
document.querySelectorAll('.cam-view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cam-view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const viewMode = btn.dataset.view;
    arScene.cameraTrackingMode = viewMode;
    sound.playClick();
  });
});

// ==========================================================================
// Quick Cockpit Action Buttons
// ==========================================================================

// Headlights
btnHeadlights.addEventListener('click', () => {
  sound.playClick();
  const on = arScene.setHeadlights(!arScene.areHeadlightsOn);
  btnHeadlights.classList.toggle('active', on);
});

// Horn
const startHorn = () => sound.setHorn(true);
const stopHorn = () => sound.setHorn(false);

btnHorn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  startHorn();
});
window.addEventListener('pointerup', stopHorn);
window.addEventListener('pointercancel', stopHorn);

// Drift Button
const startDrift = () => {
  physics.handbrake = true;
  btnDrift.classList.add('active');
};
const stopDrift = () => {
  physics.handbrake = false;
  btnDrift.classList.remove('active');
};

btnDrift.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  startDrift();
});
window.addEventListener('pointerup', stopDrift);

// Nitro Boost Button
const startNitro = () => {
  physics.nitroActive = true;
  btnNitroBoost.classList.add('active');
  sound.playNitroSound();
};
const stopNitro = () => {
  physics.nitroActive = false;
  btnNitroBoost.classList.remove('active');
};

btnNitroBoost.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  startNitro();
});
window.addEventListener('pointerup', stopNitro);

// ==========================================================================
// Pedals (Gas & Brake/Reverse) - Multi-touch Friendly
// ==========================================================================

pedalGas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  pedalGas.classList.add('pressed');
  physics.throttleInput = 1.0;
});
window.addEventListener('pointerup', () => {
  pedalGas.classList.remove('pressed');
  if (!keyboardState.w && !keyboardState.s) {
    physics.throttleInput = 0;
  }
});

pedalBrake.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  pedalBrake.classList.add('pressed');
  physics.throttleInput = -1.0;
});
window.addEventListener('pointerup', () => {
  pedalBrake.classList.remove('pressed');
  if (!keyboardState.w && !keyboardState.s) {
    physics.throttleInput = 0;
  }
});

// ==========================================================================
// Touch Joystick Steering - Multi-Touch Pointer Capture
// ==========================================================================

let joystickActive = false;
let joystickPointerId = null;
let joystickCenter = { x: 0, y: 0 };
const maxJoystickRadius = 45;

const onJoystickStart = (e) => {
  e.preventDefault();
  joystickActive = true;
  joystickPointerId = e.pointerId;

  if (joystickBase.setPointerCapture) {
    joystickBase.setPointerCapture(e.pointerId);
  }

  const rect = joystickBase.getBoundingClientRect();
  joystickCenter = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
  onJoystickMove(e);
};

const onJoystickMove = (e) => {
  if (!joystickActive || (joystickPointerId !== null && e.pointerId !== joystickPointerId)) return;

  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);

  let deltaX = clientX - joystickCenter.x;
  let deltaY = clientY - joystickCenter.y;
  const dist = Math.hypot(deltaX, deltaY);

  if (dist > maxJoystickRadius) {
    deltaX = (deltaX / dist) * maxJoystickRadius;
    deltaY = (deltaY / dist) * maxJoystickRadius;
  }

  joystickHandle.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

  // Normalized steer value (-1 to +1)
  const steerNorm = deltaX / maxJoystickRadius;
  physics.steerInput = steerNorm;

  updateSteerReadout(physics.currentSteerAngle);
};

const onJoystickEnd = (e) => {
  if (!joystickActive || (joystickPointerId !== null && e.pointerId !== joystickPointerId)) return;
  joystickActive = false;
  joystickPointerId = null;

  if (joystickBase.releasePointerCapture && e.pointerId) {
    try { joystickBase.releasePointerCapture(e.pointerId); } catch (err) {}
  }

  joystickHandle.style.transform = 'translate(0px, 0px)';
  if (!keyboardState.a && !keyboardState.d) {
    physics.steerInput = 0;
  }
};

joystickBase.addEventListener('pointerdown', onJoystickStart);
window.addEventListener('pointermove', onJoystickMove);
window.addEventListener('pointerup', onJoystickEnd);
window.addEventListener('pointercancel', onJoystickEnd);

// ==========================================================================
// Virtual Steering Wheel Implementation
// ==========================================================================

let wheelActive = false;
let wheelCenter = { x: 0, y: 0 };

const onWheelStart = (e) => {
  e.preventDefault();
  wheelActive = true;
  const rect = virtualWheel.getBoundingClientRect();
  wheelCenter = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
  onWheelMove(e);
};

const onWheelMove = (e) => {
  if (!wheelActive) return;
  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);

  const angleRad = Math.atan2(clientX - wheelCenter.x, -(clientY - wheelCenter.y));
  const maxWheelTurn = Math.PI * 0.7;
  const clampedAngle = Math.max(-maxWheelTurn, Math.min(maxWheelTurn, angleRad));

  virtualWheel.style.transform = `rotate(${clampedAngle * (180 / Math.PI)}deg)`;
  physics.steerInput = clampedAngle / maxWheelTurn;
};

const onWheelEnd = () => {
  if (!wheelActive) return;
  wheelActive = false;
  virtualWheel.style.transform = 'rotate(0deg)';
  if (!keyboardState.a && !keyboardState.d) {
    physics.steerInput = 0;
  }
};

virtualWheel.addEventListener('pointerdown', onWheelStart);
window.addEventListener('pointermove', onWheelMove);
window.addEventListener('pointerup', onWheelEnd);

// ==========================================================================
// DeviceOrientation (Gyro Tilt) Mode
// ==========================================================================

const handleOrientation = (e) => {
  if (currentSteerMode !== 'gyro') return;
  const gamma = e.gamma || 0;
  const maxTilt = 28;
  const steerNorm = Math.max(-1, Math.min(1, gamma / maxTilt));
  physics.steerInput = steerNorm;

  if (gyroLine) {
    gyroLine.style.transform = `rotate(${steerNorm * 35}deg)`;
  }
};

modeJoystickBtn.addEventListener('click', () => switchSteerMode('joystick'));
modeWheelBtn.addEventListener('click', () => switchSteerMode('wheel'));
modeGyroBtn.addEventListener('click', async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm === 'granted') {
        window.addEventListener('deviceorientation', handleOrientation);
      }
    } catch (e) {
      console.warn('Orientation permission error:', e);
    }
  } else {
    window.addEventListener('deviceorientation', handleOrientation);
  }
  switchSteerMode('gyro');
});

function switchSteerMode(mode) {
  currentSteerMode = mode;
  modeJoystickBtn.classList.toggle('active', mode === 'joystick');
  modeWheelBtn.classList.toggle('active', mode === 'wheel');
  modeGyroBtn.classList.toggle('active', mode === 'gyro');

  steeringJoystickContainer.classList.toggle('hidden', mode !== 'joystick');
  steeringWheelContainer.classList.toggle('hidden', mode !== 'wheel');
  gyroContainer.classList.toggle('hidden', mode !== 'gyro');
}

function updateSteerReadout(radians) {
  if (!steerAngleDisplay) return;
  const degrees = (radians * (180 / Math.PI)).toFixed(1);
  steerAngleDisplay.textContent = `${degrees > 0 ? '+' : ''}${degrees}°`;
}

// ==========================================================================
// Keyboard Controls (WASD / Arrows / Space / Shift / H / L)
// ==========================================================================

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  sound.resume();

  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      keyboardState.w = true;
      physics.throttleInput = 1.0;
      pedalGas.classList.add('pressed');
      break;
    case 'KeyS':
    case 'ArrowDown':
      keyboardState.s = true;
      physics.throttleInput = -1.0;
      pedalBrake.classList.add('pressed');
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keyboardState.a = true;
      physics.steerInput = -1.0;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keyboardState.d = true;
      physics.steerInput = 1.0;
      break;
    case 'Space':
      keyboardState.space = true;
      startDrift();
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      keyboardState.shift = true;
      startNitro();
      break;
    case 'KeyH':
      startHorn();
      break;
    case 'KeyL':
      btnHeadlights.click();
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      keyboardState.w = false;
      if (keyboardState.s) {
        physics.throttleInput = -1.0;
      } else {
        physics.throttleInput = 0;
        pedalGas.classList.remove('pressed');
      }
      break;
    case 'KeyS':
    case 'ArrowDown':
      keyboardState.s = false;
      if (keyboardState.w) {
        physics.throttleInput = 1.0;
      } else {
        physics.throttleInput = 0;
        pedalBrake.classList.remove('pressed');
      }
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keyboardState.a = false;
      physics.steerInput = keyboardState.d ? 1.0 : 0;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keyboardState.d = false;
      physics.steerInput = keyboardState.a ? -1.0 : 0;
      break;
    case 'Space':
      keyboardState.space = false;
      stopDrift();
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      keyboardState.shift = false;
      stopNitro();
      break;
    case 'KeyH':
      stopHorn();
      break;
  }
});

// ==========================================================================
// Gamepad API Support (Xbox / PlayStation Controllers)
// ==========================================================================

function pollGamepad() {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = gamepads[0];
  if (!gp) return;

  if (Math.abs(gp.axes[0]) > 0.15) {
    physics.steerInput = gp.axes[0];
  }

  const gasVal = (gp.buttons[7] ? gp.buttons[7].value : 0) || (gp.buttons[0] && gp.buttons[0].pressed ? 1 : 0);
  const brakeVal = (gp.buttons[6] ? gp.buttons[6].value : 0) || (gp.buttons[1] && gp.buttons[1].pressed ? 1 : 0);

  if (gasVal > 0.1) {
    physics.throttleInput = gasVal;
    pedalGas.classList.add('pressed');
  } else if (brakeVal > 0.1) {
    physics.throttleInput = -brakeVal;
    pedalBrake.classList.add('pressed');
  } else if (!keyboardState.w && !keyboardState.s) {
    pedalGas.classList.remove('pressed');
    pedalBrake.classList.remove('pressed');
  }

  if (gp.buttons[2] && gp.buttons[2].pressed) {
    startDrift();
  }

  if (gp.buttons[5] && gp.buttons[5].pressed) {
    startNitro();
  }
}

// ==========================================================================
// Tap-to-Place Car in AR
// ==========================================================================

arCanvasEl.addEventListener('click', (e) => {
  if (e.target.closest('#hud-interface button') || e.target.closest('.thumb-cluster') || e.target.closest('.hud-topbar')) return;

  const placed = arScene.placeCarAtScreenCoords(e.clientX, e.clientY, physics);
  if (placed) {
    reticleEl.classList.remove('hidden');
    setTimeout(() => reticleEl.classList.add('hidden'), 1200);
  }
});

// ==========================================================================
// Main Render & Simulation Loop
// ==========================================================================

let lastTickTime = performance.now();

function animate(currentTime) {
  requestAnimationFrame(animate);

  const dt = Math.min((currentTime - lastTickTime) / 1000, 0.1);
  lastTickTime = currentTime;

  pollGamepad();

  // 1. Physics Engine Update
  physics.update(dt);

  // 2. Sound Engine Update
  sound.update(physics.rpm, Math.abs(physics.throttleInput), physics.isDrifting);

  // 3. 3D Scene Update
  arScene.update(physics, dt);

  // 4. Hardware Telemetry Broadcast
  hardware.sendControlFrame(
    physics.throttleInput,
    physics.steerInput,
    arScene.areHeadlightsOn,
    sound.isHornActive,
    physics.nitroActive
  );

  // 5. Update HUD Displays
  updateHUD(physics);

  // 6. FPS Tracking
  frameCount++;
  if (currentTime - lastFpsUpdate >= 1000) {
    const fps = Math.round((frameCount * 1000) / (currentTime - lastFpsUpdate));
    if (fpsCounter) fpsCounter.textContent = fps;
    frameCount = 0;
    lastFpsUpdate = currentTime;
  }
}

function updateHUD(phys) {
  // Speedometer (KM/H)
  const displaySpeed = Math.round(phys.speedKmh);
  if (speedNumber) speedNumber.textContent = displaySpeed.toString().padStart(2, '0');

  // RPM Mini Bar
  if (rpmBar) {
    const rpmPercent = Math.min(100, Math.max(0, ((phys.rpm - 1000) / 7200) * 100));
    rpmBar.style.width = `${rpmPercent}%`;
  }

  // Nitro Mini Bar
  if (nitroBar) {
    nitroBar.style.width = `${phys.nitroEnergy}%`;
  }

  // Gear Indicator
  gearItems.forEach(item => {
    item.classList.toggle('active', item.dataset.gear === phys.gear);
  });

  // Steer Angle display
  updateSteerReadout(phys.currentSteerAngle);
}

// Start Main Loop
requestAnimationFrame(animate);
