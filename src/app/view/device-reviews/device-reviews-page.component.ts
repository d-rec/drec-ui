import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { AssetService } from './asset.service';

@Component({
  standalone: false,
  selector: 'app-device-reviews-page',
  templateUrl: './device-reviews-page.component.html',
  styleUrls: ['./device-reviews-page.component.scss'],
})
export class DeviceReviewsPageComponent implements OnInit, OnDestroy {
  z = { map: 200, satellite: 150, documents: 300, deviceInfo: 350, picture: 400, pdf: 450 };
  activeTab: 'reviews' | 'map' = 'reviews';
  showSatellite = false;
  isAdmin = false;
  canReview = false;

  /** Per-device storage key so the reviewer's checkbox state is remembered per device. */
  checklistStorageKey$: Observable<string | null>;

  private sub!: Subscription;

  constructor(private svc: AssetService) {
    this.checklistStorageKey$ = this.svc.viewDeviceInfoId$.pipe(
      map((id) => (id != null ? `oc-checklist-device-${id}` : null)),
    );
  }

  ngOnInit(): void {
    const loginUser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    this.isAdmin = loginUser.role === 'Admin';
    this.canReview =
      this.isAdmin ||
      loginUser.role === 'Reviewer' ||
      loginUser.role === 'SeniorReviewer';

    if (this.canReview) {
      this.sub = this.svc.flyTo$.subscribe(() => {
        this.showSatellite = true;
        this.bringToFront('satellite');
      });
      this.svc.populateFromDb();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onMapPinClick(assetId: string): void {
    this.activeTab = 'reviews';
    this.svc.expand(assetId);
  }

  bringToFront(win: 'map' | 'satellite' | 'documents' | 'deviceInfo' | 'picture' | 'pdf'): void {
    const max = Math.max(...Object.values(this.z));
    this.z = { ...this.z, [win]: max + 1 };
  }
}
