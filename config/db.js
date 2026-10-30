// Connects to MongoDB once at startup.
// If the database is unreachable the process stops instead of serving broken requests.

const mongoose = require("mongoose");

const connectDB = async (mongoUri = process.env.MONGO_URI) => {
  try {
    await mongoose.connect(mongoUri);
    console.info("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
