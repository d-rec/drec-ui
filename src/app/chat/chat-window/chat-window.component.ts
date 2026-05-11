import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatSnackBar } from '@angular/material/snack-bar';
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
  /** Compose kind picker. 'note' adds a field-anchor select; the
   *  send() one-shot resets back to 'text' so a follow-up doesn't
   *  accidentally tag the same field. */
  draftKind: 'text' | 'note' = 'text';
  draftFieldName = '';

  /** Field-anchor options for compose. Same list the reviewer thread
   *  used; pinned 'General' on top, the rest sorted alpha-numerically
   *  so (2)Site comes before (10)Commissioning. */
  readonly NOTE_FIELD_OPTIONS: ReadonlyArray<{ key: string; label: string }> =
    (() => {
      const general = { key: '', label: 'General (not field-specific)' };
      const fields = [
        { key: 'siteName', label: '(2) Site name' },
        { key: 'address', label: '(16) Address' },
        { key: 'latitude', label: '(19) Latitude' },
        { key: 'longitude', label: '(20) Longitude' },
        { key: 'countryCodename', label: '(9) Country' },
        { key: 'capacity', label: '(13) AC capacity (kW)' },
        { key: 'commissioningDate', label: '(10) Commissioning date' },
        { key: 'deviceTypeCode', label: '(11) Device type' },
        { key: 'fuelCode', label: '(12) Fuel code' },
        { key: 'gridInterconnection', label: '(32) Grid interconnection' },
        { key: 'gridExportType', label: '(16) Exports to grid?' },
        { key: 'hasNetworkMeter', label: '(18) Network meter' },
        { key: 'networkOwner', label: '(17) Network owner' },
        { key: 'interconnectionVoltage', label: '(31) Interconnection voltage' },
        { key: 'generatingUnitCount', label: '(33) Generating unit count' },
        { key: 'dataSourceBrand', label: '(22) Data source brand' },
        { key: 'serialNumber', label: '(23) Serial number / meter ID' },
        { key: 'pvSystemOwner', label: '(15) PV system owner' },
        { key: 'pvSystemOwnerAddress', label: '(15a) Owner mailing address' },
        { key: 'offTakerName', label: '(28) Off-taker name' },
        { key: 'offTaker', label: '(29) Off-taker' },
        { key: 'impactStory', label: '(29) Impact story' },
        { key: 'hasAuxiliaryEnergySources', label: '(34) Auxiliary energy sources?' },
        { key: 'auxiliaryEnergySourceDetails', label: '(34a) Auxiliary energy source details' },
        { key: 'sourceAccessMode', label: 'Source-access mode' },
        { key: 'operatingConfiguration', label: '(30) Operating configuration' },
        { key: 'evidencePathway', label: 'Evidence pathway' },
        { key: 'deviceDescription', label: '(8) Device description' },
        { key: 'SDGBenefits', label: '(28) SDG benefits' },
      ];
      fields.sort((a, b) =>
        a.label.localeCompare(b.label, undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
      );
      return [general, ...fields];
    })();

  /** Translate field key to human label for the bubble's anchor tag. */
  fieldLabel(key: string | null): string {
    if (!key) return 'General';
    return (
      this.NOTE_FIELD_OPTIONS.find((o) => o.key === key)?.label ?? key
    );
  }

  /** Reviewer/admin clicks Resolve on a note bubble. */
  resolveNote(uuid: string): void {
    this.chatService.resolveNote(uuid).subscribe({
      next: () => {
        if (this.chatService.currentHeadUuid) {
          this.chatService
            .getChain(this.chatService.currentHeadUuid)
            .subscribe((msgs) => this.chatService.messages$.next(msgs));
        }
      },
      error: (e) => console.error('[chat] resolveNote failed', e),
    });
  }

  reopenNote(uuid: string): void {
    this.chatService.reopenNote(uuid).subscribe({
      next: () => {
        if (this.chatService.currentHeadUuid) {
          this.chatService
            .getChain(this.chatService.currentHeadUuid)
            .subscribe((msgs) => this.chatService.messages$.next(msgs));
        }
      },
      error: (e) => console.error('[chat] reopenNote failed', e),
    });
  }

  /** Is the current user a reviewer/admin (allowed to resolve notes)? */
  get canResolveNotes(): boolean {
    const role = (
      JSON.parse(sessionStorage.getItem('loginuser') ?? '{}') as any
    )?.role;
    return role === 'Reviewer' || role === 'Admin' || role === 'SeniorReviewer';
  }
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
    private snackBar: MatSnackBar,
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
    const kind = this.draftKind;
    const fieldName = kind === 'note' ? this.draftFieldName || null : null;
    this.draft = '';
    // Field anchor sticks for one shot, then resets so reviewers
    // don't accidentally tag a follow-up text to the same field.
    if (kind === 'note') {
      this.draftKind = 'text';
      this.draftFieldName = '';
    }
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
      kind,
      fieldName,
      status: kind === 'note' ? 'open' : null,
      resolvedBy: null,
      resolvedAt: null,
      payload: null,
    };
    this.chatService.messages$.next([...this.messages, optimistic]);

    if (this.chatService.currentConversationId) {
      // Append to existing conversation
      this.chatService
        .sendMessage(this.currentUsername, text, { kind, fieldName })
        .subscribe({
        next: () => {
          this.chatService
            .getChain(this.chatService.currentHeadUuid!)
            .subscribe((msgs) => this.chatService.messages$.next(msgs));
          // The server already cleared this user's unread slot when
          // appending — pull fresh badges so the indicator stops
          // pinging without waiting for the 10s unread-poll tick.
          this.chatService.refreshUnread();
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

  /** Match the verify-report short URL we share via chat. Accepts both
   *  the uuid form (preferred) and the integer-id form (legacy). */
  private readonly REPORT_URL_RE =
    /\bhttps?:\/\/[^\s]+\/r\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)\b/gi;
  /** Generic URL (run AFTER report-url substitution so we don't double-wrap). */
  private readonly URL_RE = /\bhttps?:\/\/[^\s<]+/g;

  /** Returns the first /r/<ref> URL in the message, or null. */
  reportLink(text: string): { url: string; id: string } | null {
    this.REPORT_URL_RE.lastIndex = 0;
    const m = this.REPORT_URL_RE.exec(text || '');
    return m ? { url: m[0], id: m[1] } : null;
  }

  /** Cache so each CD tick returns the same SafeHtml reference for a
   *  given (text, search-term) — without this, [innerHTML] gets re-set
   *  on every 4s poll, wiping the inner text nodes and any selection
   *  the user just made. Key includes the search term so highlight
   *  changes still propagate. */
  private highlightCache = new Map<string, SafeHtml>();

  highlightText(text: string): string | SafeHtml {
    const term = this.chatSearch.trim();
    const key = term + ' ' + text;
    const cached = this.highlightCache.get(key);
    if (cached) return cached;

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

    // Auto-linkify any URL so the registrant can click instead of copy/pasting.
    const linked = safe.replace(this.URL_RE, (u) => {
      return `<a href="${u}" target="_blank" rel="noopener" class="chat-link">${u}</a>`;
    });

    let html: string;
    if (!term) {
      html = linked;
    } else {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'gi'); // nosemgrep: detect-non-literal-regexp -- term is regex-escaped above
      html = linked.replace(re, (m) => `<mark class="chat-highlight">${m}</mark>`);
    }
    const out = this.sanitizer.bypassSecurityTrustHtml(html); // nosemgrep: angular-bypasssecuritytrust
    // Keep the cache bounded so a busy chat doesn't leak memory.
    if (this.highlightCache.size > 512) {
      this.highlightCache.clear();
    }
    this.highlightCache.set(key, out);
    return out;
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
    // msg.username can be either the full email or the localpart depending
    // on which sender path produced it; compare both forms.
    const my = (this.currentUsername || '').toLowerCase();
    const myLocal = my.split('@')[0];
    const theirs = (msg.username || '').toLowerCase();
    if (this.isInternalUser) {
      const partner = (this.partnerEmail || '').toLowerCase();
      const partnerLocal = partner.split('@')[0];
      return theirs !== partner && theirs !== partnerLocal;
    }
    return theirs === my || theirs === myLocal;
  }

  /** *ngFor trackBy — without this the 4-second poll replaces every
   *  bubble's DOM on each tick, which silently wipes any text the
   *  user just selected. Track by uuid so Angular reuses the bubble
   *  element when the server returns the same message. */
  trackByUuid = (_i: number, m: ChatMessage): string => m.uuid;

  get filteredMessages(): ChatMessage[] {
    const term = this.chatSearch.trim().toLowerCase();
    if (!term) return this.messages;
    return this.messages.filter(
      (m) =>
        m.chatEntry.toLowerCase().includes(term) ||
        m.username.toLowerCase().includes(term),
    );
  }

  /** Which corner the user grabbed for the current resize. Drives the
   *  delta math in onResizeMove — top/left deltas move the anchored
   *  edge, bottom/right deltas only change width/height. */
  private resizeCorner: 'tl' | 'tr' | 'bl' | 'br' = 'tl';
  private resizeStartLeft = 0;
  private resizeStartTop = 0;

  /** Becomes non-null on the first resize from any non-top-left corner
   *  (or any corner once the window has moved). We switch the chat
   *  window from its default right/bottom anchor to absolute left/top
   *  so all four edges can move independently. */
  resizedPos: { left: number; top: number } | null = null;

  onResizeStart(event: MouseEvent, corner: 'tl' | 'tr' | 'bl' | 'br'): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizing = true;
    this.resizeCorner = corner;
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.resizeStartW = this.width;
    this.resizeStartH = this.height;
    // Capture current viewport position so we can switch from
    // right/bottom anchoring to absolute left/top — needed because
    // non-top-left corners move the right or bottom edges, which
    // an anchored window can't do without re-pinning.
    const cw = (
      event.currentTarget as HTMLElement
    ).parentElement!.getBoundingClientRect();
    this.resizeStartLeft = cw.left;
    this.resizeStartTop = cw.top;
    if (!this.resizedPos) {
      this.resizedPos = { left: cw.left, top: cw.top };
    }
    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);
  }

  private onResizeMove = (event: MouseEvent): void => {
    if (!this.resizing || !this.resizedPos) return;
    const dx = event.clientX - this.resizeStartX;
    const dy = event.clientY - this.resizeStartY;
    const minW = 280;
    const minH = 200;
    let nextW = this.resizeStartW;
    let nextH = this.resizeStartH;
    let nextL = this.resizeStartLeft;
    let nextT = this.resizeStartTop;
    switch (this.resizeCorner) {
      case 'tl':
        nextW = Math.max(minW, this.resizeStartW - dx);
        nextH = Math.max(minH, this.resizeStartH - dy);
        nextL = this.resizeStartLeft + (this.resizeStartW - nextW);
        nextT = this.resizeStartTop + (this.resizeStartH - nextH);
        break;
      case 'tr':
        nextW = Math.max(minW, this.resizeStartW + dx);
        nextH = Math.max(minH, this.resizeStartH - dy);
        nextT = this.resizeStartTop + (this.resizeStartH - nextH);
        break;
      case 'bl':
        nextW = Math.max(minW, this.resizeStartW - dx);
        nextH = Math.max(minH, this.resizeStartH + dy);
        nextL = this.resizeStartLeft + (this.resizeStartW - nextW);
        break;
      case 'br':
        nextW = Math.max(minW, this.resizeStartW + dx);
        nextH = Math.max(minH, this.resizeStartH + dy);
        break;
    }
    // Clamp to viewport so the window doesn't escape on-screen.
    nextL = Math.max(0, nextL);
    nextT = Math.max(0, nextT);
    this.width = nextW;
    this.height = nextH;
    this.resizedPos = { left: nextL, top: nextT };
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

  /** Per-message right-click menu (Delete). Only fires for the user's own
   *  messages — others fall through to the native menu. */
  msgMenu: { x: number; y: number; uuid: string } | null = null;

  onMessageContextMenu(_event: MouseEvent, _msg: ChatMessage): void {
    // Right-click delete was removed 2026-05-11 — chat is eternal
    // audit material. The context menu currently has nothing else
    // to offer, so this is a no-op until we add e.g. "reply to
    // this message" or "copy permalink".
  }

  deleteMessageFromMenu(): void {
    // Endpoint and capability removed 2026-05-11 — chat is eternal
    // audit material. Kept as a no-op so the legacy menu binding
    // (and any external test that references this method) doesn't
    // break before we tear out the menu HTML.
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
