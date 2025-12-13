import { Component, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService } from '../../services/socket.service';
import { ToastService } from '../../services/toast.service';
import { AnimatedWaveIconComponent } from '../animated-wave-icon/animated-wave-icon.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, AnimatedWaveIconComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  private readonly destroyRef = inject(DestroyRef);

  roomCode: string = '';
  username: string = '';
  showJoinDialog: boolean = false;

  constructor(
    private socketService: SocketService,
    private toastService: ToastService,
    private router: Router
  ) {
    // Navegar cuando se crea o se une a una sala
    this.socketService.onRoomCreated().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ roomCode, room }) => {
      this.toastService.success(`Sala ${roomCode} creada exitosamente`);
      this.router.navigate(['/room', roomCode], { state: { room } });
    });

    this.socketService.onRoomJoined().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ room }) => {
      this.toastService.success(`Te uniste a la sala ${this.roomCode.toUpperCase()}`);
      this.router.navigate(['/room', this.roomCode.toUpperCase()], { state: { room } });
    });

    this.socketService.onRoomError().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ message }) => {
      this.toastService.error(message);
    });
  }

  createNewRoom(): void {
    const username = this.username.trim() || 'Anfitrión';
    this.socketService.createRoom(username);
  }

  showJoinRoomDialog(): void {
    this.showJoinDialog = true;
  }

  joinRoom(): void {
    if (!this.roomCode.trim()) {
      this.toastService.warning('Por favor ingresa un código de sala');
      return;
    }

    const username = this.username.trim() || 'Usuario';
    this.socketService.joinRoom(this.roomCode.toUpperCase(), username);
  }

  closeDialog(): void {
    this.showJoinDialog = false;
    this.roomCode = '';
  }
}
