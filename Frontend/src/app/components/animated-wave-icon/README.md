# ▶️ Animated Wave Icon Component

Logo oficial de **WatchTogether** - Un ícono minimalista con un triángulo de play y tres ondas de sonido que se adapta dinámicamente a los 5 temas de la aplicación.

## 🎨 Características

- ✅ **Diseño limpio y moderno** - Triángulo de play + 3 ondas de sonido en arco
- ✅ **Adaptativo a temas** - Cambia automáticamente con el tema activo usando CSS Variables
- ✅ **Animaciones fluidas** - El triángulo pulsa y las ondas tienen delays escalonados
- ✅ **Gradientes dinámicos** - Usa los colores del tema actual (fucsia → cian por defecto)
- ✅ **Efecto glow neón** - Resplandor opcional con filtro SVG avanzado
- ✅ **Completamente configurable** - Tamaño, grosor de trazo, animaciones, glow
- ✅ **Standalone component** - Fácil de importar y usar
- ✅ **Diseño vectorial** - SVG escalable sin pérdida de calidad

---

## 📦 Instalación

### 1. Importar el componente

```typescript
import { AnimatedWaveIconComponent } from './components/animated-wave-icon/animated-wave-icon.component';

@Component({
  // ...
  imports: [AnimatedWaveIconComponent]
})
```

### 2. Usar en el template

```html
<!-- Uso básico -->
<app-animated-wave-icon></app-animated-wave-icon>

<!-- Con configuración personalizada -->
<app-animated-wave-icon
  [size]="100"
  [strokeWidth]="6"
  [animated]="true"
  [useGradient]="true"
  [withGlow]="true">
</app-animated-wave-icon>
```

---

## ⚙️ Propiedades (Inputs)

| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `size` | `number` | `100` | Tamaño del ícono en píxeles (ancho y alto) |
| `strokeWidth` | `number` | `6` | Grosor de las líneas de las ondas |
| `animated` | `boolean` | `false` | Activar animación de pulsación |
| `useGradient` | `boolean` | `true` | Usar gradiente del tema o color sólido |
| `withGlow` | `boolean` | `false` | Aplicar efecto de resplandor (ideal para tema Neón) |

---

## 🎯 Ejemplos de Uso

### Ejemplo 1: Logo en Home (actual)
```html
<div class="icon">
  <app-animated-wave-icon
    [size]="100"
    [strokeWidth]="6"
    [animated]="true"
    [useGradient]="true"
    [withGlow]="true">
  </app-animated-wave-icon>
</div>
```

### Ejemplo 2: Ícono pequeño en header
```html
<div class="header-logo">
  <app-animated-wave-icon
    [size]="40"
    [strokeWidth]="4"
    [animated]="false"
    [useGradient]="false">
  </app-animated-wave-icon>
  <span>WatchTogether</span>
</div>
```

### Ejemplo 3: Loading state
```html
<div class="loading-container">
  <app-animated-wave-icon
    [size]="80"
    [animated]="true"
    [useGradient]="true"
    [withGlow]="true">
  </app-animated-wave-icon>
  <p>Cargando sala...</p>
</div>
```

### Ejemplo 4: Botón con ícono
```html
<button class="action-button">
  <app-animated-wave-icon
    [size]="24"
    [strokeWidth]="5"
    [animated]="false">
  </app-animated-wave-icon>
  Compartir
</button>
```

---

## 🎨 Adaptación a Temas

El componente se adapta automáticamente a cada tema usando CSS Variables:

### Colores que utiliza:
- `--primary-solid` - Color principal sólido
- `--primary-start` - Inicio del gradiente
- `--primary-end` - Fin del gradiente

### Por tema:

| Tema | Colores |
|------|---------|
| 🌃 **Nostalgia Neón** | Fucsia (#FF00AA) → Cian (#00FFD1) |
| 🌅 **Atardecer Tropical** | Rosa (#EC4899) → Naranja (#F97316) |
| 🌌 **Aurora Boreal** | Verde menta (#98FF98) → Púrpura (#A941D2) |
| 💜 **Blurple Elegante** | Púrpura (#8956FB) → Púrpura vibrante (#9146FF) |
| 🌟 **Noche Dorada** | Oro (#FACC15) → Oro puro (#FFD700) |

---

## 🎬 Animaciones

El componente incluye animaciones suaves que se aplican cuando `[animated]="true"`:

**Animación del triángulo de play:**
```css
@keyframes playPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

**Animación de las ondas de sonido:**
```css
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
```

**Delays escalonados:**
- Onda pequeña: 0.1s delay
- Onda mediana: 0.2s delay
- Onda grande: 0.3s delay

Este efecto escalonado crea una animación fluida que simula ondas de sonido propagándose desde el botón de play.

---

## 🎨 Personalización Avanzada

### Cambiar el efecto hover

```css
::ng-deep .wave-icon:hover {
  transform: scale(1.2) rotate(5deg);
}
```

### Cambiar la velocidad de animación

```css
::ng-deep .wave-icon.animated .play-triangle {
  animation-duration: 1.5s; /* Por defecto: 2s */
}

::ng-deep .wave-icon.animated .sound-waves path {
  animation-duration: 1.5s; /* Por defecto: 2s */
}
```

### Cambiar los delays de las ondas

```css
::ng-deep .wave-icon.animated .wave-small {
  animation-delay: 0s; /* Por defecto: 0.1s */
}

::ng-deep .wave-icon.animated .wave-medium {
  animation-delay: 0.15s; /* Por defecto: 0.2s */
}

::ng-deep .wave-icon.animated .wave-large {
  animation-delay: 0.3s; /* Por defecto: 0.3s */
}
```

### Cambiar el grosor del trazo

```css
::ng-deep .play-triangle {
  stroke-width: 14 !important; /* Más grueso */
}

::ng-deep .sound-waves path {
  stroke-width: 10 !important; /* Más grueso */
}
```

### Cambiar el color manualmente (override)

```html
<app-animated-wave-icon
  style="--primary-solid: #ff0000; --primary-start: #ff0000; --primary-end: #ff6600;">
</app-animated-wave-icon>
```

---

## 📱 Responsive

El ícono es totalmente responsive y escala proporcionalmente. Recomendaciones de tamaño:

- **Mobile:** 60-80px
- **Tablet:** 80-100px
- **Desktop:** 100-120px
- **Headers:** 32-48px
- **Botones:** 20-32px

---

## 🚀 Rendimiento

- **SVG inline** - No requiere carga de archivos externos
- **CSS Variables** - Cambios de tema instantáneos sin re-render
- **GPU-accelerated** - Animaciones usando transform y opacity
- **Tamaño:** ~2KB (minificado)

---

## 🎯 Uso en Componentes Existentes

### Home Component ✅
Ya implementado en `home.component.html:4-10`

### Room Component (sugerido)
```html
<!-- En el header de la sala -->
<div class="room-header">
  <app-animated-wave-icon
    [size]="40"
    [animated]="false">
  </app-animated-wave-icon>
  <!-- ... resto del header -->
</div>
```

### Loading Component (sugerido)
```html
<div class="loading">
  <app-animated-wave-icon
    [size]="100"
    [animated]="true"
    [withGlow]="true">
  </app-animated-wave-icon>
  <p>Conectando a la sala...</p>
</div>
```

---

## 🐛 Troubleshooting

### El ícono no cambia de color con el tema
**Solución:** Asegúrate de que `themes.css` está cargado correctamente en `angular.json` y que las CSS Variables `--primary-start` y `--primary-end` están definidas.

### La animación no funciona
**Solución:** Verifica que `[animated]="true"` está establecido (no como string `"true"`). Las ondas deben tener delays escalonados (0.1s, 0.2s, 0.3s).

### El efecto glow no se ve
**Solución:** Asegúrate de tener `[withGlow]="true"` establecido. El glow usa el filtro SVG `neonGlow` con feGaussianBlur y feColorMatrix.

### El gradiente no se ve
**Solución:** El gradiente usa un `<linearGradient>` con ID `primaryNeon`. Verifica que `[useGradient]="true"` esté establecido. El gradiente es horizontal (izquierda → derecha).

### Las ondas se ven muy gruesas o delgadas
**Solución:** Las ondas usan `strokeWidth * 0.67` para ser más delgadas que el triángulo. Ajusta el `[strokeWidth]` en el componente. El valor por defecto es 6, resultando en ~4px para las ondas.

### El ícono se ve cortado o desproporcionado
**Solución:** El viewBox es `0 0 256 256`. El SVG escalará proporcionalmente. El triángulo está en `96,80 96,176 176,128` y las ondas van de 186 a 210 en X.

---

## 📄 Licencia

Parte del proyecto WatchTogether - Uso libre dentro de la aplicación.

---

## ✨ Mejoras Futuras

- [ ] Soporte para múltiples variantes (ícono de micrófono, play, etc.)
- [ ] Exportar como SVG standalone para uso en otros contextos
- [ ] Animaciones adicionales (bounce, rotate, pulse variations)
- [ ] Soporte para dark/light mode independiente de temas
- [ ] Generación dinámica de favicon
