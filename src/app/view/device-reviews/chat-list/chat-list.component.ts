import { Component, OnInit } from '@angular/core';
import { ChatService, ChatConversation } from '../../../chat/chat.service';

@Component({
  standalone: false,
  selector: 'app-ds-chat-list',
  templateUrl: './chat-list.component.html',
  styleUrls: ['./chat-list.component.scss'],
})
export class ChatListComponent implements OnInit {
  conversations: ChatConversation[] = [];
  currentEmail = '';
  loading = true;
  error = '';

  constructor(readonly chatService: ChatService) {}

  ngOnInit(): void {
    const loginUser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    this.currentEmail = loginUser.email || '';
    this.loadConversations();
  }

  loadConversations(): void {
    this.loading = true;
    this.error = '';
    this.chatService.getConversationsForUser(this.currentEmail).subscribe({
      next: (convs) => {
        this.conversations = convs;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load conversations', err);
        this.error = 'Failed to load conversations';
        this.loading = false;
      },
    });
  }

  otherParticipant(conv: ChatConversation): string {
    return conv.participant1 === this.currentEmail
      ? conv.participant2
      : conv.participant1;
  }

  openConversation(conv: ChatConversation): void {
    this.chatService.siteName$.next(conv.deviceProjectName);
    this.chatService.openChat(conv);
    this.chatService.isChatOpen$.next(true);
  }
}
