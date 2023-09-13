import { Component, Inject } from '@angular/core';
import { FormGroup, FormBuilder, Validators, NgForm } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DeviceService } from '../../../auth/services/device.service'
import { AuthbaseService } from '../../../auth/authbase.service';
import { Observable } from 'rxjs';
import { Device } from '../../../models/device.model'

// export interface Device {
//   netId: number
//   registry: string
//   issuer: string
//   rpcNode: string
//   rpcNodeFallback: string
//   privateIssuer: string
// }
@Component({
  selector: 'app-device-details',
  templateUrl: './device-details.component.html',
  styleUrls: ['./device-details.component.scss']
})

export class DeviceDetailsComponent {
  form: FormGroup;
  id: number;
  device_details: any = {};
  fuellist: any;
  devicetypelist: any
  countrylist: any
  loading: boolean = true;
  value = 0;
  viewoptionfrom: string;
  constructor(
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) data: { deviceid: number },
    public dialogRef: MatDialogRef<DeviceDetailsComponent>,
    private deviceService: DeviceService,
    private authService: AuthbaseService,
  ) {

    this.id = data.deviceid;

    this.authService.GetMethod('device/fuel-type').subscribe(
      (data1) => {

        this.fuellist = data1;
        // this.fuellistLoaded = true;
      });
    this.authService.GetMethod('device/device-type').subscribe(
      (data2) => {

        this.devicetypelist = data2;
        // this.devicetypeLoded = true;
      }
    );

  }
  name: any;
  ngOnInit(): void {
    this.authService.GetMethod('countrycode/list').subscribe(
      (data3) => {

        this.countrylist = data3;
        // this.countrycodeLoded = true;
      }
    )
    setTimeout(() => {

      this.getdeviceinfo();
    }, 1200)
  }
  getdeviceinfo() {
    this.deviceService.GetDevicesInfo(this.id).subscribe({
      next: (data: Device) => {
        if (data) {
          this.loading = false;
          this.device_details = data;
          this.name = this.device_details.externalId
          //@ts-ignore
          this.device_details['fuelname'] = this.fuellist.find((fuelType) => fuelType.code === this.device_details.fuelCode)?.name;
          //@ts-ignore
          this.device_details['devicetypename'] = this.devicetypelist.find(devicetype => devicetype.code == this.device_details.deviceTypeCode)?.name;
          //@ts-ignore
          this.device_details['countryname'] = this.countrylist.find(countrycode => countrycode.alpha3 == this.device_details.countryCode)?.country;
          console.log(this.device_details);
        }
      }, error: err => {
        console.log(err)
      },
    })
  }

  submit() {
    this.dialogRef.close({
      clicked: 'submit'
    });
  }
}
