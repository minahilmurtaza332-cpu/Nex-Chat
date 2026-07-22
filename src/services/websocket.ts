import { WSEventType, WSMessage } from '../types';

type EventCallback = (payload: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private listeners: Map<WSEventType | 'connected' | 'disconnected', Set<EventCallback>> = new Map();
  private reconnectTimer: any = null;
  private isConnecting = false;

  public connect(token: string) {
    this.token = token;
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        return;
      }
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        if (this.ws !== socket) return;
        this.isConnecting = false;
        // Authenticate socket
        if (this.token) {
          this.send('auth', { token: this.token });
        }
        this.emitLocal('connected', null);
      };

      socket.onmessage = (event) => {
        if (this.ws !== socket) return;
        try {
          const data: WSMessage = JSON.parse(event.data);
          this.emitLocal(data.type, data.payload);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      socket.onclose = () => {
        if (this.ws === socket) {
          this.isConnecting = false;
          this.emitLocal('disconnected', null);
          this.scheduleReconnect();
        }
      };

      socket.onerror = () => {
        // Do not call socket.close() here as the browser automatically triggers onclose.
        // Calling close() on a connecting socket causes "WebSocket closed without opened".
      };
    } catch (e) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.token = null;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.disconnect();
      });
    }
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.token = null;
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      try {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      } catch (e) {
        // ignore
      }
    }
  }

  public send(type: WSEventType, payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  public on(event: WSEventType | 'connected' | 'disconnected', cb: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(cb);

    return () => {
      this.listeners.get(event)?.delete(cb);
    };
  }

  private emitLocal(event: WSEventType | 'connected' | 'disconnected', payload: any) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      cbs.forEach((cb) => cb(payload));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (!this.token) return;

    this.reconnectTimer = setTimeout(() => {
      this.connect(this.token!);
    }, 3000);
  }
}

export const wsClient = new WebSocketClient();
