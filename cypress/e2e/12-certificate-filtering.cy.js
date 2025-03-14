import certificateFilter from '../support/commands/certificate-filter'
import buyerUserLogin from '../support/commands/buyer-user-login'

describe('Filter certificates', () => {
    beforeEach(() => {
      cy.wait(1000);
    });
    it('should filter certificates', () => {
      cy.buyerUserLogin().wait(20000);
      cy.certificateFilter();
    });
  });
  