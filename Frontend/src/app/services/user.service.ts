import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SoapService } from './soap.service';

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
  constructor(private soap: SoapService) { }

  // Friend methods
  sendFriendRequest(email: string): Observable<any> {
    const body = this.soap.buildElements({ Email: email });
    return this.soap.call('SendFriendRequest', body).pipe(
      map((response) => {
        const success = this.soap.getBoolean(response, 'Success');
        const error = this.soap.getText(response, 'Error');
        if (!success) {
          throw new Error(error || 'Error sending friend request');
        }
        return { message: this.soap.getText(response, 'Message') };
      })
    );
  }

  acceptFriendRequest(requestId: number): Observable<any> {
    const body = this.soap.buildElements({ RequestId: requestId });
    return this.soap.call('AcceptFriendRequest', body).pipe(
      map((response) => {
        const success = this.soap.getBoolean(response, 'Success');
        const error = this.soap.getText(response, 'Error');
        if (!success) {
          throw new Error(error || 'Error accepting friend request');
        }
        return { message: this.soap.getText(response, 'Message') };
      })
    );
  }

  rejectFriendRequest(requestId: number): Observable<any> {
    const body = this.soap.buildElements({ RequestId: requestId });
    return this.soap.call('RejectFriendRequest', body).pipe(
      map((response) => {
        const success = this.soap.getBoolean(response, 'Success');
        const error = this.soap.getText(response, 'Error');
        if (!success) {
          throw new Error(error || 'Error rejecting friend request');
        }
        return { message: this.soap.getText(response, 'Message') };
      })
    );
  }

  getFriends(): Observable<{ friends: Friend[] }> {
    return this.soap.call('GetFriends', '').pipe(
      map((response) => {
        const success = this.soap.getBoolean(response, 'Success');
        if (!success) {
          throw new Error(this.soap.getText(response, 'Error') || 'Error loading friends');
        }

        const friendsElement = this.soap.getChildElement(response, 'Friends');
        const friendElements = friendsElement ? this.soap.getChildElements(friendsElement, 'Friend') : [];
        const friends = friendElements.map((friend) => ({
          id: this.soap.getNumber(friend, 'Id'),
          username: this.soap.getText(friend, 'Username'),
          email: this.soap.getText(friend, 'Email')
        }));

        return { friends };
      })
    );
  }

  getPendingRequests(): Observable<{ requests: FriendRequest[] }> {
    return this.soap.call('GetPendingFriendRequests', '').pipe(
      map((response) => {
        const success = this.soap.getBoolean(response, 'Success');
        if (!success) {
          throw new Error(this.soap.getText(response, 'Error') || 'Error loading friend requests');
        }

        const requestsElement = this.soap.getChildElement(response, 'Requests');
        const requestElements = requestsElement ? this.soap.getChildElements(requestsElement, 'Request') : [];
        const requests = requestElements.map((request) => {
          const fromElement = this.soap.getChildElement(request, 'From');
          return {
            id: this.soap.getNumber(request, 'Id'),
            from: {
              id: fromElement ? this.soap.getNumber(fromElement, 'Id') : 0,
              username: fromElement ? this.soap.getText(fromElement, 'Username') : '',
              email: fromElement ? this.soap.getText(fromElement, 'Email') : ''
            },
            createdAt: this.soap.getText(request, 'CreatedAt')
          };
        });

        return { requests };
      })
    );
  }

  // Room methods
  createRoom(name: string, visibility: string): Observable<{ roomCode: string; name: string; visibility: string }> {
    const body = this.soap.buildElements({ Name: name, Visibility: visibility });
    return this.soap.call('CreateRoom', body).pipe(
      map((response) => {
        const success = this.soap.getBoolean(response, 'Success');
        const error = this.soap.getText(response, 'Error');
        if (!success) {
          throw new Error(error || 'Error creating room');
        }

        return {
          roomCode: this.soap.getText(response, 'RoomCode'),
          name: this.soap.getText(response, 'Name'),
          visibility: this.soap.getText(response, 'Visibility')
        };
      })
    );
  }

  getPublicRooms(): Observable<{ rooms: Room[] }> {
    return this.soap.call('GetPublicRooms', '').pipe(
      map((response) => {
        const success = this.soap.getBoolean(response, 'Success');
        if (!success) {
          throw new Error(this.soap.getText(response, 'Error') || 'Error loading public rooms');
        }

        return { rooms: this.parseRooms(response) };
      })
    );
  }

  getFriendRooms(): Observable<{ rooms: Room[] }> {
    return this.soap.call('GetFriendRooms', '').pipe(
      map((response) => {
        const success = this.soap.getBoolean(response, 'Success');
        if (!success) {
          throw new Error(this.soap.getText(response, 'Error') || 'Error loading friend rooms');
        }

        return { rooms: this.parseRooms(response) };
      })
    );
  }

  canJoinRoom(roomCode: string): Observable<{ canJoin: boolean; error?: string }> {
    const body = this.soap.buildElements({ RoomCode: roomCode });
    return this.soap.call('CanJoinRoom', body).pipe(
      map((response) => {
        const success = this.soap.getBoolean(response, 'Success');
        const canJoin = this.soap.getBoolean(response, 'CanJoin');
        const error = this.soap.getText(response, 'Error');
        if (!success) {
          throw new Error(error || 'Error checking room access');
        }
        return { canJoin, error: error || undefined };
      })
    );
  }

  private parseRooms(response: Element): Room[] {
    const roomsElement = this.soap.getChildElement(response, 'Rooms');
    const roomElements = roomsElement ? this.soap.getChildElements(roomsElement, 'Room') : [];

    return roomElements.map((room) => {
      const ownerElement = this.soap.getChildElement(room, 'Owner');
      return {
        roomCode: this.soap.getText(room, 'RoomCode'),
        name: this.soap.getText(room, 'Name'),
        visibility: this.soap.getText(room, 'Visibility'),
        owner: {
          id: ownerElement ? this.soap.getNumber(ownerElement, 'Id') : 0,
          username: ownerElement ? this.soap.getText(ownerElement, 'Username') : ''
        },
        createdAt: this.soap.getText(room, 'CreatedAt'),
        lastActivityAt: this.soap.getText(room, 'LastActivityAt')
      };
    });
  }
}
