import { handleDateFilterParams, verifyAuth, handleAmountFilterParams } from '../controllers/utils';
import jwt from 'jsonwebtoken'
/* * @returns an object that can be used for filtering MongoDB queries according to the `date` parameter.
 *  The returned object must handle all possible combination of date filtering parameters, including the case where none are present.
 *  Example: {date: {$gte: "2023-04-30T00:00:00.000Z"}} returns all transactions whose `date` parameter indicates a date from 30/04/2023 (included) onwards
 * @throws an error if the query parameters include `date` together with at least one of `from` or `upTo`*/
describe("handleDateFilterParams", () => {
    test('Returns an object with a date attribute used for filtering mongoose aggregate queries - from parameter', () => {
        const req = {
            query: {
                from: '2023-04-30'
            }
        };

        const result = handleDateFilterParams(req);

        expect(result).toEqual({
            date: { $gte: new Date('2023-04-30T00:00:00.000Z') },
        });
    });

    test('Returns an object with a date attribute used for filtering mongoose aggregate queries - upTo parameter', () => {
        const req = {
            query: {
                upTo: '2023-05-10'
            }
        };

        const result = handleDateFilterParams(req);

        expect(result).toEqual({
            date: { $lte: new Date('2023-05-10T23:59:59.000Z') },
        });
    });

    test('Returns an object with a date attribute used for filtering mongoose aggregate queries - from and upTo parameters', () => {
        const req = {
            query: {
                from: '2023-04-30',
                upTo: '2023-05-10'
            }
        };

        const result = handleDateFilterParams(req);

        expect(result).toEqual({
            date: {
                $gte: new Date('2023-04-30T00:00:00.000Z'),
                $lte: new Date('2023-05-10T23:59:59.000Z'),
            },
        });
    });

    test('Returns an object with a date attribute used for filtering mongoose aggregate queries - date parameter', () => {
        const req = {
            query: {
                date: '2023-05-10'
            }
        };

        const result = handleDateFilterParams(req);

        expect(result).toEqual({
            date: {
                $gte: new Date('2023-05-10T00:00:00.000Z'),
                $lte: new Date('2023-05-10T23:59:59.000Z'),
            },
        });
    });

    test('Returns an empty object if there are no query parameters', () => {
        const req = { query:{} };

        const result = handleDateFilterParams(req);

        expect(result).toEqual({});
    });

    test('Throws an error if date is present with from parameter', () => {
        const req = {
            query: {
                date: '2023-05-10',
                from: '2023-04-30'   
            }
        };

        expect(() => handleDateFilterParams(req)).toThrow('Unauthorized query parameters');
    });

    test('Throws an error if date is present with upTo parameter', () => {
        const req = {
            query: {
                date: '2023-05-10',
                upTo: '2023-05-20'
            }
        };

        expect(() => handleDateFilterParams(req)).toThrow('Unauthorized query parameters');
    });

    test('Throws an error if the value of any query parameter is not a valid date (from only)', () => {
        const req = {
            query: {
                from: 'invalid-date'
            }
        };

        expect(() => handleDateFilterParams(req)).toThrow('From or upTo not valid');
    });
    test('Throws an error if the value of any query parameter is not a valid date (date only)', () => {
        const req = {
            query: {
                date: 'invalid-date'
            }
        };

        expect(() => handleDateFilterParams(req)).toThrow('Date not valid');
    });
    test('Throws an error if the value of any query parameter is not a valid date (upTo only)', () => {
        const req = {
            query: {
                upTo: 'invalid-date'
            }
        };

        expect(() => handleDateFilterParams(req)).toThrow('From or upTo not valid');
    });
    test('Throws an error if the value of any query parameter is not a valid date (from and upTo only)', () => {
        const req = {
            query: {
                from: 'invalid-date',
                upTo: 'invalid-date'
            }
        };

        expect(() => handleDateFilterParams(req)).toThrow('From or upTo not valid');
    });
});

process.env.ACCESS_KEY = "EZWALLET";
const adminAccessTokenValid = jwt.sign({
    email: "admin@email.com",
    //id: existingUser.id, The id field is not required in any check, so it can be omitted
    username: "admin",
    role: "Admin"
}, process.env.ACCESS_KEY, { expiresIn: '1y' })

const userAccessTokenValidFieldMissing = jwt.sign({
    username: "user",
    role: "Regular"
}, process.env.ACCESS_KEY, { expiresIn: '1y' })

const testerAccessTokenValid = jwt.sign({
    email: "tester@test.com",
    username: "tester",
    role: "Regular"
}, process.env.ACCESS_KEY, { expiresIn: '1y' })

//These tokens can be used in order to test the specific authentication error scenarios inside verifyAuth (no need to have multiple authentication error tests for the same route)
const testerAccessTokenExpired = jwt.sign({
    email: "tester@test.com",
    username: "tester",
    role: "Regular"
}, process.env.ACCESS_KEY, { expiresIn: '0s' })
const testerAccessTokenEmpty = jwt.sign({}, process.env.ACCESS_KEY, { expiresIn: "1y" })

describe("utils.js", () => {
    describe("verifyAuth", () => {

        test("Tokens are both valid and belong to the requested user", () => {

            const req = { cookies: { accessToken: testerAccessTokenValid, refreshToken: testerAccessTokenValid } }
            const res = {}
            const response = verifyAuth(req, res, { authType: "User", username: "tester" })
            //The response object must contain a field that is a boolean value equal to true, it does not matter what the actual name of the field is
            //Checks on the "cause" field are omitted since it can be any string
            expect(Object.values(response).includes(true)).toBe(true)
        })
        test("Tokens are both valid and belong to the requested user with authTipe:Simple", () => {

            const req = { cookies: { accessToken: testerAccessTokenValid, refreshToken: testerAccessTokenValid } }
            const res = {}
            const response = verifyAuth(req, res, { authType: "Simple" })
            //The response object must contain a field that is a boolean value equal to true, it does not matter what the actual name of the field is
            //Checks on the "cause" field are omitted since it can be any string
            expect(Object.values(response).includes(true)).toBe(true)
        })
        test("Undefined tokens", () => {
            const req = { cookies: {} }
            const res = {}
            const response = verifyAuth(req, res, { authType: "Simple" })
            //The test is passed if the function returns an object with a false value, no matter its name
            expect(Object.values(response).includes(false)).toBe(true)
        })
        test("Access token has missing fields", () => {

            const req = { cookies: { accessToken: userAccessTokenValidFieldMissing, refreshToken: testerAccessTokenValid } }
            const res = {}
            const response = verifyAuth(req, res, { authType: "User", username: "tester" })
            //The response object must contain a field that is a boolean value equal to true, it does not matter what the actual name of the field is
            //Checks on the "cause" field are omitted since it can be any string
            expect(Object.values(response).includes(true)).toBe(false)
        })
        test("Refresh token has missing fields", () => {

            const req = { cookies: { accessToken: testerAccessTokenValid, refreshToken: userAccessTokenValidFieldMissing } }
            const res = {}
            const response = verifyAuth(req, res, { authType: "User", username: "tester" })
            //The response object must contain a field that is a boolean value equal to true, it does not matter what the actual name of the field is
            //Checks on the "cause" field are omitted since it can be any string
            expect(Object.values(response).includes(true)).toBe(false)
        })
        test("Mismatching usernames in tokens", () => {

            const req = { cookies: { accessToken: testerAccessTokenValid, refreshToken: adminAccessTokenValid } }
            const res = {}
            const response = verifyAuth(req, res, { authType: "User", username: "tester" })
            //The response object must contain a field that is a boolean value equal to true, it does not matter what the actual name of the field is
            //Checks on the "cause" field are omitted since it can be any string
            expect(Object.values(response).includes(true)).toBe(false)
        })
        test("Mismatching usernames tokens and info.username", () => {

            const req = { cookies: { accessToken: testerAccessTokenValid, refreshToken: testerAccessTokenValid } }
            const res = {}
            const response = verifyAuth(req, res, { authType: "User", username: "testerWrong" })

            expect(Object.values(response).includes(true)).toBe(false)
        })
        test("Mismatching roles in Authtype: admin", () => {

            const req = { cookies: { accessToken: testerAccessTokenValid, refreshToken: testerAccessTokenValid } }
            const res = {}
            const response = verifyAuth(req, res, { authType: "Admin" })

            expect(Object.values(response).includes(true)).toBe(false)
        })
        test('Returns an object indicating unauthorized when authType is Group and user is not in the group', () => {
            const req = {
                cookies: {
                    accessToken: testerAccessTokenValid,
                    refreshToken: testerAccessTokenValid,
                },
            };

            const info = {
                authType: 'Group',
                emails: ['email1@example.com', 'email@example.com'],
            };



            const response = verifyAuth(req, {}, info);

            expect(Object.values(response).includes(true)).toBe(false)

        });
        test('Returns authorized when authType is Group and user is  in the group', () => {
            const req = {
                cookies: {
                    accessToken: testerAccessTokenValid,
                    refreshToken: testerAccessTokenValid,
                },
            };

            const info = {
                authType: 'Group',
                emails: ['tester@test.com', 'email@example.com'],
            };



            const response = verifyAuth(req, {}, info);

            expect(Object.values(response).includes(true)).toBe(true)

        });
        test("Token Expired: Mismatched users", () => {

            const req = { cookies: { accessToken: testerAccessTokenExpired, refreshToken: testerAccessTokenValid } }
            const res = {}
            const response = verifyAuth(req, res, { authType: "User", username: "testerWrong" })
            //The response object must contain a field that is a boolean value equal to true, it does not matter what the actual name of the field is
            //Checks on the "cause" field are omitted since it can be any string
            expect(Object.values(response).includes(true)).toBe(false)
        })
        test("Token Expired: Mismatched roles", () => {

            const req = { cookies: { accessToken: testerAccessTokenExpired, refreshToken: testerAccessTokenValid } }
            const res = {}
            const response = verifyAuth(req, res, { authType: "Admin" })
            //The response object must contain a field that is a boolean value equal to true, it does not matter what the actual name of the field is
            //Checks on the "cause" field are omitted since it can be any string
            expect(Object.values(response).includes(true)).toBe(false)
        })
        test('Token Expired:Returns an object indicating unauthorized when authType is Group and user is not in the group', () => {
            const req = {
                cookies: {
                    accessToken: testerAccessTokenExpired,
                    refreshToken: testerAccessTokenValid,
                },
            };

            const info = {
                authType: 'Group',
                emails: ['email1@example.com', 'email@example.com'],
            };



            const response = verifyAuth(req, {}, info);

            expect(Object.values(response).includes(true)).toBe(false)

        });
        test('Token Expired:Returns authorized when authType is Group and user is  in the group', () => {
            const req = {
                cookies: {
                    accessToken: testerAccessTokenExpired,
                    refreshToken: testerAccessTokenValid,
                },
            };
            const cookieMock = (name, value, options) => {
                res.cookieArgs = { name, value, options };
            }
            //In this case the response object must have a "cookie" function that sets the needed values, as well as a "locals" object where the message must be set 
            const res = {
                cookie: cookieMock,
                locals: {},
            }
            const info = {
                authType: 'Group',
                emails: ['tester@test.com', 'email@example.com'],
            };

            const response = verifyAuth(req,res, info);

            expect(Object.values(response).includes(true)).toBe(true)

        });
        
        test('Generic Error (TypeError)', () => {
            const req = {
                cookies: {
                    accessToken: testerAccessTokenExpired,
                    refreshToken: testerAccessTokenValid,
                },
            };

            //In this case the response object must have a "cookie" function that sets the needed values, as well as a "locals" object where the message must be set 
            const res = {

            }
            const info = {
                authType: 'Group',
                emails: ['tester@test.com', 'email@example.com'],
            };

            const response = verifyAuth(req,res, info);

            expect(Object.values(response).includes(true)).toBe(false)

        });
        test("Both Token Expired", () => {

            const req = { cookies: { accessToken: testerAccessTokenExpired, refreshToken: testerAccessTokenExpired } }
            const res = {}
            const response = verifyAuth(req, res, { authType: "User", username: "tester" })
            //The response object must contain a field that is a boolean value equal to true, it does not matter what the actual name of the field is
            //Checks on the "cause" field are omitted since it can be any string
            expect(Object.values(response).includes(true)).toBe(false)
        })
        /**
         * The only situation where the response object is actually interacted with is the case where the access token must be refreshed
         */
        test("Access token expired and refresh token belonging to the requested user", () => {
            const req = { cookies: { accessToken: testerAccessTokenExpired, refreshToken: testerAccessTokenValid } }
            //The inner working of the cookie function is as follows: the response object's cookieArgs object values are set
            const cookieMock = (name, value, options) => {
                res.cookieArgs = { name, value, options };
            }
            //In this case the response object must have a "cookie" function that sets the needed values, as well as a "locals" object where the message must be set 
            const res = {
                cookie: cookieMock,
                locals: {},
            }
            const response = verifyAuth(req, res, { authType: "User", username: "tester" })
            //The response must have a true value (valid refresh token and expired access token)
            expect(Object.values(response).includes(true)).toBe(true)
            expect(res.cookieArgs).toEqual({
                name: 'accessToken', //The cookie arguments must have the name set to "accessToken" (value updated)
                value: expect.any(String), //The actual value is unpredictable (jwt string), so it must exist
                options: { //The same options as during creation
                    httpOnly: true,
                    path: '/api',
                    maxAge: 60 * 60 * 1000,
                    sameSite: 'none',
                    secure: true,
                },
            })
            //The response object must have a field that contains the message, with the name being either "message" or "refreshedTokenMessage"
            const message = res.locals.refreshedTokenMessage ? true : res.locals.message ? true : false
            expect(message).toBe(true)
        })
    })
})


describe("handleAmountFilterParams", () => {
    test('Returns an object with an amount attribute used for filtering mongoDBs aggregate queries - min parameter', () => {
        const req = {
            query: {
                min: '10'
            }
        };

        const result = handleAmountFilterParams(req);

        expect(result).toEqual({
            amount: { $gte: 10 },
        });
    });

    test('Returns an object with an amount attribute used for filtering mongoose aggregate queries - max parameter', () => {
        const req = {
            query: {
                max: '50'
            }
        };

        const result = handleAmountFilterParams(req);

        expect(result).toEqual({
            amount: { $lte: 50 },
        });
    });

    test('Returns an object with an amount attribute used for filtering mongoose aggregate queries - min and max parameters', () => {
        const req = {
            query: {
                min: '10',
                max: '50'
            }
        };

        const result = handleAmountFilterParams(req);

        expect(result).toEqual({
            amount: {
                $gte: 10,
                $lte: 50,
            },
        });
    });

    test('Throws an error if the value of any query parameter is not a numerical value - min parameter', () => {
        const req = {
            query: {
                min: 'invalid'
            }
        };

        expect(() => handleAmountFilterParams(req)).toThrow('Min or Max values are not valid');
    });

    test('Throws an error if the value of any query parameter is not a numerical value - max parameter', () => {
        const req = {
            query: {
                max: 'invalid'
            }
        };

        expect(() => handleAmountFilterParams(req)).toThrow('Min or Max values are not valid');
    });
    test('Throws an error if the value of any query parameter is not a numerical value but are both defined - max parameter', () => {
        const req = {
            query: {
                max: 'invalid',
                min: "10"
            }
        };

        expect(() => handleAmountFilterParams(req)).toThrow('Min or Max values are not valid');
    });
    test('Returns an empty object if there are no query parameters', () => {
        const req = { query:{} };

        const result = handleAmountFilterParams(req);

        expect(result).toEqual({});
    });
})
