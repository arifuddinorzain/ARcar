/**
 * AERO-RC // Hardware Link Manager
 * Bridges the web dashboard with real physical RC cars via Web Bluetooth (BLE) or WebSocket (ESP32 / WiFi).
 */

// Standard Nordic BLE UART Service & Characteristic UUIDs
const BLE_UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_UART_TX_CHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Write
const BLE_UART_RX_CHAR = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Notify

export class HardwareLink {
  constructor(logElement) {
    this.logEl = logElement;
    this.bleDevice = null;
    this.txCharacteristic = null;
    this.ws = null;
    this.isConnected = false;
    this.linkType = null; // 'ble' or 'ws'

    this.lastPacketTime = 0;
    this.packetInterval = 50; // 20 Hz transmission to prevent radio flooding
  }

  log(msg) {
    if (this.logEl) {
      const time = new Date().toLocaleTimeString();
      this.logEl.textContent = `[${time}] ${msg}\n` + this.logEl.textContent.slice(0, 500);
    }
    console.log(`[HardwareLink] ${msg}`);
  }

  /**
   * Connect via Web Bluetooth to BLE RC car (ESP32 / Arduino / micro:bit)
   */
  async connectBLE() {
    if (!navigator.bluetooth) {
      this.log('ERROR: Web Bluetooth API is not supported in this browser. Try Google Chrome or Edge.');
      alert('Web Bluetooth is supported in Chrome, Edge, and Android Chrome. Please ensure Bluetooth is enabled.');
      return false;
    }

    try {
      this.log('Scanning for Bluetooth RC Car devices...');
      this.bleDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [BLE_UART_SERVICE]
      });

      this.log(`Connecting to GATT Server: ${this.bleDevice.name || 'RC-CAR'}...`);
      const server = await this.bleDevice.gatt.connect();

      this.log('Discovering UART Service...');
      const service = await server.getPrimaryService(BLE_UART_SERVICE);

      this.log('Binding TX characteristic...');
      this.txCharacteristic = await service.getCharacteristic(BLE_UART_TX_CHAR);

      this.isConnected = true;
      this.linkType = 'ble';
      this.log(`CONNECTED: ${this.bleDevice.name || 'RC-CAR'} via Bluetooth.`);
      return true;
    } catch (err) {
      this.log(`BLE Connection Error: ${err.message}`);
      return false;
    }
  }

  /**
   * Connect via WebSocket to WiFi RC Car (ESP32-CAM / Raspberry Pi)
   * @param {string} url e.g. "ws://192.168.4.1:81"
   */
  connectWebSocket(url) {
    try {
      this.log(`Connecting to WebSocket: ${url}...`);
      if (this.ws) {
        this.ws.close();
      }

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.linkType = 'ws';
        this.log(`CONNECTED: WebSocket Link online at ${url}`);
      };

      this.ws.onmessage = (event) => {
        this.log(`RX << ${event.data}`);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.log('DISCONNECTED: WebSocket stream closed.');
      };

      this.ws.onerror = (e) => {
        this.log('WebSocket Error encountered.');
      };
    } catch (err) {
      this.log(`WS Connect Error: ${err.message}`);
    }
  }

  /**
   * Transmits control frame to physical RC vehicle
   */
  sendControlFrame(throttle, steer, lights, horn, nitro) {
    if (!this.isConnected) return;

    const now = performance.now();
    if (now - this.lastPacketTime < this.packetInterval) return;
    this.lastPacketTime = now;

    // Packet format: "RC,T:0.85,S:-0.42,L:1,H:0,N:0\n"
    const packet = `RC,T:${throttle.toFixed(2)},S:${steer.toFixed(2)},L:${lights ? 1 : 0},H:${horn ? 1 : 0},N:${nitro ? 1 : 0}\n`;

    if (this.linkType === 'ble' && this.txCharacteristic) {
      const encoder = new TextEncoder();
      this.txCharacteristic.writeValueWithoutResponse(encoder.encode(packet)).catch(e => {
        // Drop frames silently if queue full
      });
    } else if (this.linkType === 'ws' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(packet);
    }
  }
}
