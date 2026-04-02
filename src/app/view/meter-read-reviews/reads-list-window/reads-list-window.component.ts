import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, combineLatest, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  MeterReadReviewDevice,
  MeterReadEntry,
  ReadReviewStatus,
} from '../meter-read-review.model';
import { MeterReadReviewService } from '../meter-read-review.service';
import { ChatService } from '../../../chat/chat.service';

interface FilteredRow {
  device: MeterReadReviewDevice;
  searchTerm: string;
}

@Component({
  standalone: false,
  selector: 'app-mrr-reads-list',
  templateUrl: './reads-list-window.component.html',
  styleUrls: ['./reads-list-window.component.scss'],
})
export class ReadsListWindowComponent implements OnInit, OnDestroy {
  readonly statusOptions: ReadReviewStatus[] = [
    'pending',
    'approved',
    'flagged',
    'rejected',
  ];

  readonly searchTerm$ = new BehaviorSubject('');
  get searchTerm(): string {
    return this.searchTerm$.value;
  }
  set searchTerm(v: string) {
    this.searchTerm$.next(v);
  }

  statusFilters: Record<string, boolean> = {
    pending: true,
    approved: false,
    flagged: true,
    rejected: false,
  };

  sortField: 'projectName' | 'readCount' | 'latestReadDate' | 'totalKwh' | 'reviewStatus' = 'latestReadDate';
  sortDir: 'asc' | 'desc' = 'desc';

  filteredDevices: FilteredRow[] = [];
  expandedIds = new Set<number>();
  editingId: number | null = null;
  detailForm!: FormGroup;
  detailHeight = 220;
  resizing = false;

  get editingDevice(): MeterReadReviewDevice | null {
    if (this.editingId === null) return null;
    return this.svc.devices$.value.find((d) => d.deviceId === this.editingId) ?? null;
  }

  // Verification state
  showConsistencyModal = false;
  consistencyResult: any = null;
  consistencyError = '';

  showCeilingModal = false;
  ceilingResult: any = null;
  ceilingError = '';

  showCrossSourceModal = false;
  crossSourceResult: any = null;
  crossSourceError = '';

  showAuditModal = false;
  auditTrail: any[] = [];
  auditCopyLabel = 'Copy';
  auditSearch = '';

  showGapModal = false;
  gapResult: any = null;
  gapError = '';

  flaggedReads: Record<number, boolean> = {};

  private subs: Subscription[] = [];

  constructor(
    readonly svc: MeterReadReviewService,
    private chatService: ChatService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.detailForm = this.fb.group({
      reviewStatus: ['pending'],
      notes: [''],
    });

    // Restore filters from session
    const saved = sessionStorage.getItem('mrr-status-filters');
    if (saved) {
      try {
        this.statusFilters = JSON.parse(saved);
      } catch {}
    }

    // Reactive filtering
    const filter$ = new BehaviorSubject(this.statusFilters);
    this.subs.push(
      combineLatest([this.svc.devices$, this.searchTerm$, filter$])
        .pipe(
          map(([devices, term, filters]) => {
            const lc = term.toLowerCase();
            return devices
              .filter(
                (d) =>
                  filters[d.reviewStatus] &&
                  (!lc ||
                    d.projectName?.toLowerCase().includes(lc) ||
                    d.externalId?.toLowerCase().includes(lc) ||
                    d.serialNumber?.toLowerCase().includes(lc)),
              )
              .map((d) => ({ device: d, searchTerm: term }));
          }),
        )
        .subscribe((rows) => {
          this.filteredDevices = this.sortRows(rows);
          this.cdr.markForCheck();
        }),
    );

    // Watch for status filter changes
    this._filter$ = filter$;

    // Expand on demand
    this.subs.push(
      this.svc.expandId$.subscribe((id) => {
        if (id !== null) {
          this.expandedIds.add(id);
          this.openDetail(id);
        }
      }),
    );
  }

  private _filter$!: BehaviorSubject<Record<string, boolean>>;

  onFilterChange(): void {
    sessionStorage.setItem(
      'mrr-status-filters',
      JSON.stringify(this.statusFilters),
    );
    this._filter$.next({ ...this.statusFilters });
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  @HostListener('keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (this.editingId !== null) this.saveDetail();
      return;
    }
    if (e.key === 'Escape') {
      if (this.closeTopModal()) return;
      if (this.editingId !== null) { this.closeDetail(); return; }
    }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !this.hasOpenModal()) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      this.navigateList(e.key === 'ArrowUp' ? -1 : 1);
    }
  }

  private hasOpenModal(): boolean {
    return this.showConsistencyModal || this.showCeilingModal
      || this.showCrossSourceModal || this.showAuditModal || this.showGapModal;
  }

  private closeTopModal(): boolean {
    const modals: (keyof this)[] = [
      'showConsistencyModal', 'showCeilingModal',
      'showCrossSourceModal', 'showAuditModal', 'showGapModal',
    ];
    for (const key of modals) {
      if (this[key]) {
        (this as any)[key] = false;
        return true;
      }
    }
    return false;
  }

  private navigateList(dir: number): void {
    if (!this.filteredDevices.length) return;
    const idx = this.filteredDevices.findIndex((r) => r.device.deviceId === this.editingId);
    const next = Math.max(0, Math.min(this.filteredDevices.length - 1, idx + dir));
    if (!this.confirmDiscard()) return;
    this.openDetail(this.filteredDevices[next].device.deviceId);
  }

  // ── Sorting ──────────────────────────────────────────────────────────

  toggleSort(field: typeof this.sortField): void {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = field === 'latestReadDate' ? 'desc' : 'asc';
    }
    this.filteredDevices = this.sortRows(this.filteredDevices);
  }

  private sortRows(rows: FilteredRow[]): FilteredRow[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = (a.device as any)[this.sortField];
      const bv = (b.device as any)[this.sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }

  // ── Expand / Select ──────────────────────────────────────────────────

  toggleExpand(device: MeterReadReviewDevice): void {
    if (this.expandedIds.has(device.deviceId)) {
      this.expandedIds.delete(device.deviceId);
    } else {
      this.expandedIds.add(device.deviceId);
      if (!device.reads.length) {
        this.loadReads(device);
      }
    }
  }

  isExpanded(id: number): boolean {
    return this.expandedIds.has(id);
  }

  openDetail(deviceId: number): void {
    if (this.editingId !== null && this.editingId !== deviceId && !this.confirmDiscard()) return;
    this.editingId = deviceId;
    const device = this.svc.devices$.value.find(
      (d) => d.deviceId === deviceId,
    );
    if (device) {
      this.detailForm.patchValue({
        reviewStatus: device.reviewStatus,
        notes: device.notes || '',
      });
      if (!device.reads.length) {
        this.loadReads(device);
      }
    }
  }

  private loadReads(device: MeterReadReviewDevice): void {
    this.svc.loadReads(device.deviceId).subscribe({
      next: (reads) => {
        device.reads = reads;
        this.cdr.markForCheck();
      },
      error: (err) =>
        console.warn('Failed to load reads for', device.externalId, err),
    });
  }

  closeDetail(): void {
    if (!this.confirmDiscard()) return;
    this.editingId = null;
  }

  private confirmDiscard(): boolean {
    if (!this.detailForm?.dirty) return true;
    return confirm('You have unsaved changes. Discard them?');
  }

  saveDetail(): void {
    if (!this.editingId) return;
    const { reviewStatus, notes } = this.detailForm.value;
    const loginUser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    const reviewer = loginUser.firstName
      ? `${loginUser.firstName} ${loginUser.lastName || ''}`.trim()
      : loginUser.email || 'unknown';

    this.svc
      .updateStatus(this.editingId, reviewStatus, notes, reviewer)
      .subscribe({
        next: () => {
          // Update local state
          const devices = this.svc.devices$.value.map((d) =>
            d.deviceId === this.editingId
              ? { ...d, reviewStatus, notes, reviewer }
              : d,
          );
          this.svc.devices$.next(devices);

          // Auto-chat on status change
          const device = devices.find((d) => d.deviceId === this.editingId);
          if (device) {
            this.logChatEntry(
              device.projectName,
              `_Meter-read review status changed to **${reviewStatus}**._`,
            );
          }
          this.detailForm.markAsPristine();
          this.toast(`Status changed to "${reviewStatus}"`);
        },
        error: (err) => {
          console.error('Failed to update meter-read review status', err);
          this.toast('Save failed', 5000);
        },
      });
  }

  // ── Chat ─────────────────────────────────────────────────────────────

  openChat(): void {
    if (!this.editingId) return;
    const device = this.svc.devices$.value.find(
      (d) => d.deviceId === this.editingId,
    );
    if (!device) return;
    this.chatService.readOnly$.next(device.reviewStatus === 'rejected');
    this.chatService.openForDevice$.next({
      submitterEmail: device.submitterEmail,
      siteName: device.projectName,
    });
    if (!this.chatService.isChatOpen$.value) {
      this.chatService.isChatOpen$.next(true);
    }
  }

  private logChatEntry(siteName: string, message: string): void {
    const loginUser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    const email = loginUser.email;
    if (!email) return;

    const device = this.svc.devices$.value.find(
      (d) => d.projectName === siteName,
    );
    const submitter = device?.submitterEmail;
    if (!submitter) return;

    this.chatService
      .getConversation(email, submitter, siteName)
      .subscribe((conv: any) => {
        if (conv) {
          this.chatService.sendMessage(email, message).subscribe();
        } else {
          this.chatService
            .startConversation(email, submitter, email, message, siteName)
            .subscribe();
        }
      });
  }

  // ── Verification tools ───────────────────────────────────────────────

  checkConsistency(): void {
    if (!this.editingId) return;
    this.consistencyResult = null;
    this.consistencyError = '';
    this.showConsistencyModal = true;
    this.svc.reviewHistoricalConsistency(this.editingId).subscribe({
      next: (res) => {
        this.consistencyResult = res;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.consistencyError =
          err?.error?.message || err?.message || 'Request failed';
        this.cdr.markForCheck();
      },
    });
  }

  checkCeiling(): void {
    if (!this.editingId) return;
    this.ceilingResult = null;
    this.ceilingError = '';
    this.showCeilingModal = true;
    this.svc.checkProductionCeiling(this.editingId).subscribe({
      next: (res) => {
        this.ceilingResult = res;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.ceilingError =
          err?.error?.message || err?.message || 'Request failed';
        this.cdr.markForCheck();
      },
    });
  }

  checkCrossSource(): void {
    if (!this.editingId) return;
    this.crossSourceResult = null;
    this.crossSourceError = '';
    this.showCrossSourceModal = true;
    this.svc.crossSourceVerification(this.editingId).subscribe({
      next: (res) => {
        this.crossSourceResult = res;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.crossSourceError =
          err?.error?.message || err?.message || 'Request failed';
        this.cdr.markForCheck();
      },
    });
  }

  flagRead(device: MeterReadReviewDevice, read: MeterReadEntry): void {
    if (this.flaggedReads[read.id]) {
      this.toast('Already flagged');
      return;
    }
    const reason = prompt('Reason for flagging this read:');
    if (!reason) return;
    const loginUser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    const reviewer = loginUser.firstName
      ? `${loginUser.firstName} ${loginUser.lastName || ''}`.trim()
      : loginUser.email || 'reviewer';
    this.svc.flagMeterRead(device.deviceId, read.id, reason, reviewer).subscribe({
      next: () => {
        this.flaggedReads[read.id] = true;
        this.toast(`Read #${read.id} flagged`);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.toast(err?.error?.message || 'Flag failed', 5000);
      },
    });
  }

  checkGaps(): void {
    if (!this.editingId) return;
    this.gapResult = null;
    this.gapError = '';
    this.showGapModal = true;
    this.svc.gapAnalysis(this.editingId).subscribe({
      next: (res) => {
        this.gapResult = res;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.gapError = err?.error?.message || err?.message || 'Request failed';
        this.cdr.markForCheck();
      },
    });
  }

  get filteredAuditTrail() {
    if (!this.auditSearch) return this.auditTrail;
    const q = this.auditSearch.toLowerCase();
    return this.auditTrail.filter(
      (e: any) =>
        e.actionType?.toLowerCase().includes(q) ||
        e.performedBy?.toLowerCase().includes(q) ||
        (e.detail && e.detail.toLowerCase().includes(q)) ||
        e.createdAt?.toLowerCase().includes(q),
    );
  }

  showAudit(): void {
    if (!this.editingId) return;
    this.auditTrail = [];
    this.auditSearch = '';
    this.showAuditModal = true;
    this.svc.getAuditTrail(this.editingId).subscribe({
      next: (res) => {
        this.auditTrail = res;
        this.cdr.markForCheck();
      },
      error: (err) => console.warn('Audit trail failed', err),
    });
  }

  copyAuditTrail(): void {
    const text = this.auditTrail
      .map((e) => {
        const date = new Date(e.createdAt);
        const ts = date.toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        let line = `${e.actionType}  ${e.performedBy}  ${ts}`;
        if (e.detail) line += `\n  ${e.detail}`;
        return line;
      })
      .join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      this.auditCopyLabel = 'Copied';
      setTimeout(() => (this.auditCopyLabel = 'Copy'), 2000);
    });
  }

  exportAuditCsv(): void {
    const escape = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
    const header = 'Action,Performed By,Date,Detail';
    const rows = this.filteredAuditTrail.map((e: any) => {
      const ts = new Date(e.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      return [escape(e.actionType), escape(e.performedBy), escape(ts), escape(e.detail || '')].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${this.editingId ?? 'unknown'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Resize detail panel ──────────────────────────────────────────────

  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    this.resizing = true;
    const startY = event.clientY;
    const startH = this.detailHeight;
    const onMove = (e: MouseEvent) => {
      this.detailHeight = Math.max(120, startH - (e.clientY - startY));
    };
    const onUp = () => {
      this.resizing = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  formatDate(d: string | null): string {
    if (!d) return '—';
    const dt = new Date(d);
    const date = dt.toLocaleDateString('en-GB');
    const time = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  }

  formatKwh(v: number | null): string {
    if (v == null) return '—';
    return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
  }

  hl(text: string, term: string): string {
    if (!term || !text) return text || '';
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(
      new RegExp(`(${escaped})`, 'gi'),
      '<mark>$1</mark>',
    );
  }

  // ── Bulk actions ──────────────────────────────────────────────────

  checked: Record<number, boolean> = {};
  bulkBusy = false;

  get checkedIds(): number[] {
    return Object.keys(this.checked).filter((k) => this.checked[+k]).map(Number);
  }

  get checkedCount(): number {
    return this.checkedIds.length;
  }

  toggleCheck(id: number, event: Event): void {
    event.stopPropagation();
    this.checked[id] = !this.checked[id];
  }

  toggleCheckAll(event: Event): void {
    event.stopPropagation();
    const allChecked = this.filteredDevices.every((r) => this.checked[r.device.deviceId]);
    for (const r of this.filteredDevices) {
      this.checked[r.device.deviceId] = !allChecked;
    }
  }

  isAllChecked(): boolean {
    return this.filteredDevices.length > 0 && this.filteredDevices.every((r) => this.checked[r.device.deviceId]);
  }

  bulkSetStatus(status: string): void {
    const ids = this.checkedIds;
    if (!ids.length) return;
    if (!confirm(`Set ${ids.length} device(s) to "${status}"?`)) return;
    this.bulkBusy = true;
    const loginUser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    const reviewer = loginUser.firstName
      ? `${loginUser.firstName} ${loginUser.lastName || ''}`.trim()
      : loginUser.email || 'unknown';
    this.svc.bulkUpdateStatus(ids, status, reviewer).subscribe({
      next: () => {
        const devices = this.svc.devices$.value.map((d) =>
          this.checked[d.deviceId] ? { ...d, reviewStatus: status as ReadReviewStatus, reviewer } : d,
        );
        this.svc.devices$.next(devices);
        this.checked = {};
        this.bulkBusy = false;
        this.toast(`${ids.length} device(s) set to "${status}"`);
      },
      error: () => {
        this.bulkBusy = false;
        this.toast('Bulk update failed', 5000);
      },
    });
  }

  trackByDeviceId(_index: number, row: FilteredRow): number {
    return row.device.deviceId;
  }

  trackByReadId(_index: number, read: MeterReadEntry): number {
    return read.id;
  }

  private toast(message: string, duration = 2500): void {
    this.snackBar.open(message, undefined, {
      duration,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
