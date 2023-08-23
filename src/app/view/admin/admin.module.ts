import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material/material.module';
import { AdminRoutingModule } from './admin-routing.module';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AdminAlldevicesComponent } from './admin-alldevices/admin-alldevices.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import { AddUsersComponent } from './add-users/add-users.component';
import { InvitationformComponent } from './invitationform/invitationform.component';

@NgModule({
  declarations: [
    DashboardComponent,
    AdminAlldevicesComponent,
    AddUsersComponent,
    InvitationformComponent
  ],
  imports: [
    CommonModule,
    MaterialModule,
    AdminRoutingModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class AdminModule { }
