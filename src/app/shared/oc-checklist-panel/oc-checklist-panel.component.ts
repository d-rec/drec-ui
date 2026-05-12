import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';

interface OcRow {
  n: number;
  item: string;
  /** "Cross check with …" — what a reviewer should compare this field against. Empty string = no cross-check necessary. */
  compare: string;
  /** Optional sub-checklist. Each string becomes its own checkable child row. */
  subItems?: string[];
  /** Form-field key on the device for OC# rows that map 1:1 to a
   *  registration field. Drives provenance-based row tinting. */
  field?: string;
}

const OC_ROWS: OcRow[] = [
  {
    n: 1,
    item: 'Site Name',
    compare: 'Cross check with: RMS, SLD, Proof of Ownership, OD letter',
    field: 'siteName',
  },
  { n: 2, item: 'Address', compare: '', field: 'address' },
  { n: 3, item: 'State/Province', compare: 'Cross check with: coordinates', field: 'stateProvince' },
  { n: 4, item: 'Postcode', compare: '', field: 'postcode' },
  { n: 5, item: 'Country', compare: 'Cross check with: coordinates', field: 'countryCodename' },
  { n: 6, item: 'Latitude', compare: 'Cross check with: site photos', field: 'latitude' },
  { n: 7, item: 'Longitude', compare: 'Cross check with: site photos', field: 'longitude' },
  { n: 8, item: 'Installation Type', compare: 'Cross check with: site photos', field: 'deviceDescription' },
  { n: 9, item: 'Total AC Capacity', compare: 'Cross check with: RMS, SLD', field: 'capacity' },
  {
    n: 10,
    item: 'Commissioning Date',
    compare: 'Cross check with: Proof of COD, 1st day of generation data',
    field: 'commissioningDate',
  },
  { n: 11, item: 'Requested Effective Registration Date', compare: '', field: 'requestedEffectiveRegDate' },
  { n: 12, item: 'Default Evident Account Code', compare: '', field: 'defaultAccountCode' },
  {
    n: 13,
    item: 'Number of generating units',
    compare: 'Cross check with: RMS, SLD',
    field: 'generatingUnitCount',
  },
  {
    n: 14,
    item: 'Meter or Measurement ID(s)',
    compare: 'Cross check with: RMS, SLD',
    field: 'serialNumber',
  },
  {
    n: 15,
    item: 'Is this facility connected to the grid?',
    compare: 'Cross check with: SLD',
    field: 'gridInterconnection',
  },
  {
    n: 16,
    item: 'Does this facility export to the grid?',
    compare: 'Cross check with: SLD',
    field: 'gridExportType',
  },
  {
    n: 17,
    item: 'Owner of the network to which the Production Device is connected',
    compare: 'Cross check with: SLD',
    field: 'networkOwner',
  },
  { n: 18, item: 'Interconnection voltage', compare: '', field: 'interconnectionVoltage' },
  {
    n: 19,
    item: 'If this facility is grid-connected, is there a utility or network meter installed at this site?',
    compare: 'Cross check with: SLD',
    field: 'hasNetworkMeter',
  },
  {
    n: 20,
    item: 'If yes, can you share the meter reads from the network or utility meter via an official document (e.g. a utility bill or online dashboard)?',
    compare: 'Cross check with: sample metering evidence',
    field: 'meterReadsShareable',
  },
  {
    n: 21,
    item: 'Please give details of how the site can import electricity by means other than through the meter(s) specified above',
    compare: 'Cross check with: SLD',
    field: 'nonMeterImportDetails',
  },
  {
    n: 22,
    item: 'How will you share metering evidence for this site?',
    compare: 'Cross check with: sample metering evidence',
    field: 'sourceAccessMode',
  },
  {
    n: 23,
    item: 'Is there an on-site (captive) consumer present?',
    compare: 'Cross check with: Proof of ownership',
    field: 'hasCaptiveConsumer',
  },
  {
    n: 24,
    item: 'Are there any auxiliary or standby energy sources present?',
    compare: 'Cross check with: SLD',
    field: 'hasAuxiliaryEnergySources',
  },
  { n: 25, item: 'If yes, provide details', compare: 'Cross check with: SLD', field: 'auxiliaryEnergySourceDetails' },
  {
    n: 26,
    item: 'Is the Registrant also the owner of the Production Facility?',
    compare: 'Cross check with: PV system owner',
  },
  {
    n: 27,
    item: 'PV System Owner',
    compare: 'Cross check with: Proof of ownership',
    field: 'pvSystemOwner',
  },
  {
    n: 28,
    item: 'Off-taker Name',
    compare: 'Cross check with: Proof of ownership',
    field: 'offTakerName',
  },
  { n: 29, item: 'Off-taker Type', compare: '', field: 'offTaker' },
  {
    n: 30,
    item: 'Is the Electricity Off-taker part of the same company (or at least 51% part of the same company group) as the PV system owner?',
    compare: '',
    field: 'offTakerSameCompanyAsOwner',
  },
  {
    n: 31,
    item: 'Please give details (including registration id) of any carbon offset or energy tracking scheme for which the Production Facility is registered. State "None" if that is the case',
    compare:
      'If anything other than "None" is specified, registration cannot be approved',
    field: 'otherEacSchemeRegistration',
  },
  {
    n: 32,
    item: 'Has the Production Facility ever received public (government) funding (e.g. Feed in Tariff)?',
    compare: '',
    field: 'hasPublicFunding',
  },
  {
    n: 33,
    item: 'If public (government) funding has been received when did/will it finish?',
    compare: '',
    field: 'publicFundingEndDate',
  },
  {
    n: 34,
    item: 'Has this facility ever received any form of subsidy or incentive?',
    compare: '"Yes" means individual senior review required',
    field: 'hasSubsidy',
  },
  {
    n: 35,
    item: 'If yes, provide details',
    compare: 'All items mean individual senior review required',
    field: 'subsidyTypes',
  },
  {
    n: 36,
    item: 'Do any applicable subsidies or incentives create a claim on the environmental attributes?',
    compare: '"Yes" means facility cannot be approved',
    field: 'subsidyClaimsEacs',
  },
  {
    n: 37,
    item: 'Other Labelling Scheme',
    compare: 'If more labels are chosen, D-REC to pass on to relevant party',
    field: 'labellingSchemeAccreditation',
  },
  { n: 38, item: 'SDG Benefits', compare: '', field: 'SDGBenefits' },
  { n: 39, item: 'Impact Story', compare: '', field: 'impactStory' },
  {
    n: 40,
    item: 'Additional Information',
    compare: 'Individual review may be required depending on response',
    field: 'additionalInfo',
  },
  { n: 41, item: 'Name', compare: '', field: 'signatoryName' },
  { n: 42, item: 'Signature', compare: '' },
  { n: 43, item: 'Site photos', compare: 'Cross check with: coordinates, SLD' },
  {
    n: 44,
    item: 'Facility boundary',
    compare: 'Cross check with: site photos, capacity',
  },
  {
    n: 45,
    item: 'Single Line Diagram (SLD)',
    compare: 'Cross check with each item below',
    subItems: [
      'site name',
      'total AC capacity',
      'metering point',
      'all serial numbers',
      'grid connection',
      'load',
      'auxiliary/standby energy sources',
      'signature/stamp of facility owner or engineer',
    ],
  },
  {
    n: 46,
    item: "Owner's Declaration Letter",
    compare:
      'Cross check with: template language, PV system owner, site name, site address, coordinates, total AC capacity, commissioning date',
  },
  {
    n: 47,
    item: 'Proof of Ownership and Rights to Transact',
    compare:
      'Cross check with: PV system owner, Offtaker, OD letter, RE attributes',
  },
  {
    n: 48,
    item: 'Proof of Commissioning Date',
    compare: 'Cross check with: COD, site name, first day of generation data',
  },
  {
    n: 49,
    item: 'Sample metering evidence',
    compare:
      'Cross check with: grid-status, export status, network meter availability, useable data access mode, site name, SLD, meter/measurement IDs',
  },
  {
    n: 50,
    item: 'Other Documents',
    compare: 'Individual review may be required depending on response',
  },
];

@Component({
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  selector: 'app-oc-checklist-panel',
  templateUrl: './oc-checklist-panel.component.html',
  styleUrls: ['./oc-checklist-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcChecklistPanelComponent
  implements OnInit, OnChanges, AfterViewInit, OnDestroy
{
  /** localStorage key for persisting the checked set. If empty/null, state is session-only. */
  @Input() storageKey: string | null = '';

  /** Per-field provenance from the device the reviewer is looking at.
   *  Each row whose `.field` is present here gets a green tint
   *  (platform-derived). Rows whose `.field` is set but missing from
   *  this map are tinted grey (manually entered by the registrant).
   *  Rows without a `.field` mapping render normally — they're
   *  document checklist items, not form fields. */
  @Input() fieldProvenance: Record<
    string,
    { source: string; confidence: number; at: string }
  > | null = null;

  /** Compute the row's tint bucket. Used by the template to apply
   *  a CSS modifier class. */
  rowStatus(r: OcRow): 'doc-backed' | 'manual' | 'na' {
    if (!r.field) return 'na';
    if (this.fieldProvenance && this.fieldProvenance[r.field]) {
      return 'doc-backed';
    }
    return 'manual';
  }

  /** Human-readable source for the tooltip on green rows. */
  provenanceSource(r: OcRow): string | null {
    if (!r.field || !this.fieldProvenance) return null;
    return this.fieldProvenance[r.field]?.source ?? null;
  }

  rows = OC_ROWS;
  collapsed = this.loadCollapsedPref();
  /** Checked item keys — top-level OC# as its numeric string (e.g. "45"), sub-items as "45.0", "45.1", … */
  checked = new Set<string>();
  /** When true, hide rows that have neither a cross-check nor sub-items. */
  hideNoCrosscheck = this.loadHidePref();
  /** Free-text filter matching item name, cross-check hint, and sub-item labels. */
  filter = '';
  private static readonly HIDE_PREF_KEY = 'oc-checklist:hide-no-crosscheck';
  private static readonly COLLAPSED_PREF_KEY = 'oc-checklist:collapsed';

  constructor(
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    this.restore();
    this.applyReserve();
  }

  /** Tab is 18px; tab + 340px panel = 358px when expanded. The page reads
   *  this var to keep its right edge inside the OCP, so the table's
   *  scrollbar stays clickable. */
  private applyReserve(): void {
    document.documentElement.style.setProperty(
      '--ocp-reserve',
      this.collapsed ? '18px' : '358px',
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['storageKey'] && !changes['storageKey'].firstChange) {
      this.restore();
      this.cdr.markForCheck();
    }
  }

  ngAfterViewInit(): void {
    // Portal to body to escape the mat-sidenav-container stacking context (z-index:0)
    const host = this.elementRef.nativeElement;
    if (host.parentNode !== document.body) {
      document.body.appendChild(host);
    }
  }

  ngOnDestroy(): void {
    const host = this.elementRef.nativeElement;
    host.parentNode?.removeChild(host);
    document.documentElement.style.removeProperty('--ocp-reserve');
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    try {
      localStorage.setItem(
        OcChecklistPanelComponent.COLLAPSED_PREF_KEY,
        this.collapsed ? '1' : '0',
      );
    } catch {
      /* noop */
    }
    this.applyReserve();
    this.cdr.markForCheck();
  }

  /** Default collapsed; only opens on this device if the reviewer
   *  has explicitly opened it at least once. */
  private loadCollapsedPref(): boolean {
    try {
      return (
        localStorage.getItem(OcChecklistPanelComponent.COLLAPSED_PREF_KEY) !==
        '0'
      );
    } catch {
      return true;
    }
  }

  toggleRow(key: string): void {
    if (this.checked.has(key)) this.checked.delete(key);
    else this.checked.add(key);
    this.persist();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.checked.clear();
    this.persist();
    this.cdr.markForCheck();
  }

  get visibleRows(): OcRow[] {
    if (!this.hideNoCrosscheck) return this.rows;
    return this.rows.filter(
      (r) => r.compare || (r.subItems && r.subItems.length > 0),
    );
  }

  private get filterQuery(): string {
    return this.filter.trim().toLowerCase();
  }

  isMatch(r: OcRow): boolean {
    const q = this.filterQuery;
    if (!q) return false;
    return (
      r.item.toLowerCase().includes(q) ||
      r.compare.toLowerCase().includes(q) ||
      (r.subItems?.some((s) => s.toLowerCase().includes(q)) ?? false)
    );
  }

  isSubMatch(s: string): boolean {
    const q = this.filterQuery;
    return !!q && s.toLowerCase().includes(q);
  }

  matchCount(): number {
    const q = this.filterQuery;
    if (!q) return 0;
    return this.visibleRows.filter((r) => this.isMatch(r)).length;
  }

  onFilterInput(ev: Event): void {
    this.filter = (ev.target as HTMLInputElement).value;
    this.cdr.markForCheck();
  }

  clearFilter(): void {
    this.filter = '';
    this.cdr.markForCheck();
  }

  toggleHideNoCrosscheck(): void {
    this.hideNoCrosscheck = !this.hideNoCrosscheck;
    try {
      localStorage.setItem(
        OcChecklistPanelComponent.HIDE_PREF_KEY,
        this.hideNoCrosscheck ? '1' : '0',
      );
    } catch {
      /* noop */
    }
    this.cdr.markForCheck();
  }

  private loadHidePref(): boolean {
    try {
      return (
        localStorage.getItem(OcChecklistPanelComponent.HIDE_PREF_KEY) === '1'
      );
    } catch {
      return false;
    }
  }

  /** Parent row visual state: checked if explicitly ticked, OR all sub-items ticked. */
  isRowComplete(r: OcRow): boolean {
    if (r.subItems && r.subItems.length > 0) {
      return r.subItems.every((_, i) => this.checked.has(`${r.n}.${i}`));
    }
    return this.checked.has(String(r.n));
  }

  /** Total leaf-level count for the "X/Y" header. Sub-items count individually. */
  totalLeaves(): number {
    return this.rows.reduce(
      (acc, r) => acc + (r.subItems?.length ? r.subItems.length : 1),
      0,
    );
  }

  checkedLeaves(): number {
    return this.rows.reduce((acc, r) => {
      if (r.subItems?.length) {
        return (
          acc +
          r.subItems.filter((_, i) => this.checked.has(`${r.n}.${i}`)).length
        );
      }
      return acc + (this.checked.has(String(r.n)) ? 1 : 0);
    }, 0);
  }

  trackRow = (_: number, r: OcRow) => r.n;
  trackSub = (i: number) => i;

  private persist(): void {
    if (!this.storageKey) return;
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify([...this.checked].sort()),
      );
    } catch {
      /* quota/unavailable — ignore */
    }
  }

  private restore(): void {
    if (!this.storageKey) {
      this.checked = new Set();
      return;
    }
    try {
      const raw = localStorage.getItem(this.storageKey);
      this.checked = new Set();
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        // Coerce any legacy numeric entries to strings so new keys ("45.0") work too
        this.checked = new Set(arr.map((x) => String(x)));
      }
    } catch {
      /* parse error — ignore */
    }
  }
}
