import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component'
import {AdminOrganizationComponent} from '../organization/admin-organization/admin-organization.component';
import {AdminAlldevicesComponent} from './admin-alldevices/admin-alldevices.component';
import {AllUsersComponent} from '../all-users/all-users.component';
import { AddUsersComponent} from './add-users/add-users.component';
import {EditUserComponent} from '../edit-user/edit-user.component';
import {ApiuserComponent } from './apiuser/apiuser.component'
const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  {
    path: 'yield',
    loadChildren: () =>
      import('../yieldconfiguration/yieldconfiguration.module').then((m) => m.YieldconfigurationModule),
  },
  {
    path: 'All_organization', component: AdminOrganizationComponent
  },
  {
    path: 'All_users', component: AllUsersComponent
  },
  {
    path: 'All_apiusers', component: ApiuserComponent
  },
  {
    path: 'AllOrganization_users/:id', component: AllUsersComponent
  },
  {
    path: 'All_devices', component: AdminAlldevicesComponent
  },
  {
    path: 'add_user', component: AddUsersComponent
  },
  {
    path: 'edit_user/:id', component: EditUserComponent
  },
  {
    path: 'permission',
    loadChildren: () =>
      import('../permission/permission.module').then((m) => m.PermissionModule),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
