/**
 * AERO-RC // Vehicle Physics & Input Controller
 * Handles arcade RC car dynamics, drift slip-angle mechanics, nitro boost,
 * and unified input mapping (Touch Joystick, Pedals, Gyro, Keyboard, Gamepad).
 */

export class CarPhysics {
  constructor() {
    // Spatial state
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.heading = 0; // Rotation around Y axis in radians
    this.speed = 0;   // In m/s (1 m/s = 3.6 km/h)
    this.lateralVelocity = 0; // Sideways slip velocity for drifting
    this.isDrifting = false;

    // Dynamics parameters
    this.maxSpeedForward = 22; // ~80 km/h
    this.maxSpeedNitro = 34;   // ~122 km/h
    this.maxSpeedReverse = 8;  // ~29 km/h
    this.acceleration = 18;    // m/s^2
    this.nitroAcceleration = 30;
    this.brakingForce = 32;
    this.friction = 3.5;       // Natural deceleration
    this.maxSteerAngle = 0.58; // ~33 degrees in radians
    this.steerSpeed = 3.2;     // How quickly wheels turn
    this.steerReturnSpeed = 4.5;
    this.wheelBase = 1.6;      // Virtual wheelbase

    // Inputs (-1.0 to 1.0)
    this.throttleInput = 0;
    this.steerInput = 0;
    this.handbrake = false;
    this.nitroActive = false;

    // Current steer angle of front wheels
    this.currentSteerAngle = 0;

    // Nitro system
    this.nitroEnergy = 100; // 0 to 100
    this.nitroConsumptionRate = 35; // % per second
    this.nitroRechargeRate = 12;

    // Telemetry values for HUD
    this.speedKmh = 0;
    this.rpm = 1000;
    this.gear = 'P';

    // Boundary constraint radius (meters)
    this.boundaryRadius = 14;
  }

  /**
   * Main Physics Tick
   * @param {number} dt Delta time in seconds
   */
  update(dt) {
    // 1. Process Nitro state
    let isBoosting = false;
    if (this.nitroActive && this.nitroEnergy > 5 && this.throttleInput > 0.1) {
      isBoosting = true;
      this.nitroEnergy = Math.max(0, this.nitroEnergy - this.nitroConsumptionRate * dt);
    } else {
      this.nitroEnergy = Math.min(100, this.nitroEnergy + this.nitroRechargeRate * dt);
    }

    // 2. Determine target max speed and acceleration
    const currentMaxSpeed = isBoosting ? this.maxSpeedNitro : this.maxSpeedForward;
    const currentAccel = isBoosting ? this.nitroAcceleration : this.acceleration;

    // 3. Update throttle & velocity
    if (this.throttleInput > 0.05) {
      // Accelerate forward
      if (this.speed < 0) {
        // Braking while in reverse
        this.speed += this.brakingForce * dt;
      } else {
        this.speed += this.throttleInput * currentAccel * dt;
        if (this.speed > currentMaxSpeed) {
          this.speed = currentMaxSpeed;
        }
      }
    } else if (this.throttleInput < -0.05) {
      // Brake or Reverse
      if (this.speed > 0.5) {
        // Active brake
        this.speed += this.throttleInput * this.brakingForce * dt;
        if (this.speed < 0) this.speed = 0;
      } else {
        // Reverse
        this.speed += this.throttleInput * (this.acceleration * 0.7) * dt;
        if (this.speed < -this.maxSpeedReverse) {
          this.speed = -this.maxSpeedReverse;
        }
      }
    } else {
      // Coasting friction
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.friction * dt);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.friction * dt);
      }
    }

    // Handbrake applied
    if (this.handbrake) {
      if (Math.abs(this.speed) > 1) {
        this.speed *= Math.max(0, 1 - 2.8 * dt);
      }
    }

    // 4. Update Steering Angle smoothly
    const targetSteerAngle = this.steerInput * this.maxSteerAngle;
    if (Math.abs(this.steerInput) > 0.02) {
      // Turning towards input
      this.currentSteerAngle += (targetSteerAngle - this.currentSteerAngle) * this.steerSpeed * dt;
    } else {
      // Return to center
      this.currentSteerAngle += (0 - this.currentSteerAngle) * this.steerReturnSpeed * dt;
    }

    // 5. Update Heading & Yaw rate
    // Reverse turning logic inverted for realistic steering
    const speedFactor = this.speed >= 0 ? 1 : -1;
    const turnRadiusRate = (Math.abs(this.speed) / this.wheelBase) * Math.sin(this.currentSteerAngle);
    
    // Check drift conditions: high speed + sharp turn OR handbrake held
    const isDriftIntent = (this.handbrake && Math.abs(this.speed) > 4) || 
                          (Math.abs(this.speed) > 12 && Math.abs(this.currentSteerAngle) > 0.35);

    if (isDriftIntent) {
      this.isDrifting = true;
      // Oversteer yaw multiplier
      this.heading -= turnRadiusRate * 1.8 * speedFactor * dt;
      // Accumulate lateral slip velocity
      this.lateralVelocity += Math.sin(this.currentSteerAngle) * Math.abs(this.speed) * 0.45;
    } else {
      this.isDrifting = false;
      this.heading -= turnRadiusRate * speedFactor * dt;
      // Lateral friction dampens slip
      this.lateralVelocity *= Math.max(0, 1 - 10 * dt);
    }

    // 6. Integrate movement vector in 3D world space
    // Car forward vector
    const forwardX = Math.sin(this.heading);
    const forwardZ = Math.cos(this.heading);

    // Car lateral (side) vector for drift slip
    const rightX = Math.cos(this.heading);
    const rightZ = -Math.sin(this.heading);

    this.x += (forwardX * this.speed + rightX * this.lateralVelocity) * dt;
    this.z += (forwardZ * this.speed + rightZ * this.lateralVelocity) * dt;

    // 7. Soft Boundary Check (keeps car in view)
    const distFromOrigin = Math.hypot(this.x, this.z);
    if (distFromOrigin > this.boundaryRadius) {
      const angle = Math.atan2(this.x, this.z);
      this.x = Math.sin(angle) * this.boundaryRadius;
      this.z = Math.cos(angle) * this.boundaryRadius;
      this.speed *= -0.3; // Rebound bounce
    }

    // 8. Calculate HUD Telemetry (KM/H, RPM, Gear)
    this.speedKmh = Math.abs(this.speed * 3.6);

    if (Math.abs(this.speed) < 0.2) {
      this.gear = 'P';
      this.rpm = 1000 + Math.abs(this.throttleInput) * 4500;
    } else if (this.speed < -0.2) {
      this.gear = 'R';
      this.rpm = 1000 + (Math.abs(this.speed) / this.maxSpeedReverse) * 4000;
    } else {
      this.gear = isBoosting ? 'S' : 'D';
      // Multi-ratio RPM simulation
      const baseRatio = (this.speed / currentMaxSpeed);
      const gearCycle = (baseRatio * 3.2) % 1;
      this.rpm = 1800 + gearCycle * 5400 + (isBoosting ? 800 : 0);
    }
  }

  /**
   * Teleport/recenter car back to origin or given coordinate
   */
  resetPosition(x = 0, z = 0, heading = 0) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.lateralVelocity = 0;
    this.currentSteerAngle = 0;
    this.isDrifting = false;
  }
}
