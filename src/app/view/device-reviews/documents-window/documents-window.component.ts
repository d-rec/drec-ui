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

  generatingSf02: Record<string, boolean> = {};
  showSf02Preview = false;
  sf02PreviewLoading = false;
  sf02PreviewItem: Asset | null = null;
  sf02PreviewFields: Array<{ label: string; value: string }> = [];
  sf02PreviewDocs: Array<{
    type: string;
    present: boolean;
    required: boolean;
  }> = [];

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
      | 'sf02cOwnersDeclaration'
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
    configuredYield: number;
    capacityKw: number;
    yieldMismatch: boolean;
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
  ) {}

  trustUrl(url: string): SafeUrl {
    // nosemgrep: angular-bypasssecuritytrust -- url comes from backend S3 presigned URLs, not user input
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
          this.sectionOpen[id] = {
            codProof: true,
            sld: true,
            sf02: true,
            sf02c: true,
            sf02cOwnersDeclaration: true,
            meteringEvidence: true,
            pictures: true,
            screenshots: true,
            otherDocuments: true,
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
          a.sf02cOwnersDeclarationUrl,
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
    this.saveStatusFilter();
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
        sf02cOwnersDeclaration: true,
        meteringEvidence: true,
        pictures: true,
        screenshots: true,
        otherDocuments: true,
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
      | 'sf02cOwnersDeclaration'
      | 'meteringEvidence'
      | 'pictures'
      | 'screenshots'
      | 'otherDocuments',
  ): void {
    if (!this.sectionOpen[id]) {
      this.sectionOpen[id] = {
        codProof: true,
        sld: true,
        sf02: true,
        sf02c: true,
        sf02cOwnersDeclaration: true,
        meteringEvidence: true,
        pictures: true,
        screenshots: true,
        otherDocuments: true,
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
      | 'sf02cOwnersDeclaration'
      | 'meteringEvidence'
      | 'pictures'
      | 'screenshots'
      | 'otherDocuments',
  ): boolean {
    return this.sectionOpen[id]?.[section] ?? true;
  }

  // ── SF-02 generation ─────────────────────────────────────────────────────────

  generateSf02(item: Asset, event: Event): void {
    event.stopPropagation();
    this.sf02PreviewItem = item;
    this.sf02PreviewLoading = true;
    this.sf02PreviewFields = [];
    this.sf02PreviewDocs = [];
    this.showSf02Preview = true;
    this.cdr.markForCheck();

    this.svc.previewSf02(parseInt(item.id, 10)).subscribe({
      next: (res) => {
        this.sf02PreviewFields = res.fields;
        this.sf02PreviewDocs = res.documents;
        this.sf02PreviewLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.showSf02Preview = false;
        this.sf02PreviewItem = null;
        this.sf02PreviewLoading = false;
        this.toastr.error(
          err?.error?.message || err?.message || 'unknown error',
          'Failed to load SF-02 preview',
        );
        this.cdr.markForCheck();
      },
    });
  }

  confirmSf02Generation(): void {
    const item = this.sf02PreviewItem;
    if (!item) return;
    this.showSf02Preview = false;
    this.generatingSf02[item.id] = true;
    this.cdr.markForCheck();

    this.svc.generateSf02(parseInt(item.id, 10)).subscribe({
      next: (res) => {
        item.sf02Url = res.url;
        this.svc.saveAsset(item);
        this.generatingSf02[item.id] = false;
        this.sf02PreviewItem = null;
        this.snackBar.open('SF-02 registration form generated', '', {
          duration: 3000,
        });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.generatingSf02[item.id] = false;
        this.sf02PreviewItem = null;
        this.toastr.error(
          err?.error?.message || err?.message || 'unknown error',
          'SF-02 generation failed',
        );
        this.cdr.markForCheck();
      },
    });
  }

  get sf02MissingRequired(): boolean {
    return this.sf02PreviewDocs.some((d) => !d.present && d.required);
  }

  cancelSf02Generation(): void {
    this.showSf02Preview = false;
    this.sf02PreviewItem = null;
  }

  generateSf02ForSelected(event: Event): void {
    if (!this.editingId) return;
    const item = this.svc.assets$.value.find((a) => a.id === this.editingId);
    if (item) this.generateSf02(item, event);
  }

  // ── File handling ─────────────────────────────────────────────────────────────

  async openFile(
    url: string,
    event: Event,
    isSld = false,
    enableOcr = false,
  ): Promise<void> {
    event.stopPropagation();
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
    this.uploadAndRefresh(asset, 'SF_02C_OWNERS_DECLARATION', file);
  }

  clearSf02cOwnersDeclaration(asset: Asset): void {
    this.requestDelete(
      asset,
      'sf02cOwnersDeclaration',
      'sf02cOwnersDeclarationUrl',
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
      if (a.sf02cOwnersDeclarationUrl) urls.push(a.sf02cOwnersDeclarationUrl);
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
      const ctrl = new AbortController();
      fetch(url, { method: 'GET', mode: 'cors', signal: ctrl.signal }).then(
        (res) => {
          ctrl.abort();
          if (!res.ok) this.markBroken(url);
        },
        (err) => {
          if (err?.name === 'AbortError') return;
          this.markBroken(url);
        },
      );
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
        if (res.yieldMismatch) {
          const asset = this.svc.assets$.value.find(
            (a) => a.id === this.editingId,
          );
          if (asset) {
            this.logChatEntry(
              asset.siteName,
              `_Production ceiling check: configured yield (${res.configuredYield} kWh/kW/yr) exceeds the location-based estimate (${res.irradiance?.yieldHigh} kWh/kW/yr). Please verify or correct the yield value._`,
            );
          }
        }
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

  copyAutoScreenReport(): void {
    if (!this.autoScreenResult) return;
    const r = this.autoScreenResult;
    const lines: string[] = [];
    lines.push(`Auto-Screen Report`);
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
        console.error('Auto-screen failed:', err);
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
      sf02cOwnersDeclaration: "Owner's Declaration",
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
    if (!confirm(`Auto-screen ${ids.length} device(s)? This may take a while.`))
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
        'Auto-screen all unscreened pending devices (up to 50)? This may take a while.',
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
        "Owner's Declaration": a.sf02cOwnersDeclarationUrl ? 'Yes' : '',
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

  private toast(message: string, duration = 2500): void {
    this.snackBar.open(message, undefined, {
      duration,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
