import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DeviceService } from '../../../auth/services/device.service';
import { AuthbaseService } from '../../../auth/authbase.service';
import {
  Device,
  CountryInfo,
  fulecodeType,
  devicecodeType,
} from '../../../models';
import { ToastrService } from 'ngx-toastr';
import { satellitePreview, SatellitePreview } from '../../map/map.component';
@Component({
  standalone: false,
  selector: 'app-device-details',
  templateUrl: './device-details.component.html',
  styleUrls: ['./device-details.component.scss'],
})
export class DeviceDetailsComponent {
  @ViewChild('reportContent') reportContent: ElementRef;
  form: FormGroup;
  id: number;
  device_details: any = {};
  satPreview: SatellitePreview | null = null;
  countrylist: CountryInfo[] = [];
  fuellist: fulecodeType[] = [];
  devicetypelist: devicecodeType[] = [];
  documents: {
    type: string;
    url: string;
    id: number;
    label: string | null;
    originalFilename: string | null;
  }[] = [];
  loading: boolean = true;
  value = 0;
  viewoptionfrom: string;
  constructor(
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) data: { deviceid: number },
    public dialogRef: MatDialogRef<DeviceDetailsComponent>,
    private deviceService: DeviceService,
    private authService: AuthbaseService,
    private toastrService: ToastrService,
  ) {
    this.id = data.deviceid;
  }
  name: any;
  ngOnInit(): void {
    forkJoin({
      fuellist: this.authService.GetMethod('device/fuel-type'),
      devicetypelist: this.authService.GetMethod('device/device-type'),
      countrylist: this.authService.GetMethod('countrycode/list'),
    }).subscribe(({ fuellist, devicetypelist, countrylist }: any) => {
      this.fuellist = fuellist;
      this.devicetypelist = devicetypelist;
      this.countrylist = countrylist;
      this.getdeviceinfo();
    });
  }
  getdeviceinfo() {
    forkJoin({
      device: this.deviceService.GetDevicesInfo(this.id),
      documents: this.deviceService.getDocuments(this.id).pipe(
        catchError((err) => {
          console.error('[device-details] getDocuments failed', err);
          return of([] as typeof this.documents);
        }),
      ),
    }).subscribe({
      next: ({ device, documents }) => {
        if (device) {
          this.loading = false;
          this.device_details = device;
          this.documents = documents ?? [];
          console.log('[device-details] documents loaded for id=' + this.id + ':', this.documents);
          this.name = this.device_details.externalId;

          this.device_details['fuelname'] = this.fuellist.find(
            (fuelType) => fuelType.code === this.device_details.fuelCode,
          )?.name;

          this.device_details['devicetypename'] = this.devicetypelist.find(
            (devicetype) =>
              devicetype.code == this.device_details.deviceTypeCode,
          )?.name;

          this.device_details['countryname'] = this.countrylist.find(
            (countrycode) =>
              countrycode.alpha3 == this.device_details.countryCode,
          )?.country;

          const lat = parseFloat(this.device_details.latitude);
          const lng = parseFloat(this.device_details.longitude);
          if (!isNaN(lat) && !isNaN(lng)) {
            this.satPreview = satellitePreview(lat, lng, 19);
          }
        }
      },
      error: (err) => {
        const msg = err?.error?.message ?? err?.message ?? 'Unknown error';
        this.toastrService.error(msg, 'Data info not Found');
        console.error('GetDevicesInfo failed', err);
      },
    });
  }

  docsOf(type: string) {
    return this.documents.filter((d) => d.type === type);
  }

  docLinkLabel(d: { label: string | null; originalFilename: string | null; id: number }): string {
    return d.label || d.originalFilename || `File ${d.id}`;
  }

  splitSerials(joined: string | null | undefined): string[] {
    if (!joined) return [];
    return String(joined).split(/\s*;\s*/).filter(Boolean);
  }

  /**
   * Open the document in a new tab. window.open is called synchronously inside
   * the user-gesture handler so popup blockers don't swallow it; the signed
   * URL cached at dialog-open time is used directly (15-min TTL is plenty for
   * normal review flows — if a URL does expire, the new tab shows an S3 403
   * and the reviewer just re-opens the dialog).
   */
  openDocLink(docId: number, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const cached = this.documents.find((d) => d.id === docId);
    if (!cached?.url) {
      this.toastrService.warning('Signed URL unavailable — try reopening the dialog');
      return;
    }
    window.open(cached.url, '_blank', 'noopener');
  }

  copyToClipboard() {
    const el = this.reportContent?.nativeElement;
    if (!el) return;
    const text = el.innerText;
    navigator.clipboard.writeText(text).then(() => {
      this.toastrService.success('Copied to clipboard');
    });
  }
}
