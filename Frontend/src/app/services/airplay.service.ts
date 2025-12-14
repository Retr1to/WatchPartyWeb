import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AirPlayStatus {
  supported: boolean;
  available: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AirPlayService {
  private readonly statusSubject = new BehaviorSubject<AirPlayStatus>({
    supported: false,
    available: false
  });

  public readonly status$ = this.statusSubject.asObservable();

  constructor(private zone: NgZone) {
    this.statusSubject.next({
      supported: this.isSupported(),
      available: false
    });
  }

  isSupported(): boolean {
    const proto: any = (window as any).HTMLVideoElement?.prototype;
    return typeof proto?.webkitShowPlaybackTargetPicker === 'function';
  }

  attach(video: HTMLVideoElement | null | undefined): void {
    if (!video || !this.isSupported()) return;

    const handler = (event: any) => {
      const availability = (event?.availability || '').toString().toLowerCase();
      const available = availability === 'available';
      this.zone.run(() => this.statusSubject.next({ supported: true, available }));
    };

    video.addEventListener('webkitplaybacktargetavailabilitychanged', handler as any, { passive: true } as any);

    try {
      const anyVideo: any = video as any;
      if (typeof anyVideo.webkitShowPlaybackTargetPicker === 'function') {
        // no-op: calling the picker is user-gesture gated; we only want to ensure the API exists
      }
    } catch {
      // ignore
    }
  }

  showPicker(video: HTMLVideoElement | null | undefined): void {
    if (!video) return;
    const anyVideo: any = video as any;
    if (typeof anyVideo.webkitShowPlaybackTargetPicker !== 'function') return;
    anyVideo.webkitShowPlaybackTargetPicker();
  }
}

