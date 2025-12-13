import { AfterViewInit, Component, DestroyRef, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService, Room, Participant } from '../../services/socket.service';
import { ToastService } from '../../services/toast.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

declare const YT: any;

type VideoProvider = 'file' | 'url' | 'youtube';
interface VideoSource {
  url: string;
  provider: VideoProvider;
  videoId?: string | null;
}

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.css']
})
export class RoomComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;
  @ViewChild('youtubePlayerContainer') youtubePlayerContainer!: ElementRef<HTMLDivElement>;
  
  roomCode: string = '';
  room: Room | null = null;
  currentUser: Participant | null = null;
  videoUrl: string = '';
  newVideoUrl: string = '';
  isChangingVideo: boolean = false;
  isSyncing: boolean = false;
  isConnected: boolean = false;
  private lastKnownIsPlaying: boolean = false;
  videoProvider: VideoProvider = 'file';
  videoId: string | null = null;
  private youtubePlayer: any = null;
  private youtubeApiReady: Promise<void> | null = null;
  private readonly allowedUrlExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
  private pendingVideoSource: { source: VideoSource; startTime: number; shouldPlay: boolean } | null = null;

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
      if (this.room && this.room.videoState.url) {
        this.applyVideoSource({
          url: this.room.videoState.url,
          provider: 'url'
        }, this.room.videoState.currentTime, this.room.videoState.isPlaying);
      }
      this.findCurrentUser();
    }
    
    this.setupSocketListeners();

    this.socketService.connectionState$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(connected => {
      this.isConnected = connected;
      console.log('[RoomComponent] Connection state:', connected);
    });
  }

  ngOnDestroy(): void {
    console.log('[RoomComponent] Component destroyed, leaving room');
    this.socketService.leaveRoom();
    this.destroyYouTubePlayer();
  }

  ngAfterViewInit(): void {
    if (this.pendingVideoSource) {
      const { source, startTime, shouldPlay } = this.pendingVideoSource;
      this.pendingVideoSource = null;
      this.applyVideoSource(source, startTime, shouldPlay);
    }
  }

  private setupSocketListeners(): void {
    this.socketService.onRoomCreated().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ roomCode, room }) => {
      console.log('[RoomComponent] Room created:', roomCode, room);
      this.room = room;
      this.roomCode = roomCode;
      if (room.videoState.url) {
        this.applyVideoSource({
          url: room.videoState.url,
          provider: 'url'
        }, room.videoState.currentTime, room.videoState.isPlaying);
      }
      this.findCurrentUser();
    });

    this.socketService.onRoomJoined().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ room }) => {
      console.log('[RoomComponent] Room joined:', room);
      this.room = room;
      if (room.videoState.url) {
        this.applyVideoSource({
          url: room.videoState.url,
          provider: 'url'
        }, room.videoState.currentTime, room.videoState.isPlaying);
      }
      this.findCurrentUser();
    });

    this.socketService.roomState$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(roomState => {
      console.log('[RoomComponent] Room state received:', roomState);
      
      if (this.room) {
        this.room.participants = roomState.users.map(u => ({
          id: u.id,
          username: u.username,
          isHost: u.isHost
        }));
        
        this.room.participants.sort((a, b) => {
          if (a.isHost && !b.isHost) return -1;
          if (!a.isHost && b.isHost) return 1;
          return 0;
        });
        
        console.log('[RoomComponent] Participants updated from room_state:', this.room.participants);
        this.findCurrentUser();
      }
    });

    this.socketService.onParticipantJoined().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ participant }) => {
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

    this.socketService.onParticipantLeft().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ participantId }) => {
      console.log('[RoomComponent] Participant left:', participantId);
      if (this.room) {
        this.room.participants = this.room.participants.filter(p => p.id !== participantId);
      }
    });

    this.socketService.onVideoChanged().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ url, provider, videoId }) => {
      console.log('[RoomComponent] Video changed:', url, provider ?? '');
      this.newVideoUrl = '';
      this.applyVideoSource({
        url,
        provider: this.normalizeProvider(provider),
        videoId: videoId || null
      }, 0, false);
    });

    this.socketService.onMessage().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((message: any) => {
      if (message.type === 'video_uploaded') {
        console.log('[RoomComponent] Video uploaded notification:', message);
        const url = `${this.socketService.getHttpBaseUrl()}/videos/${this.roomCode}/${message.videoFileName}`;
        this.applyVideoSource({
          url,
          provider: 'file'
        }, 0, false);
        this.toastService.success(`Video cargado: ${message.videoFileName}`);
      } else if (message.type === 'video_ready') {
        console.log('[RoomComponent] Video ready notification:', message);
        const incomingUrl = message.videoUrl || message.state?.videoUrl || `${this.socketService.getHttpBaseUrl()}/videos/${this.roomCode}/${message.videoFileName}`;
        const provider = this.normalizeProvider(message.provider || message.state?.provider);
        const videoId = message.videoId || message.state?.videoId || null;
        const startTime = message.state?.currentTime || 0;
        const shouldPlay = !!message.state?.isPlaying;
        this.applyVideoSource({
          url: incomingUrl,
          provider,
          videoId
        }, startTime, shouldPlay);
      }
    });

    this.socketService.onVideoPlay().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ currentTime }) => {
      console.log('[RoomComponent] Play event received, time:', currentTime);
      this.lastKnownIsPlaying = true;
      this.applyRemotePlay(currentTime);
    });

    this.socketService.onVideoPause().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ currentTime }) => {
      console.log('[RoomComponent] Pause event received, time:', currentTime);
      this.lastKnownIsPlaying = false;
      this.applyRemotePause(currentTime);
    });

    this.socketService.onVideoSeek().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ currentTime, isPlaying }) => {
      console.log('[RoomComponent] Seek event received, time:', currentTime, 'playing:', isPlaying);
      this.lastKnownIsPlaying = isPlaying;
      this.applyRemoteSeek(currentTime, isPlaying);
    });

    this.socketService.onHostChanged().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ newHostId }) => {
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

    this.socketService.onRoomError().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ message }) => {
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
    const source = this.parseVideoSource(this.newVideoUrl.trim());
    if (!source) {
      this.toastService.error('URL no soportada. Usa un enlace directo (.mp4, .webm, .ogg, .mov) o un enlace de YouTube.');
      return;
    }
    this.applyVideoSource(source, 0, false);
    this.socketService.changeVideo(this.roomCode, source.url, source.provider, source.videoId || undefined);
    this.isChangingVideo = false;
  }

  onPlay(): void {
    if (this.videoProvider === 'youtube') return;
    if (!this.isHost()) {
      console.log('[RoomComponent] Not host, ignoring play');
      return;
    }
    if (this.videoPlayer?.nativeElement && !this.isSyncing) {
      this.isSyncing = true;
      const currentTime = this.videoPlayer.nativeElement.currentTime;
      console.log('[RoomComponent] Sending play event, time:', currentTime);
      this.socketService.playVideo(this.roomCode, currentTime);
      this.lastKnownIsPlaying = true;
      setTimeout(() => this.isSyncing = false, 200);
    }
  }

  onPause(): void {
    if (this.videoProvider === 'youtube') return;
    if (!this.isHost()) {
      console.log('[RoomComponent] Not host, ignoring pause');
      return;
    }
    if (this.videoPlayer?.nativeElement && !this.isSyncing) {
      const video = this.videoPlayer.nativeElement;
      if (video.seeking) {
        console.log('[RoomComponent] Ignoring pause triggered by seeking');
        return;
      }
      this.isSyncing = true;
      const currentTime = video.currentTime;
      console.log('[RoomComponent] Sending pause event, time:', currentTime);
      this.socketService.pauseVideo(this.roomCode, currentTime);
      this.lastKnownIsPlaying = false;
      setTimeout(() => this.isSyncing = false, 200);
    }
  }

  onSeeked(): void {
    if (this.videoProvider === 'youtube') return;
    if (!this.isHost()) {
      console.log('[RoomComponent] Not host, ignoring seek');
      return;
    }
    if (this.videoPlayer?.nativeElement && !this.isSyncing) {
      this.isSyncing = true;
      const video = this.videoPlayer.nativeElement;
      const currentTime = video.currentTime;
      const isPlaying = this.lastKnownIsPlaying;
      console.log('[RoomComponent] Sending seek event, time:', currentTime, 'playing:', isPlaying);
      this.socketService.seekVideo(this.roomCode, currentTime, isPlaying);
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
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      alert('Tipo de archivo no válido. Usa MP4, WebM, OGG o MOV');
      return;
    }
    
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`El archivo es muy grande (${(file.size / 1024 / 1024).toFixed(2)} MB). Máximo 100 MB`);
      return;
    }

    const formData = new FormData();
    formData.append('video', file);

    try {
      console.log('[RoomComponent] Uploading video:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      
      const response = await fetch(`${this.socketService.getHttpBaseUrl()}/upload/${this.roomCode}`, {
        method: 'POST',
        headers: {
          'X-User-Id': this.currentUser?.id || ''
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[RoomComponent] Video uploaded successfully:', result);
        this.toastService.success(`Video subido: ${result.fileName}`);
      } else {
        const error = await response.text();
        console.error('[RoomComponent] Upload failed:', response.status, error);
        alert('⚠️ Error al subir: ' + error);
      }
    } catch (error) {
      console.error('[RoomComponent] Upload error:', error);
      alert('⚠️ Error de red: ' + error);
    }
  }

  private parseVideoSource(url: string): VideoSource | null {
    const ytId = this.extractYouTubeId(url);
    if (ytId) {
      return { url, provider: 'youtube', videoId: ytId };
    }
    if (this.isDirectVideoUrl(url)) {
      return { url, provider: 'url', videoId: null };
    }
    return null;
  }

  private normalizeProvider(provider?: string): VideoProvider {
    if (provider === 'youtube') return 'youtube';
    if (provider === 'url' || provider === 'file') return provider;
    return 'url';
  }

  private isDirectVideoUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const lowerPath = parsed.pathname.toLowerCase();
      return this.allowedUrlExtensions.some(ext => lowerPath.endsWith(ext));
    } catch {
      return false;
    }
  }

  private extractYouTubeId(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtube.com')) {
        const v = parsed.searchParams.get('v');
        if (v) return v;
        if (parsed.pathname.startsWith('/embed/')) {
          const parts = parsed.pathname.split('/');
          return parts[parts.length - 1] || null;
        }
      }
      if (parsed.hostname === 'youtu.be') {
        const id = parsed.pathname.replace('/', '');
        return id || null;
      }
    } catch {
      return null;
    }
    return null;
  }

  private async applyVideoSource(source: VideoSource, startTime: number, shouldPlay: boolean): Promise<void> {
    this.videoProvider = source.provider;
    this.videoId = source.videoId || null;
    this.videoUrl = source.url;
    this.lastKnownIsPlaying = shouldPlay;

    if (source.provider === 'youtube') {
      if (!this.youtubePlayerContainer) {
        this.pendingVideoSource = { source, startTime, shouldPlay };
        return;
      }
      this.pendingVideoSource = null;
      await this.initYouTubePlayer(source.videoId || '', startTime, shouldPlay);
      return;
    }

    this.pendingVideoSource = null;
    if (!this.videoPlayer?.nativeElement) {
      this.pendingVideoSource = { source, startTime, shouldPlay };
      return;
    }
    this.destroyYouTubePlayer();
    if (this.videoPlayer?.nativeElement) {
      const video = this.videoPlayer.nativeElement;
      video.src = this.videoUrl;
      video.load();
      if (Math.abs(video.currentTime - startTime) > 0.5) {
        video.currentTime = startTime;
      }
      if (shouldPlay) {
        video.play().catch(err => {
          console.error('[RoomComponent] Play failed:', err);
        });
      } else {
        video.pause();
      }
    }
  }

  private applyRemotePlay(currentTime: number): void {
    if (this.isSyncing) return;

    if (this.videoProvider === 'youtube' && this.youtubePlayer) {
      this.isSyncing = true;
      if (Math.abs(this.youtubePlayer.getCurrentTime() - currentTime) > 0.5) {
        this.youtubePlayer.seekTo(currentTime, true);
      }
      this.youtubePlayer.playVideo();
      setTimeout(() => this.isSyncing = false, 200);
      return;
    }

    if (this.videoPlayer?.nativeElement && !this.isSyncing) {
      const video = this.videoPlayer.nativeElement;
      if (Math.abs(video.currentTime - currentTime) > 1) {
        video.currentTime = currentTime;
      }
      video.play().catch(err => {
        console.error('[RoomComponent] Play failed:', err);
      });
    }
  }

  private applyRemotePause(currentTime: number): void {
    if (this.isSyncing) return;

    if (this.videoProvider === 'youtube' && this.youtubePlayer) {
      this.isSyncing = true;
      if (Math.abs(this.youtubePlayer.getCurrentTime() - currentTime) > 0.5) {
        this.youtubePlayer.seekTo(currentTime, true);
      }
      this.youtubePlayer.pauseVideo();
      setTimeout(() => this.isSyncing = false, 200);
      return;
    }

    if (this.videoPlayer?.nativeElement && !this.isSyncing) {
      const video = this.videoPlayer.nativeElement;
      if (Math.abs(video.currentTime - currentTime) > 1) {
        video.currentTime = currentTime;
      }
      video.pause();
    }
  }

  private applyRemoteSeek(currentTime: number, isPlaying: boolean): void {
    if (this.isSyncing) return;

    if (this.videoProvider === 'youtube' && this.youtubePlayer) {
      this.isSyncing = true;
      this.youtubePlayer.seekTo(currentTime, true);
      if (isPlaying) {
        this.youtubePlayer.playVideo();
      } else {
        this.youtubePlayer.pauseVideo();
      }
      setTimeout(() => this.isSyncing = false, 200);
      return;
    }

    if (this.videoPlayer?.nativeElement && !this.isSyncing) {
      const video = this.videoPlayer.nativeElement;
      video.currentTime = currentTime;
      if (isPlaying) {
        video.play().catch(err => {
          console.error('[RoomComponent] Play after seek failed:', err);
        });
      } else {
        video.pause();
      }
    }
  }

  private loadYouTubeApi(): Promise<void> {
    if (this.youtubeApiReady) {
      return this.youtubeApiReady;
    }

    this.youtubeApiReady = new Promise<void>((resolve) => {
      const win = window as any;
      if (win.YT && win.YT.Player) {
        resolve();
        return;
      }
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      (win as any).onYouTubeIframeAPIReady = () => {
        resolve();
      };
    });

    return this.youtubeApiReady;
  }

  private async initYouTubePlayer(videoId: string, startTime: number, shouldPlay: boolean): Promise<void> {
    await this.loadYouTubeApi();
    const container = this.youtubePlayerContainer?.nativeElement;
    if (!container) {
      console.warn('[RoomComponent] YouTube container not available');
      return;
    }

    if (this.youtubePlayer) {
      this.youtubePlayer.loadVideoById({ videoId, startSeconds: startTime });
      if (shouldPlay) {
        this.youtubePlayer.playVideo();
      } else {
        this.youtubePlayer.pauseVideo();
      }
      return;
    }

    this.youtubePlayer = new YT.Player(container, {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        controls: this.isHost() ? 1 : 0,
        disablekb: this.isHost() ? 0 : 1,
        modestbranding: 1,
        rel: 0,
        enablejsapi: 1
      },
      events: {
        onReady: () => {
          this.youtubePlayer.seekTo(startTime, true);
          if (shouldPlay) {
            this.youtubePlayer.playVideo();
          } else {
            this.youtubePlayer.pauseVideo();
          }
        },
        onStateChange: (event: any) => this.handleYouTubeStateChange(event)
      }
    });
  }

  private destroyYouTubePlayer(): void {
    if (this.youtubePlayer) {
      this.youtubePlayer.destroy();
      this.youtubePlayer = null;
    }
  }

  private handleYouTubeStateChange(event: any): void {
    if (!this.isHost()) return;
    if (this.isSyncing) return;
    if (!this.youtubePlayer) return;

    const currentTime = this.youtubePlayer.getCurrentTime ? this.youtubePlayer.getCurrentTime() : 0;

    switch (event.data) {
      case YT.PlayerState.PLAYING:
        this.lastKnownIsPlaying = true;
        this.isSyncing = true;
        this.socketService.playVideo(this.roomCode, currentTime);
        setTimeout(() => this.isSyncing = false, 200);
        break;
      case YT.PlayerState.PAUSED:
        this.lastKnownIsPlaying = false;
        this.isSyncing = true;
        this.socketService.pauseVideo(this.roomCode, currentTime);
        setTimeout(() => this.isSyncing = false, 200);
        break;
      case YT.PlayerState.BUFFERING:
        this.isSyncing = true;
        this.socketService.seekVideo(this.roomCode, currentTime, this.lastKnownIsPlaying);
        setTimeout(() => this.isSyncing = false, 200);
        break;
      default:
        break;
    }
  }
}
