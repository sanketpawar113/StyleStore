const mongoose = require("mongoose");
const Product = require("../models/Product.js");
const sampleData = require("./data.js");

//connecting mongoose
const localUrl = "mongodb://127.0.0.1:27017/Bhola";

async function main() {
  await mongoose.connect(localUrl);
  console.log("MongoDB connected!");
}
main();

const init = async () => {
  try {
    await Product.deleteMany({});
    let response = await Product.insertMany(sampleData.Data);  // ✅ Correct key
    console.log("Inserted:", response);
  } catch (err) {
    console.log("Error:", err);
  } finally {
    mongoose.connection.close();   // Optional
  }
};

init();
