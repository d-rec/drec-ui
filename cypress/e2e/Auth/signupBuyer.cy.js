describe('Sign Up Test', () => {
  beforeEach(() => {
    cy.wait(5000);
    // cy.clearDatabase();
  });
  it('should sign up a new buyer user', () => {
    cy.signupbuyer();
  });
});
