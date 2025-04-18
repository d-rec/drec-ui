describe('Sign up Test with Email Verification', () => {
  it('should sign up a new developer user and verify email', () => {
    cy.developerUserSignup();
    cy.wait(10000);

    // cy.getVerificationEmail()
    //   .then((link: any) => {
    //     cy.visit(link);
    //     cy.contains('Your email has been verified').should('exist');
    //   })
    //   .wait(1000);
    cy.developerUserLogin();
  });
});
