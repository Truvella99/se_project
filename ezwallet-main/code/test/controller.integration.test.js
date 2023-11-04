import request from 'supertest';
import { app } from '../app';
import { User, Group } from '../models/User.js';
import { categories, transactions } from '../models/model';
import jwt from 'jsonwebtoken';
const bcrypt = require("bcryptjs")
import mongoose, { Model } from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

beforeAll(async () => {
    const dbName = "testingDatabaseController";
    const url = `${process.env.MONGO_URI}/${dbName}`;

    await mongoose.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

});

afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
});

//necessary setup to ensure that each test can insert the data it needs
beforeEach(async () => {
    await categories.deleteMany({})
    await transactions.deleteMany({})
    await User.deleteMany({})
    await Group.deleteMany({})
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
 * - Request Body Content: An object having attributes `type` and `color`
 *    - Example: `{type: "food", color: "red"}`
 * - Response `data` Content: An object having attributes `type` and `color`
 *    - Example: `res.status(200).json({data: {type: "food", color: "red"}, refreshedTokenMessage: res.locals.refreshedTokenMessage})`
 * - Returns a 400 error if the request body does not contain all the necessary attributes
 * - Returns a 400 error if at least one of the parameters in the request body is an empty string
 * - Returns a 400 error if the type of category passed in the request body represents an already existing category in the database
 * - Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin)
 */
describe("createCategory", () => {
    test("Returns the created category", async () => {
        await User.create({
            username: "admin",
            email: "admin@email.com",
            password: "admin",
            refreshToken: adminAccessTokenValid,
            role: "Admin"
        })
        
        const response = await request(app)
            .post("/api/categories")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({type: "food", color: "red"})

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({type: "food", color: "red"})
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
            .post("/api/categories")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty('error');
    });

    test("Returns a 400 error if at least one of the parameters in the request body is an empty string", async () => {
        await User.create({
            username: "admin",
            email: "admin@email.com",
            password: "admin",
            refreshToken: adminAccessTokenValid,
            role: "Admin"
        })
        
        const response = await request(app)
            .post("/api/categories")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({type:"ColorIsEmpty", color: " "})

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty('error');
    });

    test("Returns a 400 error if the type of category passed in the request body represents an already existing category in the database", async () => {
        await categories.create({ type: "food", color: "red" })
        await User.create({
            username: "admin",
            email: "admin@email.com",
            password: "admin",
            refreshToken: adminAccessTokenValid,
            role: "Admin"
        })
        
        const response = await request(app)
            .post("/api/categories")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({type:"food", color: "yellow"})

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty('error');
    });

    test("Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin)", async () => {
        await User.create({
            username: "tester",
            email: "tester@test.com",
            password: "tester",
            refreshToken: testerAccessTokenValid
        })
        
        const response = await request(app)
            .post("/api/categories")
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({type:"car", color: "black"})

        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty('error');
    });
})

/**
 * - Request Parameters: A string equal to the `type` of the category that must be edited
 *   - Example: `api/categories/food`
 * - Request Body Content: An object having attributes `type` and `color` equal to the new values to assign to the category
 *   - Example: `{type: "Food", color: "yellow"}`
 * - Response `data` Content: An object with parameter `message` that confirms successful editing and a parameter `count` that is equal to the count of transactions whose category was changed with the new type
 *   - Example: `res.status(200).json({data: {message: "Category edited successfully", count: 2}, refreshedTokenMessage: res.locals.refreshedTokenMessage})`
 * - In case any of the following errors apply then the category is not updated, and transactions are not changed
 * - Returns a 400 error if the request body does not contain all the necessary attributes
 * - Returns a 400 error if at least one of the parameters in the request body is an empty string
 * - Returns a 400 error if the type of category passed as a route parameter does not represent a category in the database
 * - Returns a 400 error if the type of category passed in the request body as the new type represents an already existing category in the database and that category is not the same as the requested one
 * - Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin)
 */
describe("updateCategory", () => { 
    test("Returns a message for confirmation and the number of updated transactions", async () => {
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
        //The API request must be awaited as well
        const response = await request(app)
            .patch("/api/categories/food") //Route to call
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`) //Setting cookies in the request
            .send({ type: "health", color: "red" })

        expect(response.status).toBe(200)
        expect(response.body.data).toHaveProperty("message")
        expect(response.body.data).toHaveProperty("count", 2)
    })

    test("Returns a 400 error if the type of the new category is the same as one that exists already and that category is not the requested one", async () => {
        await categories.insertMany([{
            type: "food",
            color: "red"
        }, {
            type: "health",
            color: "blue"
        }])

        await User.create({
            username: "admin",
            email: "admin@email.com",
            password: "admin",
            refreshToken: adminAccessTokenValid,
            role: "Admin"
        })

        const response = await request(app)
            .patch("/api/categories/food")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({ type: "health", color: "green" }) //The passed type is one that already exists and is not the same one in the route

        //The response status must signal a wrong request
        expect(response.status).toBe(400)
        //The response body must contain a field named either "error" or "message" (both names are accepted but at least one must be present)
        const errorMessage = response.body.error ? true : response.body.message ? true : false
        //The test passes if the response body contains at least one of the two fields
        expect(errorMessage).toBe(true)
    })

    test("Returns a 400 error if the request body does not contain all the necessary parameters", async () => {
        await User.create({
            username: "admin",
            email: "admin@email.com",
            password: "admin",
            refreshToken: adminAccessTokenValid,
            role: "Admin"
        })
        const response = await request(app)
            .patch("/api/categories/food")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
        //The ".send()" block is missing, meaning that the request body will be empty
        //Appending ".send({}) leads to the same scenario, so both options are equivalent"

        expect(response.status).toBe(400)
        const errorMessage = response.body.error ? true : response.body.message ? true : false
        expect(errorMessage).toBe(true)
    })

    test("Returns a 400 error if at least one of the parameters in the request body is an empty string", async () => {
        await User.create({
            username: "admin",
            email: "admin@email.com",
            password: "admin",
            refreshToken: adminAccessTokenValid,
            role: "Admin"
        })
        const response = await request(app)
            .patch("/api/categories/food")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({type: " ", color: " "})

        expect(response.status).toBe(400)
        const errorMessage = response.body.error ? true : response.body.message ? true : false
        expect(errorMessage).toBe(true)
    })

    test("Returns a 400 error if the category does not exists", async () => {
        await User.create({
            username: "admin",
            email: "admin@email.com",
            password: "admin",
            refreshToken: adminAccessTokenValid,
            role: "Admin"
        })
        const response = await request(app)
            .patch("/api/categories/food")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({type: "non_existent_category", color: "blue"})

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe('This category does not exist.');
    })

    test("Returns a 401 error if called by a user who is not an Admin", async () => {
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
        const response = await request(app)
            .patch("/api/categories/food")
            //The cookies we set are those of a regular user, which will cause the verifyAuth check to fail
            //Other combinations that can cause the authentication check to fail are also accepted:
            //      - mismatched tokens: .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            //      - empty tokens: .set("Cookie", `accessToken=${testerAccessTokenEmpty}; refreshToken=${testerAccessTokenEmpty}`)
            //      - expired tokens: .set("Cookie", `accessToken=${testerAccessTokenExpired}; refreshToken=${testerAccessTokenExpired}`)
            //      - missing tokens: .set("Cookie", `accessToken=${}; refreshToken=${}`) (not calling ".set()" at all also works)
            //Testing just one authentication failure case is enough, there is NO NEED to check all possible token combination for each function
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({ type: "food", color: "green" })

        expect(response.status).toBe(401)
        const errorMessage = response.body.error ? true : response.body.message ? true : false
        expect(errorMessage).toBe(true)
    })

    test("Returns a 400 error if the type of category passed as a route parameter does not represent a category in the database", async () => {
        await categories.insertMany([{
            type: "food",
            color: "red"
        }])

        await User.create({
            username: "admin",
            email: "admin@email.com",
            password: "admin",
            refreshToken: adminAccessTokenValid,
            role: "Admin"
        })

        const response = await request(app)
            .patch("/api/categories/health")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            
        expect(response.status).toBe(400)
        const errorMessage = response.body.error ? true : response.body.message ? true : false
        expect(errorMessage).toBe(true)
    })
})

/**
 * - Request Parameters: None
 * - Request Body Content: An array of strings that lists the `types` of the categories to be deleted
 *   - Example: `{types: ["health"]}`
 * - Response `data` Content: An object with an attribute `message` that confirms successful deletion and an attribute `count` that specifies the number of transactions that have had their category type changed
 *   - Example: `res.status(200).json({data: {message: "Categories deleted", count: 1}, refreshedTokenMessage: res.locals.refreshedTokenMessage})`
 * - Given N = categories in the database and T = categories to delete:
 *   - If N > T then all transactions with a category to delete must have their category set to the oldest category that is not in T
 *   - If N = T then the oldest created category cannot be deleted and all transactions must have their category set to that category
 * - In case any of the following errors apply then no category is deleted
 * - Returns a 400 error if the request body does not contain all the necessary attributes
 * - Returns a 400 error if called when there is only one category in the database
 * - Returns a 400 error if at least one of the types in the array is an empty string
 * - Returns a 400 error if the array passed in the request body is empty
 * - Returns a 400 error if at least one of the types in the array does not represent a category in the database
 * - Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin)
 */
describe("deleteCategory", () => {
    test("Returns a message for confirmation and the number of updated transactions (N > T)", async () => {
        await categories.insertMany([
            { type: "food", color: "red" },
            { type: "health", color: "green" },
            { type: "car", color: "black" },
        ])
        await User.create({
            username: "admin",
            email: "admin@email.com",
            password: "admin",
            refreshToken: adminAccessTokenValid,
            role: "Admin"
        })
        await transactions.insertMany([{
            username: "tester",
            type: "car",
            amount: 400
        }, {
            username: "tester",
            type: "food",
            amount: 100
        }])

        const response = await request(app)
            .delete("/api/categories/")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({types: ["car"]})

        expect(response.status).toBe(200)
        expect(response.body.data).toHaveProperty("message")
        expect(response.body.data).toHaveProperty("count", 1)

        const tr = await transactions.find();
        let allTransactions = tr.map(t => Object.assign({}, { username: t.username, type: t.type, amount: t.amount }))
        
        expect(allTransactions).toEqual([{
            username: "tester",
            type: "food",
            amount: 400
        }, {
            username: "tester",
            type: "food",
            amount: 100
        }])
    });

    test("Returns a message for confirmation and the number of updated transactions (N == T)", async () => {
        await categories.insertMany([
            { type: "food", color: "red" },
            { type: "health", color: "green" },
            { type: "car", color: "black" },
        ])
        await User.create({
            username: "admin",
            email: "admin@email.com",
            password: "admin",
            refreshToken: adminAccessTokenValid,
            role: "Admin"
        })
        await transactions.insertMany([{
            username: "tester",
            type: "car",
            amount: 400
        }, {
            username: "tester",
            type: "health",
            amount: 100
        }])

        const response = await request(app)
            .delete("/api/categories/")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({types: ["car", "food", "health"]})

        expect(response.status).toBe(200)
        expect(response.body.data).toHaveProperty("message")
        expect(response.body.data).toHaveProperty("count", 2)

        const tr = await transactions.find();
        let allTransactions = tr.map(t => Object.assign({}, { username: t.username, type: t.type, amount: t.amount }))
        
        expect(allTransactions).toEqual([{
            username: "tester",
            type: "food",
            amount: 400
        }, {
            username: "tester",
            type: "food",
            amount: 100
        }])
    });

    test("Returns a 400 error if the array passed in the request body is empty", async () => {
        await User.create({
            username: "admin",
            email: "admin@email.com",
            password: "admin",
            refreshToken: adminAccessTokenValid,
            role: "Admin"
        })

        const response = await request(app)
            .delete("/api/categories/")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({types: []})

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error")
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
            .delete("/api/categories/")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send()

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error")
    });

    test("Returns a 400 error if called when there is only one category in the database", async () => {
        await categories.create({ type: "food", color: "red" })
        await User.create({
            username: "admin",
            email: "admin@email.com",
            password: "admin",
            refreshToken: adminAccessTokenValid,
            role: "Admin"
        })

        const response = await request(app)
            .delete("/api/categories/")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({types: ["food"]})

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error")
    });

    test("Returns a 400 error if at least one of the types in the array is an empty string", async () => {
        await categories.create({ type: "food", color: "red" })
        await User.create({
            username: "admin",
            email: "admin@email.com",
            password: "admin",
            refreshToken: adminAccessTokenValid,
            role: "Admin"
        })

        const response = await request(app)
            .delete("/api/categories/")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({types: ["food", " "]})

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error", "Some Parameter is an Empty String")
    });

    test("Returns a 400 error if at least one of the types in the array does not represent a category in the database", async () => {
        await categories.create({ type: "food", color: "red" })
        await User.create({
            username: "admin",
            email: "admin@email.com",
            password: "admin",
            refreshToken: adminAccessTokenValid,
            role: "Admin"
        })

        const response = await request(app)
            .delete("/api/categories/")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({types: ["food", "susanoo"]})

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error", "One or more Categories do not exists")
    });

    test("Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin)", async () => {
        await User.create({
            username: "tester",
            email: "tester@test.com",
            password: "tester",
            refreshToken: testerAccessTokenValid
        })

        const response = await request(app)
            .delete("/api/categories/")
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({types: []})

        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty("error")
    });
})

/**
 * - Request Parameters: None
 * - Request Body Content: None
 * - Response `data` Content: An array of objects, each one having attributes `type` and `color`
 *   - Example: `res.status(200).json({data: [{type: "food", color: "red"}, {type: "health", color: "green"}], refreshedTokenMessage: res.locals.refreshedTokenMessage})`
 * - Returns a 401 error if called by a user who is not authenticated (authType = Simple)
 */
describe("getCategories", () => {
    test("Returns all the categories on database", async () => {
        await categories.insertMany([
            { type: "food", color: "red" },
            { type: "health", color: "green"},
            { type: "car", color: "black"},
        ])
        await User.create({
            username: "tester",
            email: "tester@test.com",
            password: "tester",
            refreshToken: testerAccessTokenValid
        })
        
        const response = await request(app)
            .get("/api/categories/")
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)

        expect(response.status).toBe(200)
        expect(Array.isArray(response.body.data)).toBe(true)
        expect(response.body.data).toHaveLength(3);
        expect(response.body.data.every(grp => grp.hasOwnProperty('type') && grp.hasOwnProperty('color'))).toBe(true)
    });

    test("Returns error if called by a user who is not authenticated (authType = Simple)", async () => {
        await User.create({
            username: "tester",
            email: "tester@test.com",
            password: "tester",
            refreshToken: testerAccessTokenValid
        })
        
        const response = await request(app)
            .get("/api/categories/")
            .set("Cookie", `accessToken=""; refreshToken=""`)

        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty('error');
    });
})

describe("createTransaction", () => {
    test('Create transaction successfully', async () => {
        // Create a user for testing
        await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        // Create a category for testing
        await categories.create({ type: 'food', color: 'red' });

        const response = await request(app)
            .post('/api/users/tester/transactions')
            .set('Cookie', `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({ username: 'tester', amount: 50, type: 'food' });
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toEqual({
            username: 'tester',
            amount: 50,
            type: 'food',
            date: expect.any(String),
        });
    });

    // Test case: Missing parameters
    test('Missing parameters', async () => {
        const response = await request(app)
            .post('/api/users/tester/transactions')
            .set('Cookie', `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({});

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Some Parameter is Missing');
    });

    // Test case: Empty string parameters
    test('Empty string parameters', async () => {
        const response = await request(app)
            .post('/api/users/tester/transactions')
            .set('Cookie', `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({ username: ' ', amount: ' ', type: ' ' });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Some Parameter is an Empty String');
    });

    // Test case: Category does not exist
    test('Category does not exist', async () => {
        // Create a user for testing
        await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });

        const response = await request(app)
            .post('/api/users/tester/transactions')
            .set('Cookie', `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({ username: 'tester', amount: 50, type: 'nonexistent' });
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Category does not exist!');
    });

    // Test case: Mismatched usernames
    test('Mismatched usernames', async () => {
        // Create a user for testing
        await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        // Create a category for testing
        await categories.create({ type: 'food', color: 'red' });

        const response = await request(app)
            .post('/api/users/tester/transactions')
            .set('Cookie', `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({ username: 'different', amount: 50, type: 'food' });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Wrong Usernames');
    });

    // Test case: User does not exist
    test('User does not exist', async () => {
        //await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });

        // Create a category for testing
        await categories.create({ type: 'food', color: 'red' });

        const response = await request(app)
            .post('/api/users/tester/transactions')
            .set('Cookie', `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({ username: 'tester', amount: 50, type: 'food' });
        //tester Cookies are defined but doesn't exists in the db
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'User does not exist!');
    });

    // Test case: Invalid amount
    test('Invalid amount', async () => {
        // Create a user for testing
        await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        // Create a category for testing
        await categories.create({ type: 'food', color: 'red' });

        const response = await request(app)
            .post('/api/users/tester/transactions')
            .set('Cookie', `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({ username: 'tester', amount: 'abc', type: 'food' });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Amount not valid');
    });
    // Test case:Returns 401 error when unauthorized
    test(' Returns 401 error when unauthorized', async () => {
        const response = await request(app)
        .post('/api/users/tester/transactions') 
        .set('Cookie', `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
        .send({ username: 'tester', amount: 50, type: 'food' });
    
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
})

describe("getAllTransactions", () => {
    test('Returns all transactions when you are admin', async () => {
        await categories.create({ type: 'food', color: 'red' });
        await User.insertMany([
            {
                username: 'tester',
                email: 'tester@test.com',
                password: 'tester',
                refreshToken: testerAccessTokenValid,
            },
            {
                username: 'admin',
                email: 'admin@email.com',
                password: 'admin',
                refreshToken: adminAccessTokenValid,
                role: 'Admin',
            },
        ]);
        let trans = await transactions.insertMany([
            { username: 'tester', type: 'food', amount: 20 },
            { username: 'tester', type: 'food', amount: 100 },
            { username: 'admin', type: 'food', amount: 200 },

        ]);

        const response = await request(app)
            .get('/api/transactions')
            .set('Cookie', `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`);

        let ExpectedData = trans.map(v => Object.assign({}, { username: v.username, type: v.type, amount: v.amount, date: v.date.toISOString(), color: "red" }))

        expect(ExpectedData).toEqual(response.body.data);
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
    });
    test('Returns unauthorized error for non-admin', async () => {
        const response = await request(app)
            .get('/api/transactions')
            .set('Cookie', `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', "Admin: Mismatched role");
        expect(response.body).not.toHaveProperty('data');
    });


})

describe("getTransactionsByUser", () => { 
    test('should return transactions for a specific user', async () => {
        // Create test data
        const user = await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        const category = await categories.create({ type: 'Test Category', color: 'blue' });
        const Transaction = await transactions.create({
          username: 'tester',
          type: 'Test Category',
          amount: 100,
          date: new Date(),
        });
        const ret_value = {
            username: Transaction.username,
            type: Transaction.type,
            amount: Transaction.amount,
            date: Transaction.date.toISOString(),
            color: 'blue'
        };
        // Make the request
        const response = await request(app)
          .get(`/api/users/${user.username}/transactions`)
          .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);
    
        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toStrictEqual(new Array(ret_value));
    });
    test('should return transactions for a specific user without filtering (Admin)', async () => {
        // Create test data
        const user = await User.create({ username: 'admin', email: 'admin@email.com', password: 'admin', role:"Admin" });
        const category = await categories.create({ type: 'Test Category', color: 'blue' });
        const Transaction = await transactions.create({
          username: 'admin',
          type: 'Test Category',
          amount: 100,
          date: new Date(),
        });
        const ret_value = {
            username: Transaction.username,
            type: Transaction.type,
            amount: Transaction.amount,
            date: Transaction.date.toISOString(),
            color: 'blue'
        };
        // Make the request
        const response = await request(app)
          .get(`/api/transactions/users/${user.username}`)
          .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`);
    
        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toStrictEqual(new Array(ret_value));
    });
    test('400 error if the username passed as a route parameter does not represent a user in the database', async () => {
        // Make the request
        const response = await request(app)
          .get(`/api/users/tester/transactions`)
          .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);
    
        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe("User not Found.");
    });
    test('401 error if called by an authenticated user who is not the same user as the one in the route (authType = User) if the route is /api/users/:username/transactions', async () => {
        // Make the request
        const response = await request(app)
          .get(`/api/users/fakeUser/transactions`)
          .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);
    
        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe("User: Mismatched users");
    });
    test('Returns a 401 error if called by an authenticated user who is not an admin (authType = Admin) if the route is /api/transactions/users/:username', async () => {
        const user = await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        const category = await categories.create({ type: 'Test Category', color: 'blue' });
        const Transaction = await transactions.create({
          username: 'tester',
          type: 'Test Category',
          amount: 100,
          date: new Date(),
        });
        // Make the request
        const response = await request(app)
          .get(`/api/transactions/users/${user.username}`)
          .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);
    
        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe("Admin: Mismatched role");
    });
})

describe("getTransactionsByUserByCategory", () => { 
    test('should return transactions for a specific user and category', async () => {
        // Create test data
        const user = await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        const category = await categories.create({ type: 'Test Category', color: 'blue' });
        const Transaction = await transactions.create({
          username: 'tester',
          type: 'Test Category',
          amount: 100,
          date: new Date(),
        });
        const ret_value = {
            username: Transaction.username,
            type: Transaction.type,
            amount: Transaction.amount,
            date: Transaction.date.toISOString(),
            color: 'blue'
        };
        // Make the request
        const response = await request(app)
          .get(`/api/users/${user.username}/transactions/category/${category.type}`)
          .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);
    
        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toStrictEqual(new Array(ret_value));
    });
    test('400 error if the username passed as a route parameter does not represent a user in the database', async () => {
        // Create test data
        const user = await User.create({ username: 'another_user', email: 'tester@test.com', password: 'tester' });
        const category = await categories.create({ type: 'Test Category', color: 'blue' });
        // Make the request
        const response = await request(app)
          .get(`/api/users/tester/transactions/category/${category.type}`)
          .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);
    
        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe("User not Found.");
    });
    test('400 error if the category passed as a route parameter does not represent a category in the database', async () => {
        // Create test data
        const user = await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        await categories.create({ type: 'Test Category', color: 'blue' });
        // Make the request
        const response = await request(app)
          .get(`/api/users/${user.username}/transactions/category/fakeCategory`)
          .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);
    
        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe("Category not Found.");
    });
    test('401 error if called by an authenticated user who is not the same user as the one in the route (authType = User) if the route is /api/users/:username/transactions/category/:category', async () => {
        // Create test data
        const category = await categories.create({ type: 'Test Category', color: 'blue' });
        // Make the request
        const response = await request(app)
          .get(`/api/users/fakeUser/transactions/category/${category.type}`)
          .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);
    
        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe("User: Mismatched users");
    });
    test('401 error if called by an authenticated user who is not an admin (authType = Admin) if the route is /api/transactions/users/:username/category/:category', async () => {
        // Create test data
        const user = await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        const category = await categories.create({ type: 'Test Category', color: 'blue' });
        const Transaction = await transactions.create({
          username: 'tester',
          type: 'Test Category',
          amount: 100,
          date: new Date(),
        });
        const ret_value = {
            username: Transaction.username,
            type: Transaction.type,
            amount: Transaction.amount,
            date: Transaction.date.toISOString(),
            color: 'blue'
        };
        // Make the request
        const response = await request(app)
          .get(`/api/transactions/users/${user.username}/category/${category.type}`)
          .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);
    
        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe("Admin: Mismatched role");
    });
})

describe("getTransactionsByGroup", () => { 
    test('should return transactions for a specific group', async () => {
        // Create User
        const user = await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        // Create test data
        const group = await Group.create({ name: 'Test Group', members: [{ email: user.email, user: user._id }] });
        await categories.create({ type: 'Test Category', color: 'blue' });
        const Transaction = await transactions.create({
            username: 'tester',
            type: 'Test Category',
            amount: 100,
            date: new Date(),
        });
        const ret_value = {
            username: Transaction.username,
            type: Transaction.type,
            amount: Transaction.amount,
            date: Transaction.date.toISOString(),
            color: 'blue'
        };
        // Make the request
        const response = await request(app)
            .get(`/api/groups/${group.name}/transactions`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);

        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toStrictEqual(new Array(ret_value));
    });
    test('400 error if the group name passed as a route parameter does not represent a group in the database', async () => {
        // Create User
        const user = await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        // Create test data
        const group = await Group.create({ name: 'Test Group', members: [{ email: user.email, user: user._id }] });
        await categories.create({ type: 'Test Category', color: 'blue' });
        const Transaction = await transactions.create({
            username: 'tester',
            type: 'Test Category',
            amount: 100,
            date: new Date(),
        });
        // Make the request
        const response = await request(app)
            .get(`/api/groups/fakegroup/transactions`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe("Group not Found.");
    });
    test('401 error if called by an authenticated user who is not part of the group (authType = Group) if the route is /api/groups/:name/transactions', async () => {
        // Create test data
        const group = await Group.create({ name: 'Test Group', members: [] });
        await categories.create({ type: 'Test Category', color: 'blue' });
        const Transaction = await transactions.create({
            username: 'tester',
            type: 'Test Category',
            amount: 100,
            date: new Date(),
        });
        // Make the request
        const response = await request(app)
            .get(`/api/groups/${group.name}/transactions`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);

        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe("Group: user not in group");
    });
    test('401 error if called by an authenticated user who is not an admin (authType = Admin) if the route is /api/transactions/groups/:name', async () => {
        // Create User
        const user = await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        // Create test data
        const group = await Group.create({ name: 'Test Group', members: [{ email: user.email, user: user._id }] });
        await categories.create({ type: 'Test Category', color: 'blue' });
        const Transaction = await transactions.create({
            username: 'tester',
            type: 'Test Category',
            amount: 100,
            date: new Date(),
        });
        // Make the request
        const response = await request(app)
            .get(`/api/transactions/groups/${group.name}`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);

        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe("Admin: Mismatched role");
    });
})

describe("getTransactionsByGroupByCategory", () => { 
    test('should get all transactions of a certain group and a certain category', async () => {
        // Create test data
        const user = await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        const group = await Group.create({ name: 'Test Group', members: [{email: user.email, user: user._id}] });
        const category = await categories.create({ type: 'Test Category', color: 'blue' });
        const Transaction = await transactions.create({
            username: 'tester',
            type: category.type,
            amount: 100,
            date: new Date(),
        });
        const ret_value = {
            username: Transaction.username,
            type: Transaction.type,
            amount: Transaction.amount,
            date: Transaction.date.toISOString(),
            color: 'blue'
        };

        // Make the request
        const response = await request(app)
            .get(`/api/groups/${group.name}/transactions/category/${category.type}`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);

        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toStrictEqual(new Array(ret_value));
    });
    test('400 error if the group name passed as a route parameter does not represent a group in the database', async () => {
        // Create test data
        const user = await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        const group = await Group.create({ name: 'Test Group', members: [{email: user.email, user: user._id}] });
        const category = await categories.create({ type: 'Test Category', color: 'blue' });
        let Transaction = await transactions.create({
            username: 'tester',
            type: category.type,
            amount: 100,
            date: new Date(),
        });
        // Make the request
        const response = await request(app)
            .get(`/api/groups/falsegroup/transactions/category/${category.type}`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe("Group not Found.");
    });
    test('400 error if the category passed as a route parameter does not represent a category in the database', async () => {
        // Create test data
        const user = await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        const group = await Group.create({ name: 'Test Group', members: [{email: user.email, user: user._id}] });
        const category = await categories.create({ type: 'Test Category', color: 'blue' });
        let Transaction = await transactions.create({
            username: 'tester',
            type: category.type,
            amount: 100,
            date: new Date(),
        });
        // Make the request
        const response = await request(app)
            .get(`/api/groups/${group.name}/transactions/category/false_category`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe("Category not Found.");
    });
    test('401 error if called by an authenticated user who is not part of the group (authType = Group) if the route is /api/groups/:name/transactions/category/:category', async () => {
        // Create test data
        const group = await Group.create({ name: 'Test Group', members: [] });
        const category = await categories.create({ type: 'Test Category', color: 'blue' });
        let Transaction = await transactions.create({
            username: 'tester',
            type: category.type,
            amount: 100,
            date: new Date(),
        });
        // Make the request
        const response = await request(app)
            .get(`/api/groups/${group.name}/transactions/category/${category.type}`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);

        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe("Group: user not in group");
    });
    test('401 error if called by an authenticated user who is not an admin (authType = Admin) if the route is /api/transactions/groups/:name/category/:category', async () => {
        // Create test data
        const group = await Group.create({ name: 'Test Group', members: [] });
        const category = await categories.create({ type: 'Test Category', color: 'blue' });
        let Transaction = await transactions.create({
            username: 'tester',
            type: category.type,
            amount: 100,
            date: new Date(),
        });
        // Make the request
        const response = await request(app)
            .get(`/api/transactions/groups/${group.name}/category/${category.type}`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`);

        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toBe("Admin: Mismatched role");
    });
})

describe("deleteTransaction", () => { 
    test('should delete transaction when user authentication is successful and valid ID is provided', async () => {
        const username = 'tester';
        await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        // create category
        await categories.create({
            type: "cat1",
            color: "blue"
        })
        // create transactions
        const Transaction = await transactions.create(
            {
                username: "tester",
                amount: 100,
                type: "cat1",
                date: new Date()
            })
        //The API request must be awaited as well
        const response = await request(app)
            .delete(`/api/users/${username}/transactions`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({ _id: Transaction._id });

        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty("data")
        expect(response.body.data).toHaveProperty("message")
        expect(response.body.data.message).toBe("Transaction deleted")    
    });
    test('400 error if the request body does not contain all the necessary attributes', async () => {
        const username = 'tester';
        // create category
        await categories.create({
            type: "cat1",
            color: "blue"
        })
        //The API request must be awaited as well
        const response = await request(app)
            .delete(`/api/users/${username}/transactions`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send();

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error")
        expect(response.body.error).toBe("Some Parameter is Missing")
    });
    test('400 error if the _id in the request body is an empty string', async () => {
        const username = 'tester';
        // create category
        await categories.create({
            type: "cat1",
            color: "blue"
        })
        //The API request must be awaited as well
        const response = await request(app)
            .delete(`/api/users/${username}/transactions`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({ _id: ' ' });

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error")
        expect(response.body.error).toBe("Some Parameter is an Empty String")
    });
    test('400 error if the username passed as a route parameter does not represent a user in the database', async () => {
        const username = 'tester';
        await User.create({ username: 'wrong', email: 'tester@test.com', password: 'tester' });
        // create category
        await categories.create({
            type: "cat1",
            color: "blue"
        })
        // create transactions
        const Transaction = await transactions.create(
            {
                username: "tester",
                amount: 100,
                type: "cat1",
                date: new Date()
            })
        //The API request must be awaited as well
        const response = await request(app)
            .delete(`/api/users/${username}/transactions`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({ _id: Transaction._id });

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error")
        expect(response.body.error).toBe("User not Found.")
    });
    test('400 error if the _id in the request body does not represent a transaction in the database', async () => {
        const username = 'tester';
        await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        // create category
        await categories.create({
            type: "cat1",
            color: "blue"
        })
        //The API request must be awaited as well
        const response = await request(app)
            .delete(`/api/users/${username}/transactions`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({ _id: mongoose.Types.ObjectId() });

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error")
        expect(response.body.error).toBe("Transaction not Found.")    
    });
    test('400 error if the _id in the request body represents a transaction made by a different user than the one in the route', async () => {
        const username = 'tester';
        await User.create({ username: 'tester', email: 'tester@test.com', password: 'tester' });
        // create category
        await categories.create({
            type: "cat1",
            color: "blue"
        })
        // create transactions
        const Transaction = await transactions.create(
            {
                username: "another_user",
                amount: 100,
                type: "cat1",
                date: new Date()
            })
        //The API request must be awaited as well
        const response = await request(app)
            .delete(`/api/users/${username}/transactions`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({ _id: Transaction._id });

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error")
        expect(response.body.error).toBe("Transaction not Found.")    
    });
    test('401 error if called by an authenticated user who is not the same user as the one in the route (authType = User)', async () => {
        const username = 'another_user';
        // create category
        await categories.create({
            type: "cat1",
            color: "blue"
        })
        // create transactions
        const Transaction = await transactions.create(
            {
                username: "another_user",
                amount: 100,
                type: "cat1",
                date: new Date()
            })
        //The API request must be awaited as well
        const response = await request(app)
            .delete(`/api/users/${username}/transactions`)
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({ _id: Transaction._id });

        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty("error")
        expect(response.body.error).toBe("User: Mismatched users")    
    });
})

describe("deleteTransactions", () => { 
    test('should delete transactions when admin authentication is successful and valid IDs are provided', async () => {
        // create category
        await categories.create({
            type: "cat1",
            color: "blue"
        })
        // create transactions
        const Transactions = await transactions.insertMany([
            {
                username: "user1",
                amount: 100,
                type: "cat1",
                date: new Date()
            },
            {
                username: "user2",
                amount: 10,
                type: "cat1",
                date: new Date()
            },
            {
                username: "user1",
                amount: 30,
                type: "cat1",
                date: new Date()
            }
        ])
        //The API request must be awaited as well
        const req_body = Transactions.map((t) => t._id);
        const response = await request(app)
            .delete("/api/transactions")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({ _ids: req_body });

        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty("data")
        expect(response.body.data).toHaveProperty("message")
        expect(response.body.data.message).toBe("Transactions deleted")    
    });
    test('400 error if the request body does not contain all the necessary attributes', async () => {
        // create category
        await categories.create({
            type: "cat1",
            color: "blue"
        })
        // create transactions
        const Transactions = await transactions.insertMany([
            {
                username: "user1",
                amount: 100,
                type: "cat1",
                date: new Date()
            },
            {
                username: "user2",
                amount: 10,
                type: "cat1",
                date: new Date()
            },
            {
                username: "user1",
                amount: 30,
                type: "cat1",
                date: new Date()
            }
        ])
        //The API request must be awaited as well
        const response = await request(app)
            .delete("/api/transactions")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({});

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error")
        expect(response.body.error).toBe("Some Parameter is Missing")    
    });
    test('400 error if at least one of the ids in the array is an empty string', async () => {
        // create category
        await categories.create({
            type: "cat1",
            color: "blue"
        })
        // create transactions
        const Transactions = await transactions.insertMany([
            {
                username: "user1",
                amount: 100,
                type: "cat1",
                date: new Date()
            },
            {
                username: "user2",
                amount: 10,
                type: "cat1",
                date: new Date()
            },
            {
                username: "user1",
                amount: 30,
                type: "cat1",
                date: new Date()
            }
        ])
        //The API request must be awaited as well
        const req_body = Transactions.map((t) => ' ');
        const response = await request(app)
            .delete("/api/transactions")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({ _ids: req_body });

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error")
        expect(response.body.error).toBe("Some Parameter is an Empty String")    
    });
    test('400 error if at least one of the ids in the array does not represent a transaction in the database', async () => {
        // create category
        await categories.create({
            type: "cat1",
            color: "blue"
        })
        // create transactions
        const Transactions = await transactions.insertMany([
            {
                username: "user1",
                amount: 100,
                type: "cat1",
                date: new Date()
            },
            {
                username: "user2",
                amount: 10,
                type: "cat1",
                date: new Date()
            },
            {
                username: "user1",
                amount: 30,
                type: "cat1",
                date: new Date()
            }
        ])
        //The API request must be awaited as well
        const req_body = Transactions.map((t) => {
            return mongoose.Types.ObjectId(); // Generate a new ObjectId
        });
        const response = await request(app)
            .delete("/api/transactions")
            .set("Cookie", `accessToken=${adminAccessTokenValid}; refreshToken=${adminAccessTokenValid}`)
            .send({ _ids: req_body });

        expect(response.status).toBe(400)
        expect(response.body).toHaveProperty("error")
        expect(response.body.error).toBe("Transaction not found.")    
    });
    test('401 error if called by an authenticated user who is not an admin (authType = Admin)', async () => {
        // create category
        await categories.create({
            type: "cat1",
            color: "blue"
        })
        // create transactions
        const Transactions = await transactions.insertMany([
            {
                username: "user1",
                amount: 100,
                type: "cat1",
                date: new Date()
            },
            {
                username: "user2",
                amount: 10,
                type: "cat1",
                date: new Date()
            },
            {
                username: "user1",
                amount: 30,
                type: "cat1",
                date: new Date()
            }
        ])
        //The API request must be awaited as well
        const req_body = Transactions.map((t) => t._id);
        const response = await request(app)
            .delete("/api/transactions")
            .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`)
            .send({ _ids: req_body });

        expect(response.status).toBe(401)
        expect(response.body).toHaveProperty("error")
        expect(response.body.error).toBe("Admin: Mismatched role")    
    });
})
