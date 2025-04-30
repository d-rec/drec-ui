import { Component } from '@angular/core';
import { OrganizationService } from '../../auth/services';
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  organization: any;

  constructor(private orgService: OrganizationService) {}
  ngOnInit() {
    this.orgService.getOrganizationInformation().subscribe((data) => {
      this.organization = data;
    });
  }
}
