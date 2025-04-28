// import 'cypress-file-upload';
// const ADMIN_EMAIL = Cypress.env('ADMIN_EMAIL');
// const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD');
// const UI_BASE_URL = Cypress.env('UI_BASE_URL');

// Cypress.Commands.add('adminLogin', function () {
//   return cy.fixture('admin-login.json').then((data) => {
//     cy.visit(`${UI_BASE_URL}/login`);

//     data.forEach((step) => {
//       switch (step.action) {
//         case 'type':
//           cy.get(step.selector).type(
//             step.index === 0 ? ADMIN_EMAIL : ADMIN_PASSWORD,
//           );
//           break;
//         case 'click':
//           cy.get(step.selector).click();

//           if (step.selector === '[test-id="login-submit"]') {
//             cy.contains('Login Success').should('be.visible');
//             cy.contains(`Login user ${ADMIN_EMAIL}`).should('be.visible');
//           }
//           break;
//       }
//     });

//     // Check and click "terms-and-conditions" if it exists
//     cy.get('[test-id="terms-and-conditions"]')
//       .should('exist')
//       .then(($checkbox) => {
//         if ($checkbox.length > 0) {
//           cy.wrap($checkbox).click({ force: true }); // Use .click() instead of .check()
//         } else {
//           cy.log('Terms and conditions checkbox not found.');
//         }
//       });

//     // Check and click "accept-terms-and-conditions" button if it exists
//     cy.get('[test-id="accept-terms-and-conditions"]')
//       .should('exist')
//       .then(($button) => {
//         if ($button.length > 0) {
//           cy.wrap($button).click({ force: true });
//         } else {
//           cy.log('Accept terms and conditions button not found.');
//         }
//       });
//   });
// });

import 'cypress-file-upload';
const ADMIN_EMAIL = Cypress.env('ADMIN_EMAIL');
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD');
const UI_BASE_URL = Cypress.env('UI_BASE_URL');

Cypress.Commands.add('adminLogin', function () {
  return cy.fixture('admin-login.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`);

    data.forEach((step) => {
      switch (step.action) {
        case 'type':
          cy.get(step.selector).type(
            step.index === 0 ? ADMIN_EMAIL : ADMIN_PASSWORD,
          );
          break;
        case 'click':
          cy.get(step.selector).click();

          if (step.selector === '[test-id="login-submit"]') {
            cy.contains('Login Success').should('be.visible');
            cy.contains(`Login user ${ADMIN_EMAIL}`).should('be.visible');
          }
          break;
      }
    });

    // Check and click "terms-and-conditions" if it exists
    cy.get('body').then(($body) => {
      const $termsCheckbox = $body.find('[test-id="terms-and-conditions"]');
      if ($termsCheckbox.length > 0) {
        cy.wrap($termsCheckbox).click({ force: true });
      } else {
        cy.log('Terms and conditions checkbox not found.');
      }
    });

    // Check and click "accept-terms-and-conditions" button if it exists
    cy.get('body').then(($body) => {
      const $acceptButton = $body.find(
        '[test-id="accept-terms-and-conditions"]',
      );
      if ($acceptButton.length > 0) {
        cy.wrap($acceptButton).click({ force: true });
      } else {
        cy.log('Accept terms and conditions button not found.');
      }
    });
  });
});
