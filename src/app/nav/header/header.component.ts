import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { AuthbaseService } from '../../auth/authbase.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ChatService, ChatConversation } from '../../chat/chat.service';
import { Observable } from 'rxjs';
@Component({
  standalone: false,
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  isChatOpen$: Observable<boolean>;
  unreadCount$: Observable<number>;
  @Output() public sidenavToggle = new EventEmitter();

  constructor(
    private authService: AuthbaseService,
    private toastrService: ToastrService,
    private router: Router,
    public chatService: ChatService,
  ) {
    this.isChatOpen$ = this.chatService.isChatOpen$;
    this.unreadCount$ = this.chatService.unreadCount$;
  }

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();
    if (this.isLoggedIn) {
      this.chatService.startUnreadPolling();
    }
  }

  showUnreadList = false;
  unreadDeviceNames: string[] = [];

  onBellClick(): void {
    // Refresh device list on each click in case polling hasn't caught up
    const email = this.chatService.getCurrentUserEmail();
    if (!email) return;

    this.chatService.getUnreadDeviceNames(email).subscribe((names: string[]) => {
      const devices = new Set(names);
      this.chatService.unreadDevices$.next(devices);

      if (devices.size === 0) return;

      if (devices.size === 1) {
        this.openChatForDevice(Array.from(devices)[0]);
      } else {
        this.unreadDeviceNames = Array.from(devices);
        this.showUnreadList = !this.showUnreadList;
      }
    });
  }

  openChatForDevice(deviceName: string): void {
    this.showUnreadList = false;
    const email = this.chatService.getCurrentUserEmail();
    if (!email) return;

    this.chatService.getConversation(undefined, undefined, deviceName).subscribe({
      next: (conv) => {
        if (conv) {
          // Determine the partner (the other participant)
          const partner = conv.participant1 === email ? conv.participant2 : conv.participant1;
          this.chatService.siteName$.next(deviceName);
          this.chatService.openForDevice$.next({ submitterEmail: partner, siteName: deviceName });
          this.chatService.isChatOpen$.next(true);
        }
      },
    });
  }

  ngOnDestroy(): void {
    this.chatService.stopUnreadPolling();
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
