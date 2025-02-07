describe('Sign up Test', () => {
  beforeEach(() => {
    cy.wait(5000);
    // cy.clearDatabase();
  });

  it('should sign up a new developer user', () => {
    cy.developerUserSignup();
  });
});
