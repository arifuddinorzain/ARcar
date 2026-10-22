# 🏎️ AERO-RC // AR Car Remote Control & Cockpit

A high-performance Augmented Reality (AR) remote control web application that turns your device camera into a real-time 3D racing arena with glassmorphic cockpit HUD controls, physics simulation, procedural engine audio, and IoT hardware connectivity.

---

## 🌟 Key Features

### 1. 📹 Real-Time AR Camera View
- **Augmented Reality Feed**: Direct integration with device cameras (`facingMode: environment` on mobile, webcam on desktop).
- **Ground-Lock Shadow Plane**: Realistic vehicle contact shadows rendered over the live camera floor feed.
- **Camera Flip & Torch**: Switch between rear/front cameras and toggle flashlight/torch on mobile.
- **Virtual Fallback Environment**: If camera is unavailable or denied, a sleek cyberpunk horizon with 3D grid floor launches automatically.
- **AR Snapshot**: Take high-resolution photos compositing the live camera feed, 3D car, and telemetry watermark.
- **Tap-to-Place**: Tap or click anywhere on the AR camera view to place or reposition the car.

### 2. 🕹️ Dual Controller Cockpit
- **Virtual Touch Joystick**: Multi-touch spring-centered analog joystick for responsive steering.
- **Virtual Steering Wheel**: Drag to turn with real-time wheel angle indicators.
- **Gyroscope Tilt Control**: Tilt your smartphone left and right to steer using device orientation sensors.
- **Drive Pedals**: Responsive Gas (accelerator) and Brake/Reverse pedals with tactile feedback.
- **Nitro Boost**: Hit Nitro for extra acceleration with glowing particle trails and exhaust flame.
- **Handbrake / Drift**: Pull the handbrake for realistic drift slides, tire smoke particles, and screech sound effects.
- **Dynamic Headlights**: Toggle dual high-intensity SpotLights that illuminate the physical floor in front of the car.
- **Dual-Tone Horn**: Procedural synthesizer car horn honk.

### 3. ⌨️ Multiple Input Methods
- **Keyboard (WASD / Arrows)**:
  - `W` / `↑`: Accelerate Forward
  - `S` / `↓`: Brake / Reverse
  - `A` / `←`: Steer Left
  - `D` / `→`: Steer Right
  - `Space`: Handbrake / Drift
  - `Shift`: Nitro Boost
  - `H`: Horn
  - `L`: Toggle Headlights
- **Gamepad API**: Plug and play Xbox / PlayStation controllers (Left stick steer, triggers for throttle/brake).

### 4. 🔊 Web Audio Procedural Sound Engine
- Zero external audio files required! 100% synthesized in real time via Web Audio API:
  - Dynamic engine pitch and rumble mapped to RPM and throttle.
  - Multi-gear RPM simulation (idle at 1,000 RPM up to 8,200 RPM redline).
  - High-frequency tire drift screech when sliding.
  - Turbo blow-off valve and Nitro boost sound.

### 5. 🎨 Car Customization Lab
- **Paint Finish**: Cyber Cyan, Neon Crimson, Solar Gold, Acid Green, Ultra Violet, Stealth Carbon, Pearl White.
- **Underglow Neon**: RGB under-chassis glow illuminating the ground beneath the car.
- **AR Scale**: 1:18 Desk scale, 1:10 Standard RC scale, 1:5 Large scale.
- **HUD Filters**: Normal, Night Vision (green phosphor with scanlines), Cyberpunk HUD.
- **Camera Mode**: Ground Locked (Authentic AR) or Chaser Cam (Follows behind car).

### 6. ⚡ Hardware RC Car IoT Link (Optional)
- **Web Bluetooth (BLE UART)**: Direct connection to ESP32, Arduino, or micro:bit RC cars.
- **WebSocket (WiFi)**: Connect to ESP32-CAM or network RC cars to transmit live control packets:
  `RC,T:<throttle>,S:<steer>,L:<lights>,H:<horn>,N:<nitro>\n`

---

## 🚀 Running the Project

```bash
# Start local development server
npm run dev

# Or build for production
npm run build
npm run preview
```

Open `http://localhost:5173/` in your browser (Google Chrome, Edge, Safari, or Chrome on Android).
