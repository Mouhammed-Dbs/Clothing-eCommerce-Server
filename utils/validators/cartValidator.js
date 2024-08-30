const { check, body } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

exports.addProductToCartValidator = [
  check("productId").isMongoId().withMessage("Invalid product id format"),
  check("color")
    .notEmpty()
    .withMessage("Color is required")
    .isString()
    .withMessage("Color must be a string"),
  check("size")
    .notEmpty()
    .withMessage("Size is required")
    .isString()
    .withMessage("Size must be a string"),
  validatorMiddleware,
];

exports.getLoggedUserCartValidator = [validatorMiddleware];

exports.removeSpecificCartItemValidator = [
  check("itemId").isMongoId().withMessage("Invalid cart item id format"),
  validatorMiddleware,
];

exports.clearCartValidator = [validatorMiddleware];

exports.updateCartItemQuantityValidator = [
  check("itemId").isMongoId().withMessage("Invalid cart item id format"),
  body("quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be a number greater than 0"),
  validatorMiddleware,
];

exports.applyCouponValidator = [
  body("coupon")
    .notEmpty()
    .withMessage("Coupon code is required")
    .isString()
    .withMessage("Coupon must be a string"),
  validatorMiddleware,
];
