import { CommonModule } from '@angular/common';
import { MapDevicesComponent } from './map-devices.component';
import { NgModule } from '@angular/core';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { MapDevicesService } from '../../auth/services/map-devices.service';

@NgModule({
  declarations: [MapDevicesComponent],
  imports: [CommonModule, LeafletModule],
  exports: [MapDevicesComponent],
  providers: [MapDevicesService],
})
export class MapDevicesModule {}
