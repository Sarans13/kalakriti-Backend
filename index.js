// Imports -------------------------------------------------------------------
import express from "express";
import dotenv from "dotenv";
import { dbConnection } from "./database.js";
import { Users } from "./model.js";
import bcrypt from "bcrypt";
import multer from "multer";
import fs from "fs";
import cors from "cors";
import { v4 as uuidv4 } from 'uuid';

// configure the .dotenv file ------------------------------------------------
dotenv.config({ path: "./.env" });

// create and make a middleware
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

// Serve static files from the "uploads" directory
app.use("/uploads", express.static("uploads"));

// Connect Database ----------------------------------------------------------
dbConnection();

// Configuring api routes ----------------------------------------------------
app.get("/", (req, res) => res.send("API Running"));

// signup API ----------------------------------------------------------------
app.post("/signup", async (req, res) => {
  const { firstName, lastName, email, password, phone, address, userType } =
    req.body;
  try {
    const newUser = new Users({
      firstName,
      lastName,
      email,
      password,
      phone,
      userType,
    });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error registering user", error: error.message });
  }
});

// Login API ----------------------------------------------------------------------
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    res.status(200).json({ message: "Login successful", userId: user._id });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
});

// Fetch user details by id --------------------------------------------------------
// name
app.get("/userFirstName/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user.firstName);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching user details", error: error.message });
  }
});

// current transactions
// Fetch all current transactions by user ID -----------------------------------------
app.get("/transactions/current/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const currentTransactions = user.currentTransactions;
    res.status(200).json({ userType: user.userType, currentTransactions });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Error fetching current transactions",
        error: error.message,
      });
  }
});

// Fetch past transactions by user ID -----------------------------------------
app.get("/transactions/past/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const pastTransactions = user.pastTransactions;
    res.status(200).json({ userType: user.userType, pastTransactions });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching past transactions",
      error: error.message,
    });
  }
});

// Creating a storage bucket for the images --------------------------------------------
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const originalName = file.originalname;
    const sanitizedFilename = originalName.replace(/\s+/g, "");
    cb(null, Date.now() + "-" + sanitizedFilename);
  },
});
const upload = multer({ storage });
app.post("/upload", upload.array("images"), async (req, res) => {
  const { createdFor, createdBy, description, customer } = req.body;
  console.log(req.body);
  let imagePaths = [];
  if (req.files && req.files.length > 0) {
    imagePaths = req.files.map((file) => file.path);
  }
  const transactionId = uuidv4();
  try {
    const forUser = await Users.findById(createdFor);
    if (!forUser) {
      return res.status(404).json({ message: "Interior Designer (createdFor) not found" });
    }

    const byUser = await Users.findById(createdBy);
    if (!byUser) {
      return res.status(404).json({ message: "User (createdBy) not found" });
    }

    let customerUser = null;
    let customerName = null;
    if (customer !== 'undefined') {
      customerUser = await Users.findById(customer);
      if (!customerUser) {
        return res.status(404).json({ message: "Customer not found" });
      }
      customerName = `${customerUser.firstName} ${customerUser.lastName}`;
    }

    const newTransaction = {
      transactionId,
      createdBy,
      createdByName: `${byUser.firstName} ${byUser.lastName}`,
      createdFor,
      createdForName: `${forUser.firstName} ${forUser.lastName}`,
      images: imagePaths,
      ...(description && { description }),
      ...(customer && { customer, customerName }),
    };

    if (customerUser) {
      newTransaction.customerTransactionId = transactionId; // Assign same transactionId for customer
      customerUser.currentTransactions.push(newTransaction);
      await customerUser.save();
    }

    // Assign same transactionId for createdBy and createdFor
    newTransaction.createdForTransactionId = transactionId;
    newTransaction.createdByTransactionId = transactionId;

    forUser.currentTransactions.push(newTransaction);
    byUser.currentTransactions.push(newTransaction);

    await forUser.save();
    await byUser.save();

    res.status(200).json({
      message: "Transaction created successfully",
      transaction: newTransaction,
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating transaction", error: error.message });
  }
});


// Fetch planner and vendor for the Customer and just the vendors for the planner -------------------
app.get("/fetch-users/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    let users;
    const userType = user.userType;
    if (user.userType === "Customer") {
      const interiorDesigners = await Users.find({
        userType: "Interior Designer",
      });
      const workers = await Users.find({ userType: "Worker/Carpenter" });
      users = { userType, interiorDesigners, workers };
    } else if (user.userType === "Interior Designer") {
      const workers = await Users.find({ userType: "Worker/Carpenter" });
      users = { userType, workers };
    } else if (user.userType === "Worker/Carpenter") {
      const interiorDesigners = await Users.find({
        userType: "Interior Designer",
      });
      users = { userType, interiorDesigners };
    } else {
      return res.status(400).json({ message: "Invalid user type" });
    }
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching users",
      error: error.message,
    });
  }
});

// Resolve transaction by ID ------------------------------------------------------------------------
app.post("/resolve-transaction", async (req, res) => {
  const { userId, transactionId, description } = req.body;
  console.log(transactionId);
  try {
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const transactionIndex = user.currentTransactions.findIndex(
      (t) => transactionId === transactionId
    );

    if (transactionIndex === -1) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    if (description) {
      user.currentTransactions[transactionIndex].description = description;
    }
    const [resolvedTransaction] = user.currentTransactions.splice(transactionIndex, 1);
    user.pastTransactions.push(resolvedTransaction);
    await user.save();
    if (resolvedTransaction.createdBy) {
      const createdByUser = await Users.findById(resolvedTransaction.createdBy);
      console.log('Created By' + createdByUser.firstName)
      if (createdByUser) {
        const transactionIndexByUser = createdByUser.currentTransactions.findIndex(
          (t) => t.transactionId === transactionId
        );
        console.log(transactionIndexByUser);
        if (transactionIndexByUser !== -1) {
          createdByUser.currentTransactions.splice(transactionIndexByUser, 1);
          createdByUser.pastTransactions.push(resolvedTransaction);
          await createdByUser.save();
        }
      }
    }
    if (resolvedTransaction.createdFor) {
      const createdForUser = await Users.findById(resolvedTransaction.createdFor);
      console.log('Created For' + createdForUser.firstName)
      if (createdForUser) {
        const transactionIndexForUser = createdForUser.currentTransactions.findIndex(
          (t) => t.transactionId === transactionId
        );
        console.log(transactionIndexForUser);
        if (transactionIndexForUser !== -1) {
          createdForUser.currentTransactions.splice(transactionIndexForUser, 1);
          createdForUser.pastTransactions.push(resolvedTransaction);
          await createdForUser.save();
        }
      }
    }
    if (resolvedTransaction.customer !== 'undefined') {
      const customerUser = await Users.findById(resolvedTransaction.customer);
      console.log('cust' + customerUser)
      if (customerUser) {
        const transactionIndexCustomer = customerUser.currentTransactions.findIndex(
          (t) => t.transactionId === transactionId
        );
        console.log(transactionIndexCustomer);
        if (transactionIndexCustomer !== -1) {
          customerUser.currentTransactions.splice(transactionIndexCustomer, 1);
          customerUser.pastTransactions.push(resolvedTransaction);
          await customerUser.save();
        }
      }
    }    
    res.status(200).json({ message: "Transaction resolved successfully", transaction: resolvedTransaction });

  } catch (error) {
    res.status(500).json({ message: "Error resolving transaction", error: error.message });
  }
});





// fetch customers for interior designers -----------------------------------------------------------
app.get(
  "/interior-designer/customers/:interiorDesignerId",
  async (req, res) => {
    const { interiorDesignerId } = req.params;
    try {
      const interiorDesigner = await Users.findById(interiorDesignerId);
      if (
        !interiorDesigner ||
        interiorDesigner.userType !== "Interior Designer"
      ) {
        return res.status(404).json({ message: "Interior Designer not found" });
      }
      const customerIds = interiorDesigner.currentTransactions
      .filter(transaction => transaction.createdBy.toString() !== interiorDesignerId)
      .map(transaction => transaction.createdBy);
      const customers = await Users.find({ _id: { $in: customerIds } });
      res.status(200).json(customers);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching customers", error: error.message });
    }
  }
);

// Intializing port number to start the server -----------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
