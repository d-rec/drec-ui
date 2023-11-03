import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {AlldevicesComponent} from '../device/alldevices/alldevices.component';
import {AllUsersComponent} from '../all-users/all-users.component';
const routes: Routes = [


  // {
  //   path: 'All_organization', component: AdminOrganizationComponent
  // },
  {
    path: 'All_users', component: AllUsersComponent
  },
  {
    path: 'All_devices', component: AlldevicesComponent
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
export class ApiuserRoutingModule { }
