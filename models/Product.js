const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    title: String,
    price: Number,
    description: String,
    category: String,
    image: String,
    stock: { type: Number, default: 1 },
});

module.exports = mongoose.model("Product", productSchema);
