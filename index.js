const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// ----------------------
// Middleware
// ----------------------
app.use(cors({
  origin: "*",
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// ----------------------
// MongoDB
// ----------------------
const uri = `mongodb+srv://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASS)}@cluster0.m3b0wdj.mongodb.net/assignment11?retryWrites=true&w=majority`;

const client = new MongoClient(uri);

// ----------------------
// MAIN SERVER
// ----------------------
async function run() {
  try {
    await client.connect({
      serverSelectionTimeoutMS: 5000,
      tls: true,
    });

    console.log("MongoDB connected");

    const db = client.db("assignment11");

    const usersCollection = db.collection("users");
    const productsCollection = db.collection("products");
    const ordersCollection = db.collection("orders");

    // ----------------------
    // Test Route
    // ----------------------
    app.get("/", (req, res) => {
      res.send("Garments Tracker Server Running");
    });

    // ----------------------
    // USERS (Firebase handles auth, we just store data)
    // ----------------------

    app.post("/users", async (req, res) => {
      try {
        const user = req.body;

        const existing = await usersCollection.findOne({ email: user.email });

        if (existing) {
          return res.send({ message: "User already exists" });
        }

        const result = await usersCollection.insertOne({
          ...user,
          status: "pending",
          role: user.role || "buyer"
        });

        res.send(result);

      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    app.get("/users", async (req, res) => {
  try {
    const result = await usersCollection.find().toArray();
    res.send(result); // MUST be array
  } catch (error) {
    res.status(500).send([]);
  }
});

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const update = req.body;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: update }
      );

      res.send(result);
    });

    // ----------------------
    // PRODUCTS
    // ----------------------

    app.post("/products", async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result);
    });

    app.get("/all-products", async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    });

    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;

      const result = await productsCollection.findOne({
        _id: new ObjectId(id)
      });

      res.send(result);
    });

    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;

      const result = await productsCollection.deleteOne({
        _id: new ObjectId(id)
      });

      res.send(result);
    });

    // ----------------------
    // ORDERS
    // ----------------------

    app.post("/book-product", async (req, res) => {

  try {

    const order = req.body;

    const result = await ordersCollection.insertOne({
      ...order,

      status: "Pending",

      createdAt: new Date(),

      approvedAt: null,
    });

    res.send(result);

  } catch (err) {

    res.status(500).send({
      message: err.message,
    });
  }
});
 app.patch("/orders/:id", async (req, res) => {

  try {

    const id = req.params.id;

    const { status } = req.body;

    const updateDoc = {
      $set: {
        status,
      },
    };

    // if approved
    if (status === "Approved") {
      updateDoc.$set.approvedAt = new Date();
    }

    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(id) },
      updateDoc
    );

    res.send(result);

  } catch (err) {

    res.status(500).send({
      message: err.message,
    });
  }
});


    app.get("/home-products", async (req, res) => {
  try {
    const result = await productsCollection.find().limit(6).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

    app.get("/orders", async (req, res) => {
      const result = await ordersCollection.find().toArray();
      res.send(result);
    });

    app.get("/my-orders", async (req, res) => {
      const email = req.query.email;

      const result = await ordersCollection
        .find({ userEmail: email })
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    console.log("Server ready");

  } catch (err) {
    console.error(err);
  }
}

run();


// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });

module.exports = app;