import { CanDeactivateFn } from '@angular/router';
import { AddDevicesComponent } from './add-devices.component';

/**
 * Blocks navigation away from the add-device page while the registrant
 * has unresolved validation errors from a failed submit attempt. Without
 * this guard, clicking Submit on an invalid form silently no-ops and the
 * registrant can leave thinking the site was registered.
 */
export const addDevicesCanDeactivate: CanDeactivateFn<AddDevicesComponent> = (
  component,
) => {
  if (!component?.submitValidationErrors?.length) return true;
  return window.confirm(
    'You have unresolved errors that block submission of this site.\n\n' +
      'If you leave now, the site will NOT be registered.\n\n' +
      'Leave the page anyway?',
  );
};
