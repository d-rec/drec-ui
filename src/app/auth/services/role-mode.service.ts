import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type RoleMode = 'api' | 'ui';

const SESSION_KEY = 'role-mode';

@Injectable({ providedIn: 'root' })
export class RoleModeService {
  private mode$ = new BehaviorSubject<RoleMode>(this.loadMode());

  mode = this.mode$.asObservable();

  get currentMode(): RoleMode {
    return this.mode$.getValue();
  }

  setMode(mode: RoleMode): void {
    sessionStorage.setItem(SESSION_KEY, mode);
    this.mode$.next(mode);
  }

  /** Call this after login/register to initialise mode from the user's role. */
  initFromRole(role: string): void {
    const mode: RoleMode = role === 'Registrant' ? 'api' : 'ui';
    this.setMode(mode);
  }

  private loadMode(): RoleMode {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored === 'api' || stored === 'ui') return stored;

    // No explicit preference stored — derive from the logged-in user's role.
    try {
      const loginuser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
      return loginuser.role === 'Registrant' ? 'api' : 'ui';
    } catch {
      return 'ui';
    }
  }
}
