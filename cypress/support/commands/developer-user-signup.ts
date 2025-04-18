import 'cypress-file-upload';
const UI_BASE_URL = Cypress.env('UI_BASE_URL');

Cypress.Commands.add('developerUserSignup', function () {
  cy.fixture('developer-user-signup.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    cy.get('[test-id="register"]').click();

    data.forEach((step) => {
      switch (step.action) {
        case 'type':
          return cy
            .get(step.selector)
            .type(step.value)
            .should('have.value', step.value);
        case 'click':
          return cy.get(step.selector).click().wait(1000);
        case 'select':
          return cy
            .get(step.selector)
            .click()
            .then(() => {
              cy.get('mat-option').contains(step.value).click();
            })
            .wait(2000);
      }
    });

    cy.wait(3000);
    cy.request('http://localhost:1080/email').then((res) => {
      const email = res.body.find(
        (e) => e.to[0].address === 'developer1@energy.org',
      );
      expect(email).to.exist;

      const linkRegex = /https?:\/\/[^\s"]+/;
      const emailBody = email.text || email.html;
      expect(emailBody).to.exist;
      cy.log(emailBody);

      const verificationLink = emailBody.match(linkRegex)?.[0];
      expect(verificationLink, 'Verification link should exist in email').to
        .exist;
      cy.visit(verificationLink);
    });
  });
});
