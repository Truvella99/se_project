import request from 'supertest';
import { app } from '../app';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { login, logout, register, registerAdmin } from '../controllers/auth';
const bcrypt = require("bcryptjs")

jest.mock("bcryptjs")
jest.mock('../models/User.js');

beforeEach(() => {
    jest.clearAllMocks()
});

const VerifyAuthmodule = require('../controllers/utils');

/*
register
Request Parameters: None
Request Body Content: An object having attributes username, email and password
Example: {username: "Mario", email: "mario.red@email.com", password: "securePass"}
Response data Content: A message confirming successful insertion
Example: res.status(200).json({data: {message: "User added successfully"}})
Returns a 400 error if the request body does not contain all the necessary attributes
Returns a 400 error if at least one of the parameters in the request body is an empty string
Returns a 400 error if the email in the request body is not in a valid email format
Returns a 400 error if the username in the request body identifies an already existing user
Returns a 400 error if the email in the request body identifies an already existing user 
*/

describe('register', () => {
    test('Register an User, should register it with success', async () => {
        const mockReq = {
            body: {
                username: "Mario",
                email: "mario.red@email.com",
                password: "securePass"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
        }

        const resAuth = { authorized: true, cause: "Authorized" };
        const response = { data: { message: "User added successfully" } };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
        //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
        jest.spyOn(User, "findOne").mockImplementation(() => null)
        jest.spyOn(User, "create").mockImplementation(() => null)

        await register(mockReq, mockRes)

        expect(User.findOne).toHaveBeenCalledWith({ email: "mario.red@email.com" })
        expect(User.findOne).toHaveBeenCalledWith({ username: "Mario" })
        expect(User.create).toHaveBeenCalledWith({
            username: "Mario",
            email: "mario.red@email.com",
            password: await bcrypt.hash("securePass", 12)
        })
        expect(mockRes.status).toHaveBeenCalledWith(200)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Register an User with missing body parameters, should return 400', async () => {
        const mockReq = {
            body: {
                
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
        }

        const response = { error: "Some Parameter is Missing" };

        await register(mockReq, mockRes)

        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Register an User with empty string body parameters, should return 400', async () => {
        const mockReq = {
            body: {
                username: " ",
                email: " ",
                password: " "
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
        }

        const response = { error: "Some Parameter is an Empty String" };

        await register(mockReq, mockRes)

        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Register an User with wrong email format, should return 400', async () => {
        const mockReq = {
            body: {
                username: "Mario",
                email: "mario.redemail.com",
                password: "securePass"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
        }

        const response = { error: "Invalid email format" };

        await register(mockReq, mockRes)

        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Register an User, username already existing, should return 400', async () => {
        const mockReq = {
            body: {
                username: "Mario",
                email: "mario.red@email.com",
                password: "securePass"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
        }

        const resAuth = { authorized: true, cause: "Authorized" };
        const response = { error: "already existing user" };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
        //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
        jest.spyOn(User, "findOne").mockImplementation(() => {
            return {
                username: "Mario",
                email: "luigi.red@email.com",
                password: "pass"
            };
        });

        await register(mockReq, mockRes)

        expect(User.findOne).toHaveBeenCalledWith({ username: "Mario" })
        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Register an User, email already existing, should return 400', async () => {
        const mockReq = {
            body: {
                username: "Mario",
                email: "mario.red@email.com",
                password: "securePass"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
        }

        const resAuth = { authorized: true, cause: "Authorized" };
        const response = { error: "already existing user" };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
        //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
        jest.spyOn(User, "findOne").mockImplementation(() => {
            return {
                username: "Luigi",
                email: "mario.red@email.com",
                password: "pass"
            };
        });

        await register(mockReq, mockRes)

        expect(User.findOne).toHaveBeenCalledWith({ email: "mario.red@email.com" })
        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });
});

describe("registerAdmin", () => {
    test('Register an Admin, should register it with success', async () => {
        const mockReq = {
            body: {
                username: "Mario",
                email: "mario.red@email.com",
                password: "securePass"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
        }

        const resAuth = { authorized: true, cause: "Authorized" };
        const response = { data: { message: "User added successfully" } };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
        //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
        jest.spyOn(User, "findOne").mockImplementation(() => null)
        jest.spyOn(User, "create").mockImplementation(() => null)

        await registerAdmin(mockReq, mockRes)

        expect(User.findOne).toHaveBeenCalledWith({ email: "mario.red@email.com" })
        expect(User.findOne).toHaveBeenCalledWith({ username: "Mario" })
        expect(User.create).toHaveBeenCalledWith({
            username: "Mario",
            email: "mario.red@email.com",
            password: await bcrypt.hash("securePass", 12),
            role: "Admin"
        })
        expect(mockRes.status).toHaveBeenCalledWith(200)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Register an Admin with missing body parameters, should return 400', async () => {
        const mockReq = {
            body: {
                
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
        }

        const response = { error: "Some Parameter is Missing" };

        await registerAdmin(mockReq, mockRes)

        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Register an Admin with empty string body parameters, should return 400', async () => {
        const mockReq = {
            body: {
                username: " ",
                email: " ",
                password: " "
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
        }

        const response = { error: "Some Parameter is an Empty String" };

        await registerAdmin(mockReq, mockRes)

        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Register an Admin with wrong email format, should return 400', async () => {
        const mockReq = {
            body: {
                username: "Mario",
                email: "mario.redemail.com",
                password: "securePass"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
        }

        const response = { error: "Invalid email format" };

        await registerAdmin(mockReq, mockRes)

        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Register an Admin, username already existing, should return 400', async () => {
        const mockReq = {
            body: {
                username: "Mario",
                email: "mario.red@email.com",
                password: "securePass"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
        }

        const resAuth = { authorized: true, cause: "Authorized" };
        const response = { error: "already existing user" };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
        //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
        jest.spyOn(User, "findOne").mockImplementation(() => {
            return {
                username: "Mario",
                email: "luigi.red@email.com",
                password: "pass"
            };
        });

        await registerAdmin(mockReq, mockRes)

        expect(User.findOne).toHaveBeenCalledWith({ username: "Mario" })
        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Register an Admin, email already existing, should return 400', async () => {
        const mockReq = {
            body: {
                username: "Mario",
                email: "mario.red@email.com",
                password: "securePass"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
        }

        const resAuth = { authorized: true, cause: "Authorized" };
        const response = { error: "already existing user" };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
        //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
        jest.spyOn(User, "findOne").mockImplementation(() => {
            return {
                username: "Luigi",
                email: "mario.red@email.com",
                password: "pass"
            };
        });

        await registerAdmin(mockReq, mockRes)

        expect(User.findOne).toHaveBeenCalledWith({ email: "mario.red@email.com" })
        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

})
/*
login
Request Parameters: None
Request Body Content: An object having attributes email and password
Example: {email: "mario.red@email.com", password: "securePass"}
Response data Content: An object with the created accessToken and refreshToken
Example: res.status(200).json({data: {accessToken: accessToken, refreshToken: refreshToken}})
Returns a 400 error if the request body does not contain all the necessary attributes
Returns a 400 error if at least one of the parameters in the request body is an empty string
Returns a 400 error if the email in the request body is not in a valid email format
Returns a 400 error if the email in the request body does not identify a user in the database
Returns a 400 error if the supplied password does not match with the one in the database 
*/
describe('login', () => {
    test('User Login, should register it with success', async () => {
        process.env.ACCESS_KEY = 'EZWALLET';
        const mockReq = {
            body: {
                email: "mario.red@email.com",
                password: "securePass"
            }
        }

        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
            cookie: jest.fn(),
        }

        const existingUser = {
            email: "mario.red@email.com",
            id: '6429bef916d9643d863aa7b7',
            username: "Mario",
            role: "Regular",
            password: "securePass",
            refreshToken: '',
            save: jest.fn().mockResolvedValue(null)
        }
        //CREATE ACCESSTOKEN
        const accessToken = jwt.sign({
            email: existingUser.email,
            id: existingUser.id,
            username: existingUser.username,
            role: existingUser.role
        }, process.env.ACCESS_KEY, { expiresIn: '1h' })
        //CREATE REFRESH TOKEN
        const refreshToken = jwt.sign({
            email: existingUser.email,
            id: existingUser.id,
            username: existingUser.username,
            role: existingUser.role
        }, process.env.ACCESS_KEY, { expiresIn: '7d' })

        const response = { data: { accessToken: accessToken, refreshToken: refreshToken } };
        //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
        jest.spyOn(User, "findOne").mockImplementation(() => existingUser);
        jest.spyOn(bcrypt, "compare").mockImplementation(() => true);

        await login(mockReq, mockRes)

        expect(User.findOne).toHaveBeenCalledWith({ email: "mario.red@email.com" })
        expect(bcrypt.compare).toHaveBeenCalledWith(mockReq.body.password, existingUser.password)
        expect(mockRes.status).toHaveBeenCalledWith(200)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });
    test('User Login with not all necessary attributes, should return 400', async () => {
        const mockReq = {
            body: {
                password: "securePass"
            }
        }

        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
            cookie: jest.fn(),
        }
        
        const response = { error: "Some Parameter is Missing" };

        await login(mockReq, mockRes)

        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });
    test('User Login with at least one of the parameters in the request body as an empty string, should return 400', async () => {
        const mockReq = {
            body: {
                email: " ",
                password: "securePass"
            }
        }

        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
            cookie: jest.fn(),
        }

        const response = { error: "Some Parameter is an Empty String" };

        await login(mockReq, mockRes)

        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });
    test('User Login with the email not in a valid format, should return 400', async () => {
        const mockReq = {
            body: {
                email: "mario.redemail.com",
                password: "securePass"
            }
        }

        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
            cookie: jest.fn(),
        }

        const response = { error: "Invalid email format" };

        await login(mockReq, mockRes)

        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });
    test('User Login with the email in the request body that does not identify a user in database, should return 400', async () => {
        const mockReq = {
            body: {
                email: "mario.red@email.com",
                password: "securePass"
            }
        }

        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
            cookie: jest.fn(),
        }

        const response = { error: 'please you need to register' };
        //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
        jest.spyOn(User, "findOne").mockImplementation(() => null);

        await login(mockReq, mockRes)

        expect(User.findOne).toHaveBeenCalledWith({ email: "mario.red@email.com" })
        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });
    test('User Login with the password that does not match with the one in the database, should return 400', async () => {
        const mockReq = {
            body: {
                email: "mario.red@email.com",
                password: "securePass"
            }
        }

        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
            cookie: jest.fn(),
        }

        const existingUser = {
            email: "mario.red@email.com",
            id: '6429bef916d9643d863aa7b7',
            username: "Mario",
            role: "Regular",
            password: "securePass",
            refreshToken: '',
            save: jest.fn().mockResolvedValue(null)
        }

        const response = {error: 'wrong credentials' };
        //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
        jest.spyOn(User, "findOne").mockImplementation(() => existingUser);
        jest.spyOn(bcrypt, "compare").mockImplementation(() => false);

        await login(mockReq, mockRes)

        expect(User.findOne).toHaveBeenCalledWith({ email: "mario.red@email.com" })
        expect(bcrypt.compare).toHaveBeenCalledWith(mockReq.body.password, existingUser.password)
        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });
});

describe('logout', () => {
    test('User Logout, should logout with success', async () => { 
        process.env.ACCESS_KEY = 'EZWALLET';
        const mockReq = {
            cookies: {
                accessToken: jwt.sign({ username: 'Mario', email: "mario.red@email.com", role: "Regular" }, process.env.ACCESS_KEY),
                refreshToken: jwt.sign({ username: 'Mario', email: "mario.red@email.com", role: "Regular" }, process.env.ACCESS_KEY),
            },
        };

        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
            cookie: jest.fn().mockResolvedValue(null),
        }
        
        const existingUser = {
            email: "mario.red@email.com",
            id: '6429bef916d9643d863aa7b7',
            username: "Mario",
            role: "Regular",
            password: "securePass",
            refreshToken: 'wenjinjevel',
            save: jest.fn().mockResolvedValue(null)
        }

        const resAuth = { authorized: true, cause: "Authorized" };
        const response = {data: {message: "User logged out"}};
        //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
        jest.spyOn(User, "findOne").mockImplementation(() => existingUser);

        await logout(mockReq, mockRes)

        expect(User.findOne).toHaveBeenCalledWith({ refreshToken: mockReq.cookies.refreshToken })
        expect(mockRes.status).toHaveBeenCalledWith(200)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });
    test('User Logout with no refresh token in the request, should return with 400', async () => {
        process.env.ACCESS_KEY = 'EZWALLET';
        const mockReq = {
            cookies: {
                accessToken: jwt.sign({ username: 'Mario', email: "mario.red@email.com", role: "Regular" }, process.env.ACCESS_KEY),
            },
        };

        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
            cookie: jest.fn().mockResolvedValue(null),
        }

        const resAuth = { authorized: false, cause: "Unauthorized" };
        const response = { error: 'refresh token not in the cookies' };
        //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)

        await logout(mockReq, mockRes)

        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });
    test('User Logout with the refresh token that does not represent a user in the database, should return with 400', async () => {
        process.env.ACCESS_KEY = 'EZWALLET';
        const mockReq = {
            cookies: {
                accessToken: jwt.sign({ username: 'Mario', email: "mario.red@email.com", role: "Regular" }, process.env.ACCESS_KEY),
                refreshToken: jwt.sign({ username: 'Mario', email: "mario.red@email.com", role: "Regular" }, process.env.ACCESS_KEY),
            },
        };

        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
            cookie: jest.fn().mockResolvedValue(null),
        }

        const resAuth = { authorized: true, cause: "Authorized" };
        const response = { error: 'user not found' };
        //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
        jest.spyOn(User, "findOne").mockImplementation(() => null);

        await logout(mockReq, mockRes)

        expect(User.findOne).toHaveBeenCalledWith({ refreshToken: mockReq.cookies.refreshToken })
        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });
});
