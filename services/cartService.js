const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");

const Product = require("../models/productModel");
const Coupon = require("../models/couponModel");
const Cart = require("../models/cartModel");

// Function to calculate the total price and total price after discount for the cart
const calcTotalCartPrice = (cart) => {
  let totalPrice = 0;
  let totalPriceAfterDiscount = 0;

  cart.cartItems.forEach((item) => {
    const itemPrice = item.price;
    const discountPrice = item.priceAfterDiscount || item.price;

    totalPrice += item.quantity * itemPrice;
    totalPriceAfterDiscount += item.quantity * discountPrice;
  });

  cart.totalCartPrice = totalPrice;
  cart.totalPriceAfterDiscount =
    totalPriceAfterDiscount !== totalPrice
      ? totalPriceAfterDiscount
      : undefined;
  return { totalPrice, totalPriceAfterDiscount };
};

// @desc    Add product to cart
// @route   POST /api/v1/cart
// @access  Private/User
exports.addProductToCart = asyncHandler(async (req, res, next) => {
  const { productId, color, size } = req.body;
  const product = await Product.findById(productId);

  if (product.quantity < 1) {
    return next(new ApiError(`Product is out of stock`, 400));
  }

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({
      user: req.user._id,
      cartItems: [
        {
          product: productId,
          color,
          size,
          price: product.price,
          priceAfterDiscount: product.priceAfterDiscount,
        },
      ],
    });
  } else {
    const productIndex = cart.cartItems.findIndex(
      (item) =>
        item.product._id.toString() === productId &&
        item.color === color &&
        item.size === size
    );

    if (productIndex > -1) {
      cart.cartItems[productIndex].quantity += 1;
    } else {
      cart.cartItems.push({
        product: productId,
        color,
        size,
        price: product.price,
        priceAfterDiscount: product.priceAfterDiscount,
      });
    }
  }

  calcTotalCartPrice(cart);
  await cart.save();

  res.status(200).json({
    status: "success",
    message: "Product added to cart successfully",
    numOfCartItems: cart.cartItems.length,
    data: cart,
  });
});

// @desc    Get logged user cart
// @route   GET /api/v1/cart
// @access  Private/User
exports.getLoggedUserCart = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    return next(
      new ApiError(`There is no cart for this user id : ${req.user._id}`, 404)
    );
  }

  res.status(200).json({
    status: "success",
    numOfCartItems: cart.cartItems.length,
    data: cart,
  });
});

// @desc    Remove specific cart item
// @route   DELETE /api/v1/cart/:itemId
// @access  Private/User
exports.removeSpecificCartItem = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    return next(
      new ApiError(`There is no cart for this user id : ${req.user._id}`, 404)
    );
  }

  const itemIndex = cart.cartItems.findIndex(
    (item) => item._id.toString() === req.params.itemId
  );

  if (itemIndex > -1) {
    cart.cartItems.splice(itemIndex, 1);
    calcTotalCartPrice(cart);
    await cart.save();

    res.status(200).json({
      status: "success",
      numOfCartItems: cart.cartItems.length,
      data: cart,
    });
  } else {
    return next(
      new ApiError(`There is no item for this id :${req.params.itemId}`, 404)
    );
  }
});

// @desc    Clear logged user cart
// @route   DELETE /api/v1/cart
// @access  Private/User
exports.clearCart = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    return next(new ApiError(`There is no cart for user ${req.user._id}`, 404));
  }

  await Cart.findOneAndDelete({ user: req.user._id });

  res.status(204).send();
});

// @desc    Update specific cart item quantity
// @route   PUT /api/v1/cart/:itemId
// @access  Private/User
exports.updateCartItemQuantity = asyncHandler(async (req, res, next) => {
  const { quantity } = req.body;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return next(new ApiError(`There is no cart for user ${req.user._id}`, 404));
  }

  const itemIndex = cart.cartItems.findIndex(
    (item) => item._id.toString() === req.params.itemId
  );

  if (itemIndex > -1) {
    cart.cartItems[itemIndex].quantity = quantity;
  } else {
    return next(
      new ApiError(`There is no item for this id :${req.params.itemId}`, 404)
    );
  }

  calcTotalCartPrice(cart);
  await cart.save();

  res.status(200).json({
    status: "success",
    numOfCartItems: cart.cartItems.length,
    data: cart,
  });
});

/// @desc    Apply coupon on logged user cart
// @route   PUT /api/v1/cart/applyCoupon
// @access  Private/User
exports.applyCoupon = asyncHandler(async (req, res, next) => {
  // 1) Get coupon based on coupon name
  const coupon = await Coupon.findOne({
    name: req.body.coupon,
    expire: { $gt: Date.now() },
  });

  if (!coupon) {
    return next(new ApiError(`Coupon is invalid or expired`));
  }

  // 2) Get logged user cart to get total cart price after discounts
  const cart = await Cart.findOne({ user: req.user._id });

  if (!cart || cart.cartItems.length === 0) {
    return next(new ApiError("No items in the cart", 400));
  }

  // Check if totalPriceAfterDiscount exists, otherwise use totalCartPrice
  const priceToApplyCoupon =
    cart.totalPriceAfterDiscount || cart.totalCartPrice;

  // 3) Calculate price after applying coupon discount
  const totalPriceAfterCoupon = (
    priceToApplyCoupon -
    (priceToApplyCoupon * coupon.discount) / 100
  ).toFixed(2); // e.g., 99.23

  // Update cart with the new discounted price
  cart.totalPriceAfterDiscount = totalPriceAfterCoupon;
  await cart.save();

  res.status(200).json({
    status: "success",
    numOfCartItems: cart.cartItems.length,
    data: cart,
  });
});
