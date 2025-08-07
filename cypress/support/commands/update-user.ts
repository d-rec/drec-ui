Cypress.Commands.add('updateUser', function () {
  cy.fixture('update-user.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          return cy.get(step.selector).first().click().wait(1000);

        case 'type':
          return cy
            .get(step.selector)
            .should('be.visible')
            .type(step.value, { force: true });
      }
    });
  });
});
