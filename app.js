// packages
require("dotenv").config();
const express = require("express");
const app = express();
const path = require("path");
const methodOverride = require("method-override");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const ejsMate = require("ejs-mate");
const multer = require("multer");

// Cloudinary config
const { storage } = require("./config/cloudinary");
const upload = multer({ storage });

// models
const User = require("./models/User");
const Product = require("./models/Product");

// ejs
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

// middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));

// MongoDB Connection
const dbUrl = process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/Bhola";

async function main() {
  await mongoose.connect(dbUrl);
}
main()
  .then(() => console.log("successful connected"))
  .catch((err) => console.log(err));

// Session config
app.use(
  session({
    secret: process.env.SESSION_SECRET || "mysupersecretkey",
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: dbUrl }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  })
);

// expose session to all ejs files
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// authentication middleware
function isLoggedIn(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "You must login first" });
  }
  next();
}

// OWNER MIDDLEWARE
async function isOwner(req, res, next) {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).send("Product not found");

  if (!product.owner.equals(req.session.userId)) {
    return res.status(403).send("Access denied: Not your product");
  }
  next();
}

// ---------------- PRODUCT ROUTES ----------------

// INDEX
app.get("/products", async (req, res) => {
  const products = await Product.find();
  res.render("product/home", { products });
});

// NEW FORM
app.get("/products/new", isLoggedIn, (req, res) => {
  res.render("product/new");
});

// CREATE PRODUCT (WITH OWNER)
app.post("/products", isLoggedIn, upload.single("image"), async (req, res) => {
  const productData = req.body;

  if (req.file) {
    productData.image = {
      url: req.file.path,
      public_id: req.file.filename,
    };
  }

  productData.owner = req.session.userId; // attach owner

  await Product.create(productData);

  res.redirect("/products");
});

// SHOW PRODUCT
app.get("/products/:id", async (req, res) => {
    const product = await Product.findById(req.params.id).populate("owner");
    res.render("product/show", { product });
});

// EDIT FORM (OWNER ONLY)
app.get("/products/:id/edit", isLoggedIn, isOwner, async (req, res) => {
  const product = await Product.findById(req.params.id);
  res.render("product/edit", { product });
});

// UPDATE PRODUCT (OWNER ONLY)
app.put(
  "/products/:id",
  isLoggedIn,
  isOwner,
  upload.single("image"),
  async (req, res) => {
    const updateData = req.body;

    if (req.file) {
      updateData.image = {
        url: req.file.path,
        public_id: req.file.filename,
      };
    }

    await Product.findByIdAndUpdate(req.params.id, updateData);

    res.redirect(`/products/${req.params.id}`);
  }
);

// DELETE PRODUCT (OWNER ONLY)
app.delete("/products/:id", isLoggedIn, isOwner, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.redirect("/products");
});

// ---------------- AUTH ROUTES ----------------

// Register page
app.get("/signup", (req, res) => res.render("auth/signup"));

// Register
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  const user = new User({ username, email, password });
  await user.save();

  req.session.userId = user._id;
  req.session.role = user.role;

  res.redirect("/products");
});

// Login page
app.get("/login", (req, res) => res.render("auth/login"));

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.json({ error: "User not found" });

  const isMatch = await user.matchPassword(password);
  if (!isMatch) return res.json({ error: "Incorrect password" });

  req.session.userId = user._id;
  req.session.role = user.role;

  res.redirect("/products");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// USERS LIST
app.get("/users", isLoggedIn, async (req, res) => {
  const users = await User.find();
  res.render("auth/users", { users });
});

// PORT
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on 8080");
});
