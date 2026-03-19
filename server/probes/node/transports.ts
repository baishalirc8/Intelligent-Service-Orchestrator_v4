import * as http from "http";
import * as https from "https";
import * as net from "net";
import * as dgram from "dgram";

export interface TransportConfig {
  type: string;
  priority: number;
  enabled: boolean;
  config: Record<string, any>;
}

export interface TransportResult {
  success: boolean;
  data?: any;
  error?: string;
  transport: string;
}

interface Transport {
  name: string;
  send(endpoint: string, data: any): Promise<TransportResult>;
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
}

function logTs(msg: string) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  process.stdout.write(`[${ts}] [transport] ${msg}\n`);
}

function hmacSign(body: string, hmacSecret: string): Record<string, string> {
  if (!hmacSecret) return {};
  const crypto = require("crypto");
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const signature = crypto.createHmac("sha256", hmacSecret).update(`${timestamp}.${nonce}.${body}`).digest("hex");
  return {
    "X-Holocron-Signature": signature,
    "X-Holocron-Timestamp": timestamp,
    "X-Holocron-Nonce": nonce,
  };
}

class HttpsTransport implements Transport {
  name = "https";
  private baseUrl: string;
  private hmacSecret: string;

  constructor(config: Record<string, any>) {
    this.baseUrl = (config.baseUrl || "").replace(/\/$/, "");
    this.hmacSecret = config.hmacSecret || "";
  }

  async connect() { logTs("HTTPS transport ready"); }
  disconnect() {}
  isConnected() { return !!this.baseUrl; }

  send(endpoint: string, data: any): Promise<TransportResult> {
    return new Promise((resolve) => {
      if (!this.baseUrl) {
        return resolve({ success: false, error: "No base URL configured", transport: this.name });
      }
      let url: URL;
      try { url = new URL(this.baseUrl + endpoint); } catch (e: any) {
        return resolve({ success: false, error: `Invalid URL: ${e.message}`, transport: this.name });
      }
      const isHttps = url.protocol === "https:";
      const body = JSON.stringify(data);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body).toString(),
        ...hmacSign(body, this.hmacSecret),
      };

      const opts = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers,
        timeout: 30000,
      };

      const req = (isHttps ? https : http).request(opts, (res) => {
        let raw = "";
        res.on("data", (c: Buffer) => raw += c.toString());
        res.on("end", () => {
          try { resolve({ success: true, data: JSON.parse(raw), transport: this.name }); }
          catch { resolve({ success: true, data: { raw }, transport: this.name }); }
        });
      });
      req.on("error", (e: Error) => resolve({ success: false, error: e.message, transport: this.name }));
      req.on("timeout", () => { req.destroy(); resolve({ success: false, error: "timeout", transport: this.name }); });
      req.write(body);
      req.end();
    });
  }
}

class MqttTransport implements Transport {
  name = "mqtt";
  private brokerUrl: string;
  private topicPrefix: string;
  private qos: 0 | 1 | 2;
  private clientId: string;
  private username: string;
  private password: string;
  private useTls: boolean;
  private client: any = null;
  private connected = false;
  private responseHandlers: Map<string, (data: any) => void> = new Map();

  constructor(config: Record<string, any>) {
    this.brokerUrl = config.brokerUrl || "mqtt://localhost:1883";
    this.topicPrefix = config.topicPrefix || "holocron";
    this.qos = (config.qos ?? 1) as 0 | 1 | 2;
    this.clientId = config.clientId || `holocron-probe-${Date.now()}`;
    this.username = config.username || "";
    this.password = config.password || "";
    this.useTls = config.useTls ?? config.tls ?? false;
  }

  async connect() {
    try {
      const mqtt = require("mqtt");
      const opts: any = {
        clientId: this.clientId,
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 5000,
      };
      if (this.username) opts.username = this.username;
      if (this.password) opts.password = this.password;

      const url = this.useTls ? this.brokerUrl.replace("mqtt://", "mqtts://") : this.brokerUrl;
      this.client = mqtt.connect(url, opts);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("MQTT connect timeout")), 15000);
        this.client.on("connect", () => {
          clearTimeout(timeout);
          this.connected = true;
          logTs(`MQTT connected to ${url}`);
          const responseTopic = `${this.topicPrefix}/response/${this.clientId}`;
          this.client.subscribe(responseTopic, { qos: this.qos });
          resolve();
        });
        this.client.on("error", (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      this.client.on("message", (topic: string, message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          const correlationId = data._correlationId;
          if (correlationId && this.responseHandlers.has(correlationId)) {
            this.responseHandlers.get(correlationId)!(data);
            this.responseHandlers.delete(correlationId);
          }
        } catch {}
      });

      this.client.on("close", () => { this.connected = false; });
      this.client.on("reconnect", () => { logTs("MQTT reconnecting..."); });
    } catch (e: any) {
      logTs(`MQTT connect failed: ${e.message}`);
      throw e;
    }
  }

  disconnect() {
    if (this.client) { this.client.end(true); this.connected = false; }
  }

  isConnected() { return this.connected; }

  send(endpoint: string, data: any): Promise<TransportResult> {
    return new Promise((resolve) => {
      if (!this.connected || !this.client) {
        resolve({ success: false, error: "MQTT not connected", transport: this.name });
        return;
      }

      const correlationId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const topic = `${this.topicPrefix}${endpoint.replace(/\//g, "/")}`;
      const payload = JSON.stringify({
        ...data,
        _correlationId: correlationId,
        _responseTopic: `${this.topicPrefix}/response/${this.clientId}`,
        _endpoint: endpoint,
        _timestamp: Date.now(),
      });

      const timeout = setTimeout(() => {
        this.responseHandlers.delete(correlationId);
        resolve({ success: true, data: { acknowledged: true }, transport: this.name });
      }, 10000);

      this.responseHandlers.set(correlationId, (responseData) => {
        clearTimeout(timeout);
        resolve({ success: true, data: responseData, transport: this.name });
      });

      this.client.publish(topic, payload, { qos: this.qos }, (err: Error | null) => {
        if (err) {
          clearTimeout(timeout);
          this.responseHandlers.delete(correlationId);
          resolve({ success: false, error: err.message, transport: this.name });
        }
      });
    });
  }
}

class WebSocketTransport implements Transport {
  name = "websocket";
  private url: string;
  private reconnectInterval: number;
  private pingInterval: number;
  private ws: any = null;
  private connected = false;
  private responseHandlers: Map<string, (data: any) => void> = new Map();
  private pingTimer: any = null;
  private hmacSecret: string;

  constructor(config: Record<string, any>) {
    this.url = config.url || "ws://localhost:8080";
    this.reconnectInterval = config.reconnectInterval || 5000;
    this.pingInterval = config.pingInterval || 30000;
    this.hmacSecret = config.hmacSecret || "";
  }

  async connect() {
    try {
      const WebSocket = require("ws");
      this.ws = new WebSocket(this.url);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("WebSocket connect timeout")), 15000);
        this.ws.on("open", () => {
          clearTimeout(timeout);
          this.connected = true;
          logTs(`WebSocket connected to ${this.url}`);
          this.startPing();
          resolve();
        });
        this.ws.on("error", (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      this.ws.on("message", (raw: Buffer) => {
        try {
          const data = JSON.parse(raw.toString());
          const correlationId = data._correlationId;
          if (correlationId && this.responseHandlers.has(correlationId)) {
            this.responseHandlers.get(correlationId)!(data);
            this.responseHandlers.delete(correlationId);
          }
        } catch {}
      });

      this.ws.on("close", () => {
        this.connected = false;
        this.stopPing();
        logTs("WebSocket disconnected");
      });
    } catch (e: any) {
      logTs(`WebSocket connect failed: ${e.message}`);
      throw e;
    }
  }

  private startPing() {
    this.pingTimer = setInterval(() => {
      if (this.ws && this.connected) this.ws.ping();
    }, this.pingInterval);
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
  }

  disconnect() {
    this.stopPing();
    if (this.ws) { this.ws.close(); this.connected = false; }
  }

  isConnected() { return this.connected; }

  send(endpoint: string, data: any): Promise<TransportResult> {
    return new Promise((resolve) => {
      if (!this.connected || !this.ws) {
        resolve({ success: false, error: "WebSocket not connected", transport: this.name });
        return;
      }

      const correlationId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload = JSON.stringify({
        endpoint,
        data,
        _correlationId: correlationId,
        ...hmacSign(JSON.stringify(data), this.hmacSecret),
      });

      const timeout = setTimeout(() => {
        this.responseHandlers.delete(correlationId);
        resolve({ success: true, data: { acknowledged: true }, transport: this.name });
      }, 10000);

      this.responseHandlers.set(correlationId, (responseData) => {
        clearTimeout(timeout);
        resolve({ success: true, data: responseData, transport: this.name });
      });

      try {
        this.ws.send(payload);
      } catch (e: any) {
        clearTimeout(timeout);
        this.responseHandlers.delete(correlationId);
        resolve({ success: false, error: e.message, transport: this.name });
      }
    });
  }
}

class CoapTransport implements Transport {
  name = "coap";
  private host: string;
  private port: number;
  private pathPrefix: string;
  private useDtls: boolean;

  constructor(config: Record<string, any>) {
    this.host = config.host || "localhost";
    this.port = config.port || 5683;
    this.pathPrefix = config.pathPrefix || "/holocron";
    this.useDtls = config.useDtls ?? config.dtls ?? false;
  }

  async connect() { logTs(`CoAP transport ready (${this.host}:${this.port})`); }
  disconnect() {}
  isConnected() { return true; }

  send(endpoint: string, data: any): Promise<TransportResult> {
    return new Promise((resolve) => {
      try {
        const coap = require("coap");
        const payload = Buffer.from(JSON.stringify(data));
        const req = coap.request({
          hostname: this.host,
          port: this.port,
          pathname: this.pathPrefix + endpoint,
          method: "POST",
          confirmable: true,
        });

        req.on("response", (res: any) => {
          let raw = "";
          res.on("data", (chunk: Buffer) => raw += chunk.toString());
          res.on("end", () => {
            try { resolve({ success: true, data: JSON.parse(raw), transport: this.name }); }
            catch { resolve({ success: true, data: { raw }, transport: this.name }); }
          });
        });

        req.on("error", (e: Error) => {
          resolve({ success: false, error: e.message, transport: this.name });
        });

        req.on("timeout", () => {
          resolve({ success: false, error: "CoAP timeout", transport: this.name });
        });

        req.write(payload);
        req.end();
      } catch (e: any) {
        resolve({ success: false, error: e.message, transport: this.name });
      }
    });
  }
}

class TcpTransport implements Transport {
  name = "tcp";
  private host: string;
  private port: number;
  private useTls: boolean;
  private socket: net.Socket | null = null;
  private connected = false;
  private buffer = "";
  private responseHandlers: Map<string, (data: any) => void> = new Map();
  private hmacSecret: string;

  constructor(config: Record<string, any>) {
    this.host = config.host || "localhost";
    this.port = config.port || 9000;
    this.useTls = config.useTls ?? config.tls ?? false;
    this.hmacSecret = config.hmacSecret || "";
  }

  async connect() {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("TCP connect timeout")), 15000);

      if (this.useTls) {
        const tls = require("tls");
        this.socket = tls.connect({ host: this.host, port: this.port, rejectUnauthorized: true }, () => {
          clearTimeout(timeout);
          this.connected = true;
          logTs(`TCP/TLS connected to ${this.host}:${this.port}`);
          resolve();
        });
      } else {
        this.socket = new net.Socket();
        this.socket.connect(this.port, this.host, () => {
          clearTimeout(timeout);
          this.connected = true;
          logTs(`TCP connected to ${this.host}:${this.port}`);
          resolve();
        });
      }

      this.socket!.on("data", (chunk: Buffer) => {
        this.buffer += chunk.toString();
        let newlineIdx;
        while ((newlineIdx = this.buffer.indexOf("\n")) !== -1) {
          const line = this.buffer.slice(0, newlineIdx);
          this.buffer = this.buffer.slice(newlineIdx + 1);
          try {
            const data = JSON.parse(line);
            const correlationId = data._correlationId;
            if (correlationId && this.responseHandlers.has(correlationId)) {
              this.responseHandlers.get(correlationId)!(data);
              this.responseHandlers.delete(correlationId);
            }
          } catch {}
        }
      });

      this.socket!.on("close", () => { this.connected = false; });
      this.socket!.on("error", (e: Error) => {
        if (!this.connected) { clearTimeout(timeout); reject(e); }
        else { this.connected = false; logTs(`TCP error: ${e.message}`); }
      });
    });
  }

  disconnect() {
    if (this.socket) { this.socket.destroy(); this.connected = false; }
  }

  isConnected() { return this.connected; }

  send(endpoint: string, data: any): Promise<TransportResult> {
    return new Promise((resolve) => {
      if (!this.connected || !this.socket) {
        resolve({ success: false, error: "TCP not connected", transport: this.name });
        return;
      }

      const correlationId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const frame = JSON.stringify({
        endpoint,
        data,
        _correlationId: correlationId,
        ...hmacSign(JSON.stringify(data), this.hmacSecret),
      }) + "\n";

      const timeout = setTimeout(() => {
        this.responseHandlers.delete(correlationId);
        resolve({ success: true, data: { acknowledged: true }, transport: this.name });
      }, 10000);

      this.responseHandlers.set(correlationId, (responseData) => {
        clearTimeout(timeout);
        resolve({ success: true, data: responseData, transport: this.name });
      });

      this.socket.write(frame, (err) => {
        if (err) {
          clearTimeout(timeout);
          this.responseHandlers.delete(correlationId);
          resolve({ success: false, error: err.message, transport: this.name });
        }
      });
    });
  }
}

class UdpTransport implements Transport {
  name = "udp";
  private host: string;
  private port: number;
  private maxPacketSize: number;
  private socket: dgram.Socket | null = null;

  constructor(config: Record<string, any>) {
    this.host = config.host || "localhost";
    this.port = config.port || 9001;
    this.maxPacketSize = config.maxPacketSize || 65507;
  }

  async connect() {
    this.socket = dgram.createSocket("udp4");
    this.socket.on("error", (e) => logTs(`UDP error: ${e.message}`));
    logTs(`UDP transport ready (${this.host}:${this.port})`);
  }

  disconnect() {
    if (this.socket) { this.socket.close(); this.socket = null; }
  }

  isConnected() { return !!this.socket; }

  send(endpoint: string, data: any): Promise<TransportResult> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: "UDP socket not initialized", transport: this.name });
        return;
      }

      const payload = JSON.stringify({ endpoint, data, _timestamp: Date.now() });
      if (Buffer.byteLength(payload) > this.maxPacketSize) {
        resolve({ success: false, error: `Payload exceeds max UDP packet size (${this.maxPacketSize})`, transport: this.name });
        return;
      }

      const buf = Buffer.from(payload);
      this.socket.send(buf, 0, buf.length, this.port, this.host, (err) => {
        if (err) resolve({ success: false, error: err.message, transport: this.name });
        else resolve({ success: true, data: { acknowledged: true, bytes: buf.length }, transport: this.name });
      });
    });
  }
}

class SerialTransport implements Transport {
  name = "serial";
  private portPath: string;
  private baudRate: number;
  private dataBits: number;
  private stopBits: number;
  private parity: string;
  private port: any = null;
  private connected = false;
  private buffer = "";

  constructor(config: Record<string, any>) {
    this.portPath = config.portPath || config.path || "/dev/ttyUSB0";
    this.baudRate = config.baudRate || 115200;
    this.dataBits = config.dataBits || 8;
    this.stopBits = config.stopBits || 1;
    this.parity = config.parity || "none";
  }

  async connect() {
    try {
      const { SerialPort } = require("serialport");
      this.port = new SerialPort({
        path: this.portPath,
        baudRate: this.baudRate,
        dataBits: this.dataBits,
        stopBits: this.stopBits,
        parity: this.parity,
        autoOpen: false,
      });

      await new Promise<void>((resolve, reject) => {
        this.port.open((err: Error | null) => {
          if (err) { reject(err); return; }
          this.connected = true;
          logTs(`Serial connected: ${this.portPath} @ ${this.baudRate} baud`);
          resolve();
        });
      });

      this.port.on("data", (chunk: Buffer) => {
        this.buffer += chunk.toString();
      });

      this.port.on("close", () => { this.connected = false; });
      this.port.on("error", (e: Error) => { logTs(`Serial error: ${e.message}`); });
    } catch (e: any) {
      logTs(`Serial connect failed: ${e.message}`);
      throw e;
    }
  }

  disconnect() {
    if (this.port && this.port.isOpen) { this.port.close(); this.connected = false; }
  }

  isConnected() { return this.connected; }

  send(endpoint: string, data: any): Promise<TransportResult> {
    return new Promise((resolve) => {
      if (!this.connected || !this.port) {
        resolve({ success: false, error: "Serial port not connected", transport: this.name });
        return;
      }

      const frame = JSON.stringify({ endpoint, data, _ts: Date.now() }) + "\n";
      this.port.write(frame, (err: Error | null) => {
        if (err) resolve({ success: false, error: err.message, transport: this.name });
        else {
          this.port.drain(() => {
            resolve({ success: true, data: { acknowledged: true, bytes: frame.length }, transport: this.name });
          });
        }
      });
    });
  }
}

class LoRaTransport implements Transport {
  name = "lora";
  private serialPath: string;
  private baudRate: number;
  private frequency: string;
  private spreadingFactor: number;
  private bandwidth: number;
  private txPower: number;
  private port: any = null;
  private connected = false;
  private buffer = "";

  constructor(config: Record<string, any>) {
    this.serialPath = config.serialPort || "/dev/ttyUSB0";
    this.baudRate = config.baudRate || 57600;
    this.frequency = config.frequency || "868100000";
    this.spreadingFactor = config.spreadingFactor || 7;
    this.bandwidth = config.bandwidth || 125;
    this.txPower = config.txPower || 14;
  }

  async connect() {
    try {
      const { SerialPort } = require("serialport");
      this.port = new SerialPort({
        path: this.serialPath,
        baudRate: this.baudRate,
        autoOpen: false,
      });

      await new Promise<void>((resolve, reject) => {
        this.port.open((err: Error | null) => {
          if (err) { reject(err); return; }
          this.connected = true;
          resolve();
        });
      });

      this.port.on("data", (chunk: Buffer) => {
        this.buffer += chunk.toString();
      });

      this.port.on("close", () => { this.connected = false; });

      await this.sendAt("sys reset");
      await this.delay(1000);
      await this.sendAt(`radio set freq ${this.frequency}`);
      await this.sendAt(`radio set sf sf${this.spreadingFactor}`);
      await this.sendAt(`radio set bw ${this.bandwidth}`);
      await this.sendAt(`radio set pwr ${this.txPower}`);
      await this.sendAt("radio set crc on");
      await this.sendAt("mac pause");

      logTs(`LoRa initialized: ${this.serialPath} @ ${this.frequency}Hz SF${this.spreadingFactor} BW${this.bandwidth} TX${this.txPower}dBm`);
    } catch (e: any) {
      logTs(`LoRa connect failed: ${e.message}`);
      throw e;
    }
  }

  private sendAt(cmd: string): Promise<string> {
    return new Promise((resolve) => {
      if (!this.port) { resolve(""); return; }
      this.buffer = "";
      this.port.write(cmd + "\r\n");
      setTimeout(() => {
        const response = this.buffer.trim();
        this.buffer = "";
        resolve(response);
      }, 500);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  disconnect() {
    if (this.port && this.port.isOpen) { this.port.close(); this.connected = false; }
  }

  isConnected() { return this.connected; }

  send(endpoint: string, data: any): Promise<TransportResult> {
    return new Promise(async (resolve) => {
      if (!this.connected || !this.port) {
        resolve({ success: false, error: "LoRa radio not connected", transport: this.name });
        return;
      }

      try {
        const payload = JSON.stringify({ e: endpoint.replace("/api/", ""), d: data });
        const hexPayload = Buffer.from(payload).toString("hex");

        if (hexPayload.length > 500) {
          resolve({ success: false, error: `Payload too large for LoRa (${hexPayload.length / 2} bytes, max ~250)`, transport: this.name });
          return;
        }

        const response = await this.sendAt(`radio tx ${hexPayload}`);
        await this.delay(2000);

        if (response.includes("ok")) {
          resolve({ success: true, data: { acknowledged: true, bytes: hexPayload.length / 2, sf: this.spreadingFactor }, transport: this.name });
        } else {
          resolve({ success: false, error: `LoRa TX failed: ${response}`, transport: this.name });
        }
      } catch (e: any) {
        resolve({ success: false, error: e.message, transport: this.name });
      }
    });
  }
}

class ReticulumTransport implements Transport {
  name = "reticulum";
  private configPath: string;
  private interfaceType: string;
  private destinationName: string;
  private appName: string;
  private connected = false;
  private rnsProcess: any = null;

  constructor(config: Record<string, any>) {
    this.configPath = config.configPath || "~/.reticulum";
    this.interfaceType = config.interfaceType || "AutoInterface";
    this.destinationName = config.destinationName || "holocron.probe";
    this.appName = config.appName || "holocron";
  }

  async connect() {
    try {
      const { execSync, spawn } = require("child_process");

      try {
        execSync("which rnsd", { stdio: "pipe" });
      } catch {
        logTs("Reticulum (rnsd) not found. Install: pip install rns");
        throw new Error("rnsd not installed");
      }

      const fs = require("fs");
      const path = require("path");
      const configDir = this.configPath.replace("~", process.env.HOME || "/root");
      const configFile = path.join(configDir, "config");

      if (!fs.existsSync(configFile)) {
        fs.mkdirSync(configDir, { recursive: true });
        let configContent = "[reticulum]\n  enable_transport = False\n  share_instance = Yes\n\n[interfaces]\n";

        switch (this.interfaceType) {
          case "AutoInterface":
            configContent += "  [[AutoInterface]]\n    type = AutoInterface\n    enabled = True\n";
            break;
          case "TCPClient":
          case "TCPClientInterface":
            configContent += "  [[TCP Client]]\n    type = TCPClientInterface\n    enabled = True\n    target_host = 127.0.0.1\n    target_port = 4242\n";
            break;
          case "SerialInterface":
            configContent += "  [[Serial Interface]]\n    type = SerialInterface\n    enabled = True\n    port = /dev/ttyUSB0\n    speed = 115200\n";
            break;
          case "RNodeInterface":
            configContent += "  [[RNode LoRa]]\n    type = RNodeInterface\n    enabled = True\n    port = /dev/ttyUSB0\n    frequency = 868000000\n    bandwidth = 125000\n    txpower = 7\n    spreadingfactor = 8\n";
            break;
        }

        fs.writeFileSync(configFile, configContent);
        logTs(`Reticulum config written: ${configFile}`);
      }

      this.rnsProcess = spawn("rnsd", ["--config", configDir], {
        stdio: ["pipe", "pipe", "pipe"],
        detached: false,
      });

      this.rnsProcess.on("error", (e: Error) => {
        logTs(`Reticulum daemon error: ${e.message}`);
        this.connected = false;
      });

      this.rnsProcess.on("exit", (code: number) => {
        logTs(`Reticulum daemon exited (code: ${code})`);
        this.connected = false;
      });

      await new Promise(r => setTimeout(r, 3000));
      this.connected = true;
      logTs(`Reticulum transport online (${this.interfaceType}) — destination: ${this.destinationName}`);
    } catch (e: any) {
      logTs(`Reticulum connect failed: ${e.message}`);
      throw e;
    }
  }

  disconnect() {
    if (this.rnsProcess) {
      this.rnsProcess.kill("SIGTERM");
      this.rnsProcess = null;
    }
    this.connected = false;
  }

  isConnected() { return this.connected; }

  send(endpoint: string, data: any): Promise<TransportResult> {
    return new Promise((resolve) => {
      if (!this.connected) {
        resolve({ success: false, error: "Reticulum not connected", transport: this.name });
        return;
      }

      try {
        const { execSync } = require("child_process");
        const payload = JSON.stringify({ endpoint, data, _ts: Date.now() });
        const configDir = this.configPath.replace("~", process.env.HOME || "/root");

        const lxmfCmd = `echo '${payload.replace(/'/g, "\\'")}' | rncp --config ${configDir} - ${this.destinationName} 2>&1 || echo '{"fallback":true}'`;

        try {
          execSync(lxmfCmd, { timeout: 30000, stdio: "pipe" });
          resolve({ success: true, data: { acknowledged: true, protocol: "reticulum", destination: this.destinationName }, transport: this.name });
        } catch {
          resolve({ success: true, data: { queued: true, protocol: "reticulum", destination: this.destinationName }, transport: this.name });
        }
      } catch (e: any) {
        resolve({ success: false, error: e.message, transport: this.name });
      }
    });
  }
}

function createTransport(config: TransportConfig): Transport {
  switch (config.type) {
    case "https": return new HttpsTransport(config.config);
    case "mqtt": return new MqttTransport(config.config);
    case "websocket": return new WebSocketTransport(config.config);
    case "coap": return new CoapTransport(config.config);
    case "tcp": return new TcpTransport(config.config);
    case "udp": return new UdpTransport(config.config);
    case "serial": return new SerialTransport(config.config);
    case "lora": return new LoRaTransport(config.config);
    case "reticulum": return new ReticulumTransport(config.config);
    default: throw new Error(`Unknown transport type: ${config.type}`);
  }
}

export class TransportChain {
  private transports: { transport: Transport; priority: number }[] = [];
  private activeTransport: Transport | null = null;

  constructor(configs: TransportConfig[]) {
    const enabled = configs.filter(c => c.enabled).sort((a, b) => a.priority - b.priority);
    for (const cfg of enabled) {
      try {
        this.transports.push({ transport: createTransport(cfg), priority: cfg.priority });
      } catch (e: any) {
        logTs(`Failed to create ${cfg.type} transport: ${e.message}`);
      }
    }
  }

  async connect(): Promise<void> {
    for (const { transport } of this.transports) {
      try {
        await transport.connect();
        if (transport.isConnected()) {
          this.activeTransport = transport;
          logTs(`Primary transport: ${transport.name}`);
          return;
        }
      } catch (e: any) {
        logTs(`${transport.name} connect failed, trying next: ${e.message}`);
      }
    }
    if (!this.activeTransport && this.transports.length > 0) {
      this.activeTransport = this.transports[0].transport;
    }
  }

  async send(endpoint: string, data: any): Promise<TransportResult> {
    for (const { transport } of this.transports) {
      try {
        if (!transport.isConnected()) {
          try { await transport.connect(); } catch { continue; }
        }

        const result = await transport.send(endpoint, data);
        if (result.success) {
          if (this.activeTransport !== transport) {
            logTs(`Switched to ${transport.name} transport`);
            this.activeTransport = transport;
          }
          return result;
        }
        logTs(`${transport.name} failed (${result.error}), trying fallback...`);
      } catch (e: any) {
        logTs(`${transport.name} threw error (${e.message}), trying fallback...`);
      }
    }

    return { success: false, error: "All transports failed", transport: "none" };
  }

  disconnect(): void {
    for (const { transport } of this.transports) {
      try { transport.disconnect(); } catch {}
    }
  }

  getActiveTransport(): string {
    return this.activeTransport?.name || "none";
  }

  getTransportNames(): string[] {
    return this.transports.map(t => t.transport.name);
  }
}

export function buildTransportChain(hmacSecret?: string): TransportChain {
  const configJson = process.env.HOLOCRON_TRANSPORTS;
  const apiUrl = (process.env.HOLOCRON_API || "").replace(/\/$/, "");

  if (configJson) {
    try {
      const configs: TransportConfig[] = JSON.parse(configJson);
      const hasHttps = configs.some(c => c.type === "https");
      if (!hasHttps && apiUrl) {
        configs.push({
          type: "https",
          priority: configs.length + 1,
          enabled: true,
          config: { baseUrl: apiUrl, hmacSecret: hmacSecret || "" },
        });
      }
      return new TransportChain(configs);
    } catch (e: any) {
      logTs(`Invalid HOLOCRON_TRANSPORTS JSON, falling back to HTTPS: ${e.message}`);
    }
  }

  return new TransportChain([{
    type: "https",
    priority: 1,
    enabled: true,
    config: { baseUrl: apiUrl, hmacSecret: hmacSecret || "" },
  }]);
}
