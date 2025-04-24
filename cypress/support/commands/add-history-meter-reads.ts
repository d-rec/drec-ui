import 'cypress-file-upload';
Cypress.Commands.add('addHistoryMeterRead', function () {
  cy.fixture('add-history-meter-read.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          return cy.get(step.selector).click().wait(1000);

        case 'selected':
          return cy
            .get(step.selector)
            .click({ force: true })
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .first()
            .should('be.visible')
            .click({ force: true })
            .wait(1000);

        case 'select-timezone':
          return cy
            .get(step.selector)
            .click({ force: true })
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(0)
            .click('center', { force: true })
            .wait(1000);

        case 'select':
          return cy
            .get(step.selector)
            .click({ force: true })
            .get(step.option)
            .should('have.length.greaterThan', 0)
            .eq(0)
            .click('center', { force: true });

        case 'type':
          return cy
            .get(step.selector)
            .click({ force: true })
            .type(step.value, { force: true })
            .wait(1000);

        case 'start-date':
          return cy
            .get(step.selector)
            .eq(0)
            .click('center', { force: true })
            .get(step.option)
            .eq(0)
            .click()
            .get('.mat-stroked-button')
            .click()
            .wait(1000);

        case 'end-date':
          return cy
            .get(step.selector)
            .eq(1)
            .click('center', { force: true })
            .get(step.option)
            .eq(5)
            .click()
            .get('.mat-stroked-button')
            .click()
            .wait(1000);
        case 'submit':
          cy.get(step.selector).click('center', { force: true });
          return cy.contains('Successfully!').should('be.visible').wait(60000);
      }
    });
  });
});
