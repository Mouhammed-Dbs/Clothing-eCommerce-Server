const express = require("express");

const {
  addProductToCart,
  getLoggedUserCart,
  removeSpecificCartItem,
  clearCart,
  updateCartItemQuantity,
  applyCoupon,
} = require("../services/cartService");

const {
  addProductToCartValidator,
  getLoggedUserCartValidator,
  removeSpecificCartItemValidator,
  clearCartValidator,
  updateCartItemQuantityValidator,
  applyCouponValidator,
} = require("../utils/validators/cartValidator");

const authService = require("../services/authService");

const router = express.Router();

router.use(authService.protect, authService.allowedTo("user"));

router
  .route("/")
  .post(addProductToCartValidator, addProductToCart)
  .get(getLoggedUserCartValidator, getLoggedUserCart)
  .delete(clearCartValidator, clearCart);

router.put("/applyCoupon", applyCouponValidator, applyCoupon);

router
  .route("/:itemId")
  .put(updateCartItemQuantityValidator, updateCartItemQuantity)
  .delete(removeSpecificCartItemValidator, removeSpecificCartItem);

module.exports = router;
