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

      const marker = L.marker([lat, lng], { icon: mapPinIcon(color) })
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
