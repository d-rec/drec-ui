// import 'cypress-file-upload';

// const UI_BASE_URL = Cypress.env('UI_BASE_URL');

// Cypress.Commands.add('developerUserSignup', function () {
//   cy.fixture('developer-user-signup.json').then((data) => {
//     cy.visit(`${UI_BASE_URL}/login`).wait(1000);
//     cy.get('[test-id="register"]').click();

//     data.forEach((step) => {
//       switch (step.action) {
//         case 'type':
//           cy.get(step.selector)
//             .type(step.value)
//             .should('have.value', step.value);
//           break;
//         case 'click':
//           cy.get(step.selector).click().wait(1000);
//           break;
//         case 'select':
//           cy.get(step.selector)
//             .click()
//             .then(() => {
//               cy.get('mat-option').contains(step.value).click();
//             });
//           break;
//       }
//     });

//     const email = data.find((s) => s.name === 'email')?.value;
//     console.log('=====', email);

// After form submission, wait and check Mailtrap for verification email
// const email = data.find((s) => s.name === 'email')?.value;
// console.log('=====', email);
// if (!email) throw new Error('Email address not found in signup data');

// cy.wait(5000); // wait for the backend to send the email

// cy.getVerificationEmail().then((response: any) => {
//   const emailBody = response.body.html_body || response.body.text_body;
//   const verificationUrlMatch = emailBody.match(/https?:\/\/[^\s"]+/);
//   const verificationUrl = verificationUrlMatch?.[0];

//   if (verificationUrl) {
//     cy.visit(verificationUrl);
//   } else {
//     throw new Error('Verification link not found in email');
//   }
// });
// });
// });

import 'cypress-file-upload';
import { mockEmailService } from '../commands/mock-email-service'; // Adjust the path if needed

const UI_BASE_URL = Cypress.env('UI_BASE_URL');

Cypress.Commands.add('developerUserSignup', function () {
  cy.fixture('developer-user-signup.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    cy.get('[test-id="register"]').click();

    data.forEach((step) => {
      switch (step.action) {
        case 'type':
          cy.get(step.selector)
            .type(step.value)
            .should('have.value', step.value);
          break;
        case 'click':
          cy.get(step.selector).click().wait(1000);
          break;
        case 'select':
          cy.get(step.selector)
            .click()
            .then(() => {
              cy.get('mat-option').contains(step.value).click();
            });
          break;
      }
    });

    // After the form is filled and submitted, get the email verification link
    cy.then(async () => {
      const email = data.find((s) => s.name === 'email')?.value;
      if (email) {
        const message = await mockEmailService.getLatestEmail(email);
        const verificationUrl =
          mockEmailService.extractVerificationLink(message);

        // Visit the verification link to simulate email confirmation
        cy.visit(verificationUrl);
      } else {
        throw new Error('Email address not found in the signup data');
      }
    });
  });
});
