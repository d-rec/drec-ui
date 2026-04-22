import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AclModulePermissionComponent } from './acl-module-permission/acl-module-permission.component';
import { UserpermissionComponent } from './add-userpermission/add-userpermission.component';
import { RegistrantPermissionComponent } from './registrant-permission/registrant-permission.component';
import { RegistrantPermissionFormComponent } from './registrant-permission-form/registrant-permission-form.component';
const routes: Routes = [
  { path: '', redirectTo: 'acl_module', pathMatch: 'full' },
  { path: 'acl_module', component: AclModulePermissionComponent },
  { path: 'user_role/list', component: UserpermissionComponent },
  { path: 'registrant_role/list', component: RegistrantPermissionComponent },
  {
    path: 'registrant_role/list/:id',
    component: RegistrantPermissionComponent,
  },
  { path: 'request/form', component: RegistrantPermissionFormComponent },
  { path: 'list', component: RegistrantPermissionComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PermissionRoutingModule {}
