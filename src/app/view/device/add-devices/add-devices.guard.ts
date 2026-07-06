import { CanDeactivateFn } from '@angular/router';
import { AddDevicesComponent } from './add-devices.component';

/**
 * Blocks navigation away from the add/edit-device page when leaving
 * would lose work: unresolved validation errors from a failed submit
 * attempt (clicking Submit on an invalid form silently no-ops, so the
 * registrant could leave thinking the site was registered), or any
 * unsaved field contents (`myform.dirty` — successful submits and the
 * per-row SF-02 save mark the form pristine before navigating).
 */
export const addDevicesCanDeactivate: CanDeactivateFn<AddDevicesComponent> = (
  component,
) => {
  if (component?.submitValidationErrors?.length) {
    return window.confirm(
      'You have unresolved errors that block submission of this site.\n\n' +
        'If you leave now, the site will NOT be registered.\n\n' +
        'Leave the page anyway?',
    );
  }
  if (component?.myform?.dirty) {
    return window.confirm(
      'You have unsaved changes on this form.\n\n' +
        'If you leave now, they will be lost.\n\n' +
        'Leave the page anyway?',
    );
  }
  return true;
};
