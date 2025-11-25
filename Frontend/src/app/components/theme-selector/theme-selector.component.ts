import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, ThemeInfo } from '../../services/theme.service';

@Component({
  selector: 'app-theme-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="theme-selector-container">
      <!-- Botón flotante -->
      <button class="theme-toggle-btn" (click)="toggleMenu()" [title]="'Cambiar tema: ' + getCurrentThemeName()">
        {{ getCurrentThemeEmoji() }}
      </button>

      <!-- Menú desplegable -->
      <div class="theme-menu" *ngIf="isMenuOpen" (click)="$event.stopPropagation()">
        <div class="theme-menu-header">
          <h3>Selecciona un Tema</h3>
          <button class="close-btn" (click)="closeMenu()">×</button>
        </div>

        <div class="theme-list">
          <button
            *ngFor="let theme of themes"
            class="theme-option"
            [class.active]="isCurrentTheme(theme.id)"
            (click)="selectTheme(theme.id)">
            <span class="theme-emoji">{{ theme.emoji }}</span>
            <div class="theme-info">
              <div class="theme-name">{{ theme.name }}</div>
              <div class="theme-desc">{{ theme.description }}</div>
            </div>
            <span class="check-mark" *ngIf="isCurrentTheme(theme.id)">✓</span>
          </button>
        </div>
      </div>

      <!-- Backdrop -->
      <div class="theme-backdrop" *ngIf="isMenuOpen" (click)="closeMenu()"></div>
    </div>
  `,
  styles: [`
    .theme-selector-container {
      position: fixed;
      z-index: 9999;
    }

    /* Botón flotante */
    .theme-toggle-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--primary-gradient);
      color: white;
      font-size: 24px;
      border: none;
      cursor: pointer;
      box-shadow: var(--shadow-lg);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    }

    .theme-toggle-btn:hover {
      transform: scale(1.1) rotate(15deg);
      box-shadow: var(--shadow-glow);
    }

    .theme-toggle-btn:active {
      transform: scale(0.95);
    }

    /* Menú desplegable */
    .theme-menu {
      position: fixed;
      bottom: 90px;
      right: 24px;
      width: 360px;
      max-height: 70vh;
      background: var(--surface-base);
      backdrop-filter: blur(var(--backdrop-blur));
      border-radius: 16px;
      border: 1px solid var(--border-base);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      animation: slideUp 0.3s ease;
      z-index: 10001;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .theme-menu-header {
      padding: 20px;
      border-bottom: 1px solid var(--border-base);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .theme-menu-header h3 {
      margin: 0;
      color: var(--text-primary);
      font-size: 1.1rem;
      font-weight: 600;
    }

    .close-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-size: 28px;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: var(--surface-hover);
      color: var(--text-primary);
    }

    /* Lista de temas */
    .theme-list {
      max-height: calc(70vh - 80px);
      overflow-y: auto;
      padding: 8px;
    }

    .theme-option {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px;
      margin-bottom: 8px;
      background: var(--surface-elevated);
      border: 2px solid transparent;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      text-align: left;
    }

    .theme-option:hover {
      background: var(--surface-hover);
      border-color: var(--border-hover);
      transform: translateX(4px);
    }

    .theme-option.active {
      background: var(--primary-gradient);
      border-color: var(--primary-solid);
      box-shadow: var(--shadow-glow);
    }

    .theme-emoji {
      font-size: 32px;
      flex-shrink: 0;
    }

    .theme-info {
      flex: 1;
      min-width: 0;
    }

    .theme-name {
      color: var(--text-primary);
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 2px;
    }

    .theme-desc {
      color: var(--text-secondary);
      font-size: 0.85rem;
      line-height: 1.3;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .check-mark {
      font-size: 20px;
      color: white;
      font-weight: bold;
    }

    /* Backdrop */
    .theme-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(2px);
      z-index: 9998;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Responsive */
    @media (max-width: 480px) {
      .theme-menu {
        right: 12px;
        left: 12px;
        width: auto;
        bottom: 80px;
      }

      .theme-toggle-btn {
        bottom: 16px;
        right: 16px;
        width: 52px;
        height: 52px;
      }
    }

    /* Custom scrollbar */
    .theme-list::-webkit-scrollbar {
      width: 6px;
    }

    .theme-list::-webkit-scrollbar-track {
      background: var(--surface-base);
    }

    .theme-list::-webkit-scrollbar-thumb {
      background: var(--border-base);
      border-radius: 3px;
    }

    .theme-list::-webkit-scrollbar-thumb:hover {
      background: var(--border-hover);
    }
  `]
})
export class ThemeSelectorComponent {
  isMenuOpen = false;
  themes: ThemeInfo[];

  constructor(private themeService: ThemeService) {
    this.themes = this.themeService.getAllThemes();
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  selectTheme(themeId: any): void {
    this.themeService.setTheme(themeId);
    this.closeMenu();
  }

  isCurrentTheme(themeId: any): boolean {
    return this.themeService.isCurrentTheme(themeId);
  }

  getCurrentThemeName(): string {
    return this.themeService.getCurrentThemeInfo()?.name || 'Tema';
  }

  getCurrentThemeEmoji(): string {
    return this.themeService.getCurrentThemeInfo()?.emoji || '🎨';
  }
}
