import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { ChatMessage, ChatService } from '../chat.service';

@Component({
  standalone: false,
  selector: 'app-chat-window',
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
})
export class ChatWindowComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput?: ElementRef<HTMLTextAreaElement>;

  messages: ChatMessage[] = [];
  draft = '';
  minimized = false;
  currentUsername = '';
  currentRole = '';
  partnerEmail = '';
  partnerName = '';
  deviceSiteName: string | null = null;
  chatSearch = '';

  showClearConfirm = false;
  showContextMenu = false;
  contextMenuX = 0;
  contextMenuY = 0;

  width = 360;
  height = 520;
  private resizing = false;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartW = 0;
  private resizeStartH = 0;

  unreadUuids = new Set<string>();
  private openedAt: Date | null = null;
  private boldTimers: Map<string, any> = new Map();

  private messagesSubscription: Subscription | null = null;
  private deviceSub: Subscription | null = null;

  constructor(
    readonly chatService: ChatService,
    private sanitizer: DomSanitizer,
  ) {}

  private dismissContextMenu = () => {
    this.showContextMenu = false;
  };

  ngOnInit(): void {
    document.addEventListener('click', this.dismissContextMenu);
    const loginUser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    this.currentUsername = loginUser.email || loginUser.username || '';
    this.currentRole = loginUser.role || '';

    this.messagesSubscription = this.chatService.messages$.subscribe((msgs) => {
      const hadNew = msgs.length > this.messages.length;
      let incomingCount = 0;

      // Mark new messages from others as unread (bold) + notify
      if (this.openedAt) {
        for (const msg of msgs) {
          if (
            !msg.uuid.startsWith('pending-') &&
            !this.unreadUuids.has(msg.uuid) &&
            !this.boldTimers.has(msg.uuid) &&
            !this.isOwnMessage(msg) &&
            new Date(msg.createdAt) > this.openedAt
          ) {
            incomingCount++;
            this.unreadUuids.add(msg.uuid);
            this.boldTimers.set(
              msg.uuid,
              setTimeout(() => {
                this.unreadUuids.delete(msg.uuid);
                this.boldTimers.delete(msg.uuid);
              }, 10000),
            );
          }
        }
      }

      this.messages = msgs;
      if (hadNew) this.autoScrollToBottom();

      // Auto-mark conversation as read so the bell badge doesn't
      // count messages the reviewer is already looking at
      if (incomingCount > 0 && this.chatService.currentConversationId) {
        this.chatService.markConversationRead(
          this.chatService.currentConversationId,
        );
        this.playNotificationSound();
        this.flashHeader();
      }
    });

    this.deviceSub = this.chatService.openForDevice$.subscribe(
      ({ submitterEmail, siteName }) => {
        if (!submitterEmail) return;
        this.partnerEmail = submitterEmail;
        this.partnerName = submitterEmail;
        this.deviceSiteName = siteName || null;
        this.openedAt = new Date();

        // Look up existing conversation by site name
        this.chatService
          .getConversation(undefined, undefined, siteName || undefined)
          .subscribe({
            next: (conv) => {
              if (conv) {
                this.chatService.openChat(conv);
              } else {
                this.chatService.messages$.next([]);
              }
            },
            error: (err) => {
              console.warn('Chat: could not load conversation', err);
              this.chatService.messages$.next([]);
            },
          });
      },
    );
  }

  onInputKeydown(event: KeyboardEvent): void {
    // Enter alone sends; Shift+Enter inserts a newline (default textarea behavior).
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.send();
    }
  }

  autoResize(el: EventTarget | null): void {
    const ta = el as HTMLTextAreaElement | null;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || !this.partnerEmail) return;
    this.draft = '';
    // Collapse the textarea back to single-line after sending
    if (this.messageInput?.nativeElement) {
      this.messageInput.nativeElement.style.height = 'auto';
    }

    // Optimistic: show message immediately
    const optimistic: ChatMessage = {
      uuid: 'pending-' + Date.now(),
      username: this.currentUsername,
      chatEntry: text,
      nextEntryUuid: null,
      createdAt: new Date().toISOString(),
    };
    this.chatService.messages$.next([...this.messages, optimistic]);

    if (this.chatService.currentConversationId) {
      // Append to existing conversation
      this.chatService.sendMessage(this.currentUsername, text).subscribe({
        next: () => {
          this.chatService
            .getChain(this.chatService.currentHeadUuid!)
            .subscribe((msgs) => this.chatService.messages$.next(msgs));
        },
        error: (err) => console.error('Chat: failed to send message', err),
      });
    } else {
      // Start new conversation
      this.chatService
        .startConversation(
          this.currentUsername,
          this.partnerEmail,
          this.currentUsername,
          text,
          this.deviceSiteName ?? undefined,
        )
        .subscribe({
          next: (result) => {
            this.chatService.openChat(result.conversation);
          },
          error: (err) =>
            console.error('Chat: failed to start conversation', err),
        });
    }
  }

  highlightText(text: string): string | SafeHtml {
    const safe = text.replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c] ?? c,
    );
    const term = this.chatSearch.trim();
    if (!term) return safe;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'gi'); // nosemgrep: detect-non-literal-regexp -- term is regex-escaped above
    const highlighted = safe.replace(
      re,
      (m) => `<mark class="chat-highlight">${m}</mark>`,
    );
    return this.sanitizer.bypassSecurityTrustHtml(highlighted); // nosemgrep: angular-bypasssecuritytrust
  }

  isItalic(text: string): boolean {
    return text.startsWith('_') && text.endsWith('_') && text.length > 2;
  }

  stripItalic(text: string): string {
    return text.slice(1, -1);
  }

  private get isInternalUser(): boolean {
    return ['Admin', 'Reviewer', 'SeniorReviewer'].includes(this.currentRole);
  }

  isOwnMessage(msg: ChatMessage): boolean {
    if (this.isInternalUser) {
      return msg.username !== this.partnerEmail;
    }
    return msg.username === this.currentUsername;
  }

  get filteredMessages(): ChatMessage[] {
    const term = this.chatSearch.trim().toLowerCase();
    if (!term) return this.messages;
    return this.messages.filter(
      (m) =>
        m.chatEntry.toLowerCase().includes(term) ||
        m.username.toLowerCase().includes(term),
    );
  }

  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizing = true;
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.resizeStartW = this.width;
    this.resizeStartH = this.height;
    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);
  }

  private onResizeMove = (event: MouseEvent): void => {
    if (!this.resizing) return;
    // Grip is top-left: dragging left = wider, dragging up = taller
    this.width = Math.max(
      280,
      this.resizeStartW - (event.clientX - this.resizeStartX),
    );
    this.height = Math.max(
      200,
      this.resizeStartH - (event.clientY - this.resizeStartY),
    );
  };

  private onResizeEnd = (): void => {
    this.resizing = false;
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  };

  minimize(): void {
    this.minimized = !this.minimized;
  }

  onContextMenu(event: MouseEvent): void {
    // Only show custom context menu when in device-reviews context (siteName is set)
    if (!this.chatService.siteName$.value) return;
    // If the user has text selected, let the browser's native menu show (Copy, etc.)
    if (!window.getSelection()?.isCollapsed) return;
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.contextMenuX = event.clientX - rect.left;
    this.contextMenuY = event.clientY - rect.top;
    this.showContextMenu = true;
  }

  clearChat(): void {
    this.showContextMenu = false;
    this.showClearConfirm = true;
  }

  confirmClear(): void {
    this.showClearConfirm = false;
    const convId = this.chatService.currentConversationId;
    if (!convId) {
      this.chatService.messages$.next([]);
      return;
    }
    this.chatService.clearConversation(convId).subscribe({
      next: () => {
        this.chatService.messages$.next([]);
        this.chatService.currentConversationId = null;
        this.chatService.currentHeadUuid = null;
        this.chatService.stopPolling();
      },
      error: (err) => console.error('Failed to clear chat', err),
    });
  }

  cancelClear(): void {
    this.showClearConfirm = false;
  }

  close(): void {
    this.chatService.closeChat();
    this.chatService.isChatOpen$.next(false);
  }

  headerFlash = false;

  private playNotificationSound(): void {
    try {
      const ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      /* audio not available */
    }
  }

  private flashHeader(): void {
    this.headerFlash = true;
    setTimeout(() => (this.headerFlash = false), 1500);
  }

  scrollToTop(): void {
    if (this.messagesContainer) {
      this.messagesContainer.nativeElement.scrollTop = 0;
    }
  }

  scrollToBottom(): void {
    if (this.messagesContainer) {
      const el = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  private autoScrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesContainer) {
        const el = this.messagesContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.messageInput?.nativeElement.focus(), 0);
  }

  ngOnDestroy(): void {
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }
    if (this.deviceSub) {
      this.deviceSub.unsubscribe();
    }
    this.chatService.stopPolling();
    this.boldTimers.forEach((t) => clearTimeout(t));
    this.boldTimers.clear();
    document.removeEventListener('click', this.dismissContextMenu);
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  }
}
