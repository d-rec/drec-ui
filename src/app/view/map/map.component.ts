import { Component, Input, OnInit } from '@angular/core';
import * as L from 'leaflet';
import { MapService } from '../../auth/services/map.service';

export interface MapMarker {
  latitude: number;
  longitude: number;
  title?: string;
}
@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements OnInit {
  @Input() markers: MapMarker[] = [];

  options: L.MapOptions = {
    layers: [],
    zoom: 3,
    center: L.latLng(20, 0),
  };

  map!: L.Map;
  markerGroup = L.featureGroup();
  isMapInitialized = false;

  constructor(private mapService: MapService) {
    this.options.layers = [this.mapService.createTileLayer()];
  }

  ngOnInit(): void {}

  onMapReady(map: L.Map): void {
    this.map = map;
    this.markerGroup.addTo(this.map);
    this.isMapInitialized = true;
    this.updateMap();
  }

  ngOnChanges(): void {
    if (this.isMapInitialized) {
      this.updateMap();
    }
  }

  updateMap(): void {
    this.mapService.addMarkers(this.map, this.markers, this.markerGroup);
  }
}
