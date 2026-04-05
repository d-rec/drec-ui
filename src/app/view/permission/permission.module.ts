import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PermissionRoutingModule } from './permission-routing.module';
import { AclModulePermissionComponent } from './acl-module-permission/acl-module-permission.component';
import { UserpermissionComponent } from './add-userpermission/add-userpermission.component';
import { EditPermissionComponent } from './edit-permission/edit-permission.component';
import { RegistrantPermissionComponent } from './registrant-permission/registrant-permission.component';
import { RegistrantPermissionFormComponent } from './registrant-permission-form/registrant-permission-form.component';

@NgModule({
  declarations: [
    AclModulePermissionComponent,
    UserpermissionComponent,
    EditPermissionComponent,
    RegistrantPermissionComponent,
    RegistrantPermissionFormComponent,
  ],
  imports: [
    CommonModule,
    PermissionRoutingModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
  ],
})
export class PermissionModule {}
