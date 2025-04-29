import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WithLoginLayoutComponent } from './nav/withloginlayout/with-login-layout.component';
import { WithoutLoginLayoutComponent } from './nav/withoutloginlayout/without-login-layout.component';
import { WithLoginUnverifiedLayoutComponent } from './nav/withloginunverifiedlayout/with-login-unverified-layout.component';
import { LoginComponent } from './view/login/login.component';
import { RegisterComponent } from './view/register/register.component';
import { CertificateComponent } from './view/certificate/certificate.component';
import { RedemptionReportComponent } from './view/redemption-report/redemption-report.component';
import { ConfirmEmailComponent } from './view/confirm-email/confirm-email.component';
import { CertificateDetailsComponent } from './view/certificate-details/certificate-details.component';
import { MyreservationComponent } from './view/myreservation/myreservation.component';
import { AddReservationComponent } from './view/add-reservation/add-reservation.component';
import { ForgetPasswordComponent } from './view/forget-password/forget-password.component';
import { ResetPasswordComponent } from './view/reset-password/reset-password.component';
import { UserProfileComponent } from './view/user-profile/user-profile.component';
import { UserAcceptInvitationComponent } from './view/user-accept-invitation/user-accept-invitation.component';
import { TermsAndConditionsComponent } from './view/terms-and-conditions/terms-and-conditions.component';
import { DocumentsUploadComponent } from './view/documents-upload/documents-upload.component';
import { AuthGuard } from './guards/auth.guard';
import { AuthVerifiedGuard } from './guards/auth-verified.guard';
import { ResendConfirmEmailComponent } from './view/resend-confirmation-email/resend-confirmation-email.component';
('./view/UserAcceptInvitationComponent');
const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    data: { title: 'First Component' },
    pathMatch: 'full',
  },

  {
    path: '',
    component: WithoutLoginLayoutComponent,
    data: { title: 'First Component' },
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
      { path: 'forgot-password', component: ForgetPasswordComponent },
      { path: 'reset-password', component: ResetPasswordComponent },
      { path: 'terms-and-conditions', component: TermsAndConditionsComponent },
      {
        path: 'user/acceptInvitaion',
        component: UserAcceptInvitationComponent,
      },
      {
        path: 'confirm-email',
        component: ConfirmEmailComponent,
      },
    ],
  },
  {
    path: '',
    component: WithLoginUnverifiedLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: 'documents-upload', component: DocumentsUploadComponent },
      {
        path: 'resend-confirmation-email',
        component: ResendConfirmEmailComponent,
      },
    ],
  },
  {
    path: '',
    component: WithLoginLayoutComponent,
    canActivate: [AuthVerifiedGuard],
    children: [
      { path: '', redirectTo: 'device', pathMatch: 'full' },

      { path: 'All_certificate', component: CertificateDetailsComponent },
      { path: 'certificate', component: CertificateComponent },
      { path: 'myreservation', component: MyreservationComponent },

      {
        path: 'reads',
        loadChildren: () =>
          import('./view/meter-read/meter-read.module').then(
            (m) => m.MeterReadModule,
          ),
      },
      //  { path: 'add/read', component: AddreadComponent },
      {
        path: 'organization',
        loadChildren: () =>
          import('./view/organization/organization.module').then(
            (m) => m.OrganizationModule,
          ),
      },
      {
        path: 'device',
        loadChildren: () =>
          import('./view/device/device.module').then((m) => m.DeviceModule),
      },
      {
        path: 'redemption-report',
        component: RedemptionReportComponent,
      },
      {
        path: 'add/reservation',
        component: AddReservationComponent,
      },
      {
        path: 'admin',
        loadChildren: () =>
          import('./view/admin/admin.module').then((m) => m.AdminModule),
      },
      {
        path: 'user/profile',
        component: UserProfileComponent,
      },
      {
        path: 'apiuser',
        loadChildren: () =>
          import('./view/apiuser/apiuser.module').then((m) => m.ApiuserModule),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
