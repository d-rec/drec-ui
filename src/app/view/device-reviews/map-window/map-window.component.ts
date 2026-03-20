import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { AssetService } from '../asset.service';

@Component({
  selector: 'app-ds-map-window',
  template: `
    <div class="map-full">
      <app-ds-asset-map [assets]="(svc.assets$ | async) || []"></app-ds-asset-map>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .map-full { height: 100%; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapWindowComponent {
  @Input() zIndex = 200;
  @Output() bringToFront = new EventEmitter<void>();
  constructor(readonly svc: AssetService) {}
}
