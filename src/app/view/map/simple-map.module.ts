import { CommonModule } from '@angular/common';
import { SimpleMapComponent } from './simple-map.component';
import { NgModule } from '@angular/core';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';

@NgModule({
  declarations: [SimpleMapComponent],
  imports: [CommonModule, LeafletModule],
  exports: [SimpleMapComponent],
})
export class SimpleMapModule {}
