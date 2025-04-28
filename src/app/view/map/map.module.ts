import { CommonModule } from '@angular/common';
import { MapComponent } from './map.component';
import { NgModule } from '@angular/core';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { MapDevicesService } from '../../auth/services/map-devices.service';

@NgModule({
  declarations: [MapComponent],
  imports: [CommonModule, LeafletModule],
  exports: [MapComponent],
  providers: [MapDevicesService],
})
export class MapModule {}
