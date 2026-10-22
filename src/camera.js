/**
 * AERO-RC // Camera & AR Video Feed Manager
 * Handles camera stream acquisition, facing mode flip, torch toggle, snapshot composite, and fallback environments.
 */

export class CameraManager {
  constructor(videoElement, fallbackElement) {
    this.video = videoElement;
    this.fallbackEnv = fallbackElement;
    this.stream = null;
    this.facingMode = 'environment'; // 'environment' or 'user'
    this.isTorchOn = false;
    this.isCameraActive = false;
  }

  /**
   * Initializes camera stream
   * @returns {Promise<boolean>} success
   */
  async startCamera() {
    // Stop any existing stream
    this.stopCamera();

    const constraints = {
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available in this browser context');
      }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await this.video.play();
      
      this.isCameraActive = true;
      if (this.fallbackEnv) {
        this.fallbackEnv.classList.add('hidden');
      }

      // Mirror video if front-facing
      if (this.facingMode === 'user') {
        this.video.style.transform = 'scaleX(-1)';
      } else {
        this.video.style.transform = 'scaleX(1)';
      }

      return true;
    } catch (err) {
      console.warn('Camera could not be started, activating virtual AR environment:', err);
      this.isCameraActive = false;
      if (this.fallbackEnv) {
        this.fallbackEnv.classList.remove('hidden');
      }
      return false;
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.isCameraActive = false;
  }

  /**
   * Toggle between front and rear cameras
   */
  async flipCamera() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    return await this.startCamera();
  }

  /**
   * Toggle camera flashlight/torch if supported
   */
  async toggleTorch() {
    if (!this.stream) return false;
    const track = this.stream.getVideoTracks()[0];
    if (!track) return false;

    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    if (!capabilities.torch) {
      console.log('Torch is not supported on this device/camera.');
      return false;
    }

    try {
      this.isTorchOn = !this.isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: this.isTorchOn }]
      });
      return this.isTorchOn;
    } catch (e) {
      console.warn('Could not toggle torch:', e);
      return false;
    }
  }

  /**
   * Captures a composite photo of the camera background + 3D Three.js canvas
   * @param {HTMLCanvasElement} threeCanvas
   * @returns {string} dataURL
   */
  captureSnapshot(threeCanvas) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const ctx = offscreenCanvas.getContext('2d');

    // 1. Draw camera video background if active
    if (this.isCameraActive && this.video.videoWidth > 0) {
      // Calculate aspect ratio cover fit
      const vW = this.video.videoWidth;
      const vH = this.video.videoHeight;
      const vAspect = vW / vH;
      const sAspect = width / height;

      let drawW, drawH, drawX, drawY;
      if (vAspect > sAspect) {
        drawH = height;
        drawW = height * vAspect;
        drawX = (width - drawW) / 2;
        drawY = 0;
      } else {
        drawW = width;
        drawH = width / vAspect;
        drawX = 0;
        drawY = (height - drawH) / 2;
      }

      ctx.save();
      if (this.facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(this.video, -drawX - drawW, drawY, drawW, drawH);
      } else {
        ctx.drawImage(this.video, drawX, drawY, drawW, drawH);
      }
      ctx.restore();
    } else {
      // Draw sleek dark gradient if virtual AR floor
      const grad = ctx.createRadialGradient(width / 2, height * 0.3, 50, width / 2, height * 0.5, width);
      grad.addColorStop(0, '#161e38');
      grad.addColorStop(1, '#05070c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Draw 3D AR WebGL Canvas over video
    if (threeCanvas) {
      ctx.drawImage(threeCanvas, 0, 0, width, height);
    }

    // 3. Add sleek AERO-RC Watermark stamp
    ctx.font = 'bold 16px "Orbitron", sans-serif';
    ctx.fillStyle = 'rgba(0, 243, 255, 0.85)';
    ctx.fillText('AERO-RC // AR DRIVE', 24, height - 24);

    const now = new Date();
    ctx.font = '12px "Rajdhani", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(now.toLocaleDateString() + ' ' + now.toLocaleTimeString(), width - 180, height - 24);

    return offscreenCanvas.toDataURL('image/png');
  }
}
