const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ROOT TEST ROUTE
app.get("/", (req, res) => {
  res.send("Garments Tracker Server Running");
});

module.exports = app;