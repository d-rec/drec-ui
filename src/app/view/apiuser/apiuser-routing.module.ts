import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {AdminAlldevicesComponent} from '../admin/admin-alldevices/admin-alldevices.component';
import {AllUsersComponent} from '../all-users/all-users.component';
const routes: Routes = [


  // {
  //   path: 'All_organization', component: AdminOrganizationComponent
  // },
  {
    path: 'All_users', component: AllUsersComponent
  },
  {
    path: 'All_devices', component: AdminAlldevicesComponent
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
