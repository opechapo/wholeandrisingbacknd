const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: {
    type: String,
    enum: ["ebooks", "workbooks", "conversation", "courses"],
    required: true,
  },
  fileUrl: { type: String },
  enrollments: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  progress: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      progress: { type: Number, default: 0 },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Product", productSchema);
