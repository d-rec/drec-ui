import { Component, OnInit } from '@angular/core';
import { OrganizationService } from '../../../auth/services'
@Component({
  selector: 'app-information',
  templateUrl: './information.component.html',
  styleUrls: ['./information.component.scss']
})
export class InformationComponent {
  orgdetails: any;
  constructor(
    private orgService: OrganizationService
  ) {

  }
  ngOnInit() {
    this.orgService.getOrganizationInformation().subscribe((data) => {
      console.log('org', data)

      this.orgdetails = data

    })
  }
}
