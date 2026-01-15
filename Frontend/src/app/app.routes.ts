import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { RoomComponent } from './components/room/room.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'room/:code', component: RoomComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
