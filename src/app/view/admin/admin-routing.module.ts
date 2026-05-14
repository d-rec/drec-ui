import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AdminOrganizationComponent } from '../organization/admin-organization/admin-organization.component';
import { AdminAlldevicesComponent } from './admin-alldevices/admin-alldevices.component';
import { AllUsersComponent } from '../all-users/all-users.component';
import { AddUsersComponent } from './add-users/add-users.component';
import { EditUserComponent } from '../edit-user/edit-user.component';

import { AllRegistrantComponent } from '../registrant/all-registrant/all-registrant.component';
import { WebhooksComponent } from './webhooks/webhooks.component';
import { ChatReviewComponent } from './chat-review/chat-review.component';
import { ChatAdminComponent } from './chat-admin/chat-admin.component';
import { AiUsageComponent } from './ai-usage/ai-usage.component';
import { ChatReviewGuard } from '../../guards/chat-review.guard';
import { NonReviewerGuard } from '../../guards/non-reviewer.guard';
const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  {
    path: 'All_organization',
    component: AdminOrganizationComponent,
  },
  {
    path: 'All_users',
    component: AllUsersComponent,
  },
  {
    path: 'All_registrants',
    component: AllRegistrantComponent,
  },
  {
    path: 'AllOrganization_users/:id',
    component: AllUsersComponent,
  },
  {
    path: 'All_devices',
    component: AdminAlldevicesComponent,
  },
  {
    path: 'add_user',
    component: AddUsersComponent,
  },
  {
    path: 'edit_user/:id',
    component: EditUserComponent,
  },
  // Combined Chat admin — tabbed shell hosting both the conversation
  // browser and the webhook configuration. Two legacy paths map onto
  // the same component with route.data indicating the active tab so
  // bookmarks survive and the URL still reflects the tab.
  {
    path: 'chat',
    component: ChatAdminComponent,
    canActivate: [ChatReviewGuard],
  },
  {
    path: 'chat-review',
    component: ChatAdminComponent,
    canActivate: [ChatReviewGuard],
    data: { tab: 'conversations' },
  },
  {
    path: 'webhooks',
    component: ChatAdminComponent,
    canActivate: [ChatReviewGuard],
    data: { tab: 'webhooks' },
  },
  {
    path: 'ai-usage',
    component: AiUsageComponent,
  },
  {
    path: 'permission',
    loadChildren: () =>
      import('../permission/permission.module').then((m) => m.PermissionModule),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
