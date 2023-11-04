import { categories, transactions } from "../models/model.js";
import { Group, User } from "../models/User.js";
import { handleDateFilterParams, handleAmountFilterParams, verifyAuth } from "./utils.js";

/** ADMIN ONLY
 * Create a new category 
  - Request Body Content: An object having attributes `type` and `color`
  - Response `data` Content: An object having attributes `type` and `color`
 */
export const createCategory = async (req, res) => {
    try {
        const adminAuth = verifyAuth(req, res, { authType: "Admin" })
        if (adminAuth.authorized) {
            //Admin auth successful
            const { type, color } = req.body;
            if (!type || !color) {
                return res.status(400).json({ error: "Some Parameter is Missing" });
            }
            if (type.trim().length === 0 || color.trim().length === 0) {
                return res.status(400).json({ error: "Some Parameter is an Empty String" });
            }
            const new_categories = new categories({ type, color });
            await new_categories.save()
                .then(() => { res.status(200).json({ data: { type: type, color: color }, refreshedTokenMessage: res.locals.refreshedTokenMessage }) })
                .catch(() => { res.status(400).json({ error: "Category already exist!" }) }) //No need to crash the server
        } else {
            res.status(401).json({ error: adminAuth.cause })
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

/** ADMIN ONLY
 * Edit a category's type or color
  - Request Body Content: An object having attributes `type` and `color` equal to the new values to assign to the category
  - Response `data` Content: An object with parameter `message` that confirms successful editing and a parameter `count` that is equal to the count of transactions whose category was changed with the new type
  - Optional behavior:
    - error 400 returned if the specified category does not exist
    - error 400 is returned if new parameters have invalid values
 */
export const updateCategory = async (req, res) => {
    try {
        const adminAuth = verifyAuth(req, res, { authType: "Admin" })
        if (adminAuth.authorized) {
            //Admin auth successful
            // if type or color are undefined or only spaces, consider them as invalid values
            const { type, color } = req.body;
            if (!type || !color) {
                return res.status(400).json({ error: "Some Parameter is Missing" });
            }
            if (type.trim().length === 0 || color.trim().length === 0) {
                return res.status(400).json({ error: "Some Parameter is an Empty String" });
            }
            const url_type = await categories.findOne({ type: req.params.type });
            if (url_type === null) {
                return res.status(400).json({ error: 'This category does not exist.' });
            }
            const new_exists = await categories.findOne({ type: type });
            // se url moto e {"type":"moto", "color":"red"} quindi cambio solo colore devo poterlo fare
            if (new_exists !== null && new_exists.type !== req.params.type) {
                return res.status(400).json({ error: 'New Category Type already exists.' });
            }
            const data = await categories.findOneAndUpdate({ type: req.params.type }, { $set: { type: type, color: color } });
            /*if (data === null) {
                res.status(400).json({ message: 'This category does not exist.' });
            } else {*/
            // change all related transactions
            const updated_transactions = await transactions.updateMany({ type: req.params.type }, { type: type });
            res.status(200).json({ data: { message: "Category edited successfully", count: updated_transactions.modifiedCount }, refreshedTokenMessage: res.locals.refreshedTokenMessage })
            //}
        } else {
            res.status(401).json({ error: adminAuth.cause })
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

/** ADMIN ONLY
 * Delete a category 
  - Request Body Content: An array of strings that lists the `types` of the categories to be deleted
  - Response `data` Content: An object with parameter `message` that confirms successful deletion and a parameter `count` that is equal to the count of affected transactions (deleting a category sets all transactions with that category to have `investment` as their new category)
  - Optional behavior:
    - error 400 is returned if the specified category does not exist
 */
export const deleteCategory = async (req, res) => {
    try {
        const adminAuth = verifyAuth(req, res, { authType: "Admin" })
        if (adminAuth.authorized) {
            //Admin auth successful
            if (!req.body.types) {
                return res.status(400).json({ error: "Some Parameter is Missing" });
            }
            if(req.body.types.length === 0){
                return res.status(400).json({ error: "Array is empty" });
            }
            for (let type of req.body.types) {
                //find category 
                if (type.trim().length === 0) {
                    return res.status(400).json({ error: "Some Parameter is an Empty String" });
                }
                const el_finded = await categories.findOne({ type: type });
                if (el_finded === null) {
                    return res.status(400).json({ error: "One or more Categories do not exists" });
                }
            }
            // MOTO, AUTO, VESPA       MOTO  => AUTO,VESPA   3>1  [ && type !== firstCat.type]
            // MOTO,AUTO,VESPA  MOTO,AUTO, => VESPA
            // MOTO,AUTO,VESPA  MOTO,AUTO,VESPA => MOTO
            //MOTO,AUTO,VESPA  MOTO,AUTO,VESPA,gigi => MOTO 
            let numbCat = await categories.count();
            let count = 0;
            for (let type of req.body.types) {

                let numbCateg = await categories.count();
                if (numbCateg === 1 && numbCat === 1) {
                    return res.status(400).json({ error: "You can't delete all categories! Now you have just one category saved" })
                }
                let firstCat = await categories.findOne({}, null, { sort: { _id: 1 } })//assigning of default

                if (numbCateg > req.body.types.length) {
                    firstCat = await categories.findOne({ type: { $nin: req.body.types } }, null, { sort: { _id: 1 } });
                    await categories.deleteOne({ type: type });
                    const updated_transactions = await transactions.updateMany({ type: type }, { type: firstCat.type });
                    count += updated_transactions.modifiedCount;
                } else if (numbCateg <= req.body.types.length && type !== firstCat.type) {

                    // case: MOTO,AUTO,VESPA   MOTO,AUTO,VESPA => rimane MOTO
                    await categories.deleteOne({ type: type });
                    const updated_transactions = await transactions.updateMany({ type: type }, { type: firstCat.type });
                    count += updated_transactions.modifiedCount;
                }
            }
            res.status(200).json({ data: { message: "Categories deleted", count: count }, refreshedTokenMessage: res.locals.refreshedTokenMessage })

            //transazioni solo dell'utente loggato
            //res.status(200).json({ message: 'Categories Deleted With Success', count: updated_transactions.nModified });
        } else {
            res.status(401).json({ error: adminAuth.cause })
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

/** ADMIN/USER
 * Return all the categories 
  - Request Body Content: None
  - Response `data` Content: An array of objects, each one having attributes `type` and `color`
  - Optional behavior:
    - empty array is returned if there are no categories
 */
export const getCategories = async (req, res) => {
    try {
        const simpleAuth = verifyAuth(req, res, { authType: "Simple" });
        if (simpleAuth.authorized) {
            //User or Admin auth successful
            let data = await categories.find({})
            let filter = data.map(v => Object.assign({}, { type: v.type, color: v.color }))
            return res.status(200).json({ data: filter, refreshedTokenMessage: res.locals.refreshedTokenMessage })
        } else {
            res.status(401).json({ error: simpleAuth.cause })
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}


/** ADMIN/USER
 * Create a new transaction made by a specific user 
  - Request Body Content: An object having attributes `username`, `type` and `amount`
  - Response `data` Content: An object having attributes `username`, `type`, `amount` and `date`
  - Optional behavior:
    - error 400 is returned if the username or the type of category does not exist
 */
export const createTransaction = async (req, res) => {
    try {
        const userAuth = verifyAuth(req, res, { authType: "User", username: req.params.username })
        if (userAuth.authorized) {
            //User or Admin auth successful
            let { username, amount, type } = req.body;
            if (!username || !amount || !type) {
                return res.status(400).json({ error: "Some Parameter is Missing" });
            }
            if (username.trim().length === 0 || amount.toString().trim().length === 0 || type.trim().length === 0) {
                return res.status(400).json({ error: "Some Parameter is an Empty String" });
            }
            //check category type
            const category = await categories.findOne({ type: type })
            if (!category) {
                return res.status(400).json({ error: "Category does not exist!" })
            }
            // check mismatched usernames
            if (req.params.username !== username) {
                return res.status(400).json({ error: "Wrong Usernames" });
            }
            const user = await User.findOne({ username: username });
            if (user === null) {
                return res.status(400).json({ error: "User does not exist!" })
            }
            
            
            if(isNaN(parseFloat(amount)))
                return res.status(400).json({ error: "Amount not valid" })
            else
                amount = parseFloat(amount)
            // create transaction
            const date = new Date();
            const new_transaction = new transactions({ username, amount, type, date: date });//date is also taken as default in the costructor but we insert it anyway
            new_transaction.save()
                .then(() => res.status(200).json({data: {username: username, amount: amount, type: type, date: date}, refreshedTokenMessage: res.locals.refreshedTokenMessage}))
        } else {
            res.status(401).json({ error: userAuth.cause })
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

/** ADMIN ONLY
 * Return all transactions made by all users 
  - Request Body Content: None
  - Response `data` Content: An array of objects, each one having attributes `username`, `type`, `amount`, `date` and `color`
  - Optional behavior:
    - empty array must be returned if there are no transactions
 */
export const getAllTransactions = async (req, res) => {
    try {
        const adminAuth = verifyAuth(req, res, { authType: "Admin" })
        if (adminAuth.authorized) {
            //Admin auth successful
            transactions.aggregate([
                {
                    $lookup: {
                        from: "categories",
                        localField: "type",
                        foreignField: "type",
                        as: "categories_info"
                    }
                },
                { $unwind: "$categories_info" }
            ]).then((result) => {
                let data = result.map(v => Object.assign({}, { username: v.username, type: v.type, amount: v.amount, date: v.date, color: v.categories_info.color }))
                res.status(200).json({data: data, refreshedTokenMessage: res.locals.refreshedTokenMessage});
            })
        } else {
            return res.status(401).json({ error: adminAuth.cause })
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

/** ADMIN(all transaction of a given user)/USER(only his transactions)
 * Return all transactions made by a specific user 
  - Request Body Content: None
  - Response `data` Content: An array of objects, each one having attributes `username`, `type`, `amount`, `date` and `color`
  - Optional behavior:
    - error 400 is returned if the user does not exist
    - empty array is returned if there are no transactions made by the user
    - if there are query parameters and the function has been called by a Regular user then the returned transactions must be filtered according to the query parameters
 */
export const getTransactionsByUser = async (req, res) => {
    try {
        //Distinction between route accessed by Admins or Regular users for functions that can be called by both
        //and different behaviors and access rights
        let auth;
        let is_admin;
        const username = req.params.username;
        if (req.url.indexOf("/transactions/users/") >= 0) {
            auth = verifyAuth(req, res, { authType: "Admin" });
            is_admin = true;
        } else {
            auth = verifyAuth(req, res, { authType: "User", username: username });
            is_admin = false;
        }
        if (auth.authorized) {
            //User or Admin auth successful
            const url_user = await User.findOne({ username: username });
            if (url_user === null) {
                return res.status(400).json({ error: "User not Found." });
            }
            let filterByDate;
            let filterByAmount;
            if (is_admin) {
                //admin (not filtering, so all true to match in the query)
                filterByDate = {};
                filterByAmount = {};
            } else {
                //users (filtering, so apply all the filters)
                filterByDate = handleDateFilterParams(req);
                filterByAmount = handleAmountFilterParams(req);
            }
            //find all transactions then 
            let allTransactions = [];
            transactions.aggregate([
                {
                    $lookup: {
                        from: "categories",
                        localField: "type",
                        foreignField: "type",
                        as: "categories_info"
                    }
                },
                { $match: { $and: [filterByDate, filterByAmount] } },
                { $unwind: "$categories_info" }
            ]).then((result) => {
                allTransactions = result.map(v => Object.assign({}, { username: v.username, type: v.type, amount: v.amount, date: v.date, color: v.categories_info.color }))
                    .filter(tr => tr.username === username);
                //Distinction between route accessed by Admins or Regular users for functions that can be called by both
                //and different behaviors and access rights
                res.status(200).json({ data: allTransactions, refreshedTokenMessage: res.locals.refreshedTokenMessage })
            });
        } else {
            return res.status(401).json({ error: auth.cause })
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

/** ADMIN(all transaction of a given user)/USER(only his transactions)
 * Return all transactions made by a specific user filtered by a specific category 
  - Request Body Content: None
  - Response `data` Content: An array of objects, each one having attributes `username`, `type`, `amount`, `date` and `color`, filtered so that `type` is the same for all objects
  - Optional behavior:
    - empty array is returned if there are no transactions made by the user with the specified category
    - error 400 is returned if the user or the category does not exist
 */
export const getTransactionsByUserByCategory = async (req, res) => {
    try {
        let auth;
        const { username, category } = req.params;
        if (req.url.indexOf("/transactions/users/") >= 0) {
            auth = verifyAuth(req, res, { authType: "Admin" });
        } else {
            auth = verifyAuth(req, res, { authType: "User", username: username });
        }
        if (auth.authorized) {
            //User or Admin auth successful
            const url_user = await User.findOne({ username: username });
            if (url_user === null) {
                return res.status(400).json({ error: "User not Found." });
            }
            const url_category = await categories.findOne({ type: category });
            if (url_category === null) {
                return res.status(400).json({ error: "Category not Found." });
            }
            let allTransactions = [];
            transactions.aggregate([
                {
                    $lookup: {
                        from: "categories",
                        localField: "type",
                        foreignField: "type",
                        as: "categories_info"
                    }
                },
                { $unwind: "$categories_info" }
            ]).then((result) => {
                allTransactions = result.map(v => Object.assign({}, { username: v.username, type: v.type, amount: v.amount, date: v.date, color: v.categories_info.color }))
                    .filter(tr => (tr.username === req.params.username && tr.type === req.params.category))
                // return the transactions
                res.status(200).json({ data: allTransactions, refreshedTokenMessage: res.locals.refreshedTokenMessage })
            });
        } else {
            return res.status(401).json({ error: auth.cause })
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

/** ADMIN(all transaction of a given group)/USER(only his group)
 * Return all transactions made by members of a specific group
  - Request Body Content: None
  - Response `data` Content: An array of objects, each one having attributes `username`, `type`, `amount`, `date` and `color`
  - Optional behavior:
    - error 400 is returned if the group does not exist
    - empty array must be returned if there are no transactions made by the group
 */
export const getTransactionsByGroup = async (req, res) => {
    try {
        let auth;
        const group_name = req.params.name;
        const url_group = await Group.findOne({ name: group_name });
        if (url_group === null) {
            return res.status(400).json({ error: "Group not Found." });
        }
        const emails = url_group.members.map((member) => member.email);
        if (req.url.indexOf("/transactions/groups/") >= 0) {
            auth = verifyAuth(req, res, { authType: "Admin" });
        } else {
            auth = verifyAuth(req, res, { authType: "Group", emails: emails });
        }
        if (auth.authorized) {
            let allTransactions = [];
            transactions.aggregate([
                {
                    $lookup: {
                        from: 'users',
                        localField: 'username',
                        foreignField: 'username',
                        as: 'user'
                    }
                },
                {
                    $unwind: '$user'
                },
                {
                    $lookup: {
                        from: 'groups',
                        localField: 'user.email',
                        foreignField: 'members.email',
                        as: 'group'
                    }
                },
                {
                    $unwind: '$group'
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'type',
                        foreignField: 'type',
                        as: 'category'
                    }
                },
                {
                    $unwind: '$category'
                },
                {
                    $match: {
                        'group.name': req.params.name
                    }
                },
                {
                    $project: {
                        'user.username': 1,
                        'user.email': 1,
                        'group.name': 1,
                        'category.type': 1,
                        'amount': 1,
                        'date': 1,
                        'category.color': 1
                    }
                }
            ]).then((result) => {
                allTransactions = result.map(v => Object.assign({}, { username: v.user.username, type: v.category.type, amount: v.amount, date: v.date, color: v.category.color }))
                // return the transactions
                res.status(200).json({ data: allTransactions, refreshedTokenMessage: res.locals.refreshedTokenMessage });
            });
        } else {
            return res.status(401).json({ error: auth.cause })
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

/** ADMIN(all transaction of a given group)/USER(only his group)
 * Return all transactions made by members of a specific group filtered by a specific category
  - Request Body Content: None
  - Response `data` Content: An array of objects, each one having attributes `username`, `type`, `amount`, `date` and `color`, filtered so that `type` is the same for all objects.
  - Optional behavior:
    - error 400 is returned if the group or the category does not exist
    - empty array must be returned if there are no transactions made by the group with the specified category
 */
export const getTransactionsByGroupByCategory = async (req, res) => {
    try {
        let auth;
        const { name, category } = req.params;
        const url_group = await Group.findOne({ name: name });
        if (url_group === null) {
            return res.status(400).json({ error: "Group not Found." });
        }
        const emails = url_group.members.map((member) => member.email);
        if (req.url.indexOf("/transactions/groups/") >= 0) {
            auth = verifyAuth(req, res, { authType: "Admin" });
        } else {
            auth = verifyAuth(req, res, { authType: "Group", emails: emails });
        }
        if (auth.authorized) {
            const url_category = await categories.findOne({ type: category });
            if (url_category === null) {
                return res.status(400).json({ error: "Category not Found." });
            }
            let allTransactions = [];
            transactions.aggregate([
                {
                    $lookup: {
                        from: 'users',
                        localField: 'username',
                        foreignField: 'username',
                        as: 'user'
                    }
                },
                {
                    $unwind: '$user'
                },
                {
                    $lookup: {
                        from: 'groups',
                        localField: 'user.email',
                        foreignField: 'members.email',
                        as: 'group'
                    }
                },
                {
                    $unwind: '$group'
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'type',
                        foreignField: 'type',
                        as: 'category'
                    }
                },
                {
                    $unwind: '$category'
                },
                {
                    $match: {
                        'group.name': req.params.name,
                        'category.type': req.params.category
                    }
                },
                {
                    $project: {
                        'user.username': 1,
                        'user.email': 1,
                        'group.name': 1,
                        'category.type': 1,
                        'amount': 1,
                        'date': 1,
                        'category.color': 1
                    }
                }
            ]).then((result) => {
                allTransactions = result.map(v => Object.assign({}, { username: v.user.username, type: v.category.type, amount: v.amount, date: v.date, color: v.category.color }))
                // return the transactions
                res.status(200).json({ data: allTransactions, refreshedTokenMessage: res.locals.refreshedTokenMessage });
            });
        } else {
            return res.status(401).json({ error: auth.cause })
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

/** ADMIN/USER
 * Delete a transaction made by a specific user
  - Request Body Content: The `_id` of the transaction to be deleted
  - Response `data` Content: A string indicating successful deletion of the transaction
  - Optional behavior:
    - error 400 is returned if the user or the transaction does not exist
 */
export const deleteTransaction = async (req, res) => {
    try {
        let username = req.params.username;
        const userAuth = verifyAuth(req, res, { authType: "User", username: username });
        if (userAuth.authorized) {
            //User/Admin auth successful
            let id = req.body._id;
            if (!id) {
                return res.status(400).json({ error: "Some Parameter is Missing" });
            }
            if (id.trim().length === 0) {
                return res.status(400).json({ error: "Some Parameter is an Empty String" });
            }
            const url_user = await User.findOne({ username: username });
            if (url_user === null) {
                return res.status(400).json({ error: "User not Found." });
            }
            // pass in the query also the username to check that the id corresponds to the actual user who called
            // this to avoid that one user delete transaction of others
            const transaction = await transactions.findOne({ _id: req.body._id, username: username });
            if (transaction === null) {
                return res.status(400).json({ error: "Transaction not Found." });
            }
            let data = await transactions.deleteOne({ _id: req.body._id });
            res.status(200).json({ data: { message: "Transaction deleted" }, refreshedTokenMessage: res.locals.refreshedTokenMessage })
        } else {
            res.status(401).json({ error: userAuth.cause })
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

/** ADMIN
 * Delete multiple transactions identified by their ids
  - Request Body Content: An array of strings that lists the `_ids` of the transactions to be deleted
  - Response `data` Content: A message confirming successful deletion
  - Optional behavior:
    - error 400 is returned if at least one of the `_ids` does not have a corresponding transaction. Transactions that have an id are not deleted in this case
 */
export const deleteTransactions = async (req, res) => {
    try {
        const adminAuth = verifyAuth(req, res, { authType: "Admin" })
        if (adminAuth.authorized) {
            //Admin auth successful
            let ids = req.body._ids;
            if (!ids) {
                return res.status(400).json({ error: "Some Parameter is Missing" });
            }
            for (let id of ids) {
                if (id.trim().length === 0) {
                    return res.status(400).json({ error: "Some Parameter is an Empty String" });
                }
                const el_finded = await transactions.findOne({ _id: id });
                if (el_finded === null) {
                    return res.status(400).json({ error: "Transaction not found." });
                }
            }
            for (let id of ids) {
                await transactions.deleteOne({ _id: id });
            }
            res.status(200).json({ data: { message: "Transactions deleted" }, refreshedTokenMessage: res.locals.refreshedTokenMessage });
        } else {
            res.status(401).json({ error: adminAuth.cause })
        }
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}
