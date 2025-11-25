import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeSelectorComponent } from './components/theme-selector/theme-selector.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ThemeSelectorComponent],
  template: `
    <router-outlet></router-outlet>
    <app-theme-selector></app-theme-selector>
  `,
  styles: []
})
export class AppComponent {
  title = 'WatchTogether';
}
