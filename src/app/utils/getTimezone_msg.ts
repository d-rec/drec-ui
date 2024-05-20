
export const getValidmsgTimezoneFormat = (msg: string) => {
    let message = msg;
    //"The sent date for reading 2023-01-01T07:44:34.000Z is less than last sent meter read date 2023-01-01T07:45:53.000Z"
    let r = /\d\d\d\d\-\d\d\-\d\d\T\d\d\:\d\d:\d\d\.\d\d\dZ/g;
    let dates = message.match(r);
    if (dates != null || dates != undefined) {
        dates.forEach(ele => {
            message = message.replace(ele, new Date(ele).toString())
        })
    }
    return message;
}
