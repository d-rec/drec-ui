describe('Sign up Test', () => {
  beforeEach(() => {
    cy.wait(5000);
  });

  it('should sign up a new developer user', () => {
    cy.developerUserSignup();
  });
});
