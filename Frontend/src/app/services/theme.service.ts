import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Tipos de temas disponibles en la aplicación
 */
export type ThemeType =
  | 'tropical-sunset'    // 🌅 Por defecto - Acogedor y social
  | 'neon-nostalgia'     // 🌃 Energético y futurista
  | 'aurora-borealis'    // 🌌 Sereno y mágico
  | 'blurple-elegant'    // 💜 Moderno y confiable
  | 'golden-night';      // 🌟 Elegante y exclusivo

/**
 * Información detallada de cada tema
 */
export interface ThemeInfo {
  id: ThemeType;
  name: string;
  emoji: string;
  description: string;
  mood: string;
  bestFor: string[];
}

/**
 * Servicio para gestionar los temas de la aplicación
 *
 * Características:
 * - Cambio dinámico de temas
 * - Persistencia en localStorage
 * - Observable para reactividad
 * - Aplicación automática al cargar
 *
 * @example
 * ```typescript
 * constructor(private themeService: ThemeService) {
 *   this.themeService.setTheme('neon-nostalgia');
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'watchparty-theme';
  private readonly DEFAULT_THEME: ThemeType = 'neon-nostalgia';

  private currentThemeSubject = new BehaviorSubject<ThemeType>(this.DEFAULT_THEME);
  public currentTheme$: Observable<ThemeType> = this.currentThemeSubject.asObservable();

  /**
   * Catálogo de todos los temas disponibles
   */
  public readonly themes: ThemeInfo[] = [
    {
      id: 'tropical-sunset',
      name: 'Atardecer Tropical',
      emoji: '🌅',
      description: 'Acogedor y social, perfecto para todo tipo de contenido',
      mood: 'Acogedor/Social',
      bestFor: ['Uso general', 'Eventos comunitarios', 'Todo propósito']
    },
    {
      id: 'neon-nostalgia',
      name: 'Nostalgia Neón',
      emoji: '🌃',
      description: 'Energético y futurista con estética synthwave',
      mood: 'Energético/Futurista',
      bestFor: ['Gaming', 'Sci-fi', 'Contenido tech']
    },
    {
      id: 'aurora-borealis',
      name: 'Aurora Boreal',
      emoji: '🌌',
      description: 'Sereno y mágico inspirado en la naturaleza',
      mood: 'Sereno/Mágico',
      bestFor: ['Documentales', 'Naturaleza', 'Modo chill']
    },
    {
      id: 'blurple-elegant',
      name: 'Blurple Elegante',
      emoji: '💜',
      description: 'Moderno y confiable estilo Discord/Twitch',
      mood: 'Moderno/Confiable',
      bestFor: ['Gaming', 'Streaming', 'Comunidades']
    },
    {
      id: 'golden-night',
      name: 'Noche Dorada',
      emoji: '🌟',
      description: 'Elegante y exclusivo con toques premium',
      mood: 'Elegante/Exclusivo',
      bestFor: ['Eventos VIP', 'Películas clásicas', 'Premium']
    }
  ];

  constructor() {
    this.initializeTheme();
  }

  /**
   * Inicializa el tema desde localStorage o usa el por defecto
   */
  private initializeTheme(): void {
    const savedTheme = this.getThemeFromStorage();
    this.applyTheme(savedTheme);
  }

  /**
   * Obtiene el tema guardado en localStorage
   */
  private getThemeFromStorage(): ThemeType {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored && this.isValidTheme(stored)) {
      return stored as ThemeType;
    }
    return this.DEFAULT_THEME;
  }

  /**
   * Valida si un string es un tema válido
   */
  private isValidTheme(theme: string): boolean {
    return this.themes.some(t => t.id === theme);
  }

  /**
   * Obtiene el tema actual
   */
  public getCurrentTheme(): ThemeType {
    return this.currentThemeSubject.value;
  }

  /**
   * Cambia el tema de la aplicación
   *
   * @param theme - ID del tema a aplicar
   * @example
   * ```typescript
   * this.themeService.setTheme('neon-nostalgia');
   * ```
   */
  public setTheme(theme: ThemeType): void {
    if (!this.isValidTheme(theme)) {
      console.warn(`Tema inválido: ${theme}. Usando tema por defecto.`);
      theme = this.DEFAULT_THEME;
    }

    this.applyTheme(theme);
    this.saveThemeToStorage(theme);
    this.currentThemeSubject.next(theme);
  }

  /**
   * Aplica el tema al documento
   */
  private applyTheme(theme: ThemeType): void {
    // Remove all theme classes
    this.themes.forEach(t => {
      document.body.removeAttribute('data-theme');
    });

    // Apply new theme
    document.body.setAttribute('data-theme', theme);
  }

  /**
   * Guarda el tema en localStorage
   */
  private saveThemeToStorage(theme: ThemeType): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch (error) {
      console.error('Error al guardar tema en localStorage:', error);
    }
  }

  /**
   * Obtiene información detallada del tema actual
   */
  public getCurrentThemeInfo(): ThemeInfo | undefined {
    const currentTheme = this.getCurrentTheme();
    return this.themes.find(t => t.id === currentTheme);
  }

  /**
   * Obtiene información de un tema específico
   */
  public getThemeInfo(themeId: ThemeType): ThemeInfo | undefined {
    return this.themes.find(t => t.id === themeId);
  }

  /**
   * Cambia al siguiente tema en la lista (útil para botón toggle)
   */
  public cycleToNextTheme(): void {
    const currentIndex = this.themes.findIndex(t => t.id === this.getCurrentTheme());
    const nextIndex = (currentIndex + 1) % this.themes.length;
    this.setTheme(this.themes[nextIndex].id);
  }

  /**
   * Resetea al tema por defecto
   */
  public resetToDefault(): void {
    this.setTheme(this.DEFAULT_THEME);
  }

  /**
   * Verifica si el tema actual es el especificado
   */
  public isCurrentTheme(theme: ThemeType): boolean {
    return this.getCurrentTheme() === theme;
  }

  /**
   * Obtiene todos los temas disponibles
   */
  public getAllThemes(): ThemeInfo[] {
    return [...this.themes];
  }
}
