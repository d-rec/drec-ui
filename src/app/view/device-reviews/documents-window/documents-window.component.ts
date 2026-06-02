import { HttpClient } from '@angular/common/http';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ElementRef,
  HostListener,
} from '@angular/core';
import { DomSanitizer, SafeHtml, SafeUrl } from '@angular/platform-browser';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, combineLatest, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { Asset, AssetStatus } from '../asset.model';
import { AssetService } from '../asset.service';
import { ChatService } from '../../../chat/chat.service';
import {
  EvidenceRequirements,
  RequirementLevel,
  getEvidenceRequirements,
  getHint,
} from '../../../utils/evidence-requirements';
import { environment } from '../../../../environments/environment';
import { extractExt } from '../../../utils/file-ext';
import { DocumentClassifierService } from '../../../utils/document-classifier.service';
import { DocumentType } from '../../../utils/drec.enum';
import { DOCUMENT_TYPE_LABELS } from '../../../utils/document-keywords';
// Per-field reviewer notes moved into chat (2026-05-11). The thread
// UI in this component was replaced by the existing chat panel —
// reviewer composes notes there via the kind picker.

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
  isDevMode = !environment.production;

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

  satPreviewEnabled = false;
  satPreview: {
    lat: number;
    lng: number;
    label: string;
    x: number;
    y: number;
  } | null = null;

  statusFilter: Record<AssetStatus, boolean> = this.loadStatusFilter();
  readonly statusFilter$ = new BehaviorSubject(this.statusFilter);

  private static readonly STATUS_FILTER_KEY = 'dr_statusFilter';

  private loadStatusFilter(): Record<AssetStatus, boolean> {
    try {
      const saved = sessionStorage.getItem(
        DocumentsWindowComponent.STATUS_FILTER_KEY,
      );
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {
      draft: true,
      pending: true,
      approved: false,
      rejected: false,
      legacy: false,
    };
  }

  private saveStatusFilter(): void {
    sessionStorage.setItem(
      DocumentsWindowComponent.STATUS_FILTER_KEY,
      JSON.stringify(this.statusFilter),
    );
  }

  searchMatchIds: string[] = [];
  searchIndex = -1;

  // sort state
  sortColumn:
    | 'serial'
    | 'modifiedDate'
    | 'status'
    | 'siteName'
    | 'countryCode'
    | 'screenStatus'
    | 'docs'
    | 'sf02Ready' = 'siteName';
  sortDir: 1 | -1 = 1;
  readonly sort$ = new BehaviorSubject<{ col: string; dir: number }>({
    col: 'siteName',
    dir: 1,
  });

  sortBy(
    col:
      | 'serial'
      | 'modifiedDate'
      | 'status'
      | 'siteName'
      | 'countryCode'
      | 'screenStatus'
      | 'docs'
      | 'sf02Ready',
  ): void {
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
      } else if (this.sortColumn === 'siteName') {
        av = a.siteName.toLowerCase();
        bv = b.siteName.toLowerCase();
      } else if (this.sortColumn === 'countryCode') {
        av = a.countryCode.toLowerCase();
        bv = b.countryCode.toLowerCase();
      } else if (this.sortColumn === 'screenStatus') {
        const rank = (s: string | null) =>
          s === 'fail' ? 0 : s === 'warn' ? 1 : s === 'pass' ? 2 : 3;
        av = rank(a.lastScreenStatus);
        bv = rank(b.lastScreenStatus);
      } else if (this.sortColumn === 'docs') {
        const docsOk = (x: Asset) =>
          x.sldUrl && x.sf02Url && x.codProofUrl && x.pictureUrls.length >= 3
            ? 1
            : 0;
        av = docsOk(a);
        bv = docsOk(b);
      } else if (this.sortColumn === 'sf02Ready') {
        av = a.sf02Ready ? 1 : 0;
        bv = b.sf02Ready ? 1 : 0;
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
      | 'codProof'
      | 'sld'
      | 'sf02'
      | 'sf02c'
      | 'proofOfOwnership'
      | 'meteringEvidence'
      | 'pictures'
      | 'screenshots'
      | 'otherDocuments',
      boolean
    >
  > = {};

  // document reviewed state: keyed by "deviceId:docKey" (e.g. "42:sld", "42:pic:0")
  reviewed: Record<string, boolean> = {};
  // maps "deviceId:docKey" → document DB id for API calls
  private docIdMap: Record<string, number> = {};

  // URLs that returned 404 / failed HEAD check
  brokenUrls = new Set<string>();

  // detail form
  detailForm!: FormGroup;
  editingId: string | null = null;
  editingSiteName: string | null = null;
  showApproveModal = false;
  showApprovedInfoModal = false;
  showUnreviewedWarning = false;
  showDeleteModal = false;
  showDuplicatesModal = false;
  duplicateResults: Array<{
    id: number;
    externalId: string;
    siteName: string;
    serialNumber: string;
    organizationId: number;
    matchType: string;
  }> = [];
  showAuditModal = false;
  auditTrail: Array<{
    id: number;
    actionType: string;
    detail: string | null;
    performedBy: string;
    metadata: Record<string, any> | null;
    createdAt: string;
  }> = [];
  auditCopyLabel = 'Copy';
  auditSearch = '';
  showConsistencyModal = false;
  consistencyError: string | null = null;
  consistencyResult: {
    totalReadings: number;
    periodMonths: number;
    anomalies: Array<{
      type: string;
      severity: 'warning' | 'critical';
      description: string;
      readingIds?: number[];
    }>;
    summary: {
      meanKwh: number;
      stdDevKwh: number;
      coefficientOfVariation: number;
      minKwh: number;
      maxKwh: number;
      sigmaBand?: { low: number; high: number; outliersCount: number };
    } | null;
  } | null = null;
  showCeilingModal = false;
  ceilingError: string | null = null;
  ceilingResult: {
    irradiance: {
      absLatitude: number;
      yieldHigh: number;
      yieldLow: number;
      annualCeilingKwh: number;
      monthlyCeilingKwh: number;
    } | null;
    capacityKw: number;
    recentReadings: Array<{
      startDate: string;
      endDate: string;
      valueKwh: number;
      periodHours: number;
      ceilingKwh: number;
      exceedsCeiling: boolean;
    }>;
  } | null = null;
  showCrossSourceModal = false;
  crossSourceResult: {
    performanceFactor: number;
    simpleRatio: number;
    monthsCompared: number;
    rSquared: number;
    months: Array<{
      month: string;
      actualKwh: number;
      modelKwh: number;
      ratio: number;
    }>;
    flags: Array<{
      type: string;
      severity: 'warning' | 'critical';
      description: string;
    }>;
  } | null = null;
  showControlsModal = false;
  controlsResult: {
    isMode4: boolean;
    allSatisfied: boolean;
    controls: Array<{
      id: string;
      label: string;
      satisfied: boolean;
      detail: string;
    }>;
  } | null = null;
  showSourceVerifyModal = false;
  sourceVerifyError: string | null = null;
  sourceVerifyResult: {
    mode: string | null;
    missingRequired: string[];
    missingRecommended: string[];
    manualChecks: Array<{ id: string; label: string; description: string }>;
  } | null = null;
  showAutoScreenModal = false;
  autoScreenLoading = false;
  autoScreenError: string | null = null;
  autoScreenResult: {
    deviceId: number;
    sections: Array<{
      name: string;
      status: 'pass' | 'warn' | 'fail' | 'skip';
      flags: string[];
      detail?: any;
    }>;
    overallStatus: 'pass' | 'warn' | 'fail';
    timestamp: string;
  } | null = null;
  showSldModal = false;
  sldResult: {
    registeredCapacityKw: number | null;
    sldCapacityKw: number | null;
    hasSld: boolean;
    differencePercent: number | null;
    tolerancePercent: number;
    match: boolean | null;
  } | null = null;
  sldInputKw: number | null = null;
  showPhotoGpsModal = false;
  photoGpsResult: {
    deviceLat: number | null;
    deviceLng: number | null;
    photos: Array<{
      docId: number;
      fileName: string;
      hasGps: boolean;
      lat: number | null;
      lng: number | null;
      distanceMeters: number | null;
      withinThreshold: boolean | null;
    }>;
    thresholdMeters: number;
    summary: {
      total: number;
      withGps: number;
      withinThreshold: number;
      flagged: number;
    };
  } | null = null;

  // ── Scan dialog state ──────────────────────────────────────────────────
  get scanDialogX(): number {
    const sidenavWidth = 200;
    const dialogWidth = 720;
    return (
      sidenavWidth +
      Math.max(0, (window.innerWidth - sidenavWidth - dialogWidth) / 2)
    );
  }
  get scanDialogY(): number {
    const headerHeight = 42;
    const dialogHeight = 620;
    return (
      headerHeight +
      Math.max(0, (window.innerHeight - headerHeight - dialogHeight) / 2)
    );
  }
  showScanDialog = false;
  scanRunning = false;
  scanCancelled = false;
  scanStartedAt: number | null = null;
  scanElapsedMs = 0;
  private scanTimerHandle: any = null;
  scanLog: Array<{
    key: string;
    label: string;
    status:
      | 'pending'
      | 'running'
      | 'pass'
      | 'warn'
      | 'fail'
      | 'error'
      | 'skipped';
    detail?: string;
    subItems?: Array<{
      label: string;
      status: 'pass' | 'warn' | 'fail' | 'info' | 'skip';
      detail?: string;
    }>;
    duration?: number;
  }> = [];

  readonly scanChecks: Array<{
    key: string;
    label: string;
    description: string;
    enabled: boolean;
    /** Bucket header rendered above this entry. Cosmetic only. */
    group?: 'aggregate' | 'identity' | 'compliance' | 'site' | 'production';
  }> = [
    // ─ Aggregate ─
    {
      key: 'autoScreen',
      label: 'Automation',
      description: 'Run all automated checks (VA layer)',
      enabled: true,
      group: 'aggregate',
    },
    // ─ Identity & Documents ─
    {
      key: 'duplicates',
      label: 'Duplicate Screening',
      description: 'Screen for duplicate devices across all organizations',
      enabled: true,
      group: 'identity',
    },
    {
      key: 'classify',
      label: 'Document Classification',
      description: 'AI-classify all documents and check they match their slots',
      enabled: true,
      group: 'identity',
    },
    {
      key: 'requiredFields',
      label: 'Required Fields',
      description: 'Confirm SF-02 mandatory fields are populated',
      enabled: true,
      group: 'identity',
    },
    // ─ Compliance ─
    {
      key: 'sourceAccess',
      label: 'Source Access Mode',
      description: 'Verify source-access mode requirements (§3.3)',
      enabled: true,
      group: 'compliance',
    },
    {
      key: 'controls',
      label: 'Compensating Controls',
      description: 'Evaluate compensating controls for Mode 4 (§3.9)',
      enabled: true,
      group: 'compliance',
    },
    {
      key: 'opConfigDocs',
      label: 'Operating-Config Docs',
      description: 'Required documents for the chosen operating configuration',
      enabled: true,
      group: 'compliance',
    },
    // ─ Site Verification ─
    {
      key: 'photoGps',
      label: 'Photo EXIF GPS',
      description: 'Verify photo EXIF GPS matches declared device location',
      enabled: true,
      group: 'site',
    },
    {
      key: 'sldCapacity',
      label: 'SLD Capacity Compare',
      description: 'Compare single-line diagram capacity with registered kW',
      enabled: true,
      group: 'site',
    },
    {
      key: 'countryMatch',
      label: 'Country Match',
      description: 'Declared country matches reverse-geocoded coordinates',
      enabled: true,
      group: 'site',
    },
    // ─ Production Validation ─
    {
      key: 'ceiling',
      label: 'Production Ceiling',
      description: 'Irradiance-based production ceiling check (§3.6)',
      enabled: true,
      group: 'production',
    },
    {
      key: 'crossSource',
      label: 'Cross-Source Verification',
      description: 'Compare metered production against solar model (§3.10)',
      enabled: true,
      group: 'production',
    },
    {
      key: 'consistency',
      label: 'Historical Consistency',
      description: 'Review historical meter read consistency and anomalies',
      enabled: true,
      group: 'production',
    },
  ];

  /** Group rendering metadata. Order in this map = render order in dialog. */
  readonly scanGroups: Record<
    'aggregate' | 'identity' | 'compliance' | 'site' | 'production',
    { label: string }
  > = {
    aggregate: { label: '' },
    identity: { label: 'Identity & Documents' },
    compliance: { label: 'Compliance' },
    site: { label: 'Site Verification' },
    production: { label: 'Production Validation' },
  };

  scanGroupKeys(): Array<keyof typeof this.scanGroups> {
    return Object.keys(this.scanGroups) as Array<keyof typeof this.scanGroups>;
  }
  /** Position of `check` in the flat scanChecks array, used for numbering. */
  scanCheckIndex(check: { key: string }): number {
    return this.scanChecks.findIndex((c) => c.key === check.key);
  }
  scanChecksInGroup(g: string): typeof this.scanChecks {
    return this.scanChecks.filter((c) => c.group === g);
  }
  toggleScanGroup(g: string, on: boolean): void {
    for (const c of this.scanChecks) if (c.group === g) c.enabled = on;
  }
  isScanGroupAllOn(g: string): boolean {
    const inGroup = this.scanChecksInGroup(g);
    return inGroup.length > 0 && inGroup.every((c) => c.enabled);
  }
  isScanGroupAnyOn(g: string): boolean {
    return this.scanChecksInGroup(g).some((c) => c.enabled);
  }

  get scanHasEnabled(): boolean {
    return this.scanChecks.some((c) => c.enabled);
  }

  sharingReport = false;

  /** Sticky error snackbar with a "Copy" action — pastes the full title +
   *  message into the clipboard. Used everywhere a copyable error is wanted. */
  private showCopyableError(title: string, message: string): void {
    console.error(`[${title}]`, message);
    const ref = this.snackBar.open(`${title} — ${message}`, 'Copy', {
      duration: 0, // sticky until dismissed
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['snack-error'],
    });
    ref.onAction().subscribe(() => {
      const text = `${title}\n\n${message}`;
      const done = () => this.toast('Error copied');
      navigator.clipboard?.writeText(text).then(done, () => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          done();
        } finally {
          document.body.removeChild(ta);
        }
      });
      ref.dismiss();
    });
  }

  /** Build the report payload that gets persisted server-side. */
  private buildReportPayload(): {
    elapsedMs: number;
    overallStatus: string | null;
    payload: any;
  } {
    const counts = { pass: 0, warn: 0, fail: 0, error: 0, skipped: 0 };
    for (const e of this.scanLog) {
      if (counts[e.status as keyof typeof counts] !== undefined)
        (counts as any)[e.status]++;
    }
    const overallStatus =
      counts.fail > 0 || counts.error > 0
        ? 'fail'
        : counts.warn > 0
          ? 'warn'
          : 'pass';
    return {
      elapsedMs: this.scanElapsedMs,
      overallStatus,
      payload: {
        scanLog: this.scanLog,
        counts,
        elapsedDisplay: this.scanElapsedDisplay,
        autoScreenResult: this.autoScreenResult || null,
      },
    };
  }

  /** Plain-text TSV-ish render of the scan log for clipboard pasting. */
  private renderReportAsText(): string {
    const lines: string[] = [];
    lines.push(`Verify Device Report`);
    lines.push(`Time elapsed: ${this.scanElapsedDisplay}`);
    lines.push('');
    for (const e of this.scanLog) {
      const status = e.status.toUpperCase();
      lines.push(`[${status}] ${e.label}${e.detail ? ' — ' + e.detail : ''}`);
      for (const sub of e.subItems || []) {
        lines.push(`    • ${sub.label}${sub.detail ? ' — ' + sub.detail : ''}`);
      }
    }
    return lines.join('\n');
  }

  copyScanReport(): void {
    const text = this.renderReportAsText();
    const done = () => this.toast('Report copied to clipboard');
    navigator.clipboard?.writeText(text).then(done, () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        done();
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  /** Persist the report and post a chat message to the registrant. */
  shareScanReport(): void {
    if (!this.editingId || this.sharingReport) return;
    this.sharingReport = true;
    const deviceId = parseInt(this.editingId, 10);
    const { elapsedMs, overallStatus, payload } = this.buildReportPayload();
    this.svc
      .saveVerificationReport(deviceId, elapsedMs, overallStatus, payload)
      .subscribe({
        next: ({ id, uuid }) => {
          // Prefer the uuid in the share URL — non-guessable + stable across
          // reseeds. Falls back to id if the backend predates the uuid column.
          const ref = uuid || id;
          const url = `${window.location.origin}/r/${ref}`;
          // Find the registrant for this device and open / append a chat
          // message with the link.
          const asset = this.svc.assets$.value.find(
            (a) => a.id === this.editingId,
          );
          const registrantEmail = asset?.submitterEmail;
          if (!registrantEmail) {
            this.sharingReport = false;
            this.showCopyableError(
              'No registrant email on file',
              `Report saved (${overallStatus}) but the device has no submitterEmail to chat. ` +
                `Manually share this URL:\n${url}`,
            );
            return;
          }
          this.sendChatLink(
            registrantEmail,
            asset?.siteName || `device ${deviceId}`,
            url,
            overallStatus || 'verify',
          ).then(
            () => {
              this.sharingReport = false;
              this.toast(`Verification report sent to ${registrantEmail}`);
              // Skip the 4s polling lag — push the new message into the
              // open chat window immediately if it's pointed at this
              // conversation.
              this.chatService.refreshOpenChain();
            },
            (err) => {
              this.sharingReport = false;
              const detail =
                err?.error?.message ||
                err?.message ||
                JSON.stringify(err) ||
                'unknown error';
              this.showCopyableError(
                'Chat send failed',
                `Report was saved successfully (id=${id}) but the chat message to ${registrantEmail} failed.\n\n` +
                  `URL: ${url}\n\n` +
                  `Error: ${detail}`,
              );
            },
          );
        },
        error: (err) => {
          this.sharingReport = false;
          const detail =
            err?.error?.message ||
            err?.message ||
            JSON.stringify(err) ||
            'unknown error';
          this.showCopyableError(
            'Could not save report',
            `POST /device-reviews/${deviceId}/reports failed.\n\nError: ${detail}`,
          );
        },
      });
  }

  /** Send a chat message containing the report URL to the registrant. */
  private sendChatLink(
    toEmail: string,
    siteName: string,
    reportUrl: string,
    overallStatus: string,
  ): Promise<void> {
    // Body kept short — the chat-window renders the report URL as a
    // styled "Verification Report" card with a tap-to-open arrow, so
    // there's no need to spell out "Open: <url>" in the text.
    const body = `Verification report for ${siteName} — overall: ${overallStatus.toUpperCase()}\n${reportUrl}`;
    // Use the chat service: open or create a conversation with this email,
    // then send. We expose a thin helper if it doesn't already exist.
    return new Promise((resolve, reject) => {
      try {
        // chatService is already injected (see deviceChats subscription).
        this.chatService
          .sendDirectMessage(toEmail, body, { deviceSiteName: siteName })
          .subscribe({ next: () => resolve(), error: reject });
      } catch (e) {
        reject(e);
      }
    });
  }

  /** "0:08.3" / "1:24.0" — minutes:seconds.tenths */
  get scanElapsedDisplay(): string {
    const ms = this.scanElapsedMs;
    const total = ms / 1000;
    const m = Math.floor(total / 60);
    const s = total - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, '0')}`;
  }

  openScanDialog(): void {
    this.showScanDialog = true;
    this.scanRunning = false;
    this.scanCancelled = false;
    this.scanLog = [];
  }

  cancelScan(): void {
    if (this.scanRunning) {
      this.scanCancelled = true;
    } else {
      this.showScanDialog = false;
    }
  }

  closeScan(): void {
    this.showScanDialog = false;
  }

  get scanProgress(): number {
    if (this.scanLog.length === 0) return 0;
    const done = this.scanLog.filter(
      (e) => e.status !== 'pending' && e.status !== 'running',
    ).length;
    return Math.round((done / this.scanLog.length) * 100);
  }

  async startScan(): Promise<void> {
    if (!this.editingId) return;
    const deviceId = parseInt(this.editingId, 10);
    if (isNaN(deviceId)) return;

    const enabled = this.scanChecks.filter((c) => c.enabled);
    this.scanLog = enabled.map((c) => ({
      key: c.key,
      label: c.label,
      status: 'pending' as const,
    }));
    this.scanRunning = true;
    this.scanCancelled = false;
    this.scanStartedAt = Date.now();
    this.scanElapsedMs = 0;
    if (this.scanTimerHandle) clearInterval(this.scanTimerHandle);
    this.scanTimerHandle = setInterval(() => {
      if (this.scanStartedAt && this.scanRunning) {
        this.scanElapsedMs = Date.now() - this.scanStartedAt;
        this.cdr.markForCheck();
      }
    }, 100);
    this.cdr.detectChanges();

    for (const entry of this.scanLog) {
      if (this.scanCancelled) {
        entry.status = 'skipped';
        entry.detail = 'Cancelled by user';
        continue;
      }

      entry.status = 'running';
      this.cdr.detectChanges();
      // Scroll to bottom of log
      setTimeout(() => {
        const el = document.querySelector('.scan-log__body');
        if (el) el.scrollTop = el.scrollHeight;
      });

      const t0 = performance.now();
      try {
        const result = await this.runSingleCheck(entry.key, deviceId);
        entry.duration = Math.round(performance.now() - t0);
        entry.status = result.status === 'skip' ? 'skipped' : result.status;
        entry.detail = result.detail;
        entry.subItems = result.subItems;
      } catch (err: any) {
        entry.duration = Math.round(performance.now() - t0);
        entry.status = 'error';
        const raw = err?.error?.message || err?.message || '';
        entry.detail = /column|relation|syntax|query|SQL/i.test(raw)
          ? 'Server error — please restart the API and try again'
          : raw || 'Unexpected error';
      }
      this.cdr.detectChanges();
      setTimeout(() => {
        const el = document.querySelector('.scan-log__body');
        if (el) el.scrollTop = el.scrollHeight;
      });
    }

    this.scanRunning = false;
    if (this.scanStartedAt) {
      this.scanElapsedMs = Date.now() - this.scanStartedAt;
    }
    if (this.scanTimerHandle) {
      clearInterval(this.scanTimerHandle);
      this.scanTimerHandle = null;
    }

    // Update asset badge with auto-screen result if it ran
    const autoEntry = this.scanLog.find((e) => e.key === 'autoScreen');
    if (autoEntry && this.autoScreenResult) {
      const asset = this.svc.assets$.value.find((a) => a.id === this.editingId);
      if (asset) {
        asset.lastScreenStatus = this.autoScreenResult.overallStatus;
        asset.lastScreenedAt = this.autoScreenResult.timestamp;
      }
    }
    this.cdr.detectChanges();
  }

  private runSingleCheck(
    key: string,
    deviceId: number,
  ): Promise<{
    status: 'pass' | 'warn' | 'fail' | 'skip';
    detail: string;
    subItems?: Array<{
      label: string;
      status: 'pass' | 'warn' | 'fail' | 'info' | 'skip';
      detail?: string;
    }>;
  }> {
    return new Promise((resolve, reject) => {
      switch (key) {
        case 'autoScreen':
          this.svc.autoScreen(deviceId).subscribe({
            next: (res: any) => {
              this.autoScreenResult = res;
              const fails = res.sections.filter(
                (s: any) => s.status === 'fail',
              ).length;
              const warns = res.sections.filter(
                (s: any) => s.status === 'warn',
              ).length;
              const passes = res.sections.filter(
                (s: any) => s.status === 'pass',
              ).length;
              const skips = res.sections.filter(
                (s: any) => s.status === 'skip',
              ).length;
              const subItems: Array<{
                label: string;
                status: 'pass' | 'warn' | 'fail' | 'info';
                detail?: string;
              }> = [];
              for (const s of res.sections || []) {
                const flagList = (s.flags || []).join('; ');
                subItems.push({
                  label: s.name || s.key || 'Check',
                  status: s.status === 'skip' ? 'info' : s.status,
                  detail: flagList || s.detail || s.message || undefined,
                });
              }
              const parts: string[] = [`${passes} pass`];
              if (warns) parts.push(`${warns} warn`);
              if (fails) parts.push(`${fails} fail`);
              if (skips) parts.push(`${skips} skip`);
              resolve({
                status: res.overallStatus,
                detail: `${parts.join(', ')} out of ${res.sections.length} checks`,
                subItems,
              });
            },
            error: reject,
          });
          break;

        case 'duplicates':
          this.svc.screenForDuplicates(deviceId).subscribe({
            next: (res: any) => {
              this.duplicateResults = res.duplicates || [];
              const n = this.duplicateResults.length;
              const subItems: Array<{
                label: string;
                status: 'pass' | 'warn' | 'fail' | 'info';
                detail?: string;
              }> = [];
              for (const d of this.duplicateResults) {
                subItems.push({
                  label: d.siteName || `Device #${d.id}`,
                  status: 'warn',
                  detail: [
                    `Match type: ${d.matchType || '?'}`,
                    d.serialNumber ? `Serial: ${d.serialNumber}` : null,
                    d.organizationId ? `Org ID: ${d.organizationId}` : null,
                    d.externalId ? `ExtID: ${d.externalId}` : null,
                  ]
                    .filter(Boolean)
                    .join(' | '),
                });
              }
              if (n === 0) {
                subItems.push({
                  label: 'Serial number',
                  status: 'pass',
                  detail: 'No matches across orgs',
                });
                subItems.push({
                  label: 'Coordinates',
                  status: 'pass',
                  detail: 'No co-located devices',
                });
                subItems.push({
                  label: 'Site name',
                  status: 'pass',
                  detail: 'No similar names found',
                });
              }
              resolve({
                status: n > 0 ? 'warn' : 'pass',
                detail:
                  n > 0
                    ? `${n} potential duplicate(s) found`
                    : 'No duplicates found',
                subItems,
              });
            },
            error: reject,
          });
          break;

        case 'sourceAccess':
          this.svc.verifySourceAccessMode(deviceId).subscribe({
            next: (res: any) => {
              this.sourceVerifyResult = res;
              this.sourceVerifyError = null;
              const missing = (res.missingRequired || []).length;
              const subItems: Array<{
                label: string;
                status: 'pass' | 'warn' | 'fail' | 'info';
                detail?: string;
              }> = [];
              subItems.push({
                label: `Source Access Mode`,
                status: 'info',
                detail: `Mode ${res.mode || '?'}`,
              });
              if (res.presentRequired?.length) {
                for (const item of res.presentRequired) {
                  subItems.push({
                    label: item,
                    status: 'pass',
                    detail: 'Required — present',
                  });
                }
              }
              if (res.missingRequired?.length) {
                for (const item of res.missingRequired) {
                  subItems.push({
                    label: item,
                    status: 'fail',
                    detail: 'Required — MISSING',
                  });
                }
              }
              if (res.missingRecommended?.length) {
                for (const item of res.missingRecommended) {
                  subItems.push({
                    label: item,
                    status: 'warn',
                    detail: 'Recommended — missing',
                  });
                }
              }
              resolve({
                status:
                  missing > 0
                    ? 'fail'
                    : res.missingRecommended?.length > 0
                      ? 'warn'
                      : 'pass',
                detail:
                  missing > 0
                    ? `${missing} required item(s) missing: ${res.missingRequired.join(', ')}`
                    : res.missingRecommended?.length > 0
                      ? `${res.missingRecommended.length} recommended item(s) missing`
                      : `Mode ${res.mode || '?'} — all requirements satisfied`,
                subItems,
              });
            },
            error: reject,
          });
          break;

        case 'ceiling':
          this.svc.checkProductionCeiling(deviceId).subscribe({
            next: (res: any) => {
              this.ceilingResult = res;
              this.ceilingError = null;
              const exceeded =
                res.recentReadings?.filter((r: any) => r.exceedsCeiling)
                  .length || 0;
              const subItems: Array<{
                label: string;
                status: 'pass' | 'warn' | 'fail' | 'info' | 'skip';
                detail?: string;
              }> = [];
              subItems.push({
                label: 'Capacity',
                status: 'info',
                detail: `${res.capacityKw || '?'} kW`,
              });
              if (res.capacityBasisNote) {
                subItems.push({
                  label: 'Capacity basis (DC/AC)',
                  status: 'warn',
                  detail: res.capacityBasisNote,
                });
              }
              if (res.irradiance) {
                subItems.push({
                  label: 'Irradiance estimate',
                  status: 'pass',
                  detail: `Yield range ${res.irradiance.yieldLow}–${res.irradiance.yieldHigh} kWh/kW/yr (lat ${res.irradiance.absLatitude}°)`,
                });
              } else {
                subItems.push({
                  label: 'Irradiance estimate',
                  status: 'warn',
                  detail:
                    res.irradianceUnavailableReason ||
                    'Unavailable — cannot estimate',
                });
              }
              if (res.solarGsa) {
                subItems.push({
                  label: 'Solar GSA (Global Solar Atlas)',
                  status: 'pass',
                  detail: `${res.solarGsa.annualKwh?.toFixed(0)} kWh/yr total | ${res.gsaYieldPerKw || (res.solarGsa.annualKwh / (res.capacityKw || 1)).toFixed(0)} kWh/kW/yr | v${res.solarGsa.version || '?'}`,
                });
              } else {
                const inputDiag: string[] = [];
                if (res.lat == null || isNaN(res.lat)) inputDiag.push('latitude');
                if (res.lng == null || isNaN(res.lng)) inputDiag.push('longitude');
                if (!(res.capacityKw > 0)) inputDiag.push('capacity');
                if (!res.commissioningDate) inputDiag.push('commissioning date');
                const fallback = inputDiag.length
                  ? `Missing ${inputDiag.join(', ')}`
                  : 'Unavailable — likely SOLAR_GRID_NPZ_PATH unset on API or coordinates outside grid (lat ∈ [-60,65])';
                subItems.push({
                  label: 'Solar GSA (Global Solar Atlas)',
                  status: 'warn',
                  detail: res.solarGsaUnavailableReason || fallback,
                });
              }
              const sources: string[] = [];
              if (res.gsaYieldPerKw || res.solarGsa) sources.push('Solar GSA');
              else if (res.irradiance?.yieldHigh) sources.push('irradiance');
              else sources.push('default (1500)');
              subItems.push({
                label: 'Effective ceiling yield',
                status: 'info',
                detail: `${res.effectiveCeiling ?? '?'} kWh/kW/yr (source: ${sources[0]})`,
              });
              if (res.recentReadings?.length) {
                for (const r of res.recentReadings) {
                  const valueKwh = r.valueKwh ?? r.value;
                  const ceilingKwh = r.ceilingKwh ?? r.ceiling;
                  const period = r.periodHours ? `${r.periodHours}h` : '';
                  const dateStr = r.endDate
                    ? new Date(r.endDate).toLocaleDateString()
                    : r.date || '?';
                  subItems.push({
                    label: dateStr,
                    status: r.exceedsCeiling ? 'warn' : 'pass',
                    detail: `${valueKwh?.toFixed(1)} kWh${period ? ' over ' + period : ''} (ceiling: ${ceilingKwh?.toFixed(1)} kWh)${r.exceedsCeiling ? ' — EXCEEDS' : ''}`,
                  });
                }
              } else {
                subItems.push({
                  label: 'Readings',
                  status: 'skip',
                  detail: 'No recent meter readings found',
                });
              }
              // Skip rather than pass when the inputs needed to compute a
              // ceiling aren't there (no capacity, no coords, no
              // commissioning date) — a green ✓ on a no-op check is
              // misleading.
              const missing: string[] = [];
              if (!(res.capacityKw > 0)) missing.push('capacity');
              if (res.lat == null || isNaN(res.lat)) missing.push('latitude');
              if (res.lng == null || isNaN(res.lng)) missing.push('longitude');
              if (!res.commissioningDate) missing.push('commissioning date');
              if (missing.length) {
                resolve({
                  status: 'skip',
                  detail: `Cannot compute ceiling — missing ${missing.join(', ')}`,
                  subItems,
                });
                return;
              }
              resolve({
                status: exceeded > 0 ? 'warn' : 'pass',
                detail:
                  exceeded > 0
                    ? `${exceeded} reading(s) exceed the production ceiling`
                    : `All ${res.recentReadings?.length || 0} readings within ceiling`,
                subItems,
              });
            },
            error: reject,
          });
          break;

        case 'crossSource':
          this.svc.crossSourceVerification(deviceId).subscribe({
            next: (res: any) => {
              this.crossSourceResult = res;
              if (res.noActualData) {
                resolve({
                  status: 'skip',
                  detail: 'No meter readings yet — check skipped',
                  subItems: [],
                });
                return;
              }
              const flagCount = (res.flags || []).length;
              const hasCritical = res.flags?.some(
                (f: any) => f.severity === 'critical',
              );
              const subItems: Array<{
                label: string;
                status: 'pass' | 'warn' | 'fail' | 'info';
                detail?: string;
              }> = [];
              subItems.push({
                label: 'Performance factor',
                status:
                  res.performanceFactor > 1.2 || res.performanceFactor < 0.3
                    ? 'warn'
                    : 'pass',
                detail: `${res.performanceFactor?.toFixed(3) || '?'}`,
              });
              subItems.push({
                label: 'Correlation (R²)',
                status:
                  res.rSquared != null && res.rSquared < 0.5 ? 'warn' : 'pass',
                detail: `${res.rSquared?.toFixed(4) || '?'}`,
              });
              subItems.push({
                label: 'Simple ratio',
                status: 'info',
                detail: `${res.simpleRatio?.toFixed(3) || '?'}`,
              });
              subItems.push({
                label: 'Period compared',
                status: 'info',
                detail: `${res.monthsCompared || 0} months`,
              });
              if (res.modelSource) {
                subItems.push({
                  label: 'Model source',
                  status: 'info',
                  detail: res.modelSource,
                });
              }
              // Show individual months with outlier ratios
              for (const m of res.months || []) {
                if (m.ratio > 1.5 || m.ratio < 0.3) {
                  subItems.push({
                    label: m.month,
                    status: 'warn',
                    detail: `Actual ${m.actualKwh?.toFixed(0)} kWh vs model ${m.modelKwh?.toFixed(0)} kWh (ratio ${m.ratio?.toFixed(2)})`,
                  });
                }
              }
              for (const flag of res.flags || []) {
                subItems.push({
                  label: flag.label || flag.type || flag.description || 'Flag',
                  status: flag.severity === 'critical' ? 'fail' : 'warn',
                  detail:
                    flag.detail ||
                    flag.message ||
                    flag.description ||
                    undefined,
                });
              }
              if (flagCount === 0) {
                subItems.push({
                  label: 'Flags',
                  status: 'pass',
                  detail: 'No anomalies detected',
                });
              }
              resolve({
                status: hasCritical ? 'fail' : flagCount > 0 ? 'warn' : 'pass',
                detail:
                  `PF=${res.performanceFactor?.toFixed(2) || '?'}, R²=${res.rSquared?.toFixed(3) || '?'}, ${res.monthsCompared || 0} months compared` +
                  (flagCount > 0 ? `, ${flagCount} flag(s)` : ''),
                subItems,
              });
            },
            error: reject,
          });
          break;

        case 'photoGps':
          this.svc.verifyPhotoGps(deviceId).subscribe({
            next: (res: any) => {
              this.photoGpsResult = res;
              const flagged = res.summary?.flagged || 0;
              const withGps = res.summary?.withGps || 0;
              const total = res.summary?.total || 0;
              const subItems: Array<{
                label: string;
                status: 'pass' | 'warn' | 'fail' | 'info';
                detail?: string;
              }> = [];
              if (res.declaredLocation) {
                subItems.push({
                  label: 'Declared location',
                  status: 'info',
                  detail: `${res.declaredLocation.lat?.toFixed(5)}, ${res.declaredLocation.lng?.toFixed(5)}`,
                });
              }
              if (res.thresholdKm != null) {
                subItems.push({
                  label: 'Distance threshold',
                  status: 'info',
                  detail: `${res.thresholdKm} km`,
                });
              }
              for (const photo of res.photos || []) {
                if (!photo.hasGps) {
                  subItems.push({
                    label: photo.filename || photo.fileName || 'Photo',
                    status: 'warn',
                    detail: 'No GPS EXIF data',
                  });
                } else if (photo.flagged || photo.withinThreshold === false) {
                  subItems.push({
                    label: photo.filename || photo.fileName || 'Photo',
                    status: 'fail',
                    detail: `GPS: ${photo.lat?.toFixed(5)}, ${photo.lng?.toFixed(5)} — ${(photo.distanceKm ?? photo.distanceMeters / 1000)?.toFixed(2)} km from site — EXCEEDS threshold`,
                  });
                } else {
                  subItems.push({
                    label: photo.filename || photo.fileName || 'Photo',
                    status: 'pass',
                    detail: `GPS: ${photo.lat?.toFixed(5)}, ${photo.lng?.toFixed(5)} — ${(photo.distanceKm ?? photo.distanceMeters / 1000)?.toFixed(2)} km (OK)`,
                  });
                }
              }
              resolve({
                status: flagged > 0 ? 'warn' : withGps === 0 ? 'warn' : 'pass',
                detail:
                  withGps === 0
                    ? `No GPS data found in any of ${total} photo(s)`
                    : flagged > 0
                      ? `${flagged} photo(s) flagged (${withGps}/${total} have GPS)`
                      : `${withGps}/${total} photos have GPS, all within threshold`,
                subItems,
              });
            },
            error: reject,
          });
          break;

        case 'sldCapacity':
          this.svc.compareSldCapacity(deviceId).subscribe({
            next: (res: any) => {
              this.sldResult = res;
              this.sldInputKw = res.sldCapacityKw;
              const subItems: Array<{
                label: string;
                status: 'pass' | 'warn' | 'fail' | 'info';
                detail?: string;
              }> = [];
              subItems.push({
                label: 'Registered capacity',
                status: 'info',
                detail: `${res.registeredCapacityKw ?? '?'} kW`,
              });
              subItems.push({
                label: 'SLD capacity',
                status: 'info',
                detail: res.hasSld ? `${res.sldCapacityKw} kW` : 'Not recorded',
              });
              if (res.hasSld) {
                subItems.push({
                  label: 'Tolerance',
                  status: 'info',
                  detail: `${res.tolerancePercent}%`,
                });
                subItems.push({
                  label: 'Difference',
                  status: res.match ? 'pass' : 'fail',
                  detail: `${res.differencePercent?.toFixed(1)}%`,
                });
              }
              resolve({
                status: !res.hasSld ? 'warn' : res.match ? 'pass' : 'fail',
                detail: !res.hasSld
                  ? 'No SLD capacity value recorded'
                  : res.match
                    ? `SLD ${res.sldCapacityKw} kW matches registered ${res.registeredCapacityKw} kW (within ${res.tolerancePercent}%)`
                    : `Mismatch: SLD ${res.sldCapacityKw} kW vs registered ${res.registeredCapacityKw} kW (${res.differencePercent?.toFixed(1)}% difference)`,
                subItems,
              });
            },
            error: reject,
          });
          break;

        case 'controls':
          this.svc.evaluateCompensatingControls(deviceId).subscribe({
            next: (res: any) => {
              this.controlsResult = res;
              const subItems: Array<{
                label: string;
                status: 'pass' | 'warn' | 'fail' | 'info';
                detail?: string;
              }> = [];
              if (!res.isMode4) {
                subItems.push({
                  label: 'Mode check',
                  status: 'info',
                  detail: `Device is Mode ${res.mode || '?'} — compensating controls only apply to Mode 4`,
                });
                resolve({
                  status: 'pass',
                  detail: 'Not Mode 4 — compensating controls not applicable',
                  subItems,
                });
              } else {
                for (const c of res.controls || []) {
                  subItems.push({
                    label: c.name || c.key || 'Control',
                    status: c.satisfied ? 'pass' : 'fail',
                    detail:
                      c.detail ||
                      c.reason ||
                      (c.satisfied ? 'Satisfied' : 'NOT satisfied'),
                  });
                }
                const unsat = res.controls.filter(
                  (c: any) => !c.satisfied,
                ).length;
                resolve({
                  status: res.allSatisfied ? 'pass' : 'fail',
                  detail: res.allSatisfied
                    ? `All ${res.controls.length} controls satisfied`
                    : `${unsat} of ${res.controls.length} controls not satisfied`,
                  subItems,
                });
              }
            },
            error: reject,
          });
          break;

        case 'consistency':
          this.svc.reviewHistoricalConsistency(deviceId).subscribe({
            next: (res: any) => {
              this.consistencyResult = res;
              this.consistencyError = null;
              if (!res.totalReadings) {
                resolve({
                  status: 'skip',
                  detail: 'No meter readings yet — check skipped',
                  subItems: [],
                });
                return;
              }
              const anomalies = res.anomalies?.length || 0;
              const critical =
                res.anomalies?.filter((a: any) => a.severity === 'critical')
                  .length || 0;
              const subItems: Array<{
                label: string;
                status: 'pass' | 'warn' | 'fail' | 'info';
                detail?: string;
              }> = [];
              subItems.push({
                label: 'Period',
                status: 'info',
                detail: `${res.periodMonths || '?'} months, ${res.totalReadings || 0} readings`,
              });
              if (res.avgMonthlyKwh != null) {
                subItems.push({
                  label: 'Avg monthly production',
                  status: 'info',
                  detail: `${res.avgMonthlyKwh.toFixed(1)} kWh`,
                });
              }
              if (res.stdDevKwh != null) {
                subItems.push({
                  label: 'Std deviation',
                  status: 'info',
                  detail: `${res.stdDevKwh.toFixed(1)} kWh`,
                });
              }
              for (const a of res.anomalies || []) {
                subItems.push({
                  label: a.type || a.label || 'Anomaly',
                  status: a.severity === 'critical' ? 'fail' : 'warn',
                  detail:
                    a.detail ||
                    a.message ||
                    `${a.month || '?'}: ${a.value?.toFixed(1) || '?'} kWh`,
                });
              }
              if (anomalies === 0) {
                subItems.push({
                  label: 'Anomalies',
                  status: 'pass',
                  detail: 'None detected',
                });
              }
              resolve({
                status: critical > 0 ? 'fail' : anomalies > 0 ? 'warn' : 'pass',
                detail:
                  anomalies === 0
                    ? `${res.totalReadings} readings over ${res.periodMonths} months — no anomalies`
                    : `${anomalies} anomaly/ies (${critical} critical) in ${res.totalReadings} readings`,
                subItems,
              });
            },
            error: reject,
          });
          break;

        case 'classify':
          this.runClassifyForScan(deviceId).then(resolve).catch(reject);
          break;

        case 'requiredFields': {
          const a = this.svc.assets$.value.find((x) => x.id === String(deviceId));
          if (!a) {
            resolve({ status: 'skip', detail: 'Device not in current list' });
            break;
          }
          const missing: string[] = [];
          if (!a.siteName) missing.push('siteName');
          if (a.lat == null) missing.push('latitude');
          if (a.long == null) missing.push('longitude');
          if (a.capacity == null || a.capacity <= 0) missing.push('capacity');
          if (!a.countryCode) missing.push('country');
          if (!a.operatingConfiguration)
            missing.push('operatingConfiguration');
          if (!a.sourceAccessMode) missing.push('sourceAccessMode');
          resolve({
            status: missing.length ? 'fail' : 'pass',
            detail: missing.length
              ? `Missing: ${missing.join(', ')}`
              : `All ${7} required fields populated`,
          });
          break;
        }

        case 'countryMatch':
          this.svc.verifyCountryMatch(deviceId).subscribe({
            next: (res: any) => {
              // CountryMatchStatus = 'match' | 'mismatch' | 'disputed' | 'skip'
              const map: Record<string, 'pass' | 'warn' | 'fail' | 'skip'> = {
                match: 'pass',
                mismatch: 'fail',
                disputed: 'warn',
                skip: 'skip',
              };
              const status = map[res?.status] || 'skip';
              const declared = res?.declaredCountry
                ? this.countryName(res.declaredCountry)
                : '—';
              const resolved = res?.resolvedCountry
                ? this.countryName(res.resolvedCountry)
                : '—';
              const reason = res?.reason || '';
              resolve({
                status,
                detail:
                  status === 'pass'
                    ? `Declared ${declared} matches reverse-geocode (${resolved})`
                    : status === 'fail'
                      ? `Declared ${declared} but coords resolve to ${resolved}${reason ? ` — ${reason}` : ''}`
                      : status === 'warn'
                        ? `Disputed territory: declared ${declared}, resolves ${resolved}${reason ? ` — ${reason}` : ''}`
                        : reason || 'Country match could not be evaluated',
              });
            },
            error: reject,
          });
          break;

        case 'opConfigDocs': {
          // Lean on the existing source-access verification: it already
          // returns required+missing docs for the chosen pathway/config.
          this.svc.verifySourceAccessMode(deviceId).subscribe({
            next: (res: any) => {
              const missing = (res.missingRequired || []) as string[];
              resolve({
                status: missing.length ? 'fail' : 'pass',
                detail: missing.length
                  ? `Missing for ${res.operatingConfiguration || 'this configuration'}: ${missing.join(', ')}`
                  : `All required documents present for ${res.operatingConfiguration || 'this configuration'}`,
              });
            },
            error: reject,
          });
          break;
        }

        case 'audit':
          this.svc.getAuditTrail(deviceId).subscribe({
            next: (res: any[]) => {
              this.auditTrail = res;
              const subItems: Array<{
                label: string;
                status: 'pass' | 'warn' | 'fail' | 'info';
                detail?: string;
              }> = [];
              const actionCounts: Record<string, number> = {};
              for (const entry of res) {
                const action = entry.actionType || 'unknown';
                actionCounts[action] = (actionCounts[action] || 0) + 1;
              }
              for (const [action, count] of Object.entries(actionCounts)) {
                subItems.push({
                  label: action,
                  status: 'info',
                  detail: `${count} occurrence(s)`,
                });
              }
              if (res.length > 0) {
                const latest = res[0];
                subItems.push({
                  label: 'Latest entry',
                  status: 'info',
                  detail: `${latest.actionType} by ${latest.performedBy || '?'} on ${latest.createdAt ? new Date(latest.createdAt).toLocaleDateString() : '?'}`,
                });
              }
              const warningEntries = res.filter((e: any) =>
                e.detail?.includes('exceeds'),
              );
              if (warningEntries.length > 0) {
                subItems.push({
                  label: 'Warning entries',
                  status: 'warn',
                  detail: `${warningEntries.length} entries contain "exceeds" flag`,
                });
              }
              resolve({
                status: warningEntries.length > 0 ? 'warn' : 'pass',
                detail: `${res.length} audit entries retrieved`,
                subItems,
              });
            },
            error: reject,
          });
          break;

        default:
          resolve({ status: 'warn', detail: 'Unknown check' });
      }
    });
  }

  private async runClassifyForScan(
    _deviceId: number,
  ): Promise<{
    status: 'pass' | 'warn' | 'fail';
    detail: string;
    subItems?: Array<{
      label: string;
      status: 'pass' | 'warn' | 'fail' | 'info' | 'skip';
      detail?: string;
    }>;
  }> {
    const asset = this.svc.assets$.value.find((a) => a.id === this.editingId);
    if (!asset) return { status: 'warn', detail: 'No asset selected' };

    this.classifyResults = [];
    let total = 0;
    let matchCount = 0;
    let mismatchCount = 0;
    let unknownCount = 0;

    for (const slot of DocumentsWindowComponent.SLOT_MAP) {
      const urls: string[] = [];
      if (slot.multi) {
        urls.push(...((asset[slot.urlKey] as string[]) || []));
      } else {
        const url = asset[slot.urlKey] as string | null;
        if (url) urls.push(url);
      }

      for (const url of urls) {
        if (this.scanCancelled) break;
        total++;
        const fname = this.fileName(url);
        this.classifyCurrentFile = fname;
        // Surface the live filename in the running scan-log entry too,
        // so the verify dialog (not just the standalone classify modal)
        // shows progress during the long-ish per-file work.
        const runningEntry = this.scanLog.find((e) => e.key === 'classify');
        if (runningEntry) runningEntry.detail = `Classifying ${fname}…`;
        try {
          const freshUrl = await this.svc.refreshUrl(url);
          const resp = await fetch(freshUrl);
          const blob = await resp.blob();
          const mime =
            blob.type && blob.type !== 'application/octet-stream'
              ? blob.type
              : this.guessMime(fname);
          const file = new File([blob], fname, { type: mime });
          const result = await this.classifier.classify(file).toPromise();
          const classifiedType = result?.suggestedType ?? null;
          const confidence = result ? Math.round(result.confidence * 100) : 0;
          const typeLabel = classifiedType
            ? DOCUMENT_TYPE_LABELS[classifiedType] || classifiedType
            : 'Unknown';
          const isMatch = classifiedType
            ? classifiedType === slot.expectedType ||
              (classifiedType === DocumentType.PROJECT_PHOTOS &&
                /\.(jpe?g|png|gif|webp|bmp)$/i.test(fname) &&
                (slot.expectedType === DocumentType.OTHER_DOCUMENTS ||
                  slot.expectedType === DocumentType.PROJECT_PHOTOS)) ||
              // A facility boundary is a site photo — accept in the Photos slot
              (classifiedType === DocumentType.FACILITY_BOUNDARY &&
                slot.expectedType === DocumentType.PROJECT_PHOTOS)
            : null;
          if (isMatch === true) matchCount++;
          else if (isMatch === false) mismatchCount++;
          else unknownCount++;

          this.classifyResults = [
            ...this.classifyResults,
            {
              slot: slot.slot,
              filename: fname,
              url,
              expectedType: slot.label,
              classifiedType: typeLabel,
              confidence,
              match: isMatch,
            },
          ];
        } catch {
          unknownCount++;
        }
      }
    }
    this.classifyCurrentFile = null;

    const subItems: Array<{
      label: string;
      status: 'pass' | 'warn' | 'fail' | 'info';
      detail?: string;
    }> = [];
    // Detect the same file reused across slots — registrants sometimes
    // upload one PDF into two slots (e.g. customer contract into both
    // Proof of Ownership and COD Proof). Key by URL when available,
    // otherwise fall back to filename.
    const dupKey = (r: { url: string; filename: string }) =>
      r.url || r.filename;
    const dupCounts = new Map<string, string[]>();
    for (const r of this.classifyResults) {
      const k = dupKey(r);
      const slots = dupCounts.get(k) ?? [];
      slots.push(r.slot);
      dupCounts.set(k, slots);
    }
    let duplicateCount = 0;
    for (const r of this.classifyResults) {
      const lowConf = (r.confidence ?? 0) < 60;
      const realMismatch = r.match === false && !lowConf;
      const otherSlots = (dupCounts.get(dupKey(r)) ?? []).filter(
        (s) => s !== r.slot,
      );
      const isDuplicate = otherSlots.length > 0;
      if (isDuplicate) duplicateCount++;
      const status: 'pass' | 'warn' | 'fail' | 'info' = isDuplicate
        ? 'fail'
        : r.match === true
          ? 'pass'
          : realMismatch
            ? 'fail'
            : 'info';
      const tail = isDuplicate
        ? ` — DUPLICATE of ${otherSlots.join(', ')} slot${otherSlots.length > 1 ? 's' : ''}`
        : r.match === true
          ? ' — match'
          : realMismatch
            ? ` — MISMATCH (expected ${r.expectedType})`
            : r.match === false
              ? ' — low-confidence guess, kept in slot'
              : '';
      subItems.push({
        label: r.filename,
        status,
        detail: `Slot: ${r.slot} | AI: ${r.classifiedType}${r.confidence ? ' (' + r.confidence + '%)' : ''}${tail}`,
      });
    }
    if (total === 0) {
      subItems.push({
        label: 'No documents',
        status: 'info',
        detail: 'No uploaded documents to classify',
      });
    }

    const dupTail = duplicateCount > 0 ? `, ${duplicateCount} duplicate` : '';
    return {
      status:
        duplicateCount > 0 || mismatchCount > 0
          ? 'warn'
          : total === 0
            ? 'warn'
            : 'pass',
      detail:
        total === 0
          ? 'No documents to classify'
          : `${total} docs: ${matchCount} match, ${mismatchCount} mismatch, ${unknownCount} unknown${dupTail}`,
      subItems,
    };
  }

  private pendingDelete: {
    asset: Asset;
    docKey: string;
    urlField: string;
    arrayIdx?: number;
  } | null = null;

  // resizable detail panel
  detailHeight = 280;
  private resizing = false;
  private resizeStartY = 0;
  private resizeStartH = 0;

  private sub!: Subscription;

  readonly filtered$ = combineLatest([
    this.svc.assets$,
    this.searchTerm$,
    this.statusFilter$,
    this.sort$,
  ]).pipe(
    map(([assets, searchTerm, statusFilter]) => {
      const filtered = this.sortAssets(
        this.applyFilter(assets, searchTerm, statusFilter),
      );
      return {
        assets: filtered,
        searchTerm,
        filteredCount: filtered.length,
        totalCount: assets.length,
      };
    }),
  );

  /** Selected ID tracked as component property so selection changes don't trigger list re-render. */
  selId: string | null = null;

  constructor(
    readonly svc: AssetService,
    readonly chatService: ChatService,
    private fb: FormBuilder,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private elRef: ElementRef,
    private snackBar: MatSnackBar,
    private http: HttpClient,
    private toastr: ToastrService,
    private classifier: DocumentClassifierService,
  ) {}

trustUrl(url: string): SafeUrl {
    // nosemgrep: angular-bypasssecuritytrust -- url comes from backend S3 presigned URLs, not user input
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  splitSerials(value: string | null | undefined): string[] {
    if (!value) return [];
    return String(value)
      .split(/\s*;\s*/)
      .filter((s) => s.length > 0);
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
    const re = new RegExp(t, 'gi'); // nosemgrep: detect-non-literal-regexp -- term is regex-escaped above
    const highlighted = safe.replace(
      re,
      (m) => `<mark class="search-highlight">${m}</mark>`,
    );
    return this.sanitizer.bypassSecurityTrustHtml(highlighted); // nosemgrep: angular-bypasssecuritytrust
  }

  ngOnInit(): void {
    this.detailForm = this.fb.group({
      lat: [''],
      long: [''],
      serial: [''],
      capacity: [''],
      countryCode: [''],
      reviewer: [''],
      dateAdded: [''],
      dateSubmitted: [''],
      status: ['pending' as AssetStatus],
      notes: [''],
      submitterEmail: ['', Validators.email],
      submitterName: [''],
      operatingConfiguration: [''],
      sourceAccessMode: [''],
      evidencePathway: [''],
      ownershipStatus: [''],
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
      this.validateDocumentUrls(assets);
    });

    this.sub.add(
      this.svc.selectedId$.subscribe((id) => {
        if (id) {
          const asset = this.svc.assets$.value.find((a) => a.id === id);
          if (asset) this.patchForm(asset);
        }
        this.editingId = id;
        this.editingSiteName = id
          ? this.svc.assets$.value.find((a) => a.id === id)?.siteName ?? null
          : null;
        this.selId = id;
      }),
    );

    this.sub.add(
      this.svc.expandId$.subscribe((id) => {
        if (!id) return;
        this.expanded = { ...this.expanded, [id]: true };
        if (!this.sectionOpen[id]) {
          const a = this.svc.assets$.value.find((x) => x.id === id);
          // Other Documents starts collapsed when there's nothing
          // in it — saves a row of visual noise.
          const hasOther = (a?.otherDocumentUrls?.length ?? 0) > 0;
          this.sectionOpen[id] = {
            codProof: true,
            sld: true,
            sf02: true,
            sf02c: true,
            proofOfOwnership: true,
            meteringEvidence: true,
            pictures: true,
            screenshots: true,
            otherDocuments: hasOther,
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

  @HostListener('keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    // Ctrl+S — save detail
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (this.editingId) this.saveDetail();
      return;
    }
    // Escape — close topmost modal, or close detail
    if (e.key === 'Escape') {
      if (this.closeTopModal()) return;
      if (this.editingId) {
        this.cancelDetail();
        return;
      }
    }
    // Arrow keys — navigate list when no modal is open and not in an input
    if (
      (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
      !this.hasOpenModal()
    ) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      this.navigateList(e.key === 'ArrowUp' ? -1 : 1);
    }
  }

  private hasOpenModal(): boolean {
    return (
      this.showApproveModal ||
      this.showApprovedInfoModal ||
      this.showDeleteModal ||
      this.showDuplicatesModal ||
      this.showAuditModal ||
      this.showConsistencyModal ||
      this.showCeilingModal ||
      this.showCrossSourceModal ||
      this.showControlsModal ||
      this.showSourceVerifyModal ||
      this.showAutoScreenModal ||
      this.showSldModal ||
      this.showPhotoGpsModal ||
      this.showUnreviewedWarning
    );
  }

  private closeTopModal(): boolean {
    const modals: (keyof this)[] = [
      'showApproveModal',
      'showApprovedInfoModal',
      'showDeleteModal',
      'showDuplicatesModal',
      'showAuditModal',
      'showConsistencyModal',
      'showCeilingModal',
      'showCrossSourceModal',
      'showControlsModal',
      'showSourceVerifyModal',
      'showAutoScreenModal',
      'showSldModal',
      'showPhotoGpsModal',
      'showUnreviewedWarning',
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
    const assets = this.sortAssets(
      this.applyFilter(
        this.svc.assets$.value,
        this.searchTerm,
        this.statusFilter,
      ),
    );
    if (!assets.length) return;
    const idx = assets.findIndex((a) => a.id === this.editingId);
    const next = Math.max(0, Math.min(assets.length - 1, idx + dir));
    if (!this.confirmDiscard()) return;
    this.svc.select(assets[next].id);
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
          a.proofOfOwnershipUrl,
          ...a.meteringEvidenceUrls,
          ...a.pictureUrls,
          ...a.screenshotUrls,
          ...a.otherDocumentUrls,
        ]
          .filter((u): u is string => !!u)
          .map((u) => this.fileName(u));
        const haystack = [
          a.serial,
          a.siteName,
          a.countryCode,
          this.countryName(a.countryCode),
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
      // Don't auto-select the first match on every keystroke — that
      // flips the page into focus mode (which hides the search box
      // itself in the new layout) before the user has finished
      // typing. Selection still happens on Enter (searchNext) or by
      // clicking a row.
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
    this.saveStatusFilter();
    this.statusFilter$.next({ ...this.statusFilter });
    this.onSearch();
  }

  // ── Hierarchy ────────────────────────────────────────────────────────────────

  toggleDevice(id: string): void {
    this.expanded = { ...this.expanded, [id]: !this.expanded[id] };
    if (!this.sectionOpen[id]) {
      const a = this.svc.assets$.value.find((x) => x.id === id);
      const hasOther = (a?.otherDocumentUrls?.length ?? 0) > 0;
      this.sectionOpen[id] = {
        codProof: true,
        sld: true,
        sf02: true,
        sf02c: true,
        proofOfOwnership: true,
        meteringEvidence: true,
        pictures: true,
        screenshots: true,
        otherDocuments: hasOther,
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
      | 'proofOfOwnership'
      | 'meteringEvidence'
      | 'pictures'
      | 'screenshots'
      | 'otherDocuments',
  ): void {
    if (!this.sectionOpen[id]) {
      const a = this.svc.assets$.value.find((x) => x.id === id);
      const hasOther = (a?.otherDocumentUrls?.length ?? 0) > 0;
      this.sectionOpen[id] = {
        codProof: true,
        sld: true,
        sf02: true,
        sf02c: true,
        proofOfOwnership: true,
        meteringEvidence: true,
        pictures: true,
        screenshots: true,
        otherDocuments: hasOther,
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
      | 'proofOfOwnership'
      | 'meteringEvidence'
      | 'pictures'
      | 'screenshots'
      | 'otherDocuments',
  ): boolean {
    return this.sectionOpen[id]?.[section] ?? true;
  }

  // ── File handling ─────────────────────────────────────────────────────────────

  async openFile(
    url: string,
    event: Event,
    isSld = false,
    enableOcr = false,
  ): Promise<void> {
    event.stopPropagation();
    // The <a> now carries [href][target=_blank] so right-click →
    // Copy Link Address works. Suppress the default navigation —
    // openFile handles in-app viewing instead.
    event.preventDefault();
    if (!url || this.isBroken(url)) {
      alert('File is missing\n\n' + url);
      return;
    }
    const freshUrl = await this.svc.refreshUrl(url);
    if (/\.(jpe?g|png|gif|webp|bmp|svg)/i.test(url)) {
      this.svc.sldDeviceId$.next(null);
      this.svc.viewPicture(freshUrl, enableOcr);
    } else {
      this.svc.sldDeviceId$.next(
        isSld && this.editingId ? parseInt(this.editingId, 10) : null,
      );
      this.svc.viewPdf(freshUrl);
    }
  }

  async openPicture(url: string, event: Event): Promise<void> {
    event.stopPropagation();
    event.preventDefault();
    if (!url || this.isBroken(url)) {
      alert('File is missing\n\n' + url);
      return;
    }
    const freshUrl = await this.svc.refreshUrl(url);
    this.svc.viewPicture(freshUrl, true);
  }

  private uploadAndRefresh(asset: Asset, docType: string, file: File): void {
    this.svc.uploadDocument(parseInt(asset.id, 10), docType, file).subscribe({
      next: () => {
        this.svc.populateFromDb();
        this.toast('Document uploaded');
      },
      error: (err) => {
        console.error('Upload failed', err);
        this.toast(
          'Upload failed — ' +
            (err?.error?.message || err?.message || 'unknown error'),
          5000,
        );
      },
    });
  }

  onCodProofChange(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadAndRefresh(asset, 'COD_PROOF', file);
  }

  clearCodProof(asset: Asset): void {
    this.requestDelete(asset, 'codProof', 'codProofUrl');
  }

  onSldChange(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadAndRefresh(asset, 'SINGLE_LINE_DIAGRAM', file);
  }

  clearSld(asset: Asset): void {
    this.requestDelete(asset, 'sld', 'sldUrl');
  }

  onSf02Change(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadAndRefresh(asset, 'FORM_SF_02', file);
  }

  clearSf02(asset: Asset): void {
    this.requestDelete(asset, 'sf02', 'sf02Url');
  }

  onSf02cChange(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadAndRefresh(asset, 'SF_02C', file);
  }

  clearSf02c(asset: Asset): void {
    this.requestDelete(asset, 'sf02c', 'sf02cUrl');
  }

  onSf02cOwnersDeclarationChange(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadAndRefresh(asset, 'PROOF_OF_OWNERSHIP', file);
  }

  clearSf02cOwnersDeclaration(asset: Asset): void {
    this.requestDelete(
      asset,
      'proofOfOwnership',
      'proofOfOwnershipUrl',
    );
  }

  onOtherDocumentAdd(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadAndRefresh(asset, 'OTHER_DOCUMENTS', file);
  }

  clearOtherDocument(asset: Asset, idx: number): void {
    this.requestDelete(asset, `otherDoc:${idx}`, 'otherDocumentUrls', idx);
  }

  onMeteringEvidenceChange(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadAndRefresh(asset, 'METERING_EVIDENCE', file);
  }

  clearMeteringEvidence(asset: Asset, idx: number): void {
    this.requestDelete(
      asset,
      `meteringEvidence:${idx}`,
      'meteringEvidenceUrls',
      idx,
    );
  }

  onPictureAdd(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadAndRefresh(asset, 'PROJECT_PHOTOS', file);
  }

  clearPicture(asset: Asset, idx: number): void {
    this.requestDelete(asset, `pic:${idx}`, 'pictureUrls', idx);
  }

  onScreenshotAdd(asset: Asset, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadAndRefresh(asset, 'SCREENSHOTS', file);
  }

  clearScreenshot(asset: Asset, idx: number): void {
    this.requestDelete(asset, `ss:${idx}`, 'screenshotUrls', idx);
  }

  private requestDelete(
    asset: Asset,
    docKey: string,
    urlField: string,
    arrayIdx?: number,
  ): void {
    this.pendingDelete = { asset, docKey, urlField, arrayIdx };
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.pendingDelete = null;
  }

  confirmDelete(): void {
    if (!this.pendingDelete) return;
    const { asset, docKey, urlField, arrayIdx } = this.pendingDelete;
    this.showDeleteModal = false;
    this.pendingDelete = null;

    const docMeta = asset.docMeta[docKey];
    const docId = docMeta?.docId;

    // Update local state immediately
    if (arrayIdx != null) {
      const arr = [...(asset as any)[urlField]];
      arr.splice(arrayIdx, 1);
      this.svc.saveAsset({ ...asset, [urlField]: arr });
    } else {
      this.svc.saveAsset({ ...asset, [urlField]: null });
    }

    // Delete from DB + S3 via API
    if (docId) {
      this.svc.deleteDocument(docId).subscribe({
        next: () => {
          this.svc.populateFromDb();
          this.toast('Document deleted');
        },
        error: (err) => {
          console.error('Failed to delete document:', err);
          this.toast('Delete failed', 5000);
        },
      });
    }
  }

  /** Display label for a multi-file row (pic/ss/me). Prefer user-set label → original filename → URL-derived name. */
  fileDisplayName(asset: Asset, docKey: string, url: string): string {
    const meta = asset.docMeta?.[docKey];
    if (meta?.label && meta.label.trim() !== '') return meta.label;
    if (meta?.originalFilename && meta.originalFilename.trim() !== '')
      return meta.originalFilename;
    return this.fileName(url);
  }

  fileExt(url: string): string {
    return extractExt(url);
  }

  fileName(url: string): string {
    try {
      const withoutQuery = url.split('?')[0];
      let name = withoutQuery.split('/').pop() ?? withoutQuery;
      // Decode + as space, then repeatedly decodeURIComponent for double-encoded keys
      name = name.replace(/\+/g, ' ');
      let prev = '';
      while (name !== prev) {
        prev = name;
        try {
          name = decodeURIComponent(name);
        } catch {
          break;
        }
      }
      // Strip embedded UUIDs
      name = name.replace(
        /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '',
      );
      // Strip upload timestamp+index suffix (e.g. _1752226304295_1.pdf → .pdf)
      name = name.replace(/_\d{10,}_\d+\./, '.');
      return name;
    } catch {
      return url;
    }
  }

  private readonly displayNames = new Intl.DisplayNames(['en'], {
    type: 'region',
  });
  private readonly alpha3to2: Record<string, string> = {
    IND: 'IN',
    USA: 'US',
    GBR: 'GB',
    DEU: 'DE',
    FRA: 'FR',
    BRA: 'BR',
    CHN: 'CN',
    JPN: 'JP',
    KEN: 'KE',
    NGA: 'NG',
    ZAF: 'ZA',
    AUS: 'AU',
    CAN: 'CA',
    MEX: 'MX',
    IDN: 'ID',
    PAK: 'PK',
    BGD: 'BD',
    NPL: 'NP',
    LKA: 'LK',
    THA: 'TH',
    VNM: 'VN',
    PHL: 'PH',
    MYS: 'MY',
    SGP: 'SG',
    ETH: 'ET',
    TZA: 'TZ',
    UGA: 'UG',
    RWA: 'RW',
    GHA: 'GH',
    SEN: 'SN',
    CMR: 'CM',
    MOZ: 'MZ',
    MDG: 'MG',
    MWI: 'MW',
    ZMB: 'ZM',
    ZWE: 'ZW',
    NLD: 'NL',
    ESP: 'ES',
    ITA: 'IT',
    PRT: 'PT',
    SWE: 'SE',
    NOR: 'NO',
    DNK: 'DK',
    FIN: 'FI',
    CHE: 'CH',
    AUT: 'AT',
    BEL: 'BE',
    POL: 'PL',
    ROU: 'RO',
    HUN: 'HU',
    CZE: 'CZ',
    BGR: 'BG',
    HRV: 'HR',
    SRB: 'RS',
    TUR: 'TR',
    EGY: 'EG',
    MAR: 'MA',
    TUN: 'TN',
    DZA: 'DZ',
    SAU: 'SA',
    ARE: 'AE',
    QAT: 'QA',
    KWT: 'KW',
    OMN: 'OM',
    IRQ: 'IQ',
    IRN: 'IR',
    AFG: 'AF',
    COL: 'CO',
    PER: 'PE',
    CHL: 'CL',
    ARG: 'AR',
    BOL: 'BO',
    PRY: 'PY',
    URY: 'UY',
    ECU: 'EC',
    VEN: 'VE',
    CRI: 'CR',
    PAN: 'PA',
    GTM: 'GT',
    HND: 'HN',
    SLV: 'SV',
    NIC: 'NI',
    DOM: 'DO',
    HTI: 'HT',
    JAM: 'JM',
    NZL: 'NZ',
    FJI: 'FJ',
    PNG: 'PG',
    SOM: 'SO',
    SSD: 'SS',
    SDN: 'SD',
    MLI: 'ML',
    NER: 'NE',
    BFA: 'BF',
    TCD: 'TD',
    CAF: 'CF',
    COD: 'CD',
    COG: 'CG',
    AGO: 'AO',
    NAM: 'NA',
    BWA: 'BW',
    LSO: 'LS',
    SWZ: 'SZ',
  };

  countryName(code: string): string {
    if (!code) return '';
    const a2 =
      code.length === 3
        ? this.alpha3to2[code.toUpperCase()]
        : code.toUpperCase();
    if (!a2) return code;
    try {
      return this.displayNames.of(a2) ?? code;
    } catch {
      return code;
    }
  }

  // ── URL validation ──────────────────────────────────────────────────────────

  /** Check every document URL for 404s; mark broken ones so the template can show (missing). */
  private validateDocumentUrls(assets: Asset[]): void {
    const urls: string[] = [];
    for (const a of assets) {
      if (a.sldUrl) urls.push(a.sldUrl);
      if (a.sf02Url) urls.push(a.sf02Url);
      if (a.sf02cUrl) urls.push(a.sf02cUrl);
      if (a.proofOfOwnershipUrl) urls.push(a.proofOfOwnershipUrl);
      if (a.codProofUrl) urls.push(a.codProofUrl);
      for (const u of a.meteringEvidenceUrls) urls.push(u);
      for (const u of a.pictureUrls) urls.push(u);
      for (const u of a.screenshotUrls) urls.push(u);
      for (const u of a.otherDocumentUrls) urls.push(u);
    }
    for (const url of urls) {
      if (this.brokenUrls.has(url)) continue;
      this.checkUrl(url);
    }
  }

  /**
   * Probe a single URL.
   * For images: try to load via Image element — catches corrupt, empty, and 0-dimension files.
   * For other files: GET + abort after reading status.
   */
  private checkUrl(url: string): void {
    const isImage = /\.(jpe?g|png|gif|webp|bmp|svg)/i.test(url.split('?')[0]);
    if (isImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Draw to a 1x1 canvas to detect blank/placeholder images
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          this.markBroken(url);
          return;
        }
        try {
          const c = document.createElement('canvas');
          c.width = Math.min(img.naturalWidth, 64);
          c.height = Math.min(img.naturalHeight, 64);
          const ctx = c.getContext('2d')!;
          ctx.drawImage(img, 0, 0, c.width, c.height);
          const data = ctx.getImageData(0, 0, c.width, c.height).data;
          // Check if every pixel is the same (solid color = likely placeholder)
          const r0 = data[0],
            g0 = data[1],
            b0 = data[2];
          let allSame = true;
          for (let i = 4; i < data.length; i += 4) {
            if (data[i] !== r0 || data[i + 1] !== g0 || data[i + 2] !== b0) {
              allSame = false;
              break;
            }
          }
          if (allSame) this.markBroken(url);
        } catch {
          // canvas tainted or other error — don't mark as broken
        }
      };
      img.onerror = () => this.markBroken(url);
      img.src = url;
    } else {
      // Non-image (PDF / Excel / etc.): skip the probe entirely.
      // The previous behaviour was fetch+immediate-abort to check
      // status, but Firefox surfaces the abort as NS_BINDING_ABORTED
      // and the click-time pdf-window fetch on the same URL got
      // coalesced with it — turning a perfectly good PDF into
      // "Could not load this document inline". The click-time fetch
      // already surfaces real errors with a friendly banner; the
      // probe's value here doesn't outweigh the breakage it causes.
      return;
    }
  }

  private markBroken(url: string): void {
    this.brokenUrls.add(url);
    this.cdr.markForCheck();
  }

  /** Check if a document URL exists but the file is broken/404. */
  isBroken(url: string | null): boolean {
    return !!url && this.brokenUrls.has(url);
  }

  // ── Conditional document requirements (§3.2) ───────────────────────────────

  /** Get requirement level for a document type based on the device's operating config. */
  getReqLevel(docType: string, config?: string | null): RequirementLevel | '' {
    const c =
      config ?? this.detailForm?.get('operatingConfiguration')?.value ?? null;
    if (!c) return '';
    const reqs = getEvidenceRequirements(c);
    return (reqs as any)[docType] ?? 'required';
  }

  /**
   * Get display status for a requirement tag: considers both the requirement level
   * and whether the document is present. Returns 'satisfied' if present, or the
   * requirement level if missing.
   */
  getReqStatus(
    docType: string,
    config: string | null,
    hasDoc: boolean,
  ): string {
    if (!config) return '';
    const level = this.getReqLevel(docType, config);
    if (!level) return '';
    if (hasDoc) return 'satisfied';
    return level;
  }

  /**
   * Show the standalone "missing" tag only when no req-tag is carrying
   * the same information. Otherwise the row reads "REQUIRED missing"
   * which is duplicative — pick one.
   */
  showMissingTag(
    docType: string,
    config: string | null,
    hasDoc: boolean,
  ): boolean {
    if (hasDoc) return false;
    return !this.getReqStatus(docType, config, hasDoc);
  }

  /** Get config-specific hint for a document type. */
  getDocHint(docType: string, config?: string | null): string | null {
    const c =
      config ?? this.detailForm?.get('operatingConfiguration')?.value ?? null;
    return getHint(c, docType);
  }

  // ── Detail form ───────────────────────────────────────────────────────────────

  selectAsset(asset: Asset): void {
    if (!this.confirmDiscard()) return;
    this.svc.select(asset.id);
  }

  /** "Return to list" exit from focused review mode. Drops the
   *  selection so every device row reappears. */
  returnToList(): void {
    if (!this.confirmDiscard()) return;
    this.svc.select(null);
  }

  /** Filter the rendered list to ONLY the selected device when a
   *  selection is active. Avoids the surrounding sites jangling
   *  the reviewer's focus while they work one device. */
  visibleAssets<T extends { id: string }>(all: T[]): T[] {
    if (!this.selId) return all;
    return all.filter((a) => a.id === this.selId);
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
      siteName: asset.siteName,
      capacity: v.capacity !== '' ? parseFloat(v.capacity) : null,
      countryCode: v.countryCode,
      reviewer: v.reviewer,
      dateAdded: v.dateAdded ? new Date(v.dateAdded) : null,
      dateSubmitted: v.dateSubmitted ? new Date(v.dateSubmitted) : null,
      status: newStatus,
      notes: v.notes,
      submitterEmail: v.submitterEmail,
    });
    this.detailForm.markAsPristine();
    if (oldStatus !== newStatus) {
      this.logStatusChange(asset.siteName, oldStatus, newStatus);
      this.toast(`Status changed to "${newStatus}"`);
    } else {
      this.toast('Saved');
    }
  }

  cancelDetail(): void {
    if (!this.confirmDiscard()) return;
    this.svc.select(null);
  }

  /** Canned reviewer-note phrases. Each click prepends a labelled
   *  bullet line to the notes textarea so reviewers don't have to
   *  hand-type common issues every time. Kept short — anything
   *  beyond this list goes in free text below the chip. */
  readonly NOTE_CHIPS: ReadonlyArray<string> = [
    'Missing SLD',
    'Missing SF-02',
    'Missing SF-02C',
    'Missing COD proof',
    'Missing metering evidence',
    'Site photos insufficient',
    'Coords too imprecise',
    'Country mismatch',
    'Capacity mismatch',
    'Commissioning date issue',
    'Owner mismatch',
    'Site address mismatch',
    'Off-taker mismatch',
    'Impact story too thin',
    'Duplicate device',
  ];

  // ─── Per-field reviewer notes ──────────────────────────────────
  // Folded into chat (kind='note') 2026-05-11. Reviewer composes
  // notes via the chat panel's kind picker; the in-page thread that
  // briefly lived here has been removed.

  /** Prepend "- <chip>: " to the legacy free-text notes textarea on a
   *  new line. Existing free text stays; cursor lands after the colon
   *  so the reviewer can immediately add detail. */
  insertNoteChip(chip: string): void {
    const ctl = this.detailForm?.get('notes');
    if (!ctl) return;
    const cur = String(ctl.value ?? '');
    const prefix = `- ${chip}: `;
    if (cur.includes(prefix)) return; // already added
    const next = cur ? `${cur.replace(/\s+$/, '')}\n${prefix}` : prefix;
    ctl.setValue(next);
    ctl.markAsDirty();
  }

  private confirmDiscard(): boolean {
    if (!this.detailForm?.dirty) return true;
    return confirm('You have unsaved changes. Discard them?');
  }

  setStatus(status: AssetStatus): void {
    if (!this.editingId) return;
    const asset = this.svc.assets$.value.find((a) => a.id === this.editingId);
    if (!asset) return;
    const oldStatus = asset.status;
    if (oldStatus === status) return;
    this.svc.saveAsset({ ...asset, status });
    this.detailForm.patchValue({ status });
    this.logStatusChange(asset.siteName, oldStatus, status);
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
    const asset = this.svc.assets$.value.find((a) => a.siteName === siteName);
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
          if (!submitterEmail || submitterEmail === username) {
            console.warn(
              'Skipping status-log chat: no submitter email for site',
              siteName,
            );
            return;
          }
          this.chatService
            .startConversation(
              username,
              submitterEmail,
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
    // Check if all documents for this device have been reviewed
    if (this.editingId && !this.allDocsReviewed()) {
      this.showUnreviewedWarning = true;
      return;
    }
    this.doApprove();
  }

  confirmUnreviewedApprove(): void {
    this.showUnreviewedWarning = false;
    this.doApprove();
  }

  cancelUnreviewedApprove(): void {
    this.showUnreviewedWarning = false;
  }

  private doApprove(): void {
    this.setStatus('approved');
    this.showApprovedInfoModal = true;
  }

  dismissApprovedInfo(): void {
    this.showApprovedInfoModal = false;
  }

  openDeviceInfo(): void {
    if (!this.editingId) return;
    const deviceId = parseInt(this.editingId, 10);
    if (isNaN(deviceId)) return;
    this.svc.viewDeviceInfo(deviceId);
  }

  openProvenance(): void {
    if (!this.editingId) return;
    const deviceId = parseInt(this.editingId, 10);
    if (isNaN(deviceId)) return;
    this.svc.viewProvenance(deviceId);
  }

  screenDuplicates(): void {
    if (!this.editingId) return;
    const deviceId = parseInt(this.editingId, 10);
    if (isNaN(deviceId)) return;
    this.svc.screenForDuplicates(deviceId).subscribe({
      next: (res: any) => {
        this.duplicateResults = res.duplicates || [];
        this.showDuplicatesModal = true;
        if (this.duplicateResults.length > 0) {
          const asset = this.svc.assets$.value.find(
            (a) => a.id === this.editingId,
          );
          if (asset) {
            const matches = this.duplicateResults
              .map((d: any) => d.matchType)
              .join(', ');
            this.logChatEntry(
              asset.siteName,
              `_Duplicate screening flagged ${this.duplicateResults.length} potential match(es): ${matches}. Please review and clarify._`,
            );
          }
        }
      },
      error: (err: any) => {
        console.error('Duplicate screening failed:', err);
        this.duplicateResults = [];
        this.showDuplicatesModal = true;
      },
    });
  }

  viewAuditTrail(): void {
    if (!this.editingId) return;
    const deviceId = parseInt(this.editingId, 10);
    if (isNaN(deviceId)) return;
    this.auditSearch = '';
    this.svc.getAuditTrail(deviceId).subscribe({
      next: (res: any[]) => {
        this.auditTrail = res;
        this.showAuditModal = true;
      },
      error: (err: any) => {
        console.error('Audit trail fetch failed:', err);
        this.auditTrail = [];
        this.showAuditModal = true;
      },
    });
  }

  get filteredAuditTrail() {
    if (!this.auditSearch) return this.auditTrail;
    const q = this.auditSearch.toLowerCase();
    return this.auditTrail.filter(
      (e) =>
        e.actionType.toLowerCase().includes(q) ||
        e.performedBy.toLowerCase().includes(q) ||
        (e.detail && e.detail.toLowerCase().includes(q)) ||
        e.createdAt.toLowerCase().includes(q),
    );
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
      const ts = new Date(e.createdAt).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      return [
        escape(e.actionType),
        escape(e.performedBy),
        escape(ts),
        escape(e.detail || ''),
      ].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${this.editingId || 'unknown'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  checkConsistency(): void {
    if (!this.editingId) return;
    const deviceId = parseInt(this.editingId, 10);
    if (isNaN(deviceId)) return;
    this.svc.reviewHistoricalConsistency(deviceId).subscribe({
      next: (res: any) => {
        this.consistencyResult = res;
        this.showConsistencyModal = true;
      },
      error: (err: any) => {
        console.error('Historical consistency review failed:', err);
        this.consistencyResult = null;
        this.showConsistencyModal = true;
      },
    });
  }

  hasCeilingExceedance(): boolean {
    return !!this.ceilingResult?.recentReadings?.some((r) => r.exceedsCeiling);
  }

  checkCeiling(): void {
    if (!this.editingId) return;
    const deviceId = parseInt(this.editingId, 10);
    if (isNaN(deviceId)) return;
    this.svc.checkProductionCeiling(deviceId).subscribe({
      next: (res: any) => {
        this.ceilingResult = res;
        this.ceilingError = null;
        this.showCeilingModal = true;
      },
      error: (err: any) => {
        console.error('Production ceiling check failed:', err);
        this.ceilingResult = null;
        this.ceilingError =
          err?.error?.message ||
          err?.message ||
          'Unknown error — check the browser console for details.';
        this.showCeilingModal = true;
      },
    });
  }

  verifySourceAccess(): void {
    if (!this.editingId) return;
    const deviceId = parseInt(this.editingId, 10);
    if (isNaN(deviceId)) return;
    this.svc.verifySourceAccessMode(deviceId).subscribe({
      next: (res: any) => {
        this.sourceVerifyResult = res;
        this.sourceVerifyError = null;
        this.showSourceVerifyModal = true;
      },
      error: (err: any) => {
        console.error('Source-access verification failed:', err);
        this.sourceVerifyResult = null;
        this.sourceVerifyError =
          err?.error?.message ||
          err?.message ||
          'Unknown error — check the browser console for details.';
        this.showSourceVerifyModal = true;
      },
    });
  }

  checkCrossSource(): void {
    if (!this.editingId) return;
    const deviceId = parseInt(this.editingId, 10);
    if (isNaN(deviceId)) return;
    this.svc.crossSourceVerification(deviceId).subscribe({
      next: (res: any) => {
        this.crossSourceResult = res;
        this.showCrossSourceModal = true;
      },
      error: (err: any) => {
        console.error('Cross-source verification failed:', err);
        this.crossSourceResult = null;
        this.showCrossSourceModal = true;
      },
    });
  }

  openScreenReport(item: any, event: Event): void {
    event.stopPropagation();
    this.editingId = item.id;
    this.expanded[item.id] = true;
    this.runAutoScreen();
  }

  autoScreenCopied = false;

  /** Translate a backend scan-flag string into a sentence the
   *  registrant (or a non-D-REC reviewer) can act on. Returns null
   *  when no humaniser exists for the flag — the original technical
   *  message stays visible above. */
  explainFlag(sectionName: string, flag: string): string | null {
    const f = String(flag || '');
    // -- Ownership ---------------------------------------------
    if (sectionName === 'Ownership Verification') {
      const miss = /Missing:\s*(.+)/.exec(f);
      if (miss) {
        return `The registrant hasn't uploaded ${miss[1]} yet — without it the I-REC issuance can't proceed. Ask them to attach via the edit-device page.`;
      }
      if (/flagged/i.test(f)) {
        return 'The platform couldn\'t confirm the device owner against the documents on file. Either the SF-02C / Proof-of-Ownership name doesn\'t match the registered owner, or one of the docs is missing.';
      }
    }
    // -- Production ceiling -----------------------------------
    if (sectionName === 'Production Ceiling') {
      const m = /Effective ceiling\s+([\d.,]+)\s*kWh\/kW\/yr/.exec(f);
      if (m) {
        return `D-REC caps the credible annual yield at ${m[1]} kWh per kW for this site's latitude / climate (Global Solar Atlas). Anything substantially above means a meter, capacity entry, or read-frequency is wrong — investigate before approving.`;
      }
      if (/exceeds/i.test(f)) {
        return 'The reported energy production this year is higher than what is physically plausible for the site\'s solar resource. Double-check the AC capacity (13) and the metering reads.';
      }
    }
    // -- Photo GPS --------------------------------------------
    if (sectionName === 'Photo GPS') {
      const m = /(\d+) photos: (\d+) with GPS, (\d+) within 300m, (\d+) flagged/.exec(f);
      if (m) {
        const total = +m[1], withGps = +m[2], near = +m[3], flagged = +m[4];
        if (flagged > 0) {
          return `${flagged} of ${total} site photos has GPS metadata that doesn't match the device coordinates (>300 m away). Ask the registrant whether the photo is mis-attributed or the coordinate is stale.`;
        }
        if (withGps === 0) {
          return `None of the ${total} site photos carries GPS metadata — the platform can't cross-check that the photos really show this site. Ask the registrant to re-upload originals from the camera/phone (not screenshots, which strip EXIF).`;
        }
        if (near === withGps && withGps > 0) {
          return `All ${withGps} GPS-tagged photos sit within 300 m of the device coordinates — strong evidence the photos really show this site.`;
        }
      }
    }
    // -- Duplicate Screening ----------------------------------
    if (sectionName === 'Duplicate Screening') {
      if (/0 potential duplicate/i.test(f)) {
        return 'No other device on the platform shares this site\'s name, coordinates, serial number, or external ID — safe from a double-counting perspective.';
      }
      const m = /(\d+) potential duplicate/.exec(f);
      if (m && +m[1] > 0) {
        return `Found ${m[1]} other device(s) that look like this same site (matching siteName / coords / serial / externalId). Verify they aren't actually the same physical installation registered twice — that would double-count generation.`;
      }
    }
    // -- Country Match ----------------------------------------
    if (sectionName === 'Country Match') {
      if (/coordinates land in/i.test(f) || /not match/i.test(f)) {
        return 'The lat/long coordinates point to a different country than the one selected in (5). Either the coords are wrong, the country is wrong, or the site is on a disputed border. Confirm with the registrant.';
      }
    }
    // -- Pathway classification -------------------------------
    if (sectionName === 'Pathway' || /Pathway/.test(sectionName)) {
      if (/Direct Off-Grid/i.test(f)) {
        return 'D-REC has classified the site as off-grid with a directly-readable inverter. Issuance proceeds via inverter telemetry; no DSO data needed.';
      }
      if (/Direct Grid/i.test(f)) {
        return 'Grid-connected with direct DSO/inverter access — issuance can proceed against the metered grid imports/exports.';
      }
      if (/Compensating/i.test(f)) {
        return 'No primary data path; D-REC needs additional documentary evidence (compensating controls) for issuance. The registrant should provide signed statements + audit trails.';
      }
    }
    // -- Source access mode -----------------------------------
    if (sectionName === 'Source Access Mode') {
      if (/no source access mode/i.test(f) || /not set/i.test(f)) {
        return 'The registrant hasn\'t declared how D-REC will pull meter reads from this site (API / portal / file submission). Without this we can\'t establish the issuance pathway. Ask them to set (28).';
      }
    }
    // -- SLD Capacity Compare ---------------------------------
    if (sectionName === 'SLD Capacity Compare') {
      if (/no SLD/i.test(f)) {
        return 'No Single Line Diagram on file — the platform can\'t cross-check the registered capacity (13) against the system the registrant claims. Request an SLD upload.';
      }
      if (/exceeds|differs|mismatch/i.test(f)) {
        return 'The SLD\'s nameplate doesn\'t match the registered AC capacity on the form. One of them is wrong — typically the form value when the registrant typed a rounded figure.';
      }
    }
    return null;
  }

  copyAutoScreenReport(): void {
    if (!this.autoScreenResult) return;
    const r = this.autoScreenResult;
    const lines: string[] = [];
    lines.push(`Automation Report`);
    lines.push(`Overall: ${r.overallStatus.toUpperCase()}`);
    lines.push(`Generated: ${new Date(r.timestamp).toLocaleString()}`);
    lines.push('');
    for (const s of r.sections) {
      const label = s.status === 'skip' ? 'ERROR' : s.status.toUpperCase();
      lines.push(`[${label}] ${s.name}`);
      for (const f of s.flags || []) lines.push(`  - ${f}`);
    }
    const text = lines.join('\n');
    const done = () => {
      this.autoScreenCopied = true;
      setTimeout(() => (this.autoScreenCopied = false), 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(done)
        .catch(() => this.fallbackCopy(text, done));
    } else {
      this.fallbackCopy(text, done);
    }
  }

  private fallbackCopy(text: string, done: () => void): void {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      done();
    } finally {
      document.body.removeChild(ta);
    }
  }

  runAutoScreen(): void {
    if (!this.editingId) return;
    const deviceId = parseInt(this.editingId, 10);
    if (isNaN(deviceId)) return;
    this.autoScreenLoading = true;
    this.autoScreenResult = null;
    this.autoScreenError = null;
    this.showAutoScreenModal = true;
    this.svc.autoScreen(deviceId).subscribe({
      next: (res: any) => {
        this.autoScreenResult = res;
        this.autoScreenLoading = false;
        // Update the badge on the asset list immediately
        const asset = this.svc.assets$.value.find(
          (a) => a.id === this.editingId,
        );
        if (asset) {
          asset.lastScreenStatus = res.overallStatus;
          asset.lastScreenedAt = res.timestamp;
        }
      },
      error: (err: any) => {
        console.error('Automation failed:', err);
        this.autoScreenResult = null;
        this.autoScreenError =
          err?.error?.message ||
          err?.message ||
          'Unknown error — check the browser console for details.';
        this.autoScreenLoading = false;
      },
    });
  }

  openSldCompare(event: Event): void {
    if (!this.editingId) return;
    const asset = this.svc.assets$.value.find((a) => a.id === this.editingId);
    if (asset?.sldUrl && !this.isBroken(asset.sldUrl)) {
      this.openFile(asset.sldUrl, event, true);
    } else {
      this.checkSldCapacity();
    }
  }

  checkSldCapacity(): void {
    if (!this.editingId) return;
    const deviceId = parseInt(this.editingId, 10);
    if (isNaN(deviceId)) return;
    this.svc.compareSldCapacity(deviceId).subscribe({
      next: (res: any) => {
        this.sldResult = res;
        this.sldInputKw = res.sldCapacityKw;
        this.showSldModal = true;
      },
      error: (err: any) => {
        console.error('SLD compare failed:', err);
        this.sldResult = null;
        this.showSldModal = true;
      },
    });
  }

  saveSldCapacity(): void {
    if (!this.editingId || this.sldInputKw == null) return;
    const deviceId = parseInt(this.editingId, 10);
    if (isNaN(deviceId)) return;
    this.svc.setSldCapacity(deviceId, this.sldInputKw).subscribe({
      next: () => {
        // Re-fetch the comparison after saving
        this.checkSldCapacity();
      },
      error: (err: any) => {
        console.error('Failed to save SLD capacity:', err);
      },
    });
  }

  checkPhotoGps(): void {
    if (!this.editingId) return;
    const deviceId = parseInt(this.editingId, 10);
    if (isNaN(deviceId)) return;
    this.svc.verifyPhotoGps(deviceId).subscribe({
      next: (res: any) => {
        this.photoGpsResult = res;
        this.showPhotoGpsModal = true;
      },
      error: (err: any) => {
        console.error('Photo GPS check failed:', err);
        this.photoGpsResult = null;
        this.showPhotoGpsModal = true;
      },
    });
  }

  evaluateControls(): void {
    if (!this.editingId) return;
    const deviceId = parseInt(this.editingId, 10);
    if (isNaN(deviceId)) return;
    this.svc.evaluateCompensatingControls(deviceId).subscribe({
      next: (res: any) => {
        this.controlsResult = res;
        this.showControlsModal = true;
      },
      error: (err: any) => {
        console.error('Compensating controls evaluation failed:', err);
        this.controlsResult = null;
        this.showControlsModal = true;
      },
    });
  }

  private allDocsReviewed(): boolean {
    if (!this.editingId) return true;
    const prefix = this.editingId + ':';
    const keys = Object.keys(this.reviewed).filter((k) => k.startsWith(prefix));
    if (keys.length === 0) return true;
    return keys.every((k) => this.reviewed[k]);
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

  trackByIndex(index: number): number {
    return index;
  }

  toggleReviewed(key: string, event: Event): void {
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
        this.logStatusChange(asset.siteName, oldStatus, 'draft');
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
          asset.siteName,
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
      proofOfOwnership: 'Proof of Ownership',
      codProof: 'COD Proof',
      meteringEvidence: 'Metering Evidence',
    };
    const parts = key.split(':');
    if (parts[1] === 'pic') return `Picture #${parseInt(parts[2], 10) + 1}`;
    if (parts[1] === 'otherDoc')
      return `Other Document #${parseInt(parts[2], 10) + 1}`;
    return labels[parts[1]] || parts[1];
  }

  showSatPreview(event: MouseEvent, asset: Asset) {
    if (!this.satPreviewEnabled) return;
    const lat = asset.lat;
    const lng = asset.long;
    if (lat == null || lng == null) return;
    const pos = this.satPreviewPos(event);
    this.satPreview = {
      lat,
      lng,
      label: asset.siteName || '',
      x: pos.x,
      y: pos.y,
    };
  }

  moveSatPreview(event: MouseEvent) {
    if (!this.satPreview) return;
    const pos = this.satPreviewPos(event);
    this.satPreview = { ...this.satPreview, x: pos.x, y: pos.y };
  }

  private satPreviewPos(event: MouseEvent): { x: number; y: number } {
    const boxW = 270;
    const boxH = 290;
    const gap = 16;
    const rightFits = event.clientX + gap + boxW < window.innerWidth;
    const x = rightFits ? event.clientX + gap : event.clientX - gap - boxW;
    const y = Math.min(
      Math.max(event.clientY - boxH / 2, 4),
      window.innerHeight - boxH - 4,
    );
    return { x, y };
  }

  hideSatPreview() {
    this.satPreview = null;
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
    const asset = this.svc.assets$.value.find((a) => a.siteName === siteName);
    const submitterEmail = asset?.submitterEmail || '';

    this.chatService.getConversation(undefined, undefined, siteName).subscribe({
      next: (conv) => {
        if (conv) {
          this.chatService.openChat(conv);
          this.chatService.sendMessage(username, entry).subscribe({
            error: (err) => console.warn('Could not log to chat', err),
          });
        } else {
          if (!submitterEmail || submitterEmail === username) {
            console.warn(
              'Skipping auto-log chat: no submitter email for site',
              siteName,
            );
            return;
          }
          // No conversation yet — create one with this log entry as the first message
          this.chatService
            .startConversation(
              username,
              submitterEmail,
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
    const siteName = asset.siteName || '';
    this.chatService.readOnly$.next(asset.status === 'rejected');
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

  /** Refresh just the currently focused site — same network call as
   *  populateDevices() under the hood, but the service preserves the
   *  selectedId$ so the reviewer doesn't lose their place. */
  refreshFocusedSite(): void {
    this.svc.populateFromDb(true);
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
      countryCode: a.countryCode,
      reviewer: a.reviewer,
      dateAdded: this.toDateInput(a.dateAdded),
      dateSubmitted: this.toDateInput(a.dateSubmitted),
      status: a.status,
      notes: a.notes,
      submitterEmail: a.submitterEmail,
      submitterName: a.submitterName,
      operatingConfiguration: a.operatingConfiguration ?? '',
      sourceAccessMode: a.sourceAccessMode ?? '',
      evidencePathway: a.evidencePathway ?? '',
      ownershipStatus: a.ownershipStatus ?? 'unverified',
      evidentDeviceId: a.evidentDeviceId ?? '',
      evidentStatus: a.evidentStatus ?? '',
    });
    this.chatService.siteName$.next(a.siteName || null);
  }

  private toDateInput(d: Date | null): string {
    if (!d) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────

  checked: Record<string, boolean> = {};
  bulkBusy = false;

  get checkedIds(): string[] {
    return Object.keys(this.checked).filter((k) => this.checked[k]);
  }

  get checkedCount(): number {
    return this.checkedIds.length;
  }

  toggleCheck(id: string, event: Event): void {
    event.stopPropagation();
    this.checked[id] = !this.checked[id];
  }

  toggleCheckAll(event: Event): void {
    event.stopPropagation();
    // Use the currently visible (filtered) list
    const visible = this.applyFilter(
      this.svc.assets$.value,
      this.searchTerm,
      this.statusFilter,
    );
    const allChecked = visible.every((a) => this.checked[a.id]);
    for (const a of visible) {
      this.checked[a.id] = !allChecked;
    }
  }

  isAllChecked(): boolean {
    const visible = this.applyFilter(
      this.svc.assets$.value,
      this.searchTerm,
      this.statusFilter,
    );
    return visible.length > 0 && visible.every((a) => this.checked[a.id]);
  }

  bulkSetStatus(status: string): void {
    const ids = this.checkedIds
      .map((id) => parseInt(id, 10))
      .filter((n) => !isNaN(n));
    if (!ids.length) return;
    if (!confirm(`Set ${ids.length} device(s) to "${status}"?`)) return;
    this.bulkBusy = true;
    this.svc.bulkUpdateStatus(ids, status).subscribe({
      next: () => {
        // Update local state
        const assets = this.svc.assets$.value.map((a) =>
          this.checked[a.id]
            ? { ...a, status: status as AssetStatus, modifiedDate: new Date() }
            : a,
        );
        this.svc.assets$.next(assets);
        this.checked = {};
        this.bulkBusy = false;
        this.toast(`${ids.length} device(s) set to "${status}"`);
      },
      error: (err: any) => {
        console.error('Bulk status update failed:', err);
        this.bulkBusy = false;
        this.toast('Bulk update failed', 5000);
      },
    });
  }

  bulkScreen(): void {
    const ids = this.checkedIds
      .map((id) => parseInt(id, 10))
      .filter((n) => !isNaN(n));
    if (!ids.length) return;
    if (!confirm(`Run automation on ${ids.length} device(s)? This may take a while.`))
      return;
    this.bulkBusy = true;
    this.svc.bulkAutoScreen(ids).subscribe({
      next: (results: any[]) => {
        // Update badges
        for (const r of results) {
          const asset = this.svc.assets$.value.find(
            (a) => a.id === String(r.deviceId),
          );
          if (asset) {
            asset.lastScreenStatus = r.overallStatus ?? r.error ? 'fail' : null;
            asset.lastScreenedAt = r.timestamp ?? new Date().toISOString();
          }
        }
        this.checked = {};
        this.bulkBusy = false;
        this.cdr.markForCheck();
        const passed = results.filter(
          (r: any) => r.overallStatus === 'pass',
        ).length;
        this.toast(`Screened ${results.length} device(s) — ${passed} passed`);
      },
      error: (err: any) => {
        console.error('Bulk auto-screen failed:', err);
        this.bulkBusy = false;
        this.toast('Bulk screening failed', 5000);
      },
    });
  }

  screenAllUnscreened(): void {
    if (
      !confirm(
        'Run automation on all unscreened pending devices (up to 50)? This may take a while.',
      )
    )
      return;
    this.bulkBusy = true;
    this.svc.bulkAutoScreen().subscribe({
      next: (results: any[]) => {
        for (const r of results) {
          const asset = this.svc.assets$.value.find(
            (a) => a.id === String(r.deviceId),
          );
          if (asset) {
            asset.lastScreenStatus =
              r.overallStatus ?? (r.error ? 'fail' : null);
            asset.lastScreenedAt = r.timestamp ?? new Date().toISOString();
          }
        }
        this.bulkBusy = false;
        this.cdr.markForCheck();
        const passed = results.filter(
          (r: any) => r.overallStatus === 'pass',
        ).length;
        this.toast(`Screened ${results.length} device(s) — ${passed} passed`);
      },
      error: (err: any) => {
        console.error('Screen all failed:', err);
        this.bulkBusy = false;
        this.toast('Screen all failed', 5000);
      },
    });
  }

  exportExcel(): void {
    import('xlsx').then((XLSX) => {
      const assets = this.sortAssets(
        this.applyFilter(
          this.svc.assets$.value,
          this.searchTerm,
          this.statusFilter,
        ),
      );
      const rows = assets.map((a) => ({
        'Site Name': a.siteName,
        Status: a.status,
        'Screen Result': a.lastScreenStatus || '',
        'Screened At': a.lastScreenedAt
          ? new Date(a.lastScreenedAt).toLocaleDateString('en-GB')
          : '',
        Reviewer: a.reviewer || '',
        Submitter: a.submitterEmail || '',
        Country: a.countryCode || '',
        'Capacity (kW)': a.capacity ?? '',
        Latitude: a.lat ?? '',
        Longitude: a.long ?? '',
        'Date Added': a.dateAdded
          ? a.dateAdded.toLocaleDateString('en-GB')
          : '',
        'Date Submitted': a.dateSubmitted
          ? a.dateSubmitted.toLocaleDateString('en-GB')
          : '',
        Modified: a.modifiedDate
          ? a.modifiedDate.toLocaleDateString('en-GB')
          : '',
        Config: a.operatingConfiguration || '',
        Pathway: a.evidencePathway || '',
        Notes: a.notes || '',
        SLD: a.sldUrl ? 'Yes' : '',
        'SF-02': a.sf02Url ? 'Yes' : '',
        'SF-02C': a.sf02cUrl ? 'Yes' : '',
        'Proof of Ownership': a.proofOfOwnershipUrl ? 'Yes' : '',
        'COD Proof': a.codProofUrl ? 'Yes' : '',
        'Metering Evidence': a.meteringEvidenceUrls.length || '',
        Pictures: a.pictureUrls.length || '',
        Screenshots: a.screenshotUrls.length || '',
        'Other Documents': a.otherDocumentUrls.length || '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      // Auto-width columns
      const colWidths = Object.keys(rows[0] || {}).map((key) => ({
        wch: Math.max(
          key.length,
          ...rows.map((r) => String((r as any)[key] ?? '').length),
        ).valueOf(),
      }));
      ws['!cols'] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Device Reviews');
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `device-reviews-${date}.xlsx`);
      this.toast(`Exported ${rows.length} devices`);
    });
  }

  // ── Document Classification ──────────────────────────────────────────────────

  showClassifyModal = false;
  classifyRunning = false;
  classifyTotal = 0;
  classifyCurrentFile: string | null = null;
  private classifyCancelled = false;
  classifyResults: Array<{
    slot: string;
    filename: string;
    url: string;
    expectedType: string;
    classifiedType: string;
    confidence: number;
    match: boolean | null; // null = could not classify
  }> = [];

  private static readonly SLOT_MAP: Array<{
    slot: string;
    label: string;
    expectedType: DocumentType;
    urlKey: keyof Asset;
    multi: boolean;
  }> = [
    {
      slot: 'SLD',
      label: 'Single Line Diagram',
      expectedType: DocumentType.SINGLE_LINE_DIAGRAM,
      urlKey: 'sldUrl',
      multi: false,
    },
    {
      slot: 'SF-02',
      label: 'SF-02 Registration Form',
      expectedType: DocumentType.FORM_SF_02,
      urlKey: 'sf02Url',
      multi: false,
    },
    {
      slot: 'SF-02C',
      label: 'SF-02C Declaration',
      expectedType: DocumentType.SF_02C,
      urlKey: 'sf02cUrl',
      multi: false,
    },
    {
      slot: 'Proof of Own.',
      label: 'Proof of Ownership',
      expectedType: DocumentType.PROOF_OF_OWNERSHIP,
      urlKey: 'proofOfOwnershipUrl',
      multi: false,
    },
    {
      slot: 'COD Proof',
      label: 'COD Proof',
      expectedType: DocumentType.COD_PROOF,
      urlKey: 'codProofUrl',
      multi: false,
    },
    {
      slot: 'Metering',
      label: 'Metering Evidence',
      expectedType: DocumentType.METERING_EVIDENCE,
      urlKey: 'meteringEvidenceUrls',
      multi: true,
    },
    {
      slot: 'Photos',
      label: 'Project Photos',
      expectedType: DocumentType.PROJECT_PHOTOS,
      urlKey: 'pictureUrls',
      multi: true,
    },
    {
      slot: 'Other',
      label: 'Other Documents',
      expectedType: DocumentType.OTHER_DOCUMENTS,
      urlKey: 'otherDocumentUrls',
      multi: true,
    },
  ];

  get classifyMatchCount(): number {
    return this.classifyResults.filter((r) => r.match === true).length;
  }
  get classifyMismatchCount(): number {
    return this.classifyResults.filter((r) => r.match === false).length;
  }
  get classifyUnknownCount(): number {
    return this.classifyResults.filter((r) => r.match === null).length;
  }

  async openClassifyFile(url: string, event: Event): Promise<void> {
    event.stopPropagation();
    if (!url || this.isBroken(url)) return;
    const freshUrl = await this.svc.refreshUrl(url);
    if (/\.(jpe?g|png|gif|webp|bmp|svg)/i.test(url)) {
      this.svc.sldDeviceId$.next(null);
      this.svc.viewPicture(freshUrl, false);
    } else {
      this.svc.sldDeviceId$.next(null);
      this.svc.viewPdf(freshUrl);
    }
  }

  async classifyDocuments(): Promise<void> {
    const asset = this.svc.assets$.value.find((a) => a.id === this.editingId);
    if (!asset) return;

    this.classifyResults = [];
    this.classifyRunning = true;
    this.classifyCancelled = false;
    this.showClassifyModal = true;

    // Count total documents for progress bar
    this.classifyTotal = 0;
    for (const slot of DocumentsWindowComponent.SLOT_MAP) {
      if (slot.multi) {
        this.classifyTotal += ((asset[slot.urlKey] as string[]) || []).length;
      } else if (asset[slot.urlKey]) {
        this.classifyTotal++;
      }
    }
    this.cdr.detectChanges();

    for (const slot of DocumentsWindowComponent.SLOT_MAP) {
      const urls: string[] = [];
      if (slot.multi) {
        urls.push(...((asset[slot.urlKey] as string[]) || []));
      } else {
        const url = asset[slot.urlKey] as string | null;
        if (url) urls.push(url);
      }

      for (const url of urls) {
        if (this.classifyCancelled) break;
        const fname = this.fileName(url);
        try {
          const freshUrl = await this.svc.refreshUrl(url);
          const resp = await fetch(freshUrl);
          const blob = await resp.blob();
          const mime =
            blob.type && blob.type !== 'application/octet-stream'
              ? blob.type
              : this.guessMime(fname);
          const file = new File([blob], fname, { type: mime });

          const result = await this.classifier.classify(file).toPromise();
          const classifiedType = result?.suggestedType ?? null;
          const confidence = result ? Math.round(result.confidence * 100) : 0;
          const typeLabel = classifiedType
            ? DOCUMENT_TYPE_LABELS[classifiedType] || classifiedType
            : 'Unknown';

          this.classifyResults = [
            ...this.classifyResults,
            {
              slot: slot.slot,
              filename: fname,
              url,
              expectedType: slot.label,
              classifiedType: typeLabel,
              confidence,
              match: classifiedType
                ? classifiedType === slot.expectedType ||
                  // Bitmap classified as Project Photos is fine in Other or Photos slot
                  (classifiedType === DocumentType.PROJECT_PHOTOS &&
                    /\.(jpe?g|png|gif|webp|bmp)$/i.test(fname) &&
                    (slot.expectedType === DocumentType.OTHER_DOCUMENTS ||
                      slot.expectedType === DocumentType.PROJECT_PHOTOS)) ||
                  // A facility boundary is a site photo — accept in the Photos slot
                  (classifiedType === DocumentType.FACILITY_BOUNDARY &&
                    slot.expectedType === DocumentType.PROJECT_PHOTOS)
                : null,
            },
          ];
        } catch (err) {
          this.classifyResults = [
            ...this.classifyResults,
            {
              slot: slot.slot,
              filename: fname,
              url,
              expectedType: slot.label,
              classifiedType: 'Error',
              confidence: 0,
              match: null,
            },
          ];
        }
        this.cdr.detectChanges();
      }
      if (this.classifyCancelled) break;
    }

    this.classifyRunning = false;
    this.cdr.detectChanges();
  }

  cancelClassify(): void {
    this.classifyCancelled = true;
    this.classifyRunning = false;
    this.showClassifyModal = false;
    this.classifyResults = [];
  }

  acceptClassify(): void {
    this.showClassifyModal = false;
  }

  private guessMime(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const mimes: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      bmp: 'image/bmp',
      webp: 'image/webp',
      tif: 'image/tiff',
      tiff: 'image/tiff',
    };
    return mimes[ext] || 'application/octet-stream';
  }

  private toast(message: string, duration = 2500): void {
    this.snackBar.open(message, undefined, {
      duration,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
