describe('Sign Up Test', () => {
  // beforeEach(()=>{
  //   cy.clearDatabase();
  // })
  it('should sign up a new user', () => {
    cy.signup();
  });
});
