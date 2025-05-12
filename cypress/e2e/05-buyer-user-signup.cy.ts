describe('Sign Up Test', () => {
  beforeEach(() => {
    cy.wait(5000);
  });
  it('should sign up a new buyer user', () => {
    cy.buyerUserSignup().wait(1000);
    // cy.verifyPhoneNumber().wait(1000);
  });
});
