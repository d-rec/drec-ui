import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {MaterialModule} from '../../material/material.module';
import { OrganizationRoutingModule } from './organization-routing.module';
import { InformationComponent } from './information/information.component';
import { AdminOrganizationComponent } from './admin-organization/admin-organization.component';


@NgModule({
  declarations: [
    InformationComponent,
    AdminOrganizationComponent
  ],
  imports: [
    CommonModule,
    OrganizationRoutingModule,
    MaterialModule
  ]
})
export class OrganizationModule { }
