import buyerUserPermissionsSetup from '../support/commands/buyer-user-permission-setup'
import adminLogin from '../support/commands/admin-login'

describe('setup buyer user role permissions', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('Should setup buyer user role permissions', () => {
    cy.adminLogin();
    cy.wait(2000);
    cy.buyerUserPermissionsSetup();
  });
});
