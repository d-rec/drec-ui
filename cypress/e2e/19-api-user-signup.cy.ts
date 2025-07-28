describe('Sign Up Test', () => {
  beforeEach(() => {
    cy.wait(5000);
  });
  it('should sign up a new Api user', () => {
    cy.apiUserSignup().wait(1000);
  });
});
