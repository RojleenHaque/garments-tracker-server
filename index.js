/* ---------------- IMPORTS ---------------- */
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
require('dotenv').config();

/* ---------------- APP & PORT ---------------- */
const app = express();
const port = process.env.PORT || 5000;

/* ---------------- MIDDLEWARE ---------------- */
const allowedOrigins = [
  'https://zesty-treacle-71cc0b.netlify.app',
  'http://localhost:3000',
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.options('*', cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json());
app.use(cookieParser());

/* ---------------- JWT VERIFICATION ---------------- */
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).send({ message: 'Invalid token' });
  }
};

/* ---------------- DATABASE ---------------- */
const client = new MongoClient(process.env.DB_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function startServer() {
  try {
    await client.connect();
    console.log(`✅ MongoDB Connected`);

    const db = client.db('garmentsTracker');
    const usersCollection = db.collection('users');
    const productsCollection = db.collection('products');
    const ordersCollection = db.collection('orders');

    /* ---------------- REGISTER ---------------- */
    app.post('/api/register', async (req, res) => {
      try {
        const { name, email, password, role } = req.body;
        const exists = await usersCollection.findOne({ email });
        if (exists) return res.status(400).send({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCollection.insertOne({ name, email, password: hashedPassword, role, status: 'active' });
        res.send({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Server error' });
      }
    });

    /* ---------------- LOGIN ---------------- */
    app.post('/api/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await usersCollection.findOne({ email: email.trim() });
        if (!user) return res.status(401).send({ message: 'Invalid credentials' });
        if (user.status !== 'active') return res.status(403).send({ message: 'User inactive' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).send({ message: 'Invalid credentials' });

        const token = jwt.sign(
          { id: user._id, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
        res.send({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Server error' });
      }
    });

    /* ---------------- LOGOUT ---------------- */
    app.post('/api/logout', (req, res) => {
      res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
      res.send({ success: true });
    });

    /* ---------------- HOME & PRODUCTS ---------------- */
    app.get('/api/home-products', async (req, res) => {
      try {
        const result = await productsCollection.find({ showOnHome: true }).limit(6).toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Failed to fetch products' });
      }
    });

    app.get('/api/all-products', async (req, res) => {
      try {
        const products = await productsCollection.find().toArray();
        res.send(products);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Failed to fetch products' });
      }
    });

    app.get('/api/product/:id', async (req, res) => {
      try {
        const product = await productsCollection.findOne({ _id: new ObjectId(req.params.id) });
        res.send(product);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Failed to fetch product' });
      }
    });

    /* ---------------- MANAGER CRUD ---------------- */
    app.post('/api/products', verifyToken, async (req, res) => {
      if (req.user.role !== 'manager') return res.status(403).send({ message: 'Forbidden' });
      const result = await productsCollection.insertOne(req.body);
      res.send(result);
    });

    app.put('/api/products/:id', verifyToken, async (req, res) => {
      if (req.user.role !== 'manager') return res.status(403).send({ message: 'Forbidden' });
      const result = await productsCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );
      res.send(result);
    });

    app.delete('/api/products/:id', verifyToken, async (req, res) => {
      if (req.user.role !== 'manager') return res.status(403).send({ message: 'Forbidden' });
      const result = await productsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    /* ---------------- ORDERS ---------------- */
    app.post('/api/book-product', verifyToken, async (req, res) => {
      const order = { ...req.body, userEmail: req.user.email, status: 'Pending', createdAt: new Date() };
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    app.get('/api/my-orders', verifyToken, async (req, res) => {
      const orders = await ordersCollection
        .find({ userEmail: req.user.email })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(orders);
    });

    /* ---------------- ROOT ---------------- */
    app.get('/', (req, res) => res.send('Garments Tracker Server Running'));

    /* ---------------- START SERVER ---------------- */
    app.listen(port, () => console.log(`Server running on port ${port}`));

  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  }
}

startServer();
