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
  hint: string;
  /** "Cross check with …" — what a reviewer should compare this field against. */
  compare: string;
}

const OC_ROWS: OcRow[] = [
  { n: 1, item: 'Site Name', hint: 'Display name of the production facility', compare: 'Cross check with: RMS, SLD, Proof of Ownership, OD letter' },
  { n: 2, item: 'Address', hint: 'Street address of the facility', compare: '' },
  { n: 3, item: 'State/Province', hint: 'State, province, or county of the facility', compare: '' },
  { n: 4, item: 'Postcode', hint: 'Postal / ZIP code of the facility', compare: '' },
  { n: 5, item: 'Country', hint: 'Country where the facility is located', compare: 'Cross check with: coordinates' },
  { n: 6, item: 'Latitude', hint: 'Must provide at least six digits after the decimal; must land exactly on a solar panel', compare: 'Cross check with: site photos' },
  { n: 7, item: 'Longitude', hint: 'Must provide at least six digits after the decimal; must land exactly on a solar panel', compare: 'Cross check with: site photos' },
  { n: 8, item: 'Installation Type', hint: 'Rooftop, Ground Mount, or Floating', compare: 'Cross check with: site photos' },
  { n: 9, item: 'Total AC Capacity', hint: 'Maximum AC output of the facility in kW', compare: 'Cross check with: RMS, SLD' },
  { n: 10, item: 'Commissioning Date', hint: 'Date the facility began generating electricity', compare: 'Cross check with: Proof of COD, 1st day of generation data' },
  { n: 11, item: 'Requested Effective Registration Date', hint: 'Please provide the date from which you would like to begin issuing D-RECs for this facility; default is COD.', compare: '' },
  { n: 12, item: 'Default Evident Account Code', hint: 'Please provide the Evident trade account code you would like this facility to issue into', compare: '' },
  { n: 13, item: 'Number of generating units', hint: 'Please provide the number of devices that output useable electricity at this facility (typically the inverters)', compare: 'Cross check with: RMS, SLD' },
  { n: 14, item: 'Meter or Measurement ID(s)', hint: 'Please provide the serial numbers for all devices from which metering evidence will be shared (e.g. inverters, smart meter, etc.).', compare: 'Cross check with: RMS, SLD' },
  { n: 15, item: 'Is this facility connected to the grid?', hint: 'Yes if the facility is connected to a utility grid', compare: 'Cross check with: SLD' },
  { n: 16, item: 'Does this facility export to the grid?', hint: 'No (zero-export), Yes (partial-export), or Yes (full-export)', compare: 'Cross check with: SLD' },
  { n: 17, item: 'Owner of the network to which the Production Device is connected', hint: 'If the facility is grid-connected, please provide the name of the utility or distribution network', compare: 'Cross check with: SLD' },
  { n: 18, item: 'Interconnection voltage', hint: 'If the facility is grid-connected, please provide the interconnection voltage', compare: '' },
  { n: 19, item: 'If this facility is grid-connected, is there a utility or network meter installed at this site?', hint: 'Yes if a utility or network meter is installed at the site', compare: 'Cross check with: SLD' },
  { n: 20, item: 'If yes, can you share the meter reads from the network or utility meter via an official document (e.g. a utility bill or online dashboard)?', hint: 'If "yes", this must be provided as sample metering evidence', compare: 'Cross check with: sample metering evidence' },
  { n: 21, item: 'Please give details of how the site can import electricity by means other than through the meter(s) specified above', hint: 'Describe any import paths outside of the specified meter(s)', compare: 'Cross check with: SLD' },
  { n: 22, item: 'How will you share metering evidence for this site?', hint: 'Will require paragraph explaining what each mode means', compare: 'Cross check with: sample metering evidence' },
  { n: 23, item: 'Is there an on-site (captive) consumer present?', hint: 'Yes if an on-site consumer uses part of the electricity generated', compare: 'Cross check with: Proof of ownership' },
  { n: 24, item: 'Are there any auxiliary or standby energy sources present?', hint: '(typically a backup generator or battery)', compare: 'Cross check with: SLD' },
  { n: 25, item: 'If yes, provide details', hint: 'Describe the number of units, capacity per unit, and fuel source (e.g. 1 x 250kVA diesel generator)', compare: 'Cross check with: SLD' },
  { n: 26, item: 'Is the Registrant also the owner of the Production Facility?', hint: 'Yes if the Registrant is the same legal entity as the PV system owner', compare: 'Cross check with: PV system owner' },
  { n: 27, item: 'PV System Owner', hint: 'Please provide the legal name of the PV System Owner. This must match the "Proof of Ownership" documentation shared.', compare: 'Cross check with: Proof of ownership' },
  { n: 28, item: 'Off-taker Name', hint: 'Please provide the legal name of the electricity off-taker', compare: 'Cross check with: Proof of ownership' },
  { n: 29, item: 'Off-taker Type', hint: 'Education, Health Facility, Residential, Commercial, Industrial, Public Sector, Agriculture, Utility, or Off-Grid Community', compare: '' },
  { n: 30, item: 'Is the Electricity Off-taker part of the same company (or at least 51% part of the same company group) as the PV system owner?', hint: 'Yes if off-taker and owner share the same company group at 51%+', compare: '' },
  { n: 31, item: 'Please give details (including registration id) of any carbon offset or energy tracking scheme for which the Production Facility is registered. State "None" if that is the case', hint: 'Provide registration ID for any other scheme, or "None"', compare: 'If anything other than "None" is specified, registration cannot be approved' },
  { n: 32, item: 'Has the Production Facility ever received public (government) funding (e.g. Feed in Tariff)?', hint: 'Yes if the facility has ever received government funding such as a Feed-in Tariff', compare: '' },
  { n: 33, item: '(if public (government) funding has been received when did/will it finish?)', hint: 'Date the public funding ended or will end', compare: '' },
  { n: 34, item: 'Has this facility ever received any form of subsidy or incentive?', hint: 'Yes if the facility has ever received any subsidy or incentive', compare: '' },
  { n: 35, item: 'If yes, provide details', hint: 'Select all that apply: Net Metering, Feed-in Tariff, Tax Credit, Performance-Based Grant, Other', compare: '' },
  { n: 36, item: 'Do any applicable subsidies or incentives create a claim on the environmental attributes?', hint: 'Yes if the subsidy or incentive claims rights to the environmental attributes (EACs)', compare: '' },
  { n: 37, item: 'Other Labelling Scheme', hint: 'Please choose any other labels for which this site qualifies', compare: 'If more labels are chosen, D-REC to pass on to relevant party' },
  { n: 38, item: 'SDG Benefits', hint: 'Please choose all applicable UN Sustainable Development Goals that this facility is promoting', compare: '' },
  { n: 39, item: 'Impact Story', hint: 'Please provide a brief description of the social and/or environmental impact being created by this facility', compare: '' },
  { n: 40, item: 'Additional Information', hint: "Please provide any additional information that may be relevant to this facility's registration on Evident", compare: '' },
  { n: 41, item: 'Name', hint: 'Full legal name of the signatory', compare: '' },
  { n: 42, item: 'Signature', hint: 'E-signature — captured automatically on submission', compare: '' },
  { n: 43, item: 'Site photos', hint: 'Please provide at least three photos that show the entire installation plus enough surrounding topography to match with a satellite image.', compare: 'Cross check with: coordinates, SLD' },
  { n: 44, item: 'Facility boundary', hint: 'Please provide a satellite image with an outline of the panels drawn over it. This must include all panels (or all relevant topography if the satellite image is date prior to installation).', compare: '' },
  { n: 45, item: 'Single Line Diagram (SLD)', hint: 'Electrical SLD of the facility (PDF or image)', compare: 'Cross check with: site name, total AC capacity, metering point, all serial numbers, grid connection, load, auxiliary/standby energy sources, signature/stamp of facility owner or engineer' },
  { n: 46, item: "Owner's Declaration Letter", hint: "Please provide a signed copy of the attached template on your organization's letterhead. It must match this format, language, and site details exactly, and must include contact information for the person signing.", compare: 'Cross check with: template language, PV system owner, site name, site address, coordinates, total AC capacity, commissioning date' },
  { n: 47, item: 'Proof of Ownership and Rights to Transact', hint: 'Please provide a copy of the contract with the PV system owner such as a PPA or lease agreement that clarifies who owns the facility and who has the legal right to trade the environmental attributes.', compare: 'Cross check with: site name, total AC capacity, location, PV system owner, OD letter' },
  { n: 48, item: 'Proof of Commissioning Date', hint: 'Please provide an official document (such as a handover letter to the offtaker or a commissioning certificate from the utility) that confirms the commissioning date', compare: 'Cross check with: COD, site name, first day of generation data' },
  { n: 49, item: 'Sample metering evidence', hint: 'Please provide a sample of the metering evidence you will rely on for I-REC issuance', compare: 'Cross check with: evidence pathway classification, network meter availability, useable data access mode, site name, SLD, meter/measurement IDs' },
  { n: 50, item: 'Other Documents', hint: "Please provide any other documents that may be relevant to this facility's registration on Evident (e.g. No RPO letter for facilities in India)", compare: '' },
];

@Component({
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  selector: 'app-oc-checklist-panel',
  templateUrl: './oc-checklist-panel.component.html',
  styleUrls: ['./oc-checklist-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OcChecklistPanelComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  /** localStorage key for persisting the checked set. If empty/null, state is session-only. */
  @Input() storageKey: string | null = '';

  rows = OC_ROWS;
  collapsed = false;
  checked = new Set<number>();

  constructor(
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    this.restore();
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
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    this.cdr.markForCheck();
  }

  toggleRow(n: number): void {
    if (this.checked.has(n)) this.checked.delete(n);
    else this.checked.add(n);
    this.persist();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.checked.clear();
    this.persist();
    this.cdr.markForCheck();
  }

  trackRow = (_: number, r: OcRow) => r.n;

  private persist(): void {
    if (!this.storageKey) return;
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify([...this.checked].sort((a, b) => a - b)),
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
      if (Array.isArray(arr)) this.checked = new Set(arr.filter((x) => typeof x === 'number'));
    } catch {
      /* parse error — ignore */
    }
  }
}
