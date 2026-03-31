import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DeviceRoutingModule } from './device-routing.module';
import { AlldevicesComponent } from './alldevices/alldevices.component';
import { AddDevicesComponent } from './add-devices/add-devices.component';
import { AddBulkDeviceComponent } from './add-bulk-device/add-bulk-device.component';
import { EditDeviceComponent } from './edit-device/edit-device.component';
import { DeviceDetailsComponent } from './device-details/device-details.component';
import { MapModule } from '../map/map.module';
import { PdfPreviewComponent } from '../../shared/pdf-preview/pdf-preview.component';
@NgModule({
  declarations: [
    AlldevicesComponent,
    AddDevicesComponent,
    AddBulkDeviceComponent,
    EditDeviceComponent,
    DeviceDetailsComponent,
  ],
  imports: [
    CommonModule,
    DeviceRoutingModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    MapModule,
    PdfPreviewComponent,
  ],
})
export class DeviceModule {}
