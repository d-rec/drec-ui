import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import { Asset } from '../asset.model';
import { AssetService } from '../asset.service';
import { SatellitePreviewComponent } from '../../../shared/satellite-preview/satellite-preview.component';
import { mapPinIcon } from '../../../shared/map-pin';

const STATUS_COLOR: Record<string, string> = {
  approved: '#22c55e',
  rejected: '#ef4444',
  pending: '#f59e0b',
  legacy: '#a0845c',
};

@Component({
  standalone: false,
  selector: 'app-ds-asset-map',
  template: `<div #mapEl class="map-container"></div>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .map-container {
        width: 100%;
        height: 100%;
      }
      :host ::ng-deep .map-pin-highlighted {
        z-index: 100000 !important;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() assets: Asset[] = [];
  @Output() pinClick = new EventEmitter<string>();
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private pinOverlay: HTMLElement | null = null;
  private selectedId: string | null = null;
  private selectedSub: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private assetService: AssetService,
  ) {}

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      zoomControl: true,
      attributionControl: false,
      minZoom: 3,
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
      maxBoundsViscosity: 1.0,
    }).setView([20, 0], 3);
    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 17,
        noWrap: true,
      },
    ).addTo(this.map);
    this.updateMarkers();

    this.selectedSub = this.assetService.selectedId$.subscribe((id) => {
      this.selectedId = id;
      if (this.map) this.updateMarkers();
      if (id) this.panToSelected(id);
    });

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapEl.nativeElement);
  }

  ngOnChanges(): void {
    if (this.map) this.updateMarkers();
  }

  ngOnDestroy(): void {
    this.selectedSub?.unsubscribe();
    this.resizeObserver?.disconnect();
    this.removePinOverlay();
    this.map?.remove();
  }

  private updateMarkers(): void {
    this.markers.forEach((m) => m.remove());
    this.markers = [];

    for (const asset of this.assets) {
      if (asset.lat === null || asset.long === null) continue;
      const color = STATUS_COLOR[asset.status] ?? '#6b7280';
      const lat = asset.lat;
      const lng = asset.long;
      const id = asset.id;
      const highlighted = id === this.selectedId;

      const marker = L.marker([lat, lng], {
        icon: mapPinIcon(color, highlighted),
        zIndexOffset: highlighted ? 100000 : 0,
      })
        .on('mouseover', () => {
          this.removePinOverlay();
          this.pinOverlay = SatellitePreviewComponent.createOverlay(
            asset.siteName,
            lat,
            lng,
            this.http,
          );
          SatellitePreviewComponent.positionOverlay(
            this.pinOverlay,
            this.map!,
            lat,
            lng,
          );
        })
        .on('mouseout', () => this.removePinOverlay())
        .on('click', () => this.pinClick.emit(id))
        .addTo(this.map!);
      this.markers.push(marker);
    }
  }

  private panToSelected(id: string): void {
    const asset = this.assets.find((a) => a.id === id);
    if (!asset || asset.lat === null || asset.long === null || !this.map)
      return;
    const currentZoom = this.map.getZoom();
    this.map.flyTo([asset.lat, asset.long], Math.max(currentZoom, 8), {
      duration: 0.6,
    });
  }

  private removePinOverlay(): void {
    if (this.pinOverlay) {
      this.pinOverlay.remove();
      this.pinOverlay = null;
    }
  }
}
