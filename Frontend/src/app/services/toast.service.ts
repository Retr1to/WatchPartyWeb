import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  icon?: string;
}

/**
 * Servicio para gestionar notificaciones toast
 *
 * Características:
 * - 4 tipos: success, error, warning, info
 * - Auto-dismiss configurable
 * - Múltiples toasts simultáneos
 * - Animaciones suaves
 *
 * @example
 * ```typescript
 * constructor(private toastService: ToastService) {}
 *
 * showSuccess() {
 *   this.toastService.success('Operación exitosa');
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$: Observable<Toast[]> = this.toastsSubject.asObservable();

  private defaultDuration = 3000; // 3 segundos

  /**
   * Mostrar toast de éxito
   */
  success(message: string, duration?: number): void {
    this.show({
      type: 'success',
      message,
      duration: duration || this.defaultDuration,
      icon: '✓'
    });
  }

  /**
   * Mostrar toast de error
   */
  error(message: string, duration?: number): void {
    this.show({
      type: 'error',
      message,
      duration: duration || this.defaultDuration,
      icon: '✕'
    });
  }

  /**
   * Mostrar toast de advertencia
   */
  warning(message: string, duration?: number): void {
    this.show({
      type: 'warning',
      message,
      duration: duration || this.defaultDuration,
      icon: '⚠'
    });
  }

  /**
   * Mostrar toast informativo
   */
  info(message: string, duration?: number): void {
    this.show({
      type: 'info',
      message,
      duration: duration || this.defaultDuration,
      icon: 'ℹ'
    });
  }

  /**
   * Mostrar toast personalizado
   */
  private show(toast: Omit<Toast, 'id'>): void {
    const id = this.generateId();
    const newToast: Toast = { ...toast, id };

    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, newToast]);

    // Auto-dismiss
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, toast.duration);
    }
  }

  /**
   * Cerrar toast por ID
   */
  dismiss(id: string): void {
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next(currentToasts.filter(t => t.id !== id));
  }

  /**
   * Cerrar todos los toasts
   */
  clear(): void {
    this.toastsSubject.next([]);
  }

  /**
   * Generar ID único
   */
  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
