import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AddreadComponent } from './addread/addread.component';
import { AllMetereadsComponent } from '../meter-read/all-metereads/all-metereads.component';
import { AddBulkReadsComponent } from './add-bulk-reads/add-bulk-reads.component';
const routes: Routes = [
  { path: '', redirectTo: 'Allreads', pathMatch: 'full' },
  { path: 'All', component: AllMetereadsComponent },
  { path: 'add', component: AddreadComponent },
  { path: 'bulk-upload', component: AddBulkReadsComponent },
  {
    path: 'reviews',
    loadChildren: () =>
      import('../meter-read-reviews/meter-read-reviews.module').then(
        (m) => m.MeterReadReviewsModule,
      ),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MeterReadRoutingModule {}
