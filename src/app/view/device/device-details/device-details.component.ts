import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
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
    this.deviceService.GetDevicesInfo(this.id).subscribe({
      next: (data: Device) => {
        if (data) {
          this.loading = false;
          this.device_details = data;
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

  copyToClipboard() {
    const el = this.reportContent?.nativeElement;
    if (!el) return;
    const text = el.innerText;
    navigator.clipboard.writeText(text).then(() => {
      this.toastrService.success('Copied to clipboard');
    });
  }
}
