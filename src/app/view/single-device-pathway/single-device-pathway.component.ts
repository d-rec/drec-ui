import { Component } from '@angular/core';
import { SelectionType } from 'src/app/utils/drec.enum';

@Component({
  selector: 'app-single-device-pathway',
  templateUrl: './single-device-pathway.component.html',
  styleUrls: ['./single-device-pathway.component.scss'],
})
export class SingleDevicePathwayComponent {
  SelectionType = SelectionType;
  singleDeviceHeader = 'Add Single Device Pathway';
}
