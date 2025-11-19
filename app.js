// packages
const express = require("express");
const app = express();
const path = require("path");
const methodOverride = require("method-override");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const ejsMate = require("ejs-mate");

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
const dbUrl = "mongodb://127.0.0.1:27017/Bhola";

async function main() {
    await mongoose.connect(dbUrl)
}
main()
.then((res)=>{
    console.log("successfull connected");
})
.catch((err)=>{
    console.log(err);
})


    
// Session config
app.use(
    session({
        secret: "mysupersecretkey",
        resave: false,
        saveUninitialized: true,
        store: MongoStore.create({ mongoUrl: dbUrl }),
        cookie: { maxAge: 1000 * 60 * 60 * 24 }
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

// admin middleware
function isAdmin(req, res, next) {
    if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Access denied" });
    }
    next();
}

// INDEX
app.get("/products", async (req, res) => {
    const products = await Product.find();
    res.render("product/home", { products });
});

// NEW FORM — Create
app.get("/products/new", isLoggedIn, isAdmin, (req, res) => {
    res.render("product/new");
});

// CREATE PRODUCT
app.post("/products", isLoggedIn, isAdmin, async (req, res) => {
    await Product.create(req.body);
    res.redirect("/products");
});

// SHOW
app.get("/products/:id", async (req, res) => {
    const product = await Product.findById(req.params.id);
    res.render("product/show", { product });
});

// EDIT FORM
app.get("/products/:id/edit", isLoggedIn, isAdmin, async (req, res) => {
    const product = await Product.findById(req.params.id);
    res.render("product/edit", { product });
});

// UPDATE
app.put("/products/:id", isLoggedIn, isAdmin, async (req, res) => {
    await Product.findByIdAndUpdate(req.params.id, req.body);
    res.redirect(`/products/${req.params.id}`);
});

// DELETE
app.delete("/products/:id", isLoggedIn, isAdmin, async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect("/products");
});


//Authentication

// Register
app.get("/signup", (req, res) => res.render("auth/signup"));
app.post("/register", async (req, res) => {
    const { username, email, password } = req.body;
    let user = new User({ username, email, password });
    await user.save();

    req.session.userId = user._id;
    req.session.role = user.role;

    res.redirect("/products");
});

// Login
app.get("/login", (req, res) => res.render("auth/login"));
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


//port
app.listen(8080, () => {
    console.log("Server running on 8080");
});
