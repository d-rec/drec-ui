import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AddreadComponent } from './addread/addread.component';
import { AllMetereadsComponent } from '../meter-read/all-metereads/all-metereads.component';
import { AddBulkReadsComponent } from './add-bulk-reads/add-bulk-reads.component';
const routes: Routes = [
  { path: '', redirectTo: 'Allreads', pathMatch: 'full' },
  { path: 'All', component: AllMetereadsComponent },
  { path: 'add', component: AddreadComponent },
  { path: 'bulk_upload', component: AddBulkReadsComponent },
  // { path: 'edit/:id', component: EditDeviceComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MeterReadRoutingModule {}
