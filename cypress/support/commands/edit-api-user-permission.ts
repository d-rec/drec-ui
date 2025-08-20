Cypress.Commands.add('editApiUserPermission', function () {
  cy.fixture('edit-api-user-permission.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          return cy.get(step.selector).first().click().wait(1000);
        case 'select':
          return cy
            .get(step.selector)
            .click()
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .first()
            .click()
            .wait(500)
            .get('body')
            .click(0, 0)
            .wait(500);
        case 'submit':
          return cy.get(step.selector).click('center');
      }
    });
  });
});
