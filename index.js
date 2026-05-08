const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();

// ----------------------
// Middleware
// ----------------------
app.use(cors({
  origin: "*",
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// ----------------------
// MongoDB Setup
// ----------------------
const uri = `mongodb+srv://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASS)}@cluster0.m3b0wdj.mongodb.net/assignment11?retryWrites=true&w=majority`;

const client = new MongoClient(uri);

// ----------------------
// SAFE DB CONNECT HELPER (IMPORTANT FOR VERCEL)
// ----------------------
const getDB = async () => {
  if (!client.topology || !client.topology.isConnected()) {
    await client.connect();
  }
  return client.db("assignment11");
};

// ----------------------
// ROOT TEST ROUTE
// ----------------------
app.get("/", (req, res) => {
  res.send("🚀 Garments Tracker Server Running");
});

// ======================================================
// USERS
// ======================================================

app.post("/users", async (req, res) => {
  try {
    const db = await getDB();
    const usersCollection = db.collection("users");

    const user = req.body;

    const existing = await usersCollection.findOne({ email: user.email });

    if (existing) {
      return res.send({ message: "User already exists" });
    }

    const result = await usersCollection.insertOne({
      ...user,
      status: "pending",
      role: user.role || "buyer",
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

app.get("/users", async (req, res) => {
  try {
    const db = await getDB();
    const usersCollection = db.collection("users");

    const result = await usersCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send([]);
  }
});

app.patch("/users/:id", async (req, res) => {
  try {
    const db = await getDB();
    const usersCollection = db.collection("users");

    const id = req.params.id;

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: req.body }
    );

    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// ======================================================
// PRODUCTS
// ======================================================

app.post("/products", async (req, res) => {
  try {
    const db = await getDB();
    const productsCollection = db.collection("products");

    const result = await productsCollection.insertOne(req.body);
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

app.get("/all-products", async (req, res) => {
  try {
    const db = await getDB();
    const productsCollection = db.collection("products");

    const result = await productsCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

app.get("/product/:id", async (req, res) => {
  try {
    const db = await getDB();
    const productsCollection = db.collection("products");

    const result = await productsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    const db = await getDB();
    const productsCollection = db.collection("products");

    const result = await productsCollection.deleteOne({
      _id: new ObjectId(req.params.id),
    });

    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// ======================================================
// ORDERS
// ======================================================

app.post("/book-product", async (req, res) => {
  try {
    const db = await getDB();
    const ordersCollection = db.collection("orders");

    const order = req.body;

    const result = await ordersCollection.insertOne({
      ...order,
      status: "Pending",
      createdAt: new Date(),
      approvedAt: null,
    });

    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

app.patch("/orders/:id", async (req, res) => {
  try {
    const db = await getDB();
    const ordersCollection = db.collection("orders");

    const { status } = req.body;

    const updateDoc = {
      $set: {
        status,
      },
    };

    if (status === "Approved") {
      updateDoc.$set.approvedAt = new Date();
    }

    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      updateDoc
    );

    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

app.get("/orders", async (req, res) => {
  try {
    const db = await getDB();
    const ordersCollection = db.collection("orders");

    const result = await ordersCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

app.get("/my-orders", async (req, res) => {
  try {
    const db = await getDB();
    const ordersCollection = db.collection("orders");

    const email = req.query.email;

    const result = await ordersCollection
      .find({ userEmail: email })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (err) {
    res.status(500).send([]);
  }
});

// ======================================================
// HOME PRODUCTS
// ======================================================

app.get("/home-products", async (req, res) => {
  try {
    const db = await getDB();
    const productsCollection = db.collection("products");

    const result = await productsCollection.find().limit(6).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// ======================================================
// EXPORT FOR VERCEL
// ======================================================
module.exports = app;