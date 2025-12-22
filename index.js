const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
require('dotenv').config();

const verifyToken = require('./middleware/verifyToken');

const app = express();
const port = process.env.PORT || 5000;

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

/* ---------------- DATABASE ---------------- */
const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db('garmentsTracker');
    const usersCollection = db.collection('users');
    const productsCollection = db.collection('products');
    const ordersCollection = db.collection('orders');

    console.log('MongoDB Connected');
//   ----------------register ROUTES ---------------- */
    app.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  const exists = await usersCollection.findOne({ email });
  if (exists) return res.status(400).send({ message: 'User already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);

  await usersCollection.insertOne({
    name,
    email,
    password: hashedPassword,
    role,
    status: 'active',
  });

  res.send({ success: true });
});

    /* ---------------- LOGIN ---------------- */
    app.post('/login', async (req, res) => {
      try {
        const { email, password } = req.body;

        const user = await usersCollection.findOne({ email: email.trim() });
        if (!user) {
          return res.status(401).send({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(401).send({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
          { email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        res.cookie('token', token, {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
        });

        res.send({
          user: {
            email: user.email,
            role: user.role,
          },
        });

      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Server error' });
      }
    });

    /* ---------------- LOGOUT ---------------- */
    app.post('/logout', (req, res) => {
      res.clearCookie('token');
      res.send({ success: true });
    });

    /* ---------------- PRODUCTS ---------------- */
    app.get('/home-products', async (req, res) => {
      const result = await productsCollection.find({ showOnHome: true }).limit(6).toArray();
      res.send(result);
    });

    app.get('/all-products', async (req, res) => {
      const page = parseInt(req.query.page) || 0;
      const size = parseInt(req.query.size) || 20;
      const result = await productsCollection.find().skip(page * size).limit(size).toArray();
      res.send(result);
    });

    app.get('/product/:id', async (req, res) => {
      const id = req.params.id;
      const product = await productsCollection.findOne({ _id: new ObjectId(id) });
      res.send(product);
    });

    app.post('/products', verifyToken, async (req, res) => {
      const result = await productsCollection.insertOne(req.body);
      res.send(result);
    });

    /* ---------------- ORDERS ---------------- */
    app.post('/book-product', verifyToken, async (req, res) => {
      const order = {
        ...req.body,
        userEmail: req.user.email,
        status: 'Pending',
        createdAt: new Date(),
      };
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    app.get('/my-orders', verifyToken, async (req, res) => {
      const orders = await ordersCollection
        .find({ userEmail: req.user.email })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(orders);
    });

  } finally {
  }
}
run();

app.get('/', (req, res) => {
  res.send('Garments Tracker Server Running');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
