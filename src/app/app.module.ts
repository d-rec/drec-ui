import { MaterialModule } from './material/material.module';
import { ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ToastrModule } from 'ngx-toastr';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AuthInterceptor } from './auth/auth.interceptor';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { HeaderComponent } from './nav/header/header.component';
import { FooterComponent } from './nav/footer/footer.component';
import { SidemenuComponent } from './nav/sidemenu/sidemenu.component';
import { LoginComponent } from './view/login/login.component';
import { RegisterComponent } from './view/register/register.component';
import { CertificateComponent } from './view/certificate/certificate.component';
import { MyreservationComponent } from './view/myreservation/myreservation.component';
import { CertificateDetailsComponent } from './view/certificate-details/certificate-details.component';
import { AuthLayoutComponent } from './layout/auth/auth-layout.component';
import { GuestLayoutComponent } from './layout/guest/guest-layout.component';
import { RedemptionReportComponent } from './view/redemption-report/redemption-report.component';

import { AddReservationComponent } from './view/add-reservation/add-reservation.component';
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
//import { UserInvitationComponent } from./view/organization/user-invitation/user-invitation.componentnt';
import { AdminModule } from './view/admin/admin.module';
import { UserAcceptInvitationComponent } from './view/user-accept-invitation/user-accept-invitation.component';
import { ApiuserClientReponseComponent } from './view/apiuser-client-reponse/apiuser-client-reponse.component';
import * as Sentry from '@sentry/angular';
import { SharedModule } from './shared.module';
import { TermsAndConditionsComponent } from './view/terms-and-conditions/terms-and-conditions.component';
import { MarkdownModule } from 'ngx-markdown';
import { DefaultLayoutComponent } from './layout/default/default-layout.component';
import { AcceptTermsAndConditionsComponent } from './view/accept-terms-and-conditions/accept-terms-and-conditions.component';
import { ResendConfirmEmailComponent } from './view/resend-confirmation-email/resend-confirmation-email.component';
import { DashboardComponent } from './view/dashboard/dashboard.component';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    SidemenuComponent,
    LoginComponent,
    RegisterComponent,
    CertificateComponent,
    MyreservationComponent,
    CertificateDetailsComponent,
    AuthLayoutComponent,
    DefaultLayoutComponent,
    GuestLayoutComponent,
    RedemptionReportComponent,
    // AddreadComponent,
    AddReservationComponent,

    CertifiedDevicesDeveloperComponent,
    ConfirmEmailComponent,
    ForgetPasswordComponent,
    ResetPasswordComponent,
    AllUsersComponent,
    ConfirmDialogComponent,
    EditUserComponent,
    UserProfileComponent,
    UserAcceptInvitationComponent,
    // UserInvitationComponent,
    ApiuserClientReponseComponent,
    TermsAndConditionsComponent,
    AcceptTermsAndConditionsComponent,
    ResendConfirmEmailComponent,
    DashboardComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    PipesModule,
    AdminModule,
    MarkdownModule.forRoot(),
    ToastrModule.forRoot({
      closeButton: true,
      timeOut: 15000, // 15 seconds
      progressBar: true,
    }),
    SharedModule,
  ],
  providers: [
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
