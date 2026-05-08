import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AddDevicesComponent } from './add-devices/add-devices.component';
import { AlldevicesComponent } from './alldevices/alldevices.component';
import { AddBulkDeviceComponent } from './add-bulk-device/add-bulk-device.component';
import { CertifiedDevicesDeveloperComponent } from '../certified-devices-developer/certified-devices-developer.component';
const routes: Routes = [
  { path: '', redirectTo: 'AllList', pathMatch: 'full' },
  { path: 'AllList', component: AlldevicesComponent },
  { path: 'add', component: AddDevicesComponent },
  { path: 'bulk_upload', component: AddBulkDeviceComponent },
  { path: 'edit/:id', component: AddDevicesComponent },
  {
    path: 'certifiedin_reservation',
    component: CertifiedDevicesDeveloperComponent,
  },
  {
    path: 'reviews',
    loadChildren: () =>
      import('../device-reviews/device-reviews.module').then(
        (m) => m.DeviceReviewsModule,
      ),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DeviceRoutingModule {}
