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
import * as L from 'leaflet';
import { Asset } from '../asset.model';
import { SatellitePreviewComponent } from '../../../shared/satellite-preview/satellite-preview.component';

const STATUS_COLOR: Record<string, string> = {
  approved: '#22c55e',
  rejected: '#ef4444',
  pending: '#f59e0b',
  legacy: '#a0845c',
};

function pinIcon(color: string): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 24 12 24S24 20.25 24 12C24 5.373 18.627 0 12 0z"
            fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" fill="#fff" fill-opacity="0.85"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
  });
}

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

  constructor(private http: HttpClient) {}

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      zoomControl: true,
      attributionControl: false,
      minZoom: 3,
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
      maxBoundsViscosity: 1.0,
    }).setView([20, 0], 3);
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      {
        maxZoom: 17,
        noWrap: true,
      },
    ).addTo(this.map);
    this.updateMarkers();

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapEl.nativeElement);
  }

  ngOnChanges(): void {
    if (this.map) this.updateMarkers();
  }

  ngOnDestroy(): void {
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

      const marker = L.marker([lat, lng], { icon: pinIcon(color) })
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

  private removePinOverlay(): void {
    if (this.pinOverlay) {
      this.pinOverlay.remove();
      this.pinOverlay = null;
    }
  }
}
