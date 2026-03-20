import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ChatMessage, ChatService, ChatConversation } from '../chat.service';

@Component({
  selector: 'app-chat-window',
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  draft = '';
  newConversationEmail = '';
  minimized = false;
  isAdmin = false;
  currentUsername = '';
  adminEmail = '';
  partnerName = '';
  conversations: ChatConversation[] = [];
  selectedConversation: ChatConversation | null = null;
  showNewConversationForm = false;

  private messagesSubscription: Subscription | null = null;

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    const loginUser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    this.currentUsername = loginUser.email || loginUser.username || '';
    this.isAdmin = loginUser.role === 'Admin';

    this.messagesSubscription = this.chatService.messages$.subscribe((msgs) => {
      this.messages = msgs;
      this.scrollToBottom();
    });

    if (this.isAdmin) {
      this.loadAdminConversations();
    } else {
      this.initNonAdminChat();
    }
  }

  private loadAdminConversations(): void {
    this.chatService.getAllConversations().subscribe((convs) => {
      this.conversations = convs;
    });
  }

  private initNonAdminChat(): void {
    this.chatService.getAdminUser().subscribe((admin) => {
      if (!admin) return;
      this.adminEmail = admin.email;
      this.partnerName = `${admin.firstName} ${admin.lastName}`;

      this.chatService
        .getConversation(this.currentUsername, this.adminEmail)
        .subscribe((conv) => {
          if (conv) {
            this.chatService.openChat(conv);
          }
        });
    });
  }

  selectConversation(conv: ChatConversation): void {
    this.selectedConversation = conv;
    const partner =
      conv.participant1 === this.currentUsername
        ? conv.participant2
        : conv.participant1;
    this.partnerName = partner;
    this.chatService.openChat(conv);
  }

  backToList(): void {
    this.selectedConversation = null;
    this.partnerName = '';
    this.chatService.closeChat();
    this.loadAdminConversations();
  }

  startNewConversation(): void {
    const email = this.newConversationEmail.trim();
    if (!email) return;

    this.chatService.getConversation(this.currentUsername, email).subscribe((conv) => {
      if (conv) {
        this.newConversationEmail = '';
        this.showNewConversationForm = false;
        this.selectConversation(conv);
      } else {
        // Placeholder — conversation created on first message send
        this.selectedConversation = {
          id: -1,
          participant1: this.currentUsername,
          participant2: email,
          headUuid: '',
          lastEntryUuid: null,
          deviceProjectName: null,
        };
        this.partnerName = email;
        this.newConversationEmail = '';
        this.showNewConversationForm = false;
      }
    });
  }

  send(): void {
    const text = this.draft.trim();
    if (!text) return;
    this.draft = '';

    if (this.chatService.currentConversationId) {
      this.chatService.sendMessage(this.currentUsername, text).subscribe((msg) => {
        this.chatService
          .getChain(this.chatService.currentHeadUuid!)
          .subscribe((msgs) => this.chatService.messages$.next(msgs));
      });
    } else {
      const partner = this.isAdmin
        ? this.selectedConversation?.participant2 || ''
        : this.adminEmail;
      if (!partner) return;

      this.chatService
        .startConversation(this.currentUsername, partner, this.currentUsername, text)
        .subscribe((result) => {
          this.selectedConversation = result.conversation;
          this.chatService.openChat(result.conversation);
          if (this.isAdmin) this.loadAdminConversations();
        });
    }
  }

  conversationLabel(conv: ChatConversation): string {
    const partner =
      conv.participant1 === this.currentUsername
        ? conv.participant2
        : conv.participant1;
    return conv.deviceProjectName ? `${partner} — ${conv.deviceProjectName}` : partner;
  }

  minimize(): void {
    this.minimized = !this.minimized;
  }

  close(): void {
    this.chatService.closeChat();
    this.chatService.isChatOpen$.next(false);
  }

  private scrollToBottom(): void {
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
    this.chatService.stopPolling();
  }
}
