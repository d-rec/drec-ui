import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthLayoutComponent } from './layout/auth/auth-layout.component';
import { GuestLayoutComponent } from './layout/guest/guest-layout.component';
import { DefaultLayoutComponent } from './layout/default/default-layout.component';
import { LoginComponent } from './view/login/login.component';
import { RegisterComponent } from './view/register/register.component';
import { CertificateComponent } from './view/certificate/certificate.component';
import { RedemptionReportComponent } from './view/redemption-report/redemption-report.component';
import { ConfirmEmailComponent } from './view/confirm-email/confirm-email.component';
import { CertificateDetailsComponent } from './view/certificate-details/certificate-details.component';
import { DeviceGroups } from './view/device-groups/device-groups.component';
import { AddDeviceGroupComponent } from './view/add-device-group/add-device-group.component';
import { ForgetPasswordComponent } from './view/forget-password/forget-password.component';
import { ResetPasswordComponent } from './view/reset-password/reset-password.component';
import { UserProfileComponent } from './view/user-profile/user-profile.component';
import { UserAcceptInvitationComponent } from './view/user-accept-invitation/user-accept-invitation.component';
import { TermsAndConditionsComponent } from './view/terms-and-conditions/terms-and-conditions.component';
import { DocumentsUploadComponent } from './view/documents-upload/documents-upload.component';
import { VerificationComponent } from './view/verification/verification.component';
import { AuthVerifiedGuard } from './guards/auth-verified.guard';
import { AcceptTermsAndConditionsComponent } from './view/accept-terms-and-conditions/accept-terms-and-conditions.component';
import { ResendConfirmEmailComponent } from './view/resend-confirmation-email/resend-confirmation-email.component';
import { DashboardComponent } from './view/dashboard/dashboard.component';
import { GuestGuard } from './guards/guest.guard';
import { AuthUnverifiedGuard } from './guards/auth-unverified.guard';
import { EmailVerificationGuard } from './guards/verification/email-verified.guard';
import { TermsVerificationGuard } from './guards/verification/terms-verified.guard';
import { PhoneVerificationGuard } from './guards/verification/phone-verification.guard';
import { OrganizationDocumentsGuard } from './guards/verification/organization-documents-verified.guard';
import { ChangePhoneNumberComponent } from './view/change-phone-number/change-phone-number.component';
import { EvidentSettingsComponent } from './view/evident-settings/evident-settings.component';

('./view/UserAcceptInvitationComponent');
const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: '',
    component: GuestLayoutComponent,
    canActivate: [GuestGuard],
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
      { path: 'forgot-password', component: ForgetPasswordComponent },
      { path: 'reset-password', component: ResetPasswordComponent },
      {
        path: 'confirm-email',
        component: ConfirmEmailComponent,
      },
    ],
  },
  {
    path: '',
    component: DefaultLayoutComponent,
    children: [
      { path: 'terms-and-conditions', component: TermsAndConditionsComponent },
    ],
  },
  {
    path: '',
    component: GuestLayoutComponent,
    children: [
      {
        path: 'user/acceptInvitaion',
        component: UserAcceptInvitationComponent,
      },
    ],
  },
  {
    path: '',
    component: DefaultLayoutComponent,
    canActivate: [AuthUnverifiedGuard],
    children: [
      // Other routes available only to logged-in but unverified users
      {
        path: 'accept-terms-and-conditions',
        component: AcceptTermsAndConditionsComponent,
        canActivate: [TermsVerificationGuard],
      },
      {
        path: 'resend-confirmation-email',
        component: ResendConfirmEmailComponent,
        canActivate: [EmailVerificationGuard],
      },
      {
        path: 'verify-otp',
        component: VerificationComponent,
        canActivate: [PhoneVerificationGuard],
      },
      {
        path: 'organization/upload/verification-documents',
        component: DocumentsUploadComponent,
        canActivate: [OrganizationDocumentsGuard],
      },
      {
        path: 'change-phone-number',
        component: ChangePhoneNumberComponent,
        canActivate: [PhoneVerificationGuard],
      },
    ],
  },
  {
    path: '',
    component: AuthLayoutComponent,
    canActivate: [AuthVerifiedGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'All_certificate', component: CertificateDetailsComponent },
      { path: 'certificate', component: CertificateComponent },
      { path: 'device-groups', component: DeviceGroups },
      { path: 'settings/evident', component: EvidentSettingsComponent },

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
        path: 'add/device-group',
        component: AddDeviceGroupComponent,
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
