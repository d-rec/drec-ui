import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { ChatMessage, ChatService, ChatConversation } from '../chat.service';

@Component({
  standalone: false,
  selector: 'app-chat-window',
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  draft = '';
  minimized = false;
  currentUsername = '';
  partnerEmail = '';
  partnerName = '';
  deviceProjectName: string | null = null;
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

  private messagesSubscription: Subscription | null = null;
  private deviceSub: Subscription | null = null;

  constructor(readonly chatService: ChatService, private sanitizer: DomSanitizer) {}

  private dismissContextMenu = () => { this.showContextMenu = false; };

  ngOnInit(): void {
    document.addEventListener('click', this.dismissContextMenu);
    const loginUser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    this.currentUsername = loginUser.email || loginUser.username || '';

    this.messagesSubscription = this.chatService.messages$.subscribe((msgs) => {
      const hadNew = msgs.length > this.messages.length;
      this.messages = msgs;
      if (hadNew) this.autoScrollToBottom();
    });

    this.deviceSub = this.chatService.openForDevice$.subscribe(({ submitterEmail, siteName }) => {
      if (!submitterEmail) return;
      this.partnerEmail = submitterEmail;
      this.partnerName = submitterEmail;
      this.deviceProjectName = siteName || null;

      // Look up existing conversation by site name
      this.chatService.getConversation(undefined, undefined, siteName || undefined).subscribe({
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
    });
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || !this.partnerEmail) return;
    this.draft = '';

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
          this.deviceProjectName ?? undefined,
        )
        .subscribe({
          next: (result) => {
            this.chatService.openChat(result.conversation);
          },
          error: (err) => console.error('Chat: failed to start conversation', err),
        });
    }
  }

  highlightText(text: string): string | SafeHtml {
    const safe = text.replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
    const term = this.chatSearch.trim();
    if (!term) return safe;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.sanitizer.bypassSecurityTrustHtml(
      safe.replace(new RegExp(escaped, 'gi'), m => `<mark class="chat-highlight">${m}</mark>`),
    );
  }

  isItalic(text: string): boolean {
    return text.startsWith('_') && text.endsWith('_') && text.length > 2;
  }

  stripItalic(text: string): string {
    return text.slice(1, -1);
  }

  get filteredMessages(): ChatMessage[] {
    const term = this.chatSearch.trim().toLowerCase();
    if (!term) return this.messages;
    return this.messages.filter(m =>
      m.chatEntry.toLowerCase().includes(term) ||
      m.username.toLowerCase().includes(term)
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
    this.width = Math.max(280, this.resizeStartW - (event.clientX - this.resizeStartX));
    this.height = Math.max(200, this.resizeStartH - (event.clientY - this.resizeStartY));
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
    // Only show context menu when in device-reviews context (siteName is set)
    if (!this.chatService.siteName$.value) return;
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

  ngOnDestroy(): void {
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }
    if (this.deviceSub) {
      this.deviceSub.unsubscribe();
    }
    this.chatService.stopPolling();
    document.removeEventListener('click', this.dismissContextMenu);
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  }
}
