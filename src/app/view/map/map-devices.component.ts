import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import { DeviceService } from '../../auth/services/device.service';
import { Device } from '../../models/device.model';
import { MapDevicesService } from '../../auth/services/map-devices.service';
import { OrganizationType } from 'src/app/enums/organization-types.enum';

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
  loggedInUser: any;
  deviceUrl: string = 'device/my';
  isMapInitialized = false;

  constructor(
    private deviceService: DeviceService,
    private mapDevicesService: MapDevicesService,
  ) {
    // Initialize map layers
    this.options.layers = [this.mapDevicesService.createTileLayer()];
  }

  ngOnInit(): void {
    this.loggedInUser = JSON.parse(sessionStorage.getItem('loginuser')!);
    this.getDevices();
  }

  getDevices() {
    if (this.loggedInUser.role === OrganizationType.Admin) {
      this.deviceService.GetDevicesForAdmin().subscribe({
        next: (devices) => {
          this.devices = devices.devices || [];
          this.updateMap();
        },
        error: (err) => {
          console.error('Error loading devices:', err);
          this.devices = [];
          this.updateMap();
        },
      });
    } else {
      this.deviceService.GetMyDevices(this.deviceUrl).subscribe({
        next: (devices) => {
          this.devices = devices || [];
          this.updateMap();
        },
        error: (err) => {
          console.error('Error loading devices:', err);
          this.devices = [];
          this.updateMap();
        },
      });
    }
  }

  updateMap() {
    if (this.map && this.isMapInitialized) {
      console.log(`Updating map with ${this.devices.length} devices`);
      this.addMarkers();
    }
  }

  onMapReady(map: L.Map): void {
    this.map = map;
    this.markerGroup.addTo(this.map);
    this.isMapInitialized = true;
    this.updateMap();
  }

  addMarkers(): void {
    // Always ensure the map is visible even with 0 or 1 device
    this.mapDevicesService.addDeviceMarkers(
      this.map,
      this.devices,
      this.markerGroup,
    );

    // If no markers were added, ensure map is still centered properly
    if (this.devices.length <= 1) {
      // Default view for empty or single-device maps
      const zoom = this.devices.length === 0 ? 2 : 5;

      if (this.devices.length === 1) {
        // For a single device, center on that device
        const device = this.devices[0];
        if (device && device.latitude && device.longitude) {
          const lat = Number(device.latitude);
          const lng = Number(device.longitude);
          if (!isNaN(lat) && !isNaN(lng)) {
            this.map.setView([lat, lng], zoom);
            return;
          }
        }
      }

      // Default world view if no valid devices
      this.map.setView([20, 0], zoom);
    }
  }
}
