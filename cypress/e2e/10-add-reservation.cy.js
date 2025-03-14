import addReservation from '../support/commands/add-reservation'
import buyerUserLogin from '../support/commands/buyer-user-login'

describe('Add reservation', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should add reservation', () => {
    cy.buyerUserLogin().wait(20000);
    cy.addReservation();
  });
});
