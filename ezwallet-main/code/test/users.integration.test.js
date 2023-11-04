import request from 'supertest';
import { app } from '../app';
import { User, Group } from '../models/User.js';
import { transactions, categories } from '../models/model';
import jwt from 'jsonwebtoken';
import mongoose, { Model } from 'mongoose';
import dotenv from 'dotenv';

const bcrypt = require("bcryptjs")
/**
 * Necessary setup in order to create a new database for testing purposes before starting the execution of test cases.
 * Each test suite has its own database in order to avoid different tests accessing the same database at the same time and expecting different data.
 */
dotenv.config();
beforeAll(async () => {
  const dbName = "testingDatabaseUsers";
  const url = `${process.env.MONGO_URI}/${dbName}`;

  await mongoose.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

});

/**
 * After all test cases have been executed the database is deleted.
 * This is done so that subsequent executions of the test suite start with an empty database.
 */
afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.connection.close();
});

//necessary setup to ensure that each test can insert the data it needs
beforeEach(async () => {
  await User.deleteMany({})
  await Group.deleteMany({})
  await categories.deleteMany({})
  await transactions.deleteMany({})
});

/**
* Alternate way to create the necessary tokens for authentication without using the website
*/
const adminAccessTokenValid = jwt.sign({
  email: "admin@email.com",
  //id: existingUser.id, The id field is not required in any check, so it can be omitted
  username: "admin",
  role: "Admin"
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

/**
 * - Request Parameters: None
 * - Request Body Content: None
 * - Response `data` Content: An array of objects, each one having attributes `username`, `email` and `role`
 *    - Example: `res.status(200).json({data: [{username: "Mario", email: "mario.red@email.com", role: "Regular"}, {username: "Luigi", email: "luigi.red@email.com", role: "Regular"}, {username: "admin", email: "admin@email.com", role: "Regular"} ], refreshedTokenMessage: res.locals.refreshedTokenMessage})`
 * - Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin)
 */
describe("getUsers", () => {
  test("Returns empty list if there are no users", async () => {
    const response = await request(app)
      .get("/api/users")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual([])
  });

  test("Returns all users in database", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])

    const response = await request(app)
      .get("/api/users")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual([{
      username: "tester",
      email: "tester@test.com",
      role: "Regular",
    }, {
      username: "admin",
      email: "admin@email.com",
      role: "Admin"
    }])
  });

  test("Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin)", async () => {
    await User.create({
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid,
    })
    const response = await request(app)
      .get("/api/users")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)

    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty("error")
  });
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
  test("Returns the requested username by User", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
    },
    {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])

    const response = await request(app)
      .get("/api/users/tester")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual({
      username: "tester",
      email: "tester@test.com",
      role: "Regular",
    })
  });

  test("Returns the requested username by Admin", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
    },
    {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    },
    {
      username: "mario",
      email: "mario@test.com",
      password: "securepassword",
    }])

    const response = await request(app)
      .get("/api/users/mario")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual({
      username: "mario",
      email: "mario@test.com",
      role: "Regular",
    })
  });

  test("Returns a 400 error if the username passed as the route parameter does not represent a user in the database", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
    },
    {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])

    const response = await request(app)
      .get("/api/users/itachi")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
  });

  test("Returns a 401 error if called by an authenticated user who is neither the same user as the parameter (authType = User) nor an admin (authType = Admin)", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
    },
    {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])

    const response = await request(app)
      .get("/api/users/mario")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)

    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty("error")
  });
})

/**
 * - Request Parameters: None
 * - Request request body Content: An object having a string attribute for the `name` of the group and an array that lists all the `memberEmails`
 *   - Example: `{name: "Family", memberEmails: ["mario.red@email.com", "luigi.red@email.com"]}`
 * - Response `data` Content: An object having an attribute `group` (this object must have a string attribute for the `name` of the created group and an array for the `members` of the group), 
 *    an array that lists the `alreadyInGroup` members (members whose email is already present in a group) and an array that lists the `membersNotFound` (members whose email does not appear in the system)
 *   - Example: `res.status(200).json({data: {group: {name: "Family", members: [{email: "mario.red@email.com"}, {email: "luigi.red@email.com"}]}, membersNotFound: [], alreadyInGroup: []} refreshedTokenMessage: res.locals.refreshedTokenMessage})`
 * - If the user who calls the API does not have their email in the list of emails then their email is added to the list of members
 * - Returns a 400 error if the request body does not contain all the necessary attributes
 * - Returns a 400 error if the group name passed in the request body is an empty string
 * - Returns a 400 error if the group name passed in the request body represents an already existing group in the database
 * - Returns a 400 error if all the provided emails (the ones in the array, the email of the user calling the function does not have to be considered in this case) represent users that are already in a group or do not exist in the database
 * - Returns a 400 error if the user who calls the API is already in a group
 * - Returns a 400 error if at least one of the member emails is not in a valid email format
 * - Returns a 400 error if at least one of the member emails is an empty string
 * - Returns a 401 error if called by a user who is not authenticated (authType = Simple)
 */
describe("createGroup", () => {
  test("Returns the just created group, an alreadyInGroup list and a membersNotFound list", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    },
    {
      username: "mario",
      email: "mario@test.com",
      password: "securepassword",
    }])

    const admin = await User.findOne({ email: "admin@email.com" })
    await Group.create({ name: "onlyAdmins", members: [{ email: "admin@email.com", user: admin._id }] })

    const response = await request(app)
      .post("/api/groups")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ name: "holiday", memberEmails: ["tester@test.com", "mario@test.com", "admin@email.com"] })

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual({
      group: { name: "holiday", members: [{ email: "tester@test.com" }, { email: "mario@test.com" }] },
      membersNotFound: [],
      alreadyInGroup: [{ email: "admin@email.com" }]
    })
  });

  test("If the user who calls the API does not have their email in the list of emails then their email is added to the list of members", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    },
    {
      username: "mario",
      email: "mario@test.com",
      password: "securepassword",
    }])

    const admin = await User.findOne({ email: "admin@email.com" })
    await Group.create({ name: "onlyAdmins", members: [{ email: "admin@email.com", user: admin._id }] })

    const response = await request(app)
      .post("/api/groups")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ name: "holiday", memberEmails: ["mario@test.com", "itachi@email.com"] })

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual({
      group: { name: "holiday", members: [{ email: "mario@test.com" }, { email: "tester@test.com" }] },
      membersNotFound: [{ email: "itachi@email.com" }],
      alreadyInGroup: []
    })
  });

  test("Returns a 400 error if the request body does not contain all the necessary attributes", async () => {
    await User.create({
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    })

    const response = await request(app)
      .post("/api/groups")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Some Parameter is Missing")
  });

  test("Returns a 400 error if the group name passed in the request body is an empty string", async () => {
    await User.create({
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    })

    const response = await request(app)
      .post("/api/groups")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ name: " ", memberEmails: ["tester@test.com"] })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Group name is an Empty String")
  });

  test("Returns a 400 error if the group name passed in the request body represents an already existing group in the database", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }
    ])

    const admin = await User.findOne({ email: "admin@email.com" })
    await Group.create({ name: "exam", members: [{ email: "admin@email.com", user: admin._id }] })

    const response = await request(app)
      .post("/api/groups")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ name: "exam", memberEmails: ["tester@test.com"] })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Group already exists")
  });

  test("Returns a 400 error if all the provided emails (the ones in the array, the email of the user calling the function does not have to be considered in this case) represent users that are already in a group or do not exist in the database", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }
    ])

    const admin = await User.findOne({ email: "admin@email.com" })
    await Group.create({ name: "exam", members: [{ email: "admin@email.com", user: admin._id }] })

    const response = await request(app)
      .post("/api/groups")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ name: "holiday", memberEmails: ["admin@email.com", "itachi@leaf.com"] })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "All memberEmails does not exist or Already in Group")
  });

  test("Returns a 400 error if the user who calls the API is already in a group", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }
    ])

    const admin = await User.findOne({ email: "admin@email.com" })
    await Group.create({ name: "exam", members: [{ email: "admin@email.com", user: admin._id }] })

    const response = await request(app)
      .post("/api/groups")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ name: "holiday", memberEmails: ["tester@test.com"] })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Caller already in a group")
  });

  test("Returns a 400 error if at least one of the member emails is not in a valid email format", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }
    ])

    const response = await request(app)
      .post("/api/groups")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ name: "exam", memberEmails: ["tester@test.com", "fake.polito.it"] })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Invalid email format")
  });

  test("Returns a 400 error if at least one of the member emails is an empty string", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }
    ])

    const response = await request(app)
      .post("/api/groups")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ name: "exam", memberEmails: ["tester@test.com", " "] })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Email is an Empty String")
  });

  test("Returns a 400 error if the user who calls does not exist in database", async () => {
    const response = await request(app)
      .post("/api/groups")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ name: "exam", memberEmails: ["tester@test.com", "fake.polito.it"] })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "User not found")
  });
  
  test("Returns a 401 error if called by a user who is not authenticated (authType = Simple)", async () => {
    
    const response = await request(app)
      .post("/api/groups")
      .set("Cookie", `accessToken=""; refreshToken=""`)
      .send({ name: "exam", memberEmails: ["tester@test.com"] })

    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty("error")
  });
})

/**
 * - Request Parameters: None
 * - Request Body Content: None
 * - Response `data` Content: An array of objects, each one having a string attribute for the `name` of the group and an array for the `members` of the group
 *   - Example: `res.status(200).json({data: [{name: "Family", members: [{email: "mario.red@email.com"}, {email: "luigi.red@email.com"}]}] refreshedTokenMessage: res.locals.refreshedTokenMessage})`
 * - Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin)
 */
describe("getGroups", () => {
  test("Returns all groups on database", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    },
    {
      username: "mario",
      email: "mario@test.com",
      password: "securepassword",
    }])

    const userTester = await User.findOne({ email: "tester@test.com" })
    const userMario = await User.findOne({ email: "mario@test.com" })
    await Group.create({ name: "holiday", members: [{ email: "tester@test.com", user: userTester._id }, { email: "mario@test.com", user: userMario._id }] })
    const admin = await User.findOne({ email: "admin@email.com" })
    await Group.create({ name: "onlyAdmins", members: [{ email: "admin@email.com", user: admin._id }] })

    const response = await request(app)
      .get("/api/groups")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual([
      { name: "holiday", members: [{ email: "tester@test.com" }, { email: "mario@test.com" }] },
      { name: "onlyAdmins", members: [{ email: "admin@email.com" }] },
    ])
  });

  test("Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin)", async () => {
    await User.create({
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    })

    const response = await request(app)
      .get("/api/groups")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)

    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty("error")
  });
})

/**
 * - Request Parameters: A string equal to the `name` of the requested group
 *   - Example: `/api/groups/Family`
 * - Request Body Content: None
 * - Response `data` Content: An object having a string attribute for the `name` of the group and an array for the `members` of the group
 *   - Example: `res.status(200).json({data: {group: {name: "Family", members: [{email: "mario.red@email.com"}, {email: "luigi.red@email.com"}]}} refreshedTokenMessage: res.locals.refreshedTokenMessage})`
 * - Returns a 400 error if the group name passed as a route parameter does not represent a group in the database
 * - Returns a 401 error if called by an authenticated user who is neither part of the group (authType = Group) nor an admin (authType = Admin)
 */
describe("getGroup", () => {
  test("Returns the requested group", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    },
    {
      username: "mario",
      email: "mario@test.com",
      password: "securepassword",
    }])

    const userTester = await User.findOne({ email: "tester@test.com" })
    const userMario = await User.findOne({ email: "mario@test.com" })
    await Group.create({ name: "holiday", members: [{ email: "tester@test.com", user: userTester._id }, { email: "mario@test.com", user: userMario._id }] })

    const response = await request(app)
      .get("/api/groups/holiday")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual(
      { group: { name: "holiday", members: [{ email: "tester@test.com" }, { email: "mario@test.com" }] } }
    )
  });

  test("Returns a 400 error if the group name passed as a route parameter does not represent a group in the database", async () => {
    await User.create({
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    })

    const userTester = await User.findOne({ email: "tester@test.com" })
    await Group.create({ name: "holiday", members: [{ email: "tester@test.com", user: userTester._id }] })

    const response = await request(app)
      .get("/api/groups/sport")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Group Does Not exist")
  });

  test("Returns a 401 error if called by an authenticated user who is neither part of the group (authType = Group) nor an admin (authType = Admin)", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    },
    {
      username: "mario",
      email: "mario@test.com",
      password: "securepassword",
    }])

    const userMario = await User.findOne({ email: "mario@test.com" })
    await Group.create({ name: "holiday", members: [{ email: "mario@test.com", user: userMario._id }] })

    const response = await request(app)
      .get("/api/groups/holiday")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)

    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty("error")
  });
})

/**
 * - Request Parameters: A string equal to the `name` of the group
 *   - Example: `api/groups/Family/add` (user route)
 *   - Example: `api/groups/Family/insert` (admin route)
 * - Request Body Content: An array of strings containing the `emails` of the members to add to the group
 *   - Example: `{emails: ["pietro.blue@email.com"]}`
 * - Response `data` Content: An object having an attribute `group` (this object must have a string attribute for the `name` of the created group and an array for the `members` of the group, this array must include the new members as well as the old ones), 
 *   an array that lists the `alreadyInGroup` members (members whose email is already present in a group) and an array that lists the `membersNotFound` (members whose email does not appear in the system)
 *   - Example: `res.status(200).json({data: {group: {name: "Family", members: [{email: "mario.red@email.com"}, {email: "luigi.red@email.com"}, {email: "pietro.blue@email.com"}]}, membersNotFound: [], alreadyInGroup: []} refreshedTokenMessage: res.locals.refreshedTokenMessage})`
 * - In case any of the following errors apply then no user is added to the group
 * - Returns a 400 error if the request body does not contain all the necessary attributes
 * - Returns a 400 error if the group name passed as a route parameter does not represent a group in the database
 * - Returns a 400 error if all the provided emails represent users that are already in a group or do not exist in the database
 * - Returns a 400 error if at least one of the member emails is not in a valid email format
 * - Returns a 400 error if at least one of the member emails is an empty string
 * - Returns a 401 error if called by an authenticated user who is not part of the group (authType = Group) if the route is `api/groups/:name/add`
 * - Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin) if the route is `api/groups/:name/insert`
 */
describe("addToGroup", () => {
  test("Inserts user into requested group as admin", async () => {
    // create users 
    await User.insertMany([
      {
        username: "tester",
        email: "tester@test.com",
        password: "tester",
        refreshToken: testerAccessTokenValid
      },
      {
        username: "admin",
        email: "admin@email.com",
        password: "admin",
        refreshToken: adminAccessTokenValid,
        role: "Admin"
      },
      {
        username: "tester2",
        email: "tester2@test.com",
        password: "securepassword",
      }
    ])

    // create a group and add two of them into that group
    const user1 = await User.findOne({ email: "tester@test.com" })
    const user2 = await User.findOne({ email: "admin@email.com" })
    const user3 = await User.findOne({ email: "tester2@test.com" })
    await Group.create({
      name: "testgroup", members: [
        { email: "tester@test.com", user: user1._id },
        { email: "admin@email.com", user: user2._id }
      ]
    })

    // add a third one into the group with an API call
    const response = await request(app)
      .patch("/api/groups/testgroup/insert")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({emails: ["tester2@test.com"]})
    
    expect(response.status).toBe(200)
    expect(response.body.data).toEqual(
      {
        group: {
          name: "testgroup",
          members: [
            { email: "tester@test.com" },
            { email: "admin@email.com" },
            { email: "tester2@test.com" }
          ]
        }, 
        membersNotFound: [], 
        alreadyInGroup: []
      }
    )
  });

  test("Inserts user into requested group as user", async () => {
    await User.insertMany([
      {
        username: "tester",
        email: "tester@test.com",
        password: "tester",
        refreshToken: testerAccessTokenValid
      }, 
      {
        username: "admin",
        email: "admin@email.com",
        password: "admin",
        refreshToken: adminAccessTokenValid,
        role: "Admin"
      }, 
      {
        username: "tester2",
        email: "tester2@test.com",
        password: "securepassword",
      }
    ])

    const user1 = await User.findOne({ email: "tester@test.com" })
    const user2 = await User.findOne({ email: "admin@email.com" })
    const user3 = await User.findOne({ email: "tester2@test.com" })
    await Group.create({name: "testgroup", members: [
                  {email: "tester@test.com", user: user1._id},
                  {email: "admin@email.com", user: user2._id}
            ]
    })

    const response = await request(app)
      .patch("/api/groups/testgroup/add")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({emails: ["tester2@test.com", "notexisting@test.com"]})

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual(
      {
        group: {
          name: "testgroup", 
          members: [
            {email: "tester@test.com"}, 
            {email: "admin@email.com"}, 
            {email: "tester2@test.com"}
          ]
        }, 
        membersNotFound: [{email:"notexisting@test.com"}], 
        alreadyInGroup: []
      }
    )
  })

  test("Returns a 400 error if the request body does not contain all the necessary attributes", async () => {
    await User.insertMany([
      {
        username: "tester",
        email: "tester@test.com",
        password: "tester",
        refreshToken: testerAccessTokenValid
      }, 
      {
        username: "admin",
        email: "admin@email.com",
        password: "admin",
        refreshToken: adminAccessTokenValid,
        role: "Admin"
      }, 
      {
        username: "tester2",
        email: "tester2@test.com",
        password: "securepassword",
      }
    ])

    const user1 = await User.findOne({ email: "tester@test.com" })
    const user2 = await User.findOne({ email: "admin@email.com" })
    await Group.create({name: "testgroup", members: [
                  {email: "tester@test.com", user: user1._id},
                  {email: "admin@email.com", user: user2._id}
            ]
    })

    const response = await request(app)
      .patch("/api/groups/testgroup/add")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({}) // empty object for body

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Some Parameter is Missing")
  })

  test("Inserts user into requested group as user", async () => {
    await User.insertMany([
      {
        username: "tester",
        email: "tester@test.com",
        password: "tester",
        refreshToken: testerAccessTokenValid
      }, 
      {
        username: "admin",
        email: "admin@email.com",
        password: "admin",
        refreshToken: adminAccessTokenValid,
        role: "Admin"
      }, 
      {
        username: "tester2",
        email: "tester2@test.com",
        password: "securepassword",
      }
    ])

    const user1 = await User.findOne({ email: "tester@test.com" })
    const user2 = await User.findOne({ email: "admin@email.com" })
    const user3 = await User.findOne({ email: "tester2@test.com" })
    await Group.create({name: "testgroup", members: [
                  {email: "tester@test.com", user: user1._id},
                  {email: "admin@email.com", user: user2._id}
            ]
    })

    const response = await request(app)
      .patch("/api/groups/testgroup/add")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({emails: ["tester2@test.com", "notexisting@test.com"]})

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual(
      {
        group: {
          name: "testgroup", 
          members: [
            {email: "tester@test.com"}, 
            {email: "admin@email.com"}, 
            {email: "tester2@test.com"}
          ]
        }, 
        membersNotFound: [{email: "notexisting@test.com"}], 
        alreadyInGroup: []
      }
    )
  })

  test("Returns a 400 error if the request body does not contain all the necessary attributes", async () => {
    await User.insertMany([
      {
        username: "tester",
        email: "tester@test.com",
        password: "tester",
        refreshToken: testerAccessTokenValid
      }, 
      {
        username: "admin",
        email: "admin@email.com",
        password: "admin",
        refreshToken: adminAccessTokenValid,
        role: "Admin"
      }, 
      {
        username: "tester2",
        email: "tester2@test.com",
        password: "securepassword",
      }
    ])

    const user1 = await User.findOne({ email: "tester@test.com" })
    const user2 = await User.findOne({ email: "admin@email.com" })
    await Group.create({name: "testgroup", members: [
                  {email: "tester@test.com", user: user1._id},
                  {email: "admin@email.com", user: user2._id}
            ]
    })

    const response = await request(app)
      .patch("/api/groups/testgroup/add")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({}) // empty object for body

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Some Parameter is Missing")
  })

  test("Returns a 400 error if the group name passed as a route parameter does not represent a group in the database", async () => {
    await User.create({
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    })

    const response = await request(app)
      .patch("/api/groups/exam/insert")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ emails: ["mario@test.com"] })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Group not Found.")
  });

  test("Returns a 400 error if all the provided emails represent users that are already in a group or do not exist in the database", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])

    const user = await User.findOne({ email: "tester@test.com" })
    const admin = await User.findOne({ email: "admin@email.com" })
    await Group.create({ name: "exam", members: [{ email: "tester@test.com", user: user._id }, { email: "admin@email.com", user: admin._id }] })

    const response = await request(app)
      .patch("/api/groups/exam/add")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ emails: ["mario@test.com", "admin@email.com"] })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "All memberEmails does not exist or Already in Group")
  });

  test("Returns a 400 error if at least one of the member emails is not in a valid email format", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    },
    {
      username: "mario",
      email: "mario@test.com",
      password: "securepassword",
    }])

    const user = await User.findOne({ email: "tester@test.com" })
    await Group.create({ name: "exam", members: [{ email: "tester@test.com", user: user._id }] })

    const response = await request(app)
      .patch("/api/groups/exam/add")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ emails: ["fake.email.com"] })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Invalid email format")
  });

  test("Returns a 400 error if at least one of the member emails is an empty string", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    },
    {
      username: "mario",
      email: "mario@test.com",
      password: "securepassword",
    }])

    const user = await User.findOne({ email: "tester@test.com" })
    await Group.create({ name: "exam", members: [{ email: "tester@test.com", user: user._id }] })

    const response = await request(app)
      .patch("/api/groups/exam/add")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ emails: ["mario@test.com", " "] })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Some Parameter is an Empty String")
  });

  test("Returns a 401 error if called by an authenticated user who is not part of the group (authType = Group) if the route is `api/groups/:name/add`", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])

    const user = await User.findOne({ email: "admin@email.com" })
    await Group.create({ name: "exam", members: [{ email: "admin@email.com", user: user._id }] })

    const response = await request(app)
      .patch("/api/groups/exam/add")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ emails: ["tester@test.com"] })

    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty("error", "Group: user not in group")
  });

  test("Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin) if the route is `api/groups/:name/insert`", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])

    const user = await User.findOne({ email: "admin@email.com" })
    await Group.create({ name: "exam", members: [{ email: "admin@email.com", user: user._id }] })

    const response = await request(app)
      .patch("/api/groups/exam/insert")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ emails: ["tester@test.com"] })

    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty("error", "Admin: Mismatched role")
  });
})

describe("removeFromGroup", () => {
  test('Removes members from a group successfully', async () => {
    // Create a test group with name  and members
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: adminAccessTokenValid
    }, {
      username: "admin",
      email: "admin@test.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])


    const user1 = await User.findOne({ email: "tester@test.com" })
    const user2 = await User.findOne({ email: "admin@test.com" })
    await Group.create({ name: "testGroup", members: [{ email: "tester@test.com", _id: user1._id }, { email: "admin@test.com", _id: user2._id }] })


    const response = await request(app)
      .patch('/api/groups/testGroup/pull')
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ emails: ["tester@test.com"] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toEqual({
      data: {
        group: {
          __v: 0,
          _id: expect.any(String),
          name: 'testGroup',
          members: [
            { email: "admin@test.com", _id: expect.any(String), },
          ],
        },
        membersNotFound: [],
        notInGroup: [],
      }
    });

  });
  //Returns a 400 error if the request body does not contain all the necessary attributes
  test('Returns 400 error if the request body does not contain all the necessary attributes', async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: adminAccessTokenValid
    }, {
      username: "admin",
      email: "admin@test.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])

    const user1 = await User.findOne({ email: "tester@test.com" })
    const user2 = await User.findOne({ email: "admin@test.com" })
    await Group.create({ name: "testGroup", members: [{ email: "tester@test.com", _id: user1._id }, { email: "admin@test.com", _id: user2._id }] })


    const response = await request(app)
      .patch('/api/groups/testGroup/pull')
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({} );

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error',"Some Parameter is Missing");

  });
  //Returns a 400 error if the group name passed as a route parameter does not represent a group in the database
  test('Returns 400 error if the group name passed as a route parameter does not represent a group in the database', async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: adminAccessTokenValid
    }, {
      username: "admin",
      email: "admin@test.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])

    const user1 = await User.findOne({ email: "tester@test.com" })
    const user2 = await User.findOne({ email: "admin@test.com" })
    await Group.create({ name: "testGroup", members: [{ email: "tester@test.com", _id: user1._id }, { email: "admin@test.com", _id: user2._id }] })


    const response = await request(app)
      .patch('/api/groups/testGroupNonExists/pull')
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({emails: ["tester@test.com"]} );

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error',"Group not Found.");
  });
  //Returns a 400 error if all the provided emails represent users that do not belong to the group or do not exist in the database
  test('Returns 400 error if if all the provided emails represent users that do not belong to the group or do not exist in the database', async () => {
  await User.insertMany([
    {
    username: "tester",
    email: "tester@test.com",
    password: "tester",
    refreshToken: adminAccessTokenValid
  }, {
    username: "admin",
    email: "admin@test.com",
    password: "admin",
    refreshToken: adminAccessTokenValid,
    role: "Admin",
  },
   {
    username: "notInGroup",
    email: "notInGroup@test.com",
    password: "admin",
    refreshToken: adminAccessTokenValid,
    role: "Admin"
  }])

  const user1 = await User.findOne({ email: "tester@test.com" })
  const user2 = await User.findOne({ email: "admin@test.com" })
  await Group.create({ name: "testGroup", members: [{ email: "tester@test.com", user: user1._id }, { email: "admin@test.com", user: user2._id }] })


  const response = await request(app)
    .patch('/api/groups/testGroup/pull')
    .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
    .send({emails: ["testerNotExists@test.com","notInGroup@test.com"]} );

  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('error',"All memberEmails does not exist or Already in Group" );
});
  //Returns a 400 error if at least one of the emails is not in a valid email format
  test('Returns 400 error if at least one of the emails is not in a valid email format', async () => {
    await User.insertMany([
      {
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: adminAccessTokenValid
    }, {
      username: "admin",
      email: "admin@test.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin",
    }])
  
    const user1 = await User.findOne({ email: "tester@test.com" })
    const user2 = await User.findOne({ email: "admin@test.com" })
    await Group.create({ name: "testGroup", members: [{ email: "tester@test.com", user: user1._id }, { email: "admin@test.com", user: user2._id }] })
  
  
    const response = await request(app)
      .patch('/api/groups/testGroup/pull')
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({emails: ["testerNotExiststest.com","notInGroup@test.com"]} );
  
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error',"Invalid email format"  );
  });
  test('400 error if at least one of the emails is an empty string', async () => {
    // Create a test group with name "test-group" and members
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: adminAccessTokenValid
    }, {
      username: "admin",
      email: "admin@test.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])


    const user1 = await User.findOne({ email: "tester@test.com" })
    const user2 = await User.findOne({ email: "admin@test.com" })
    await Group.create({ name: "testGroup", members: [{ email: "tester@test.com", user: user1._id }, { email: "admin@test.com", user: user2._id }] })

    const response = await request(app)
      .patch('/api/groups/testGroup/pull')
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ emails: [" "] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Email is an Empty String');

  });

  test('400 error if the group contains only one member before deleting any user', async () => {
    // Create a test group with name "test-group" and members
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: adminAccessTokenValid
    }, {
      username: "admin",
      email: "admin@test.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])


    const user1 = await User.findOne({ email: "tester@test.com" })
    await Group.create({name: "testGroup", members: [{email: "tester@test.com", user: user1._id}]})

    const response = await request(app)
      .patch('/api/groups/testGroup/pull')
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ emails: ["tester@test.com"] });
  
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe("Can't remove all members");

  });

  test('401 error if called by an authenticated user who is not part of the group (authType = Group) if the route is api/groups/:name/remove', async () => {
    // Create a test group with name "test-group" and members
    await User.insertMany([{
      username: "user",
      email: "user@test.com",
      password: "user",
      refreshToken: adminAccessTokenValid
    }, {
      username: "admin",
      email: "admin@test.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])


    const user1 = await User.findOne({ email: "user@test.com" })
    const user2 = await User.findOne({ email: "admin@test.com" })
    const testGroup = await Group.create({name: "testGroup", members: [{email: "user@test.com", user: user1._id}, {email: "admin@test.com" , user: user2._id}]})


    const response = await request(app)
      .patch('/api/groups/testGroup/remove')
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ emails: ["user@test.com"] });
      
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Group: user not in group');

  });

  test('401 error if called by an authenticated user who is not an admin (authType = Admin) if the route is api/groups/:name/pull', async () => {
    // Create a test group with name "test-group" and members
    await User.insertMany([{
      username: "user",
      email: "user@test.com",
      password: "user",
      refreshToken: adminAccessTokenValid
    }, {
      username: "admin",
      email: "admin@test.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])


    const user1 = await User.findOne({ email: "user@test.com" })
    const user2 = await User.findOne({ email: "admin@test.com" })
    const testGroup = await Group.create({name: "testGroup", members: [{email: "user@test.com", user: user1._id}, {email: "admin@test.com" , user: user2._id}]})


    const response = await request(app)
      .patch('/api/groups/testGroup/pull')
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ emails: ["user@test.com"] });
      
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Admin: Mismatched role');

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
    await categories.create({ type: "food", color: "red" })
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])
    await transactions.insertMany([{
      username: "tester",
      type: "food",
      amount: 20
    }, {
      username: "tester",
      type: "food",
      amount: 100
    }])

    const response = await request(app)
      .delete("/api/users")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ email: "tester@test.com" })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveProperty("deletedTransactions", 2)
    expect(response.body.data).toHaveProperty("deletedFromGroup", false)
  });

  test("Should successfully delete the given user who was with other member in a group", async () => {
    await categories.create({ type: "food", color: "red" })
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    },
    {
      username: "mario",
      email: "mario@test.com",
      password: "securepassword",
    }])

    await transactions.insertMany([{
      username: "tester",
      type: "food",
      amount: 20
    }, {
      username: "mario",
      type: "food",
      amount: 100
    }])

    const userTester = await User.findOne({ email: "tester@test.com" })
    const userMario = await User.findOne({ email: "mario@test.com" })
    await Group.create({ name: "holiday", members: [{ email: "tester@test.com", user: userTester._id }, { email: "mario@test.com", user: userMario._id }] })

    const response = await request(app)
      .delete("/api/users")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ email: "tester@test.com" })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveProperty("deletedTransactions", 1)
    expect(response.body.data).toHaveProperty("deletedFromGroup", true)
    const groups = await Group.count();
    expect(groups).toBe(1)
  });

  test("Should successfully delete the given user who was alone in a group", async () => {
    await categories.create({ type: "food", color: "red" })
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    }])
    await transactions.insertMany([{
      username: "tester",
      type: "food",
      amount: 20
    }, {
      username: "tester",
      type: "food",
      amount: 100
    }])

    const userTester = await User.findOne({ email: "tester@test.com" })
    await Group.create({ name: "holiday", members: [{ email: "tester@test.com", _id: userTester._id }] })

    const response = await request(app)
      .delete("/api/users")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ email: "tester@test.com" })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveProperty("deletedTransactions", 2)
    expect(response.body.data).toHaveProperty("deletedFromGroup", true)
    const groups = await Group.count();
    expect(groups).toBe(0)
  });

  test("Should return error if the request body does not contain all the necessary attributes", async () => {
    await User.create({
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    })

    const response = await request(app)
      .delete("/api/users")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send()

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Some Parameter is Missing")
  });

  test("Should return error if the email passed in the request body is an empty string", async () => {
    await User.create({
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    })

    const response = await request(app)
      .delete("/api/users")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ email: " " })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Some Parameter is an Empty String")
  });

  test("Should return error if the email passed in the request body is not in correct email format", async () => {
    await User.create({
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    })

    const response = await request(app)
      .delete("/api/users")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ email: "invalidEmail.polito" })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Invalid email format")
  });

  test("Should return error if the email passed in the request body does not represent a user in the database", async () => {
    await User.create({
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    })

    const response = await request(app)
      .delete("/api/users")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ email: "tryToDelete.me@polito.it" })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "User Does Not exist")
  });

  test("Should return error if the email passed in the request body represents an admin", async () => {
    await User.insertMany([{
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    },
    {
      username: "admin2",
      email: "admin2@email.com",
      password: "theOtherAdminHatesMe",
      role: "Admin"
    }])

    const response = await request(app)
      .delete("/api/users")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ email: "admin2@email.com" })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "User is an Admin,can't delete")
  });

  test("Should return error if called by an authenticated user who is not an admin", async () => {
    await User.create({
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    })

    const response = await request(app)
      .delete("/api/users")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ email: "tester@test.com" })

    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty("error")
  });
})

/**
 * - Request Parameters: None
 * - Request Body Content: A string equal to the `name` of the group to be deleted
 *   - Example: `{name: "Family"}`
 * - Response `data` Content: A message confirming successful deletion
 *   - Example: `res.status(200).json({data: {message: "Group deleted successfully"} , refreshedTokenMessage: res.locals.refreshedTokenMessage})`
 * - Returns a 400 error if the request body does not contain all the necessary attributes
 * - Returns a 400 error if the name passed in the request body is an empty string
 * - Returns a 400 error if the name passed in the request body does not represent a group in the database
 * - Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin)
 */
describe("deleteGroup", () => {
  test("Returns confirmation message", async () => {
    await User.insertMany([{
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    }, {
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    },
    {
      username: "mario",
      email: "mario@test.com",
      password: "securepassword",
    }])

    const userTester = await User.findOne({ email: "tester@test.com" })
    const userMario = await User.findOne({ email: "mario@test.com" })
    await Group.create({ name: "holiday", members: [{ email: "tester@test.com", user: userTester._id }, { email: "mario@test.com", user: userMario._id }] })

    const response = await request(app)
      .delete("/api/groups")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ name: "holiday" })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveProperty("message")
    const groups = await Group.count();
    expect(groups).toBe(0)
  });

  test("Returns a 400 error if the request body does not contain all the necessary attributes", async () => {
    await User.create({
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    })

    const response = await request(app)
      .delete("/api/groups")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send()

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Some Parameter is Missing")
  });

  test("Returns a 400 error if the name passed in the request body is an empty string", async () => {
    await User.create({
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    })

    const response = await request(app)
      .delete("/api/groups")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ name: " " })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Some Parameter is an Empty String")
  });

  test("Returns a 400 error if the name passed in the request body does not represent a group in the database", async () => {
    await User.create({
      username: "admin",
      email: "admin@email.com",
      password: "admin",
      refreshToken: adminAccessTokenValid,
      role: "Admin"
    })

    const response = await request(app)
      .delete("/api/groups")
      .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
      .send({ name: "school" })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error", "Group Does Not exist")
  });

  test("Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin)", async () => {
    await User.create({
      username: "tester",
      email: "tester@test.com",
      password: "tester",
      refreshToken: testerAccessTokenValid
    })

    const response = await request(app)
      .delete("/api/groups")
      .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
      .send({ name: "school" })

    expect(response.status).toBe(401)
  });
})
