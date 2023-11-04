import { Group, User } from "../models/User.js";
import { transactions } from "../models/model.js";
import { verifyAuth } from "./utils.js";

/**
 * ADMIN
 * Return all the users
  - Request Body Content: None
  - Response `data` Content: An array of objects, each one having attributes `username`, `email` and `role`
  - Optional behavior:
    - empty array is returned if there are no users
 */
export const getUsers = async (req, res) => {
  try {
    const adminAuth = verifyAuth(req, res, { authType: "Admin" })
    if (adminAuth.authorized) {
      //Admin auth successful

      const users = await User.find();
      let usersFields = users.map(v => Object.assign({}, { username: v.username, email: v.email, role: v.role }))

      res.status(200).json({ data: usersFields, refreshedTokenMessage: res.locals.refreshedTokenMessage })
    }
    else {
      res.status(401).json({ error: adminAuth.cause })
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * USER his info /ADMIN info of a generic user
 * Return information of a specific user
  - Request Body Content: None
  - Response `data` Content: An object having attributes `username`, `email` and `role`.
  - Optional behavior:
    - error 400 is returned if the user is not found in the system
 */
export const getUser = async (req, res) => {
  try {
    const userAuth = verifyAuth(req, res, { authType: "User", username: req.params.username })
    const adminAuth = verifyAuth(req, res, { authType: "Admin" })

    if (userAuth.authorized || adminAuth.authorized) {
      const user = await User.findOne({ username: req.params.username })
      if (!user)
        return res.status(400).json({ error: "User not found" })
      //User|Admin auth successful
      res.status(200).json({ data: { username: user.username, email: user.email, role: user.role }, refreshedTokenMessage: res.locals.refreshedTokenMessage })
    }
    else {
      res.status(401).json({ error: userAuth.cause })
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * ADMIN / USER
 * Create a new group
  - Request Body Content: An object having a string attribute for the `name` of the group and an array that lists all the `memberEmails`
  - Response `data` Content: An object having an attribute `group` (this object must have a string attribute for the `name`
    of the created group and an array for the `members` of the group), an array that lists the `alreadyInGroup` members
    (members whose email is already present in a group) and an array that lists the `membersNotFound` (members whose email
    +does not appear in the system)
  - Optional behavior:
    - error 400 is returned if there is already an existing group with the same name
    - error 400 is returned if all the `memberEmails` either do not exist or are already in a group
 */
/* se è in un gruppo caller => 400
   una email non valida, se caller non in un group ma tutto array di email si => 400

*/
export const createGroup = async (req, res) => {
  try {
    const group = await Group.findOne({ name: req.body.name });
    if (group !== null)
      return res.status(400).json({ error: "Group already exists" });
    const userAuth = verifyAuth(req, res, { authType: "Simple" })
    if (userAuth.authorized) {
      //User | Admin auth successful
      let name = req.body.name;
      let memberEmails = req.body.memberEmails;
      let members = [];
      let callerInGroup = false;
      let membersNotFound = [];
      let alreadyInGroup = [];
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      //check errors
      if (!name || !memberEmails) {
        return res.status(400).json({ error: "Some Parameter is Missing" });
      }
      if (name.trim().length === 0) {
        return res.status(400).json({ error: "Group name is an Empty String" });
      }

      const user = await User.findOne({ refreshToken: req.cookies.refreshToken });
      if (user === null) {
        return res.status(400).json({ error: "User not found" })
      }
      let in_group = await Group.findOne({ "members.email": user.email });
      if (in_group !== null)
        return res.status(400).json({ error: "Caller already in a group" });
      //members.push({ email: user.email, user: user._id });

      for (let email of memberEmails) {
        if (email.trim().length === 0) {
          return res.status(400).json({ error: "Email is an Empty String" });
        }
        if (regex.test(email) === false) {
          return res.status(400).json({ error: "Invalid email format" });
        }

        //check if body contains  email of the user that calls the function
        if (email === user.email) {
          callerInGroup = true;
        }
        // verify that the user exists
        let user1 = await User.findOne({ email: email });
        if (user1 === null) {
          // if not existent, push into membersNotFound
          membersNotFound.push({email: email});
        } else {
          // check if user is already in a group
          let in_group = await Group.findOne({ "members.email": email });
          if (in_group === null) {
            // if user is not in a group, add it to members
            members.push({ email: email, user: user1._id });
          } else {
            // if user already in a group, add it to alreadyInGroup
            alreadyInGroup.push({ email: email});
          }
        }
      }

      // if All memberEmails does not exist or Already in Group error handling
      if (members.length === 0) {
        res.status(400).json({ error: "All memberEmails does not exist or Already in Group" });
      } else {
        if (!callerInGroup) {
          //if user is not in a group, add it to members
          members.push({ email: user.email, user: user._id });
        }
        // create a group
        const new_group = await Group.create({
          name,
          members,
        });
        const membersData = new_group.members.map( ({email})  => {return {email: email} } );
        // all ok, return the group created
        res.status(200).json({ data: { group: {name: new_group.name, members: membersData}, membersNotFound: membersNotFound, alreadyInGroup: alreadyInGroup }, refreshedTokenMessage: res.locals.refreshedTokenMessage })
      }
    } else {
      res.status(401).json({ error: userAuth.cause })
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Return all the groups
  - Request Body Content: None
  - Response `data` Content: An array of objects, each one having a string attribute for the `name` of the group
    and an array for the `members` of the group
  - Optional behavior:
    - empty array is returned if there are no groups
 */
export const getGroups = async (req, res) => {
  try {
    const adminAuth = verifyAuth(req, res, { authType: "Admin" })
    if (adminAuth.authorized) {
      //Admin auth successful
      const groups = await Group.find();
      const groupsData = groups.map(({ name, members }) => ({ 
          name, 
          members: members.map( ({email}) => ({ email }) )
        }
      ));
      return res.status(200).json({ data: groupsData, refreshedTokenMessage: res.locals.refreshedTokenMessage })
    }
    else {
      return res.status(401).json({ error: adminAuth.cause })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

/**
 * Return information of a specific group
  - Request Body Content: None
  - Response `data` Content: An object having a string attribute for the `name` of the group and an array for the 
    `members` of the group
  - Optional behavior:
    - error 400 is returned if the group does not exist
 */
export const getGroup = async (req, res) => {
  try {
    const group = await Group.findOne({ name: req.params.name });
    if (group === null) {
      return res.status(400).json({ error: "Group Does Not exist" });
    }
    const emails = group.members.map((member) => member.email);

    const groupAuth = verifyAuth(req, res, { authType: "Group", emails: emails })
    const adminAuth = verifyAuth(req, res, { authType: "Admin" })

    if (groupAuth.authorized || adminAuth.authorized) {
      //User auth successful
      const membersData = group.members.map( ({email}) => ({ email }) );
      res.status(200).json({ data: {group: {name: group.name, members: membersData}}, refreshedTokenMessage: res.locals.refreshedTokenMessage })
    } else {
      res.status(401).json({ error: groupAuth.cause })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

/**
 * Add new members to a group
  - Request Body Content: An array of strings containing the emails of the members to add to the group
  - Response `data` Content: An object having an attribute `group` (this object must have a string attribute for the `name` of the
    created group and an array for the `members` of the group, this array must include the new members as well as the old ones), 
    an array that lists the `alreadyInGroup` members (members whose email is already present in a group) and an array that lists 
    the `membersNotFound` (members whose email does not appear in the system)
  - Optional behavior:
    - error 400 is returned if the group does not exist
    - error 400 is returned if all the `memberEmails` either do not exist or are already in a group
 */
export const addToGroup = async (req, res) => {
  try {
    let auth;
    let name = req.params.name;
    const url_group = await Group.findOne({ name: name });
    if (url_group === null) {
      return res.status(400).json({ error: "Group not Found." });
    }
    const emailsInGroup = url_group.members.map((member) => member.email);
    //add user , insert admin
    if (req.url.indexOf("/add") >= 0) {
      auth = verifyAuth(req, res, { authType: "Group", emails: emailsInGroup });
    } else {
      auth = verifyAuth(req, res, { authType: "Admin"});
    }
    if (auth.authorized) {
      let memberEmails = req.body.emails;
      let members = [];
      let membersNotFound = [];
      let alreadyInGroup = [];
      if (!memberEmails) {
        return res.status(400).json({ error: "Some Parameter is Missing" });
      }
      for (let email of memberEmails) {
        //check string not empty
        if (email.trim().length === 0) {
          return res.status(400).json({ error: "Some Parameter is an Empty String" });
        }
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (regex.test(email) === false) {
          return res.status(400).json({ error: "Invalid email format" });
        }
        // verify that the user exists
        let user = await User.findOne({ email: email });
        if (user === null) {
          // if not existent, push into membersNotFound
          membersNotFound.push({ email: email });
        } else {
          // check if user is already in a group
          let in_group = await Group.findOne({ "members.email": email });
          if (in_group === null) {
            // if user is not in a group, add it to members
            members.push({ email: email, user: user._id });
          } else {
            // if user already in a group, add it to alreadyInGroup
            alreadyInGroup.push({ email: email});
          }
        }
      }
      // find and return the updated version of the group (with new option)
      const updated_group = await Group.findOneAndUpdate({ name: name }, { $push: { members: members } }, { new: true });
      // Group Does Not exist or All memberEmails does not exist or Already in Group error handling
      if (members.length === 0) {
        return res.status(400).json({ error: "All memberEmails does not exist or Already in Group" });
      }
      const membersData = updated_group.members.map( ({email})  => {return {email: email} } );
      res.status(200).json({ data: { group: {name: updated_group.name, members: membersData}, membersNotFound: membersNotFound, alreadyInGroup: alreadyInGroup }, refreshedTokenMessage: res.locals.refreshedTokenMessage })
    } else {
      res.status(401).json({ error: auth.cause })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

/**
 * Remove members from a group
  - Request Body Content: An object having an attribute `group` (this object must have a string attribute for the `name` of the
    created group and an array for the `members` of the group, this array must include only the remaining members),
    an array that lists the `notInGroup` members (members whose email is not in the group) and an array that lists 
    the `membersNotFound` (members whose email does not appear in the system)
  - Optional behavior:
    - error 400 is returned if the group does not exist
    - error 400 is returned if all the `memberEmails` either do not exist or are not in the group
 */

//a user has to remain int the group
export const removeFromGroup = async (req, res) => {
  try {
    // users = user to remove from group, name = name of the group to delete
    let name = req.params.name;
    let auth;
    const url_group = await Group.findOne({ name: name });
    if (url_group === null) {
      return res.status(400).json({ error: "Group not Found." });
    }
    const emailsInGroup = url_group.members.map((member) => member.email);
    if (req.url.indexOf("/pull") >= 0) {
      auth = verifyAuth(req, res, { authType: "Admin" });
    } else {
      auth = verifyAuth(req, res, { authType: "Group", emails: emailsInGroup });
    }
    if (auth.authorized) {
      let users = req.body.emails;

      let notInGroup = [];
      let membersNotFound = [];
      let membersToDelete = [];
      let updated_group;
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!users) {
        return res.status(400).json({ error: "Some Parameter is Missing" });
      }
      if (url_group.members.length === 1) {
        return res.status(400).json({ error: "Can't remove all members" });
      }

      //let firstUser = await Group.findOne({ name: name });
      //firstUser = firstUser.members[0];
      for (let email of users) {
        if (email.trim().length === 0) {
          return res.status(400).json({ error: "Email is an Empty String" });
        }
        if (regex.test(email) === false) {
          return res.status(400).json({ error: "Invalid email format" });
        }
        // verify that the user exists
        let user = await User.findOne({ email: email });
        if (user === null) {
          // if not existent, push into membersNotFound
          membersNotFound.push(email);
        } else {
          // check if user is  in a group
          let in_group = await Group.findOne({ "members.email": email, name: name });
          if (in_group === null) {
            // if user is not in the group, add it to notInGroup
            notInGroup.push({ email: email, user: user._id });

          } else {
            // if user the group
            membersToDelete.push({ email: email, user: user._id });

          }
        }
      }
      // Group Does Not exist or All memberEmails does not exist or Already in Group error handling
      if (membersToDelete.length === 0) {
        return res.status(400).json({ error: "All memberEmails does not exist or Already in Group" });
      } else {
        for (let member of membersToDelete) {
          let user = await User.findOne({ email: member.email });
          updated_group = await Group.findOneAndUpdate({ name: name }, { $pull: { members: { email: member.email, _id: user } } }, { new: true });
          if (updated_group.members.length === 1)
            break;
        }
        res.status(200).json({ data: { group: updated_group, membersNotFound: membersNotFound, notInGroup: notInGroup }, refreshedTokenMessage: res.locals.refreshedTokenMessage })
      }
    } else {
      res.status(401).json({ error: auth.cause })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

/**
 * Delete a user
  - Request Parameters: None
  - Request Body Content: A string equal to the `email` of the user to be deleted
  - Response `data` Content: An object having an attribute that lists the number of `deletedTransactions` and a boolean attribute that
    specifies whether the user was also `deletedFromGroup` or not.
  - Optional behavior:
    - error 400 is returned if the user does not exist 
 */
export const deleteUser = async (req, res) => {
  try {
    const adminAuth = verifyAuth(req, res, { authType: "Admin" })
    if (adminAuth.authorized) {
      //Admin auth successful
      const email = req.body.email;
      if (!email) {
        return res.status(400).json({ error: "Some Parameter is Missing" });
      }
      if (email.trim().length === 0) {
        return res.status(400).json({ error: "Some Parameter is an Empty String" });
      }
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (regex.test(email) === false) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      //remove the user from his group (if the user has one)
      const user = await User.findOne({ email: email });
      if (user === null) {
        return res.status(400).json({ error: "User Does Not exist" });
      } else if (user.role === "Admin") {
        return res.status(400).json({ error: "User is an Admin,can't delete" });
      } else {
        //remove from group
        const updated_group = await Group.findOneAndUpdate({ "members.email": email }, { $pull: { members: { email: email, _id: user._id } } }, { new: true });

        if (updated_group !== null && updated_group.members.length === 0) {
          await Group.deleteOne({ name: updated_group.name });
        }

        //return the number of deleted user (in our case possible values are only 1 or 0, since email is unique)
        let trans = await transactions.deleteMany({ username: user.username })
        await User.deleteOne({ email: email });
        res.status(200).json({ data: { deletedTransactions: trans.deletedCount, deletedFromGroup: updated_group !== null }, refreshedTokenMessage: res.locals.refreshedTokenMessage })
      }
    } else {
      res.status(401).json({ error: adminAuth.cause })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * Delete a group
  - Request Body Content: A string equal to the `name` of the group to be deleted
  - Response `data` Content: A message confirming successful deletion
  - Optional behavior:
    - error 400 is returned if the group does not exist
 */
export const deleteGroup = async (req, res) => {
  try {
    const adminAuth = verifyAuth(req, res, { authType: "Admin" });
    if (adminAuth.authorized) {
      //Group auth successful
      const name = req.body.name;
      if (!name) {
        return res.status(400).json({ error: "Some Parameter is Missing" });
      }
      if (name.trim().length === 0) {
        return res.status(400).json({ error: "Some Parameter is an Empty String" });
      }
      // return the number of deleted groups (in our case possible values are only 1 or 0, since name is unique)
      const n_el_deleted = await Group.deleteOne({ name: name });
      if (n_el_deleted.deletedCount === 0) {
        // no group deleted, the group does not exist
        res.status(400).json({ error: "Group Does Not exist" });
      } else {
        // group deleted wuth success
        res.status(200).json({ data: { message: "Group deleted successfully" }, refreshedTokenMessage: res.locals.refreshedTokenMessage })
      }
    } else {
      res.status(401).json({ error: adminAuth.cause })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}