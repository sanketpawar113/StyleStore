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
// Make sure this file exists: /config/cloudinary.js  (or change name if yours is different)
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

// ---------------- MONGODB CONNECTION ----------------
const dbUrl = process.env.DATABASE_URL;

async function main() {
  try {
    await mongoose.connect(dbUrl);
    console.log(" MongoDB connected");
  } catch (err) {
    console.error(" MongoDB connection error:", err.message);
  }
}
main();

// ---------------- SESSION CONFIG ----------------
app.use(
  session({
    secret: process.env.SESSION_SECRET || "mysupersecretkey",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: dbUrl }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    },
  })
);

// expose session to all ejs files
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// ---------------- AUTH MIDDLEWARES ----------------
function isLoggedIn(req, res, next) {
  if (!req.session.userId) {
    // For browser app, redirect better than JSON
    return res.redirect("/login");
  }
  next();
}

async function isOwner(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send("Product not found");

    if (!product.owner || !product.owner.equals(req.session.userId)) {
      return res.status(403).send("Access denied: Not your product");
    }

    next();
  } catch (err) {
    next(err);
  }
}

// ---------------- ROUTES ----------------

// root → redirect to products
app.get("/", (req, res) => {
  res.redirect("/products");
});

// PRODUCTS INDEX
app.get("/products", async (req, res, next) => {
  try {
    const products = await Product.find();
    res.render("product/home", { products });
  } catch (err) {
    next(err);
  }
});

// NEW FORM
app.get("/products/new", isLoggedIn, (req, res) => {
  res.render("product/new");
});

// CREATE PRODUCT (WITH OWNER + CLOUDINARY)
app.post("/products", isLoggedIn, upload.single("image"), async (req, res, next) => {
  try {
    const productData = req.body;

    if (req.file) {
      productData.image = {
        url: req.file.path,
        public_id: req.file.filename,
      };
    }

    productData.owner = req.session.userId;

    await Product.create(productData);

    res.redirect("/products");
  } catch (err) {
    next(err);
  }
});

// SHOW PRODUCT
app.get("/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate("owner");
    if (!product) return res.status(404).send("Product not found");

    res.render("product/show", { product });
  } catch (err) {
    next(err);
  }
});

// EDIT FORM (OWNER ONLY)
app.get("/products/:id/edit", isLoggedIn, isOwner, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send("Product not found");

    res.render("product/edit", { product });
  } catch (err) {
    next(err);
  }
});

// UPDATE PRODUCT (OWNER ONLY)
app.put(
  "/products/:id",
  isLoggedIn,
  isOwner,
  upload.single("image"),
  async (req, res, next) => {
    try {
      const updateData = req.body;

      if (req.file) {
        updateData.image = {
          url: req.file.path,
          public_id: req.file.filename,
        };
      }

      await Product.findByIdAndUpdate(req.params.id, updateData);

      res.redirect(`/products/${req.params.id}`);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE PRODUCT (OWNER ONLY)
app.delete("/products/:id", isLoggedIn, isOwner, async (req, res, next) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect("/products");
  } catch (err) {
    next(err);
  }
});

// ---------------- AUTH ROUTES ----------------

// Register page
app.get("/signup", (req, res) => res.render("auth/signup"));

// Register
app.post("/register", async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const user = new User({ username, email, password });
    await user.save();

    req.session.userId = user._id;
    req.session.role = user.role;

    res.redirect("/products");
  } catch (err) {
    next(err);
  }
});

// Login page
app.get("/login", (req, res) => res.render("auth/login"));

// Login
app.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.json({ error: "User not found" });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.json({ error: "Incorrect password" });

    req.session.userId = user._id;
    req.session.role = user.role;

    res.redirect("/products");
  } catch (err) {
    next(err);
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// USERS LIST
app.get("/users", isLoggedIn, async (req, res, next) => {
  try {
    const users = await User.find();
    res.render("auth/users", { users });
  } catch (err) {
    next(err);
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).send("Page not found");
});

// GENERAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error("💥 Server Error:", err);
  res.status(500).send("Internal Server Error");
});

// PORT
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
