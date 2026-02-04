const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: {
      type: String,
      enum: ["ebooks", "workbooks", "conversation", "courses"],
      required: true,
    },
    pricingModel: {
      type: String,
      enum: ["free", "paid"],
      default: "paid",
      required: true,
    },
    fileUrl: { type: String },
    featuredImageUrl: { type: String },
    overview: { type: String },
    curriculum: [
      {
        title: { type: String, required: true },
        summary: { type: String },
        content: { type: String },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Product", productSchema);
