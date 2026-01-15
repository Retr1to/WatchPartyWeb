import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { AuthService } from './auth.service';

export interface Notification {
  type: string;
  data: any;
  timestamp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private reconnectTimer: any = null;

  private connectionStateSubject = new BehaviorSubject<boolean>(false);
  public connectionState$ = this.connectionStateSubject.asObservable();

  private notificationSubject = new Subject<Notification>();
  public notification$ = this.notificationSubject.asObservable();

  constructor(private authService: AuthService) {
    // Conectar automáticamente cuando el usuario inicia sesión
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  private getWebSocketUrl(): string {
    const token = this.authService.getToken();
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'localhost:5232'
      : window.location.host;
    return `${protocol}://${host}/notifications/ws?token=${encodeURIComponent(token || '')}`;
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      console.warn('[NotificationService] No token available, cannot connect');
      return;
    }

    try {
      const url = this.getWebSocketUrl();
      console.log('[NotificationService] Connecting to', url);
      
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[NotificationService] Connected');
        this.connectionStateSubject.next(true);
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const notification: Notification = JSON.parse(event.data);
          console.log('[NotificationService] Received:', notification);
          this.notificationSubject.next(notification);
        } catch (error) {
          console.error('[NotificationService] Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[NotificationService] WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('[NotificationService] Disconnected');
        this.connectionStateSubject.next(false);
        this.ws = null;
        
        // Intentar reconectar si el usuario aún está autenticado
        if (this.authService.isLoggedIn() && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('[NotificationService] Connection error:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 3);
    
    console.log(`[NotificationService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connectionStateSubject.next(false);
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
