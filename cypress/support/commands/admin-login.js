import 'cypress-file-upload';
const ADMIN_EMAIL = Cypress.env('ADMIN_EMAIL');
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD');
const UI_BASE_URL = Cypress.env('UI_BASE_URL');

Cypress.Commands.add('adminLogin', function () {
    cy.fixture('admin-login.js').then((data) => {
      cy.visit(`${UI_BASE_URL}/login`).wait(1000);
      
      data.forEach((step) => {
        if (step.action === 'type') {
          cy.get(step.selector).type(
            step.index === 0 ? ADMIN_EMAIL : ADMIN_PASSWORD
          );
        }
        if (step.action === 'click') {
          cy.get(step.selector).click();
          if (step.selector === '[test-id="login-submit"]') {
            cy.contains('Login Success').should('be.visible');
            cy.contains(`Login user ${ADMIN_EMAIL}`).should('be.visible');
          }
        }
      });
    });
  });