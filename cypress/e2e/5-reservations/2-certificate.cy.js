describe('Generate certificate', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should generate certificate', () => {
    cy.buyerUserLogin().wait(20000);
    cy.certificate();
  });
});
