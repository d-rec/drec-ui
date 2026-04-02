import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';

import { MeterReadReviewsPageComponent } from './meter-read-reviews-page.component';
import { ReadsListWindowComponent } from './reads-list-window/reads-list-window.component';
import { MrrMapWindowComponent } from './map-window/map-window.component';
import { MrrAssetMapComponent } from './asset-map/asset-map.component';
import { MeterReadReviewService } from './meter-read-review.service';
import { AdminGuard } from '../../guards/admin.guard';

@NgModule({
  declarations: [
    MeterReadReviewsPageComponent,
    ReadsListWindowComponent,
    MrrMapWindowComponent,
    MrrAssetMapComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LeafletModule,
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
