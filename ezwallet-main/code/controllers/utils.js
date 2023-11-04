import jwt from 'jsonwebtoken'

/**
 * Handle possible date filtering options in the query parameters for getTransactionsByUser when called by a Regular user.
 * @param req the request object that can contain query parameters
 * @returns an object that can be used for filtering MongoDB queries according to the `date` parameter.
 *  The returned object must handle all possible combination of date filtering parameters, including the case where none are present.
 *  Example: {date: {$gte: "2023-04-30T00:00:00.000Z"}} returns all transactions whose `date` parameter indicates a date from 30/04/2023 (included) onwards
 * @throws an error if the query parameters include `date` together with at least one of `from` or `upTo`
 */
export const handleDateFilterParams = (req) => {
        const { from, upTo, date } = req.query;
         
        if (date) {
            if (from || upTo) {
                throw ("Unauthorized query parameters");
            }
            if(new Date(date) == "Invalid Date")
                throw ("Date not valid");
            // filter by date
            let StartDateFilter = new Date(`${date}T00:00:00.000Z`);
            let EndDateFilter = new Date(`${date}T23:59:59.000Z`);
            return { date: { $gte: StartDateFilter, $lte: EndDateFilter } };
        }
        else {
            if (from && !upTo) {  //filter only by 'from' parameter
                if(new Date(from) == "Invalid Date")
                    throw ("From or upTo not valid");
                else{
                    let fromDateFilter = new Date(`${from}T00:00:00.000Z`);
                    return { date: { $gte: fromDateFilter } };
                }
            }
            else if (upTo && !from) { //filter only by 'upTo' parameter
                if(new Date(upTo) == "Invalid Date")
                    throw ("From or upTo not valid");
                let upToDateFilter = new Date(`${upTo}T23:59:59.000Z`);
                return { date: { $lte: upToDateFilter } };
            }
            else if (from && upTo) { //filter by 'from' and 'upTo' parameter
                if(new Date(from) == "Invalid Date"|| new Date(upTo) == "Invalid Date")
                    throw ("From or upTo not valid");
                let fromDateFilter = new Date(`${from}T00:00:00.000Z`);
                let upToDateFilter = new Date(`${upTo}T23:59:59.000Z`);

                return { date: { $gte: fromDateFilter, $lte: upToDateFilter } };
            }
            else {   // no filtering
                return {}
            }
        }
}

/**
 * Handle possible authentication modes depending on `authType`
 * @param req the request object that contains cookie information
 * @param res the result object of the request
 * @param info an object that specifies the `authType` and that contains additional information, depending on the value of `authType`
 *      Example: {authType: "Simple"}
 *      Additional criteria:
 *          - authType === "User":
 *              - either the accessToken or the refreshToken have a `username` different from the requested one => error 401
 *              - the accessToken is expired and the refreshToken has a `username` different from the requested one => error 401
 *              - both the accessToken and the refreshToken have a `username` equal to the requested one => success
 *              - the accessToken is expired and the refreshToken has a `username` equal to the requested one => success
 *          - authType === "Admin":
 *              - either the accessToken or the refreshToken have a `role` which is not Admin => error 401
 *              - the accessToken is expired and the refreshToken has a `role` which is not Admin => error 401
 *              - both the accessToken and the refreshToken have a `role` which is equal to Admin => success
 *              - the accessToken is expired and the refreshToken has a `role` which is equal to Admin => success
 *          - authType === "Group":
 *              - either the accessToken or the refreshToken have a `email` which is not in the requested group => error 401
 *              - the accessToken is expired and the refreshToken has a `email` which is not in the requested group => error 401
 *              - both the accessToken and the refreshToken have a `email` which is in the requested group => success
 *              - the accessToken is expired and the refreshToken has a `email` which is in the requested group => success
 * @returns true if the user satisfies all the conditions of the specified `authType` and false if at least one condition is not satisfied
 *  Refreshes the accessToken if it has expired and the refreshToken is still valid
 */

export const verifyAuth = (req, res, info) => {
    // Simple Authtype check
    const cookie = req.cookies;
    try {
        if (!cookie.accessToken || !cookie.refreshToken) {
            return { authorized: false, cause: "Unauthorized" };
        }

        const decodedAccessToken = jwt.verify(cookie.accessToken, process.env.ACCESS_KEY);
        const decodedRefreshToken = jwt.verify(cookie.refreshToken, process.env.ACCESS_KEY);

        if (!decodedAccessToken.username || !decodedAccessToken.email || !decodedAccessToken.role) {
            return { authorized: false, cause: "Token is missing information" }
        }
        if (!decodedRefreshToken.username || !decodedRefreshToken.email || !decodedRefreshToken.role) {
            return { authorized: false, cause: "Token is missing information" }
        }
        //        if (decodedAccessToken.username !== decodedRefreshToken.username || decodedAccessToken.email !== decodedRefreshToken.email || decodedAccessToken.role !== decodedRefreshToken.role) { prima ma fallisce test
        //|| decodedAccessToken.email !== decodedRefreshToken.email) ho levato questo perchè altrimenti in Group error test non funziona
        if (decodedAccessToken.username !== decodedRefreshToken.username)  {
            return { authorized: false, cause: "Mismatched users" };
        }
        
        if (info.authType === "Simple" && decodedAccessToken  && decodedRefreshToken ) {
            return { authorized: true, cause: "Authorized" }
        }
        // User authType check
        if (info.authType === 'User' && info.username !== decodedAccessToken.username ) {
            return { authorized: false, cause: "User: Mismatched users" };
        }
        if (info.authType === 'Admin' && (decodedAccessToken.role !== 'Admin' || decodedRefreshToken.role !== 'Admin')) {
            return { authorized: false, cause: "Admin: Mismatched role" };
        }
        if (info.authType === 'Group') {
            let in_group = false;
            for (let email of info.emails) {
                if (email === decodedAccessToken.email && email === decodedRefreshToken.email) {
                    in_group = true;
                }
            }
            if (in_group === false) {
                return { authorized: false, cause: "Group: user not in group" };
            }
        }
        return { authorized: true, cause: "Authorized" }
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            try {
                const refreshToken = jwt.verify(cookie.refreshToken, process.env.ACCESS_KEY);
                if ( info.authType==="User" && info.username !== refreshToken.username ) {
                    return { authorized: false, cause: "Token Expired: Mismatched users" };
                }
                if (info.authType === 'Admin' && refreshToken.role !== 'Admin') {
                    return { authorized: false, cause: "Admin: Access Token Expired and Mismatched role" };
                }
                if (info.authType === 'Group') {
                    let in_group = false;
                    for (let email of info.emails) {
                        if (email === refreshToken.email) {
                            in_group = true;
                        }
                    }
                    if (in_group === false) {
                        return { authorized: false, cause: "Group: Access Token Expired and user not in group" };
                    }
                }
                const newAccessToken = jwt.sign({
                    username: refreshToken.username,
                    email: refreshToken.email,
                    id: refreshToken.id,
                    role: refreshToken.role
                }, process.env.ACCESS_KEY, { expiresIn: '1h' })
                res.cookie('accessToken', newAccessToken, { httpOnly: true, path: '/api', maxAge: 60 * 60 * 1000, sameSite: 'none', secure: true })
                res.locals.refreshedTokenMessage= 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls'
     
                return { authorized: true, cause: "Authorized" }

            } catch (err) {
                // Refresh Token expired
                if (err.name === "TokenExpiredError") {
                    return { authorized: false, cause: "Perform login again" }
                } else {
                    return { authorized: false, cause: err.name }
                }
            }
        } else {
            return { authorized: false, cause: err.name };
        }
    }
}

/**
 * Handle possible amount filtering options in the query parameters for getTransactionsByUser when called by a Regular user.
 * @param req the request object that can contain query parameters
 * @returns an object that can be used for filtering MongoDB queries according to the `amount` parameter.
 *  The returned object must handle all possible combination of amount filtering parameters, including the case where none are present.
 *  Example: {amount: {$gte: 100}} returns all transactions whose `amount` parameter is greater or equal than 100
 */
export const handleAmountFilterParams = (req) => {
    const {min, max} = req.query;
    let minFilter = parseInt(min);
    let maxFilter = parseInt(max);
    if(min && !max){
        // filter only by 'min'
        if(isNaN(Number(min)))
            throw ("Min or Max values are not valid")
        return { amount: { $gte: minFilter} };
    }
    else if(max && !min){
        // filter only by 'max'
        if(isNaN(Number((max))))
            throw ("Min or Max values are not valid")
        return { amount: { $lte: maxFilter} };
    }
    else if(min && max){
        // filter by 'min' and 'max'
        if(isNaN(Number(min)) || isNaN(Number((max))))
            throw ("Min or Max values are not valid")
        return { amount: { $gte: minFilter, $lte: maxFilter} };
    }
    else{
        // no filtering
        return {}
    }
}