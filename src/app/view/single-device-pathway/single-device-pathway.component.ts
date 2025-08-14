import { Component } from '@angular/core';
import { ReservationService } from 'src/app/auth/services';
import { Device } from 'src/app/models';

@Component({
  selector: 'app-single-device-pathway',
  templateUrl: './single-device-pathway.component.html',
  styleUrls: ['./single-device-pathway.component.scss'],
})
export class SingleDevicePathwayComponent {
    constructor(private reservationService: ReservationService) {}

  onRadioSelection(event: { device: Device, orgId: number}) {
    // Add your reservation logic here
    this.reservationService.addSingleDevicePathway(event.device, event.orgId).subscribe({
      next: (response) => {
        // Handle success (show message, navigate, etc.)
        console.log('Reservation successful:', response);
      },
      error: (err) => {
        // Handle error
        console.error('Reservation error:', err);
      }
    });
  }
}
