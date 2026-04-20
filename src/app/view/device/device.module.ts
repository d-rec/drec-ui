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
import { SatellitePreviewComponent } from '../../shared/satellite-preview/satellite-preview.component';
import { OcChecklistPanelComponent } from '../../shared/oc-checklist-panel/oc-checklist-panel.component';
import { ImageZoomPanDirective } from '../../shared/directives/image-zoom-pan.directive';
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
    SatellitePreviewComponent,
    OcChecklistPanelComponent,
    ImageZoomPanDirective,
  ],
})
export class DeviceModule {}
