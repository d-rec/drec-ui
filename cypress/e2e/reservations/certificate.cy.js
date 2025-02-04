describe('Certificate Generation', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should generate a certificate successfully', () => {
    cy.buyer_login().wait(20000);
    cy.certficate();
  });
});
