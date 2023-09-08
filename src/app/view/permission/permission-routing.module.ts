import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {AclModulePermissionComponent} from './acl-module-permission/acl-module-permission.component';
import {UserpermissionComponent} from './add-userpermission/add-userpermission.component'
const routes: Routes = [

  { path: '', redirectTo: 'acl_module', pathMatch: 'full' },
  { path: 'acl_module', component: AclModulePermissionComponent }, 
  { path: 'user_role/list', component: UserpermissionComponent }, 
//  { path: 'edit/:id', component: EditCountryYieldvalueComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PermissionRoutingModule { }