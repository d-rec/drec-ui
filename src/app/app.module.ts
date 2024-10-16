import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ToastrModule } from 'ngx-toastr';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MaterialModule } from './material/material.module';
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
import { WithloginlayoutComponent } from './nav/withloginlayout/withloginlayout.component';
import { WithoutloginlayoutComponent } from './nav/withoutloginlayout/withoutloginlayout.component';
import { RedemptionReportComponent } from './view/redemption-report/redemption-report.component';

import { AddReservationComponent } from './view/add-reservation/add-reservation.component';
import { CertifiedDevicesDeveloperComponent } from './view/certified-devices-developer/certified-devices-developer.component';
//import { TimezonePipe } from './utils/timezone.pipe';
import { PipesModule } from './pipes.module';
import { ConfirmemailComponent } from './view/confirmemail/confirmemail.component';
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
    WithloginlayoutComponent,
    WithoutloginlayoutComponent,
    RedemptionReportComponent,
    // AddreadComponent,
    AddReservationComponent,

    CertifiedDevicesDeveloperComponent,
    ConfirmemailComponent,
    ForgetPasswordComponent,
    ResetPasswordComponent,
    AllUsersComponent,
    ConfirmDialogComponent,
    EditUserComponent,
    UserProfileComponent,
    UserAcceptInvitationComponent,
    // UserInvitationComponent,
    ApiuserClientReponseComponent,
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
    ToastrModule.forRoot({
      closeButton: true,
      timeOut: 15000, // 15 seconds
      progressBar: true,
    }),
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
