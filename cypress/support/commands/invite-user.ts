import 'cypress-file-upload';
Cypress.Commands.add('inviteUser', function () {
  cy.fixture('invite-user.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          return cy.get(step.selector).click().wait(1000);
        case 'type':
          return cy.get(step.selector).should('be.visible').type(step.value);
        case 'select':
          return cy
            .get(step.selector)
            .click()
            .get(step.option)
            .contains('User')
            .click()
            .wait(1000);
      }
    });
  });
});
