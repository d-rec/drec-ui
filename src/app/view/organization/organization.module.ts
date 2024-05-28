import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OrganizationRoutingModule } from './organization-routing.module';
import { InformationComponent } from './information/information.component';
import { AdminOrganizationComponent } from './admin-organization/admin-organization.component';
import { UserInvitationComponent } from './user-invitation/user-invitation.component';

@NgModule({
  declarations: [
    InformationComponent,
    AdminOrganizationComponent,
    UserInvitationComponent,
  ],
  imports: [
    CommonModule,
    OrganizationRoutingModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
  ],
})
export class OrganizationModule {}
