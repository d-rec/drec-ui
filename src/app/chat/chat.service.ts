import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Subject,
  interval,
  Observable,
  Subscription,
} from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  uuid: string;
  username: string;
  chatEntry: string;
  nextEntryUuid: string | null;
  createdAt: string;
}

export interface ChatConversation {
  id: number;
  participant1: string;
  participant2: string;
  headUuid: string;
  lastEntryUuid: string | null;
  deviceSiteName: string | null;
}

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private readonly apiUrl = environment.API_URL;
  private pollingSubscription: Subscription | null = null;

  messages$ = new BehaviorSubject<ChatMessage[]>([]);
  isChatOpen$ = new BehaviorSubject<boolean>(false);
  siteName$ = new BehaviorSubject<string | null>(null);
  openForDevice$ = new Subject<{
    submitterEmail: string;
    siteName: string;
  }>();
  currentHeadUuid: string | null = null;
  currentConversationId: number | null = null;
  readOnly$ = new BehaviorSubject<boolean>(false);
  unreadCount$ = new BehaviorSubject<number>(0);
  unreadDevices$ = new BehaviorSubject<Set<string>>(new Set());

  private unreadPolling: Subscription | null = null;

  constructor(private http: HttpClient) {}

  startUnreadPolling(): void {
    this.stopUnreadPolling();
    const email = this.getCurrentUserEmail();
    if (!email) return;
    this.fetchUnreadCount(email);
    this.unreadPolling = interval(10000).subscribe(() =>
      this.fetchUnreadCount(email),
    );
  }

  stopUnreadPolling(): void {
    if (this.unreadPolling) {
      this.unreadPolling.unsubscribe();
      this.unreadPolling = null;
    }
  }

  private fetchUnreadCount(email: string): void {
    this.getUnreadCount(email).subscribe({
      next: (res) => this.unreadCount$.next(res.count),
      error: () => {},
    });
    this.getUnreadDeviceNames(email).subscribe({
      next: (names) => this.unreadDevices$.next(new Set(names)),
      error: () => {},
    });
  }

  private getUnreadCount(
    email: string,
  ): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(
      `${this.apiUrl}chat/unread-count/${encodeURIComponent(email)}`,
    );
  }

  getUnreadDeviceNames(
    email: string,
  ): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.apiUrl}chat/unread-devices/${encodeURIComponent(email)}`,
    );
  }

  markConversationRead(conversationId: number): void {
    const email = this.getCurrentUserEmail();
    if (!email) return;
    this.http
      .patch<any>(
        `${this.apiUrl}chat/conversations/${conversationId}/read`,
        { email },
      )
      .subscribe(() => this.fetchUnreadCount(email));
  }

  getCurrentUserEmail(): string | null {
    try {
      const user = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
      return user.email || null;
    } catch {
      return null;
    }
  }

  toggleChat(): void {
    this.isChatOpen$.next(!this.isChatOpen$.value);
  }

  openChat(conversation: ChatConversation): void {
    this.currentHeadUuid = conversation.headUuid;
    this.currentConversationId = conversation.id;
    this.loadChain(conversation.headUuid);
    this.startPolling(conversation.headUuid);
    this.markConversationRead(conversation.id);
  }

  closeChat(): void {
    this.stopPolling();
    this.messages$.next([]);
    this.currentHeadUuid = null;
    this.currentConversationId = null;
  }

  private startPolling(headUuid: string): void {
    this.stopPolling();
    this.pollingSubscription = interval(4000)
      .pipe(switchMap(() => this.getChain(headUuid)))
      .subscribe((messages) => {
        this.messages$.next(messages);
      });
  }

  stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  private loadChain(headUuid: string): void {
    this.getChain(headUuid).subscribe((messages) => {
      this.messages$.next(messages);
    });
  }

  getChain(headUuid: string): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.apiUrl}chat/chain/${headUuid}`);
  }

  sendMessage(username: string, chatEntry: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(
      `${this.apiUrl}chat/conversations/${this.currentConversationId}/messages`,
      { username, chatEntry },
    );
  }

  getAdminUser(): Observable<{
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  }> {
    return this.http.get<any>(`${this.apiUrl}chat/admin`);
  }

  getConversation(
    participant1?: string,
    participant2?: string,
    deviceSiteName?: string,
  ): Observable<ChatConversation | null> {
    const body: any = {};
    if (participant1) body.participant1 = participant1;
    if (participant2) body.participant2 = participant2;
    if (deviceSiteName) body.deviceSiteName = deviceSiteName;
    return this.http.post<ChatConversation | null>(
      `${this.apiUrl}chat/conversations/find`,
      body,
    );
  }

  startConversation(
    participant1: string,
    participant2: string,
    username: string,
    chatEntry: string,
    deviceSiteName?: string,
  ): Observable<{ conversation: ChatConversation; message: ChatMessage }> {
    return this.http.post<any>(`${this.apiUrl}chat/conversations/start`, {
      participant1,
      participant2,
      username,
      chatEntry,
      deviceSiteName: deviceSiteName ?? null,
    });
  }

  getAllConversations(): Observable<ChatConversation[]> {
    return this.http.get<ChatConversation[]>(
      `${this.apiUrl}chat/conversations`,
    );
  }

  getConversationsForUser(email: string): Observable<ChatConversation[]> {
    return this.http.get<ChatConversation[]>(
      `${this.apiUrl}chat/conversations/user/${encodeURIComponent(email)}`,
    );
  }

  clearConversation(conversationId: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}chat/conversations/${conversationId}`,
    );
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }
}
