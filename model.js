// Imports ------------------------------------------------------
import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcrypt";

// Making a transaction Schema ----------------------------------
const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  createdFor: {
    type: String,
    required: true,
  },
  createdByName: {
    type: String,
    required: true,
  },
  createdForName: {
    type: String,
    required: true,
  },
  customerName: {
    type: String,
  },
  images: {
    type: [String],
  },
  description: {
    type: String,
  },
  customer: {
    type: String,
  }
});


const signupSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    validate: [validator.isEmail, "Provide a valid email"],
  },
  firstName: {
    type: String,
    required: true,
    minlength: [3, "First name must be at least 3 characters."],
    maxlength: [30, "First name cannot exceed 30 characters."],
  },
  lastName: {
    type: String,
    required: true,
    minlength: [3, "Last name must be at least 3 characters."],
    maxlength: [30, "Last name cannot exceed 30 characters."],
  },
  phone: {
    type: String,
    required: true,
    minlength: [10, "Phone number must contain 10 digits."],
    maxlength: [10, "Phone number must contain 10 digits."],
  },
  password: {
    type: String,
    required: true,
  },
  userType: {
    type: String,
    required: true,
  },
  currentTransactions: {
    type: [transactionSchema],
    default: []
  },
  pastTransactions: {
    type: [transactionSchema],
    default: []
  }
},);

signupSchema.pre('save', async function(next) {
  // Apply hashing to the password for security using bycrypt library
  if (this.isModified('password') || this.isNew) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

export const Users = mongoose.model("Users", signupSchema);
