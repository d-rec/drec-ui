import {
  Component,
  ViewChildren,
  QueryList,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { UserService } from '../../auth/services/user.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-verification',
  templateUrl: './verification.component.html',
  styleUrls: ['./verification.component.scss'],
})
export class VerificationComponent implements AfterViewInit {
  otp: string[] = Array(6).fill('');
  phoneNumber: string = sessionStorage.getItem('phoneNumber') || '';

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef>;

  constructor(
    private userService: UserService,
    private router: Router,
    private toastrService: ToastrService,
  ) {}

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

    this.userService.verifyOtp(this.phoneNumber, code).subscribe(
      (response) => {
        this.toastrService.success(response.message);
        this.router.navigate(['/login']);
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
    this.userService.sendOtp(this.phoneNumber).subscribe(
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
