import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';

export interface Participant {
  id: string;
  username: string;
  isHost: boolean;
}

export interface VideoState {
  videoFileName: string;
  currentTime: number;
  isPlaying: boolean;
}

export interface Room {
  code: string;
  host: string;
  participants: Participant[];
  videoState: {
    url: string;
    currentTime: number;
    isPlaying: boolean;
  };
}

interface WebSocketMessage {
  type: string;
  timestamp?: number;
  userId?: string;
  isHost?: boolean;
  videoFileName?: string;
  isPlaying?: boolean;
  message?: string;
  state?: VideoState;
}

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private ws: WebSocket | null = null;
  private readonly SERVER_URL = 'wss://localhost:7186';
  private currentRoomId: string = '';
  private currentUserId: string = '';
  private currentUsername: string = '';
  
  // Subjects para eventos
  private roomCreatedSubject = new Subject<{ roomCode: string; room: Room }>();
  private roomJoinedSubject = new Subject<{ room: Room }>();
  private roomErrorSubject = new Subject<{ message: string }>();
  private participantJoinedSubject = new Subject<{ participant: Participant; participants: Participant[] }>();
  private participantLeftSubject = new Subject<{ participantId: string; participants: Participant[] }>();
  private videoChangedSubject = new Subject<{ url: string }>();
  private videoPlaySubject = new Subject<{ currentTime: number }>();
  private videoPauseSubject = new Subject<{ currentTime: number }>();
  private videoSeekSubject = new Subject<{ currentTime: number }>();
  private hostChangedSubject = new Subject<{ newHostId: string }>();
  
  // Subject para room_state
  private roomStateSubject = new Subject<{ users: Participant[] }>();
  public roomState$ = this.roomStateSubject.asObservable();
  
  // Subject para todos los mensajes (raw)
  private messageSubject = new Subject<any>();
  
  private connectionStateSubject = new BehaviorSubject<boolean>(false);
  public connectionState$ = this.connectionStateSubject.asObservable();

  constructor() {
    console.log('[SocketService] Service initialized');
  }

  // ============================================================
  // CONEXIÓN AL WEBSOCKET
  // ============================================================
  
  private connect(roomId: string, userId: string, username: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('[SocketService] Already connected');
        resolve();
        return;
      }

      const wsUrl = `${this.SERVER_URL}/ws/${roomId}?userId=${userId}&username=${encodeURIComponent(username)}`;
      console.log('[SocketService] Connecting to:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[SocketService] WebSocket connected!');
        this.connectionStateSubject.next(true);
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('[SocketService] WebSocket error:', error);
        this.connectionStateSubject.next(false);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('[SocketService] WebSocket closed');
        this.connectionStateSubject.next(false);
      };

      this.ws.onmessage = (event) => {
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
        case 'state':
          if (message.state) {
            this.videoChangedSubject.next({ url: message.state.videoFileName });
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
              
              this.roomStateSubject.next({
                users: roomData.users.map((u: any) => ({
                  id: u.userId,
                  username: u.username,
                  isHost: u.isHost
                }))
              });
            }
          } catch (e) {
            console.error('[SocketService] Error parsing room_state:', e);
          }
          break;

        case 'play':
          this.videoPlaySubject.next({ currentTime: message.timestamp || 0 });
          break;

        case 'pause':
          this.videoPauseSubject.next({ currentTime: message.timestamp || 0 });
          break;

        case 'seek':
          this.videoSeekSubject.next({ currentTime: message.timestamp || 0 });
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
            username: (message as any).username || 'Usuario',
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
      console.log('[SocketService] Sending message:', messageStr);
      this.ws.send(messageStr);
    } else {
      console.error('[SocketService] WebSocket not connected. Cannot send message.');
    }
  }

  // ============================================================
  // MÉTODOS PÚBLICOS
  // ============================================================

  async createRoom(username: string): Promise<void> {
    this.currentRoomId = this.generateRoomCode();
    this.currentUserId = this.generateUserId();
    this.currentUsername = username;

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

  changeVideo(roomCode: string, url: string): void {
    this.videoChangedSubject.next({ url });
  }

  playVideo(roomCode: string, currentTime: number): void {
    this.sendMessage({
      type: 'play',
      timestamp: currentTime
    });
  }

  pauseVideo(roomCode: string, currentTime: number): void {
    this.sendMessage({
      type: 'pause',
      timestamp: currentTime
    });
  }

  seekVideo(roomCode: string, currentTime: number): void {
    this.sendMessage({
      type: 'seek',
      timestamp: currentTime
    });
  }

  leaveRoom(): void {
    if (this.ws) {
      console.log('[SocketService] Leaving room and closing connection');
      this.ws.close();
      this.ws = null;
    }
    this.currentRoomId = '';
    this.currentUserId = '';
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

  onVideoChanged(): Observable<{ url: string }> {
    return this.videoChangedSubject.asObservable();
  }

  onVideoPlay(): Observable<{ currentTime: number }> {
    return this.videoPlaySubject.asObservable();
  }

  onVideoPause(): Observable<{ currentTime: number }> {
    return this.videoPauseSubject.asObservable();
  }

  onVideoSeek(): Observable<{ currentTime: number }> {
    return this.videoSeekSubject.asObservable();
  }

  onHostChanged(): Observable<{ newHostId: string }> {
    return this.hostChangedSubject.asObservable();
  }

  // Observable para todos los mensajes raw
  onMessage(): Observable<any> {
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
}