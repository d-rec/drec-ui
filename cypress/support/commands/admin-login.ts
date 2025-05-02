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

    // cy.get('[test-id="terms-and-conditions"]')
    //   .should('exist')
    //   .then(($checkbox) => {
    //     if ($checkbox.length > 0) {
    //       cy.wrap($checkbox).click({ force: true });
    //     } else {
    //       cy.log('Terms and conditions checkbox not found.');
    //     }
    //   });
    // cy.get('[test-id="accept-terms-and-conditions"]')
    //   .should('exist')
    //   .then(($button) => {
    //     if ($button.length > 0) {
    //       cy.wrap($button).click({ force: true });
    //     } else {
    //       cy.log('Accept terms and conditions button not found.');
    //     }
    //   });

    // cy.get('body').then(($body) => {
    //   if ($body.find('[test-id="terms-and-conditions"]').length > 0) {
    //     cy.get('[test-id="terms-and-conditions"]').click({ force: true });
    //     cy.get('[test-id="accept-terms-and-conditions"]').click({
    //       force: true,
    //     });
    //   } else {
    //     cy.log('Terms and conditions page not shown (already accepted)');
    //   }
    // });
  });
});
