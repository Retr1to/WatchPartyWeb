import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';

export interface Participant {
  id: string;
  username: string;
  isHost: boolean;
}

export interface VideoState {
  videoFileName: string;
  videoUrl?: string;
  currentTime: number;
  isPlaying: boolean;
  provider?: string;
  videoId?: string;
}

export interface Room {
  code: string;
  host: string;
  participants: Participant[];
  videoState: {
    url: string;
    currentTime: number;
    isPlaying: boolean;
    provider?: string;
    videoId?: string;
  };
}

interface WebSocketMessage {
  type: string;
  timestamp?: number;
  sentAtUnixMs?: number;
  userId?: string;
  username?: string;
  isHost?: boolean;
  videoFileName?: string;
  videoUrl?: string;
  provider?: string;
  videoId?: string;
  isPlaying?: boolean;
  message?: string;
  state?: VideoState;
}

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private ws: WebSocket | null = null;
  private readonly WS_BASE_URL = this.computeWsBaseUrl();
  private currentRoomId: string = '';
  private currentUserId: string = '';
  private currentUsername: string = '';
  private currentIsHost = false;
  private readonly sessionKey = this.loadOrCreateSessionKey();
  private intentionallyClosed = false;
  private shouldReconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  
  // Subjects para eventos
  private roomCreatedSubject = new Subject<{ roomCode: string; room: Room }>();
  private roomJoinedSubject = new Subject<{ room: Room }>();
  private roomErrorSubject = new Subject<{ message: string }>();
  private participantJoinedSubject = new Subject<{ participant: Participant; participants: Participant[] }>();
  private participantLeftSubject = new Subject<{ participantId: string; participants: Participant[] }>();
  private videoChangedSubject = new Subject<{ url: string; provider?: string; videoId?: string }>();
  private videoPlaySubject = new Subject<{ currentTime: number; sentAtUnixMs?: number }>();
  private videoPauseSubject = new Subject<{ currentTime: number; sentAtUnixMs?: number }>();
  private videoSeekSubject = new Subject<{ currentTime: number; isPlaying: boolean; sentAtUnixMs?: number }>();
  private hostChangedSubject = new Subject<{ newHostId: string }>();
  
  // Subject para room_state
  private roomStateSubject = new Subject<{ users: Participant[] }>();
  public roomState$ = this.roomStateSubject.asObservable();
  
  // Subject para todos los mensajes (raw)
  private messageSubject = new Subject<WebSocketMessage>();
  
  private connectionStateSubject = new BehaviorSubject<boolean>(false);
  public connectionState$ = this.connectionStateSubject.asObservable();

  constructor() {
    console.log('[SocketService] Service initialized');
  }

  private computeWsBaseUrl(): string {
    try {
      const win = window as any;
      const override =
        (typeof win.__WATCHPARTY_WS_BASE_URL === 'string' && win.__WATCHPARTY_WS_BASE_URL.trim()) ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('WATCHPARTY_WS_BASE_URL')?.trim()) ||
        '';
      if (override) return override;

      const { protocol, hostname, host, port } = window.location;
      const wsProtocol = protocol === 'https:' ? 'wss' : 'ws';

      if ((hostname === 'localhost' || hostname === '127.0.0.1') && (port === '4200' || port === '')) {
        return 'wss://localhost:7186';
      }

      return `${wsProtocol}://${host}`;
    } catch {
      return 'wss://localhost:7186';
    }
  }

  // ============================================================
  // CONEXIÓN AL WEBSOCKET
  // ============================================================
  
  private connect(roomId: string, userId: string, username: string, isReconnectAttempt = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (
        this.ws &&
        this.ws.readyState === WebSocket.OPEN &&
        this.currentRoomId === roomId &&
        this.currentUserId === userId
      ) {
        console.log('[SocketService] Already connected');
        resolve();
        return;
      }

      if (!isReconnectAttempt) {
        this.reconnectAttempts = 0;
      }

      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        try {
          this.ws.close(1000, 'Switching rooms');
        } catch {
          // ignore
        }
      }

      this.stopHeartbeat();
      this.clearReconnectTimer();
      this.intentionallyClosed = false;
      this.shouldReconnect = true;

      const wsUrl = `${this.WS_BASE_URL}/ws/${roomId}?userId=${userId}&username=${encodeURIComponent(username)}&sessionKey=${encodeURIComponent(this.sessionKey)}`;
      console.log('[SocketService] Connecting to:', wsUrl);

      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      let didOpen = false;
      let settled = false;

      socket.onopen = () => {
        if (this.ws !== socket) return;
        console.log('[SocketService] WebSocket connected!');
        this.reconnectAttempts = 0;
        this.connectionStateSubject.next(true);
        this.startHeartbeat();
        didOpen = true;
        if (settled) return;
        settled = true;
        resolve();
      };

      socket.onerror = (error) => {
        if (this.ws !== socket) return;
        console.error('[SocketService] WebSocket error:', error);
        this.connectionStateSubject.next(false);
        this.stopHeartbeat();
        if (!settled) {
          settled = true;
          reject(error);
        }
      };

      socket.onclose = (event) => {
        if (this.ws !== socket) return;
        console.log('[SocketService] WebSocket closed', { code: event.code, reason: event.reason });
        this.connectionStateSubject.next(false);
        this.stopHeartbeat();

        if (!didOpen && !settled && !this.intentionallyClosed) {
          settled = true;
          reject(new Error(`WebSocket closed before open (code=${event.code})`));
        }

        if (!this.intentionallyClosed && this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      socket.onmessage = (event) => {
        if (this.ws !== socket) return;
        this.handleMessage(event.data);
      };
    });
  }

  // ============================================================
  // MANEJO DE MENSAJES ENTRANTES
  // ============================================================
  
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      console.log('[SocketService] Message received:', message);

      // ✅ Emitir el mensaje raw a todos los suscriptores
      this.messageSubject.next(message);

      switch (message.type) {
        case 'welcome':
          if (message.userId) {
            this.currentUserId = message.userId;
          }
          if (typeof message.username === 'string') {
            this.currentUsername = message.username;
          }
          this.currentIsHost = !!message.isHost;
          break;
        case 'pong':
          // keep-alive response (useful on platforms like Heroku)
          break;
        case 'state':
          if (message.state) {
            const newUrl = message.state.videoUrl || message.state.videoFileName;
            if (newUrl) {
              this.videoChangedSubject.next({ url: newUrl, provider: message.state.provider, videoId: message.state.videoId });
            }
            if (message.state.isPlaying) {
              this.videoPlaySubject.next({ currentTime: message.state.currentTime });
            } else {
              this.videoPauseSubject.next({ currentTime: message.state.currentTime });
            }
          }
          break;

        case 'room_state':
          console.log('[SocketService] Room state received:', message.message);
          try {
            const roomData = JSON.parse(message.message || '{}');
            if (roomData.users && Array.isArray(roomData.users)) {
              console.log('[SocketService] Parsed users:', roomData.users);
              
              const users: Participant[] = roomData.users.map((u: any) => ({
                id: u.userId,
                username: u.username,
                isHost: u.isHost
              }));

              const me = users.find(u => u.id === this.currentUserId);
              if (me) {
                this.currentIsHost = !!me.isHost;
              }

              this.roomStateSubject.next({ users });
            }
          } catch (e) {
            console.error('[SocketService] Error parsing room_state:', e);
          }
          break;

        case 'play':
          this.videoPlaySubject.next({ currentTime: message.timestamp || 0, sentAtUnixMs: message.sentAtUnixMs });
          break;

        case 'pause':
          this.videoPauseSubject.next({ currentTime: message.timestamp || 0, sentAtUnixMs: message.sentAtUnixMs });
          break;

        case 'seek':
          this.videoSeekSubject.next({
            currentTime: message.timestamp ?? 0,
            isPlaying: message.isPlaying ?? false,
            sentAtUnixMs: message.sentAtUnixMs
          });
          break;

        case 'change_video':
          if (message.videoUrl) {
            this.videoChangedSubject.next({ url: message.videoUrl, provider: message.provider, videoId: message.videoId });
          }
          break;

        case 'host_changed':
          if (message.userId) {
            this.currentIsHost = message.userId === this.currentUserId;
            this.hostChangedSubject.next({ newHostId: message.userId });
          }
          break;

        case 'video_uploaded':
          // ✅ Ya se emite en messageSubject, pero también notificamos aquí
          console.log('[SocketService] Video uploaded:', message.videoFileName);
          break;

        case 'video_ready':
          // ✅ Mensaje para usuarios que se unen tarde
          console.log('[SocketService] Video ready:', message.videoFileName);
          break;

        case 'user_joined':
          const joinedParticipant: Participant = {
            id: message.userId || '',
            username: message.username || 'Usuario',
            isHost: message.isHost || false
          };
          this.participantJoinedSubject.next({ 
            participant: joinedParticipant, 
            participants: [joinedParticipant] 
          });
          break;

        case 'user_left':
          this.participantLeftSubject.next({ 
            participantId: message.userId || '', 
            participants: [] 
          });
          break;

        case 'chat':
          console.log('[SocketService] Chat message:', message.message);
          break;

        default:
          console.log('[SocketService] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[SocketService] Error parsing message:', error);
    }
  }

  // ============================================================
  // ENVÍO DE MENSAJES
  // ============================================================
  
  private sendMessage(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(message);
      if (message.type !== 'ping') {
        console.log('[SocketService] Sending message:', messageStr);
      }
      this.ws.send(messageStr);
    } else {
      console.error('[SocketService] WebSocket not connected. Cannot send message.');
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    // 25s is a safe margin for common 30s idle timeouts in WebSocket proxies/load balancers
    // (e.g., Heroku router). Override locally via localStorage `WATCHPARTY_HEARTBEAT_INTERVAL_MS` if needed.
    const intervalMs = this.getHeartbeatIntervalMs();
    this.heartbeatIntervalId = setInterval(() => {
      this.sendMessage({ type: 'ping' });
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) return;
    if (!this.currentRoomId || !this.currentUserId) return;
    if (!this.shouldReconnect || this.intentionallyClosed) return;

    const maxAttempts = 5;
    if (this.reconnectAttempts >= maxAttempts) {
      console.warn('[SocketService] Max reconnect attempts reached');
      this.shouldReconnect = false;
      this.roomErrorSubject.next({ message: 'Connection lost. Please refresh or rejoin the room.' });
      return;
    }

    const delayMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts += 1;

    console.log(`[SocketService] Reconnecting in ${delayMs}ms (attempt ${this.reconnectAttempts}/${maxAttempts})`);
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.connect(this.currentRoomId, this.currentUserId, this.currentUsername, true).catch(() => {
        // connect() will trigger onclose and reschedule if appropriate
      });
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  // ============================================================
  // MÉTODOS PÚBLICOS
  // ============================================================

  async createRoom(username: string): Promise<void> {
    this.currentRoomId = this.generateRoomCode();
    this.currentUserId = this.generateUserId();
    this.currentUsername = username;
    this.currentIsHost = true;

    try {
      await this.connect(this.currentRoomId, this.currentUserId, username);
      
      const room: Room = {
        code: this.currentRoomId,
        host: this.currentUserId,
        participants: [{
          id: this.currentUserId,
          username: username,
          isHost: true
        }],
        videoState: {
          url: '',
          currentTime: 0,
          isPlaying: false
        }
      };

      this.roomCreatedSubject.next({ roomCode: this.currentRoomId, room });
    } catch (error) {
      this.roomErrorSubject.next({ message: 'Failed to create room' });
    }
  }

  async joinRoom(roomCode: string, username: string): Promise<void> {
    this.currentRoomId = roomCode;
    this.currentUserId = this.generateUserId();
    this.currentUsername = username;
    this.currentIsHost = false;

    try {
      await this.connect(roomCode, this.currentUserId, username);
      
      const room: Room = {
        code: roomCode,
        host: 'unknown',
        participants: [{
          id: this.currentUserId,
          username: username,
          isHost: false
        }],
        videoState: {
          url: '',
          currentTime: 0,
          isPlaying: false
        }
      };

      this.roomJoinedSubject.next({ room });
    } catch (error) {
      this.roomErrorSubject.next({ message: 'Failed to join room' });
    }
  }

  changeVideo(roomCode: string, url: string, provider?: string, videoId?: string): void {
    if (!this.currentIsHost) {
      console.warn('[SocketService] Ignoring changeVideo: current user is not host');
      return;
    }
    // Emit locally for immediate feedback
    this.videoChangedSubject.next({ url, provider, videoId });
    this.sendMessage({
      type: 'change_video',
      videoUrl: url,
      provider,
      videoId
    });
  }

  playVideo(roomCode: string, currentTime: number): void {
    if (!this.currentIsHost) {
      console.warn('[SocketService] Ignoring playVideo: current user is not host');
      return;
    }
    this.sendMessage({
      type: 'play',
      timestamp: currentTime
    });
  }

  pauseVideo(roomCode: string, currentTime: number): void {
    if (!this.currentIsHost) {
      console.warn('[SocketService] Ignoring pauseVideo: current user is not host');
      return;
    }
    this.sendMessage({
      type: 'pause',
      timestamp: currentTime
    });
  }

  seekVideo(roomCode: string, currentTime: number, isPlaying: boolean): void {
    if (!this.currentIsHost) {
      console.warn('[SocketService] Ignoring seekVideo: current user is not host');
      return;
    }
    this.sendMessage({
      type: 'seek',
      timestamp: currentTime,
      isPlaying
    });
  }

  leaveRoom(): void {
    if (this.ws) {
      console.log('[SocketService] Leaving room and closing connection');
      this.intentionallyClosed = true;
      this.shouldReconnect = false;
      this.reconnectAttempts = 0;
      this.stopHeartbeat();
      this.clearReconnectTimer();
      try {
        this.ws.close(1000, 'Client leaving room');
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.currentRoomId = '';
    this.currentUserId = '';
    this.currentUsername = '';
    this.currentIsHost = false;
  }

  // ============================================================
  // OBSERVABLES
  // ============================================================

  onRoomCreated(): Observable<{ roomCode: string; room: Room }> {
    return this.roomCreatedSubject.asObservable();
  }

  onRoomJoined(): Observable<{ room: Room }> {
    return this.roomJoinedSubject.asObservable();
  }

  onRoomError(): Observable<{ message: string }> {
    return this.roomErrorSubject.asObservable();
  }

  onParticipantJoined(): Observable<{ participant: Participant; participants: Participant[] }> {
    return this.participantJoinedSubject.asObservable();
  }

  onParticipantLeft(): Observable<{ participantId: string; participants: Participant[] }> {
    return this.participantLeftSubject.asObservable();
  }

  onVideoChanged(): Observable<{ url: string; provider?: string; videoId?: string }> {
    return this.videoChangedSubject.asObservable();
  }

  onVideoPlay(): Observable<{ currentTime: number; sentAtUnixMs?: number }> {
    return this.videoPlaySubject.asObservable();
  }

  onVideoPause(): Observable<{ currentTime: number; sentAtUnixMs?: number }> {
    return this.videoPauseSubject.asObservable();
  }

  onVideoSeek(): Observable<{ currentTime: number; isPlaying: boolean; sentAtUnixMs?: number }> {
    return this.videoSeekSubject.asObservable();
  }

  onHostChanged(): Observable<{ newHostId: string }> {
    return this.hostChangedSubject.asObservable();
  }

  // Observable para todos los mensajes raw
  onMessage(): Observable<WebSocketMessage> {
    return this.messageSubject.asObservable();
  }

  disconnect(): void {
    this.leaveRoom();
  }

  // ============================================================
  // UTILIDADES
  // ============================================================

  private generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private generateUserId(): string {
    return 'user_' + Math.random().toString(36).substring(2, 15);
  }

  getCurrentUserId(): string {
    return this.currentUserId;
  }

  getCurrentRoomId(): string {
    return this.currentRoomId;
  }

  getHttpBaseUrl(): string {
    return this.WS_BASE_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  }

  getSessionKey(): string {
    return this.sessionKey;
  }

  private loadOrCreateSessionKey(): string {
    const storageKey = 'WATCHPARTY_SESSION_KEY';

    try {
      const existing = localStorage.getItem(storageKey);
      if (existing && existing.trim()) return existing.trim();
    } catch {
      // ignore
    }

    const bytes = new Uint8Array(32);
    try {
      crypto.getRandomValues(bytes);
    } catch {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }

    const generated = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    try {
      localStorage.setItem(storageKey, generated);
    } catch {
      // ignore
    }

    return generated;
  }

  private getHeartbeatIntervalMs(): number {
    const defaultMs = 25_000;

    try {
      const raw = localStorage.getItem('WATCHPARTY_HEARTBEAT_INTERVAL_MS');
      if (!raw) return defaultMs;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return defaultMs;
      if (parsed < 5_000 || parsed > 120_000) return defaultMs;
      return Math.floor(parsed);
    } catch {
      return defaultMs;
    }
  }
}
