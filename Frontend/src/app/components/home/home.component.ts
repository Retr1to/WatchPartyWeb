import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService } from '../../services/socket.service';
import { ToastService } from '../../services/toast.service';
import { AuthService, User } from '../../services/auth.service';
import { UserService, Room, Friend, FriendRequest } from '../../services/user.service';
import { AnimatedWaveIconComponent } from '../animated-wave-icon/animated-wave-icon.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, AnimatedWaveIconComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  roomCode: string = '';
  username: string = '';
  showJoinDialog: boolean = false;
  showCreateRoomDialog: boolean = false;
  showFriendDialog: boolean = false;
  
  currentUser$: Observable<User | null>;
  publicRooms: Room[] = [];
  friendRooms: Room[] = [];
  friends: Friend[] = [];
  pendingRequests: FriendRequest[] = [];
  
  roomName: string = '';
  roomVisibility: string = 'public';
  friendEmail: string = '';

  constructor(
    private socketService: SocketService,
    private toastService: ToastService,
    private authService: AuthService,
    private userService: UserService,
    private router: Router
  ) {
    this.currentUser$ = this.authService.currentUser$;
    
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

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.loadUserData();
    }
  }

  private storeUsername(username: string): void {
    try {
      localStorage.setItem('WATCHPARTY_USERNAME', username);
    } catch {
      // ignore
    }
  }

  private loadUserData(): void {
    this.loadPublicRooms();
    this.loadFriendRooms();
    this.loadFriends();
    this.loadPendingRequests();
  }

  loadPublicRooms(): void {
    this.userService.getPublicRooms().subscribe({
      next: (response) => {
        this.publicRooms = response.rooms;
      },
      error: () => {
        this.toastService.error('Error al cargar salas públicas');
      }
    });
  }

  loadFriendRooms(): void {
    this.userService.getFriendRooms().subscribe({
      next: (response) => {
        this.friendRooms = response.rooms;
      },
      error: () => {
        this.toastService.error('Error al cargar salas de amigos');
      }
    });
  }

  loadFriends(): void {
    this.userService.getFriends().subscribe({
      next: (response) => {
        this.friends = response.friends;
      },
      error: () => {
        this.toastService.error('Error al cargar amigos');
      }
    });
  }

  loadPendingRequests(): void {
    this.userService.getPendingRequests().subscribe({
      next: (response) => {
        this.pendingRequests = response.requests;
      },
      error: () => {
        this.toastService.error('Error al cargar solicitudes');
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  goToRegister(): void {
    this.router.navigate(['/register']);
  }

  logout(): void {
    this.authService.logout();
    this.publicRooms = [];
    this.friendRooms = [];
    this.friends = [];
    this.pendingRequests = [];
    this.toastService.success('Sesión cerrada');
  }

  showCreateDialog(): void {
    this.showCreateRoomDialog = true;
  }

  createNewRoom(): void {
    if (!this.roomName.trim()) {
      this.toastService.warning('Por favor ingresa un nombre para la sala');
      return;
    }

    const user = this.authService.getCurrentUser();
    const username = user?.username || 'Anfitrión';

    this.userService.createRoom(this.roomName, this.roomVisibility).subscribe({
      next: (response) => {
        this.socketService.createRoom(username);
        this.closeCreateDialog();
        this.loadUserData();
      },
      error: () => {
        this.toastService.error('Error al crear la sala');
      }
    });
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
    this.storeUsername(username);
    this.socketService.joinRoom(this.roomCode.toUpperCase(), username);
  }

  joinRoomByCode(roomCode: string): void {
    const user = this.authService.getCurrentUser();
    const username = user?.username || 'Usuario';
    this.socketService.joinRoom(roomCode, username);
  }

  showFriendManagement(): void {
    this.showFriendDialog = true;
  }

  sendFriendRequest(): void {
    if (!this.friendEmail.trim()) {
      this.toastService.warning('Por favor ingresa un email');
      return;
    }

    this.userService.sendFriendRequest(this.friendEmail).subscribe({
      next: () => {
        this.toastService.success('Solicitud enviada');
        this.friendEmail = '';
      },
      error: (err) => {
        this.toastService.error(err.error?.error || 'Error al enviar solicitud');
      }
    });
  }

  acceptFriendRequest(requestId: number): void {
    this.userService.acceptFriendRequest(requestId).subscribe({
      next: () => {
        this.toastService.success('Solicitud aceptada');
        this.loadFriends();
        this.loadPendingRequests();
      },
      error: () => {
        this.toastService.error('Error al aceptar solicitud');
      }
    });
  }

  rejectFriendRequest(requestId: number): void {
    this.userService.rejectFriendRequest(requestId).subscribe({
      next: () => {
        this.toastService.success('Solicitud rechazada');
        this.loadPendingRequests();
      },
      error: () => {
        this.toastService.error('Error al rechazar solicitud');
      }
    });
  }

  closeDialog(): void {
    this.showJoinDialog = false;
    this.roomCode = '';
  }

  closeCreateDialog(): void {
    this.showCreateRoomDialog = false;
    this.roomName = '';
    this.roomVisibility = 'public';
  }

  closeFriendDialog(): void {
    this.showFriendDialog = false;
  }
}
