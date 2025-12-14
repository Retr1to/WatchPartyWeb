import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type CastPlayerState = 'UNKNOWN' | 'IDLE' | 'BUFFERING' | 'PAUSED' | 'PLAYING';

export interface CastStatus {
  apiAvailable: boolean;
  isConnected: boolean;
  deviceName: string;
  title: string;
  playerState: CastPlayerState;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  canSeek: boolean;
}

export interface CastLoadMediaOptions {
  url: string;
  contentType?: string;
  title?: string;
  currentTime?: number;
  autoplay?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CastService {
  private readonly statusSubject = new BehaviorSubject<CastStatus>({
    apiAvailable: false,
    isConnected: false,
    deviceName: '',
    title: '',
    playerState: 'UNKNOWN',
    isPaused: true,
    currentTime: 0,
    duration: 0,
    canSeek: false
  });

  public readonly status$ = this.statusSubject.asObservable();

  private initialized = false;
  private frameworkSetup = false;
  private remotePlayer: any | null = null;
  private remotePlayerController: any | null = null;

  constructor(private zone: NgZone) {}

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    this.ensureCastSenderScriptPresent();

    await new Promise<void>((resolve) => {
      const win = window as any;

      const trySetup = () => {
        if (!win.cast?.framework || !win.chrome?.cast) return false;
        this.zone.run(() => {
          this.patchStatus({ apiAvailable: true });
        });
        this.setupCastFramework();
        resolve();
        return true;
      };

      if (trySetup()) return;

      const prev = win.__onGCastApiAvailable;
      win.__onGCastApiAvailable = (isAvailable: boolean) => {
        if (typeof prev === 'function') {
          try {
            prev(isAvailable);
          } catch {
            // ignore
          }
        }
        if (isAvailable) {
          trySetup();
        } else {
          this.zone.run(() => this.patchStatus({ apiAvailable: false }));
        }
      };

      const pollStart = Date.now();
      const poll = () => {
        if (trySetup()) return;
        if (Date.now() - pollStart > 8000) {
          resolve();
          return;
        }
        setTimeout(poll, 100);
      };
      poll();
    });
  }

  private setupCastFramework(): void {
    if (this.frameworkSetup) return;
    try {
      const context = cast.framework.CastContext.getInstance();
      context.setOptions({
        receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
      });

      this.remotePlayer = new cast.framework.RemotePlayer();
      this.remotePlayerController = new cast.framework.RemotePlayerController(this.remotePlayer);
      this.frameworkSetup = true;

      const update = () => this.zone.run(() => this.refreshFromRemotePlayer());

      this.remotePlayerController.addEventListener(
        cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
        update
      );
      this.remotePlayerController.addEventListener(
        cast.framework.RemotePlayerEventType.PLAYER_STATE_CHANGED,
        update
      );
      this.remotePlayerController.addEventListener(
        cast.framework.RemotePlayerEventType.IS_PAUSED_CHANGED,
        update
      );
      this.remotePlayerController.addEventListener(
        cast.framework.RemotePlayerEventType.CURRENT_TIME_CHANGED,
        update
      );
      this.remotePlayerController.addEventListener(
        cast.framework.RemotePlayerEventType.DURATION_CHANGED,
        update
      );
      this.remotePlayerController.addEventListener(
        cast.framework.RemotePlayerEventType.CAN_SEEK_CHANGED,
        update
      );
      this.remotePlayerController.addEventListener(
        cast.framework.RemotePlayerEventType.TITLE_CHANGED,
        update
      );

      update();
    } catch {
      this.patchStatus({ apiAvailable: false });
    }
  }

  private ensureCastSenderScriptPresent(): void {
    try {
      const win = window as any;
      if (win.cast?.framework && win.chrome?.cast) return;

      const existing = document.querySelector('script[src*="cast_sender.js"]');
      if (existing) return;

      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.async = true;
      document.head.appendChild(script);
    } catch {
      // ignore
    }
  }

  private refreshFromRemotePlayer(): void {
    const rp = this.remotePlayer;
    const session = this.getCurrentSession();
    const deviceName = this.getDeviceNameFromSession(session);

    const status: Partial<CastStatus> = {
      isConnected: !!rp?.isConnected,
      deviceName,
      title: rp?.title || '',
      playerState: this.normalizePlayerState(rp?.playerState),
      isPaused: typeof rp?.isPaused === 'boolean' ? rp.isPaused : true,
      currentTime: typeof rp?.currentTime === 'number' ? rp.currentTime : 0,
      duration: typeof rp?.duration === 'number' ? rp.duration : 0,
      canSeek: !!rp?.canSeek
    };

    this.patchStatus(status);
  }

  private normalizePlayerState(value: any): CastPlayerState {
    if (value === 'IDLE' || value === 'BUFFERING' || value === 'PAUSED' || value === 'PLAYING') return value;
    return 'UNKNOWN';
  }

  private patchStatus(patch: Partial<CastStatus>): void {
    this.statusSubject.next({ ...this.statusSubject.value, ...patch });
  }

  private getCurrentSession(): any | null {
    try {
      return cast.framework.CastContext.getInstance().getCurrentSession();
    } catch {
      return null;
    }
  }

  private getDeviceNameFromSession(session: any | null): string {
    try {
      const device = session?.getCastDevice?.();
      return device?.friendlyName || '';
    } catch {
      return '';
    }
  }

  async requestSession(): Promise<void> {
    await this.init();
    await cast.framework.CastContext.getInstance().requestSession();
  }

  async endSession(stopCasting = true): Promise<void> {
    try {
      const session = this.getCurrentSession();
      if (!session) return;
      session.endSession(stopCasting);
    } finally {
      this.zone.run(() => this.refreshFromRemotePlayer());
    }
  }

  isConnected(): boolean {
    return this.statusSubject.value.isConnected;
  }

  getStatusSnapshot(): CastStatus {
    return this.statusSubject.value;
  }

  async loadMedia(options: CastLoadMediaOptions): Promise<void> {
    const session = this.getCurrentSession();
    if (!session) {
      await this.requestSession();
    }

    const ensuredSession = this.getCurrentSession();
    if (!ensuredSession) return;

    const url = options.url;
    const mediaInfo = new chrome.cast.media.MediaInfo(url, options.contentType || this.guessContentType(url));
    mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
    mediaInfo.metadata.title = options.title || this.defaultTitleFromUrl(url);

    const request = new chrome.cast.media.LoadRequest(mediaInfo);
    if (typeof options.currentTime === 'number') {
      request.currentTime = options.currentTime;
    }
    request.autoplay = options.autoplay !== false;

    await ensuredSession.loadMedia(request);
    this.zone.run(() => this.refreshFromRemotePlayer());
  }

  play(): void {
    if (!this.remotePlayerController || !this.remotePlayer) return;
    if (this.remotePlayer.isPaused) {
      this.remotePlayerController.playOrPause();
    }
  }

  pause(): void {
    if (!this.remotePlayerController || !this.remotePlayer) return;
    if (!this.remotePlayer.isPaused) {
      this.remotePlayerController.playOrPause();
    }
  }

  seek(timeSeconds: number): void {
    if (!this.remotePlayerController || !this.remotePlayer) return;
    if (typeof timeSeconds !== 'number' || Number.isNaN(timeSeconds)) return;
    this.remotePlayer.currentTime = Math.max(0, timeSeconds);
    this.remotePlayerController.seek();
  }

  private guessContentType(url: string): string {
    const lowered = url.toLowerCase().split('?')[0].split('#')[0];
    if (lowered.endsWith('.mp4')) return 'video/mp4';
    if (lowered.endsWith('.webm')) return 'video/webm';
    if (lowered.endsWith('.ogg') || lowered.endsWith('.ogv')) return 'video/ogg';
    if (lowered.endsWith('.mov')) return 'video/quicktime';
    if (lowered.endsWith('.m3u8')) return 'application/x-mpegURL';
    return 'video/mp4';
  }

  private defaultTitleFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const name = parsed.pathname.split('/').filter(Boolean).pop();
      return name || 'WatchTogether';
    } catch {
      return 'WatchTogether';
    }
  }
}
