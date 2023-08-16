import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {InformationComponent} from './information/information.component'
import {UserInvitationComponent} from '../user-invitation/user-invitation.component'
const routes: Routes = [
  {
    path: '',
    redirectTo: 'information',
    pathMatch: 'full'
  },
  {
    path: 'my/information',
    component: InformationComponent
  },
  {
    path: 'user/invitation', component: UserInvitationComponent
  }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OrganizationRoutingModule { }
