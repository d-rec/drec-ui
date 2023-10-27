import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AclModulePermissionComponent } from './acl-module-permission/acl-module-permission.component';
import { UserpermissionComponent } from './add-userpermission/add-userpermission.component'
import { ApiUserPermissionComponent } from './api-user-permission/api-user-permission.component';
import { ApiuserPermissionFormComponent } from './apiuser-permission-form/apiuser-permission-form.component'
const routes: Routes = [

  { path: '', redirectTo: 'acl_module', pathMatch: 'full' },
  { path: 'acl_module', component: AclModulePermissionComponent },
  { path: 'user_role/list', component: UserpermissionComponent },
  { path: 'api_user_role/list', component: ApiUserPermissionComponent },
  { path: 'api_user_role/list/:id', component: ApiUserPermissionComponent },
  { path: 'request/form', component: ApiuserPermissionFormComponent }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PermissionRoutingModule { }
