import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService, Room, Participant } from '../../services/socket.service';
import { ToastService } from '../../services/toast.service';

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
    private socketService: SocketService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.roomCode = this.route.snapshot.paramMap.get('code') || '';
    console.log('[RoomComponent] Initialized with code:', this.roomCode);
    
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

    this.socketService.connectionState$.subscribe(connected => {
      this.isConnected = connected;
      console.log('[RoomComponent] Connection state:', connected);
    });
  }

  ngOnDestroy(): void {
    console.log('[RoomComponent] Component destroyed, leaving room');
    this.socketService.leaveRoom();
  }

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

    // ✅ Escuchar room_state para sincronizar lista completa de usuarios
    this.socketService.roomState$.subscribe(roomState => {
      console.log('[RoomComponent] Room state received:', roomState);
      
      if (this.room) {
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
        this.findCurrentUser();
      }
    });

    // ✅ Verificar si el participante ya existe antes de agregarlo
    this.socketService.onParticipantJoined().subscribe(({ participant }) => {
      console.log('[RoomComponent] Participant joined:', participant);
      if (this.room) {
        const exists = this.room.participants.find(p => p.id === participant.id);
        if (!exists) {
          this.room.participants.push(participant);
          
          this.room.participants.sort((a, b) => {
            if (a.isHost && !b.isHost) return -1;
            if (!a.isHost && b.isHost) return 1;
            return 0;
          });
          
          console.log('[RoomComponent] New participant added:', participant.username);
        } else {
          console.log('[RoomComponent] Participant already exists (from room_state):', participant.username);
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
      if (this.videoPlayer) {
        this.videoPlayer.nativeElement.load();
      }
    });

    // Escuchar cuando se sube un video
    this.socketService.onMessage().subscribe((message: any) => {
      if (message.type === 'video_uploaded') {
        console.log('[RoomComponent] Video uploaded notification:', message);
        // Construir URL del video
        this.videoUrl = `https://localhost:7186/videos/${this.roomCode}/${message.videoFileName}`;
        console.log('[RoomComponent] Video URL set to:', this.videoUrl);
        
        // Recargar el video player
        if (this.videoPlayer) {
          this.videoPlayer.nativeElement.load();
        }
        
        this.toastService.success(`Video cargado: ${message.videoFileName}`);
      } else if (message.type === 'video_ready') {
        console.log('[RoomComponent] Video ready notification:', message);
        this.videoUrl = `https://localhost:7186/videos/${this.roomCode}/${message.videoFileName}`;
        
        if (this.videoPlayer && message.state) {
          const video = this.videoPlayer.nativeElement;
          video.currentTime = message.state.currentTime;
          if (message.state.isPlaying) {
            video.play();
          }
        }
      }
    });

    this.socketService.onVideoPlay().subscribe(({ currentTime }) => {
      console.log('[RoomComponent] Play event received, time:', currentTime);
      if (this.videoPlayer && !this.isSyncing) {
        const video = this.videoPlayer.nativeElement;
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
        const newHost = this.room.participants.find(p => p.id === newHostId);
        if (newHost) {
          this.toastService.warning(`${newHost.username} es ahora el anfitrión`);
        }
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
      const currentUserId = this.socketService.getCurrentUserId();
      this.currentUser = this.room.participants.find(p => p.id === currentUserId) || null;
      
      if (!this.currentUser && this.room.participants.length > 0) {
        this.currentUser = this.room.participants[0];
      }
      
      console.log('[RoomComponent] Current user:', this.currentUser);
    }
  }

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

  isHost(): boolean {
    return this.currentUser?.isHost || false;
  }

  copyRoomCode(): void {
    navigator.clipboard.writeText(this.roomCode);
    this.toastService.success('Código copiado al portapapeles');
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

  onFileSelected(event: any): void {
    if (!this.isHost()) {
      alert('Solo el anfitrión puede subir videos');
      return;
    }
    const file: File = event.target.files[0];
    if (file) {
      this.uploadVideo(file);
    }
  }

  private async uploadVideo(file: File): Promise<void> {
    // ✅ Validar tipo de archivo
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      alert('Tipo de archivo no válido. Usa MP4, WebM, OGG o MOV');
      return;
    }
    
    // ✅ Validar tamaño (máximo 100 MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`El archivo es muy grande (${(file.size / 1024 / 1024).toFixed(2)} MB). Máximo 100 MB`);
      return;
    }

    const formData = new FormData();
    formData.append('video', file);

    try {
      console.log('[RoomComponent] Uploading video:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      
      const response = await fetch(`https://localhost:7186/upload/${this.roomCode}`, {
        method: 'POST',
        headers: {
          'X-User-Id': this.currentUser?.id || ''
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[RoomComponent] Video uploaded successfully:', result);
        this.toastService.success(`✅ Video subido: ${result.fileName}`);
        
        // El WebSocket recibirá automáticamente el mensaje "video_uploaded"
      } else {
        const error = await response.text();
        console.error('[RoomComponent] Upload failed:', response.status, error);
        alert('❌ Error al subir: ' + error);
      }
    } catch (error) {
      console.error('[RoomComponent] Upload error:', error);
      alert('❌ Error de red: ' + error);
    }
  }
}