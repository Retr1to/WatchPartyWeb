import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Friend {
  id: number;
  username: string;
  email: string;
}

export interface FriendRequest {
  id: number;
  from: {
    id: number;
    username: string;
    email: string;
  };
  createdAt: string;
}

export interface Room {
  roomCode: string;
  name: string;
  visibility?: string;
  owner: {
    id: number;
    username: string;
  };
  createdAt: string;
  lastActivityAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:5000/api'; // Update with your backend URL

  constructor(private http: HttpClient) { }

  // Friend methods
  sendFriendRequest(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/friends/request`, { email });
  }

  acceptFriendRequest(requestId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/friends/accept/${requestId}`, {});
  }

  rejectFriendRequest(requestId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/friends/reject/${requestId}`, {});
  }

  getFriends(): Observable<{ friends: Friend[] }> {
    return this.http.get<{ friends: Friend[] }>(`${this.apiUrl}/friends`);
  }

  getPendingRequests(): Observable<{ requests: FriendRequest[] }> {
    return this.http.get<{ requests: FriendRequest[] }>(`${this.apiUrl}/friends/requests`);
  }

  // Room methods
  createRoom(name: string, visibility: string): Observable<{ roomCode: string; name: string; visibility: string }> {
    return this.http.post<{ roomCode: string; name: string; visibility: string }>(
      `${this.apiUrl}/rooms/create`,
      { name, visibility }
    );
  }

  getPublicRooms(): Observable<{ rooms: Room[] }> {
    return this.http.get<{ rooms: Room[] }>(`${this.apiUrl}/rooms/public`);
  }

  getFriendRooms(): Observable<{ rooms: Room[] }> {
    return this.http.get<{ rooms: Room[] }>(`${this.apiUrl}/rooms/friends`);
  }

  canJoinRoom(roomCode: string): Observable<{ canJoin: boolean; error?: string }> {
    return this.http.get<{ canJoin: boolean; error?: string }>(
      `${this.apiUrl}/rooms/${roomCode}/can-join`
    );
  }
}
