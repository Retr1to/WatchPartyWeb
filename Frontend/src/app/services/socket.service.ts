import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';

export interface Participant {
  id: string;
  username: string;
  isHost: boolean;
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

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  private readonly SERVER_URL = 'http://localhost:3000';

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

  constructor() {
    this.socket = io(this.SERVER_URL);
    this.setupListeners();
  }

  // Configura listeners para eventos del servidor
  private setupListeners(): void {
    this.socket.on('room-created', (data) => {
      this.roomCreatedSubject.next(data);
    });

    this.socket.on('room-joined', (data) => {
      this.roomJoinedSubject.next(data);
    });

    this.socket.on('room-error', (data) => {
      this.roomErrorSubject.next(data);
    });

    this.socket.on('participant-joined', (data) => {
      this.participantJoinedSubject.next(data);
    });

    this.socket.on('participant-left', (data) => {
      this.participantLeftSubject.next(data);
    });

    this.socket.on('video-changed', (data) => {
      this.videoChangedSubject.next(data);
    });

    this.socket.on('video-play', (data) => {
      this.videoPlaySubject.next(data);
    });

    this.socket.on('video-pause', (data) => {
      this.videoPauseSubject.next(data);
    });

    this.socket.on('video-seek', (data) => {
      this.videoSeekSubject.next(data);
    });

    this.socket.on('host-changed', (data) => {
      this.hostChangedSubject.next(data);
    });
  }

  // Métodos para emitir eventos al servidor
  createRoom(username: string): void {
    this.socket.emit('create-room', username);
  }

  joinRoom(roomCode: string, username: string): void {
    this.socket.emit('join-room', { roomCode, username });
  }

  changeVideo(roomCode: string, url: string): void {
    this.socket.emit('change-video', { roomCode, url });
  }

  playVideo(roomCode: string, currentTime: number): void {
    this.socket.emit('play-video', { roomCode, currentTime });
  }

  pauseVideo(roomCode: string, currentTime: number): void {
    this.socket.emit('pause-video', { roomCode, currentTime });
  }

  seekVideo(roomCode: string, currentTime: number): void {
    this.socket.emit('seek-video', { roomCode, currentTime });
  }

  leaveRoom(): void {
    this.socket.emit('leave-room');
  }

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

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
