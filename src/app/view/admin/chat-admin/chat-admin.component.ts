import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

type ChatAdminTab = 'conversations' | 'webhooks';

/**
 * Tabbed shell that hosts the two chat-admin views side by side:
 * "Conversations" (the live chat-review browser) and "Webhooks"
 * (outbound webhook configuration). Two pages were spending a side-
 * menu entry each and confusing admins about which one to open;
 * collapsed into one entry with internal tabs.
 *
 * Deep-link via /admin/chat?tab=webhooks. The legacy /admin/chat-review
 * and /admin/webhooks routes redirect here with the right tab pinned.
 */
@Component({
  standalone: false,
  selector: 'app-chat-admin',
  templateUrl: './chat-admin.component.html',
  styleUrls: ['./chat-admin.component.scss'],
})
export class ChatAdminComponent implements OnInit, OnDestroy {
  selected: ChatAdminTab = 'conversations';
  isAdmin = false;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    try {
      const user = JSON.parse(sessionStorage.getItem('loginuser') ?? 'null');
      this.isAdmin = user?.role === 'Admin';
    } catch {
      this.isAdmin = false;
    }
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((q) => {
        const fromQuery = q.get('tab') as ChatAdminTab | null;
        const fromData = (this.route.snapshot.data?.['tab'] as
          | ChatAdminTab
          | undefined) ?? 'conversations';
        const tab = fromQuery ?? fromData;
        // Non-admins can never land on the webhooks tab, even if they
        // craft the query string or deep-link to /admin/webhooks.
        if (tab === 'webhooks' && !this.isAdmin) {
          this.selected = 'conversations';
        } else {
          this.selected = tab === 'webhooks' ? 'webhooks' : 'conversations';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTabChange(idx: number): void {
    const next: ChatAdminTab = idx === 1 ? 'webhooks' : 'conversations';
    if (next === this.selected) return;
    this.selected = next;
    // Reflect in URL so refresh / share keeps the active tab.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: next === 'webhooks' ? { tab: 'webhooks' } : { tab: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  get selectedIndex(): number {
    return this.selected === 'webhooks' ? 1 : 0;
  }
}
