import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SocketService, QueueItem } from '../../services/socket.service';
import { QueueService, AddToQueueRequest } from '../../services/queue.service';
import { ToastService } from '../../services/toast.service';

type ScheduleType = 'none' | 'absolute' | 'relative_time' | 'relative_videos';

@Component({
  selector: 'app-video-queue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './video-queue.component.html',
  styleUrls: ['./video-queue.component.css']
})
export class VideoQueueComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  @Input() roomId: string = '';
  @Input() isHost: boolean = false;

  @Output() queueItemSelected = new EventEmitter<QueueItem>();

  queueItems: QueueItem[] = [];
  autoAdvance: boolean = true;
  currentIndex: number = -1;
  isLoading: boolean = false;

  // Form state
  showAddForm: boolean = false;
  newVideoUrl: string = '';
  newVideoTitle: string = '';
  scheduleType: ScheduleType = 'none';
  scheduledDate: string = '';
  scheduledTime: string = '';
  relativeMinutes: number = 5;
  relativeVideoCount: number = 1;

  // Drag and drop state
  draggedItemId: string | null = null;

  constructor(
    private socketService: SocketService,
    private queueService: QueueService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.setupSocketListeners();
    this.loadQueue();
  }

  private setupSocketListeners(): void {
    this.socketService.onQueueUpdated().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.queueItems = data.items;
      this.autoAdvance = data.autoAdvance;
      this.currentIndex = data.currentIndex;
    });

    this.socketService.onQueueAdvance().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.queueItems = data.items;
      this.currentIndex = data.currentIndex;
    });

    this.socketService.onQueueSettingsUpdated().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.autoAdvance = data.autoAdvance;
    });

    this.socketService.onQueueExhausted().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.queueItems = data.items;
      this.currentIndex = data.currentIndex;
    });
  }

  async loadQueue(): Promise<void> {
    if (!this.roomId) return;

    try {
      this.isLoading = true;
      const queue = await this.queueService.getQueue(this.roomId);
      this.queueItems = queue.items;
      this.autoAdvance = queue.autoAdvance;
      this.currentIndex = queue.currentIndex;
    } catch (error) {
      console.error('[VideoQueueComponent] Error loading queue:', error);
    } finally {
      this.isLoading = false;
    }
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.newVideoUrl = '';
    this.newVideoTitle = '';
    this.scheduleType = 'none';
    this.scheduledDate = '';
    this.scheduledTime = '';
    this.relativeMinutes = 5;
    this.relativeVideoCount = 1;
  }

  async addToQueue(): Promise<void> {
    if (!this.newVideoUrl.trim()) {
      this.toastService.error('Por favor ingresa una URL de video');
      return;
    }

    const request: AddToQueueRequest = {
      videoUrl: this.newVideoUrl.trim(),
      title: this.newVideoTitle.trim() || undefined,
      scheduleType: this.scheduleType
    };

    // Detect provider
    const ytId = this.extractYouTubeId(request.videoUrl);
    if (ytId) {
      request.provider = 'youtube';
      request.videoId = ytId;
    } else {
      request.provider = 'url';
    }

    // Handle scheduling
    if (this.scheduleType === 'absolute' && this.scheduledDate && this.scheduledTime) {
      const localDateTime = new Date(`${this.scheduledDate}T${this.scheduledTime}`);
      request.scheduledAtUtc = localDateTime.toISOString();
    } else if (this.scheduleType === 'relative_time' && this.relativeMinutes > 0) {
      request.relativeMinutes = this.relativeMinutes;
    } else if (this.scheduleType === 'relative_videos' && this.relativeVideoCount > 0) {
      request.relativeVideoCount = this.relativeVideoCount;
    }

    try {
      this.isLoading = true;
      await this.queueService.addToQueue(this.roomId, request);
      this.toastService.success('Video agregado a la cola');
      this.toggleAddForm();
    } catch (error: any) {
      console.error('[VideoQueueComponent] Error adding to queue:', error);
      this.toastService.error(error.message || 'Error al agregar a la cola');
    } finally {
      this.isLoading = false;
    }
  }

  async removeFromQueue(itemId: string): Promise<void> {
    try {
      await this.queueService.removeFromQueue(this.roomId, itemId);
      this.toastService.success('Video eliminado de la cola');
    } catch (error: any) {
      console.error('[VideoQueueComponent] Error removing from queue:', error);
      this.toastService.error(error.message || 'Error al eliminar de la cola');
    }
  }

  async toggleAutoAdvance(): Promise<void> {
    try {
      await this.queueService.updateSettings(this.roomId, !this.autoAdvance);
    } catch (error: any) {
      console.error('[VideoQueueComponent] Error updating settings:', error);
      this.toastService.error(error.message || 'Error al actualizar configuración');
    }
  }

  skipToNext(): void {
    this.socketService.skipToNext();
  }

  // Drag and drop handlers
  onDragStart(event: DragEvent, itemId: string): void {
    if (!this.isHost) return;
    this.draggedItemId = itemId;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', itemId);
    }
  }

  onDragOver(event: DragEvent): void {
    if (!this.isHost) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event: DragEvent, targetItemId: string): void {
    if (!this.isHost) return;
    event.preventDefault();

    if (!this.draggedItemId || this.draggedItemId === targetItemId) {
      this.draggedItemId = null;
      return;
    }

    // Calculate new order
    const sourceIndex = this.queueItems.findIndex(i => i.itemId === this.draggedItemId);
    const targetIndex = this.queueItems.findIndex(i => i.itemId === targetItemId);

    if (sourceIndex === -1 || targetIndex === -1) {
      this.draggedItemId = null;
      return;
    }

    // Create new order
    const newItems = [...this.queueItems];
    const [removed] = newItems.splice(sourceIndex, 1);
    newItems.splice(targetIndex, 0, removed);

    // Update positions
    const newOrder = newItems.map(item => item.itemId);
    this.reorderQueue(newOrder);

    this.draggedItemId = null;
  }

  onDragEnd(): void {
    this.draggedItemId = null;
  }

  private async reorderQueue(itemIds: string[]): Promise<void> {
    try {
      await this.queueService.reorderQueue(this.roomId, itemIds);
    } catch (error: any) {
      console.error('[VideoQueueComponent] Error reordering queue:', error);
      this.toastService.error(error.message || 'Error al reordenar la cola');
      // Reload to restore correct order
      await this.loadQueue();
    }
  }

  private extractYouTubeId(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtube.com')) {
        const v = parsed.searchParams.get('v');
        if (v) return v;
        if (parsed.pathname.startsWith('/embed/')) {
          const parts = parsed.pathname.split('/');
          return parts[parts.length - 1] || null;
        }
        if (parsed.pathname.startsWith('/shorts/')) {
          const parts = parsed.pathname.split('/').filter(Boolean);
          return parts[1] || null;
        }
      }
      if (parsed.hostname === 'youtu.be') {
        const parts = parsed.pathname.split('/').filter(Boolean);
        return parts[0] || null;
      }
    } catch {
      return null;
    }
    return null;
  }

  formatSchedule(item: QueueItem): string {
    if (item.scheduleType === 'absolute' && item.scheduledAtUtc) {
      const date = new Date(item.scheduledAtUtc);
      return date.toLocaleString();
    }
    if (item.scheduleType === 'relative_time' && item.relativeMinutes) {
      return `En ${item.relativeMinutes} min`;
    }
    if (item.scheduleType === 'relative_videos' && item.relativeVideoCount) {
      return `Después de ${item.relativeVideoCount} video(s)`;
    }
    return '';
  }

  isCurrentItem(item: QueueItem): boolean {
    return item.position === this.currentIndex;
  }

  getDisplayTitle(item: QueueItem): string {
    if (item.title) return item.title;
    if (item.videoId) return `YouTube: ${item.videoId}`;
    try {
      const url = new URL(item.videoUrl);
      return url.pathname.split('/').pop() || item.videoUrl;
    } catch {
      return item.videoUrl;
    }
  }
}
