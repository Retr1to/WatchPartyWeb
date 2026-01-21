import { Injectable } from '@angular/core';
import { SocketService, QueueItem, VideoQueue } from './socket.service';

export interface AddToQueueRequest {
  videoUrl: string;
  videoFileName?: string;
  provider?: string;
  videoId?: string;
  title?: string;
  scheduleType?: string;
  scheduledAtUtc?: string;
  relativeMinutes?: number;
  relativeVideoCount?: number;
}

export interface QueueResponse {
  success: boolean;
  item?: QueueItem;
  queue: VideoQueue;
}

@Injectable({
  providedIn: 'root'
})
export class QueueService {
  constructor(private socketService: SocketService) {}

  private getBaseUrl(): string {
    return this.socketService.getHttpBaseUrl();
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-User-Id': this.socketService.getCurrentUserId(),
      'X-Session-Key': this.socketService.getSessionKey()
    };
  }

  async getQueue(roomId: string): Promise<VideoQueue> {
    const response = await fetch(`${this.getBaseUrl()}/room/${roomId}/queue`);
    if (!response.ok) {
      throw new Error('Failed to get queue');
    }
    return response.json();
  }

  async addToQueue(roomId: string, request: AddToQueueRequest): Promise<QueueResponse> {
    const response = await fetch(`${this.getBaseUrl()}/room/${roomId}/queue`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to add to queue');
    }

    return response.json();
  }

  async removeFromQueue(roomId: string, itemId: string): Promise<QueueResponse> {
    const response = await fetch(`${this.getBaseUrl()}/room/${roomId}/queue/${itemId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to remove from queue');
    }

    return response.json();
  }

  async reorderQueue(roomId: string, itemIds: string[]): Promise<QueueResponse> {
    const response = await fetch(`${this.getBaseUrl()}/room/${roomId}/queue/reorder`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ itemIds })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to reorder queue');
    }

    return response.json();
  }

  async updateSettings(roomId: string, autoAdvance: boolean): Promise<{ success: boolean; autoAdvance: boolean }> {
    const response = await fetch(`${this.getBaseUrl()}/room/${roomId}/queue/settings`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ autoAdvance })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to update settings');
    }

    return response.json();
  }
}
