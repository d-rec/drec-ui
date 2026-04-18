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
        heading: 'General',
        fields: [
          { label: 'Site Name', value: fmt(d.siteName) },
          { label: 'Serial Number(s)', value: fmt(d.serialNumber) },
          { label: 'Default Account Code', value: fmt(d.defaultAccountCode), hideIfEmpty: true },
          { label: 'Requested Effective Reg. Date', value: fmt(d.requestedEffectiveRegDate), hideIfEmpty: true },
          { label: 'Registration Type', value: fmt(d.registrationType), hideIfEmpty: true },
          { label: 'Volume Evidence Type', value: fmt(d.volumeEvidenceType), hideIfEmpty: true },
          { label: 'Verification Agent', value: fmt(d.verificationAgentName), hideIfEmpty: true },
        ],
      },
      {
        heading: 'Technical Details',
        fields: [
          { label: 'Fuel Code', value: fmt(d.fuelCode) },
          { label: 'Device Type Code', value: fmt(d.deviceTypeCode) },
          { label: 'Capacity', value: fmt(d.capacity) },
          { label: 'AC Capacity', value: fmt(d.acCapacity), hideIfEmpty: true },
          { label: 'Commissioning Date', value: fmtDate(d.commissioningDate) },
          { label: 'OnBoarding Date', value: fmtDate(d.createdAt) },
          { label: 'Operating Configuration', value: fmt(d.operatingConfiguration), hideIfEmpty: true },
          { label: 'Source Access Mode', value: fmt(d.sourceAccessMode), hideIfEmpty: true },
        ],
      },
      {
        heading: 'Facility Technical',
        fields: [
          { label: 'Meter / Measurement ID(s)', value: fmt(d.meterIds), hideIfEmpty: true },
          { label: 'Number of Generating Units', value: fmt(d.generatingUnitCount), hideIfEmpty: true },
          { label: 'Network Owner', value: fmt(d.networkOwner), hideIfEmpty: true },
          { label: 'Interconnection Voltage', value: fmt(d.interconnectionVoltage), hideIfEmpty: true },
        ],
      },
      {
        heading: 'Location',
        showSatPreview: true,
        fields: [
          { label: 'Address', value: fmt(d.address) },
          { label: 'State/Province/County', value: fmt(d.stateProvince), hideIfEmpty: true },
          { label: 'Postcode (Zip Code)', value: fmt(d.postcode), hideIfEmpty: true },
          { label: 'Country', value: fmt(d.countryCode) },
          { label: 'Timezone', value: fmt(d.timezone) },
          { label: 'Latitude', value: fmt(d.latitude) },
          { label: 'Longitude', value: fmt(d.longitude) },
        ],
      },
      {
        heading: 'Ownership & Incentives',
        fields: [
          { label: 'Ownership Status', value: fmt(d.ownershipStatus || 'unverified') },
          { label: 'PV System Owner', value: fmt(d.pvSystemOwner), hideIfEmpty: true },
          { label: 'Off-Taker Name', value: fmt(d.offTakerName), hideIfEmpty: true },
          { label: 'Off-Taker Same as Owner', value: fmt(d.offTakerSameCompanyAsOwner), hideIfEmpty: true },
          { label: 'Subsidy Received', value: fmt(d.hasSubsidy), hideIfEmpty: true },
          { label: 'Subsidy Types', value: fmtArr(d.subsidyTypes), hideIfEmpty: true },
          { label: 'Subsidy Other Details', value: fmt(d.subsidyOtherDetails), hideIfEmpty: true },
          { label: 'Subsidy Claims EACs', value: fmt(d.subsidyClaimsEacs), hideIfEmpty: true },
          { label: 'Public Funding', value: fmt(d.hasPublicFunding), hideIfEmpty: true },
          { label: 'Public Funding End Date', value: fmt(d.publicFundingEndDate), hideIfEmpty: true },
          { label: 'Public Funding Type', value: fmt(d.publicFundingType), hideIfEmpty: true },
        ],
      },
      {
        heading: 'Evident',
        fields: [
          { label: 'Evident Device ID', value: fmt(d.evidentDeviceId || '—') },
          { label: 'Evident Status', value: fmt(d.evidentStatus || '—') },
        ],
      },
      {
        heading: 'Business Details',
        fields: [
          { label: 'Captive Consumer', value: fmt(d.hasCaptiveConsumer), hideIfEmpty: true },
          { label: 'Auxiliary Energy Sources', value: fmt(d.hasAuxiliaryEnergySources), hideIfEmpty: true },
          { label: 'Auxiliary Source Details', value: fmt(d.auxiliaryEnergySourceDetails), hideIfEmpty: true },
          { label: 'Non-Meter Import Details', value: fmt(d.nonMeterImportDetails), hideIfEmpty: true },
          { label: 'Other EAC Scheme Registration', value: fmt(d.otherEacSchemeRegistration), hideIfEmpty: true },
          { label: 'Additional Info', value: fmt(d.additionalInfo), hideIfEmpty: true },
          { label: 'Labelling Scheme', value: fmt(d.labellingSchemeAccreditation), hideIfEmpty: true },
          { label: 'Off-Grid Circumstances', value: fmt(d.offGridCircumstances), hideIfEmpty: true },
        ],
      },
      {
        heading: 'Classification & Impact',
        fields: [
          { label: 'Off Takers', value: fmt(d.offTaker) },
          { label: 'SDG Benefits', value: fmt(d.SDGBenefits) },
          { label: 'Energy Storage', value: fmt(d.energyStorage) },
          { label: 'Energy Storage Capacity', value: fmt(d.energyStorageCapacity) },
          { label: 'Version', value: fmt(d.version) },
          { label: 'Yield Value', value: fmt(d.yieldValue) },
          { label: 'Meter Read Type', value: fmt(d.meterReadtype) },
          { label: 'Device Description', value: fmt(d.deviceDescription), hideIfEmpty: true },
        ],
      },
    ];
  }

  trackSection = (_: number, s: Section) => s.heading;
  trackField = (_: number, f: Field) => f.label;
}
