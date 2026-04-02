import {
  Component,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MeterReadReviewService } from '../meter-read-review.service';

@Component({
  standalone: false,
  selector: 'app-mrr-map-window',
  template: `
    <div class="map-full">
      <app-mrr-asset-map
        [devices]="(svc.devices$ | async) || []"
        (pinClick)="onPinClick.emit($event)"
      ></app-mrr-asset-map>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
      .map-full {
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MrrMapWindowComponent {
  @Output() onPinClick = new EventEmitter<number>();
  constructor(readonly svc: MeterReadReviewService) {}
}
