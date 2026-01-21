import { AfterViewInit, Component, DestroyRef, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService, Room, Participant } from '../../services/socket.service';
import { ToastService } from '../../services/toast.service';
import { CastService, CastStatus } from '../../services/cast.service';
import { AirPlayService, AirPlayStatus } from '../../services/airplay.service';
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
  needsJoin: boolean = false;
  joinUsername: string = '';
  isJoining: boolean = false;
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
  private youtubeTimePollId: number | null = null;
  private lastAllowedYouTubeTime = 0;
  private readonly allowedUrlExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
  private pendingVideoSource: { source: VideoSource; startTime: number; shouldPlay: boolean } | null = null;
  private lastAllowedVideoTime = 0;
  private lastViewerWarningAt = 0;
  private lastLatencyCapWarningAt = 0;
  private viewerIsSeeking = false;
  private viewerSeekRestoreTime: number | null = null;

  castStatus: CastStatus | null = null;
  airplayStatus: AirPlayStatus | null = null;
  private lastCastObservedTime = 0;
  private lastCastObservedAt = 0;
  private lastCastObservedPaused: boolean | null = null;
  private lastCastLoadedUrl: string | null = null;
  private localVideoAudioSnapshot: { muted: boolean; volume: number } | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private socketService: SocketService,
    private toastService: ToastService,
    private castService: CastService,
    private airplayService: AirPlayService
  ) {}

  ngOnInit(): void {
    this.roomCode = this.route.snapshot.paramMap.get('code') || '';
    
    if (!this.roomCode) {
      console.error('[RoomComponent] No room code in route, navigating home');
      this.router.navigate(['/']);
      return;
    }
    
    console.log('[RoomComponent] Initialized with code:', this.roomCode);
    
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || history.state;
    
    if (state && state['room']) {
      console.log('[RoomComponent] Room data from router:', state['room']);
      this.room = state['room'];
      if (this.room) {
        this.room.code = this.roomCode; // Ensure room.code is set from route
        if (this.room.videoState.url) {
          this.applyVideoSource({
            url: this.room.videoState.url,
            provider: 'url'
          }, this.room.videoState.currentTime, this.room.videoState.isPlaying);
        }
        this.findCurrentUser();
      }
      this.needsJoin = false;
    } else {
      this.needsJoin = true;
      this.joinUsername = this.getStoredUsername() || '';
    }
    
    this.setupSocketListeners();

    this.socketService.connectionState$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(connected => {
      this.isConnected = connected;
      console.log('[RoomComponent] Connection state:', connected);
    });

    this.castService.init().catch(() => {
      // Cast is optional (Chromecast/Google TV)
    });

    this.castService.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status) => {
      this.castStatus = status;

      if (!status.isConnected) {
        this.lastCastObservedAt = 0;
        this.lastCastObservedTime = 0;
        this.lastCastObservedPaused = null;
        this.lastCastLoadedUrl = null;
        this.restoreLocalAudioAfterCast();
        return;
      }

      this.enableLocalCastMirror();

      if (this.isHost()) {
        this.handleCastStatusForRoomSync(status);
      }

      this.mirrorCastStatusToLocal(status);
    });

    this.airplayService.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status) => {
      this.airplayStatus = status;
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
      this.roomCode = roomCode; // Update roomCode from server
      this.room.code = roomCode; // Ensure room.code is set
      console.log('[RoomComponent] Room code set to:', this.roomCode);
      this.needsJoin = false;
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
      // Ensure roomCode is preserved - use room.code if available, otherwise keep this.roomCode
      if (room.code && !this.roomCode) {
        this.roomCode = room.code;
        console.log('[RoomComponent] Room code recovered from room object:', this.roomCode);
      }
      this.room.code = this.roomCode; // Ensure room.code matches roomCode
      this.needsJoin = false;
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

    this.socketService.onVideoPlay().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ currentTime, sentAtUnixMs }) => {
      const adjustedTime = this.adjustRemoteTimeForLatency(currentTime, sentAtUnixMs, true);
      console.log('[RoomComponent] Play event received, time:', currentTime, 'adjusted:', adjustedTime);
      this.lastKnownIsPlaying = true;
      this.applyRemotePlay(adjustedTime);
    });

    this.socketService.onVideoPause().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ currentTime }) => {
      console.log('[RoomComponent] Pause event received, time:', currentTime);
      this.lastKnownIsPlaying = false;
      this.applyRemotePause(currentTime);
    });

    this.socketService.onVideoSeek().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ currentTime, isPlaying, sentAtUnixMs }) => {
      const adjustedTime = this.adjustRemoteTimeForLatency(currentTime, sentAtUnixMs, isPlaying);
      console.log('[RoomComponent] Seek event received, time:', currentTime, 'adjusted:', adjustedTime, 'playing:', isPlaying);
      this.lastKnownIsPlaying = isPlaying;
      this.applyRemoteSeek(adjustedTime, isPlaying);
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

  private getStoredUsername(): string {
    try {
      return localStorage.getItem('WATCHPARTY_USERNAME') || '';
    } catch {
      return '';
    }
  }

  private storeUsername(username: string): void {
    try {
      localStorage.setItem('WATCHPARTY_USERNAME', username);
    } catch {
      // ignore
    }
  }

  joinFromLink(): void {
    if (!this.roomCode) return;
    if (this.isJoining) return;

    const username = (this.joinUsername || '').trim() || 'Usuario';
    this.storeUsername(username);

    this.isJoining = true;
    this.needsJoin = false;
    this.socketService.joinRoom(this.roomCode, username).finally(() => {
      this.isJoining = false;
    });
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
      if (this.isSyncing) return;
      this.handleViewerPlaybackAttempt('play');
      return;
    }
    if (this.videoPlayer?.nativeElement && !this.isSyncing) {
      this.isSyncing = true;
      const currentTime = this.videoPlayer.nativeElement.currentTime;
      console.log('[RoomComponent] Sending play event, time:', currentTime);
      if (this.castService.isConnected()) {
        const castTime = this.castStatus?.currentTime ?? 0;
        if (Math.abs(castTime - currentTime) > 1) {
          this.castService.seek(currentTime);
        }
        this.castService.play();
      }
      this.socketService.playVideo(this.roomCode, currentTime);
      this.lastKnownIsPlaying = true;
      setTimeout(() => this.isSyncing = false, 200);
    }
  }

  onPause(): void {
    if (this.videoProvider === 'youtube') return;
    if (!this.isHost()) {
      if (this.isSyncing) return;
      this.handleViewerPlaybackAttempt('pause');
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
      if (this.castService.isConnected()) {
        const castTime = this.castStatus?.currentTime ?? 0;
        if (Math.abs(castTime - currentTime) > 1) {
          this.castService.seek(currentTime);
        }
        this.castService.pause();
      }
      this.socketService.pauseVideo(this.roomCode, currentTime);
      this.lastKnownIsPlaying = false;
      setTimeout(() => this.isSyncing = false, 200);
    }
  }

  onSeeking(): void {
    if (this.videoProvider === 'youtube') return;
    if (this.isHost()) return;
    if (this.isSyncing) return;

    const video = this.videoPlayer?.nativeElement;
    if (!video) return;

    this.viewerIsSeeking = true;
    this.viewerSeekRestoreTime = this.lastAllowedVideoTime;
  }

  onSeeked(): void {
    if (this.videoProvider === 'youtube') return;
    if (!this.isHost()) {
      if (this.isSyncing) return;
      this.handleViewerPlaybackAttempt('seek');
      return;
    }
    if (this.videoPlayer?.nativeElement && !this.isSyncing) {
      this.isSyncing = true;
      const video = this.videoPlayer.nativeElement;
      const currentTime = video.currentTime;
      const isPlaying = !video.paused;
      console.log('[RoomComponent] Sending seek event, time:', currentTime, 'playing:', isPlaying);
      if (this.castService.isConnected()) {
        this.castService.seek(currentTime);
        if (isPlaying) {
          this.castService.play();
        } else {
          this.castService.pause();
        }
      }
      this.socketService.seekVideo(this.roomCode, currentTime, isPlaying);
      this.lastKnownIsPlaying = isPlaying;
      setTimeout(() => this.isSyncing = false, 200);
    }
  }

  onTimeUpdate(): void {
    if (this.videoProvider === 'youtube') return;
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    if (this.isSyncing) return;
    if (video.seeking) return;
    if (!this.isHost() && this.viewerIsSeeking) return;
    this.lastAllowedVideoTime = video.currentTime;
  }

  isHost(): boolean {
    return this.currentUser?.isHost || false;
  }

  copyRoomCode(): void {
    navigator.clipboard.writeText(this.roomCode);
    this.toastService.success('Código copiado al portapapeles');
  }

  copyInviteLink(): void {
    const link = `${window.location.origin}/room/${this.roomCode}`;
    navigator.clipboard.writeText(link);
    this.toastService.success('Enlace copiado al portapapeles');
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

  async startCasting(): Promise<void> {
    if (!this.isHost()) {
      this.toastService.warning('Solo el anfitrión puede usar Cast.');
      return;
    }
    if (!this.videoUrl) {
      this.toastService.warning('No hay video para enviar.');
      return;
    }
    if (this.videoProvider === 'youtube') {
      this.toastService.warning(
        'Cast desde el reproductor de YouTube no está soportado aquí. Usa un enlace directo (.mp4/.webm) o un archivo subido.'
      );
      return;
    }

    if (this.isLikelyLocalOnlyUrl(this.videoUrl)) {
      this.toastService.warning('Para hacer Cast, la TV debe poder acceder a la URL del video (evita localhost/127.0.0.1).');
    }

    try {
      await this.castService.requestSession();
      const startTime = this.getCurrentPlaybackTimeSeconds();
      const shouldPlay = this.lastKnownIsPlaying;
      await this.castCurrentVideo(startTime, shouldPlay);
      this.toastService.success('Conectado a Cast.');
    } catch (e) {
      console.error('[RoomComponent] Cast start failed:', e);
      this.toastService.error('No se pudo iniciar Cast.');
    }
  }

  async stopCasting(): Promise<void> {
    try {
      await this.castService.endSession(true);
    } catch (e) {
      console.error('[RoomComponent] Cast stop failed:', e);
    }
  }

  showAirPlayPicker(): void {
    if (!this.isHost()) return;
    if (this.videoProvider === 'youtube') return;
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    this.airplayService.showPicker(video);
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
    if (!this.roomCode) {
      console.error('[RoomComponent] Cannot upload: roomCode is missing');
      this.toastService.error('Error: No hay código de sala');
      return;
    }

    if (!this.currentUser) {
      console.error('[RoomComponent] Cannot upload: currentUser is missing');
      this.toastService.error('Error: Usuario no identificado');
      return;
    }

    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      this.toastService.error('Tipo de archivo no válido. Usa MP4, WebM, OGG o MOV');
      return;
    }
    
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      this.toastService.error(`El archivo es muy grande (${(file.size / 1024 / 1024).toFixed(2)} MB). Máximo 100 MB`);
      return;
    }

    const formData = new FormData();
    formData.append('video', file);

    const uploadUrl = `${this.socketService.getHttpBaseUrl()}/upload/${this.roomCode}`;
    console.log('[RoomComponent] Uploading video to:', uploadUrl);
    console.log('[RoomComponent] Room code:', this.roomCode);
    console.log('[RoomComponent] User ID:', this.currentUser.id);
    console.log('[RoomComponent] File:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'X-User-Id': this.currentUser.id,
          'X-Session-Key': this.socketService.getSessionKey()
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[RoomComponent] Video uploaded successfully:', result);
        this.toastService.success(`Video subido: ${result.fileName}`);
      } else {
        const contentType = response.headers.get('content-type');
        let errorMessage = `Error ${response.status}`;
        
        try {
          if (contentType?.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          }
        } catch (e) {
          console.error('[RoomComponent] Could not parse error response:', e);
        }
        
        console.error('[RoomComponent] Upload failed:', response.status, response.statusText, errorMessage);
        this.toastService.error(`Error al subir video: ${errorMessage}`);
      }
    } catch (error) {
      console.error('[RoomComponent] Upload error:', error);
      this.toastService.error(`Error de red: ${error}`);
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
        if (parsed.pathname.startsWith('/shorts/')) {
          const parts = parsed.pathname.split('/').filter(Boolean);
          return parts[1] || null;
        }
      }
      if (parsed.hostname === 'youtu.be') {
        const parts = parsed.pathname.split('/').filter(Boolean);
        const id = parts[0] || null;
        return id;
      }
    } catch {
      return null;
    }
    return null;
  }

  private getCurrentPlaybackTimeSeconds(): number {
    if (this.videoProvider === 'youtube') {
      const ytTime = this.youtubePlayer?.getCurrentTime?.();
      if (typeof ytTime === 'number' && !Number.isNaN(ytTime)) return ytTime;
      return this.lastAllowedYouTubeTime;
    }

    const video = this.videoPlayer?.nativeElement;
    if (video && typeof video.currentTime === 'number' && !Number.isNaN(video.currentTime)) {
      return video.currentTime;
    }
    return this.lastAllowedVideoTime;
  }

  private isLikelyLocalOnlyUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = (parsed.hostname || '').toLowerCase();
      return host === 'localhost' || host === '127.0.0.1' || host === '::1';
    } catch {
      return false;
    }
  }

  private enableLocalCastMirror(): void {
    if (this.videoProvider === 'youtube') return;
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;

    if (!this.localVideoAudioSnapshot) {
      this.localVideoAudioSnapshot = { muted: video.muted, volume: video.volume };
    }
    video.muted = true;
  }

  private restoreLocalAudioAfterCast(): void {
    if (this.videoProvider === 'youtube') return;
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    if (!this.localVideoAudioSnapshot) return;

    video.muted = this.localVideoAudioSnapshot.muted;
    video.volume = this.localVideoAudioSnapshot.volume;
    this.localVideoAudioSnapshot = null;
  }

  private mirrorCastStatusToLocal(status: CastStatus): void {
    if (!status.isConnected) return;
    if (this.videoProvider === 'youtube') return;
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    if (this.isSyncing) return;

    const time = typeof status.currentTime === 'number' && !Number.isNaN(status.currentTime) ? status.currentTime : 0;
    const shouldPlay = !status.isPaused;

    const needsSeek = !video.seeking && Math.abs(video.currentTime - time) > 0.75;
    const needsPlay = shouldPlay && video.paused;
    const needsPause = !shouldPlay && !video.paused;

    if (!needsSeek && !needsPlay && !needsPause) return;

    this.isSyncing = true;
    try {
      if (needsSeek) {
        video.currentTime = time;
      }
      if (needsPlay) {
        video.play().catch(() => {
          // ignore
        });
      } else if (needsPause) {
        video.pause();
      }
      this.lastKnownIsPlaying = shouldPlay;
      this.lastAllowedVideoTime = time;
    } finally {
      setTimeout(() => (this.isSyncing = false), 200);
    }
  }

  private async castCurrentVideo(startTime: number, shouldPlay: boolean): Promise<void> {
    if (!this.castService.isConnected()) return;
    if (!this.videoUrl) return;
    if (this.videoProvider === 'youtube') return;

    if (this.lastCastLoadedUrl === this.videoUrl) {
      this.castService.seek(startTime);
      if (shouldPlay) {
        this.castService.play();
      } else {
        this.castService.pause();
      }
      this.enableLocalCastMirror();
      return;
    }

    this.isSyncing = true;
    try {
      await this.castService.loadMedia({
        url: this.videoUrl,
        currentTime: startTime,
        autoplay: shouldPlay,
        title: 'WatchTogether'
      });
      this.lastCastLoadedUrl = this.videoUrl;
      this.enableLocalCastMirror();
    } finally {
      setTimeout(() => (this.isSyncing = false), 200);
    }
  }

  private adjustRemoteTimeForLatency(currentTime: number, sentAtUnixMs?: number, assumePlaying = false): number {
    if (!assumePlaying) return currentTime;
    if (typeof sentAtUnixMs !== 'number' || Number.isNaN(sentAtUnixMs)) return currentTime;
    const dtSeconds = Math.max(0, (Date.now() - sentAtUnixMs) / 1000);
    const maxAdjustmentSeconds = 10;
    if (dtSeconds > maxAdjustmentSeconds && Date.now() - this.lastLatencyCapWarningAt > 60_000) {
      this.lastLatencyCapWarningAt = Date.now();
      console.warn(
        '[RoomComponent] Latency adjustment capped',
        { dtSeconds, maxAdjustmentSeconds, note: 'Remote sentAt may be skewed or network delay unusually high.' }
      );
    }
    return currentTime + Math.min(dtSeconds, maxAdjustmentSeconds);
  }

  private handleCastStatusForRoomSync(status: CastStatus): void {
    if (!status.isConnected) return;
    if (this.isSyncing) return;
    if (!this.roomCode) return;
    if (this.videoProvider === 'youtube') return;
    if (typeof status.currentTime !== 'number' || Number.isNaN(status.currentTime)) return;

    const now = Date.now();
    const time = status.currentTime;

    if (this.lastCastObservedPaused == null) {
      this.lastCastObservedPaused = status.isPaused;
      this.lastCastObservedAt = now;
      this.lastCastObservedTime = time;
      return;
    }

    if (status.isPaused !== this.lastCastObservedPaused) {
      this.lastCastObservedPaused = status.isPaused;
      this.lastCastObservedAt = now;
      this.lastCastObservedTime = time;

      this.isSyncing = true;
      if (status.isPaused) {
        this.lastKnownIsPlaying = false;
        this.socketService.pauseVideo(this.roomCode, time);
      } else {
        this.lastKnownIsPlaying = true;
        this.socketService.playVideo(this.roomCode, time);
      }
      setTimeout(() => (this.isSyncing = false), 200);
      return;
    }

    if (this.lastCastObservedAt > 0) {
      const dtSeconds = Math.max(0, (now - this.lastCastObservedAt) / 1000);
      const expectedDelta = status.isPaused ? 0 : dtSeconds;
      const observedDelta = time - this.lastCastObservedTime;
      const drift = observedDelta - expectedDelta;

      // Sync when drift is meaningful and either:
      // - playback progressed noticeably but off from expectation, or
      // - playback should have progressed but didn't (e.g., stalled/paused unexpectedly).
      const driftThresholdSeconds = 3;
      const syncNeeded =
        Math.abs(drift) > driftThresholdSeconds &&
        (Math.abs(observedDelta) > driftThresholdSeconds || Math.abs(expectedDelta) > driftThresholdSeconds);

      if (syncNeeded) {
        this.isSyncing = true;
        this.lastKnownIsPlaying = !status.isPaused;
        this.socketService.seekVideo(this.roomCode, time, !status.isPaused);
        setTimeout(() => (this.isSyncing = false), 200);
      }
    }

    this.lastCastObservedAt = now;
    this.lastCastObservedTime = time;
  }

  private async applyVideoSource(source: VideoSource, startTime: number, shouldPlay: boolean): Promise<void> {
    this.videoProvider = source.provider;
    this.videoId = source.videoId || null;
    this.videoUrl = source.url;
    this.lastKnownIsPlaying = shouldPlay;
    this.lastAllowedVideoTime = startTime;
    this.lastAllowedYouTubeTime = startTime;

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
      this.airplayService.attach(video);
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

      if (this.isHost() && this.castService.isConnected()) {
        try {
          await this.castCurrentVideo(startTime, shouldPlay);
        } catch (e) {
          console.error('[RoomComponent] Cast load failed:', e);
        }
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
      this.lastAllowedYouTubeTime = currentTime;
      setTimeout(() => this.isSyncing = false, 200);
      return;
    }

    if (this.castService.isConnected() && this.videoProvider !== 'youtube') {
      this.isSyncing = true;
      const castTime = this.castStatus?.currentTime ?? 0;
      if (Math.abs(castTime - currentTime) > 1) {
        this.castService.seek(currentTime);
      }
      this.castService.play();
      this.lastAllowedVideoTime = currentTime;
      setTimeout(() => (this.isSyncing = false), 200);
      return;
    }

    if (this.videoPlayer?.nativeElement) {
      this.isSyncing = true;
      this.viewerIsSeeking = false;
      this.viewerSeekRestoreTime = null;
      const video = this.videoPlayer.nativeElement;
      if (Math.abs(video.currentTime - currentTime) > 1) {
        video.currentTime = currentTime;
      }
      video.play().catch(err => {
        console.error('[RoomComponent] Play failed:', err);
      });
      this.lastAllowedVideoTime = currentTime;
      setTimeout(() => (this.isSyncing = false), 200);
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
      this.lastAllowedYouTubeTime = currentTime;
      setTimeout(() => this.isSyncing = false, 200);
      return;
    }

    if (this.castService.isConnected() && this.videoProvider !== 'youtube') {
      this.isSyncing = true;
      const castTime = this.castStatus?.currentTime ?? 0;
      if (Math.abs(castTime - currentTime) > 1) {
        this.castService.seek(currentTime);
      }
      this.castService.pause();
      this.lastAllowedVideoTime = currentTime;
      setTimeout(() => (this.isSyncing = false), 200);
      return;
    }

    if (this.videoPlayer?.nativeElement) {
      this.isSyncing = true;
      this.viewerIsSeeking = false;
      this.viewerSeekRestoreTime = null;
      const video = this.videoPlayer.nativeElement;
      if (Math.abs(video.currentTime - currentTime) > 1) {
        video.currentTime = currentTime;
      }
      video.pause();
      this.lastAllowedVideoTime = currentTime;
      setTimeout(() => (this.isSyncing = false), 200);
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
      this.lastAllowedYouTubeTime = currentTime;
      setTimeout(() => this.isSyncing = false, 200);
      return;
    }

    if (this.castService.isConnected() && this.videoProvider !== 'youtube') {
      this.isSyncing = true;
      this.castService.seek(currentTime);
      if (isPlaying) {
        this.castService.play();
      } else {
        this.castService.pause();
      }
      this.lastAllowedVideoTime = currentTime;
      setTimeout(() => (this.isSyncing = false), 200);
      return;
    }

    if (this.videoPlayer?.nativeElement) {
      this.isSyncing = true;
      this.viewerIsSeeking = false;
      this.viewerSeekRestoreTime = null;
      const video = this.videoPlayer.nativeElement;
      video.currentTime = currentTime;
      if (isPlaying) {
        video.play().catch(err => {
          console.error('[RoomComponent] Play after seek failed:', err);
        });
      } else {
        video.pause();
      }
      this.lastAllowedVideoTime = currentTime;
      setTimeout(() => (this.isSyncing = false), 200);
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
        controls: 1,
        // Keep keyboard controls enabled for accessibility (volume/captions, etc.).
        // Viewer playback/seek attempts are still reverted by `handleYouTubeStateChange`.
        disablekb: 0,
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
          this.startYouTubeTimePolling();
        },
        onStateChange: (event: any) => this.handleYouTubeStateChange(event)
      }
    });
  }

  private destroyYouTubePlayer(): void {
    if (this.youtubePlayer) {
      this.stopYouTubeTimePolling();
      this.youtubePlayer.destroy();
      this.youtubePlayer = null;
    }
  }

  private startYouTubeTimePolling(): void {
    this.stopYouTubeTimePolling();
    this.youtubeTimePollId = window.setInterval(() => {
      if (!this.youtubePlayer) return;
      if (this.isSyncing) return;
      if (!this.youtubePlayer.getCurrentTime) return;
      const t = this.youtubePlayer.getCurrentTime();
      if (typeof t === 'number' && !Number.isNaN(t)) {
        if (this.isHost()) {
          this.lastAllowedYouTubeTime = t;
          return;
        }

        // As viewer, don't let local seeks overwrite the "allowed" time.
        if (Math.abs(t - this.lastAllowedYouTubeTime) <= 1.25) {
          this.lastAllowedYouTubeTime = t;
        }
      }
    }, 500);
  }

  private stopYouTubeTimePolling(): void {
    if (this.youtubeTimePollId != null) {
      clearInterval(this.youtubeTimePollId);
      this.youtubeTimePollId = null;
    }
  }

  private handleViewerPlaybackAttempt(action: 'play' | 'pause' | 'seek'): void {
    if (this.isSyncing) return;

    const now = Date.now();
    if (now - this.lastViewerWarningAt > 2500) {
      this.lastViewerWarningAt = now;
      this.toastService.info('Puedes ajustar volumen/subtítulos, pero solo el anfitrión controla la reproducción.');
    }

    if (this.videoProvider === 'youtube') {
      if (!this.youtubePlayer) return;
      this.isSyncing = true;

      const shouldPlay = this.lastKnownIsPlaying;
      const restoreTime = this.lastAllowedYouTubeTime;
      try {
        if (action === 'seek' && Math.abs(this.youtubePlayer.getCurrentTime() - restoreTime) > 1) {
          this.youtubePlayer.seekTo(restoreTime, true);
        }
        if (shouldPlay) {
          this.youtubePlayer.playVideo();
        } else {
          this.youtubePlayer.pauseVideo();
        }
      } finally {
        setTimeout(() => (this.isSyncing = false), 200);
      }
      return;
    }

    const video = this.videoPlayer?.nativeElement;
    if (!video) return;

    this.isSyncing = true;
    this.viewerIsSeeking = false;
    const seekRestoreTime = this.viewerSeekRestoreTime;
    this.viewerSeekRestoreTime = null;
    const shouldPlay = this.lastKnownIsPlaying;
    const restoreTime = action === 'seek' && typeof seekRestoreTime === 'number' ? seekRestoreTime : this.lastAllowedVideoTime;

    if (action === 'seek' && Math.abs(video.currentTime - restoreTime) > 0.5) {
      video.currentTime = restoreTime;
    }

    if (shouldPlay) {
      video.play().catch(() => {
        // ignore
      });
    } else {
      video.pause();
    }

    setTimeout(() => (this.isSyncing = false), 200);
  }

  private handleYouTubeStateChange(event: any): void {
    if (this.isSyncing) return;
    if (!this.youtubePlayer) return;

    const currentTime = this.youtubePlayer.getCurrentTime ? this.youtubePlayer.getCurrentTime() : 0;

    if (!this.isHost()) {
      const state = event?.data;
      if (state === YT.PlayerState.PLAYING && !this.lastKnownIsPlaying) {
        this.handleViewerPlaybackAttempt('play');
      } else if (state === YT.PlayerState.PAUSED && this.lastKnownIsPlaying) {
        this.handleViewerPlaybackAttempt('pause');
      } else if (
        state === YT.PlayerState.BUFFERING &&
        typeof currentTime === 'number' &&
        Math.abs(currentTime - this.lastAllowedYouTubeTime) > 1.5
      ) {
        this.handleViewerPlaybackAttempt('seek');
      }
      return;
    }

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
