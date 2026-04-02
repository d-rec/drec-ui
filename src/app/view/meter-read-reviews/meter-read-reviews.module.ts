import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MeterReadReviewsPageComponent } from './meter-read-reviews-page.component';
import { ReadsListWindowComponent } from './reads-list-window/reads-list-window.component';
import { MeterReadReviewService } from './meter-read-review.service';
import { AdminGuard } from '../../guards/admin.guard';

@NgModule({
  declarations: [
    MeterReadReviewsPageComponent,
    ReadsListWindowComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild([
      {
        path: '',
        component: MeterReadReviewsPageComponent,
        canActivate: [AdminGuard],
      },
    ]),
  ],
  providers: [MeterReadReviewService],
})
export class MeterReadReviewsModule {}
