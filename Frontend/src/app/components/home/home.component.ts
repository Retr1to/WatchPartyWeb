import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService } from '../../services/socket.service';
import { ToastService } from '../../services/toast.service';
import { AuthService, User } from '../../services/auth.service';
import { UserService, Room, Friend, FriendRequest } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';
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
  roomVisibility: string = 'Public';
  friendEmail: string = '';

  constructor(
    private socketService: SocketService,
    private toastService: ToastService,
    private authService: AuthService,
    private userService: UserService,
    private notificationService: NotificationService,
    private router: Router
  ) {
    this.currentUser$ = this.authService.currentUser$;
    
    // Configurar listeners de notificaciones en tiempo real
    this.setupNotificationListeners();
    
    // Navegar cuando se crea o se une a una sala
    this.socketService.onRoomCreated().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ roomCode, room }) => {
      this.toastService.success(`Sala ${roomCode} creada exitosamente`);
      this.router.navigate(['/room', roomCode], { state: { room } });
    });

    this.socketService.onRoomJoined().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ room }) => {
      const code = (room.code || this.roomCode).toUpperCase();
      this.toastService.success(`Te uniste a la sala ${code}`);
      this.router.navigate(['/room', code], { state: { room } });
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

  private setupNotificationListeners(): void {
    // Escuchar notificaciones de solicitudes de amistad
    this.notificationService.notification$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(notification => {
        console.log('[HomeComponent] Notification received:', notification);
        
        switch (notification.type) {
          case 'friend_request_received':
            this.handleFriendRequestReceived(notification.data);
            break;
          case 'friend_request_accepted':
            this.handleFriendRequestAccepted(notification.data);
            break;
          case 'new_room_created':
            this.handleNewRoomCreated(notification.data);
            break;
          default:
            console.log('[HomeComponent] Unknown notification type:', notification.type);
        }
      });
  }

  private handleFriendRequestReceived(data: any): void {
    // Agregar la nueva solicitud a la lista
    const newRequest: FriendRequest = {
      id: data.requestId,
      from: data.from,
      createdAt: data.createdAt
    };
    
    this.pendingRequests = [newRequest, ...this.pendingRequests];
    this.toastService.success(`Nueva solicitud de amistad de ${data.from.username}! 👥`);
  }

  private handleFriendRequestAccepted(data: any): void {
    // Agregar el nuevo amigo a la lista
    const newFriend: Friend = {
      id: data.friend.id,
      username: data.friend.username,
      email: data.friend.email
    };
    
    this.friends = [newFriend, ...this.friends];
    this.toastService.success(`${data.friend.username} aceptó tu solicitud de amistad! ✨`);
    
    // Recargar las salas de amigos por si hay nuevas disponibles
    this.loadFriendRooms();
  }

  private handleNewRoomCreated(data: any): void {
    const newRoom: Room = {
      roomCode: data.roomCode,
      name: data.name,
      visibility: data.visibility,
      owner: data.owner,
      createdAt: data.createdAt,
      lastActivityAt: data.createdAt
    };

    // Agregar a la lista correspondiente según la visibilidad
    if (data.visibility === 'Public') {
      // Verificar si no existe ya
      if (!this.publicRooms.find(r => r.roomCode === data.roomCode)) {
        this.publicRooms = [newRoom, ...this.publicRooms];
      }
    } else if (data.visibility === 'Friends') {
      // Verificar si no existe ya
      if (!this.friendRooms.find(r => r.roomCode === data.roomCode)) {
        this.friendRooms = [newRoom, ...this.friendRooms];
      }
    }

    this.toastService.success(`${data.owner.username} creó una nueva sala: ${data.name} 🎬`);
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
    const username = user?.username || 'Anfitrion';

    this.userService.createRoom(this.roomName, this.roomVisibility).subscribe({
      next: (response) => {
        console.log('[HomeComponent] Room created via API:', response.roomCode);
        this.toastService.success(`Sala ${response.roomCode} creada exitosamente`);
        this.roomCode = response.roomCode;
        this.storeUsername(username);
        this.closeCreateDialog();
        this.loadUserData();
        this.socketService.joinRoom(response.roomCode, username);
      },
      error: (err) => {
        console.error('[HomeComponent] Error creating room:', err);
        this.toastService.error(err?.message || 'Error al crear la sala');
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

    const roomCodeUpper = this.roomCode.toUpperCase();
    const user = this.authService.getCurrentUser();
    const username = user?.username || this.username.trim() || 'Usuario';
    
    // Check if user can join this room
    this.userService.canJoinRoom(roomCodeUpper).subscribe({
      next: (response) => {
        if (response.canJoin) {
          this.storeUsername(username);
          this.roomCode = roomCodeUpper;
          this.closeDialog();
          this.socketService.joinRoom(roomCodeUpper, username);
        } else {
          this.toastService.error(response.error || 'No puedes unirte a esta sala');
        }
      },
      error: (err) => {
        console.error('[HomeComponent] Error checking room access:', err);
        this.toastService.error(err?.message || 'Error al verificar acceso a la sala');
      }
    });
  }

  joinRoomByCode(roomCode: string): void {
    const user = this.authService.getCurrentUser();
    const username = user?.username || 'Usuario';
    
    this.userService.canJoinRoom(roomCode).subscribe({
      next: (response) => {
        if (response.canJoin) {
          this.roomCode = roomCode.toUpperCase();
          this.storeUsername(username);
          this.socketService.joinRoom(this.roomCode, username);
        } else {
          this.toastService.error(response.error || 'No puedes unirte a esta sala');
        }
      },
      error: (err) => {
        console.error('[HomeComponent] Error checking room access:', err);
        this.toastService.error(err?.message || 'Error al verificar acceso a la sala');
      }
    });
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
        this.toastService.error(err?.message || 'Error al enviar solicitud');
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
    this.roomVisibility = 'Public';
  }

  closeFriendDialog(): void {
    this.showFriendDialog = false;
  }
}
