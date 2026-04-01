import { Component, OnInit } from '@angular/core';
import { WebhookService, Webhook } from '../../../auth/services/webhook.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  standalone: false,
  selector: 'app-webhooks',
  templateUrl: './webhooks.component.html',
  styleUrls: ['./webhooks.component.scss'],
})
export class WebhooksComponent implements OnInit {
  webhooks: Webhook[] = [];
  loading = true;

  // Add/edit form
  showForm = false;
  editingId: number | null = null;
  formUrl = '';
  formEvents: Record<string, boolean> = { 'message.new': true, 'conversation.created': true };
  formActive = true;
  formSecret = '';
  createdSecret: string | null = null;

  availableEvents = ['message.new', 'conversation.created'];

  constructor(
    private webhookService: WebhookService,
    private toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    this.loadWebhooks();
  }

  loadWebhooks(): void {
    this.loading = true;
    this.webhookService.getAll().subscribe({
      next: (data) => {
        this.webhooks = data;
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load webhooks');
        this.loading = false;
      },
    });
  }

  openAddForm(): void {
    this.editingId = null;
    this.formUrl = '';
    this.formEvents = { 'message.new': true, 'conversation.created': true };
    this.formActive = true;
    this.formSecret = '';
    this.createdSecret = null;
    this.showForm = true;
  }

  openEditForm(wh: Webhook): void {
    this.editingId = wh.id;
    this.formUrl = wh.url;
    this.formEvents = {};
    for (const ev of this.availableEvents) {
      this.formEvents[ev] = wh.events.includes(ev);
    }
    this.formActive = wh.active;
    this.formSecret = '';
    this.createdSecret = null;
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.createdSecret = null;
  }

  save(): void {
    const events = this.availableEvents.filter((ev) => this.formEvents[ev]);
    if (!this.formUrl.trim()) {
      this.toastr.warning('URL is required');
      return;
    }
    if (events.length === 0) {
      this.toastr.warning('Select at least one event');
      return;
    }

    if (this.editingId) {
      const payload: any = { url: this.formUrl, events, active: this.formActive };
      if (this.formSecret.trim()) payload.secret = this.formSecret;
      this.webhookService.update(this.editingId, payload).subscribe({
        next: () => {
          this.toastr.success('Webhook updated');
          this.showForm = false;
          this.loadWebhooks();
        },
        error: () => this.toastr.error('Failed to update webhook'),
      });
    } else {
      const payload: any = { url: this.formUrl, events };
      if (this.formSecret.trim()) payload.secret = this.formSecret;
      this.webhookService.create(payload).subscribe({
        next: (created) => {
          this.toastr.success('Webhook created');
          this.createdSecret = created.secret;
          this.loadWebhooks();
        },
        error: () => this.toastr.error('Failed to create webhook'),
      });
    }
  }

  testWebhook(wh: Webhook): void {
    this.webhookService.test(wh.id).subscribe({
      next: () => this.toastr.success(`Ping sent to ${wh.url}`),
      error: () => this.toastr.error('Ping failed'),
    });
  }

  toggleActive(wh: Webhook): void {
    this.webhookService.update(wh.id, { active: !wh.active }).subscribe({
      next: () => {
        wh.active = !wh.active;
        this.toastr.success(wh.active ? 'Webhook enabled' : 'Webhook disabled');
      },
      error: () => this.toastr.error('Failed to update'),
    });
  }

  deleteWebhook(wh: Webhook): void {
    if (!confirm(`Delete webhook for ${wh.url}?`)) return;
    this.webhookService.remove(wh.id).subscribe({
      next: () => {
        this.toastr.success('Webhook deleted');
        this.loadWebhooks();
      },
      error: () => this.toastr.error('Failed to delete'),
    });
  }

  copySecret(): void {
    if (this.createdSecret) {
      navigator.clipboard.writeText(this.createdSecret);
      this.toastr.info('Secret copied to clipboard');
    }
  }
}
