import { Component, OnInit } from '@angular/core';
import { MeterReadReviewService } from './meter-read-review.service';

@Component({
  standalone: false,
  selector: 'app-meter-read-reviews-page',
  template: `
    <div class="mrr-page">
      <ng-container *ngIf="canReview; else chatListView">
        <div class="ds-tabs">
          <button
            class="ds-tab"
            [class.ds-tab--active]="activeTab === 'reviews'"
            (click)="activeTab = 'reviews'"
          >
            Meter Read Reviews
          </button>
          <button
            class="ds-tab"
            [class.ds-tab--active]="activeTab === 'map'"
            (click)="activeTab = 'map'"
          >
            World Map
          </button>
        </div>
        <div class="mrr-content">
          <app-mrr-reads-list
            *ngIf="activeTab === 'reviews'"
          ></app-mrr-reads-list>
          <app-mrr-map-window
            *ngIf="activeTab === 'map'"
            (onPinClick)="onMapPinClick($event)"
          ></app-mrr-map-window>
        </div>
      </ng-container>
      <ng-template #chatListView>
        <div
          class="mrr-content"
          style="display:flex;align-items:center;justify-content:center;color:#64748b;"
        >
          Meter read reviews are available to reviewers and admins only.
        </div>
      </ng-template>
    </div>
  `,
  styleUrls: ['./meter-read-reviews-page.component.scss'],
})
export class MeterReadReviewsPageComponent implements OnInit {
  canReview = false;
  activeTab: 'reviews' | 'map' = 'reviews';

  constructor(private svc: MeterReadReviewService) {}

  ngOnInit(): void {
    const loginUser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    this.canReview =
      loginUser.role === 'Admin' ||
      loginUser.role === 'Reviewer' ||
      loginUser.role === 'SeniorReviewer';

    if (this.canReview) {
      this.svc.populateFromDb();
    }
  }

  onMapPinClick(deviceId: number): void {
    this.activeTab = 'reviews';
    this.svc.expand(deviceId);
  }
}
