export const getregistrant_header = () => {
  const header: any = {};
  //const loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);

  // if (loginuser?.role === "Registrant") {
  //     header = {
  //         "client_id": loginuser?.clientId,
  //         "client_secret": loginuser?.clientSecret
  //     }

  // }

  return header;
};
// export const getregistrant_header = () => {
//     return new Promise((resolve) => {
//         let interval = setInterval(() => {
//             let loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
//             if (loginuser) {
//                 clearInterval(interval);
//                 if (loginuser?.role === "Registrant") {
//                     const header = {
//                         "client_id": loginuser?.clientId,
//                         "client_secret": loginuser?.clientSecret
//                     };
//                     resolve(header);
//                 } else {
//                     resolve({});
//                 }
//             }
//         }, 100); // Adjust the interval as needed
//     });
// };
