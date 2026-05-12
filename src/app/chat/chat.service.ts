import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  ReplaySubject,
  Subject,
  interval,
  Observable,
  Subscription,
} from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type ChatKind = 'text' | 'note' | 'system' | 'doc-ref';
export type ChatNoteStatus = 'open' | 'resolved';

export interface ChatMessage {
  uuid: string;
  username: string;
  chatEntry: string;
  nextEntryUuid: string | null;
  createdAt: string;
  kind: ChatKind;
  fieldName: string | null;
  status: ChatNoteStatus | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  payload: Record<string, any> | null;
}

export interface ChatConversation {
  id: number;
  participant1: string;
  participant2: string;
  headUuid: string;
  lastEntryUuid: string | null;
  deviceSiteName: string | null;
}

export interface EnrichedConversation extends ChatConversation {
  lastMessageAt: string | null;
  lastMessageBy: string | null;
  lastMessagePreview: string | null;
}

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  private readonly apiUrl = environment.API_URL;
  private pollingSubscription: Subscription | null = null;

  messages$ = new BehaviorSubject<ChatMessage[]>([]);
  isChatOpen$ = new BehaviorSubject<boolean>(false);
  siteName$ = new BehaviorSubject<string | null>(null);
  openForDevice$ = new ReplaySubject<{
    submitterEmail: string;
    siteName: string;
  }>(1);
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

  /** Public entrypoint to force-refresh unread badges immediately —
   *  call this after any action that should clear the user's "you
   *  have unread" indicator (sending a message, marking read,
   *  resolving a note) instead of waiting for the 10s poll. */
  refreshUnread(): void {
    const email = this.getCurrentUserEmail();
    if (email) this.fetchUnreadCount(email);
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

  private getUnreadCount(email: string): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(
      `${this.apiUrl}chat/unread-count/${encodeURIComponent(email)}`,
    );
  }

  getUnreadDeviceNames(email: string): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.apiUrl}chat/unread-devices/${encodeURIComponent(email)}`,
    );
  }

  markConversationRead(conversationId: number): void {
    const email = this.getCurrentUserEmail();
    if (!email) return;
    this.http
      .patch<any>(`${this.apiUrl}chat/conversations/${conversationId}/read`, {
        email,
      })
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

  /** Pending "mark-as-read" timer. When the chat is open and a new
   *  message arrives via polling, we wait 10 seconds before pinging
   *  the server to mark the conversation read — long enough for the
   *  user to actually see it, short enough that the unread badge
   *  stops blinking once they've clearly noticed. */
  private autoReadTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSeenTailUuid: string | null = null;

  private startPolling(_headUuid: string): void {
    this.stopPolling();
    // Read currentHeadUuid live each tick — if a delete advances the
    // conversation head, the closured value would be stale and fetch
    // an empty chain, blanking the UI.
    this.pollingSubscription = interval(4000)
      .pipe(
        switchMap(() => {
          const head = this.currentHeadUuid;
          if (!head) return [];
          return this.getChain(head);
        }),
      )
      .subscribe((messages) => {
        this.messages$.next(messages as any);
        this.scheduleAutoMarkRead(messages as any);
      });
  }

  /** Re-arm the 10s mark-read timer whenever a new message tail
   *  arrives. Three conditions to actually fire:
   *   - chat window is open
   *   - browser tab is visible (visibilityState === 'visible')
   *   - document has OS focus (user is actually looking at us, not
   *     in another window with our tab visible behind it)
   *  If any of those is false at fire time, we DON'T mark read — the
   *  user hasn't seen the new message, so the unread badge has to
   *  keep pinging. */
  private scheduleAutoMarkRead(messages: ChatMessage[]): void {
    const last = messages.length ? messages[messages.length - 1] : null;
    const tail = last?.uuid ?? null;
    if (!tail || tail === this.lastSeenTailUuid) return;
    this.lastSeenTailUuid = tail;
    const me = this.getCurrentUserEmail();
    if (last && me && last.username === me) return;
    if (this.autoReadTimer) clearTimeout(this.autoReadTimer);
    const convId = this.currentConversationId;
    if (convId == null) return;
    this.autoReadTimer = setTimeout(() => {
      this.autoReadTimer = null;
      const focused =
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible' &&
        document.hasFocus();
      if (
        focused &&
        this.isChatOpen$.value &&
        this.currentConversationId === convId
      ) {
        this.markConversationRead(convId);
      }
    }, 10_000);
  }

  stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
    if (this.autoReadTimer) {
      clearTimeout(this.autoReadTimer);
      this.autoReadTimer = null;
    }
    this.lastSeenTailUuid = null;
  }

  private loadChain(headUuid: string): void {
    this.getChain(headUuid).subscribe((messages) => {
      this.messages$.next(messages);
    });
  }

  /**
   * Force an immediate refetch of whichever conversation is currently
   * open. Used after side-channel writes (Share Verification Report)
   * to skip the 4s polling delay before the new message shows up.
   */
  refreshOpenChain(): void {
    if (this.currentHeadUuid) {
      this.loadChain(this.currentHeadUuid);
    }
  }

  getChain(headUuid: string): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.apiUrl}chat/chain/${headUuid}`);
  }

  sendMessage(
    username: string,
    chatEntry: string,
    opts: {
      kind?: ChatKind;
      fieldName?: string | null;
      payload?: Record<string, any> | null;
    } = {},
  ): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(
      `${this.apiUrl}chat/conversations/${this.currentConversationId}/messages`,
      { username, chatEntry, ...opts },
    );
  }

  /** Post a message into an existing conversation by id — for
   *  side-channel notifications (e.g. "registrant updated this
   *  device, please re-check open notes") that should drop into
   *  the device's chat without opening the chat window. */
  postToConversation(
    conversationId: number,
    username: string,
    chatEntry: string,
    opts: {
      kind?: ChatKind;
      fieldName?: string | null;
      payload?: Record<string, any> | null;
    } = {},
  ): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(
      `${this.apiUrl}chat/conversations/${conversationId}/messages`,
      { username, chatEntry, ...opts },
    );
  }

  /** Flip a note to status='resolved' (reviewer/admin only). Server
   *  also appends a kind='system' audit marker — we just refetch the
   *  chain to pick it up. */
  resolveNote(uuid: string): Observable<ChatMessage> {
    return this.http.patch<ChatMessage>(
      `${this.apiUrl}chat/messages/${uuid}/resolve`,
      {},
    );
  }

  reopenNote(uuid: string): Observable<ChatMessage> {
    return this.http.patch<ChatMessage>(
      `${this.apiUrl}chat/messages/${uuid}/reopen`,
      {},
    );
  }

  // Note: deleteMessage() was removed 2026-05-11. Chat is eternal
  // audit material; resolve/reopen are the only mutations allowed
  // and both append system markers rather than destroying.

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

  /** Send a one-shot message to `toEmail` without requiring the chat
   *  panel to be open. Finds the existing conversation (or starts one) and
   *  posts the message. Useful for "share verification report" flows. */
  sendDirectMessage(
    toEmail: string,
    chatEntry: string,
    opts?: { deviceSiteName?: string },
  ): Observable<ChatMessage | { conversation: ChatConversation; message: ChatMessage }> {
    const fromEmail = this.getCurrentUserEmail();
    if (!fromEmail) {
      return new Observable((sub) =>
        sub.error(new Error('No logged-in user email')),
      );
    }
    const username = fromEmail.split('@')[0];
    return new Observable<any>((subscriber) => {
      this.getConversation(fromEmail, toEmail, opts?.deviceSiteName).subscribe({
        next: (conv) => {
          if (conv) {
            this.http
              .post<ChatMessage>(
                `${this.apiUrl}chat/conversations/${conv.id}/messages`,
                { username, chatEntry },
              )
              .subscribe({
                next: (msg) => {
                  subscriber.next(msg);
                  subscriber.complete();
                },
                error: (e) => subscriber.error(e),
              });
          } else {
            this.startConversation(
              fromEmail,
              toEmail,
              username,
              chatEntry,
              opts?.deviceSiteName,
            ).subscribe({
              next: (res) => {
                subscriber.next(res);
                subscriber.complete();
              },
              error: (e) => subscriber.error(e),
            });
          }
        },
        error: (e) => subscriber.error(e),
      });
    });
  }

  getAllConversations(): Observable<ChatConversation[]> {
    return this.http.get<ChatConversation[]>(
      `${this.apiUrl}chat/conversations`,
    );
  }

  getAllConversationsEnriched(): Observable<EnrichedConversation[]> {
    return this.http.get<EnrichedConversation[]>(
      `${this.apiUrl}chat/conversations/admin/all`,
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
