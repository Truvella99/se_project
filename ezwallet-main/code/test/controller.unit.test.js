import request from 'supertest';
import { app } from '../app';
import jwt from 'jsonwebtoken';
import { categories, transactions } from '../models/model';
import {createCategory, updateCategory, deleteCategory, getCategories, createTransaction,getAllTransactions, deleteTransactions, deleteTransaction, getTransactionsByGroupByCategory, getTransactionsByUser, getTransactionsByGroup, getTransactionsByUserByCategory } from '../controllers/controller';
import { Group, User } from '../models/User';
import mongoose from 'mongoose';
import * as controller from '../controllers/controller';
import { verifyAuth } from '../controllers/utils';
import { response } from 'express';

jest.mock('../models/model');
jest.mock('../models/User');


beforeEach(() => {
    jest.clearAllMocks()
});

const VerifyAuthmodule = require('../controllers/utils');
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
    test('Should return the created category', async () => {
        const mockReq = {
            body: {
                type: "house",
                color: "green"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
        }
        const res = { authorized: true, cause: "Authorized" };
        const response = {data: {type: mockReq.body.type , color: mockReq.body.color}, refreshedTokenMessage: mockRes.locals.refreshedTokenMessage};

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
        jest.spyOn(categories.prototype, "save").mockResolvedValue();

        await createCategory(mockReq, mockRes)

        expect(verifyAuth).toHaveBeenCalled()
        expect(categories.prototype.save).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(200)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Should return error if the request body does not contain all the necessary attributes', async () => {
        const mockReq = {
            body: {
                type: "house",
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        }
        const res = { authorized: true, cause: "Authorized" };
        const response = { error: "Some Parameter is Missing" };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

        await createCategory(mockReq, mockRes)

        expect(verifyAuth).toHaveBeenCalled()
        expect(categories.prototype.save).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Should return error if at least one of the parameters in the request body is an empty string', async () => {
        const mockReq = {
            body: {
                type: " ",
                color: "green"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        }
        const res = { authorized: true, cause: "Authorized" };
        const response = { error: "Some Parameter is an Empty String" };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

        await createCategory(mockReq, mockRes)

        expect(verifyAuth).toHaveBeenCalled()
        expect(categories.prototype.save).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Should return error if the type of category passed in the request body represents an already existing category in the database', async () => {
        const mockReq = {
            body: {
                type: "AlreadyExist",
                color: "cyan"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        }
        const res = { authorized: true, cause: "Authorized" };
        const response = { error: "Category already exist!" };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
        jest.spyOn(categories.prototype, "save").mockRejectedValue();

        await createCategory(mockReq, mockRes)

        expect(verifyAuth).toHaveBeenCalled()
        expect(categories.prototype.save).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Should return error if called by an authenticated user who is not an admin (authType = Admin)', async () => {
        const mockReq = {
            body: {
                type: "house",
                color: "green"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        }
        const res = { authorized: false, cause: "Admin: Mismatched role" };
        const response = { error: res.cause };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

        await createCategory(mockReq, mockRes)

        expect(verifyAuth).toHaveBeenCalled()
        expect(categories.prototype.save).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401)
        expect(mockRes.json).toHaveBeenCalledWith(response)
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
    test('Should update category successfully and return also the number of transactions whose type changed', async () => {
        const mockReq = {
            params: {type: "food"},
            body: {
                type: "grocery",
                color: "blue"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
        }
        const res = { authorized: true, cause: "Authorized" };
        const updated_transactions = {modifiedCount: 5}
        const response = { data: { message: "Category edited successfully", count: updated_transactions.modifiedCount }, refreshedTokenMessage: undefined };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
        jest.spyOn(categories, "findOne").mockImplementation(({ type: catType }) => {
            if(catType === mockReq.params.type){
                return { type: "food", color: "red" }
            }
            else if(catType === mockReq.body.type){
                return null
            }
        })
        jest.spyOn(categories, "findOneAndUpdate").mockImplementation(() => { mockReq.body})
        jest.spyOn(transactions, "updateMany").mockImplementation(() => updated_transactions )

        await updateCategory(mockReq, mockRes)

        expect(verifyAuth).toHaveBeenCalled()
        expect(categories.findOne).toHaveBeenCalled()
        expect(categories.findOneAndUpdate).toHaveBeenCalled()
        expect(transactions.updateMany).toHaveBeenCalled()
        expect(mockRes.status).toHaveBeenCalledWith(200)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Should return error if the request body does not contain all the necessary attributes', async () => {
        const mockReq = {
            params: {type: "food"},
            body: {
                type: "grocery",
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        }
        const res = { authorized: true, cause: "Authorized" };
        const response = { error: "Some Parameter is Missing" };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
        
        await updateCategory(mockReq, mockRes)

        expect(verifyAuth).toHaveBeenCalled()
        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Should return error if at least one of the parameters in the request body is an empty string', async () => {
        const mockReq = {
            params: {type: "food"},
            body: {
                type: " ",
                color: "blue"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        }
        const res = { authorized: true, cause: "Authorized" };
        const response = { error: "Some Parameter is an Empty String" };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
        
        await updateCategory(mockReq, mockRes)

        expect(verifyAuth).toHaveBeenCalled()
        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Should return error if the type of category passed as a route parameter does not represent a category in the database', async () => {
        const mockReq = {
            params: {type: "ghost"},
            body: {
                type: "grocery",
                color: "blue"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        }
        const res = { authorized: true, cause: "Authorized" };
        const response = { error: 'This category does not exist.' };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
        jest.spyOn(categories, "findOne").mockImplementation(() => { return null })
        
        await updateCategory(mockReq, mockRes)

        expect(verifyAuth).toHaveBeenCalled()
        expect(categories.findOne).toHaveBeenCalled()
        //expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Should return error if the type of category passed in the request body as the new type represents an already existing category in the database and that category is not the same as the requested one', async () => {
        const mockReq = {
            params: {type: "food"},
            body: {
                type: "grocery",
                color: "blue"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: jest.fn(),
        }
        const res = { authorized: true, cause: "Authorized" };
        const response = { error: 'New Category Type already exists.' };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
        jest.spyOn(categories, "findOne").mockImplementation(({ type: catType }) => {
            if(catType === mockReq.params.type){
                return { type: "food", color: "red" }
            }
            else if(catType === mockReq.body.type){
                return { type: "grocery", color: "red" }
            }
        })
        
        await updateCategory(mockReq, mockRes)

        expect(verifyAuth).toHaveBeenCalled()
        expect(categories.findOne).toHaveBeenCalled()
        expect(mockRes.status).toHaveBeenCalledWith(400)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });

    test('Should return error if called by an authenticated user who is not an admin (authType = Admin)', async () => {
        const mockReq = {
            params: {type: "food"},
            body: {
                type: "grocery",
                color: "blue"
            }
        }
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        }
        const res = { authorized: false, cause: "Admin: Mismatched role" };
        const response = { error: res.cause };

        jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
        
        await updateCategory(mockReq, mockRes)

        expect(verifyAuth).toHaveBeenCalled()
        expect(mockRes.status).toHaveBeenCalledWith(401)
        expect(mockRes.json).toHaveBeenCalledWith(response)
    });
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
  test('Should delete successfully the given categories N > T', async () => {
    const mockReq = {
      body: { types: ["health", "food"] }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }
    const res = { authorized: true, cause: "Authorized" };
    let countCat = 5
    const updated_transactions = {modifiedCount: 3}
    const response = { data: { message: "Categories deleted", count: 6 }, refreshedTokenMessage: undefined };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(categories, "findOne").mockImplementation(({ type: catType }) => {
      if(catType === mockReq.body.types[0]){
        return { type: "health", color: "green" }
      }
      else if(catType === mockReq.body.types[1]){
        return { type: "food", color: "red" }
      }
      else{
        return { type: "investment", color: "blue" }
      }
    })
    jest.spyOn(categories, "count").mockImplementation(() => {return --countCat} )
    jest.spyOn(categories, "deleteOne").mockImplementation(() => {})
    jest.spyOn(transactions, "updateMany").mockImplementation(() => updated_transactions )

    await deleteCategory(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalled()
    expect(categories.findOne).toHaveBeenCalled()
    expect(categories.count).toHaveBeenCalled()
    expect(categories.deleteOne).toHaveBeenCalled()
    expect(transactions.updateMany).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('Should delete successfully the given categories N == T', async () => {
    const mockReq = {
      body: { types: ["food", "investment"] }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: jest.fn()
    }
    const res = { authorized: true, cause: "Authorized" };
    let countCat = 4
    const updated_transactions = {modifiedCount: 3}
    const response = { data: { message: "Categories deleted", count: 3 }, refreshedTokenMessage: undefined };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(categories, "findOne").mockImplementation(({ type: catType }) => {
      if(catType === mockReq.body.types[0]){
        return { type: "food", color: "red" }
      }
      else if(catType === mockReq.body.types[1]){
        return { type: "investment", color: "blue" }
      }
      else{
        return { type: "investment", color: "blue" }
      }
    })
    jest.spyOn(categories, "count").mockImplementation(() => {return --countCat} )
    jest.spyOn(categories, "deleteOne").mockImplementation(() => {})
    jest.spyOn(transactions, "updateMany").mockImplementation(() => updated_transactions )

    await deleteCategory(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalled()
    expect(categories.findOne).toHaveBeenCalled()
    expect(categories.count).toHaveBeenCalled()
    expect(categories.deleteOne).toHaveBeenCalled()
    expect(transactions.updateMany).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('Should return error if the array passed in the request body is empty', async () => {
    const mockReq = {
      body: { types: [] }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Array is empty" };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await deleteCategory(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('Should return error if the request body does not contain all the necessary attributes', async () => {
    const mockReq = {
      body: {}
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Some Parameter is Missing" };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await deleteCategory(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('Should return error if called when there is only one category in the database', async () => {
    const mockReq = {
      body: { types: ["investment"] }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "You can't delete all categories! Now you have just one category saved" };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(categories, "findOne").mockImplementation( () => { 
        return {type: "investment", color: "green"}
      }
    )
    jest.spyOn(categories, "count").mockResolvedValue( 1 )

    await deleteCategory(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalled()
    expect(categories.findOne).toHaveBeenCalled()
    expect(categories.count).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('Should return error if at least one of the types in the array is an empty string', async () => {
    const mockReq = {
      body: { types: [""] }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "Some Parameter is an Empty String" };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await deleteCategory(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  });
  
  test('Should return error if at least one of the types in the array does not represent a category in the database', async () => {
    const mockReq = {
      body: { types: ["Kurama", "Health"] }
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    const res = { authorized: true, cause: "Authorized" };
    const response = { error: "One or more Categories do not exists" };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
    jest.spyOn(categories, "findOne").mockResolvedValueOnce( null )

    await deleteCategory(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalled()
    expect(categories.findOne).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('Should return error if called by an authenticated user who is not an admin (authType = Admin)', async () => {
    const mockReq = {
      body: {types: ["health"]}
    }
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    const res = { authorized: false, cause: "Admin: Mismatched role" };
    const response = { error: res.cause };

    jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)

    await deleteCategory(mockReq, mockRes)

    expect(verifyAuth).toHaveBeenCalled()
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith(response)
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
  test('Should return all the categories on database', async () => {
      const mockReq = {}
      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: jest.fn(),
      }

      const res = { authorized: true, cause: "Authorized" };
      const resCategories = [{type: "food", color: "red"}, {type: "health", color: "green"}];
      const response = {data: resCategories, refreshedTokenMessage: undefined};

      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
      jest.spyOn(categories, "find").mockImplementation(() => { return resCategories })
      
      await getCategories(mockReq, mockRes)

      expect(verifyAuth).toHaveBeenCalled()
      expect(categories.find).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('Should return error if called by a user who is not authenticated (authType = Simple)', async() => {
      const mockReq = {}
      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
      }

      const res = { authorized: false, cause: "Unauthorized" };
      const response = { error: res.cause };

      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => res)
      
      await getCategories(mockReq, mockRes)

      expect(verifyAuth).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith(response)
  });
})

/*Returns a 400 error if the request body does not contain all the necessary attributes
Returns a 400 error if at least one of the parameters in the request body is an empty string
Returns a 400 error if the type of category passed in the request body does not represent a category in the database
Returns a 400 error if the username passed in the request body is not equal to the one passed as a route parameter
Returns a 400 error if the username passed in the request body does not represent a user in the database
Returns a 400 error if the username passed as a route parameter does not represent a user in the database
Returns a 400 error if the amount passed in the request body cannot be parsed as a floating value (negative numbers are accepted)
Returns a 401 error if called by an authenticated user who is not the same user as the one in the route parameter (authType = User)*/
describe("createTransaction", () => {
  test('Should return a 200 response and save the transaction for authorized user with valid data', async () => {
    // Mock the verifyAuth function to return successful user authentication
    verifyAuth.mockReturnValue({ authorized: true, cause: "Authorized" });

    // Mock the categories.findOne function to return a category
    categories.findOne.mockResolvedValue({ type: 'expense' });

    // Mock the User.findOne function to return a user
    User.findOne.mockResolvedValue({ username: 'user1' });

    // Mock the transactions.save function to save the transaction and return a resolved promise
    transactions.prototype.save.mockResolvedValue();

    // Prepare mock request and response objects
    const req = {
      params: { username: 'user1' },
      body: { username: 'user1', amount: '50', type: 'expense' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
    };

    // Call the createTransaction function
    await createTransaction(req, res);

    // Assert the expected behavior

    // Verify that verifyAuth was called with the correct arguments
    expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: 'User', username: 'user1' });

    // Verify that categories.findOne was called with the correct type
    expect(categories.findOne).toHaveBeenCalledWith({ type: 'expense' });

    // Verify that User.findOne was called with the correct username
    expect(User.findOne).toHaveBeenCalledWith({ username: 'user1' });

    // Verify that transactions.save was called with the correct transaction data
    expect(transactions.prototype.save).toHaveBeenCalled();

    // Verify that the response status code and JSON payload are correct
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        username: 'user1',
        amount: 50,
        type: 'expense',
        date: expect.any(Date),// Validate the date format
      },
      refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls',
    });
  });

  test('should return a 400 error if the request body does not contain all the necessary attributes', async () => {
    // Mock the verifyAuth function to return successful user authentication
    verifyAuth.mockReturnValue({ authorized: true, cause: "Authorized" });

    // Prepare mock request and response objects
    const req = {
      params: { username: 'user1' },
      body: { username: 'user1', amount: '50' }, // Missing the 'type' attribute
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Call the createTransaction function
    await createTransaction(req, res);

    // Assert the expected behavior

    // Verify that verifyAuth was called with the correct arguments
    expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: 'User', username: 'user1' });

    // Verify that the response status code and JSON payload are correct
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Some Parameter is Missing' });
  });

  test('should return a 400 error if at least one of the parameters in the request body is an empty string', async () => {
    // Mock the verifyAuth function to return successful user authentication
    verifyAuth.mockReturnValue({ authorized: true, cause: "Authorized" });

    // Prepare mock request and response objects
    const req = {
      params: { username: 'user1' },
      body: { username: ' ', amount: '50', type: 'expense' }, // Empty 'username' parameter
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Call the createTransaction function
    await createTransaction(req, res);

    // Assert the expected behavior

    // Verify that verifyAuth was called with the correct arguments
    expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: 'User', username: 'user1' });

    // Verify that the response status code and JSON payload are correct
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Some Parameter is an Empty String' });
  });
  //Returns a 400 error if the username passed in the request body is not equal to the one passed as a route parameter
  test('should return a 400 error if the username passed in the request body is not equal to the one passed as a route parameter', async () => {
    const req = {
      params: {
        username: 'user1',
      },
      body: {
        username: 'different_user',
        amount: '50',
        type: 'expense',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await createTransaction(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Wrong Usernames' });
  });
  //Returns a 400 error if the username passed in the request body does not represent a user in the database
  test('should return a 400 error if the username passed in the request body does not represent a user in the database', async () => {
    jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => ({
      authorized: true,
      cause: 'Authorized',
    }));

    const req = {
      params: {
        username: 'non_existing_user',
      },
      body: {
        username: 'non_existing_user',
        amount: '50',
        type: 'expense',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    categories.findOne.mockResolvedValue({ type: 'expense' });

    jest.spyOn(User, 'findOne').mockResolvedValue(null);

    await createTransaction(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'User does not exist!' });

  });

  //Returns a 400 error if the amount passed in the request body cannot be parsed as a floating value (negative numbers are accepted)  
  test('should return a 400 error if the amount passed in the request body cannot be parsed as a floating value', async () => {

    const req = {
      body: {
        username: 'user1',
        amount: 'invalid',
        type: 'expense',
      },
      params: {
        username: 'user1',
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => ({
      authorized: true,
      cause: 'Authorized',
    }));
    User.findOne.mockResolvedValue({ username: 'user1' });
    categories.findOne.mockResolvedValue({ type: "expense" });

    await createTransaction(req, res);

    expect(User.findOne).toHaveBeenCalledWith({ username: 'user1' });
    expect(categories.findOne).toHaveBeenCalledWith({ type: 'expense' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Amount not valid' });
  });
  //Returns a 400 error if the username passed in the request body is not equal to the one passed as a route parameter
  test('should return a 400 error if the category passed in the request body does not exists', async () => {

    const req = {
      params: {
        username: 'user1',
      },
      body: {
        username: 'different_user',
        amount: '50',
        type: 'notExists',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => ({
      authorized: true,
      cause: 'Authorized',
    }));
    categories.findOne.mockResolvedValue(null);
    await createTransaction(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Category does not exist!" });
  });
  test('should return a 401 error if called by an authenticated user who is not the same user as the one in the route parameter', async () => {
    // Mock the verifyAuth function to return unsuccessful user authentication
    verifyAuth.mockReturnValue({ authorized: false, cause: 'Unauthorized' });

    // Prepare mock request and response objects
    const req = {
      params: { username: 'user1' },
      body: { username: 'user2', amount: '50', type: 'expense' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Call the createTransaction function
    await createTransaction(req, res);

    // Assert the expected behavior

    // Verify that verifyAuth was called with the correct arguments
    expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: 'User', username: 'user1' });

    // Verify that the response status code and JSON payload are correct
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });
});


describe("getAllTransactions", () => {
  test('should return transactions with category information for Admin (200)', async () => {
      verifyAuth.mockReturnValue({ authorized: true,cause: "Authorized" });

      // Mock the transactions.aggregate function to return mock data
      transactions.aggregate.mockResolvedValue([
        {
          username: 'user1',
          type: 'expense',
          amount: 50,
          date: '2023-05-30',
          categories_info: { color: 'red' },
        },
        {
          username: 'user2',
          type: 'income',
          amount: 100,
          date: '2023-05-29',
          categories_info: { color: 'green' },
        },
      ]);
  
      // Prepare mock request and response objects
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
  
      // Call the getAllTransactions function
      await getAllTransactions(req, res);
  
      // Assert the expected behavior
  
      // Verify that verifyAuth was called with the correct arguments
      expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: 'Admin' });
  
      // Verify that transactions.aggregate was called with the correct aggregation pipeline
      expect(transactions.aggregate).toHaveBeenCalledWith([
        {
          $lookup: {
            from: 'categories',
            localField: 'type',
            foreignField: 'type',
            as: 'categories_info',
          },
        },
        { $unwind: '$categories_info' },
      ]);
  
      // Verify that the response status code and JSON payload are correct
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: [
          {
            username: 'user1',
            type: 'expense',
            amount: 50,
            date: '2023-05-30',
            color: 'red',
          },
          {
            username: 'user2',
            type: 'income',
            amount: 100,
            date: '2023-05-29',
            color: 'green',
          },
        ],
        refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls',
      });
    });

  test('should return error for non-admin users (401)', async () => {
      // Mock the verifyAuth function to return unsuccessful authentication
      verifyAuth.mockReturnValue({ authorized: false, cause: "Admin: Mismatched role" });

      // Prepare mock request and response objects
      const req = {};
      const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
      };

      // Call the getAllTransactions function
      await getAllTransactions(req, res);

      // Assert the expected behavior

      // Verify that verifyAuth was called with the correct arguments
      expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: 'Admin' });

      // Verify that the response status code and JSON payload are correct
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Admin: Mismatched role" });
  });

  test('should return error for unexpected errors (500)', async () => {
      // Mock the verifyAuth function to throw an error
      verifyAuth.mockImplementation(() => {
          throw new Error('Authentication error');
      });

      // Prepare mock request and response objects
      const req = {};
      const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
      };

      // Call the getAllTransactions function
      await getAllTransactions(req, res);

      // Verify that verifyAuth was called with the correct arguments
      expect(verifyAuth).toHaveBeenCalledWith(req, res, { authType: 'Admin' });

      // Verify that the response status code and JSON payload are correct
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication error' });
  });
});


describe("getTransactionsByUser", () => {
  test('should return transactions with status code 200', async () => {
      // Mock the request and response objects
      const mockReq = {
        params: {
          username: 'user1',
        },
        url: '/api/users/user1/transactions',
        query: {}, 
      };
    
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
    
      // Mock the verifyAuth function
      const resAuth = { authorized: true, cause: "Authorized" };
      jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => resAuth);
    
      // Mock the User model's findOne method
      const user = { username: mockReq.params.username };
      jest.spyOn(User, 'findOne').mockResolvedValue(user);
    
      // Mock the transactions.aggregate method
      const Transactions = [
        {
          username: 'user1',
          type: 'Food',
          amount: 10,
          date: '2023-01-01',
          categories_info: {
              color: 'red'
          }
        },
        {
          username: 'user1',
          type: 'Food',
          amount: 20,
          date: '2023-01-02',
          categories_info: {
              color: 'red'
          }
        },
      ];

      const response = {
          data: Transactions.map((v) => ({
              username: v.username,
              type: v.type,
              amount: v.amount,
              date: v.date,
              color: v.categories_info.color,
          })),
          refreshedTokenMessage: mockRes.locals.refreshedTokenMessage,
      };

      jest.spyOn(transactions, 'aggregate').mockResolvedValue(Transactions);
    
      // Call the function
      await getTransactionsByUser(mockReq, mockRes);
    
      // Assertions
      expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, {
        authType: 'User',
        username: mockReq.params.username,
      });
      expect(User.findOne).toHaveBeenCalledWith({ username: mockReq.params.username });
      expect(transactions.aggregate).toHaveBeenCalledWith([
        {
          $lookup: {
            from: 'categories',
            localField: 'type',
            foreignField: 'type',
            as: 'categories_info',
          },
        },
        { $match: { $and: [{},{}] } }, 
        { $unwind: '$categories_info' },
      ]);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
  test('should return transactions with status code 200 as Admin (without filtering)', async () => {
      // Mock the request and response objects
      const mockReq = {
        params: {
          username: 'user1',
        },
        url: '/api/transactions/users/user1', 
        query: {}, 
      };
    
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
    
      // Mock the verifyAuth function
      const resAuth = { authorized: true, cause: "Authorized" };
      jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => resAuth);
    
      // Mock the User model's findOne method
      const user = { username: mockReq.params.username };
      jest.spyOn(User, 'findOne').mockResolvedValue(user);
    
      // Mock the transactions.aggregate method
      const Transactions = [
        {
          username: 'user1',
          type: 'Food',
          amount: 10,
          date: '2023-01-01',
          categories_info: {
              color: 'red'
          }
        },
        {
          username: 'user1',
          type: 'Food',
          amount: 20,
          date: '2023-01-02',
          categories_info: {
              color: 'red'
          }
        },
      ];

      const response = {
          data: Transactions.map((v) => ({
              username: v.username,
              type: v.type,
              amount: v.amount,
              date: v.date,
              color: v.categories_info.color,
          })),
          refreshedTokenMessage: mockRes.locals.refreshedTokenMessage,
      };

      jest.spyOn(transactions, 'aggregate').mockResolvedValue(Transactions);
    
      // Call the function
      await getTransactionsByUser(mockReq, mockRes);
    
      // Assertions
      expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, {authType: 'Admin'});
      expect(User.findOne).toHaveBeenCalledWith({ username: mockReq.params.username });
      expect(transactions.aggregate).toHaveBeenCalledWith([
        {
          $lookup: {
            from: 'categories',
            localField: 'type',
            foreignField: 'type',
            as: 'categories_info',
          },
        },
        { $match: { $and: [{},{}] } }, 
        { $unwind: '$categories_info' },
      ]);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
  test('username passed as a route parameter does not represent a user in the database, should return 400', async () => {
      // Mock the request and response objects
      const mockReq = {
        params: {
          username: 'user1',
        },
        url: '/api/users/user1/transactions',
        query: {},
      };
    
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
    
      // Mock the verifyAuth function
      const resAuth = { authorized: true, cause: "Authorized" };
      jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => resAuth);
    
      // Mock the User model's findOne method
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      const response = { error: "User not Found." };
    
      // Call the function
      await getTransactionsByUser(mockReq, mockRes);
    
      // Assertions
      expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, {
        authType: 'User',
        username: mockReq.params.username,
      });
      expect(User.findOne).toHaveBeenCalledWith({ username: mockReq.params.username });
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
  test('authenticated user who is not the same user as the one in the route (authType = User), should return 401', async () => {
      // Mock the request and response objects
      const mockReq = {
        params: {
          username: 'user1',
        },
        url: '/api/users/user1/transactions',
        query: {}, 
      };
    
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
    
      // Mock the verifyAuth function
      const resAuth = { authorized: false, cause: "User: Mismatched users" };
      jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => resAuth);
      const response = { error: "User: Mismatched users" };
    
      // Call the function
      await getTransactionsByUser(mockReq, mockRes);
    
      // Assertions
      expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, {
        authType: 'User',
        username: mockReq.params.username,
      });
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
  test('authenticated user who is not an admin (authType = Admin), should return 401', async () => {
      // Mock the request and response objects
      const mockReq = {
        params: {
          username: 'user1',
        },
        url: '/api/transactions/users/user1', 
        query: {}, 
      };
    
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
    
      // Mock the verifyAuth function
      const resAuth = { authorized: false, cause: "Admin: Mismatched role" };
      jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => resAuth);
      const response = { error: "Admin: Mismatched role" };
    
      // Call the function
      await getTransactionsByUser(mockReq, mockRes);
    
      // Assertions
      expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, {authType: 'Admin'});
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
})

describe("getTransactionsByUserByCategory", () => {
  test('should return transactions with status code 200', async () => {
      // Mock the request and response objects
      const mockReq = {
        params: {
          username: 'user1',
          category: 'Food',
        },
        url: '/api/users/user1/transactions/category/Food',
      };
  
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
  
      // Mock the verifyAuth function
      const resAuth = { authorized: true, cause: "Authorized" };
      const response = {
          data: [
              {
                  username: 'user1',
                  type: 'Food',
                  amount: 10,
                  date: '2023-01-01',
                  color: 'red',
              },
              {
                  username: 'user1',
                  type: 'Food',
                  amount: 20,
                  date: '2023-01-02',
                  color: 'red',
              },
          ],
          refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls',
      };
      jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => resAuth);
  
      // Mock the User model's findOne method
      const user = { username: mockReq.params.username };
      jest.spyOn(User, 'findOne').mockResolvedValue(user);
  
      // Mock the categories model's findOne method
      const category = { type: mockReq.params.category, color: 'red' };
      jest.spyOn(categories, 'findOne').mockResolvedValue(category);
  
      // Mock the transactions.aggregate method
      const Transactions = [
        {
          username: 'user1',
          type: 'Food',
          amount: 10,
          date: '2023-01-01',
          categories_info: {
              color: 'red'
          }
        },
        {
          username: 'user1',
          type: 'Food',
          amount: 20,
          date: '2023-01-02',
          categories_info: {
              color: 'red'
          }
        },
      ];
      jest.spyOn(transactions, 'aggregate').mockResolvedValue(Transactions);
  
      // Call the function
      await getTransactionsByUserByCategory(mockReq, mockRes);
  
      // Assertions
      expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, {
        authType: 'User',
        username: mockReq.params.username,
      });
      expect(User.findOne).toHaveBeenCalledWith({ username: mockReq.params.username });
      expect(categories.findOne).toHaveBeenCalledWith({ type: mockReq.params.category });
      expect(transactions.aggregate).toHaveBeenCalledWith([
        {
          $lookup: {
            from: 'categories',
            localField: 'type',
            foreignField: 'type',
            as: 'categories_info',
          },
        },
        { $unwind: '$categories_info' },
      ]);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
  test('username passed as a route parameter does not represent a user in the database, should return 400', async () => {
      // Mock the request and response objects
      const mockReq = {
        params: {
          username: 'user1',
          category: 'Food',
        },
        url: '/api/users/user1/transactions/category/Food',
      };
  
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
  
      // Mock the verifyAuth function
      const resAuth = { authorized: true, cause: "Authorized" };
      const response = { error: "User not Found." };
      jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => resAuth);
  
      // Mock the User model's findOne method
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
  
      // Call the function
      await getTransactionsByUserByCategory(mockReq, mockRes);
  
      // Assertions
      expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, {
        authType: 'User',
        username: mockReq.params.username,
      });
      expect(User.findOne).toHaveBeenCalledWith({ username: mockReq.params.username });
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
  test('category passed as a route parameter does not represent a category in the database, should return 400', async () => {
      // Mock the request and response objects
      const mockReq = {
        params: {
          username: 'user1',
          category: 'Food',
        },
        url: '/api/users/user1/transactions/category/Food',
      };
  
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
  
      // Mock the verifyAuth function
      const resAuth = { authorized: true, cause: "Authorized" };
      const response = { error: "Category not Found." };
      jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => resAuth);
  
      // Mock the User model's findOne method
      const user = { username: mockReq.params.username };
      jest.spyOn(User, 'findOne').mockResolvedValue(user);
  
      // Mock the categories model's findOne method
      jest.spyOn(categories, 'findOne').mockResolvedValue(null);
  
      // Call the function
      await getTransactionsByUserByCategory(mockReq, mockRes);
  
      // Assertions
      expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, {
        authType: 'User',
        username: mockReq.params.username,
      });
      expect(User.findOne).toHaveBeenCalledWith({ username: mockReq.params.username });
      expect(categories.findOne).toHaveBeenCalledWith({ type: mockReq.params.category });
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
  test('authenticated user who is not the same user as the one in the route (authType = User), should return 401', async () => {
      // Mock the request and response objects
      const mockReq = {
        params: {
          username: 'user1',
          category: 'Food',
        },
        url: '/api/users/user1/transactions/category/Food',
      };
  
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
  
      // Mock the verifyAuth function
      const resAuth = { authorized: false, cause: "User: Mismatched users" };
      const response = {error: "User: Mismatched users" };
      jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => resAuth);
  
      // Call the function
      await getTransactionsByUserByCategory(mockReq, mockRes);
  
      // Assertions
      expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, {
        authType: 'User',
        username: mockReq.params.username,
      });
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
  test('authenticated user who is not an admin (authType = Admin), should return 401', async () => {
      // Mock the request and response objects
      const mockReq = {
        params: {
          username: 'user1',
          category: 'Food',
        },
        url: '/api/transactions/users/user1/category/Food',
      };
  
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
  
      // Mock the verifyAuth function
      const resAuth = { authorized: false, cause: "Admin: Mismatched role" };
      const response = {error: "Admin: Mismatched role" };
      jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => resAuth);
  
      // Call the function
      await getTransactionsByUserByCategory(mockReq, mockRes);
  
      // Assertions
      expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, {authType: 'Admin'});
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
})

describe("getTransactionsByGroup", () => { 
  test('should return 200', async () => {
      // Mock the request and response objects
      const mockReq = {
        params: {
          name: 'Gruppo1',
        },
        url: '/api/groups/Gruppo1/transactions',
      };
  
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
  
      // Mock the Group model's findOne method
      const group = {
        name: 'Gruppo1',
        members: [
          { email: 'member1@example.com' },
          { email: 'member2@example.com' },
        ],
      };
      jest.spyOn(Group, 'findOne').mockResolvedValue(group);
  
      // Mock the verifyAuth function
      const resAuth = { authorized: true, cause: "Authorized" };
      const response = {
          data: [
              {
                  username: 'user1',
                  type: 'Food',
                  amount: 10,
                  date: '2023-01-01',
                  color: 'red',
              },
              {
                  username: 'user2',
                  type: 'Travel',
                  amount: 20,
                  date: '2023-01-02',
                  color: 'blue',
              },
          ],
          refreshedTokenMessage: mockRes.locals.refreshedTokenMessage,
      };
      jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => resAuth);
  
      // Mock the transactions.aggregate method
      const Transactions = [
        {
          user: { username: 'user1', email: 'user1@example.com' },
          group: { name: 'Gruppo1' },
          category: { type: 'Food', color: 'red' },
          amount: 10,
          date: '2023-01-01',
        },
        {
          user: { username: 'user2', email: 'user2@example.com' },
          group: { name: 'Gruppo1' },
          category: { type: 'Travel', color: 'blue' },
          amount: 20,
          date: '2023-01-02',
        },
      ];
      jest.spyOn(transactions, 'aggregate').mockResolvedValue(Transactions);
  
      // Call the function
      await getTransactionsByGroup(mockReq, mockRes);
  
      // Assertions
      expect(Group.findOne).toHaveBeenCalledWith({ name: mockReq.params.name });
      expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, {
        authType: 'Group',
        emails: ['member1@example.com', 'member2@example.com'],
      });
      expect(transactions.aggregate).toHaveBeenCalledWith([
          {
            $lookup: {
              from: 'users',
              localField: 'username',
              foreignField: 'username',
              as: 'user',
            },
          },
          {
            $unwind: '$user',
          },
          {
            $lookup: {
              from: 'groups',
              localField: 'user.email',
              foreignField: 'members.email',
              as: 'group',
            },
          },
          {
            $unwind: '$group',
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'type',
              foreignField: 'type',
              as: 'category',
            },
          },
          {
            $unwind: '$category',
          },
          {
            $match: {
              'group.name': 'Gruppo1',
            },
          },
          {
            $project: {
              'user.username': 1,
              'user.email': 1,
              'group.name': 1,
              'category.type': 1,
              'amount': 1,
              'date': 1,
              'category.color': 1,
            },
          },
        ]);          
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
  test('group not found in the database, should return 400', async () => {
      // Mock the request and response objects
      const mockReq = {
        params: {
          name: 'Gruppo1',
        },
        url: '/api/groups/Gruppo1/transactions',
      };
  
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
      
      const response = { error: "Group not Found." };
      jest.spyOn(Group, 'findOne').mockResolvedValue(null);
  
      // Call the function
      await getTransactionsByGroup(mockReq, mockRes);
  
      // Assertions
      expect(Group.findOne).toHaveBeenCalledWith({ name: mockReq.params.name });
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
  test('user not part of the group (authTupe=Group), should return 401', async () => {
      // Mock the request and response objects
      const mockReq = {
        params: {
          name: 'Gruppo1',
        },
        url: '/api/groups/Gruppo1/transactions',
      };
  
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
      
      const resAuth =  { authorized: false, cause: "Group: user not in group" };
      const response = { error: "Group: user not in group" };
      const group = {
          name: mockReq.params.name,
          members: [
            { email: 'member1@example.com' },
            { email: 'member2@example.com' },
          ],
        };
      jest.spyOn(Group, 'findOne').mockResolvedValue(group);
      jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => resAuth);

      // Call the function
      await getTransactionsByGroup(mockReq, mockRes);
  
      // Assertions
      expect(Group.findOne).toHaveBeenCalledWith({ name: mockReq.params.name });
      expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, {
          authType: 'Group',
          emails: ['member1@example.com', 'member2@example.com'],
        });
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
  test('user not an Admin (authTupe=Admin), should return 401', async () => {
      // Mock the request and response objects
      const mockReq = {
        params: {
          name: 'Gruppo1',
        },
        url: '/api/transactions/groups/Gruppo1',
      };
  
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
      
      const resAuth =  { authorized: false, cause: "Admin: Mismatched role" };
      const response = { error: "Admin: Mismatched role" };
      const group = {
          name: mockReq.params.name,
          members: [
            { email: 'member1@example.com' },
            { email: 'member2@example.com' },
          ],
        };
      jest.spyOn(Group, 'findOne').mockResolvedValue(group);
      jest.spyOn(VerifyAuthmodule, 'verifyAuth').mockImplementation(() => resAuth);

      // Call the function
      await getTransactionsByGroup(mockReq, mockRes);
  
      // Assertions
      expect(Group.findOne).toHaveBeenCalledWith({ name: mockReq.params.name });
      expect(verifyAuth).toHaveBeenCalledWith(mockReq, mockRes, {authType: 'Admin',});
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
})

describe("getTransactionsByGroupByCategory", () => { 
  test('getTransactionsByGroupByCategory, should return 200', async () => {
      const req = {
          params: {
              name: 'Gruppo1',
              category: 'Food',
          },
          url: '/api/groups/Gruppo1/transactions/category/Food',
      };

      const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };

      // Set up the mock implementation for Group.findOne
      Group.findOne.mockResolvedValue({
        name: req.params.name,
        members: [
          { email: 'member1@example.com' },
          { email: 'member2@example.com' },
        ],
      });
  
      // Set up the mock implementation for Category.findOne
      categories.findOne.mockResolvedValue({
        type: req.params.category,
      });
      
      // set up the verifyauth impllementation
      const resAuth = { authorized: true, cause: "Authorized" };
      const response = {
          data: [
              {
                  username: 'user1',
                  type: req.params.category,
                  amount: 10,
                  date: '2022-01-01',
                  color: 'blue',
              },
              {
                  username: 'user2',
                  type: req.params.category,
                  amount: 15,
                  date: '2022-01-02',
                  color: 'red',
              },
          ],
          refreshedTokenMessage: res.locals.refreshedTokenMessage,
      };
      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)

      // Set up the mock implementation for Transaction.aggregate
      transactions.aggregate.mockResolvedValue([
        {
          user: { username: 'user1', email: 'user1@example.com' },
          group: { name: req.params.name },
          category: { type: req.params.category, color: 'blue' },
          amount: 10,
          date: '2022-01-01',
        },
        {
          user: { username: 'user2', email: 'user2@example.com' },
          group: { name: req.params.name },
          category: { type: req.params.category, color: 'red' },
          amount: 15,
          date: '2022-01-02',
        },
      ]);
  
      await getTransactionsByGroupByCategory(req, res);
  
      expect(Group.findOne).toHaveBeenCalledWith({ name: req.params.name });
      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
      expect(categories.findOne).toHaveBeenCalledWith({ type: req.params.category });
      expect(transactions.aggregate).toHaveBeenCalledWith([
          {
            $lookup: {
              from: 'users',
              localField: 'username',
              foreignField: 'username',
              as: 'user',
            },
          },
          {
            $unwind: '$user',
          },
          {
            $lookup: {
              from: 'groups',
              localField: 'user.email',
              foreignField: 'members.email',
              as: 'group',
            },
          },
          {
            $unwind: '$group',
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'type',
              foreignField: 'type',
              as: 'category',
            },
          },
          {
            $unwind: '$category',
          },
          {
            $match: {
              'group.name': req.params.name,
              'category.type': req.params.category,
            },
          },
          {
            $project: {
              'user.username': 1,
              'user.email': 1,
              'group.name': 1,
              'category.type': 1,
              'amount': 1,
              'date': 1,
              'category.color': 1,
            },
          },
        ]);
        
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(response);
  });

  test('getTransactionsByGroupByCategory with group not found in the database, should return 400', async () => {
      const req = {
          params: {
              name: 'Gruppo1',
              category: 'Food',
          },
          url: '/api/groups/Gruppo1/transactions/category/Food',
      };

      const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
      
      const response = { error: "Group not Found." };
      jest.spyOn(Group, "findOne").mockImplementation(() => null)
  
      await getTransactionsByGroupByCategory(req, res);
  
      expect(Group.findOne).toHaveBeenCalledWith({ name: req.params.name });        
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(response);
  });

  test('getTransactionsByGroupByCategory with category not found in the database, should return 400', async () => {
      const mockReq = {
          params: {
              name: 'Gruppo1',
              category: 'Food',
          },
          url: '/api/groups/Gruppo1/transactions/category/Food',
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
      
      const group = {
          name: mockReq.params.name,
          members: [
              { email: 'member1@example.com' },
              { email: 'member2@example.com' },
          ],
      };

      const response = { error: "Category not Found." };
      const resAuth = { authorized: true, cause: "Authorized" };
      jest.spyOn(Group, "findOne").mockImplementation(() => group)
      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
      jest.spyOn(categories, "findOne").mockImplementation(() => null)

      await getTransactionsByGroupByCategory(mockReq, mockRes);
  
      expect(Group.findOne).toHaveBeenCalledWith({ name: mockReq.params.name });  
      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "Group", emails: ['member1@example.com','member2@example.com']});
      expect(categories.findOne).toHaveBeenCalledWith({ type: mockReq.params.category });        
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });

  test('getTransactionsByGroupByCategory with user not in the group, should return 401', async () => {
      const mockReq = {
          params: {
              name: 'Gruppo1',
              category: 'Food',
          },
          url: '/api/groups/Gruppo1/transactions/category/Food',
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
      
      const group = {
          name: mockReq.params.name,
          members: [
              { email: 'member1@example.com' },
              { email: 'member2@example.com' },
          ],
      };

      const resAuth = { authorized: false, cause: "Group: user not in group" };
      const response = { error: "Group: user not in group" };
      jest.spyOn(Group, "findOne").mockImplementation(() => group)
      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)

      await getTransactionsByGroupByCategory(mockReq, mockRes);
  
      expect(Group.findOne).toHaveBeenCalledWith({ name: mockReq.params.name });  
      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "Group", emails: ['member1@example.com','member2@example.com']});
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });

  test('getTransactionsByGroupByCategory with user not an admin, should return 401', async () => {
      const mockReq = {
          params: {
              name: 'Gruppo1',
              category: 'Food',
          },
          url: '/api/transactions/groups/Gruppo1/category/Food',
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
      };
      
      const group = {
          name: mockReq.params.name,
          members: [
              { email: 'member1@example.com' },
              { email: 'member2@example.com' },
          ],
      };

      const resAuth = { authorized: false, cause: "Admin: Mismatched role" };
      const response = { error: "Admin: Mismatched role" };
      jest.spyOn(Group, "findOne").mockImplementation(() => group)
      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)

      await getTransactionsByGroupByCategory(mockReq, mockRes);
  
      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "Admin"});
      expect(Group.findOne).toHaveBeenCalledWith({ name: mockReq.params.name });  
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(response);
  });
})

describe("deleteTransaction", () => {
  test('deleteTransaction, should delete the transaction with success', async () => {
      const mockReq = {
          params: { username: "Mario" },
          body: {
              _id: "6hjkohgfc8nvu786"
          }
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
          cookie: jest.fn().mockResolvedValue(null),
      }

      const Transaction = { _id: "6hjkohgfc8nvu786" };
      const user = { username: "Mario" };

      const resAuth = { authorized: true, cause: "Authorized" };
      // NON SO SE VA BENE
      const response = {data: {message: "Transaction deleted"}, refreshedTokenMessage: mockRes.locals.refreshedTokenMessage};
      //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
      jest.spyOn(User, "findOne").mockImplementation(() => user);
      jest.spyOn(transactions, "findOne").mockImplementation(() => Transaction);
      jest.spyOn(transactions, "deleteOne").mockImplementation(() => null);

      await deleteTransaction(mockReq, mockRes)

      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "User", username: mockReq.params.username});
      expect(User.findOne).toHaveBeenCalledWith({ username: user.username })
      expect(transactions.findOne).toHaveBeenCalledWith({ _id: Transaction._id, username: user.username })
      expect(transactions.deleteOne).toHaveBeenCalledWith({ _id: Transaction._id })
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('deleteTransaction with body that does not contain all the necessary attributes, should return 400', async () => {
      const mockReq = {
          params: { username: "Mario" },
          body: {
          }
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
          cookie: jest.fn().mockResolvedValue(null),
      }

      const response = { error: "Some Parameter is Missing" };
      const resAuth = { authorized: true, cause: "Authorized" };
      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)

      await deleteTransaction(mockReq, mockRes)

      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "User", username: mockReq.params.username});
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('deleteTransaction with id in the request body that is an empty string, should return 400', async () => {
      const mockReq = {
          params: { username: "Mario" },
          body: {
              _id: " "
          }
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
          cookie: jest.fn().mockResolvedValue(null),
      }

      const resAuth = { authorized: true, cause: "Authorized" };
      // NON SO SE VA BENE
      const response = { error: "Some Parameter is an Empty String" };
      //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)

      await deleteTransaction(mockReq, mockRes)

      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "User", username: mockReq.params.username});
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('deleteTransaction with username passed as a route parameter that does not represent a user in the database, should return 400', async () => {
      const mockReq = {
          params: { username: "Mario" },
          body: {
              _id: "6hjkohgfc8nvu786"
          }
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
          cookie: jest.fn().mockResolvedValue(null),
      }

      const user = { username: "Mario" };

      const response = { error: "User not Found." };
      const resAuth = { authorized: true, cause: "Authorized" };
      //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
      jest.spyOn(User, "findOne").mockImplementation(() => null);

      await deleteTransaction(mockReq, mockRes)
      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "User", username: mockReq.params.username});
      expect(User.findOne).toHaveBeenCalledWith({ username: user.username })
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('deleteTransaction with the _id in the request body that does not represent a transaction in the database, should return 400', async () => {
      const mockReq = {
          params: { username: "Mario" },
          body: {
              _id: "6hjkohgfc8nvu786"
          }
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
          cookie: jest.fn().mockResolvedValue(null),
      }

      const Transaction = { _id: "6hjkohgfc8nvu786" };
      const user = { username: "Mario" };

      const response = { error: "Transaction not Found." };
      const resAuth = { authorized: true, cause: "Authorized" };
      //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
      jest.spyOn(User, "findOne").mockImplementation(() => user);
      jest.spyOn(transactions, "findOne").mockImplementation(() => null);


      await deleteTransaction(mockReq, mockRes)
      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "User", username: mockReq.params.username});
      expect(User.findOne).toHaveBeenCalledWith({ username: user.username })
      expect(transactions.findOne).toHaveBeenCalledWith({ _id: Transaction._id, username: user.username })
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('deleteTransaction with the _id in the request body that represents a transaction made by a different user than the one in the route, should return 400', async () => {
      const mockReq = {
          params: { username: "Mario" },
          body: {
              _id: "6hjkohgfc8nvu786"
          }
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
          cookie: jest.fn().mockResolvedValue(null),
      }

      const Transaction = { _id: "6hjkohgfc8nvu786" };
      const user = { username: "Mario" };

      const response = { error: "Transaction not Found." };
      const resAuth = { authorized: true, cause: "Authorized" };
      //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
      jest.spyOn(User, "findOne").mockImplementation(() => user);
      jest.spyOn(transactions, "findOne").mockImplementation(() => null);


      await deleteTransaction(mockReq, mockRes)
      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "User", username: mockReq.params.username});
      expect(User.findOne).toHaveBeenCalledWith({ username: user.username })
      expect(transactions.findOne).toHaveBeenCalledWith({ _id: Transaction._id, username: user.username })
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('deleteTransaction called by an authenticated user who is not the same user as the one in the route (authType = User), should return 401', async () => {
      const mockReq = {
          params: { username: "Mario" },
          body: {
              _id: "6hjkohgfc8nvu786"
          }
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
          cookie: jest.fn().mockResolvedValue(null),
      }

      const resAuth =  { authorized: false, cause: "User: Mismatched users" };
      const response = { error: "User: Mismatched users"};

      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)

      await deleteTransaction(mockReq, mockRes)
      
      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "User", username: mockReq.params.username});
      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith(response)
  });
})

describe("deleteTransactions", () => {
  test('deleteTransactions, should delete all transactions with success', async () => {
      const mockReq = {
          body: {
              _ids: ["6hjkohgfc8nvu786", "6hjkohgfc8nvu788"]
          }
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
          cookie: jest.fn().mockResolvedValue(null),
      }

      const Transactions = [
          { _id: "6hjkohgfc8nvu786" },
          { _id: "6hjkohgfc8nvu788" }
      ];

      const resAuth = { authorized: true, cause: "Authorized" };
      // NON SO SE VA BENE
      const response = {data: {message: "Transactions deleted"}, refreshedTokenMessage: mockRes.locals.refreshedTokenMessage };
      //any time the `User.findOne()` method is called jest will replace its actual implementation with the one defined below
      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
      Transactions.forEach((transaction) => {
          jest.spyOn(transactions, "findOne").mockImplementation(() => transaction);
      });
      Transactions.forEach((transaction) => {
          jest.spyOn(transactions, "deleteOne").mockImplementation(() => null);
      });

      await deleteTransactions(mockReq, mockRes)

      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "Admin"});
      Transactions.forEach((transaction) => {
          expect(transactions.findOne).toHaveBeenCalledWith({ _id: transaction._id })
      });
      Transactions.forEach((transaction) => {
          expect(transactions.deleteOne).toHaveBeenCalledWith({ _id: transaction._id })
      });
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('deleteTransactions with body without all necessary attributes, should return 400', async () => {
      const mockReq = {
          body: {
          }
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
          cookie: jest.fn().mockResolvedValue(null),
      }

      const resAuth = { authorized: true, cause: "Authorized" };
      const response = { error: "Some Parameter is Missing" };

      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)

      await deleteTransactions(mockReq, mockRes)

      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "Admin"});
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('deleteTransactions with at least one of the ids in the array is an empty string, should return 400', async () => {
      process.env.ACCESS_KEY = 'EZWALLET';
      const mockReq = {
          body: {
              _ids: [" ", "6hjkohgfc8nvu788"]
          }
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
          cookie: jest.fn().mockResolvedValue(null),
      }

      const resAuth = { authorized: true, cause: "Authorized" };
      const response = { error: "Some Parameter is an Empty String" };

      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)

      await deleteTransactions(mockReq, mockRes)

      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "Admin"});
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('deleteTransactions with at least one of the ids in the array does not represent a transaction in the database, should return 400', async () => {
      const mockReq = {
          body: {
              _ids: ["6hjkohgfc8nvu786", "6hjkohgfc8nvu788"]
          }
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
          cookie: jest.fn().mockResolvedValue(null),
      }

      const resAuth = { authorized: true, cause: "Authorized" };
      const response = { error: "Transaction not found." };
     
      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)
      jest.spyOn(transactions, "findOne").mockImplementation(() => null);

      await deleteTransactions(mockReq, mockRes)

      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "Admin"});
      expect(transactions.findOne).toHaveBeenCalledWith({ _id: mockReq.body._ids[0] })
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(response)
  });

  test('deleteTransactions not called by an Admin, should return 401', async () => {
      const mockReq = {
          body: {
              _ids: ["6hjkohgfc8nvu786", "6hjkohgfc8nvu788"]
          }
      };

      const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          locals: { refreshedTokenMessage: 'Access token has been refreshed. Remember to copy the new one in the headers of subsequent calls' },
          cookie: jest.fn().mockResolvedValue(null),
      }

      const resAuth = { authorized: false, cause: "Admin: Mismatched role" };
      const response = { error: "Admin: Mismatched role" };
     
      jest.spyOn(VerifyAuthmodule, "verifyAuth").mockImplementation(() => resAuth)

      await deleteTransactions(mockReq, mockRes)

      expect(verifyAuth).toHaveBeenCalledWith(mockReq,mockRes,{authType: "Admin"});
      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith(response)
  });
})