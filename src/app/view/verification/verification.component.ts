import {
  Component,
  ViewChildren,
  QueryList,
  ElementRef,
  AfterViewInit,
  OnInit,
} from '@angular/core';
import { UserService } from '../../auth/services/user.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { OtpService } from '../../auth/services/otp.service';

@Component({
  selector: 'app-verification',
  templateUrl: './verification.component.html',
  styleUrls: ['./verification.component.scss'],
})
export class VerificationComponent implements AfterViewInit, OnInit {
  otp: string[] = Array(6).fill('');
  loginUser: any;
  phoneNumber: string = '';

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef>;

  constructor(
    private otpService: OtpService,
    private userService: UserService,
    private router: Router,
    private toastrService: ToastrService,
  ) {}
  ngOnInit(): void {
    this.userService.userProfile().subscribe({
      next: (data) => {
        this.loginUser = data;
        this.phoneNumber = this.loginUser.phoneNumber;
      },
      error: (err) => {
        console.error('Error fetching user profile:', err);
      },
    });
  }
  ngAfterViewInit(): void {
    this.otpInputs.first?.nativeElement.focus();
  }

  trackByIndex(index: number): number {
    return index;
  }

  handleInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    // Accept only digits
    if (/^\d$/.test(value)) {
      this.otp[index] = value;

      // Move focus to next input if exists
      const inputsArray = this.otpInputs.toArray();
      if (index < inputsArray.length - 1) {
        inputsArray[index + 1].nativeElement.focus();
      }
    } else {
      // Clear invalid input
      input.value = '';
      this.otp[index] = '';
    }
  }

  onSubmit(): void {
    const code = this.otp.join('');

    if (!code || code.length < 6) {
      console.error('Incomplete OTP');
      return;
    }

    this.otpService.verifyOtp(this.phoneNumber, code).subscribe(
      (response) => {
        this.toastrService.success(response.message);
        this.clearOtp();
        if (this.loginUser.role === 'Buyer') {
          this.router.navigate(['/myreservation']);
        } else {
          this.router.navigate(['/device/AllList']);
        }
      },
      (error) => {
        this.toastrService.error('Error!', error.error.message);
        console.error('Error verifying OTP:', error);
        this.clearOtp();
      },
    );
  }
  clearOtp(): void {
    this.otp = Array(6).fill('');

    setTimeout(() => {
      this.otpInputs.first?.nativeElement.focus();
    });
  }
  resendOtp(): void {
    if (this.loginUser.phone_number_verified_at !== null) {
      this.toastrService.success('You are already verified.');
    } else {
      this.otpService.sendOtp(this.loginUser.phoneNumber).subscribe(
        (response) => {
          this.toastrService.success(response.message);
        },
        (error) => {
          this.toastrService.error(error.error.message);
          console.error('Error sending OTP:', error);
        },
      );
    }
  }
}
