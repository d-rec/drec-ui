import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AssetService } from './asset.service';

@Component({
  standalone: false,
  selector: 'app-device-reviews-page',
  templateUrl: './device-reviews-page.component.html',
  styleUrls: ['./device-reviews-page.component.scss'],
})
export class DeviceReviewsPageComponent implements OnInit, OnDestroy {
  z = { map: 200, satellite: 150, documents: 300, picture: 400 };
  activeTab: 'reviews' | 'map' = 'reviews';
  showSatellite = false;
  isAdmin = false;

  private sub!: Subscription;

  constructor(private svc: AssetService) {}

  ngOnInit(): void {
    const loginUser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    this.isAdmin = loginUser.role === 'Admin';

    if (this.isAdmin) {
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

  bringToFront(win: 'map' | 'satellite' | 'documents' | 'picture'): void {
    const max = Math.max(...Object.values(this.z));
    this.z = { ...this.z, [win]: max + 1 };
  }
}
