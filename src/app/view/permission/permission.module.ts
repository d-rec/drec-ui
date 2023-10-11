import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material/material.module';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import { PermissionRoutingModule } from './permission-routing.module';
import { AclModulePermissionComponent } from './acl-module-permission/acl-module-permission.component';
import { UserpermissionComponent } from './add-userpermission/add-userpermission.component';
import { EditPermissionComponent } from './edit-permission/edit-permission.component';
import { ApiUserPermissionComponent } from './api-user-permission/api-user-permission.component';


@NgModule({
  declarations: [
    AclModulePermissionComponent,
    UserpermissionComponent,
    EditPermissionComponent,
    ApiUserPermissionComponent
    
  ],
  imports: [
    CommonModule,
    PermissionRoutingModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
  ]
})
export class PermissionModule { }
