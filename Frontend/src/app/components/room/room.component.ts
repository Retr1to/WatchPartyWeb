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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private socketService: SocketService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.roomCode = this.route.snapshot.paramMap.get('code') || '';
    console.log('RoomComponent initialized with code:', this.roomCode);
    
    // Obtener datos de la sala desde el estado del router
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || history.state;
    
    if (state && state['room']) {
      console.log('Room data received from router state:', state['room']);
      this.room = state['room'];
      if (this.room) {
        this.videoUrl = this.room.videoState.url;
        this.findCurrentUser();
      }
    }
    
    this.setupSocketListeners();
  }

  ngOnDestroy(): void {
    this.socketService.leaveRoom();
  }

  // Configura listeners de eventos WebSocket
  private setupSocketListeners(): void {
    this.socketService.onRoomCreated().subscribe(({ room }) => {
      console.log('Room created event received:', room);
      this.room = room;
      this.videoUrl = room.videoState.url;
      this.findCurrentUser();
    });

    this.socketService.onRoomJoined().subscribe(({ room }) => {
      console.log('Room joined event received:', room);
      this.room = room;
      this.videoUrl = room.videoState.url;
      this.findCurrentUser();
      
      if (this.videoUrl && this.videoPlayer) {
        setTimeout(() => {
          this.syncVideoState();
        }, 500);
      }
    });

    this.socketService.onParticipantJoined().subscribe(({ participants }) => {
      if (this.room) {
        const oldCount = this.room.participants.length;
        this.room.participants = participants;
        if (participants.length > oldCount) {
          const newParticipant = participants[participants.length - 1];
          this.toastService.info(`${newParticipant.username} se unió a la sala`);
        }
      }
    });

    this.socketService.onParticipantLeft().subscribe(({ participants }) => {
      if (this.room) {
        this.room.participants = participants;
        this.toastService.info('Un participante salió de la sala');
      }
    });

    this.socketService.onVideoChanged().subscribe(({ url }) => {
      this.videoUrl = url;
      this.newVideoUrl = '';
      this.toastService.success('Video cambiado exitosamente');
      if (this.videoPlayer) {
        this.videoPlayer.nativeElement.load();
      }
    });

    // Sincroniza reproducción de video entre usuarios
    this.socketService.onVideoPlay().subscribe(({ currentTime }) => {
      if (this.videoPlayer && !this.isSyncing) {
        const video = this.videoPlayer.nativeElement;
        video.currentTime = currentTime;
        video.play();
      }
    });

    this.socketService.onVideoPause().subscribe(({ currentTime }) => {
      if (this.videoPlayer && !this.isSyncing) {
        const video = this.videoPlayer.nativeElement;
        video.currentTime = currentTime;
        video.pause();
      }
    });

    this.socketService.onVideoSeek().subscribe(({ currentTime }) => {
      if (this.videoPlayer && !this.isSyncing) {
        this.videoPlayer.nativeElement.currentTime = currentTime;
      }
    });

    this.socketService.onHostChanged().subscribe(({ newHostId }) => {
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
  }

  private syncVideoState(): void {
    if (!this.room || !this.videoPlayer) return;
    
    const video = this.videoPlayer.nativeElement;
    video.currentTime = this.room.videoState.currentTime;
    
    if (this.room.videoState.isPlaying) {
      video.play();
    } else {
      video.pause();
    }
  }

  private findCurrentUser(): void {
    if (this.room) {
      this.currentUser = this.room.participants[0];
    }
  }

  changeVideo(): void {
    if (!this.newVideoUrl.trim()) return;
    
    this.socketService.changeVideo(this.roomCode, this.newVideoUrl);
    this.isChangingVideo = false;
  }

  onPlay(): void {
    if (this.videoPlayer && !this.isSyncing) {
      this.isSyncing = true;
      const currentTime = this.videoPlayer.nativeElement.currentTime;
      this.socketService.playVideo(this.roomCode, currentTime);
      setTimeout(() => this.isSyncing = false, 100);
    }
  }

  onPause(): void {
    if (this.videoPlayer && !this.isSyncing) {
      this.isSyncing = true;
      const currentTime = this.videoPlayer.nativeElement.currentTime;
      this.socketService.pauseVideo(this.roomCode, currentTime);
      setTimeout(() => this.isSyncing = false, 100);
    }
  }

  onSeeked(): void {
    if (this.videoPlayer && !this.isSyncing) {
      this.isSyncing = true;
      const currentTime = this.videoPlayer.nativeElement.currentTime;
      this.socketService.seekVideo(this.roomCode, currentTime);
      setTimeout(() => this.isSyncing = false, 100);
    }
  }

  copyRoomCode(): void {
    navigator.clipboard.writeText(this.roomCode);
    this.toastService.success(`Código ${this.roomCode} copiado al portapapeles`);
  }

  leaveRoom(): void {
    this.socketService.leaveRoom();
    this.router.navigate(['/']);
  }

  showVideoInput(): void {
    this.isChangingVideo = true;
  }

  cancelVideoChange(): void {
    this.isChangingVideo = false;
    this.newVideoUrl = '';
  }
}
