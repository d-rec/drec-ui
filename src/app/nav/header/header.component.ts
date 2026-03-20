import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { AuthbaseService } from '../../auth/authbase.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ChatService } from '../../chat/chat.service';
import { Observable } from 'rxjs';
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  isLoggedIn = false;
  isChatOpen$: Observable<boolean>;
  @Output() public sidenavToggle = new EventEmitter();

  constructor(
    private authService: AuthbaseService,
    private toastrService: ToastrService,
    private router: Router,
    public chatService: ChatService,
  ) {
    this.isChatOpen$ = this.chatService.isChatOpen$;
  }

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();
  }
  public onToggleSidenav = () => {
    this.sidenavToggle.emit();
  };
  toggleChat() {
    this.chatService.toggleChat();
  }
  logout() {
    this.authService.logout('auth/logout').subscribe({
      next: (data) => {
        this.toastrService.success(data.message);
        sessionStorage.clear();
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.toastrService.success(err, 'logout Successfull');
        this.router.navigate(['/login']);
      },
    });
  }
}
