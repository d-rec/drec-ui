import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Asset } from '../asset.model';
import { AssetService } from '../asset.service';

interface ChipMapping {
  ocNum: number;
  label: string;
  registrantValue: string;
}

interface DocItem {
  id: string;
  name: string;
  filename: string;
  category: 'site' | 'ownership' | 'metering' | 'photos';
  badge: string;
  size: string;
  isImage: boolean;
  isFacilityBoundary: boolean;
  ocrText?: string;
  chips: ChipMapping[];
  /** Signed URL from the API. Empty for docs that don't exist on this device. */
  url?: string;
  /**
   * Cached SafeResourceUrl wrapping `url`. Cached at doc-build time
   * because the sanitizer returns a new object on every call —
   * computing it from the template would re-bind the iframe src every
   * change-detection cycle and cause re-mount/blink.
   */
  trustedUrl?: SafeResourceUrl;
}

type OcStatus = 'confirmed' | 'pending' | 'discrepancy';

interface OcRow {
  num: number;
  label: string;
  value: string;
  status: OcStatus;
  comment: string;
  // which docs have ticked this row
  tickedBy: string[];
}

@Component({
  standalone: false,
  selector: 'app-reviewer-workbench',
  templateUrl: './reviewer-workbench.component.html',
  styleUrls: ['./reviewer-workbench.component.scss'],
})
export class ReviewerWorkbenchComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  @ViewChildren('ocRow') ocRowElements!: QueryList<ElementRef<HTMLElement>>;

  deviceId = '';
  siteName = 'OMC Power · Bilgram, IN';
  externalId = 'eeb568c3';

  // -- doc list --
  docs: DocItem[] = [
    {
      id: 'sld',
      name: 'Single Line Diagram',
      filename: 'sld_omc_bilgram_2024.pdf',
      category: 'site',
      badge: 'SLD',
      size: '2.1 MB',
      isImage: false,
      isFacilityBoundary: false,
      ocrText:
        'Single Line Diagram — Bilgram MG\nSite: Bilgram, Hardoi, Uttar Pradesh, IN\nOperator: OMC Power Pvt. Ltd.\nCapacity (DC): 27.5 kWp\nCapacity (AC): 25 kW\nInverter: SMA Sunny Tripower 25-3SE\nModules: 50 × Trina Vertex S 550 W\nGrid interconnection: Behind-the-meter, no export\nMeter ID: SMA-2025-08137\nCOD: 2024-03-12',
      chips: [
        { ocNum: 9, label: 'Capacity', registrantValue: '25 kW' },
        {
          ocNum: 11,
          label: 'Inverter make/model',
          registrantValue: 'SMA Sunny Tripower 25',
        },
        {
          ocNum: 13,
          label: 'Module make/model',
          registrantValue: 'Trina Vertex S 550 W',
        },
        { ocNum: 14, label: 'Meter ID', registrantValue: 'SMA-2025-08137' },
        {
          ocNum: 15,
          label: 'Grid interconnection',
          registrantValue: 'true (behind-the-meter)',
        },
        { ocNum: 16, label: 'Grid export type', registrantValue: 'none' },
        { ocNum: 24, label: 'Auxiliary energy sources', registrantValue: 'No' },
      ],
    },
    {
      id: 'nameplate',
      name: 'Nameplate photo',
      filename: 'nameplate_inverter.jpg',
      category: 'site',
      badge: 'JPG',
      size: '1.8 MB',
      isImage: true,
      isFacilityBoundary: false,
      chips: [
        { ocNum: 9, label: 'Capacity', registrantValue: '25 kW' },
        {
          ocNum: 11,
          label: 'Inverter make/model',
          registrantValue: 'SMA Sunny Tripower 25',
        },
      ],
    },
    {
      id: 'cod',
      name: 'COD proof',
      filename: 'cod_letter_2024.pdf',
      category: 'site',
      badge: 'COD_PROOF',
      size: '820 KB',
      isImage: false,
      isFacilityBoundary: false,
      chips: [
        {
          ocNum: 8,
          label: 'Commercial operation date',
          registrantValue: '2024-03-12',
        },
      ],
    },
    {
      id: 'boundary',
      name: 'Facility boundary',
      filename: 'satellite_view_q4.png',
      category: 'site',
      badge: 'SAT',
      size: '4.2 MB',
      isImage: true,
      isFacilityBoundary: true,
      chips: [
        {
          ocNum: 3,
          label: 'Site coordinates',
          registrantValue: '27.18, 80.45',
        },
        { ocNum: 44, label: 'Facility boundary', registrantValue: 'uploaded' },
      ],
    },
    {
      id: 'ownership',
      name: 'Ownership declaration',
      filename: 'ownership_decl.pdf',
      category: 'ownership',
      badge: 'PDF',
      size: '1.3 MB',
      isImage: false,
      isFacilityBoundary: false,
      chips: [
        {
          ocNum: 47,
          label: 'PV system owner',
          registrantValue: 'OMC Power Pvt. Ltd.',
        },
        { ocNum: 1, label: 'Operator name', registrantValue: 'OMC Power' },
      ],
    },
    {
      id: 'odletter',
      name: 'OD letter (off-taker)',
      filename: 'od_letter_offtaker.pdf',
      category: 'ownership',
      badge: 'OD_LETTER',
      size: '980 KB',
      isImage: false,
      isFacilityBoundary: false,
      chips: [
        { ocNum: 23, label: 'Captive consumer', registrantValue: 'Yes' },
        {
          ocNum: 47,
          label: 'PV system owner',
          registrantValue: 'OMC Power Pvt. Ltd.',
        },
        { ocNum: 46, label: 'OD letter upload', registrantValue: 'present' },
      ],
    },
    {
      id: 'metering',
      name: 'Meter reading log Q4',
      filename: 'meter_log_q4_2024.csv',
      category: 'metering',
      badge: 'METERING_EVIDENCE',
      size: '340 KB',
      isImage: false,
      isFacilityBoundary: false,
      chips: [
        { ocNum: 14, label: 'Meter ID', registrantValue: 'SMA-2025-08137' },
        {
          ocNum: 49,
          label: 'Metering evidence',
          registrantValue: 'Q4 2024 log',
        },
      ],
    },
    {
      id: 'photo1',
      name: 'Rooftop array — N view',
      filename: 'rooftop_n.jpg',
      category: 'photos',
      badge: 'JPG · GPS',
      size: '3.6 MB',
      isImage: true,
      isFacilityBoundary: false,
      chips: [
        {
          ocNum: 3,
          label: 'Site coordinates',
          registrantValue: '27.18, 80.45',
        },
        { ocNum: 44, label: 'Facility boundary', registrantValue: 'uploaded' },
      ],
    },
    {
      id: 'photo2',
      name: 'Rooftop array — S view',
      filename: 'rooftop_s.jpg',
      category: 'photos',
      badge: 'JPG · GPS',
      size: '3.4 MB',
      isImage: true,
      isFacilityBoundary: false,
      chips: [
        {
          ocNum: 3,
          label: 'Site coordinates',
          registrantValue: '27.18, 80.45',
        },
        {
          ocNum: 13,
          label: 'Module make/model',
          registrantValue: 'Trina Vertex S 550 W',
        },
      ],
    },
  ];

  selectedDocId = 'sld';
  ocrOpen = false;
  satOverlayOpen = false;

  // -- OC# state --
  ocRows: OcRow[] = [
    {
      num: 1,
      label: 'Operator name',
      value: 'OMC Power',
      status: 'confirmed',
      comment: '',
      tickedBy: ['ownership'],
    },
    {
      num: 3,
      label: 'Site coordinates',
      value: '27.180, 80.448',
      status: 'confirmed',
      comment: '',
      tickedBy: ['boundary', 'photo1'],
    },
    {
      num: 5,
      label: 'Country',
      value: 'IND',
      status: 'confirmed',
      comment: '',
      tickedBy: ['sld'],
    },
    {
      num: 8,
      label: 'Commercial operation date',
      value: '2024-03-12',
      status: 'confirmed',
      comment: '',
      tickedBy: ['cod'],
    },
    {
      num: 9,
      label: 'Capacity',
      value: '25 kW',
      status: 'confirmed',
      comment: '',
      tickedBy: ['sld'],
    },
    {
      num: 10,
      label: 'DC vs AC capacity',
      value: '27.5 / 25',
      status: 'pending',
      comment: '',
      tickedBy: [],
    },
    {
      num: 11,
      label: 'Inverter',
      value: 'SMA STP 25-3SE',
      status: 'confirmed',
      comment: '',
      tickedBy: ['sld'],
    },
    {
      num: 13,
      label: 'Module',
      value: 'Trina Vertex S 550W',
      status: 'confirmed',
      comment: '',
      tickedBy: ['sld'],
    },
    {
      num: 14,
      label: 'Meter / serial IDs',
      value: 'SMA-2025-08137',
      status: 'confirmed',
      comment: '',
      tickedBy: ['sld'],
    },
    {
      num: 15,
      label: 'Grid interconnection',
      value: 'true',
      status: 'confirmed',
      comment: '',
      tickedBy: ['sld'],
    },
    {
      num: 16,
      label: 'Grid export type',
      value: 'none',
      status: 'pending',
      comment: '',
      tickedBy: [],
    },
    {
      num: 22,
      label: 'Operating configuration',
      value: 'GridNoExport',
      status: 'pending',
      comment: '',
      tickedBy: [],
    },
    {
      num: 23,
      label: 'Captive consumer',
      value: 'Yes',
      status: 'discrepancy',
      comment:
        "OD letter says 'on-site only', SLD shows local-load topology — consistent",
      tickedBy: [],
    },
    {
      num: 24,
      label: 'Aux energy sources',
      value: 'No',
      status: 'confirmed',
      comment: '',
      tickedBy: [],
    },
    {
      num: 26,
      label: 'Submitter status',
      value: 'Operator',
      status: 'pending',
      comment: '',
      tickedBy: [],
    },
    {
      num: 33,
      label: 'Public funding end',
      value: '—',
      status: 'confirmed',
      comment: '',
      tickedBy: [],
    },
    {
      num: 34,
      label: 'Subsidy received',
      value: 'No',
      status: 'confirmed',
      comment: '',
      tickedBy: [],
    },
    {
      num: 35,
      label: 'Subsidy types',
      value: '—',
      status: 'pending',
      comment: '',
      tickedBy: [],
    },
    {
      num: 37,
      label: 'Labelling scheme',
      value: 'D-REC',
      status: 'pending',
      comment: '',
      tickedBy: [],
    },
    {
      num: 42,
      label: 'Signature',
      value: '—',
      status: 'pending',
      comment: '',
      tickedBy: [],
    },
    {
      num: 44,
      label: 'Facility boundary',
      value: 'uploaded',
      status: 'pending',
      comment: '',
      tickedBy: [],
    },
    {
      num: 46,
      label: 'OD letter upload',
      value: 'present',
      status: 'pending',
      comment: '',
      tickedBy: [],
    },
    {
      num: 47,
      label: 'PV system owner',
      value: 'OMC Power',
      status: 'discrepancy',
      comment:
        "ownership decl says 'OMC Power Pvt Ltd', OD letter says 'OMC Power Inc' — likely typo",
      tickedBy: [],
    },
    {
      num: 49,
      label: 'Metering evidence',
      value: 'Q4 2024 log',
      status: 'pending',
      comment: '',
      tickedBy: [],
    },
    {
      num: 50,
      label: 'Off-grid circumstances',
      value: 'n/a',
      status: 'pending',
      comment: '',
      tickedBy: [],
    },
  ];

  filterMode: 'all' | 'commented' | 'unticked' = 'all';

  /** Set true once the device's real data has replaced the fixture. */
  private hydrated = false;
  private assetSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private host: ElementRef<HTMLElement>,
    private svc: AssetService,
    private sanitizer: DomSanitizer,
  ) {}

  trustUrl(url: string | undefined): SafeResourceUrl | null {
    if (!url) return null;
    // Signed URLs come from our own backend's S3 presigner — trusted source.
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  exit(): void {
    this.router.navigate(['/device/reviews']);
  }

  ngOnInit() {
    this.deviceId = this.route.snapshot.paramMap.get('id') || 'demo';
    // Full-bleed: portal the host element to <body> so it escapes the
    // mat-sidenav-container stacking context (z-index alone doesn't escape
    // it — see the drec-ui stacking-context note in shared dev memory).
    document.body.appendChild(this.host.nativeElement);

    // Hydrate from real device data — once. assets$ is a BehaviorSubject
    // so it emits the current value immediately AND again when populateFromDb
    // resolves; without the guard we'd swap pdf-preview's input multiple
    // times and Chrome would open a new tab per iframe re-render of an
    // attachment-disposition signed URL.
    this.assetSub = this.svc.assets$.subscribe((assets) => {
      if (this.hydrated) return;
      const asset = assets.find((a) => String(a.id) === String(this.deviceId));
      if (asset) this.hydrateFromAsset(asset);
    });
    if (!this.svc.assets$.value.length) {
      this.svc.populateFromDb();
    }
  }

  private hydrateFromAsset(a: Asset): void {
    this.hydrated = true;
    this.siteName = `${a.siteName}${a.countryCode ? ' · ' + a.countryCode : ''}`;
    this.externalId = a.serial || String(a.id);
    this.docs = this.buildDocsFromAsset(a);
    if (
      this.docs.length &&
      !this.docs.some((d) => d.id === this.selectedDocId)
    ) {
      this.selectedDocId = this.docs[0].id;
    }
  }

  /** Map the device's signed URLs to the workbench's DocItem shape. */
  private buildDocsFromAsset(a: Asset): DocItem[] {
    const docs: DocItem[] = [];
    const fileBase = (url: string) =>
      decodeURIComponent(url.split('?')[0].split('/').pop() || 'file');
    const isImage = (url: string) =>
      /\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(url);
    const push = (
      id: string,
      url: string,
      name: string,
      badge: string,
      category: DocItem['category'],
      isFacilityBoundary = false,
    ) => {
      docs.push({
        id,
        name,
        filename: fileBase(url),
        category,
        badge,
        size: '',
        isImage: isImage(url),
        isFacilityBoundary,
        chips: this.chipsForDocId(id),
        url,
        trustedUrl: this.sanitizer.bypassSecurityTrustResourceUrl(url),
      });
    };
    if (a.sldUrl) push('sld', a.sldUrl, 'Single Line Diagram', 'SLD', 'site');
    if (a.sf02Url) push('sf02', a.sf02Url, 'Form SF-02', 'SF02', 'ownership');
    if (a.sf02cUrl)
      push('sf02c', a.sf02cUrl, 'Form SF-02C', 'SF02C', 'ownership');
    if (a.sf02cOwnersDeclarationUrl)
      push(
        'sf02c-od',
        a.sf02cOwnersDeclarationUrl,
        "Owner's Declaration",
        'OD',
        'ownership',
      );
    if (a.codProofUrl)
      push('cod', a.codProofUrl, 'COD proof', 'COD_PROOF', 'site');
    a.meteringEvidenceUrls.forEach((u, i) =>
      push(`metering-${i}`, u, `Metering evidence ${i + 1}`, 'METER', 'metering'),
    );
    a.pictureUrls.forEach((u, i) =>
      push(`photo-${i}`, u, `Site photo ${i + 1}`, 'PHOTO', 'photos'),
    );
    return docs;
  }

  /**
   * OC# items each evidence-doc-id evidences. Mirrors the demo-stub
   * mapping so the chip rail isn't empty after real-data hydration.
   * Registrant value is sourced from the matching ocRow when present
   * so chip text stays in sync with whatever the registrant submitted.
   *
   * SF-02 and SF-02C mappings are best-guess pending Paul B's
   * authoritative form-field disposition (see project memory note
   * project_oc_checklist_mapping.md).
   */
  private chipsForDocId(id: string): ChipMapping[] {
    const ocNumsByDoc: Record<string, { ocNum: number; label: string }[]> = {
      sld: [
        { ocNum: 9, label: 'Capacity' },
        { ocNum: 11, label: 'Inverter make/model' },
        { ocNum: 13, label: 'Module make/model' },
        { ocNum: 14, label: 'Meter ID' },
        { ocNum: 15, label: 'Grid interconnection' },
        { ocNum: 16, label: 'Grid export type' },
        { ocNum: 24, label: 'Auxiliary energy sources' },
      ],
      sf02: [
        { ocNum: 1, label: 'Operator name' },
        { ocNum: 3, label: 'Site coordinates' },
        { ocNum: 5, label: 'Country' },
        { ocNum: 8, label: 'Commercial operation date' },
      ],
      sf02c: [
        { ocNum: 23, label: 'Captive consumer' },
        { ocNum: 47, label: 'PV system owner' },
      ],
      'sf02c-od': [
        { ocNum: 23, label: 'Captive consumer' },
        { ocNum: 46, label: 'OD letter upload' },
        { ocNum: 47, label: 'PV system owner' },
      ],
      cod: [{ ocNum: 8, label: 'Commercial operation date' }],
    };
    let preset = ocNumsByDoc[id];
    if (!preset) {
      if (id.startsWith('metering-')) {
        preset = [
          { ocNum: 14, label: 'Meter ID' },
          { ocNum: 49, label: 'Metering evidence' },
        ];
      } else if (id.startsWith('photo-')) {
        preset = [
          { ocNum: 3, label: 'Site coordinates' },
          { ocNum: 44, label: 'Facility boundary' },
        ];
      } else {
        return [];
      }
    }
    return preset.map((p) => ({
      ocNum: p.ocNum,
      label: p.label,
      registrantValue:
        this.ocRows.find((r) => r.num === p.ocNum)?.value || '—',
    }));
  }

  ngAfterViewInit() {
    // no-op for now; scroll target lookup happens in toggleChip()
  }

  ngOnDestroy() {
    // Restore normal layout when leaving the workbench.
    this.host.nativeElement.remove();
    this.assetSub?.unsubscribe();
  }

  download(): void {
    const doc = this.selectedDoc;
    if (!doc?.url) return;
    window.open(doc.url, '_blank', 'noopener');
  }

  get selectedDoc(): DocItem | undefined {
    return this.docs.find((d) => d.id === this.selectedDocId);
  }

  selectDoc(id: string) {
    this.selectedDocId = id;
    this.ocrOpen = false;
  }

  isChipTicked(chip: ChipMapping): boolean {
    const row = this.ocRows.find((r) => r.num === chip.ocNum);
    return !!row?.tickedBy.includes(this.selectedDocId);
  }

  toggleChip(chip: ChipMapping) {
    const row = this.ocRows.find((r) => r.num === chip.ocNum);
    if (!row) return;
    const idx = row.tickedBy.indexOf(this.selectedDocId);
    if (idx >= 0) {
      row.tickedBy.splice(idx, 1);
    } else {
      row.tickedBy.push(this.selectedDocId);
    }
    // recompute status: confirmed if any doc ticks it, pending if none + no comment, discrepancy preserved
    if (row.status !== 'discrepancy') {
      row.status = row.tickedBy.length > 0 ? 'confirmed' : 'pending';
    }
    this.scrollOcRowIntoView(row.num);
  }

  private scrollOcRowIntoView(num: number) {
    if (!this.ocRowElements) return;
    // The QueryList renders only the *filtered* rows, so we look up by data-attr
    setTimeout(() => {
      const el = this.ocRowElements.find(
        (e) => e.nativeElement.dataset['ocNum'] === String(num),
      );
      if (el) {
        el.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        el.nativeElement.classList.add('rw__oc-row--flash');
        setTimeout(
          () => el.nativeElement.classList.remove('rw__oc-row--flash'),
          1200,
        );
      }
    }, 0);
  }

  onCommentChange(row: OcRow, value: string) {
    row.comment = value;
  }

  get docCategoryGroups(): { label: string; docs: DocItem[] }[] {
    const groups = [
      { key: 'site' as const, label: 'Site & identification' },
      { key: 'ownership' as const, label: 'Ownership & funding' },
      { key: 'metering' as const, label: 'Metering' },
      { key: 'photos' as const, label: 'Site photos' },
    ];
    return groups
      .map((g) => ({
        label: g.label,
        docs: this.docs.filter((d) => d.category === g.key),
      }))
      .filter((g) => g.docs.length > 0);
  }

  get filteredOcRows(): OcRow[] {
    if (this.filterMode === 'commented')
      return this.ocRows.filter((r) => r.comment.trim().length > 0);
    if (this.filterMode === 'unticked')
      return this.ocRows.filter((r) => r.tickedBy.length === 0);
    return this.ocRows;
  }

  get progress() {
    const confirmed = this.ocRows.filter(
      (r) => r.status === 'confirmed',
    ).length;
    const discrepancies = this.ocRows.filter(
      (r) => r.status === 'discrepancy',
    ).length;
    const pending = this.ocRows.filter((r) => r.status === 'pending').length;
    const total = this.ocRows.length;
    return {
      confirmed,
      discrepancies,
      pending,
      total,
      percent: total > 0 ? Math.round((confirmed / total) * 100) : 0,
      filterAll: total,
      filterCommented: this.ocRows.filter((r) => r.comment.trim().length > 0)
        .length,
      filterUnticked: this.ocRows.filter((r) => r.tickedBy.length === 0).length,
    };
  }

  hasChipsForDoc(d: DocItem): boolean {
    return d.chips.length > 0;
  }

  isFullyChecked(d: DocItem): boolean {
    if (d.chips.length === 0) return false;
    return d.chips.every((c) => {
      const row = this.ocRows.find((r) => r.num === c.ocNum);
      return !!row?.tickedBy.includes(d.id);
    });
  }

  toggleOcr() {
    this.ocrOpen = !this.ocrOpen;
  }

  onSubmit() {
    alert('Submit review — wire up next pass');
  }

  onReject() {
    alert('Reject for re-submission — wire up next pass');
  }
}
