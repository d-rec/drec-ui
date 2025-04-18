Cypress.Commands.add<any>('getVerificationEmail', () => {
  const inboxId = Cypress.env('MAILTRAP_INBOX_ID');
  const token = Cypress.env('MAILTRAP_API_TOKEN');

  return cy
    .request({
      method: 'GET',
      url: 'https://mailtrap.io/api/accounts/2283066/inboxes/3618064/messages',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .then((response) => {
      console.log(
        `first=========== ${JSON.stringify(response.body)}=================`,
      );
      const messages = response.body;

      const latest = messages.find((msg: any) =>
        msg.subject.includes('Verify your email'),
      );

      // expect(latest, 'Email with verification link').to.exist;

      // return cy
      //   .request({
      //     method: 'GET',
      //     url: `https://mailtrap.io/api/v1/inboxes/3618064/messages/${latest.id}`,
      //     headers: {
      //       Authorization: `Bearer ${token}`,
      //     },
      //   })
      //   .then((htmlResponse) => {
      //     const html = htmlResponse.body;
      //     const match = html.match(/https?:\/\/[^"]+/);
      //     const link = match ? match[0] : null;

      //     expect(link, 'Verification link').to.exist;

      //     return cy.wrap(link);
      //   });
    });
});
