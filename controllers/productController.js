const Product = require("../models/Product");
const ImageKit = require("imagekit");

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Get all products (public - anyone can see)
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("Get products error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Create new product (admin only)
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

    let fileUrl = null;
    let featuredImageUrl = null;

    // Upload main file (PDF, ZIP, video, etc.) if provided
    if (req.files?.file?.[0]) {
      const file = req.files.file[0];
      const uploadResponse = await imagekit.upload({
        file: file.buffer.toString("base64"),
        fileName: file.originalname,
        folder: "/products/files",
      });
      fileUrl = uploadResponse.url;
    }

    // Upload featured image (thumbnail) if provided
    if (req.files?.featuredImage?.[0]) {
      const featuredImage = req.files.featuredImage[0];
      const uploadResponse = await imagekit.upload({
        file: featuredImage.buffer.toString("base64"),
        fileName: featuredImage.originalname,
        folder: "/products/images",
      });
      featuredImageUrl = uploadResponse.url;
    }

    let parsedCurriculum = [];
    if (curriculum) {
      try {
        parsedCurriculum = JSON.parse(curriculum);
      } catch (e) {
        console.error("Curriculum parse error:", e);
      }
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
    console.error("Add product error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// Update existing product (admin only)
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ msg: "Product not found" });
    }

    const {
      title,
      description,
      price,
      category,
      pricingModel,
      overview,
      curriculum,
    } = req.body;

    // Update fields only if provided
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
      try {
        product.curriculum = JSON.parse(curriculum);
      } catch (e) {
        console.error("Curriculum parse error on update:", e);
      }
    }

    // Replace main file if new one uploaded
    if (req.files?.file?.[0]) {
      const file = req.files.file[0];
      const uploadResponse = await imagekit.upload({
        file: file.buffer.toString("base64"),
        fileName: file.originalname,
        folder: "/products/files",
      });
      product.fileUrl = uploadResponse.url;
    }

    // Replace featured image if new one uploaded
    if (req.files?.featuredImage?.[0]) {
      const featuredImage = req.files.featuredImage[0];
      const uploadResponse = await imagekit.upload({
        file: featuredImage.buffer.toString("base64"),
        fileName: featuredImage.originalname,
        folder: "/products/images",
      });
      product.featuredImageUrl = uploadResponse.url;
    }

    await product.save();
    res.json(product);
  } catch (err) {
    console.error("Update product error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// Delete product (admin only)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ msg: "Product not found" });
    }

    // Optional: Delete files from ImageKit if they exist
    if (product.fileUrl) {
      try {
        // Extract file path from URL (ImageKit path)
        const filePath = product.fileUrl.split(imagekit.config.urlEndpoint)[1];
        await imagekit.deleteFile(filePath);
      } catch (deleteErr) {
        console.warn("Failed to delete main file from ImageKit:", deleteErr);
        // Don't fail the whole delete if ImageKit delete fails
      }
    }

    if (product.featuredImageUrl) {
      try {
        const imagePath = product.featuredImageUrl.split(
          imagekit.config.urlEndpoint,
        )[1];
        await imagekit.deleteFile(imagePath);
      } catch (deleteErr) {
        console.warn(
          "Failed to delete featured image from ImageKit:",
          deleteErr,
        );
      }
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ msg: "Product deleted successfully" });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// Optional: Progress update route (if you still need it)
// You can expand this later if students track progress
exports.updateProgress = async (req, res) => {
  try {
    const { productId, progress } = req.body;
    const userId = req.user.id; // from authMiddleware

    // Example: you could have a separate Progress model
    // For now, just return success
    res.json({ msg: "Progress updated", productId, progress, userId });
  } catch (err) {
    console.error("Update progress error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};
