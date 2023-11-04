import { handleDateFilterParams, verifyAuth, handleAmountFilterParams } from '../controllers/utils';
import jwt from 'jsonwebtoken'

beforeEach(() => {
    jest.clearAllMocks()
});

/*/*handleDateFilterParams
Returns an object with a date attribute used for filtering mongoDB's aggregate queries
The value of date is an object that depends on the query parameters:
If the query parameters include from then it must include a $gte attribute that specifies the starting date as a Date object in the format YYYY-MM-DDTHH:mm:ss
Example: /api/users/Mario/transactions?from=2023-04-30 => {date: {$gte: 2023-04-30T00:00:00.000Z}}
If the query parameters include upTo then it must include a $lte attribute that specifies the ending date as a Date object in the format YYYY-MM-DDTHH:mm:ss
Example: /api/users/Mario/transactions?upTo=2023-05-10 => {date: {$lte: 2023-05-10T23:59:59.000Z}}
If both from and upTo are present then both $gte and $lte must be included
If date is present then it must include both $gte and $lte attributes, these two attributes must specify the same date as a Date object in the format YYYY-MM-DDTHH:mm:ss
Example: /api/users/Mario/transactions?date=2023-05-10 => {date: {$gte: 2023-05-10T00:00:00.000Z, $lte: 2023-05-10T23:59:59.000Z}}
If there is no query parameter then it returns an empty object
Example: /api/users/Mario/transactions => {}
Throws an error if date is present in the query parameter together with at least one of from or upTo
Throws an error if the value of any of the three query parameters is not a string that represents a date in the format YYYY-MM-DD*/
describe("handleDateFilterParams", () => {
    //passing date
    test('Should return the correct filter object when filtering by date', () => {
        const req = {
            query: {date: '2023-05-29'}
        }

        const response = {
            date: {
                $gte: new Date('2023-05-29T00:00:00.000Z'),
                $lte: new Date('2023-05-29T23:59:59.000Z'),
            },
        };

        const result = handleDateFilterParams(req);
        expect(result).toEqual(response);

    });
    //passing upTo
    test('Should return the correct filter object when filtering by upTo', () => {
        const req = {
            query: {upTo: '2023-05-29'}
        }

        const response = {
            date: {
                $lte: new Date('2023-05-29T23:59:59.000Z'),
            },
        };
        const result = handleDateFilterParams(req);
        expect(result).toEqual(response);
    });
    //passing from
    test('Should return the correct filter object when filtering by from', () => {
        const req = {
            query: {from: '2023-05-29'}
        }
        const response = {
            date: {
                $gte: new Date('2023-05-29T00:00:00.000Z'),
            },
        };
        const result = handleDateFilterParams(req);
        expect(result).toEqual(response);
    });
    //passing from and upTo
    test('Should return the correct filter object when filtering from a date to an other', () => {
        const req = {
            query: {
                from: '2023-05-29',
                upTo: '2023-06-02'
            }
        }

        const response = {
            date: {
                $gte: new Date('2023-05-29T00:00:00.000Z'),
                $lte: new Date('2023-06-02T23:59:59.000Z'),
            },
        };

        const result = handleDateFilterParams(req);
        expect(result).toEqual(response);

    });
    //no query parameter
    test('Should return an empty object when no query parameters are passed', () => {
        const req = { query:{} }

        const response = {};

        const result = handleDateFilterParams(req);
        expect(result).toEqual(response);

    });
    //Throws an error if date is present in the query parameter together with at least one of from or upTo
    test('Should throws an error when are present both date and from ', () => {
        const req = {
            query: {
                from: '2023-05-29',
                date: '2023-06-08'
            }
        }
        expect(() => {
            handleDateFilterParams(req);
        }).toThrow("Unauthorized query parameters");
    });
    //Throws an error if date is present in the query parameter together with at least one of from or upTo
    test('Should throws an error when are present both date and upTo ', () => {
        const req = {
            query: {
                date: '2023-05-29',
                upTo: '2023-06-08'
            }
        }
        expect(() => {
            handleDateFilterParams(req);
        }).toThrow("Unauthorized query parameters");
    });
    //Throws an error if date is present in the query parameter together with at least one of from or upTo
    test('Should throws an error when are present  date, from and upTo', () => {
        const req = {
            query: {
                from: '2023-05-29',
                date: '2023-06-08',
                upTo: '2023-06-11'
            }
        }
        expect(() => {
            handleDateFilterParams(req);
        }).toThrow("Unauthorized query parameters");
    });
    //Throws an error if the value of any of the three query parameters is not a string that represents a date in the format YYYY-MM-DD  
    test('should throw an error when date is not valid', () => {
        const req = {
            query: {
                date: 'InvalidDate'
            }
        };

        expect(() => {
            handleDateFilterParams(req);
        }).toThrow('Date not valid');
    });
    //Throws an error if the value of any of the three query parameters is not a string that represents a date in the format YYYY-MM-DD  
    test('should throw an error when upTo is not valid', () => {
        const req = {
            query: {
                upTo: 'InvalidDate'
            }
        };

        expect(() => {
            handleDateFilterParams(req);
        }).toThrow("From or upTo not valid");
    });
    //Throws an error if the value of any of the three query parameters is not a string that represents a date in the format YYYY-MM-DD  
    test('should throw an error when from is not valid', () => {
        const req = {
            query: {
                from: 'InvalidDate'
            }
        };

        expect(() => {
            handleDateFilterParams(req);
        }).toThrow("From or upTo not valid");
    });
    test('should throw an error when from or upTo are not valid but both defined', () => {
        const req = {
            query: {
                from: 'InvalidDate',
                upTo: '2023-06-08'
            }
        };

        expect(() => {
            handleDateFilterParams(req);
        }).toThrow("From or upTo not valid");
    });

})

/* @param req the request object that contains cookie information
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


// per esempio  "" the accessToken is expired and the refreshToken has a `role` which is not Admin" => devo fare 3 test? uno per user, uno per group e uno per simple?
process.env.ACCESS_KEY = 'EZWALLET';

describe('verifyAuth', () => {
    // SIMPLE
    test('Should return the correct result when authentication is successful using Simple authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'testuser', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
                refreshToken: jwt.sign({ username: 'testuser', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Simple',
        };

        const response = {
            authorized: true,
            cause: 'Authorized',
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    test('Should not return the correct result when authentication is not successful using Simple authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'testuser', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
                refreshToken: "undefined",
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Simple',
        };

        const response = {
            authorized: false,
            cause: "JsonWebTokenError",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    test('Should return non authorized when accessToken or  refreshToken are not both defined', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'admin', email: 'admin@example.com', role: 'Admin' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),

            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Admin',
        };

        const response = {
            authorized: false,
            cause: "Unauthorized",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    test('Should return non authorized when accessToken has missing information', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'admin', role: 'Admin' }, process.env.ACCESS_KEY),
                refreshToken: jwt.sign({ username: 'testuser', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),

            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Admin',
        };

        const response = {
            authorized: false,
            cause: "Token is missing information",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    test('Should return non authorized when refreshToken has missing information', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'admin', email: 'test@example.com', role: 'Admin' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
                refreshToken: jwt.sign({ username: 'testuser', email: 'test@example.com' }, process.env.ACCESS_KEY),

            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Admin',
        };

        const response = {
            authorized: false,
            cause: "Token is missing information",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    // USER
    //both the accessToken and the refreshToken have a `username` equal to the requested one => success
    test('should return the correct result when authentication is successful using User authType and matching username', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'testuser', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
                refreshToken: jwt.sign({ username: 'testuser', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'User',
            username: 'testuser',
        };

        const response = {
            authorized: true,
            cause: 'Authorized',
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    test('should return "Mismatched users" when accessToken have a `username` different from the requested one using User authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'testuserNotTheSame', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
                refreshToken: jwt.sign({ username: 'testuserNotTheSame', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'User',
            username: 'testuser',
        };

        const response = {
            authorized: false,
            cause: "User: Mismatched users",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    //either the accessToken or the refreshToken have a `username` different from the requested one => error 401
    test('should return "Mismatched users" when accessToken have a `username` different from the requested one using User authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'testuserNotTheSame', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
                refreshToken: jwt.sign({ username: 'testuser', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'User',
            username: 'testuser',
        };

        const response = {
            authorized: false,
            cause: "Mismatched users",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    //either the accessToken or the refreshToken have a `username` different from the requested one => error 401
    test('should return "Mismatched users" when refreshToken have a `username` different from the requested one using User authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'testuser', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
                refreshToken: jwt.sign({ username: 'testuserNotTheSame', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Regular',
            username: 'testuser',
        };

        const response = {
            authorized: false,
            cause: "Mismatched users",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    //the accessToken is expired and the refreshToken has a `username` different from the requested one => error 401
    test('should return "Token Expired: Mismatched users" when access token is expired and mismatched users for Regular authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'testuser', email: 'test@example.com', role: 'Regular', exp: Math.floor(Date.now() / 1000) - 30 }, process.env.ACCESS_KEY),
                refreshToken: jwt.sign({ username: 'testuserNotTheSame', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'User',
            username: 'testuser',
        };
        const response = {
            authorized: false,
            cause: "Token Expired: Mismatched users",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    //- the accessToken is expired and the refreshToken has a `username` equal to the requested one => success
    test('should return the correct result when access token is expired and the refreshToken has a `username` equal to the requested one for Regular authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'testuser', email: 'test@example.com', role: 'Regular', exp: Math.floor(Date.now() / 1000) - 30 }, process.env.ACCESS_KEY),
                refreshToken: jwt.sign({ username: 'testuser', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Regular',
            username: 'testuser',
        };
        const response = {
            authorized: true,
            cause: "Authorized",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    // ADMIN
    //both the accessToken and the refreshToken have a `role` which is equal to Admin => success
    test('Should return the correct result when authentication is successful using Admin authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'admin', email: 'admin@example.com', role: 'Admin' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
                refreshToken: jwt.sign({ username: 'admin', email: 'admin@example.com', role: 'Admin' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Admin',
        };

        const response = {
            authorized: true,
            cause: 'Authorized',
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    //either the accessToken or the refreshToken have a `role` which is not Admin => error 401
    test('Should return "Admin: Mismatched role" when the accessToken have a `role` which is not Admin using Admin authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'admin', email: 'admin@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
                refreshToken: jwt.sign({ username: 'admin', email: 'admin@example.com', role: 'Admin' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Admin',
        };

        const response = {
            authorized: false,
            cause: "Admin: Mismatched role",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    //either the accessToken or the refreshToken have a `role` which is not Admin => error 401
    test('Should return "Admin: Mismatched role" when the refreshToken have a `role` which is not Admin using Admin authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'admin', email: 'admin@example.com', role: 'Admin' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
                refreshToken: jwt.sign({ username: 'admin', email: 'admin@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Admin',
        };

        const response = {
            authorized: false,
            cause: "Admin: Mismatched role",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    //the accessToken is expired and the refreshToken has a `role` which is not Admin => error 401
    test('Should return non authorized when accessToken is expired and  the refreshToken have a `role` which is not Admin using Admin authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'admin', email: 'admin@example.com', role: 'Admin', exp: Math.floor(Date.now() / 1000) - 30 }, process.env.ACCESS_KEY),
                refreshToken: jwt.sign({ username: 'admin', email: 'admin@example.com', role: 'Simple' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Admin',
        };

        const response = {
            authorized: false,
            cause: "Admin: Access Token Expired and Mismatched role",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    //the accessToken is expired and the refreshToken has a `role` which is equal to Admin => success
    test('Should return authorized when accessToken is expired and the refreshToken have a `role` which is Admin using Admin authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'admin', email: 'admin@example.com', role: 'Admin', exp: Math.floor(Date.now() / 1000) - 30 }, process.env.ACCESS_KEY),
                refreshToken: jwt.sign({ username: 'admin', email: 'admin@example.com', role: 'Admin' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Admin',
        };

        const response = {
            authorized: true,
            cause: "Authorized",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    // GROUP
    //both the accessToken and the refreshToken have a `email` which is in the requested group => success
    test('should return Authorized when accessToken and  refreshToken have a `email` which is in group for Group authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'groupUser', email: 'groupUser@example.com', role: 'Regular' }, process.env.ACCESS_KEY),
                refreshToken: jwt.sign({ username: 'groupUser', email: 'groupUser@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Group',
            emails: ['groupUser@example.com', 'testUser@example.com'],
        };

        const response = {
            authorized: true,
            cause: "Authorized",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    //either the accessToken or the refreshToken have a `email` which is not in the requested group => error 401
    test('should return not Authorized when accessToken has a `email` which is not in group for Group authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'groupUser', email: 'groupUserNotInGroup@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
                refreshToken: jwt.sign({ username: 'groupUser', email: 'groupUser@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Group',
            emails: ['groupUser@example.com', 'testUser@example.com'],
        };

        const response = {
            authorized: false,
            cause: "Group: user not in group",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    //either the accessToken or the refreshToken have a `email` which is not in the requested group => error 401
    test('should return not Authorized when refreshToken has a `email` which is not in group for Group authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'groupUser', email: 'groupUser@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
                refreshToken: jwt.sign({ username: 'groupUser', email: 'groupUserNotInGroup@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Group',
            emails: ['groupUser@example.com', 'testUser@example.com'],
        };

        const response = {
            authorized: false,
            cause: "Group: user not in group",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    //the accessToken is expired and the refreshToken has a `email` which is not in the requested group => error 401
    test('should return not Authorized when accessToken is expired and  refreshToken has a `email` which is not in group for Group authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'groupUser', email: 'groupUser@example.com', role: 'Regular', exp: Math.floor(Date.now() / 1000) - 30 }, process.env.ACCESS_KEY),
                refreshToken: jwt.sign({ username: 'groupUser', email: 'groupUserNotInGroup@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Group',
            emails: ['groupUser@example.com', 'testUser@example.com'],
        };

        const response = {
            authorized: false,
            cause: "Group: Access Token Expired and user not in group",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    //the accessToken is expired and the refreshToken has a `email` which is in the requested group => success
    test('should return Authorized when accessToken is expired and  refreshToken has a `email` which is in group for Group authType', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'groupUser', email: 'groupUser@example.com', role: 'Regular', exp: Math.floor(Date.now() / 1000) - 30 }, process.env.ACCESS_KEY),
                refreshToken: jwt.sign({ username: 'groupUser', email: 'groupUser@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Group',
            emails: ['groupUser@example.com', 'testUser@example.com'],
        };

        const response = {
            authorized: true,
            cause: "Authorized",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    test('should return not Authorized when access and refresh token are both expired (Simple)', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'groupUser', email: 'groupUser@example.com', role: 'Regular', exp: Math.floor(Date.now() / 1000) - 30 }, process.env.ACCESS_KEY),
                refreshToken: jwt.sign({ username: 'groupUser', email: 'groupUser@example.com', role: 'Regular', exp: Math.floor(Date.now() / 1000) - 30 }, process.env.ACCESS_KEY),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Simple',
        };

        const response = {
            authorized: false,
            cause: "Perform login again",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
    test('should return not Authorized when access and refresh token are both expired (Group)', () => {
        const req = {
            cookies: {
                accessToken: jwt.sign({ username: 'groupUser', email: 'groupUser@example.com', role: 'Regular', exp: Math.floor(Date.now() / 1000) - 30 }, process.env.ACCESS_KEY),
                refreshToken: jwt.sign({ username: 'groupUser', email: 'groupUser@example.com', role: 'Regular', exp: Math.floor(Date.now() / 1000) - 30 }, process.env.ACCESS_KEY),
            },
        };
        const res = {
            cookie: jest.fn(),
            locals: {},
        };
        const info = {
            authType: 'Group',
            emails: [],
        };

        const response = {
            authorized: false,
            cause: "Perform login again",
        };

        const result = verifyAuth(req, res, info);
        expect(result).toEqual(response);
    });
  
});
/*Returns an object with an amount attribute used for filtering mongoDB's aggregate queries
The value of amount is an object that depends on the query parameters:
If the query parameters include min then it must include a $gte attribute that is an integer equal to min
Example: /api/users/Mario/transactions?min=10 => `{amount: {$gte: 10} }
If the query parameters include min then it must include a $lte attribute that is an integer equal to max
Example: /api/users/Mario/transactions?min=50 => `{amount: {$lte: 50} }
If both min and max are present then both $gte and $lte must be included
Throws an error if the value of any of the two query parameters is not a numerical value*/
describe("handleAmountFilterParams", () => {
    test('should return the correct filter object when filtering by min amount only', () => {
        const req = {
            query: {min: '100'}
        };

        const expectedFilter = {
            amount: {
                $gte: 100,
            },
        };

        const result = handleAmountFilterParams(req);
        expect(result).toEqual(expectedFilter);
    });

    test('should return the correct filter object when filtering by max amount only', () => {
        const req = {
            query: {max: '500'}
        };

        const expectedFilter = {
            amount: {
                $lte: 500,
            },
        };

        const result = handleAmountFilterParams(req);
        expect(result).toEqual(expectedFilter);
    });

    test('should return the correct filter object when filtering by min and max amount', () => {
        const req = {
            query: {
                min: '100',
                max: '500',
            }
        };

        const expectedFilter = {
            amount: {
                $gte: 100,
                $lte: 500,
            },
        };

        const result = handleAmountFilterParams(req);
        expect(result).toEqual(expectedFilter);
    });

    test('should throw an error when min value is not valid', () => {
        const req = {
            query: {min: 'InvalidMin'}
        };

        expect(() => {
            handleAmountFilterParams(req);
        }).toThrow('Min or Max values are not valid');
    });

    test('should throw an error when max value is not valid', () => {
        const req = {
            query: {max: 'InvalidMax'}
        };

        expect(() => {
            handleAmountFilterParams(req);
        }).toThrow('Min or Max values are not valid');
    });
    test('should throw an error when max or min are not valid but are both defined', () => {
        const req = {
            query: {
                max: 'InvalidMax',
                min: '100'
            }
        };

        expect(() => {
            handleAmountFilterParams(req);
        }).toThrow('Min or Max values are not valid');
    });
    test('should return an empty object when max and min are not defined ', () => {
        const req = { query: {} };

        const expectedFilter = {};

        const result = handleAmountFilterParams(req);
        expect(result).toEqual(expectedFilter);
    }); 
});

