const Product = require("../models/Product");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// Get all products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// Add product (admin)
exports.addProduct = async (req, res) => {
  const { title, description, price, category } = req.body;
  try {
    const product = new Product({
      title,
      description,
      price,
      category,
      fileUrl: req.file ? req.file.path : null,
    });
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// Update progress (for enrolled users)
exports.updateProgress = async (req, res) => {
  const { productId, progress } = req.body;
  const userId = req.user.id;
  try {
    const product = await Product.findById(productId);
    const index = product.progress.findIndex(
      (p) => p.user.toString() === userId,
    );
    if (index > -1) {
      product.progress[index].progress = progress;
    } else {
      product.progress.push({ user: userId, progress });
    }
    await product.save();
    res.json({ msg: "Progress updated" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};
