const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    cartItems: [
      {
        product: {
          type: mongoose.Schema.ObjectId,
          ref: "Product",
        },
        quantity: {
          type: Number,
          default: 1,
        },
        color: String,
        size: String,
        price: Number,
        priceAfterDiscount: Number,
      },
    ],
    totalCartPrice: Number,
    totalPriceAfterDiscount: Number,
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Middleware to populate product details
cartSchema.pre(/^find/, function (next) {
  this.populate({
    path: "cartItems.product",
    select: "_id title imageCover -subcategories -category",
    model: "Product",
  });
  next();
});

module.exports = mongoose.model("Cart", cartSchema);
