describe('Add reservation', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should add reservation', () => {
    cy.buyerlogin().wait(20000);
    cy.certficate();
  });
});
