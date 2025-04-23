import { Component, AfterViewInit } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-simple-map',
  template: `
    <div class="map-container">
      <div
        class="map"
        leaflet
        [leafletOptions]="options"
        (leafletMapReady)="onMapReady($event)"
      ></div>
    </div>
  `,
  styles: [
    `
      .map-container {
        height: 400px;
        width: 100%;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
      }
      .map {
        height: 100%;
        width: 100%;
      }
    `,
  ],
})
export class SimpleMapComponent implements AfterViewInit {
  // Fix Leaflet marker icon issues
  private initMarkerIcons() {
    // Fix marker icons
    const iconRetinaUrl = 'assets/marker-icon-2x.png';
    const iconUrl = 'assets/marker-icon.png';
    const shadowUrl = 'assets/marker-shadow.png';

    // @ts-expect-error - Leaflet typings don't expose _getIconUrl but it needs to be deleted
    delete L.Icon.Default.prototype._getIconUrl;

    L.Icon.Default.mergeOptions({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
    });
  }

  // Map options
  options = {
    layers: [
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        {
          minZoom: 3,
          maxZoom: 17,
          attribution:
            '&copy; <a href="https://carto.com/">carto.com</a> contributors',
        },
      ),
    ],
    zoom: 3,
    center: L.latLng(20, 0), // Center of the world map
  };

  // Map instance
  map!: L.Map;

  ngAfterViewInit(): void {
    this.initMarkerIcons();
  }

  onMapReady(map: L.Map): void {
    this.map = map;

    // Force a map invalidation/redraw after it's ready
    setTimeout(() => {
      map.invalidateSize();
    }, 0);

    console.log('Map is ready!');
  }
}
