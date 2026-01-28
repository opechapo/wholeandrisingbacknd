const Product = require("../models/Product");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// Get all products (public)
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// Create product
exports.addProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      pricingModel,
      overview,
      curriculum,
    } = req.body;

    const fileUrl = req.files?.file?.[0]?.path || null;
    const featuredImageUrl = req.files?.featuredImage?.[0]?.path || null;

    let parsedCurriculum = [];
    if (curriculum) {
      parsedCurriculum = JSON.parse(curriculum);
    }

    const product = new Product({
      title,
      description,
      price: pricingModel === "free" ? 0 : parseFloat(price),
      category,
      pricingModel,
      fileUrl,
      featuredImageUrl,
      overview,
      curriculum: parsedCurriculum,
    });

    await product.save();
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: "Product not found" });

    const {
      title,
      description,
      price,
      category,
      pricingModel,
      overview,
      curriculum,
    } = req.body;

    if (title !== undefined) product.title = title;
    if (description !== undefined) product.description = description;
    if (category !== undefined) product.category = category;

    if (pricingModel !== undefined) {
      product.pricingModel = pricingModel;
      if (pricingModel === "free") {
        product.price = 0;
      }
    }

    if (price !== undefined && product.pricingModel !== "free") {
      product.price = parseFloat(price);
    }

    if (overview !== undefined) product.overview = overview;
    if (curriculum !== undefined) {
      product.curriculum = JSON.parse(curriculum);
    }

    if (req.files?.file?.[0]) product.fileUrl = req.files.file[0].path;
    if (req.files?.featuredImage?.[0])
      product.featuredImageUrl = req.files.featuredImage[0].path;

    await product.save();
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ msg: "Product not found" });
    res.json({ msg: "Product deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Keep your existing updateProgress if needed
exports.updateProgress = async (req, res) => {
  // ... your existing implementation ...
};
