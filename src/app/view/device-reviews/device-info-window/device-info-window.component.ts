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
import { Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { AssetService } from '../asset.service';
import { satellitePreview, SatellitePreview } from '../../map/map.component';
import { environment } from '../../../../environments/environment';

interface Field {
  label: string;
  value: string;
  /** if true, hide when value is empty/falsy */
  hideIfEmpty?: boolean;
  /** mouseover hint (from Operating Checklist tooltips) */
  hint?: string;
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
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceInfoWindowComponent implements OnInit, OnDestroy {
  @Input() zIndex = 350;
  @Output() bringToFront = new EventEmitter<void>();

  deviceInfo: any = null;
  loading = false;
  satPreview: SatellitePreview | null = null;
  search = '';

  private sub: Subscription | null = null;

  constructor(
    private http: HttpClient,
    public svc: AssetService,
    private toastr: ToastrService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.svc.viewDeviceInfoId$.subscribe((id) => {
      if (id == null) {
        this.deviceInfo = null;
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
    this.satPreview = null;
    this.loading = true;
    this.bringToFront.emit();
    this.cdr.markForCheck();
    this.http.get<any>(`${environment.API_URL}device/${deviceId}`).subscribe({
      next: (data) => {
        this.deviceInfo = data;
        this.loading = false;
        const lat = parseFloat(data.latitude);
        const lng = parseFloat(data.longitude);
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

    return [
      {
        heading: 'Registration Fields',
        showSatPreview: true,
        fields: [
          { label: '(1) Site Name', value: fmt(d.siteName) },
          { label: '(2) Address', value: fmt(d.address) },
          { label: '(3) State/Province/County', value: fmt(d.stateProvince), hideIfEmpty: true },
          { label: '(4) Postcode (Zip Code)', value: fmt(d.postcode), hideIfEmpty: true },
          { label: '(5) Country', value: fmt(d.countryCode) },
          { label: '(6) Latitude', value: fmt(d.latitude), hint: 'Must provide at least six digits after the decimal; must land exactly on a solar panel' },
          { label: '(7) Longitude', value: fmt(d.longitude), hint: 'Must provide at least six digits after the decimal; must land exactly on a solar panel' },
        ],
      },
      {
        heading: '',
        fields: [
          { label: '(8) Device Description', value: fmt(d.deviceDescription), hideIfEmpty: true },
          { label: '(10) Commissioning Date', value: fmtDate(d.commissioningDate) },
          { label: '(11) Requested Effective Reg. Date', value: fmt(d.requestedEffectiveRegDate), hideIfEmpty: true, hint: 'Please provide the date from which you would like to begin issuing D-RECs for this facility; default is COD.' },
          { label: '(12) Default Account Code', value: fmt(d.defaultAccountCode), hideIfEmpty: true, hint: 'Please provide the Evident trade account code you would like this facility to issue into' },
          { label: '(13) Number of Generating Units', value: fmt(d.generatingUnitCount), hideIfEmpty: true, hint: 'Please provide the number of devices that output useable electricity at this facility (typically the inverters)' },
          { label: '(14) Meter / Measurement ID(s)', value: fmt(d.meterIds), hideIfEmpty: true, hint: 'Please provide the serial numbers for all devices from which metering evidence will be shared (e.g. inverters, smart meter, etc.).' },
          { label: '(15) Grid Connected', value: fmt(d.isGridConnected), hideIfEmpty: true },
          { label: '(16) Grid Export Type', value: fmt(d.gridExportType), hideIfEmpty: true },
          { label: '(17) Network Owner', value: fmt(d.networkOwner), hideIfEmpty: true, hint: 'If the facility is grid-connected, please provide the name of the utility or distribution network' },
          { label: '(18) Interconnection Voltage', value: fmt(d.interconnectionVoltage), hideIfEmpty: true, hint: 'If the facility is grid-connected, please provide the interconnection voltage' },
          { label: '(19) Network Meter', value: fmt(d.hasNetworkMeter), hideIfEmpty: true },
          { label: '(20) Meter Reads Shareable', value: fmt(d.meterReadsShareable), hideIfEmpty: true, hint: 'If "yes", this must be provided as sample metering evidence' },
          { label: '(21) Non-Meter Import Details', value: fmt(d.nonMeterImportDetails), hideIfEmpty: true },
          { label: '(22) Source Access Mode', value: fmt(d.sourceAccessMode), hideIfEmpty: true, hint: 'Will require paragraph explaining what each mode means' },
          { label: '(23) Captive Consumer', value: fmt(d.hasCaptiveConsumer), hideIfEmpty: true },
          { label: '(24) Auxiliary Energy Sources', value: fmt(d.hasAuxiliaryEnergySources), hideIfEmpty: true, hint: '(typically a backup generator or battery)' },
          { label: '(25) Auxiliary Source Details', value: fmt(d.auxiliaryEnergySourceDetails), hideIfEmpty: true, hint: 'Describe the number of units, capacity per unit, and fuel source (e.g. 1 x 250kVA diesel generator)' },
          { label: '(27) PV System Owner', value: fmt(d.pvSystemOwner), hideIfEmpty: true, hint: 'Please provide the legal name of the PV System Owner. This must match the "Proof of Ownership" documentation shared.' },
          { label: '(28) Off-Taker Name', value: fmt(d.offTakerName), hideIfEmpty: true, hint: 'Please provide the legal name of the electricity off-taker' },
          { label: '(29) Off Takers', value: fmt(d.offTaker) },
          { label: '(30) Off-Taker Same as Owner', value: fmt(d.offTakerSameCompanyAsOwner), hideIfEmpty: true },
          { label: '(31) Other EAC Scheme Registration', value: fmt(d.otherEacSchemeRegistration), hideIfEmpty: true },
          { label: '(32) Public Funding', value: fmt(d.hasPublicFunding), hideIfEmpty: true },
          { label: '(33) Public Funding End Date', value: fmt(d.publicFundingEndDate), hideIfEmpty: true },
          { label: '(34) Subsidy Received', value: fmt(d.hasSubsidy), hideIfEmpty: true },
          { label: '(35) Subsidy Types', value: fmtArr(d.subsidyTypes), hideIfEmpty: true },
          { label: '(35) Subsidy Other Details', value: fmt(d.subsidyOtherDetails), hideIfEmpty: true },
          { label: '(36) Subsidy Claims EACs', value: fmt(d.subsidyClaimsEacs), hideIfEmpty: true },
          { label: '(37) Labelling Scheme', value: fmt(d.labellingSchemeAccreditation), hideIfEmpty: true, hint: 'Please choose any other labels for which this site qualifies' },
          { label: '(38) SDG Benefits', value: fmt(d.SDGBenefits), hint: 'Please choose all applicable UN Sustainable Development Goals that this facility is promoting' },
          { label: '(39) Impact Story', value: fmt(d.impactStory), hideIfEmpty: true, hint: 'Please provide a brief description of the social and/or environmental impact being created by this facility' },
          { label: '(40) Additional Info', value: fmt(d.additionalInfo), hideIfEmpty: true, hint: 'Please provide any additional information that may be relevant to this facility\'s registration on Evident' },
          { label: '(41) Signatory Name', value: fmt(d.signatoryName), hideIfEmpty: true },
        ],
      },
      {
        heading: 'Other',
        fields: [
          { label: 'Serial Number(s)', value: fmt(d.serialNumber) },
          { label: 'Registration Type', value: fmt(d.registrationType), hideIfEmpty: true },
          { label: 'Volume Evidence Type', value: fmt(d.volumeEvidenceType), hideIfEmpty: true },
          { label: 'Verification Agent', value: fmt(d.verificationAgentName), hideIfEmpty: true },
          { label: 'Fuel Code', value: fmt(d.fuelCode) },
          { label: 'Device Type Code', value: fmt(d.deviceTypeCode) },
          { label: 'Data Source', value: fmt(d.dataSource), hideIfEmpty: true },
          { label: 'Other Data Source', value: fmt(d.otherDataSource), hideIfEmpty: true },
          { label: 'Data Source Brand', value: fmt(d.dataSourceBrand), hideIfEmpty: true },
          { label: 'Capacity', value: fmt(d.capacity) },
          { label: 'OnBoarding Date', value: fmtDate(d.createdAt) },
          { label: 'Operating Configuration', value: fmt(d.operatingConfiguration), hideIfEmpty: true },
          { label: 'Grid Interconnection', value: fmt(d.gridInterconnection), hideIfEmpty: true },
          { label: 'Timezone', value: fmt(d.timezone) },
          { label: 'Ownership Status', value: fmt(d.ownershipStatus || 'unverified') },
          { label: 'Public Funding Type', value: fmt(d.publicFundingType), hideIfEmpty: true },
          { label: 'Off-Grid Circumstances', value: fmt(d.offGridCircumstances), hideIfEmpty: true },
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
