describe('Add reservation', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should add reservation', () => {
    cy.buyerUserLogin().wait(20000);
    cy.addReservation();
  });
});
