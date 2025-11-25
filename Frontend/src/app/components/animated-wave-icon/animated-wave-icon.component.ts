import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Componente de ícono de ondas animado que se adapta a los temas
 *
 * Uso:
 * <app-animated-wave-icon [size]="200" [animated]="true"></app-animated-wave-icon>
 */
@Component({
  selector: 'app-animated-wave-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      [attr.viewBox]="viewBox"
      [class.animated]="animated"
      class="wave-icon"
      xmlns="http://www.w3.org/2000/svg">

      <defs>
        <!-- Gradiente dinámico basado en el tema -->
        <linearGradient id="primaryNeon" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" class="gradient-start" />
          <stop offset="100%" class="gradient-end" />
        </linearGradient>

        <!-- Filtro de glow neón -->
        <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur"/>
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 1
                    0 0 0 0 0.4
                    0 0 0 0 0.7
                    0 0 0 0.9 0" />
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- Grupo centrado -->
      <g transform="translate(-25, 0)">
        <!-- Triángulo de play (borde neón) -->
        <polygon
          points="96,80 96,176 176,128"
          fill="none"
          [attr.stroke]="useGradient ? 'url(#primaryNeon)' : null"
          [attr.stroke-width]="strokeWidth"
          stroke-linejoin="round"
          [attr.filter]="withGlow ? 'url(#neonGlow)' : null"
          class="play-triangle" />

        <!-- Ondas de sonido (arcos) -->
        <g fill="none"
           [attr.stroke]="useGradient ? 'url(#primaryNeon)' : null"
           stroke-linecap="round"
           [attr.stroke-width]="strokeWidth * 0.67"
           [attr.filter]="withGlow ? 'url(#neonGlow)' : null"
           class="sound-waves">
          <!-- Onda pequeña -->
          <path d="M186 102 A32 32 0 0 1 186 154" class="wave-small" />
          <!-- Onda mediana -->
          <path d="M198 92 A46 46 0 0 1 198 164" class="wave-medium" />
          <!-- Onda grande -->
          <path d="M210 82 A60 60 0 0 1 210 174" class="wave-large" />
        </g>
      </g>
    </svg>
  `,
  styles: [`
    .wave-icon {
      display: inline-block;
      transition: all 0.3s ease;
    }

    .wave-icon:hover {
      transform: scale(1.05);
    }

    /* Gradientes para cada stop - adaptados a los temas usando CSS Variables */
    .gradient-start {
      stop-color: var(--primary-start);
    }

    .gradient-end {
      stop-color: var(--primary-end);
    }

    /* Triángulo de play */
    .play-triangle {
      stroke: var(--primary-solid);
      transition: stroke 0.5s ease, opacity 0.5s ease;
    }

    /* Ondas de sonido */
    .sound-waves path {
      stroke: var(--primary-solid);
      transition: stroke 0.5s ease, opacity 0.5s ease;
    }

    /* Animación del triángulo de play */
    .wave-icon.animated .play-triangle {
      animation: playPulse 2s ease-in-out infinite;
      transform-origin: center;
    }

    /* Animación de las ondas con delays escalonados */
    .wave-icon.animated .wave-small {
      animation: wavePulse 2s ease-in-out infinite 0.1s;
    }

    .wave-icon.animated .wave-medium {
      animation: wavePulse 2s ease-in-out infinite 0.2s;
    }

    .wave-icon.animated .wave-large {
      animation: wavePulse 2s ease-in-out infinite 0.3s;
    }

    @keyframes playPulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }

    @keyframes wavePulse {
      0%, 100% {
        opacity: 1;
        stroke-width: 8;
      }
      50% {
        opacity: 0.5;
        stroke-width: 6;
      }
    }

    /* Efecto hover más intenso */
    .wave-icon:hover .play-triangle,
    .wave-icon:hover .sound-waves path {
      filter: drop-shadow(0 0 8px var(--primary-solid));
    }
  `]
})
export class AnimatedWaveIconComponent {
  /** Tamaño del ícono en píxeles */
  @Input() size: number = 100;

  /** Ancho del trazo */
  @Input() strokeWidth: number = 6;

  /** Activar animación */
  @Input() animated: boolean = false;

  /** Usar gradiente en lugar de color sólido */
  @Input() useGradient: boolean = true;

  /** Aplicar efecto glow */
  @Input() withGlow: boolean = false;

  get viewBox(): string {
    return '0 0 256 256';
  }
}
