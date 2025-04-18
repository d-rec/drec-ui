// describe('Sign up Test with Email Verification', () => {
//   it('should sign up a new developer user and verify email', () => {
//     cy.developerUserSignup();
//     cy.wait(10000);

//     cy.getVerificationEmail()
//       .then((link: any) => {
//         cy.visit(link);
//         cy.contains('Your email has been verified').should('exist');
//       })
//       .wait(1000);
//     cy.developerUserLogin();
//   });
// });

describe('Sign up Test with Email Verification', () => {
  it('should sign up a new developer user and verify email', () => {
    cy.developerUserSignup();
    cy.wait(10000);

    cy.getVerificationEmail()
      .then((link: any) => {
        cy.log('=====start', JSON.stringify(link), 'end========');
        cy.visit(link);
        cy.contains('Your email has been verified').should('exist');
      })
      .wait(1000);
    cy.developerUserLogin();
  });
});

// describe('Message Delivery', () => {
//   it('should check message delivery', () => {
//     // const accountId = 'accountId'; // Replace with your Mailtrap account ID
//     // const inboxId = 'inboxId'; // Replace with your Mailtrap inbox ID
//     // const subject = 'email subject'; // Replace with the message subject you want to check

//     // Call the custom command to check message delivery by subject search
//     cy.checkMessageDelivery().then((response: any) => {
//       // Add assertions to verify the response and check message delivery
//       expect(response.status).to.equal(200);

//       // Add assertions to verify that at least one message exists
//       expect(response.body).to.have.length.above(0);

//       // You can add more specific assertions based on the response, e.g., verify the message content
//       // ...

//       // If you want to output the message data for debugging:
//       cy.log(JSON.stringify(response.body));
//     });
//   });
// });
