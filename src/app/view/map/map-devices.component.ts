import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import { DeviceService } from '../../auth/services/device.service';
import { Device } from './models/device.model';
import { MapDevicesService } from '../../auth/services/map-devices.service';

@Component({
  selector: 'app-map-devices',
  templateUrl: './map-devices.component.html',
  styleUrls: ['./map-devices.component.scss'],
})
export class MapDevicesComponent implements OnInit {
  // Map options
  options: L.MapOptions = {
    layers: [],
    zoom: 3,
    center: L.latLng(20, 0), // Center of the world map
  };

  // Map instance
  map!: L.Map;
  devices: Device[] = [];
  markerGroup = L.featureGroup();
  loading = false;

  constructor(
    private deviceService: DeviceService,
    private mapDevicesService: MapDevicesService,
  ) {
    // Initialize map layers
    this.options.layers = [this.mapDevicesService.createTileLayer()];
  }

  ngOnInit(): void {
    this.getDevices();
  }

  getDevices() {
    this.loading = true;
    this.deviceService.GetDevicesForAdmin().subscribe({
      next: (devices) => {
        this.devices = devices.devices;

        if (this.map) {
          console.log(this.devices);
          this.addMarkers();
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading devices:', err);
        this.loading = false;
        // Fall back to a default map view if API call fails
        if (this.map) {
          this.map.setView([20, 0], 2);
        }
      },
    });
  }

  onMapReady(map: L.Map): void {
    this.map = map;
    this.markerGroup.addTo(this.map);

    // If devices already loaded, add markers
    if (this.devices.length > 0) {
      this.addMarkers();
    }
  }

  addMarkers(): void {
    this.mapDevicesService.addDeviceMarkers(
      this.map,
      this.devices,
      this.markerGroup,
    );
  }
}
