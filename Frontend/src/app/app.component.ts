import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeSelectorComponent } from './components/theme-selector/theme-selector.component';
import { ToastComponent } from './components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ThemeSelectorComponent, ToastComponent],
  template: `
    <router-outlet></router-outlet>
    <app-theme-selector></app-theme-selector>
    <app-toast></app-toast>
  `,
  styles: []
})
export class AppComponent {
  title = 'WatchTogether';
}
