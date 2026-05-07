import { MaterialModule } from './material/material.module';
import { ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ToastrModule } from 'ngx-toastr';
import { AuthInterceptor } from './auth/auth.interceptor';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { HeaderComponent } from './nav/header/header.component';
import { FooterComponent } from './nav/footer/footer.component';
import { SidemenuComponent } from './nav/sidemenu/sidemenu.component';
import { LoginComponent } from './view/login/login.component';
import { RegisterComponent } from './view/register/register.component';
import { CertificateComponent } from './view/certificate/certificate.component';
import { DeviceGroups } from './view/device-groups/device-groups.component';
import { CertificateDetailsComponent } from './view/certificate-details/certificate-details.component';
import { AuthLayoutComponent } from './layout/auth/auth-layout.component';
import { GuestLayoutComponent } from './layout/guest/guest-layout.component';
import { RedemptionReportComponent } from './view/redemption-report/redemption-report.component';

import { AddDeviceGroupComponent } from './view/add-device-group/add-device-group.component';
import { CertifiedDevicesDeveloperComponent } from './view/certified-devices-developer/certified-devices-developer.component';
//import { TimezonePipe } from './utils/timezone.pipe';
import { PipesModule } from './pipes.module';
import { ConfirmEmailComponent } from './view/confirm-email/confirm-email.component';
import { ForgetPasswordComponent } from './view/forget-password/forget-password.component';
import { ResetPasswordComponent } from './view/reset-password/reset-password.component';
import { AllUsersComponent } from './view/all-users/all-users.component';
import { ConfirmDialogComponent } from './view/confirm-dialog/confirm-dialog.component';
import { EditUserComponent } from './view/edit-user/edit-user.component';
import { UserProfileComponent } from './view/user-profile/user-profile.component';
import { PasswordResetDialogComponent } from './view/user-profile/password-reset-dialog.component';
//import { UserInvitationComponent } from./view/organization/user-invitation/user-invitation.componentnt';
import { AdminModule } from './view/admin/admin.module';
import { UserAcceptInvitationComponent } from './view/user-accept-invitation/user-accept-invitation.component';
import { RegistrantClientReponseComponent } from './view/registrant-client-reponse/registrant-client-reponse.component';
import * as Sentry from '@sentry/angular';
import { SharedModule } from './shared.module';
import { provideNgxMatMomentDate } from '@ngxmc/moment-adapter';
import { MAT_DATE_LOCALE, MAT_DATE_FORMATS } from '@angular/material/core';
import { TermsAndConditionsComponent } from './view/terms-and-conditions/terms-and-conditions.component';
import { MarkdownModule } from 'ngx-markdown';
import { DocumentsUploadComponent } from './view/documents-upload/documents-upload.component';
import { VerificationComponent } from './view/verification/verification.component';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { DefaultLayoutComponent } from './layout/default/default-layout.component';
import { AcceptTermsAndConditionsComponent } from './view/accept-terms-and-conditions/accept-terms-and-conditions.component';
import { ResendConfirmEmailComponent } from './view/resend-confirmation-email/resend-confirmation-email.component';
import { DashboardComponent } from './view/dashboard/dashboard.component';
import { ChartsComponent } from './view/charts/charts.component';
import { ChangePhoneNumberComponent } from './view/change-phone-number/change-phone-number.component';
import { EvidentSettingsComponent } from './view/evident-settings/evident-settings.component';
import { LicensesComponent } from './view/licenses/licenses.component';
import { AllIssuersComponent } from './view/all-issuers/all-issuers.component';
import { AddIssuerComponent } from './view/add-issuer/add-issuer.component';
import { SingleDevicePathwayComponent } from './view/single-device-pathway/single-device-pathway.component';
import { ChatModule } from './chat/chat.module';
import { ErrorToastComponent } from './shared/error-toast/error-toast.component';
import { WorldGlobeComponent } from './view/login/world-globe/world-globe.component';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    SidemenuComponent,
    LoginComponent,
    RegisterComponent,
    CertificateComponent,
    DeviceGroups,
    CertificateDetailsComponent,
    AuthLayoutComponent,
    DefaultLayoutComponent,
    GuestLayoutComponent,
    RedemptionReportComponent,
    // AddreadComponent,
    AddDeviceGroupComponent,
    CertifiedDevicesDeveloperComponent,
    ConfirmEmailComponent,
    ForgetPasswordComponent,
    ResetPasswordComponent,
    AllUsersComponent,
    ConfirmDialogComponent,
    EditUserComponent,
    UserProfileComponent,
    PasswordResetDialogComponent,
    UserAcceptInvitationComponent,
    // UserInvitationComponent,
    RegistrantClientReponseComponent,
    TermsAndConditionsComponent,
    DocumentsUploadComponent,
    VerificationComponent,
    AcceptTermsAndConditionsComponent,
    ResendConfirmEmailComponent,
    DashboardComponent,
    ChartsComponent,
    ChangePhoneNumberComponent,
    EvidentSettingsComponent,
    LicensesComponent,
    AllIssuersComponent,
    AddIssuerComponent,
    SingleDevicePathwayComponent,
    WorldGlobeComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    MaterialModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    PipesModule,
    AdminModule,
    MarkdownModule.forRoot(),
    ToastrModule.forRoot({
      closeButton: true,
      timeOut: 5000,
      progressBar: true,
      toastComponent: ErrorToastComponent,
    }),
    SharedModule,
    LeafletModule,
    ChatModule,
  ],
  providers: [
    provideNgxMatMomentDate(),
    // dd/MM/yyyy across the app (matches the date pipe usage everywhere
    // else in the templates) instead of the browser's default M/D/YYYY.
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    // Force date-only display in mat-datepicker inputs. Without this,
    // the moment adapter's default display format includes time
    // ("5/7/2026, 5:43:45 PM") because the underlying Date carries it.
    {
      provide: MAT_DATE_FORMATS,
      useValue: {
        parse: { dateInput: 'DD/MM/YYYY' },
        display: {
          dateInput: 'DD/MM/YYYY',
          monthYearLabel: 'MMM YYYY',
          dateA11yLabel: 'LL',
          monthYearA11yLabel: 'MMMM YYYY',
        },
      },
    },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler({
        showDialog: false,
      }),
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
