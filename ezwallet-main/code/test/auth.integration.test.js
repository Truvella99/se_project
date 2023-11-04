import request from 'supertest';
import { app } from '../app';
import { User, Group } from '../models/User.js';
import { categories,transactions } from '../models/model';
import jwt from 'jsonwebtoken';
const bcrypt = require("bcryptjs")
import mongoose, { Model } from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
process.env.ACCESS_KEY = "EZWALLET"

beforeAll(async () => {
  const dbName = "testingDatabaseAuth";
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

describe('register', () => {
  test("register: register a user with success", async () => {
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/register") 
      .send({ username: 'user1', email: 'user1@ref.com', password: 'pass' })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty("data")
    expect(response.body.data).toHaveProperty("message")
    expect(response.body.data.message).toBe("User added successfully")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });

  test("register: 400 error if the request body does not contain all the necessary attributes", async () => {
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/register") 
      .send({email: 'user1@ref.com', password: 'pass' })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("Some Parameter is Missing")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });

  test("register: 400 error if at least one of the parameters in the request body is an empty string", async () => {
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/register") 
      .send({username: ' ', email: ' ', password: ' ' })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("Some Parameter is an Empty String")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });

  test("register: 400 error if the email in the request body is not in a valid email format", async () => {
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/register") 
      .send({ username: 'user1', email: 'user1ref.com', password: 'pass' })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("Invalid email format")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });

  test("register: 400 error if the username in the request body identifies an already existing user", async () => {
    const password = 'pass';
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
      email: 'user2@ref.com',
      id: '6429bef916d9643d863aa7b7',
      username: 'user1',
      role: 'Regular',
      password: hashedPassword
    };
    await User.create({
      username: user.username,
      email: user.email,
      password: user.password
    })
    
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/register") 
      .send({ username: 'user1', email: 'user1@ref.com', password: 'pass' })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("already existing user")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });

  test("register: 400 error if the email in the request body identifies an already existing user", async () => {
    const password = 'pass';
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
      email: 'user1@ref.com',
      id: '6429bef916d9643d863aa7b7',
      username: 'user2',
      role: 'Regular',
      password: hashedPassword
    };
    await User.create({
      username: user.username,
      email: user.email,
      password: user.password
    })
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/register") 
      .send({ username: 'user1', email: 'user1@ref.com', password: 'pass' })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("already existing user")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });
});

describe('registerAdmin', () => {
  test("registerAdmin: register a user with success", async () => {
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/admin") 
      .send({ username: 'user1', email: 'user1@ref.com', password: 'pass' })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty("data")
    expect(response.body.data).toHaveProperty("message")
    expect(response.body.data.message).toBe("User added successfully")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });

  test("registerAdmin: 400 error if the request body does not contain all the necessary attributes", async () => {
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/admin") 
      .send({email: 'user1@ref.com', password: 'pass' })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("Some Parameter is Missing")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });

  test("registerAdmin: 400 error if at least one of the parameters in the request body is an empty string", async () => {
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/admin") 
      .send({username: ' ', email: ' ', password: ' ' })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("Some Parameter is an Empty String")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });

  test("registerAdmin: 400 error if the email in the request body is not in a valid email format", async () => {
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/admin") 
      .send({ username: 'user1', email: 'user1ref.com', password: 'pass' })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("Invalid email format")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });

  test("registerAdmin: 400 error if the username in the request body identifies an already existing user", async () => {
    const password = 'pass';
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
      email: 'user2@ref.com',
      id: '6429bef916d9643d863aa7b7',
      username: 'user1',
      password: hashedPassword,
      role: "Admin"
    };
    await User.create({
      username: user.username,
      email: user.email,
      password: user.password,
      role: user.role
    })
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/admin") 
      .send({ username: 'user1', email: 'user1@ref.com', password: 'pass' })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("already existing user")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });

  test("registerAdmin: 400 error if the email in the request body identifies an already existing user", async () => {
    const password = 'pass';
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
      email: 'user1@ref.com',
      id: '6429bef916d9643d863aa7b7',
      username: 'user2',
      password: hashedPassword,
      role: "Admin"
    };
    await User.create({
      username: user.username,
      email: user.email,
      password: user.password,
      role: user.role
    })

    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/admin") 
      .send({ username: 'user1', email: 'user1@ref.com', password: 'pass' })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("already existing user")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });
});

describe('login', () => { 
  test('login: login with success', async () => {
    const password = 'pass';
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
      email: 'user1@ref.com',
      id: '6429bef916d9643d863aa7b7',
      username: 'user1',
      password: hashedPassword
    };
    await User.create({
      username: user.username,
      email: user.email,
      password: user.password
    })
    
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/login") 
      .send({ email: user.email, password: password })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty("data")
    expect(response.body.data).toHaveProperty("accessToken")
    expect(response.body.data).toHaveProperty("refreshToken")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });
  test('login: 400 error if the request body does not contain all the necessary attributes', async () => {
    const password = 'pass';
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/login") 
      .send({ password: password })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("Some Parameter is Missing")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });
  test('login: 400 error if at least one of the parameters in the request body is an empty string', async () => {
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/login") 
      .send({ email: ' ', password: ' ' })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("Some Parameter is an Empty String")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });
  test('login: 400 error if the email in the request body is not in a valid email format', async () => {
    const user = {
      email: 'use@r1@ref.com',
      password: 'pass'
    };
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/login") 
      .send({ email: user.email, password: user.password })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("Invalid email format")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });
  test('login: 400 error if the email in the request body does not identify a user in the database', async () => {
    const password = 'pass';
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
      email: 'user1@ref.com',
      id: '6429bef916d9643d863aa7b7',
      username: 'user1',
      password: hashedPassword
    };
    await User.create({
      username: user.username,
      email: user.email,
      password: user.password
    })
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/login") 
      .send({ email: 'user2@ref.com', password: password })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("please you need to register")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });
  test('login: 400 error if the supplied password does not match with the one in the database', async () => {
    const password = 'pass';
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = {
      email: 'user1@ref.com',
      id: '6429bef916d9643d863aa7b7',
      username: 'user1',
      password: hashedPassword
    };
    await User.create({
      username: user.username,
      email: user.email,
      password: user.password
    })
    //The API request must be awaited as well
    const response = await request(app)
      .post("/api/login") 
      .send({ email: user.email, password: 'wrongPass' })

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty("error")
    expect(response.body.error).toBe("wrong credentials")
    //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
  });
});

describe('logout', () => { 
    test('logout: logout with success', async () => {
      const password = 'pass';
      const hashedPassword = await bcrypt.hash(password, 12);
      const user = {
        email: 'user1@ref.com',
        id: '6429bef916d9643d863aa7b7',
        username: 'user1',
        password: hashedPassword
      };
      await User.create({
        username: user.username,
        email: user.email,
        password: user.password
      })
      
      //The API request must be awaited as well
      const login = await request(app)
        .post("/api/login") 
        .send({ email: user.email, password: password });

      const {accessToken, refreshToken} = login.body.data;

      const response = await request(app)
        .get("/api/logout") 
        .set("Cookie", `accessToken=${accessToken}; refreshToken=${refreshToken}`) 
  
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty("data")
      expect(response.body.data).toHaveProperty("message")
      expect(response.body.data.message).toBe("User logged out")
      //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
    });
    test('logout: 400 error if the request does not have a refresh token in the cookies', async () => {
      const response = await request(app)
        .get("/api/logout") 
        .set("Cookie", `accessToken=${testerAccessTokenValid}`) 
  
      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty("error")
      expect(response.body.error).toBe("refresh token not in the cookies")
      //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
    });
    test('logout: 400 error if the refresh token in the request cookies does not represent a user in the database', async () => {
      const response = await request(app)
        .get("/api/logout") 
        .set("Cookie", `accessToken=${testerAccessTokenValid}; refreshToken=${testerAccessTokenValid}`) 
  
      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty("error")
      expect(response.body.error).toBe("user not found")
      //there is no "done" in this case to signal that the test has ended, as it ends automatically since it's not inside a "then" block
    });
});
