import { Component, OnInit, OnDestroy } from '@angular/core';
import { combineLatest, Observable, Subscription } from 'rxjs';
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
  // the key that was interacted with (last-click-wins). Counter is owned by
  // AssetService so pictures and non-pictures share the same monotonic sequence
  // — no window type can out-rank another just by having a higher base value.
  windowZ: { [key: string]: number } = {
    map: 200,
    satellite: 250,
    documents: 300,
    deviceInfo: 350,
    pdf: 400,
  };
  activeTab: 'reviews' | 'map' = 'reviews';
  showSatellite = false;
  isAdmin = false;
  canReview = false;

  /** Per-device storage key so the reviewer's checkbox state is remembered per device. */
  checklistStorageKey$: Observable<string | null>;
  openPictures$: Observable<OpenPicture[]>;

  /** Provenance map of the currently-focused device — feeds the OC#
   *  panel so each row is tinted green (platform-derived) or grey
   *  (manually entered) without auto-ticking anything. */
  selectedFieldProvenance$: Observable<
    Record<string, { source: string; confidence: number; at: string; value?: any }> | null
  >;

  /** Doc-token → signed URL for the currently-focused device. Feeds
   *  the OC# panel's per-row "↗ SLD/SF-02/..." badges. */
  selectedDocUrls$: Observable<Record<string, string | null>>;

  /** Pass-through of the asset service's hover broadcast — the
   *  documents-window writes the doc-token currently under the
   *  reviewer's mouse here, and the OC# panel reads it back to
   *  glow the matching rows. */
  hoveredDocSource$: Observable<string | null>;

  private sub!: Subscription;

  constructor(private svc: AssetService) {
    this.checklistStorageKey$ = this.svc.viewDeviceInfoId$.pipe(
      map((id) => (id != null ? `oc-checklist-device-${id}` : null)),
    );
    this.openPictures$ = this.svc.openPictures$;
    // selectedId$ fires whenever the reviewer clicks a row in the
    // reviews table — that's the moment we know which device's
    // provenance map to feed into the OC# panel. viewDeviceInfoId$
    // only fires when the floating device-info window is opened,
    // which is too late.
    this.selectedFieldProvenance$ = combineLatest([
      this.svc.selectedId$,
      this.svc.assets$,
    ]).pipe(
      map(([id, assets]) => {
        if (id == null) return null;
        const asset = assets.find((a) => a.id === id);
        return asset?.fieldProvenance ?? null;
      }),
    );
    this.selectedDocUrls$ = combineLatest([
      this.svc.selectedId$,
      this.svc.assets$,
    ]).pipe(
      map(([id, assets]) => {
        const a = id != null ? assets.find((x) => x.id === id) : null;
        const out: Record<string, string | null> = {};
        if (!a) return out;
        out['SLD'] = a.sldUrl;
        out['SF-02'] = a.sf02Url;
        out['SF-02c'] = a.sf02cUrl;
        out['COD'] = a.codProofUrl;
        // Meter IDs are evidenced by METERING_EVIDENCE docs. Pick
        // the first one — if there are several the badge just lands
        // on the first; reviewer can still scroll the list.
        out['Meter IDs'] = a.meteringEvidenceUrls[0] ?? null;
        out['Project photos'] = a.pictureUrls[0] ?? null;
        return out;
      }),
    );
    this.hoveredDocSource$ = this.svc.hoveredDocSource$.asObservable();
  }

  /** OC# panel badge click → open the source document in the
   *  existing PDF / picture viewer. */
  onOpenDoc(url: string): void {
    if (!url) return;
    // svc.refreshUrl ensures the signed URL hasn't expired.
    this.svc.refreshUrl(url).then((fresh) => {
      if (/\.(jpe?g|png|gif|webp|bmp|svg)/i.test(url)) {
        this.svc.viewPicture(fresh, false);
      } else {
        this.svc.viewPdf(fresh);
      }
    });
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
    this.windowZ = { ...this.windowZ, [key]: this.svc.nextZOrder() };
  }

  bringPictureToFront(id: string): void {
    this.svc.bringPictureToFront(id);
  }
}
