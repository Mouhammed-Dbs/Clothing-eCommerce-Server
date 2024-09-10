const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, "Too short product title"],
      maxlength: [100, "Too long product title"],
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      minlength: [20, "Too short product description"],
    },
    quantity: {
      type: Number,
      required: [true, "Product quantity is required"],
    },
    sold: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      trim: true,
      max: [200000, "Too long product price"],
    },
    priceAfterDiscount: {
      type: Number,
    },
    discount: {
      type: Number,
      default: 0,
    },
    colors: [String],
    imageCover: {
      type: String,
      required: [true, "Product Image cover is required"],
    },
    images: [String],
    category: {
      type: mongoose.Schema.ObjectId,
      ref: "Category",
      required: [true, "Product must belong to a category"],
    },
    subcategories: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "SubCategory",
      },
    ],
    brand: {
      type: mongoose.Schema.ObjectId,
      ref: "Brand",
    },
    ratingsAverage: {
      type: Number,
      min: [1, "Rating must be above or equal 1.0"],
      max: [5, "Rating must be below or equal 5.0"],
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    sizes: {
      type: [String],
      default: ["small", "medium", "large"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for reviews
productSchema.virtual("reviews", {
  ref: "Review",
  foreignField: "product",
  localField: "_id",
});

// Middleware for populating categories and subcategories
productSchema.pre(/^find/, function (next) {
  this.populate({
    path: "subcategories",
    select: "name _id",
  }).populate({
    path: "category",
    select: "name -_id", // name without _id
  });

  next();
});

// Helper function to set image URLs
const setImageURL = (doc) => {
  if (doc.imageCover && !doc.imageCover.startsWith(process.env.BASE_URL)) {
    const imageUrl = `${process.env.BASE_URL}/products/${doc.imageCover}`;
    doc.imageCover = imageUrl;
  }
  if (doc.images) {
    const imagesList = [];
    doc.images.forEach((image) => {
      const imageUrl = `${process.env.BASE_URL}/products/${image}`;
      imagesList.push(imageUrl);
    });
    doc.images = imagesList;
  }
};

// Helper function to remove base URL from images
const removeBaseURLFromImages = (doc) => {
  if (doc.imageCover && doc.imageCover.startsWith(process.env.BASE_URL)) {
    doc.imageCover = doc.imageCover.replace(
      `${process.env.BASE_URL}/products/`,
      ""
    );
  }

  if (doc.images) {
    doc.images = doc.images.map((image) =>
      image.startsWith(process.env.BASE_URL)
        ? image.replace(`${process.env.BASE_URL}/products/`, "")
        : image
    );
  }
};

// Middleware to calculate discount percentage
// const calculateDiscount = (product) => {
//   if (product.price && product.priceAfterDiscount) {
//     product.discount =
//       ((product.price - product.priceAfterDiscount) / product.price) * 100;
//   } else {
//     product.discount = 0;
//   }
// };

// findOne, findAll and update
productSchema.post("init", (doc) => {
  setImageURL(doc);
});

// create
productSchema.post("save", (doc) => {
  setImageURL(doc);
});

// Pre-save middleware using the separate function
productSchema.pre("save", function (next) {
  removeBaseURLFromImages(this);
  // calculateDiscount(this);
  next();
});

// // Pre-update middleware to calculate discount on update
// productSchema.pre("findOneAndUpdate", function (next) {
//   const update = this.getUpdate();
//   if (update.price && update.priceAfterDiscount) {
//     update.discount =
//       ((update.price - update.priceAfterDiscount) / update.price) * 100;
//   } else {
//     update.discount = 0;
//   }
//   next();
// });

module.exports = mongoose.model("Product", productSchema);
