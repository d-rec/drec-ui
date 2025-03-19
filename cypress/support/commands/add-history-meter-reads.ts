import 'cypress-file-upload';
Cypress.Commands.add('addHistoryMeterRead', function () {
  cy.fixture('add-history-meter-read.json').then((data) => {
    data.forEach((step) => {
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
      if (step.action === 'selected') {
        return cy
          .get(step.selector)
          .click({ force: true })
          .wait(1000)
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .first()
          .should('be.visible')
          .click({ force: true })
          .wait(1000);
      }
      if (step.action === 'select-timezone') {
        return cy
          .get(step.selector)
          .click({ force: true })
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .eq(0)
          .click('center', { force: true });
      }
      if (step.action === 'select') {
        return cy
          .get(step.selector)
          .click({ force: true })
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .eq(0)
          .click('center', { force: true });
      }

      if (step.action === 'type') {
        return cy
          .get(step.selector)
          .wait(1000)
          .click({ force: true })
          .type(step.value, { force: true });
      }
      if (step.action === 'start-date') {
        return cy
          .get(step.selector)
          .eq(0)
          .click('center', { force: true })
          .get(step.option)
          .eq(0)
          .click()
          .get('.mat-stroked-button')
          .click();
      }
      if (step.action === 'end-date') {
        return cy
          .get(step.selector)
          .eq(1)
          .click('center', { force: true })
          .get(step.option)
          .eq(5)
          .click()
          .get('.mat-stroked-button')
          .click();
      }
    });
  });
});
