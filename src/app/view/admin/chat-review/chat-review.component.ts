import { Component, OnInit } from '@angular/core';
import {
  ChatMessage,
  ChatService,
  EnrichedConversation,
} from '../../../chat/chat.service';

@Component({
  standalone: false,
  selector: 'app-chat-review',
  templateUrl: './chat-review.component.html',
  styleUrls: ['./chat-review.component.scss'],
})
export class ChatReviewComponent implements OnInit {
  conversations: EnrichedConversation[] = [];
  filtered: EnrichedConversation[] = [];
  selected: EnrichedConversation | null = null;
  messages: ChatMessage[] = [];

  searchText = '';
  loading = false;
  loadingMessages = false;
  error: string | null = null;

  constructor(private readonly chatService: ChatService) {}

  ngOnInit(): void {
    this.loading = true;
    this.chatService.getAllConversationsEnriched().subscribe({
      next: (rows) => {
        this.conversations = rows;
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error =
          err?.error?.message ||
          'Could not load conversations. Refresh and try again.';
      },
    });
  }

  applyFilter(): void {
    const q = this.searchText.trim().toLowerCase();
    if (!q) {
      this.filtered = [...this.conversations];
      return;
    }
    this.filtered = this.conversations.filter(
      (c) =>
        c.participant1?.toLowerCase().includes(q) ||
        c.participant2?.toLowerCase().includes(q) ||
        c.deviceSiteName?.toLowerCase().includes(q) ||
        c.lastMessagePreview?.toLowerCase().includes(q),
    );
  }

  select(conv: EnrichedConversation): void {
    this.selected = conv;
    this.messages = [];
    if (!conv.headUuid) return;
    this.loadingMessages = true;
    this.chatService.getChain(conv.headUuid).subscribe({
      next: (msgs) => {
        this.messages = msgs;
        this.loadingMessages = false;
      },
      error: () => {
        this.loadingMessages = false;
      },
    });
  }
}
