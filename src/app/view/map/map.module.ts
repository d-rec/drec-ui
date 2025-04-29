import { CommonModule } from '@angular/common';
import { MapComponent } from './map.component';
import { NgModule } from '@angular/core';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { MapService } from '../../auth/services/map.service';

@NgModule({
  declarations: [MapComponent],
  imports: [CommonModule, LeafletModule],
  exports: [MapComponent],
  providers: [MapService],
})
export class MapModule {}
