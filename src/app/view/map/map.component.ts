import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import * as L from 'leaflet';

export interface MapMarker {
  latitude: number;
  longitude: number;
  externalId?: string;
}

@Component({
  standalone: false,
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements OnInit {
  @Input() markers: MapMarker[] = [];
  @Input() zoom: number = 2;
  @Output() markerClicked = new EventEmitter();

  options: L.MapOptions = {
    layers: [],
    zoom: 3,
    center: L.latLng(20, 0),
    scrollWheelZoom: false,
    attributionControl: false,
  };

  map!: L.Map;
  markerGroup = L.featureGroup();
  isMapInitialized = false;

  constructor() {
    this.options.layers = [this.createTileLayer()];
  }

  ngOnInit(): void {}

  onMapReady(map: L.Map): void {
    this.map = map;
    this.markerGroup.addTo(this.map);
    this.isMapInitialized = true;
    this.update();
  }

  ngOnChanges(): void {
    if (this.isMapInitialized) {
      this.update();
    }
  }

  update(): void {
    this.addMarkers();
  }

  private createCustomIcon(): L.Icon {
    return L.icon({
      iconUrl: 'assets/images/map-location.svg',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  }

  private createTileLayer(): L.TileLayer {
    return L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      {
        minZoom: 3,
        maxZoom: 17,
        attribution:
          '&copy; <a href="https://carto.com/">carto.com</a> contributors',
      },
    );
  }

  private addMarkers(): void {
    this.markerGroup.clearLayers();

    if (
      !this.markers ||
      !Array.isArray(this.markers) ||
      this.markers.length === 0
    ) {
      return;
    }

    const customIcon = this.createCustomIcon();

    this.markers.forEach((markerData: MapMarker) => {
      const { latitude, longitude, externalId } = markerData;

      if (isNaN(latitude) || isNaN(longitude)) {
        return;
      }

      const marker = L.marker([latitude, longitude], {
        title: externalId,
        icon: customIcon,
      });

      marker.on('click', () => {
        const deviceData = {
          externalId,
        };
        this.markerClicked.emit(deviceData);
      });

      this.markerGroup.addLayer(marker);
    });

    this.fitToBounds();
  }

  private fitToBounds(): void {
    const validCoordinates = this.markers
      .filter((m) => !isNaN(m.latitude) && !isNaN(m.longitude))
      .map((m) => [m.latitude, m.longitude] as L.LatLngTuple);

    if (validCoordinates.length > 0) {
      if (validCoordinates.length === 1) {
        const position = L.latLng(
          validCoordinates[0][0],
          validCoordinates[0][1],
        );
        this.map.setView(position, this.zoom); // Set a more appropriate zoom level for a single marker
      } else {
        const bounds = L.latLngBounds(validCoordinates);
        this.map.fitBounds(bounds, { padding: [50, 50] });
      }
    } else {
      this.map.setView([20, 0], this.zoom); // default world view
    }
  }
}
