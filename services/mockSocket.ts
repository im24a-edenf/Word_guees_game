/**
 * @file mockSocket.ts
 * @description Client-side WebSocket wrapper service.
 * 
 * AI CONTEXT:
 * - NAMING: Historically named "mockSocket" but now implements a REAL WebSocket connection.
 * - PATTERN: Singleton Service pattern.
 * - API: Exposes `connect`, `joinRoom`, `on`, and `broadcastAction`.
 * - EVENTS: Uses an internal `listeners` map to implement an Observer pattern for UI components.
 */

import { ChatMessage, Player } from "../types";

type Listener<T> = (data: T) => void;

class SocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Listener<any>[]> = new Map();
  private isConnected = false;
  private messageQueue: string[] = []; // Queues messages if sent before connection opens

  constructor() {
    // Lazy connection via connect() method
  }

  /**
   * Establishes the WebSocket connection to the server.
   */
  public connect(url?: string): Promise<void> {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = url || `${protocol}//${window.location.host}`;
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(host);

      this.ws.onopen = () => {
        console.log("Connected to Game Server");
        this.isConnected = true;
        this.flushQueue();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Dispatch server events to local listeners
          this.emit(data.type, data.payload);
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      this.ws.onerror = (err) => {
        console.error("WebSocket Error", err);
        if (!this.isConnected) reject(err);
      };

      this.ws.onclose = () => {
        console.log("Disconnected from Game Server");
        this.isConnected = false;
        this.emit('disconnect', null);
      };
    });
  }

  /**
   * Subscribe to a specific event type (e.g., 'GAME_ACTION', 'PLAYER_JOINED').
   * Returns a cleanup function.
   */
  public on<T>(event: string, callback: Listener<T>) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);

    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        this.listeners.set(event, callbacks.filter(cb => cb !== callback));
      }
    };
  }

  // Internal event dispatcher
  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  // Wraps payload in standard server envelope
  private sendRaw(type: string, payload: any) {
    const msg = JSON.stringify({ type, payload });
    if (this.isConnected && this.ws) {
      this.ws.send(msg);
    } else {
      this.messageQueue.push(msg);
    }
  }

  private flushQueue() {
    if (!this.ws) return;
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) this.ws.send(msg);
    }
  }

  // --- Public API ---

  public joinRoom(roomId: string, player: Player) {
    this.sendRaw('JOIN_ROOM', { roomId, player });
  }

  /**
   * Primary method for game state sync.
   * Wraps data in 'GAME_ACTION' type for the relay server.
   */
  public broadcastAction(type: string, data: any) {
    this.sendRaw('GAME_ACTION', { type, data });
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * @deprecated Legacy alias for compatibility during refactors.
   * Maps 'chat' events to 'GAME_ACTION'.
   */
  public send(event: string, data: any) {
    if (event === 'chat') {
      this.broadcastAction('CHAT', data);
    } else {
      this.broadcastAction(event, data);
    }
  }

  public getMockPlayers(): Player[] {
    return [];
  }
}

export const socketService = new SocketService();