import { Component, OnInit } from '@angular/core';
import { MeterReadReviewService } from './meter-read-review.service';

@Component({
  standalone: false,
  selector: 'app-meter-read-reviews-page',
  template: `
    <div class="mrr-page">
      <ng-container *ngIf="canReview; else chatListView">
        <div class="mrr-header">
          <h2 class="mrr-title">Meter Read Reviews</h2>
        </div>
        <div class="mrr-content">
          <app-mrr-reads-list></app-mrr-reads-list>
        </div>
      </ng-container>
      <ng-template #chatListView>
        <div class="mrr-content" style="display:flex;align-items:center;justify-content:center;color:#64748b;">
          Meter read reviews are available to reviewers and admins only.
        </div>
      </ng-template>
    </div>
  `,
  styleUrls: ['./meter-read-reviews-page.component.scss'],
})
export class MeterReadReviewsPageComponent implements OnInit {
  canReview = false;

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
}
