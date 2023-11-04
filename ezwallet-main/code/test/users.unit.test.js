import request from 'supertest';
import { app } from '../app';
import { Group, User } from '../models/User.js';
import { transactions } from '../models/model.js';
import { getUsers, getUser, deleteUser, createGroup, getGroup, getGroups, addToGroup, removeFromGroup, deleteGroup } from '../controllers/users';
import { verifyAuth } from '../controllers/utils';
import { response } from 'express';
import jwt from 'jsonwebtoken';
process.env.ACCESS_KEY = 'EZWALLET';

/**
 * In order to correctly mock the calls to external modules it is necessary to mock them using the following line.
 * Without this operation, it is not possible to replace the actual implementation of the external functions with the one
 * needed for the test cases.
 * `jest.mock()` must be called for every external module that is called in the functions under test.
 */
jest.mock("../models/User.js")
jest.mock("../models/model.js")

/**
 * Defines code to be executed before each test case is launched
 * In this case the mock implementation of `User.find()` is cleared, allowing the definition of a new mock implementation.
 * Not doing this `mockClear()` means that test cases may use a mock implementation intended for other test cases.
 */
beforeEach(() => {
  jest.clearAllMocks()
});

const VerifyAuthmodule = require('../controllers/utils');

/**
 * - Request Parameters: None
 * - Request Body Content: None
 * - Response `data` Content: An array of objects, each one having attributes `username`, `email` and `role`
 *    - Example: `res.status(200).json({data: [{username: "Mario", email: "mario.red@email.com", role: "Regular"}, {username: "Luigi", email: "luigi.red@email.com", role: "Regular"}, {username: "admin", email: "admin@email.com", role: "Regular"} ], refreshedTokenMessage: res.locals.refreshedTokenMessage})`
 * - Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin)
 */
describe("getUsers", () => {
  test("should return empty list if there are no users", async () => {
    const mockReq = {}
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { data: [], refreshedTokenMessage: undefined };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    //any time the `User.find()` method is called jest will replace its actual implementation with the one defined below
    jest.spyOn(User, "find").mockImplementation(() => [])

    await getUsers(mockReq, mockRes)

    expect(User.find).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should retrieve list of all users", async () => {
    const mockReq = {}
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const retrievedUsers = [
      { username: 'test1', email: 'test1@example.com', role: 'Regular' },
      { username: 'test2', email: 'test2@example.com', role: 'Regular' }
    ]
    const res = { authorized: true, cause: "Authorized" };
    const response = { data: retrievedUsers, refreshedTokenMessage: undefined };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(User, "find").mockImplementation(() => retrievedUsers)

    await getUsers(mockReq, mockRes)

    expect(User.find).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("Should return error if not authorized", async () => {
    const mockReq = {}
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const res = { authorized: false, cause: "Admin: Mismatched role" };
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await getUsers(mockReq, mockRes)

    expect(User.find).not.toHaveBeenCalled()
    expect(verifyAuth).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: res.cause })
  })
})

/**
 * - Request Parameters: A string equal to the `username` of the involved user
 *    - Example: `/api/users/Mario`
 * - Request Body Content: None
 * - Response `data` Content: An object having attributes `username`, `email` and `role`.
 *    - Example: `res.status(200).json({data: {username: "mario", email: "mario.red@email.com", role: "Regular"}, refreshedTokenMessage: res.locals.refreshedTokenMessage})`
 * - Returns a 400 error if the username passed as the route parameter does not represent a user in the database
 * - Returns a 401 error if called by an authenticated user who is neither the same user as the one in the route parameter (authType = User) nor an admin (authType = Admin)
*/
describe("getUser", () => {
  test("should retrieve the requested username by User", async () => {
    const mockReq = {
      params: { username: "maurizio" },
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const retrieveUser = { username: 'maurizio', email: 'maurizio.mo@polito.it', role: 'Regular' };
    const res = { authorized: true, cause: "Authorized" };
    const response = { data: retrieveUser, refreshedTokenMessage: undefined };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(User, "findOne").mockImplementation(() => retrieveUser)

    await getUser(mockReq, mockRes)

    expect(User.findOne).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should retrieve the requested username by Admin", async () => {
    const mockReq = {
      params: { username: "edith" },
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const retrieveUser = { username: 'edith', email: 'edith.ra@polito.it', role: 'Regular' };
    const res = { authorized: true, cause: "Authorized" };
    const response = { data: retrieveUser, refreshedTokenMessage: undefined };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(User, "findOne").mockImplementation(() => retrieveUser)

    await getUser(mockReq, mockRes)

    expect(User.findOne).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if user not found", async () => {
    const mockReq = {
      params: { username: "unRegisteredUser" },
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "User not found" };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(User, "findOne").mockImplementation(() => { })

    await getUser(mockReq, mockRes)

    expect(User.findOne).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if authenticated user mismatch with username and is not admin", async () => {
    const mockReq = {
      params: { "username": "mario" },
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const retrieveUser = { username: 'mario', email: 'mario.red@email.com', role: 'Regular' };
    const response = { authorized: false, cause: "User: Mismatched users" };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => response)
    jest.spyOn(User, "findOne").mockImplementation(() => retrieveUser)

    await getUser(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: response.cause })
  })
})

/*
- Request Parameters: None
- Request request body Content: An object having a string attribute for the `name` of the group and an array that lists all the `memberEmails`
  - Example: `{name: "Family", memberEmails: ["mario.red@email.com", "luigi.red@email.com"]}`
- Response `data` Content: An object having an attribute `group` (this object must have a string attribute for the `name` of the created group and an array for the `members` of the group), an array that lists the `alreadyInGroup` members (members whose email is already present in a group) and an array that lists the `membersNotFound` (members whose email does not appear in the system)
  - Example: `res.status(200).json({data: {group: {name: "Family", members: [{email: "mario.red@email.com"}, {email: "luigi.red@email.com"}]}, membersNotFound: [], alreadyInGroup: []} refreshedTokenMessage: res.locals.refreshedTokenMessage})`
- If the user who calls the API does not have their email in the list of emails then their email is added to the list of members
- Returns a 400 error if the request body does not contain all the necessary attributes
- Returns a 400 error if the group name passed in the request body is an empty string
- Returns a 400 error if the group name passed in the request body represents an already existing group in the database
- Returns a 400 error if all the provided emails (the ones in the array, the email of the user calling the function does not have to be considered in this case) represent users that are already in a group or do not exist in the database
- Returns a 400 error if the user who calls the API is already in a group
- Returns a 400 error if at least one of the member emails is not in a valid email format
- Returns a 400 error if at least one of the member emails is an empty string
- Returns a 401 error if called by a user who is not authenticated (authType = Simple)
*/
describe("createGroup", () => {
  // expected behaviour for simplest case
  test("should return a group object, with empty array for members already in group and for members not found", async () => {
    const mockReq = {
      body: { name: "testgroup1", memberEmails: ["notingroup1@example.com", "notingroup2@example.com", "notingroup3@example.com"] },
      url: 'api/groups',
      cookies: {refreshToken: "mockRefreshToken"}
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }

    const returnedGroupObject = { name: "testgroup1", members: [{email :"notingroup1@example.com"},{email :"notingroup2@example.com"},{email :"notingroup3@example.com"}] }
    const res = { authorized: true, cause: "Authorized" };
    const response = { data: { group: { name: "testgroup1", members: [{email: "notingroup1@example.com"}, {email: "notingroup2@example.com"}, {email: "notingroup3@example.com"}] }
      , membersNotFound: [], alreadyInGroup: [] }, refreshedTokenMessage: undefined }
    const callingUserObject = { username: "notingroup1", email: "notingroup1@example.com"}
    const secondUserObject = { username: "notingroup2", email: "notingroup2@example.com"}
    const thirdUserObject = { username: "notingroup3", email: "notingroup3@example.com"}

    // call to check if group exists already, if the caller or user is already in a group
    Group.findOne.mockResolvedValueOnce(null)
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    User.findOne.mockResolvedValueOnce(callingUserObject) // first call for calling user
    Group.findOne.mockResolvedValueOnce(null)

    User.findOne.mockResolvedValueOnce(callingUserObject) // first user of the list and so on for successive calls
    Group.findOne.mockResolvedValueOnce(null)
    User.findOne.mockResolvedValueOnce(secondUserObject)
    Group.findOne.mockResolvedValueOnce(null)
    User.findOne.mockResolvedValueOnce(thirdUserObject)
    Group.findOne.mockResolvedValueOnce(null)
    
    Group.create.mockResolvedValueOnce(returnedGroupObject)

    await createGroup(mockReq, mockRes)

    expect(Group.findOne).toHaveBeenCalledWith({name: "testgroup1"}) // name in body
    expect(verifyAuth).toHaveBeenCalled() // simple auth for group creation

    expect(User.findOne).toHaveBeenCalledWith({refreshToken: "mockRefreshToken"}) // calling user with refreshToken check

    expect(Group.findOne).toHaveBeenCalledWith({email: "notingroup1@example.com"}) // calling user email

    // first user in members array and so on
    expect(User.findOne).toHaveBeenCalledWith({email: "notingroup1@example.com"})
    expect(Group.findOne).toHaveBeenCalledWith({email: "notingroup1@example.com"})

    expect(User.findOne).toHaveBeenCalledWith({email: "notingroup2@example.com"})
    expect(Group.findOne).toHaveBeenCalledWith({email: "notingroup2@example.com"})

    expect(User.findOne).toHaveBeenCalledWith({email: "notingroup3@example.com"})
    expect(Group.findOne).toHaveBeenCalledWith({email: "notingroup3@example.com"})
    
    
    expect(Group.create).toHaveBeenCalledWith({name: "testgroup1", members: [
      { email: "notingroup1@example.com"}, 
      { email: "notingroup2@example.com"}, 
      { email: "notingroup3@example.com"}] })

    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)

  })

  test("should return a group object, with non-empty array for members already in group and for members not found", async () => {
    const mockReq = {
      body: { name: "testgroup1", memberEmails: ["notingroup@example.com", "alreadyingroup@example.com", "notfound@example.com"] },
      url: 'api/groups',
      cookies: {refreshToken: "mockRefreshToken"}
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }

    const returnedGroupObject = { name: "testgroup1", members: [{email:"notingroup@example.com"}] }
    const res = { authorized: true, cause: "Authorized" };
    const response = { data: { group: 
      { name: "testgroup1", members: [{email: "notingroup@example.com"}] },
        membersNotFound: [{email: "notfound@example.com"}],
        alreadyInGroup: [{email: "alreadyingroup@example.com"}], refreshedTokenMessage: undefined  
      } }
    const callingUserObject = { username: "notingroup", email: "notingroup1@example.com"}
    const secondUserObject = { username: "alreadyingroup", email: "alreadyingroup@example.com"}
    const thirdUserObject = { username: "notfound", email: "notfound@example.com"}

    Group.findOne.mockResolvedValueOnce(null) // selected group exists
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    User.findOne.mockResolvedValueOnce(callingUserObject) 
    Group.findOne.mockResolvedValueOnce(null) // calling user is not in a group

    User.findOne.mockResolvedValueOnce(callingUserObject) // first user is found
    Group.findOne.mockResolvedValueOnce(null) // ... and checked for presence in another group
    User.findOne.mockResolvedValueOnce(secondUserObject) // second user is found too
    Group.findOne.mockResolvedValueOnce({name: "testgroup2"}) // and is already inside a group
    User.findOne.mockResolvedValueOnce(null) // third user is not found so no check for group presence is done
    
    Group.create.mockResolvedValueOnce(returnedGroupObject)

    await createGroup(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if there is already a group with the same name", async () => {
    const mockReq = {
      body: { name: "testgroup1", memberEmails: ["test1@example.com", "test2@example.com", "test2@example.com"] },
      url: 'api/groups'
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Group already exists" }
    const returnedGroupObject = { name: "testgroup1", members: ["notingroup@example.com"] }
    
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    Group.findOne.mockResolvedValueOnce(returnedGroupObject) // object other than null is returned so fails early

    await createGroup(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if all the member emails do not exist or are already in a group", async () => {
    const mockReq = {
      body: { name: "testgroup1", memberEmails: ["test1@example.com", "test2@example.com", "test2@example.com"] },
      url: 'api/groups',
      cookies: {refreshToken: "mockRefreshToken"}
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "All memberEmails does not exist or Already in Group" }

    Group.findOne.mockResolvedValueOnce(null)
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    User.findOne.mockResolvedValueOnce({ username: "test0", email: "test0@example.com"}) // calling user
    Group.findOne.mockResolvedValueOnce(null)  // caller not already in a group
    User.findOne.mockResolvedValue(null) // all other users not found


    await createGroup(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if request body does not have all the necessary attributes", async () => {
    const mockReq = {
      body: { name: "testgroup1" } // missing membersEmails
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Some Parameter is Missing" }

    Group.findOne.mockResolvedValueOnce(null)
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await createGroup(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if the group name passed in the request body is an empty string", async () => {
    const mockReq = {
      body: { name: " ", memberEmails: ["notexists@example.com", "alreadyingroup1@example.com", "alreadyingroup2@example.com"] } 
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Group name is an Empty String" } 

    Group.findOne.mockResolvedValueOnce(null)
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await createGroup(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if the user passed in the request body does not exist", async () => {
    const mockReq = {
      body: { name: "testgroup1", memberEmails: ["notexists@example.com", "alreadyingroup1@example.com", "alreadyingroup2@example.com"] },
      cookies: {
        accessToken: jwt.sign({ username: 'testuser', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
        refreshToken: jwt.sign({ username: 'testuser', email: 'test@example.com', role: 'Regular' }, process.env.ACCESS_KEY, { expiresIn: '1y' }),
      },
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }

    const resAuth = { authorized: true, cause: "Authorized" };
    const group = { name: "testgroup1", memberEmails: ["notexists@example.com", "alreadyingroup1@example.com", "alreadyingroup2@example.com"] };
    const response = { error: "User not found" } 
    
    Group.findOne.mockResolvedValue(group)
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
    User.findOne.mockResolvedValue(null)

    await createGroup(mockReq, mockRes)

    expect(Group.findOne).toHaveBeenCalledWith({name : group.name})
    expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, { authType: "Simple" })
    expect(User.findOne).toHaveBeenCalledWith({refreshToken: mockReq.cookies.refreshToken})
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if the user who calls the API is already in a group", async () => {
    const mockReq = {
      body: { name: "testgroup1", memberEmails: ["test1@example.com", "test2@example.com", "test2@example.com"] },
      url: 'api/groups',
      cookies: {refreshToken: "mockRefreshToken"}
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Caller already in a group" }

    Group.findOne.mockResolvedValueOnce(null)
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    User.findOne.mockResolvedValueOnce({ username: "test1", email: "test1@example.com"})
    Group.findOne.mockResolvedValueOnce({ name: "testgroup1", members: ["notingroup@example.com"] })

    await createGroup(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if at least one of the member emails is not in a valid email format", async () => {
    const mockReq = {
      body: { name: "testgroup1", memberEmails: ["wrongemailformat", "anotherwrongemail"] }, 
      cookies: {refreshToken: "mockRefreshToken"}
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Invalid email format" }

    Group.findOne.mockResolvedValueOnce(null)
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    User.findOne.mockResolvedValueOnce({ username: "wrongemailformat", email: "wrongemailformat"})
    Group.findOne.mockResolvedValueOnce(null)

    await createGroup(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if at least one of the member emails is an empty string", async () => {
    const mockReq = {
      body: { name: "testgroup1", memberEmails: ["", "wrongemailformat"] },
      cookies: {refreshToken: "mockRefreshToken"}
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Email is an Empty String" }

    Group.findOne.mockResolvedValueOnce(null)
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    User.findOne.mockResolvedValueOnce({ username: "wrongemailformat", email: "wrongemailformat"})
    Group.findOne.mockResolvedValueOnce(null)

    await createGroup(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if called by a user who is not authenticated", async () => {
    const mockReq = {
      body: { name: "testgroup1", memberEmails: ["", "wrongemailformat"] },
      cookies: {refreshToken: "mockRefreshToken"}
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }

    const res = { authorized: false, cause: "Unauthorized" };
    const response = { error: res.cause }

    Group.findOne.mockResolvedValueOnce(null)
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await createGroup(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })
})

/**
 * Return all the groups
  - Request Body Content: None
  - Response `data` Content: An array of objects, each one having a string attribute for the `name` of the group
    and an array for the `members` of the group
  - Optional behavior:
    - empty array is returned if there are no groups
 */
describe("getGroups", () => {
  test("should return empty list if there are no groups", async () => {
    const mockReq = {}
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { data: [], refreshedTokenMessage: undefined }; // refreshedTokenMessage is to be handled?

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(Group, "find").mockImplementation(() => [])

    await getGroups(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should retrieve list of all groups", async () => {
    const mockReq = {}
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const retrievedGroups = [
      { name: 'testgroup1', members: [{email: "test1@example.com"}, {email: "test2@example.com"}]},
      { name: 'testgroup2', members: [{email: "test3@example.com"}, {email: "test4@example.com"}]}
    ]

    const res = { authorized: true, cause: "Authorized" };
    const response = { data: retrievedGroups, refreshedTokenMessage: undefined };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(Group, "find").mockImplementation(() => retrievedGroups)

    await getGroups(mockReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if not authorized", async () => {
    const mockReq = {}
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const res = { flag: false, cause: "Admin: Mismatched role" };
    const response = {}

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await getGroups(mockReq, mockRes)
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({ error: res.cause })
  })

})

/**
 * Return information of a specific group
  - Request Body Content: None
  - Response `data` Content: An object having a string attribute for the `name` of the group and an array for the 
    `members` of the group
  - Returns a 400 error if the group name passed as a route parameter does not represent a group in the database
  - Returns a 401 error if called by an authenticated user who is neither part of the group (authType = Group) nor an admin (authType = Admin)
  */
describe("getGroup", () => {
  test("should retrieve the requested group by user ", async () => {
    const mockReq = { params: { name: "testgroup1" } }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const retrievedGroup = { name: 'testgroup1', members: [{email: "test1@example.com"}, {email: "test2@example.com"}]}
    const res = { authorized: true, cause: "Authorized" };
    const response = { data: {group: retrievedGroup}, refreshedTokenMessage: undefined };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(Group, "findOne").mockImplementation(() => retrievedGroup)

    await getGroup(mockReq, mockRes)

    expect(Group.findOne).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if group not found", async () => {
    const mockReq = { params: { name: "notExisting" } }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Group Does Not exist" };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(Group, "findOne").mockImplementation(() => null)

    await getGroup(mockReq, mockRes)

    expect(Group.findOne).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if authenticated user is not inside the group and is not an admin", async () => {
    const mockReq = { params: { name: "testgroup1" } }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const retrievedGroup = { group: 'testgroup1', members: ["test1@example.com", "test2@example.com"] }
    const res = { authorized: false, cause: "Group: user not in group" };
    const response = { error: "Group: user not in group" }

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(Group, "findOne").mockImplementation(() => retrievedGroup)

    await getGroup(mockReq, mockRes)

    expect(Group.findOne).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })
})

/**
 * Add new members to a group
  - Request Parameters: A string equal to the `name` of the group
  - Example: `api/groups/Family/add` (user route)
  - Example: `api/groups/Family/insert` (admin route)
  - Request Body Content: An array of strings containing the `emails` of the members to add to the group
    - Example: `{emails: ["pietro.blue@email.com"]}`
  - Response `data` Content: An object having an attribute `group` (this object must have a string attribute for the `name` of the created group and an array for the `members` of the group, this array must include the new members as well as the old ones), an array that lists the `alreadyInGroup` members (members whose email is already present in a group) and an array that lists the `membersNotFound` (members whose email does not appear in the system)
    - Example: `res.status(200).json({data: {group: {name: "Family", members: [{email: "mario.red@email.com"}, {email: "luigi.red@email.com"}, {email: "pietro.blue@email.com"}]}, membersNotFound: [], alreadyInGroup: []} refreshedTokenMessage: res.locals.refreshedTokenMessage})`
  - In case any of the following errors apply then no user is added to the group
  - Returns a 400 error if the request body does not contain all the necessary attributes
  - Returns a 400 error if the group name passed as a route parameter does not represent a group in the database
  - Returns a 400 error if all the provided emails represent users that are already in a group or do not exist in the database
  - Returns a 400 error if at least one of the member emails is not in a valid email format
  - Returns a 400 error if at least one of the member emails is an empty string
  - Returns a 401 error if called by an authenticated user who is not part of the group (authType = Group) if the route is `api/groups/:name/add`
  - Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin) if the route is `api/groups/:name/insert`

 */
describe("addToGroup", () => {
  test("should insert requested members into group by admin", async () => {
    const mockReq = {
      url: "api/groups/testgroup1/insert",
      params: { name: "testgroup1" },
      body: { emails: [ "toAdd1@example.com",
                        "alreadyInAnotherGroup@example.com", 
                        "notFound@example.com"] }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const alreadyExistingGroup = {
      name: 'testgroup1',
      members: ["requestingUser@example.com", "someoneelse@example.com"]
    }

    const anotherExistingGroup = {
      name: 'testgroup1',
      members: ["requestingUser@example.com", "someoneelse@example.com"]
    }

    const newGroup = {
      name: 'testgroup1',
      members: [{email: "requestingUser@example.com"}, {email: "someoneelse@example.com"}, {email: "toAdd1@example.com"}],
    };

    const firstUser = { username: "toAdd1", email: "toAdd1@example.com"}
    const secondUser = { username: "alreadyInAnotherGroup", email: "alreadyInAnotherGroup@example.com"}
    const thirdUser = { username: "notFound", email: "notFound@example.com"}

    const res = { authorized: true, cause: "Authorized" };
    const response = { data: {group: { name: "testgroup1", members: [{email: "requestingUser@example.com"}, {email: "someoneelse@example.com"}, {email: "toAdd1@example.com"}] }
    , membersNotFound: [{email:"notFound@example.com"}], alreadyInGroup: [{email: "alreadyInAnotherGroup@example.com"}]}, refreshedTokenMessage: undefined }

    // call to check if group actually exists 
    Group.findOne.mockResolvedValueOnce(alreadyExistingGroup)
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res) // authenticated as admin
    // checking if users in body exist
    User.findOne.mockResolvedValueOnce(firstUser) // first one exists
    Group.findOne.mockResolvedValueOnce(null) // and doesn't belong to any group
    User.findOne.mockResolvedValueOnce(secondUser) // second one exists
    Group.findOne.mockResolvedValueOnce(anotherExistingGroup) // but already belongs to a group
    User.findOne.mockResolvedValueOnce(null) // third one does not exist so no call to Group.findOne
    Group.findOneAndUpdate.mockResolvedValueOnce({name: newGroup.name, members: newGroup.members})

    await addToGroup(mockReq, mockRes)

    expect(Group.findOne).toHaveBeenCalledWith({name: "testgroup1"})
    expect(verifyAuth).toHaveBeenCalled() 
    expect(User.findOne).toHaveBeenCalledWith({email: "toAdd1@example.com"})
    expect(Group.findOne).toHaveBeenCalledWith({ "members.email": "toAdd1@example.com" })
    expect(User.findOne).toHaveBeenCalledWith({email: "alreadyInAnotherGroup@example.com"})
    expect(Group.findOne).toHaveBeenCalledWith({ "members.email": "alreadyInAnotherGroup@example.com" })
    expect(User.findOne).toHaveBeenCalledWith({email: "notFound@example.com"})
    expect(Group.findOneAndUpdate).toHaveBeenCalledWith({ name: newGroup.name }, { $push: { members: [{email: firstUser.email}] } }, { new: true })

    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should insert requested members into group by user", async () => {
    const mockReq = {
      url: "api/groups/testgroup1/add",
      params: { name: "testgroup1" },
      body: { emails: [ "toAdd1@example.com",
                        "alreadyInAnotherGroup@example.com", 
                        "notFound@example.com"] }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const alreadyExistingGroup = {
      name: 'testgroup1',
      members: ["requestingUser@example.com", "someoneelse@example.com"]
    }

    const anotherExistingGroup = {
      name: 'testgroup2',
      members: ["requestingUser@example.com", "someoneelse@example.com"]
    }

    const newGroup = {
      name: 'testgroup1',
      members: [{email: "requestingUser@example.com"}, {email: "someoneelse@example.com"}, {email: "toAdd1@example.com"}],
    };

    const firstUser = { username: "toAdd1", email: "toAdd1@example.com"}
    const secondUser = { username: "alreadyInAnotherGroup", email: "alreadyInAnotherGroup@example.com"}
    const thirdUser = { username: "notFound", email: "notFound@example.com"}

    const res = { authorized: true, cause: "Authorized" };
    const response = { data: {group: { name: "testgroup1", members: [{email: "requestingUser@example.com"}, {email: "someoneelse@example.com"}, {email: "toAdd1@example.com"}] }
    , membersNotFound: [{email: "notFound@example.com"}], alreadyInGroup: [{email: "alreadyInAnotherGroup@example.com"}]}, refreshedTokenMessage: undefined }

    // call to check if group actually exists 
    Group.findOne.mockResolvedValueOnce(alreadyExistingGroup)
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res) // authenticated as admin
    // checking if users in body exist
    User.findOne.mockResolvedValueOnce(firstUser) // first one exists
    Group.findOne.mockResolvedValueOnce(null) // and doesn't belong to any group
    User.findOne.mockResolvedValueOnce(secondUser) // second one exists
    Group.findOne.mockResolvedValueOnce(anotherExistingGroup) // but already belongs to a group
    User.findOne.mockResolvedValueOnce(null) // third one does not exist so no call to Group.findOne
    Group.findOneAndUpdate.mockResolvedValueOnce({name: newGroup.name, members: newGroup.members})

    await addToGroup(mockReq, mockRes)

    expect(Group.findOne).toHaveBeenCalledWith({name: "testgroup1"})
    expect(verifyAuth).toHaveBeenCalled() 
    expect(User.findOne).toHaveBeenCalledWith({email: "toAdd1@example.com"})
    expect(Group.findOne).toHaveBeenCalledWith({ "members.email": "toAdd1@example.com" })
    expect(User.findOne).toHaveBeenCalledWith({email: "alreadyInAnotherGroup@example.com"})
    expect(Group.findOne).toHaveBeenCalledWith({ "members.email": "alreadyInAnotherGroup@example.com" })
    expect(User.findOne).toHaveBeenCalledWith({email: "notFound@example.com"})
    expect(Group.findOneAndUpdate).toHaveBeenCalledWith({ name: newGroup.name }, { $push: { members: [{email: firstUser.email}] } }, { new: true })

    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if the request body does not contain all the necessary attributes", async () => {
    const mockReq = {
      url: "api/groups/testgroup1/insert",
      params: { name: "testgroup1" },
      body: {} // body without attributes
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Some Parameter is Missing" };
    const alreadyExistingGroup = {
      group: 'testgroup1',
      members: ["requestingUser@example.com", "someoneelse@example.com"]
    }
    Group.findOne.mockResolvedValueOnce(alreadyExistingGroup) // group exists
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await addToGroup(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalled() 
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if the group name passed as a route parameter does not represent a group in the database", async () => {
    const mockReq = {
      params: { name: "testgroup1" },
      body: { emails: ["toAdd1@example.com", "alreadyInAnotherGroup@example.com", "notFound@example.com"] }
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Group not Found." };

    Group.findOne.mockResolvedValueOnce(null) // group does not exists
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await addToGroup(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if all the provided emails represent users that are already in a group or do not exist in the database", async () => { 
    const mockReq = {
      url: "api/groups/testgroup1/add",
      params: { name: "testgroup1" },
      body: { emails: [ "notExists@example.com",
                        "alreadyInAnotherGroup@example.com", 
                        "notFound@example.com"] }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const alreadyExistingGroup = {
      name: 'testgroup1',
      members: ["requestingUser@example.com", "someoneelse@example.com"]
    }

    const firstUser = { username: "alreadyInAnotherGroup", email: "alreadyInAnotherGroup@example.com"}

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "All memberEmails does not exist or Already in Group" };

    // call to check if group actually exists 
    Group.findOne.mockResolvedValueOnce(alreadyExistingGroup)
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    User.findOne.mockResolvedValueOnce(null) // first one doesn't exists
    User.findOne.mockResolvedValueOnce(firstUser) // second one exists
    Group.findOne.mockResolvedValueOnce(alreadyExistingGroup) // but already belongs to a group
    User.findOne.mockResolvedValueOnce(null) // third one doesn't exist either

    await addToGroup(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if at least one of the member emails is not in a valid email format", async () => {
    const mockReq = {
      url: "api/groups/testgroup1/add",
      params: { name: "testgroup1" },
      body: { emails: ["wrongemailformat", "anotherwrongemail"] }
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Invalid email format" }
    const alreadyExistingGroup = {
      group: 'testgroup1',
      members: ["requestingUser@example.com", "someoneelse@example.com"]
    }
    Group.findOne.mockResolvedValueOnce(alreadyExistingGroup)
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await addToGroup(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if at least one of the member emails is an empty string", async () => {
    const mockReq = {
      url: "api/groups/testgroup1/add",
      params: { name: "testgroup1" },
      body: { emails: [" ", "anotherwrongemail"] }
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Some Parameter is an Empty String" }
    const alreadyExistingGroup = {
      group: 'testgroup1',
      members: ["requestingUser@example.com", "someoneelse@example.com"]
    }

    Group.findOne.mockResolvedValueOnce(alreadyExistingGroup)
    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await addToGroup(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if called by an authenticated user who is not part of the group (authType = Group)", async () => { 
    const mockReq = {
      url: "api/groups/testgroup1/add",
      params: { name: "testgroup1" },
      body: {emails: ["user2@email.com", "user@email.com"] }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const res = {
      authorized: false,
      cause: "Group: user not in group",
    };
    const response = { error:"Group: user not in group"  }
    const alreadyExistingGroup = {
      group: 'testgroup1',
      members: [
        { email: 'user@example.com', user: 'user1' },
      ]
    }

    Group.findOne.mockResolvedValueOnce(alreadyExistingGroup);
    jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => res);

    await addToGroup(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, { authType: "Group", emails:[ 'user@example.com' ]})
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(response);
  })

  test("should return error if called by an authenticated user who is not an admin (authType = Admin)", async () => { 
    const mockReq = {
      url: "api/groups/testgroup1/insert",
      params: { name: "testgroup1" },
      body: {emails: ["user2@email.com", "user@email.com"] }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const res = {
      authorized: false,
      cause:  "Admin: Mismatched role",
    };
    const response = { error: "Admin: Mismatched role"}
    const alreadyExistingGroup = {
      group: 'testgroup1',
      members: [
        { email: 'user@example.com', user: 'user1' },
      ]
    }

    Group.findOne.mockResolvedValueOnce(alreadyExistingGroup);
    jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => res);

    await addToGroup(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, { authType: "Admin" })
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(response);
  })
})

/*The group must have at least one user after deleting, so given M = members of the group and N = emails to delete:
if N >= M at least one member of the group cannot be deleted (the member that remains can be any member, there is no rule on which one it must be)
In case any of the following errors apply then no user is removed from the group
Returns a 400 error if the request body does not contain all the necessary attributes
Returns a 400 error if the group name passed as a route parameter does not represent a group in the database
Returns a 400 error if all the provided emails represent users that do not belong to the group or do not exist in the database
Returns a 400 error if at least one of the emails is not in a valid email format
Returns a 400 error if at least one of the emails is an empty string
Returns a 400 error if the group contains only one member before deleting any user
Returns a 401 error if called by an authenticated user who is not part of the group (authType = Group) if the route is api/groups/:name/remove
Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin) if the route is api/groups/:name/pull*/
describe("removeFromGroup", () => {

  test('Should return a 200 response and delete the specified user from the group', async () => {
    const req = { params: { name: 'existinggroup' }, body: { emails: ['user1@example.com'] },      url: 'api/groups/existinggroup/pull' };
  

    const res = {

      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    };
    const group = {
      name: 'existinggroup',
      members: [
        { email: 'user1@example.com', user: 'user1' },
        { email: 'user2@example.com', user: 'user2' },
      ],
    };
    const user1 = { _id: 'user1' };
    Group.findOne.mockResolvedValueOnce(group);

    jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => ({
      authorized: true,
      cause: 'Authorized',
    }));

    User.findOne.mockResolvedValueOnce(user1);
    Group.findOne.mockResolvedValue(group);
    User.findOne.mockResolvedValue(user1);
    Group.findOneAndUpdate.mockResolvedValueOnce({ name: 'existinggroup', members: [{ email: 'user2@example.com', _id: 'user2' }] });

    await removeFromGroup(req, res);

    expect(Group.findOne).toHaveBeenCalledWith({ name: 'existinggroup' });
    expect(User.findOne).toHaveBeenCalledWith({ email: 'user1@example.com' });
    expect(Group.findOne).toHaveBeenCalledWith({ "members.email": 'user1@example.com', name: 'existinggroup' });
    expect(User.findOne).toHaveBeenCalledWith({ email: 'user1@example.com' });
    expect(Group.findOneAndUpdate).toHaveBeenCalledWith(
      { name: 'existinggroup' },
      { $pull: { members: { email: 'user1@example.com', _id: user1 } } },
      { new: true }
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        group: { name: 'existinggroup', members: [{ email: 'user2@example.com', _id: 'user2' }] },
        membersNotFound: [],
        notInGroup: [],
      }
    });
  });
  test('should return a 400 error if the group is not found', async () => {
    const req = { params: { name: 'nonexistentgroup' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    Group.findOne.mockResolvedValueOnce(null);

    await removeFromGroup(req, res);

    expect(Group.findOne).toHaveBeenCalledWith({ name: 'nonexistentgroup' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Group not Found.' });
  });
  //Returns a 400 error if the request body does not contain all the necessary attributes
  test('should return a 400 error if the request body does not contain all the necessary attributes', async () => {
    const req = {
      params: { name: 'existinggroup' },
      body: {} // Empty body
      ,      url: 'api/groups/existinggroup/pull' };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const group = {
      name: 'existinggroup',
      members: [

      ],
    };
    Group.findOne.mockResolvedValue(group);
    jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => ({
      authorized: true,
      cause: 'Authorized',
    }));
    await removeFromGroup(req, res);

    expect(Group.findOne).toHaveBeenCalledWith({ name: "existinggroup" });//find group by name
    expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: "Admin" })
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Some Parameter is Missing' });
  });
  test('should return a 400 error if the group is not found', async () => {
    const req = { params: { name: 'nonexistentgroup' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    Group.findOne.mockResolvedValueOnce(null);

    await removeFromGroup(req, res);

    expect(Group.findOne).toHaveBeenCalledWith({ name: 'nonexistentgroup' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Group not Found.' });
  });
  //Returns a 400 error if all the provided emails represent users that do not belong to the group or do not exist in the database
  test('should return a 400 error if all the provided emails represent user do not exist in the database', async () => {
    const req = { params: { name: 'existinggroup' }, body: { emails: ['notuser1@example.com'] },      url: 'api/groups/existinggroup/pull' };
 

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    const group = {
      name: 'existinggroup',
      members: [
        { email: 'user@example.com', user: 'user1' },
        { email: 'user2@example.com', user: 'user2' },
      ],
    };
    Group.findOne.mockResolvedValueOnce(group);
    jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => ({
      authorized: true,
      cause: 'Authorized',
    }));
    User.findOne.mockResolvedValueOnce(null);//user not found

    await removeFromGroup(req, res);

    expect(Group.findOne).toHaveBeenCalledWith({ name: "existinggroup" });//find group by name
    expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: "Admin" })
    expect(User.findOne).toHaveBeenCalledWith({ email: 'notuser1@example.com' });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "All memberEmails does not exist or Already in Group" });
  });
  test('should return a 400 error if all the provided emails represent users that do not belong to the group ', async () => {
    const req = { params: { name: 'existinggroup' }, body: { emails: ['notuser1@example.com'] },      url: 'api/groups/existinggroup/pull' };
 

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    const group = {
      name: 'existinggroup',
      members: [
        { email: 'user@example.com', user: 'user1' },
        { email: 'user2@example.com', user: 'user2' },
      ],
    };
    Group.findOne.mockResolvedValueOnce(group);
    jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => ({
      authorized: true,
      cause: 'Authorized',
    }));
    User.findOne.mockResolvedValueOnce({email:'notuser1@example.com'});
    Group.findOne.mockResolvedValueOnce(null);

    await removeFromGroup(req, res);

    expect(Group.findOne).toHaveBeenCalledWith({ name: "existinggroup" });//find group by name
    expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: "Admin" })
    expect(User.findOne).toHaveBeenCalledWith({ email: 'notuser1@example.com' });
    expect(Group.findOne).toHaveBeenCalledWith({ "members.email": 'notuser1@example.com', name: 'existinggroup' });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "All memberEmails does not exist or Already in Group" });
  });
  //Returns a 400 error if at least one of the emails is not in a valid email format
  test('should return a 400 error if at least one of the emails is not in a valid email format', async () => {
    const req = { params: { name: 'existinggroup' }, body: { emails: ['user', "user@email.com"] },     url: 'api/groups/existinggroup/pull' };


    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    const group = {
      name: 'existinggroup',
      members: [
        { email: 'user@example.com', user: 'user1' },
        { email: 'user2@example.com', user: 'user2' },
      ],
    };
    Group.findOne.mockResolvedValueOnce(group);
    jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => ({
      authorized: true,
      cause: 'Authorized',
    }));

    await removeFromGroup(req, res);

    expect(Group.findOne).toHaveBeenCalledWith({ name: "existinggroup" });//find group by name
    expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: "Admin" })

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid email format" });
  });
  //Returns a 400 error if at least one of the emails is an empty string
  test('should return a 400 error if at least one of the emails is an empty string', async () => {
    const req = { params: { name: 'existinggroup' }, body: { emails: [' ', "user@email.com"] },      url: 'api/groups/existinggroup/pull' };


    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    const group = {
      name: 'existinggroup',
      members: [
        { email: 'user@example.com', user: 'user1' },
        { email: 'user2@example.com', user: 'user2' },
      ],
    };
    Group.findOne.mockResolvedValueOnce(group);
    jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => ({
      authorized: true,
      cause: 'Authorized',
    }));

    await removeFromGroup(req, res);

    expect(Group.findOne).toHaveBeenCalledWith({ name: "existinggroup" });//find group by name
    expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: "Admin" })

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Email is an Empty String" });
  });
  //Returns a 400 error if the group contains only one member before deleting any user
  test('should return a 400 error if the group contains only one member before deleting any user', async () => {
    const req = { params: { name: 'existinggroup' }, body: { emails: ["user2@email.com", "user@email.com"] },      url: 'api/groups/existinggroup/pull' };


    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const group = {
      name: 'existinggroup',
      members: [
        { email: 'user@example.com', user: 'user1' },
      ],
    };
    Group.findOne.mockResolvedValue(group);
    jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => ({
      authorized: true,
      cause: 'Authorized',
    }));
    await removeFromGroup(req, res);

    expect(Group.findOne).toHaveBeenCalledWith({ name: "existinggroup" });//find group by name
    expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: "Admin" })
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Can't remove all members"  });
  });
  //Returns a 401 error if called by an authenticated user who is not part of the group (authType = Group) if the route is api/groups/:name/remove
  test('should return a 401 error if called by an authenticated user who is not part of the group (authType = Group) /remove', async () => {
    const req = { params: { name: 'existinggroup' }, body: { emails: ["user2@email.com", "user@email.com"] }
    ,url: 'api/groups/existinggroup/remove' };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const group = {
      name: 'existinggroup',
      members: [
        { email: 'user@example.com', user: 'user1' },
      ],
    };
    Group.findOne.mockResolvedValue(group);
    jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => ({
      authorized: false,
      cause: "Group: user not in group",
    }));
    await removeFromGroup(req, res);

    expect(Group.findOne).toHaveBeenCalledWith({ name: "existinggroup" });//find group by name
    expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: "Group", emails:[ 'user@example.com' ]})
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error:"Group: user not in group"  });
  });
  //Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin) if the route is api/groups/:name/pull*/
  test('should return a 401 error called by an authenticated user who is not an admin (authType = Admin) /pull', async () => {
    const req = { params: { name: 'existinggroup' }, body: { emails: ["user2@email.com", "user@email.com"] },
     url: 'api/groups/existinggroup/pull' };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const group = {
      name: 'existinggroup',
      members: [
        { email: 'user@example.com', user: 'user1' },
      ],
    };
    Group.findOne.mockResolvedValue(group);
    jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => ({
      authorized: false,
      cause:  "Admin: Mismatched role",
    }));
    await removeFromGroup(req, res);

    expect(Group.findOne).toHaveBeenCalledWith({ name: "existinggroup" });//find group by name
    expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: "Admin"})
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Admin: Mismatched role"});
  });
})


/**
 * - Request Parameters: None
 * - Request Body Content: A string equal to the `email` of the user to be deleted
 *    - Example: `{email: "luigi.red@email.com"}`
 * - Response `data` Content: An object having an attribute that lists the number of `deletedTransactions` and an attribute that specifies whether the user was also `deletedFromGroup` or not
 *    - Example: `res.status(200).json({data: {deletedTransactions: 1, deletedFromGroup: true}, refreshedTokenMessage: res.locals.refreshedTokenMessage})`
 * - If the user is the last user of a group then the group is deleted as well
 * - Returns a 400 error if the request body does not contain all the necessary attributes
 * - Returns a 400 error if the email passed in the request body is an empty string
 * - Returns a 400 error if the email passed in the request body is not in correct email format
 * - Returns a 400 error if the email passed in the request body does not represent a user in the database
 * - Returns a 400 error if the email passed in the request body represents an admin
 * - Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin)
 */

describe("deleteUser", () => {
  test("Should successfully delete the given user who does not belongs to a group", async () => {
    const mockReq = {
      body: {
        email: "delete.me@polito.it"
      }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }
    const deletedTransactions = { deletedCount: 3 };
    const retrieveUser = { username: 'userToDelete', email: 'delete.me@polito.it', role: 'Regular' };
    const res = { authorized: true, cause: "Authorized" };
    const response = { data: { deletedTransactions: deletedTransactions.deletedCount, deletedFromGroup: false }, refreshedTokenMessage: undefined };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(User, "findOne").mockImplementation(() => retrieveUser)
    jest.spyOn(User, "deleteOne").mockImplementation(() => { })
    jest.spyOn(Group, "findOneAndUpdate").mockImplementation(() => null)
    jest.spyOn(transactions, "deleteMany").mockImplementation(() => deletedTransactions)

    await deleteUser(mockReq, mockRes)

    expect(User.findOne).toHaveBeenCalled()
    expect(Group.findOneAndUpdate).toHaveBeenCalled()
    expect(transactions.deleteMany).toHaveBeenCalled()
    expect(User.deleteOne).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("Should successfully delete the given user who was with other member in a group", async () => {
    const mockReq = {
      body: {
        email: "delete.me@polito.it"
      }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }
    const deletedTransactions = { deletedCount: 3 };
    const fromGroup = { name: "groupName", members: [{ email: "other.member@polito.it", user: 1 }] };
    const retrieveUser = { username: 'userToDelete', email: 'delete.me@polito.it', role: 'Regular' };
    const res = { authorized: true, cause: "Authorized" };
    const response = { data: { deletedTransactions: deletedTransactions.deletedCount, deletedFromGroup: true }, refreshedTokenMessage: undefined };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(User, "findOne").mockImplementation(() => retrieveUser)
    jest.spyOn(User, "deleteOne").mockImplementation(() => { })
    jest.spyOn(Group, "findOneAndUpdate").mockImplementation(() => fromGroup)
    jest.spyOn(transactions, "deleteMany").mockImplementation(() => deletedTransactions)

    await deleteUser(mockReq, mockRes)

    expect(User.findOne).toHaveBeenCalled()
    expect(Group.findOneAndUpdate).toHaveBeenCalled()
    expect(transactions.deleteMany).toHaveBeenCalled()
    expect(User.deleteOne).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("Should successfully delete the given user who was alone in a group", async () => {
    const mockReq = {
      body: {
        email: "delete.me@polito.it"
      }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }
    const deletedTransactions = { deletedCount: 3 };
    const fromGroup = { name: "groupName", members: [] };
    const retrieveUser = { username: 'userToDelete', email: 'delete.me@polito.it', role: 'Regular' };
    const res = { authorized: true, cause: "Authorized" };
    const response = { data: { deletedTransactions: deletedTransactions.deletedCount, deletedFromGroup: true }, refreshedTokenMessage: undefined };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(User, "findOne").mockImplementation(() => retrieveUser)
    jest.spyOn(User, "deleteOne").mockImplementation(() => { })
    jest.spyOn(Group, "findOneAndUpdate").mockImplementation(() => fromGroup)
    jest.spyOn(Group, "deleteOne").mockImplementation(() => { })
    jest.spyOn(transactions, "deleteMany").mockImplementation(() => deletedTransactions)

    await deleteUser(mockReq, mockRes)

    expect(User.findOne).toHaveBeenCalled()
    expect(Group.findOneAndUpdate).toHaveBeenCalled()
    expect(transactions.deleteMany).toHaveBeenCalled()
    expect(Group.deleteOne).toHaveBeenCalledWith({ name: fromGroup.name })
    expect(User.deleteOne).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("Should return error if the request body does not contain all the necessary attributes", async () => {
    const mockReq = {
      body: {}
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }

    const response = { error: "Some Parameter is Missing" };

    await deleteUser(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("Should return error if the email passed in the request body is an empty string", async () => {
    const mockReq = {
      body: { email: " " }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }

    const response = { error: "Some Parameter is an Empty String" };

    await deleteUser(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("Should return error if the email passed in the request body is not in correct email format", async () => {
    const mockReq = {
      body: { email: "invalidEmail.polito" }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }

    const response = { error: "Invalid email format" };

    await deleteUser(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("Should return error if the email passed in the request body does not represent a user in the database", async () => {
    const mockReq = {
      body: {
        email: "delete.ghostUser@polito.it"
      }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "User Does Not exist" };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(User, "findOne").mockImplementation(() => null)

    await deleteUser(mockReq, mockRes)

    expect(User.findOne).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("Should return error if the email passed in the request body represents an admin", async () => {
    const mockReq = {
      body: {
        email: "delete.admin@polito.it"
      }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }

    const res = { authorized: true, cause: "Authorized" };
    const retrieveAdmin = { username: 'IHavePowers', email: 'delete.admin@polito.it', role: 'Admin' };
    const response = { error: "User is an Admin,can't delete" };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(User, "findOne").mockImplementation(() => { return retrieveAdmin })

    await deleteUser(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalled()
    expect(User.findOne).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("Should return error if called by an authenticated user who is not an admin", async () => {
    const mockReq = {
      body: {
        email: "YouCanNotdeleteMe@polito.it"
      }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }

    const res = { authorized: false, cause: "Admin: Mismatched role" };
    const response = { error: res.cause };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await deleteUser(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, { authType: "Admin" })
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })
})


/**
 * - Request Parameters: None
  - Request Body Content: A string equal to the `name` of the group to be deleted
    - Example: `{name: "Family"}`
  - Response `data` Content: A message confirming successful deletion
    - Example: `res.status(200).json({data: {message: "Group deleted successfully"} , refreshedTokenMessage: res.locals.refreshedTokenMessage})`
  - Returns a 400 error if the request body does not contain all the necessary attributes
  - Returns a 400 error if the name passed in the request body is an empty string
  - Returns a 400 error if the name passed in the request body does not represent a group in the database
  - Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin)
 */
describe("deleteGroup", () => { 
  test("should successfully delete existing group", async () => {
    const mockReq = {
      url: "/groups",
      body: { name: "testgroup1" }
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const alreadyExistingGroup = {
      name: 'testgroup1',
      members: ["requestingUser@example.com", "someoneelse@example.com"]
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { data: { message: "Group deleted successfully" }, refreshedTokenMessage: undefined }

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res) // authenticated as admin
    Group.deleteOne.mockResolvedValueOnce(1) // 1 group mocked deletion

    await deleteGroup(mockReq, mockRes)

    expect(Group.deleteOne).toHaveBeenCalledWith({name: "testgroup1"})
    expect(verifyAuth).toHaveBeenCalled() 
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if the request body does not contain all the necessary attributes", async () => {
    const mockReq = {
      url: "/groups",
      body: {} // body attributes missing
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Some Parameter is Missing" }

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await deleteGroup(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalled() 
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if the name passed in the request body is an empty string", async () => {
    const mockReq = {
      url: "/groups",
      body: {name: " "} // empty string
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Some Parameter is an Empty String" }

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await deleteGroup(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalled() 
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if the name passed does not represent a group", async () => {
    const mockReq = {
          url: "/groups",
          body: {name: "testgroup1"}
        }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Group Does Not exist" }

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    Group.deleteOne.mockResolvedValueOnce({deletedCount: 0})

    await deleteGroup(mockReq, mockRes)

    expect(Group.deleteOne).toHaveBeenCalledWith({name: "testgroup1"})
    expect(verifyAuth).toHaveBeenCalled() 
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })

  test("should return error if called by an authenticated user who is not an admin (authType = Admin)", async () => {
    const mockReq = {
      url: "/groups",
      body: {name: "testgroup1"}
    }

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn(),
    }

    const res = { authorized: false, cause: "Admin: Mismatched role" };
    const response = { error: res.cause };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await deleteGroup(mockReq, mockRes)
    expect(verifyAuth).toHaveBeenCalled() 
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  })
})