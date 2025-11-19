import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  roomCode: string = '';
  username: string = '';
  errorMessage: string = '';
  showJoinDialog: boolean = false;

  constructor(
    private socketService: SocketService,
    private router: Router
  ) {
    // Navegar cuando se crea o se une a una sala
    this.socketService.onRoomCreated().subscribe(({ roomCode }) => {
      this.router.navigate(['/room', roomCode]);
    });

    this.socketService.onRoomJoined().subscribe(() => {
      this.router.navigate(['/room', this.roomCode.toUpperCase()]);
    });

    this.socketService.onRoomError().subscribe(({ message }) => {
      this.errorMessage = message;
      setTimeout(() => this.errorMessage = '', 3000);
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
      this.errorMessage = 'Por favor ingresa un código de sala';
      setTimeout(() => this.errorMessage = '', 3000);
      return;
    }

    const username = this.username.trim() || 'Usuario';
    this.socketService.joinRoom(this.roomCode.toUpperCase(), username);
  }

  closeDialog(): void {
    this.showJoinDialog = false;
    this.roomCode = '';
    this.errorMessage = '';
  }
}
