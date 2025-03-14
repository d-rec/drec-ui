import developerUserPermissionsSetup from '../support/commands/developer-user-permission-setup'
import adminLogin from '../support/commands/admin-login'

describe('Setup developer user role permissions', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should setup developer user role permissions', () => {
    cy.adminLogin();
    cy.wait(2000);
    cy.developerUserPermissionsSetup();
  });
});