import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';

import { DeviceReviewsPageComponent } from './device-reviews-page.component';
import { FloatingWindowComponent } from './floating-window/floating-window.component';
import { DocumentsWindowComponent } from './documents-window/documents-window.component';
import { MapWindowComponent } from './map-window/map-window.component';
import { SatelliteWindowComponent } from './satellite-window/satellite-window.component';
import { AssetMapComponent } from './asset-map/asset-map.component';
import { PictureWindowComponent } from './picture-window/picture-window.component';
import { PdfWindowComponent } from './pdf-window/pdf-window.component';
import { ChatListComponent } from './chat-list/chat-list.component';
import { CountryNamePipe } from './country-name.pipe';
import { HighlightPipe } from './highlight.pipe';
import { AssetService } from './asset.service';
import { AdminGuard } from '../../guards/admin.guard';
import { PdfPreviewComponent } from '../../shared/pdf-preview/pdf-preview.component';

@NgModule({
  declarations: [
    DeviceReviewsPageComponent,
    FloatingWindowComponent,
    DocumentsWindowComponent,
    MapWindowComponent,
    SatelliteWindowComponent,
    AssetMapComponent,
    PictureWindowComponent,
    PdfWindowComponent,
    ChatListComponent,
    CountryNamePipe,
    HighlightPipe,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LeafletModule,
    PdfPreviewComponent,
    RouterModule.forChild([
      {
        path: '',
        component: DeviceReviewsPageComponent,
        canActivate: [AdminGuard],
      },
    ]),
  ],
  providers: [AssetService],
})
export class DeviceReviewsModule {}
