import 'cypress-file-upload';
const UI_BASE_URL = Cypress.env('UI_BASE_URL');

Cypress.Commands.add('developerUserLogin', function () {
  cy.fixture('developer-user-login.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    data.forEach((step) => {
      switch (step.action) {
        case 'type':
          cy.get(step.selector).type(step.value);
          break;
        case 'click':
          cy.get(step.selector).click().wait(1000);
      }
    });
  });
});
