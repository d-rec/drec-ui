import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { forkJoin, Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { AssetService } from '../asset.service';
import { satellitePreview, SatellitePreview } from '../../map/map.component';
import { environment } from '../../../../environments/environment';
import { CountryNamePipe } from '../country-name.pipe';

interface Field {
  label: string;
  value: string;
  /** if true, hide when value is empty/falsy */
  hideIfEmpty?: boolean;
  /** mouseover hint (from Operating Checklist tooltips) */
  hint?: string;
  /** when present, render as clickable links (opens each in a new tab) */
  links?: { url: string; text: string }[];
}

interface Section {
  heading: string;
  fields: Field[];
  /** section has a satellite preview rendered after its fields */
  showSatPreview?: boolean;
}

@Component({
  standalone: false,
  selector: 'app-ds-device-info-window',
  templateUrl: './device-info-window.component.html',
  styleUrls: ['./device-info-window.component.scss'],
  providers: [DatePipe, CountryNamePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceInfoWindowComponent implements OnInit, OnDestroy {
  @Input() zIndex = 350;
  @Output() bringToFront = new EventEmitter<void>();

  deviceInfo: any = null;
  documents: {
    type: string;
    url: string;
    id: number;
    label?: string | null;
    originalFilename?: string | null;
  }[] = [];
  loading = false;
  satPreview: SatellitePreview | null = null;
  search = '';

  private sub: Subscription | null = null;

  constructor(
    private http: HttpClient,
    public svc: AssetService,
    private toastr: ToastrService,
    private datePipe: DatePipe,
    private countryNamePipe: CountryNamePipe,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.svc.viewDeviceInfoId$.subscribe((id) => {
      if (id == null) {
        this.deviceInfo = null;
        this.documents = [];
        this.satPreview = null;
        this.loading = false;
        this.search = '';
        this.cdr.markForCheck();
        return;
      }
      this.load(id);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  close(): void {
    this.svc.viewDeviceInfo(null);
  }

  private load(deviceId: number): void {
    this.deviceInfo = null;
    this.documents = [];
    this.satPreview = null;
    this.loading = true;
    this.bringToFront.emit();
    this.cdr.markForCheck();
    forkJoin({
      device: this.http.get<any>(`${environment.API_URL}device/${deviceId}`),
      documents: this.http.get<{ type: string; url: string; id: number }[]>(
        `${environment.API_URL}device/${deviceId}/documents`,
      ),
    }).subscribe({
      next: ({ device, documents }) => {
        this.deviceInfo = device;
        this.documents = documents ?? [];
        this.loading = false;
        const lat = parseFloat(device.latitude);
        const lng = parseFloat(device.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          this.satPreview = satellitePreview(lat, lng, 19);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        const msg =
          err?.error?.message || err?.statusText || err?.message || 'Unknown error';
        this.toastr.error(`Failed to load device details: ${msg}`);
        this.svc.viewDeviceInfo(null);
      },
    });
  }

  copyVisible(): void {
    const lines: string[] = [];
    for (const sec of this.filteredSections) {
      lines.push(sec.heading);
      for (const f of sec.fields) lines.push(`${f.label}: ${f.value}`);
      lines.push('');
    }
    navigator.clipboard
      .writeText(lines.join('\n').trim())
      .then(() => this.toastr.success('Copied to clipboard'));
  }

  get filteredSections(): Section[] {
    const q = this.search.trim().toLowerCase();
    const match = (f: Field) =>
      !q ||
      f.label.toLowerCase().includes(q) ||
      f.value.toLowerCase().includes(q);

    const sections = this.buildSections();
    return sections
      .map((sec) => ({
        ...sec,
        fields: sec.fields.filter((f) => !(f.hideIfEmpty && !f.value) && match(f)),
      }))
      .filter((sec) => {
        if (sec.fields.length > 0) return true;
        // keep Location section visible (for sat preview) if heading matches and no search
        return false;
      });
  }

  private buildSections(): Section[] {
    const d = this.deviceInfo;
    if (!d) return [];

    const fmt = (v: any): string => (v == null || v === '' ? '' : String(v));
    const fmtDate = (v: any): string =>
      v ? this.datePipe.transform(v, 'dd MMM y') || '' : '';
    const fmtArr = (v: any): string =>
      Array.isArray(v) && v.length ? v.join(', ') : '';
    const docCount = (type: string): number =>
      this.documents.filter((doc) => doc.type === type).length;
    const fmtDocs = (type: string): string => {
      const n = docCount(type);
      return n === 0 ? '—' : n === 1 ? '1 file' : `${n} files`;
    };
    const linksFor = (type: string) =>
      this.documents
        .filter((d) => d.type === type)
        .map((d) => ({
          url: d.url,
          text: d.label || d.originalFilename || `File ${d.id}`,
        }));

    return [
      {
        heading: 'Registration Fields',
        showSatPreview: true,
        fields: [
          { label: '(1) Site Name', value: fmt(d.siteName) },
          { label: '(2) Address', value: fmt(d.address) },
          { label: '(3) State/Province/County', value: fmt(d.stateProvince) || '—' },
          { label: '(4) Postcode (Zip Code)', value: fmt(d.postcode) || '—' },
          { label: '(5) Country', value: this.countryNamePipe.transform(d.countryCode) || fmt(d.countryCode) },
          { label: '(6) Latitude', value: fmt(d.latitude), hint: 'Must provide at least six digits after the decimal; must land exactly on a solar panel' },
          { label: '(7) Longitude', value: fmt(d.longitude), hint: 'Must provide at least six digits after the decimal; must land exactly on a solar panel' },
        ],
      },
      {
        heading: '',
        fields: [
          { label: '(8) Device Description', value: fmt(d.deviceDescription) },
          { label: '(9) Capacity', value: fmt(d.capacity) },
          { label: '(10) Commissioning Date', value: fmtDate(d.commissioningDate) },
          { label: '(11) Requested Effective Reg. Date', value: fmt(d.requestedEffectiveRegDate), hint: 'Please provide the date from which you would like to begin issuing D-RECs for this facility; default is COD.' },
          { label: '(12) Default Account Code', value: fmt(d.defaultAccountCode), hint: 'Please provide the Evident trade account code you would like this facility to issue into' },
          { label: '(13) Number of Generating Units', value: fmt(d.generatingUnitCount), hint: 'Please provide the number of devices that output useable electricity at this facility (typically the inverters)' },
          {
            label: '(14) Meter or Measurement ID(s)',
            value: d.serialNumber
              ? String(d.serialNumber)
                  .split(/\s*;\s*/)
                  .filter(Boolean)
                  .map((s: string, i: number) => `${i + 1}. ${s}`)
                  .join('  ·  ')
              : '',
            hint: 'Serial numbers for all devices from which metering evidence will be shared (e.g. inverters, smart meter, etc.).',
          },
          { label: '(15) Grid Connected', value: d.gridInterconnection == null ? '—' : d.gridInterconnection ? 'Yes' : 'No' },
          { label: '(16) Grid Export Type', value: fmt(d.gridExportType) },
          { label: '(17) Network Owner', value: fmt(d.networkOwner), hint: 'If the facility is grid-connected, please provide the name of the utility or distribution network' },
          { label: '(18) Interconnection Voltage', value: fmt(d.interconnectionVoltage), hint: 'If the facility is grid-connected, please provide the interconnection voltage' },
          { label: '(19) Network Meter', value: fmt(d.hasNetworkMeter) },
          { label: '(20) Meter Reads Shareable', value: fmt(d.meterReadsShareable), hint: 'If "yes", this must be provided as sample metering evidence' },
          { label: '(21) Non-Meter Import Details', value: fmt(d.nonMeterImportDetails) },
          { label: '(22) Source Access Mode', value: fmt(d.sourceAccessMode), hint: 'Will require paragraph explaining what each mode means' },
          { label: '(23) Captive Consumer', value: fmt(d.hasCaptiveConsumer) },
          { label: '(24) Auxiliary Energy Sources', value: fmt(d.hasAuxiliaryEnergySources), hint: '(typically a backup generator or battery)' },
          { label: '(25) Auxiliary Source Details', value: fmt(d.auxiliaryEnergySourceDetails), hint: 'Describe the number of units, capacity per unit, and fuel source (e.g. 1 x 250kVA diesel generator)' },
          {
            label: '(26) Submitter Status',
            value:
              d.pvSystemOwner && d.organization?.name
                ? d.pvSystemOwner.trim().toLowerCase() === d.organization.name.trim().toLowerCase()
                  ? 'Registrant IS the production-facility owner'
                  : 'Registrant is NOT the production-facility owner'
                : '—',
            hint: 'Derived by comparing PV System Owner to the registrant organization name',
          },
          { label: '(27) PV System Owner', value: fmt(d.pvSystemOwner), hint: 'Please provide the legal name of the PV System Owner. This must match the "Proof of Ownership" documentation shared.' },
          { label: '(28) Off-Taker Name', value: fmt(d.offTakerName), hint: 'Please provide the legal name of the electricity off-taker' },
          { label: '(29) Off Takers', value: fmt(d.offTaker) },
          { label: '(30) Off-Taker Same as Owner', value: fmt(d.offTakerSameCompanyAsOwner) },
          { label: '(31) Other EAC Scheme Registration', value: fmt(d.otherEacSchemeRegistration) },
          { label: '(32) Public Funding', value: fmt(d.hasPublicFunding) },
          { label: '(33) Public Funding End Date', value: fmt(d.publicFundingEndDate) },
          { label: '(34) Subsidy Received', value: fmt(d.hasSubsidy) },
          { label: '(35) Subsidy Types', value: fmtArr(d.subsidyTypes) },
          { label: '(35) Subsidy Other Details', value: fmt(d.subsidyOtherDetails) },
          { label: '(36) Subsidy Claims EACs', value: fmt(d.subsidyClaimsEacs) },
          { label: '(37) Labelling Scheme', value: fmt(d.labellingSchemeAccreditation), hint: 'Please choose any other labels for which this site qualifies' },
          { label: '(38) SDG Benefits', value: fmt(d.SDGBenefits), hint: 'Please choose all applicable UN Sustainable Development Goals that this facility is promoting' },
          { label: '(39) Impact Story', value: fmt(d.impactStory), hint: 'Please provide a brief description of the social and/or environmental impact being created by this facility' },
          { label: '(40) Additional Info', value: fmt(d.additionalInfo), hint: 'Please provide any additional information that may be relevant to this facility\'s registration on Evident' },
          { label: '(41) Signatory Name', value: fmt(d.signatoryName) },
          {
            label: '(42) Signature',
            value: d.eSignatureSignedAt
              ? `Signed ${fmtDate(d.eSignatureSignedAt)}${d.eSignatureSignerEmail ? ' by ' + d.eSignatureSignerEmail : ''}`
              : '—',
            hint: 'Captured automatically on submission (e-signature log)',
          },
        ],
      },
      {
        heading: 'Documents',
        fields: [
          { label: '(43) Project Photos', value: fmtDocs('PROJECT_PHOTOS'), links: linksFor('PROJECT_PHOTOS'), hint: 'At least three photos showing the full installation and surrounding topography' },
          { label: '(44) Facility Boundary', value: fmtDocs('FACILITY_BOUNDARY'), links: linksFor('FACILITY_BOUNDARY'), hint: 'Satellite image with facility boundary outlined' },
          { label: '(45) Single Line Diagram', value: fmtDocs('SINGLE_LINE_DIAGRAM'), links: linksFor('SINGLE_LINE_DIAGRAM') },
          { label: '(46) SF-02c (Owner\'s Declaration)', value: fmtDocs('SF_02C'), links: linksFor('SF_02C') },
          { label: '(47) Proof of Ownership', value: fmtDocs('SF_02C_OWNERS_DECLARATION'), links: linksFor('SF_02C_OWNERS_DECLARATION') },
          { label: '(48) COD Proof', value: fmtDocs('COD_PROOF'), links: linksFor('COD_PROOF'), hint: 'Handover letter or commissioning certificate confirming the commissioning date' },
          { label: '(49) Metering Evidence', value: fmtDocs('METERING_EVIDENCE'), links: linksFor('METERING_EVIDENCE'), hint: 'Sample metering evidence relied on for I-REC issuance' },
          { label: '(50) Other Documents', value: fmtDocs('OTHER_DOCUMENTS'), links: linksFor('OTHER_DOCUMENTS'), hint: 'e.g. No RPO letter for facilities in India' },
        ],
      },
      {
        heading: 'Other',
        fields: [
          { label: 'Registration Type', value: fmt(d.registrationType) },
          { label: 'Volume Evidence Type', value: fmt(d.volumeEvidenceType) },
          { label: 'Verification Agent', value: fmt(d.verificationAgentName) },
          { label: 'Fuel Code', value: fmt(d.fuelCode) },
          { label: 'Device Type Code', value: fmt(d.deviceTypeCode) },
          { label: 'Data Source', value: fmt(d.dataSource) },
          { label: 'Other Data Source', value: fmt(d.otherDataSource) },
          { label: 'Data Source Brand', value: fmt(d.dataSourceBrand) },
          { label: 'OnBoarding Date', value: fmtDate(d.createdAt) },
          { label: 'Operating Configuration', value: fmt(d.operatingConfiguration) },
          { label: 'Timezone', value: fmt(d.timezone) },
          { label: 'Ownership Status', value: fmt(d.ownershipStatus || 'unverified') },
          { label: 'Public Funding Type', value: fmt(d.publicFundingType) },
          { label: 'Off-Grid Circumstances', value: fmt(d.offGridCircumstances) },
          { label: 'Version', value: fmt(d.version) },
          { label: 'Yield Value', value: fmt(d.yieldValue) },
          { label: 'Meter Read Type', value: fmt(d.meterReadtype) },
        ],
      },
      {
        heading: 'Evident',
        fields: [
          { label: 'Evident Device ID', value: fmt(d.evidentDeviceId || '—') },
          { label: 'Evident Status', value: fmt(d.evidentStatus || '—') },
        ],
      },
    ];
  }

  trackSection = (_: number, s: Section) => s.heading;
  trackField = (_: number, f: Field) => f.label;
}
