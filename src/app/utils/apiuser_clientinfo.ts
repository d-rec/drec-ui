export const getapiuser_header = () => {
    let header:any = {};
    let loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    if (loginuser?.role === "ApiUser") {
        header = {
            "client_id": loginuser?.clientId,
            "client_secret": loginuser?.clientSecret
        }

    }
    return header;
}
