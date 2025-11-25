import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService, Room, Participant } from '../../services/socket.service';

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.css']
})
export class RoomComponent implements OnInit, OnDestroy {
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;
  
  roomCode: string = '';
  room: Room | null = null;
  currentUser: Participant | null = null;
  videoUrl: string = '';
  newVideoUrl: string = '';
  isChangingVideo: boolean = false;
  isSyncing: boolean = false;
  isConnected: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private socketService: SocketService
  ) {}

  ngOnInit(): void {
    this.roomCode = this.route.snapshot.paramMap.get('code') || '';
    console.log('[RoomComponent] Initialized with code:', this.roomCode);
    
    // Obtener datos de la sala desde el estado del router
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || history.state;
    
    if (state && state['room']) {
      console.log('[RoomComponent] Room data from router:', state['room']);
      this.room = state['room'];
      if (this.room) {
        this.videoUrl = this.room.videoState.url;
        this.findCurrentUser();
      }
    }
    
    this.setupSocketListeners();

    // Monitorear estado de conexión
    this.socketService.connectionState$.subscribe(connected => {
      this.isConnected = connected;
      console.log('[RoomComponent] Connection state:', connected);
    });
  }

  ngOnDestroy(): void {
    console.log('[RoomComponent] Component destroyed, leaving room');
    this.socketService.leaveRoom();
  }

  // Configura listeners de eventos WebSocket
  private setupSocketListeners(): void {
    this.socketService.onRoomCreated().subscribe(({ roomCode, room }) => {
      console.log('[RoomComponent] Room created:', roomCode, room);
      this.room = room;
      this.roomCode = roomCode;
      this.videoUrl = room.videoState.url;
      this.findCurrentUser();
    });

    this.socketService.onRoomJoined().subscribe(({ room }) => {
      console.log('[RoomComponent] Room joined:', room);
      this.room = room;
      this.videoUrl = room.videoState.url;
      this.findCurrentUser();
    });

    // ✅✅✅ NUEVO: Escuchar room_state para sincronizar lista completa de usuarios ✅✅✅
    this.socketService.roomState$.subscribe(roomState => {
      console.log('[RoomComponent] Room state received:', roomState);
      
      if (this.room) {
        // Reemplazar completamente la lista de participantes con los usuarios actuales
        this.room.participants = roomState.users.map(u => ({
          id: u.id,
          username: u.username,
          isHost: u.isHost
        }));
        
        // ✅ Ordenar: anfitrión siempre primero
        this.room.participants.sort((a, b) => {
          if (a.isHost && !b.isHost) return -1;
          if (!a.isHost && b.isHost) return 1;
          return 0;
        });
        
        console.log('[RoomComponent] Participants updated from room_state:', this.room.participants);
        
        // Re-identificar al usuario actual después de actualizar la lista
        this.findCurrentUser();
      }
    });
    // ✅✅✅ FIN ✅✅✅

    this.socketService.onParticipantJoined().subscribe(({ participant, participants }) => {
      console.log('[RoomComponent] Participant joined:', participant);
      if (this.room) {
        // Agregar nuevo participante si no existe
        const exists = this.room.participants.find(p => p.id === participant.id);
        if (!exists) {
          this.room.participants.push(participant);
          
          // ✅ Ordenar: anfitrión siempre primero
          this.room.participants.sort((a, b) => {
            if (a.isHost && !b.isHost) return -1;
            if (!a.isHost && b.isHost) return 1;
            return 0;
          });
        }
      }
    });

    this.socketService.onParticipantLeft().subscribe(({ participantId }) => {
      console.log('[RoomComponent] Participant left:', participantId);
      if (this.room) {
        this.room.participants = this.room.participants.filter(p => p.id !== participantId);
      }
    });

    this.socketService.onVideoChanged().subscribe(({ url }) => {
      console.log('[RoomComponent] Video changed:', url);
      this.videoUrl = url;
      this.newVideoUrl = '';
      
      if (this.videoPlayer && url) {
        // Cargar el nuevo video
        const videoElement = this.videoPlayer.nativeElement;
        // Construir URL para servir el video desde el backend
        videoElement.src = `https://localhost:7186/videos/${this.roomCode}/${url}`;
        videoElement.load();
      }
    });

    // Sincroniza reproducción de video entre usuarios
    this.socketService.onVideoPlay().subscribe(({ currentTime }) => {
      console.log('[RoomComponent] Play event received, time:', currentTime);
      if (this.videoPlayer && !this.isSyncing) {
        const video = this.videoPlayer.nativeElement;
        
        // Solo sincronizar si la diferencia es significativa (> 1 segundo)
        if (Math.abs(video.currentTime - currentTime) > 1) {
          video.currentTime = currentTime;
        }
        
        video.play().catch(err => {
          console.error('[RoomComponent] Play failed:', err);
        });
      }
    });

    this.socketService.onVideoPause().subscribe(({ currentTime }) => {
      console.log('[RoomComponent] Pause event received, time:', currentTime);
      if (this.videoPlayer && !this.isSyncing) {
        const video = this.videoPlayer.nativeElement;
        
        // Solo sincronizar si la diferencia es significativa (> 1 segundo)
        if (Math.abs(video.currentTime - currentTime) > 1) {
          video.currentTime = currentTime;
        }
        
        video.pause();
      }
    });

    this.socketService.onVideoSeek().subscribe(({ currentTime }) => {
      console.log('[RoomComponent] Seek event received, time:', currentTime);
      if (this.videoPlayer && !this.isSyncing) {
        this.videoPlayer.nativeElement.currentTime = currentTime;
      }
    });

    this.socketService.onHostChanged().subscribe(({ newHostId }) => {
      console.log('[RoomComponent] Host changed to:', newHostId);
      if (this.room) {
        this.room.participants.forEach(p => {
          p.isHost = p.id === newHostId;
        });
        this.findCurrentUser();
      }
    });

    this.socketService.onRoomError().subscribe(({ message }) => {
      console.error('[RoomComponent] Room error:', message);
      alert('Error: ' + message);
      this.router.navigate(['/']);
    });
  }

  private findCurrentUser(): void {
    if (this.room) {
      // Buscar al usuario actual por el ID del servicio
      const currentUserId = this.socketService.getCurrentUserId();
      this.currentUser = this.room.participants.find(p => p.id === currentUserId) || null;
      
      if (!this.currentUser && this.room.participants.length > 0) {
        // Fallback: usar el primer participante
        this.currentUser = this.room.participants[0];
      }
      
      console.log('[RoomComponent] Current user:', this.currentUser);
    }
  }

  // ============================================================
  // CONTROLES DE VIDEO - Solo el host puede controlar
  // ============================================================

  changeVideo(): void {
    if (!this.newVideoUrl.trim()) return;
    if (!this.isHost()) {
      alert('Only the host can change the video');
      return;
    }
    
    this.socketService.changeVideo(this.roomCode, this.newVideoUrl);
    this.isChangingVideo = false;
  }

  onPlay(): void {
    if (!this.isHost()) {
      console.log('[RoomComponent] Not host, ignoring play');
      return;
    }
    
    if (this.videoPlayer && !this.isSyncing) {
      this.isSyncing = true;
      const currentTime = this.videoPlayer.nativeElement.currentTime;
      console.log('[RoomComponent] Sending play event, time:', currentTime);
      this.socketService.playVideo(this.roomCode, currentTime);
      setTimeout(() => this.isSyncing = false, 200);
    }
  }

  onPause(): void {
    if (!this.isHost()) {
      console.log('[RoomComponent] Not host, ignoring pause');
      return;
    }
    
    if (this.videoPlayer && !this.isSyncing) {
      this.isSyncing = true;
      const currentTime = this.videoPlayer.nativeElement.currentTime;
      console.log('[RoomComponent] Sending pause event, time:', currentTime);
      this.socketService.pauseVideo(this.roomCode, currentTime);
      setTimeout(() => this.isSyncing = false, 200);
    }
  }

  onSeeked(): void {
    if (!this.isHost()) {
      console.log('[RoomComponent] Not host, ignoring seek');
      return;
    }
    
    if (this.videoPlayer && !this.isSyncing) {
      this.isSyncing = true;
      const currentTime = this.videoPlayer.nativeElement.currentTime;
      console.log('[RoomComponent] Sending seek event, time:', currentTime);
      this.socketService.seekVideo(this.roomCode, currentTime);
      setTimeout(() => this.isSyncing = false, 200);
    }
  }

  // ============================================================
  // UTILIDADES
  // ============================================================

  isHost(): boolean {
    return this.currentUser?.isHost || false;
  }

  copyRoomCode(): void {
    navigator.clipboard.writeText(this.roomCode).then(() => {
      console.log('[RoomComponent] Room code copied:', this.roomCode);
      // Podrías agregar un toast notification aquí
    });
  }

  leaveRoom(): void {
    console.log('[RoomComponent] Leaving room manually');
    this.socketService.leaveRoom();
    this.router.navigate(['/']);
  }

  showVideoInput(): void {
    if (!this.isHost()) {
      alert('Only the host can change the video');
      return;
    }
    this.isChangingVideo = true;
  }

  cancelVideoChange(): void {
    this.isChangingVideo = false;
    this.newVideoUrl = '';
  }

  // ============================================================
  // MÉTODOS PARA UPLOAD DE VIDEO (NUEVO)
  // ============================================================

  onFileSelected(event: any): void {
    if (!this.isHost()) {
      alert('Only the host can upload videos');
      return;
    }

    const file: File = event.target.files[0];
    if (file) {
      this.uploadVideo(file);
    }
  }

  private async uploadVideo(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await fetch(`https://localhost:7186/upload/${this.roomCode}`, {
        method: 'POST',
        headers: {
          'X-Is-Host': 'true'
        },
        body: formData
      });

      if (response.ok) {
        const text = await response.text();
        console.log('[RoomComponent] Video uploaded:', text);
        alert('Video uploaded successfully!');
      } else {
        console.error('[RoomComponent] Upload failed:', response.status);
        alert('Upload failed: ' + response.statusText);
      }
    } catch (error) {
      console.error('[RoomComponent] Upload error:', error);
      alert('Upload error: ' + error);
    }
  }
}