import certificate from '../support/commands/certificate'
import buyerUserLogin from '../support/commands/buyer-user-login'

describe('Certificate Generation', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should generate a certificate successfully', () => {
    cy.buyerUserLogin().wait(20000);
    cy.certificate();
  });
});
