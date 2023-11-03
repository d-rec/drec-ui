export const getapiuser_header = () => {
    let header:any = {};
    let loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    console.log(loginuser)
    if (loginuser?.role === "ApiUser") {
        header = {
            "client_id": loginuser?.clientId,
            "client_secret": loginuser?.clientSecret
        }

    }
    return header;
}
// export const getapiuser_header = () => {
//     return new Promise((resolve) => {
//         let interval = setInterval(() => {
//             let loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
//             if (loginuser) {
//                 clearInterval(interval);
//                 if (loginuser?.role === "ApiUser") {
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
