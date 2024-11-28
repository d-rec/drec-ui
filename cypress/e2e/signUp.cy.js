describe('Sign Up Test', () => {
  afterEach(() => {
   
    cy.clearDatabase();
  });

  it('should sign up a new user', () => {
    
    cy.signup();
  });
});
