const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, sparse: true }, // sparse allows null for admin
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "student"], default: "student" },
  subscribed: { type: Boolean, default: false },
});

// Pre-save hook: hash password if modified (async, no 'next' needed)
userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
