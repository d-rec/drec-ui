import { Component, Inject } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DeviceService } from '../../../auth/services/device.service';
import { AuthbaseService } from '../../../auth/authbase.service';
import {
  Device,
  CountryInfo,
  fulecodeType,
  devicecodeType,
} from '../../../models';
import { ToastrService } from 'ngx-toastr';
@Component({
  selector: 'app-device-details',
  templateUrl: './device-details.component.html',
  styleUrls: ['./device-details.component.scss'],
})
export class DeviceDetailsComponent {
  form: FormGroup;
  id: number;
  device_details: any = {};
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

    this.authService.GetMethod('device/fuel-type').subscribe((data1: any) => {
      this.fuellist = data1;
    });
    this.authService.GetMethod('device/device-type').subscribe((data2: any) => {
      this.devicetypelist = data2;
    });
  }
  name: any;
  ngOnInit(): void {
    this.authService.GetMethod('countrycode/list').subscribe((data3: any) => {
      this.countrylist = data3;
    });
    setTimeout(() => {
      this.getdeviceinfo();
    }, 1200);
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
        }
      },
      error: (err) => {
        this.toastrService.error('Data info not Found',err)
      },
    });
  }

  submit() {
    this.dialogRef.close({
      clicked: 'submit',
    });
  }
}
