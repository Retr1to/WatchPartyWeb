import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
import { SoapService } from './soap.service';

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  userId: number;
  username: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private soap: SoapService) {
    // Check if user is already logged in
    const token = this.getToken();
    if (token) {
      this.loadCurrentUser();
    }
  }

  register(username: string, email: string, password: string): Observable<AuthResponse> {
    const body = this.soap.buildElements({
      Username: username,
      Email: email,
      Password: password
    });

    return this.soap.call('Register', body).pipe(
      map((response) => {
        const success = this.soap.getBoolean(response, 'Success');
        const error = this.soap.getText(response, 'Error');
        if (!success) {
          throw new Error(error || 'Registration failed');
        }

        return {
          token: this.soap.getText(response, 'Token'),
          userId: this.soap.getNumber(response, 'UserId'),
          username: this.soap.getText(response, 'Username') || username,
          email: this.soap.getText(response, 'Email') || email
        };
      }),
      tap(response => {
        this.setToken(response.token);
        this.currentUserSubject.next({
          id: response.userId,
          username: response.username,
          email: response.email
        });
      })
    );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    const body = this.soap.buildElements({
      Email: email,
      Password: password
    });

    return this.soap.call('Login', body).pipe(
      map((response) => {
        const success = this.soap.getBoolean(response, 'Success');
        const error = this.soap.getText(response, 'Error');
        if (!success) {
          throw new Error(error || 'Login failed');
        }

        return {
          token: this.soap.getText(response, 'Token'),
          userId: this.soap.getNumber(response, 'UserId'),
          username: this.soap.getText(response, 'Username'),
          email: this.soap.getText(response, 'Email')
        };
      }),
      tap(response => {
        this.setToken(response.token);
        this.currentUserSubject.next({
          id: response.userId,
          username: response.username,
          email: response.email
        });
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private loadCurrentUser(): void {
    this.soap.call('GetCurrentUser', '').pipe(
      map((response) => {
        const success = this.soap.getBoolean(response, 'Success');
        if (!success) {
          throw new Error(this.soap.getText(response, 'Error') || 'Unauthorized');
        }

        return {
          id: this.soap.getNumber(response, 'Id'),
          username: this.soap.getText(response, 'Username'),
          email: this.soap.getText(response, 'Email')
        } as User;
      })
    ).subscribe({
      next: (user) => {
        this.currentUserSubject.next(user);
      },
      error: () => {
        this.logout();
      }
    });
  }
}
