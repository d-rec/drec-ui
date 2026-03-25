import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ElementRef,
} from '@angular/core';
import { DomSanitizer, SafeHtml, SafeUrl } from '@angular/platform-browser';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { Asset, AssetStatus } from '../asset.model';
import { AssetService } from '../asset.service';
import { ChatService } from '../../../chat/chat.service';

@Component({
  standalone: false,
  selector: 'app-ds-documents-window',
  templateUrl: './documents-window.component.html',
  styleUrls: ['./documents-window.component.scss'],
})
export class DocumentsWindowComponent implements OnInit, OnDestroy {
  @Input() zIndex = 300;
  @Output() bringToFront = new EventEmitter<void>();

  initWidth = Math.round((window.innerWidth * 2) / 3);
  initHeight = Math.round((window.innerHeight * 2) / 3);

  readonly statusOptions: AssetStatus[] = [
    'draft',
    'pending',
    'approved',
    'rejected',
    'legacy',
  ];

  // filters
  readonly searchTerm$ = new BehaviorSubject('');
  get searchTerm(): string {
    return this.searchTerm$.value;
  }
  set searchTerm(v: string) {
    this.searchTerm$.next(v);
  }

  statusFilter: Record<AssetStatus, boolean> = {
    draft: true,
    pending: true,
    approved: true,
    rejected: true,
    legacy: true,
  };
  readonly statusFilter$ = new BehaviorSubject(this.statusFilter);

  searchMatchIds: string[] = [];
  searchIndex = -1;

  // sort state
  sortColumn: 'serial' | 'modifiedDate' | 'status' | 'projectName' =
    'projectName';
  sortDir: 1 | -1 = 1;
  readonly sort$ = new BehaviorSubject<{ col: string; dir: number }>({
    col: 'projectName',
    dir: 1,
  });

  sortBy(col: 'serial' | 'modifiedDate' | 'status' | 'projectName'): void {
    if (this.sortColumn === col) {
      this.sortDir = this.sortDir === 1 ? -1 : 1;
    } else {
      this.sortColumn = col;
      this.sortDir = 1;
    }
    this.sort$.next({ col: this.sortColumn, dir: this.sortDir });
  }

  private sortAssets(assets: Asset[]): Asset[] {
    return [...assets].sort((a, b) => {
      let av: any, bv: any;
      if (this.sortColumn === 'serial') {
        av = a.serial;
        bv = b.serial;
      } else if (this.sortColumn === 'modifiedDate') {
        av = a.modifiedDate?.getTime() ?? 0;
        bv = b.modifiedDate?.getTime() ?? 0;
      } else if (this.sortColumn === 'projectName') {
        av = a.projectName.toLowerCase();
        bv = b.projectName.toLowerCase();
      } else {
        av = a.status;
        bv = b.status;
      }
      if (av < bv) return -this.sortDir;
      if (av > bv) return this.sortDir;
      return 0;
    });
  }

  // expand/collapse state per asset
  expanded: Record<string, boolean> = {};
  sectionOpen: Record<
    string,
    Record<
      'codProof' | 'sld' | 'sf02' | 'sf02c' | 'meteringEvidence' | 'pictures',
      boolean
    >
  > = {};

  // document reviewed state: keyed by "deviceId:docKey" (e.g. "42:sld", "42:pic:0")
  reviewed: Record<string, boolean> = {};
  // maps "deviceId:docKey" → document DB id for API calls
  private docIdMap: Record<string, number> = {};

  // detail form
  detailForm!: FormGroup;
  editingId: string | null = null;
  showApproveModal = false;

  // resizable detail panel
  detailHeight = 280;
  private resizing = false;
  private resizeStartY = 0;
  private resizeStartH = 0;

  private sub!: Subscription;

  readonly filtered$ = combineLatest([
    this.svc.assets$,
    this.svc.selectedId$,
    this.searchTerm$,
    this.statusFilter$,
    this.sort$,
  ]).pipe(
    map(([assets, selId, searchTerm, statusFilter]) => ({
      assets: this.sortAssets(
        this.applyFilter(assets, searchTerm, statusFilter),
      ),
      selId,
      searchTerm,
    })),
  );

  constructor(
    readonly svc: AssetService,
    readonly chatService: ChatService,
    private fb: FormBuilder,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private elRef: ElementRef,
  ) {}

  trustUrl(url: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  hl(value: string, term: string): string | SafeHtml {
    const safe = value.replace(
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
    if (!term.trim()) return safe;
    const t = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.sanitizer.bypassSecurityTrustHtml(
      safe.replace(
        new RegExp(t, 'gi'),
        (m) => `<mark class="search-highlight">${m}</mark>`,
      ),
    );
  }

  ngOnInit(): void {
    this.detailForm = this.fb.group({
      lat: [''],
      long: [''],
      serial: [''],
      capacity: [''],
      acCapacity: [''],
      countryCode: [''],
      reviewer: [''],
      dateAdded: [''],
      dateSubmitted: [''],
      status: ['pending' as AssetStatus],
      notes: [''],
      submitterEmail: ['', Validators.email],
      evidentDeviceId: [''],
      evidentStatus: [''],
    });

    // Load reviewed state from docMeta only when fresh data arrives from the server.
    // Local toggles via saveAsset() won't trigger this.
    this.sub = this.svc.dataLoaded$.subscribe((assets) => {
      this.reviewed = {};
      this.docIdMap = {};
      for (const asset of assets) {
        if (asset.docMeta) {
          for (const [docKey, meta] of Object.entries(asset.docMeta)) {
            const fullKey = asset.id + ':' + docKey;
            this.reviewed[fullKey] = meta.reviewed;
            this.docIdMap[fullKey] = meta.docId;
          }
        }
      }
    });

    this.sub.add(
      this.svc.selectedId$.subscribe((id) => {
        if (id) {
          const asset = this.svc.assets$.value.find((a) => a.id === id);
          if (asset) this.patchForm(asset);
        }
        this.editingId = id;
      }),
    );

    this.sub.add(
      this.svc.expandId$.subscribe((id) => {
        if (!id) return;
        this.expanded = { ...this.expanded, [id]: true };
        if (!this.sectionOpen[id]) {
          this.sectionOpen[id] = {
            codProof: true,
            sld: true,
            sf02: true,
            sf02c: true,
            meteringEvidence: true,
            pictures: true,
          };
        }
        this.cdr.detectChanges();
        setTimeout(() => {
          const row = this.elRef.nativeElement.querySelector(
            `[data-device-id="${id}"]`,
          );
          if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  }

  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    this.resizing = true;
    this.resizeStartY = event.clientY;
    this.resizeStartH = this.detailHeight;
    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);
  }

  private onResizeMove = (event: MouseEvent): void => {
    if (!this.resizing) return;
    const delta = this.resizeStartY - event.clientY;
    this.detailHeight = Math.max(120, Math.min(600, this.resizeStartH + delta));
  };

  private onResizeEnd = (): void => {
    this.resizing = false;
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  };

  // ── Filtering ────────────────────────────────────────────────────────────────

  applyFilter(
    assets: Asset[],
    searchTerm: string,
    statusFilter: Record<AssetStatus, boolean>,
  ): Asset[] {
    return assets.filter((a) => {
      if (!statusFilter[a.status]) return false;
      const term = searchTerm.trim().toLowerCase();
      if (term) {
        const docNames = [
          a.codProofUrl,
          a.sldUrl,
          a.sf02Url,
          a.sf02cUrl,
          a.meteringEvidenceUrl,
          ...a.pictureUrls,
        ]
          .filter((u): u is string => !!u)
          .map((u) => this.fileName(u));
        const haystack = [
          a.serial,
          a.projectName,
          a.reviewer,
          a.submitterEmail,
          a.notes,
          a.status,
          ...docNames,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }

  onSearch(): void {
    const assets = this.applyFilter(
      this.svc.assets$.value,
      this.searchTerm,
      this.statusFilter,
    );
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.searchMatchIds = [];
      this.searchIndex = -1;
    } else {
      this.searchMatchIds = assets.map((a) => a.id);
      this.searchIndex = this.searchMatchIds.length > 0 ? 0 : -1;
      if (this.searchIndex >= 0) this.svc.select(this.searchMatchIds[0]);
    }
  }

  searchNext(): void {
    if (!this.searchMatchIds.length) return;
    this.searchIndex = (this.searchIndex + 1) % this.searchMatchIds.length;
    this.svc.select(this.searchMatchIds[this.searchIndex]);
  }

  searchPrev(): void {
    if (!this.searchMatchIds.length) return;
    this.searchIndex =
      (this.searchIndex - 1 + this.searchMatchIds.length) %
      this.searchMatchIds.length;
    this.svc.select(this.searchMatchIds[this.searchIndex]);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.searchMatchIds = [];
    this.searchIndex = -1;
  }

  onFilterChange(): void {
    this.statusFilter$.next({ ...this.statusFilter });
    this.onSearch();
  }

  // ── Hierarchy ────────────────────────────────────────────────────────────────

  toggleDevice(id: string): void {
    this.expanded = { ...this.expanded, [id]: !this.expanded[id] };
    if (!this.sectionOpen[id]) {
      this.sectionOpen[id] = {
        codProof: true,
        sld: true,
        sf02: true,
        sf02c: true,
        meteringEvidence: true,
        pictures: true,
      };
    }
    this.svc.select(id);
  }

  toggleSection(
    id: string,
    section:
      | 'codProof'
      | 'sld'
      | 'sf02'
      | 'sf02c'
      | 'meteringEvidence'
      | 'pictures',
  ): void {
    if (!this.sectionOpen[id]) {
      this.sectionOpen[id] = {
        codProof: true,
        sld: true,
        sf02: true,
        sf02c: true,
        meteringEvidence: true,
        pictures: true,
      };
    }
    this.sectionOpen = {
      ...this.sectionOpen,
      [id]: {
        ...this.sectionOpen[id],
        [section]: !this.sectionOpen[id][section],
      },
    };
  }

  isSectionOpen(
    id: string,
    section:
      | 'codProof'
      | 'sld'
      | 'sf02'
      | 'sf02c'
      | 'meteringEvidence'
      | 'pictures',
  ): boolean {
    return this.sectionOpen[id]?.[section] ?? true;
  }

  // ── File handling ─────────────────────────────────────────────────────────────

  async openFile(url: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const freshUrl = await this.svc.refreshUrl(url);
    if (/\.(jpe?g|png|gif|webp|bmp|svg)/i.test(url)) {
      this.svc.viewPicture(freshUrl);
    } else {
      window.open(freshUrl, '_blank', 'noopener');
    }
  }

  async openPicture(url: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const freshUrl = await this.svc.refreshUrl(url);
    this.svc.viewPicture(freshUrl);
  }

  onCodProofChange(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.svc.saveAsset({ ...asset, codProofUrl: URL.createObjectURL(file) });
  }

  clearCodProof(asset: Asset): void {
    this.svc.saveAsset({ ...asset, codProofUrl: null });
  }

  onSldChange(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.svc.saveAsset({ ...asset, sldUrl: URL.createObjectURL(file) });
  }

  clearSld(asset: Asset): void {
    this.svc.saveAsset({ ...asset, sldUrl: null });
  }

  onSf02Change(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.svc.saveAsset({ ...asset, sf02Url: URL.createObjectURL(file) });
  }

  clearSf02(asset: Asset): void {
    this.svc.saveAsset({ ...asset, sf02Url: null });
  }

  onSf02cChange(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.svc.saveAsset({ ...asset, sf02cUrl: URL.createObjectURL(file) });
  }

  clearSf02c(asset: Asset): void {
    this.svc.saveAsset({ ...asset, sf02cUrl: null });
  }

  onMeteringEvidenceChange(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.svc.saveAsset({
      ...asset,
      meteringEvidenceUrl: URL.createObjectURL(file),
    });
  }

  clearMeteringEvidence(asset: Asset): void {
    this.svc.saveAsset({ ...asset, meteringEvidenceUrl: null });
  }

  onPictureAdd(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.svc.saveAsset({
      ...asset,
      pictureUrls: [...asset.pictureUrls, URL.createObjectURL(file)],
    });
  }

  clearPicture(asset: Asset, idx: number): void {
    const pictureUrls = asset.pictureUrls.filter((_, i) => i !== idx);
    this.svc.saveAsset({ ...asset, pictureUrls });
  }

  fileName(url: string): string {
    try {
      const withoutQuery = url.split('?')[0];
      let name = withoutQuery.split('/').pop() ?? withoutQuery;
      // Decode repeatedly to handle double-encoded S3 keys (e.g. %2520 → %20 → space)
      let prev = '';
      while (name !== prev) {
        prev = name;
        try {
          name = decodeURIComponent(name);
        } catch {
          break;
        }
      }
      return name.replace(
        /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '',
      );
    } catch {
      return url;
    }
  }

  // ── Detail form ───────────────────────────────────────────────────────────────

  selectAsset(asset: Asset): void {
    this.svc.select(asset.id);
  }

  saveDetail(): void {
    if (!this.editingId) return;
    const asset = this.svc.assets$.value.find((a) => a.id === this.editingId);
    if (!asset) return;
    const v = this.detailForm.getRawValue();
    const oldStatus = asset.status;
    const newStatus = v.status as AssetStatus;
    this.svc.saveAsset({
      ...asset,
      lat: v.lat !== '' ? parseFloat(v.lat) : null,
      long: v.long !== '' ? parseFloat(v.long) : null,
      projectName: asset.projectName,
      capacity: v.capacity !== '' ? parseFloat(v.capacity) : null,
      acCapacity: v.acCapacity !== '' ? parseFloat(v.acCapacity) : null,
      countryCode: v.countryCode,
      reviewer: v.reviewer,
      dateAdded: v.dateAdded ? new Date(v.dateAdded) : null,
      dateSubmitted: v.dateSubmitted ? new Date(v.dateSubmitted) : null,
      status: newStatus,
      notes: v.notes,
      submitterEmail: v.submitterEmail,
    });
    if (oldStatus !== newStatus) {
      this.logStatusChange(asset.projectName, oldStatus, newStatus);
    }
  }

  cancelDetail(): void {
    this.svc.select(null);
  }

  setStatus(status: AssetStatus): void {
    if (!this.editingId) return;
    const asset = this.svc.assets$.value.find((a) => a.id === this.editingId);
    if (!asset) return;
    const oldStatus = asset.status;
    if (oldStatus === status) return;
    this.svc.saveAsset({ ...asset, status });
    this.detailForm.patchValue({ status });
    this.logStatusChange(asset.projectName, oldStatus, status);
  }

  private logStatusChange(
    siteName: string,
    from: AssetStatus,
    to: AssetStatus,
  ): void {
    const loginUser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    const username = loginUser.email || loginUser.username || 'system';
    const entry = `_status changed from ${from} to ${to}_`;

    // If the chat already has a conversation open for this site, post directly
    if (this.chatService.currentConversationId) {
      this.chatService.sendMessage(username, entry).subscribe({
        next: () => {
          if (this.chatService.currentHeadUuid) {
            this.chatService
              .getChain(this.chatService.currentHeadUuid)
              .subscribe((msgs) => this.chatService.messages$.next(msgs));
          }
        },
        error: (err) =>
          console.warn('Could not log status change to chat', err),
      });
      return;
    }

    // Otherwise look up/create a conversation for the site
    const asset = this.svc.assets$.value.find(
      (a) => a.projectName === siteName,
    );
    const submitterEmail = asset?.submitterEmail || '';

    this.chatService.getConversation(undefined, undefined, siteName).subscribe({
      next: (conv) => {
        if (conv) {
          this.chatService.openChat(conv);
          this.chatService.sendMessage(username, entry).subscribe({
            error: (err) =>
              console.warn('Could not log status change to chat', err),
          });
        } else {
          this.chatService
            .startConversation(
              username,
              submitterEmail || username,
              username,
              entry,
              siteName,
            )
            .subscribe({
              next: (result) => {
                this.chatService.openChat(result.conversation);
              },
              error: (err) =>
                console.warn(
                  'Could not start conversation for status log',
                  err,
                ),
            });
        }
      },
      error: () => {},
    });
  }

  requestApprove(): void {
    this.showApproveModal = true;
  }

  confirmApprove(): void {
    this.showApproveModal = false;
    this.setStatus('approved');
  }

  cancelApprove(): void {
    this.showApproveModal = false;
  }

  trackById(_index: number, item: Asset): string {
    return item.id;
  }

  toggleReviewed(key: string, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    const newVal = !this.reviewed[key];
    this.reviewed = { ...this.reviewed, [key]: newVal };
    this.cdr.detectChanges();

    // All side effects deferred so the checkbox updates immediately
    setTimeout(() => this.onReviewedChanged(key, newVal));
  }

  private onReviewedChanged(key: string, newVal: boolean): void {
    try {
      const deviceId = key.split(':')[0];
      const asset = this.svc.assets$.value.find((a) => a.id === deviceId);

      // Switch device to draft when a checkbox is checked
      if (newVal && asset && asset.status !== 'draft') {
        const oldStatus = asset.status;
        this.svc.saveAsset({ ...asset, status: 'draft' });
        if (this.editingId === deviceId) {
          this.detailForm.patchValue({ status: 'draft' });
        }
        this.logStatusChange(asset.projectName, oldStatus, 'draft');
      }

      // Persist to backend
      const docId = this.docIdMap[key];
      if (docId) {
        this.svc.toggleDocReviewed(docId).subscribe({
          error: (err) => console.warn('toggleDocReviewed failed', err),
        });
      }

      // Log review action to chat
      if (asset) {
        const docLabel = this.docKeyLabel(key);
        const action = newVal ? 'reviewed' : 'undone';
        this.logChatEntry(
          asset.projectName,
          `_document ${docLabel} was ${action}_`,
        );
      }
    } catch (e) {
      console.error('onReviewedChanged error:', e);
    }
  }

  private docKeyLabel(key: string): string {
    const labels: Record<string, string> = {
      sld: 'SLD',
      sf02: 'SF-02',
      sf02c: 'SF-02C',
      codProof: 'COD Proof',
      meteringEvidence: 'Metering Evidence',
    };
    const parts = key.split(':');
    if (parts[1] === 'pic') return `Picture #${parseInt(parts[2], 10) + 1}`;
    return labels[parts[1]] || parts[1];
  }

  private logChatEntry(siteName: string, entry: string): void {
    const loginUser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    const username = loginUser.email || loginUser.username || 'system';

    if (this.chatService.currentConversationId) {
      this.chatService.sendMessage(username, entry).subscribe({
        next: () => {
          if (this.chatService.currentHeadUuid) {
            this.chatService
              .getChain(this.chatService.currentHeadUuid)
              .subscribe((msgs) => this.chatService.messages$.next(msgs));
          }
        },
        error: (err) => console.warn('Could not log to chat', err),
      });
      return;
    }

    // Look up the device to get submitter email for conversation creation
    const asset = this.svc.assets$.value.find(
      (a) => a.projectName === siteName,
    );
    const submitterEmail = asset?.submitterEmail || '';

    this.chatService.getConversation(undefined, undefined, siteName).subscribe({
      next: (conv) => {
        if (conv) {
          this.chatService.openChat(conv);
          this.chatService.sendMessage(username, entry).subscribe({
            error: (err) => console.warn('Could not log to chat', err),
          });
        } else {
          // No conversation yet — create one with this log entry as the first message
          this.chatService
            .startConversation(
              username,
              submitterEmail || username,
              username,
              entry,
              siteName,
            )
            .subscribe({
              next: (result) => {
                this.chatService.openChat(result.conversation);
              },
              error: (err) =>
                console.warn('Could not start conversation for log', err),
            });
        }
      },
      error: () => {},
    });
  }

  openChat(): void {
    if (!this.editingId) return;
    const asset = this.svc.assets$.value.find((a) => a.id === this.editingId);
    if (!asset) return;
    const submitterEmail = asset.submitterEmail || '';
    const siteName = asset.projectName || '';
    this.chatService.openForDevice$.next({ submitterEmail, siteName });
    if (!this.chatService.isChatOpen$.value) {
      this.chatService.isChatOpen$.next(true);
    }
  }

  archiveDevice(): void {
    if (!this.editingId) return;
    const asset = this.svc.assets$.value.find((a) => a.id === this.editingId);
    if (!asset || asset.status === 'pending') return;
    // TODO: call archive endpoint
  }

  populateDevices(): void {
    this.svc.populateFromDb();
  }

  flyToDevice(): void {
    if (!this.editingId) return;
    const asset = this.svc.assets$.value.find((a) => a.id === this.editingId);
    if (!asset || asset.lat === null || asset.long === null) return;
    this.svc.flyTo(asset.lat, asset.long);
  }

  private patchForm(a: Asset): void {
    this.detailForm.patchValue({
      lat: a.lat ?? '',
      long: a.long ?? '',
      serial: a.serial,
      capacity: a.capacity ?? '',
      acCapacity: a.acCapacity ?? '',
      countryCode: a.countryCode,
      reviewer: a.reviewer,
      dateAdded: this.toDateInput(a.dateAdded),
      dateSubmitted: this.toDateInput(a.dateSubmitted),
      status: a.status,
      notes: a.notes,
      submitterEmail: a.submitterEmail,
      evidentDeviceId: a.evidentDeviceId ?? '',
      evidentStatus: a.evidentStatus ?? '',
    });
    this.chatService.siteName$.next(a.projectName || null);
  }

  private toDateInput(d: Date | null): string {
    if (!d) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
