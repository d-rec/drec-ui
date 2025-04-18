// Cypress.Commands.add<any>('getVerificationEmail', () => {
//   const inboxId = Cypress.env('MAILTRAP_INBOX_ID');
//   const apiToken = Cypress.env('MAILTRAP_API_TOKEN');

//   return cy.request({
//     method: 'GET',
//     url: `https://mailtrap.io/api/accounts/2283066/inboxes/3618064/message`,
//     headers: {
//       Authorization: `Bearer ${apiToken}`,
//     },
//   });
// });

// cypress/support/get-verification-email.ts or commands.ts
Cypress.Commands.add<any>('getVerificationEmail', () => {
  const inboxId = Cypress.env('MAILTRAP_INBOX_ID');
  const apiToken = Cypress.env('MAILTRAP_API_TOKEN');

  return cy
    .request({
      method: 'GET',
      url: `https://mailtrap.io/api/accounts/2283066/inboxes/3618064/messages`,
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    })
    .then((res) => {
      const latestEmailId = res.body[0]?.id;
      if (!latestEmailId) throw new Error('No email found in Mailtrap inbox');

      return cy.request({
        method: 'GET',
        url: `https://mailtrap.io/api/accounts/2283066/inboxes/3618064/messages/${latestEmailId}`,
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });
    });
});
