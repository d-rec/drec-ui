import { CommonModule } from '@angular/common';
import { MapComponent } from './map.component';
import { NgModule } from '@angular/core';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';

@NgModule({
  declarations: [MapComponent],
  imports: [CommonModule, LeafletModule],
  exports: [MapComponent],
})
export class MapModule {}
