import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { AssetService, OpenPicture } from './asset.service';

@Component({
  standalone: false,
  selector: 'app-device-reviews-page',
  templateUrl: './device-reviews-page.component.html',
  styleUrls: ['./device-reviews-page.component.scss'],
})
export class DeviceReviewsPageComponent implements OnInit, OnDestroy {
  // Non-picture windows use a flat key→z map so each bringToFront bumps only
  // the key that was interacted with (last-click-wins).
  windowZ: { [key: string]: number } = {
    map: 200,
    satellite: 250,
    documents: 300,
    deviceInfo: 350,
    pdf: 400,
  };
  private zCounter = 500;
  activeTab: 'reviews' | 'map' = 'reviews';
  showSatellite = false;
  isAdmin = false;
  canReview = false;

  /** Per-device storage key so the reviewer's checkbox state is remembered per device. */
  checklistStorageKey$: Observable<string | null>;
  openPictures$: Observable<OpenPicture[]>;

  private sub!: Subscription;

  constructor(private svc: AssetService) {
    this.checklistStorageKey$ = this.svc.viewDeviceInfoId$.pipe(
      map((id) => (id != null ? `oc-checklist-device-${id}` : null)),
    );
    this.openPictures$ = this.svc.openPictures$;
  }

  trackPictureId = (_: number, p: OpenPicture) => p.id;

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

  zFor(key: string): number {
    return this.windowZ[key] ?? 300;
  }

  bringToFront(key: string): void {
    this.zCounter += 1;
    this.windowZ = { ...this.windowZ, [key]: this.zCounter };
  }

  bringPictureToFront(id: string): void {
    this.svc.bringPictureToFront(id);
  }
}
