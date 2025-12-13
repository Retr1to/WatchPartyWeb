import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';
import { Observable } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  animations: [
    trigger('slideIn', [
      state('in', style({ transform: 'translateX(0)', opacity: 1 })),
      transition('void => *', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('300ms ease-out')
      ]),
      transition('* => void', [
        animate('300ms ease-in', style({ transform: 'translateX(100%)', opacity: 0 }))
      ])
    ])
  ],
  template: `
    <div class="toast-container">
      <div
        *ngFor="let toast of toasts$ | async; trackBy: trackByToastId"
        class="toast"
        [class.toast-success]="toast.type === 'success'"
        [class.toast-error]="toast.type === 'error'"
        [class.toast-warning]="toast.type === 'warning'"
        [class.toast-info]="toast.type === 'info'"
        [@slideIn]
      >
        <div class="toast-icon">{{ toast.icon }}</div>
        <div class="toast-message">{{ toast.message }}</div>
        <button class="toast-close" (click)="dismiss(toast.id)">×</button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    }

    .toast {
      min-width: 320px;
      max-width: 420px;
      padding: 16px 20px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      pointer-events: auto;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
      animation: slideIn 0.3s ease-out;
      transition: all 0.3s ease;
    }

    .toast:hover {
      transform: translateX(-4px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast-success {
      background: rgba(34, 197, 94, 0.15);
      border-left: 4px solid var(--color-success);
      color: var(--color-success);
    }

    .toast-error {
      background: rgba(239, 68, 68, 0.15);
      border-left: 4px solid var(--color-error);
      color: var(--color-error);
    }

    .toast-warning {
      background: rgba(251, 191, 36, 0.15);
      border-left: 4px solid var(--color-warning);
      color: var(--color-warning);
    }

    .toast-info {
      background: rgba(59, 130, 246, 0.15);
      border-left: 4px solid var(--color-info);
      color: var(--color-info);
    }

    .toast-icon {
      font-size: 1.5rem;
      font-weight: bold;
      min-width: 24px;
      text-align: center;
    }

    .toast-message {
      flex: 1;
      font-size: 0.95rem;
      color: var(--text-primary);
      line-height: 1.4;
    }

    .toast-close {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .toast-close:hover {
      background: rgba(255, 255, 255, 0.1);
      color: var(--text-primary);
    }

    /* Responsive */
    @media (max-width: 600px) {
      .toast-container {
        top: 10px;
        right: 10px;
        left: 10px;
      }

      .toast {
        min-width: auto;
        max-width: none;
      }
    }
  `]
})
export class ToastComponent implements OnInit {
  toasts$: Observable<Toast[]>;

  constructor(private toastService: ToastService) {
    this.toasts$ = this.toastService.toasts$;
  }

  ngOnInit(): void {}

  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }

  trackByToastId(index: number, toast: Toast): string {
    return toast.id;
  }
}
