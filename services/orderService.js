const stripe = require("stripe")(process.env.STRIPE_SECRET);
const asyncHandler = require("express-async-handler");
const factory = require("./handlersFactory");
const ApiError = require("../utils/apiError");

const User = require("../models/userModel");
const Product = require("../models/productModel");
const Cart = require("../models/cartModel");
const Order = require("../models/orderModel");

// @desc    create cash order
// @route   POST /api/v1/orders/cartId
// @access  Protected/User
exports.createCashOrder = asyncHandler(async (req, res, next) => {
  // 1) Get cart depend on cartId
  const cart = await Cart.findById(req.params.cartId);
  if (!cart) {
    return next(
      new ApiError(`There is no such cart with id ${req.params.cartId}`, 404)
    );
  }

  // 2) Ensure that shipping method is provided
  if (!req.body.shippingMethod) {
    return next(new ApiError("Shipping method is required", 400));
  }

  // 3) Get order price depend on cart price "Check if coupon apply"
  const cartPrice = cart.totalPriceAfterDiscount
    ? cart.totalPriceAfterDiscount
    : cart.totalCartPrice;

  // 4) Calculate shipping price based on total cart price
  let shippingPrice = 0;
  if (req.body.shippingMethod === "Express") {
    shippingPrice = 30;
  } else if (req.body.shippingMethod === "Overnight") {
    shippingPrice = 15;
  } else if (req.body.shippingMethod === "Priority") {
    shippingPrice = cartPrice > 100 ? 0 : 5;
  }

  // Calculate tax price
  const taxPrice = (cartPrice * 6) / 100;

  // Calculate total order price
  const totalOrderPrice = cartPrice + taxPrice + shippingPrice;

  // 5) Create order with default paymentMethodType cash
  const order = await Order.create({
    user: req.user._id,
    cartItems: cart.cartItems,
    shippingAddress: req.body.shippingAddress,
    shippingPrice, // Save shipping price in the order
    totalOrderPrice,
  });

  // 6) After creating order, decrement product quantity, increment product sold
  if (order) {
    const bulkOption = cart.cartItems.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantity: -item.quantity, sold: +item.quantity } },
      },
    }));
    await Product.bulkWrite(bulkOption, {});

    // 7) Clear cart depend on cartId
    await Cart.findByIdAndDelete(req.params.cartId);
  }

  res.status(201).json({ status: "success", data: order });
});

exports.filterOrderForLoggedUser = asyncHandler(async (req, res, next) => {
  if (req.user.role === "user") req.filterObj = { user: req.user._id };
  next();
});
// @desc    Get all orders
// @route   POST /api/v1/orders
// @access  Protected/User-Admin-Manager
exports.findAllOrders = factory.getAll(Order);

// @desc    Get all orders
// @route   POST /api/v1/orders
// @access  Protected/User-Admin-Manager
exports.findSpecificOrder = factory.getOne(Order);

// @desc    Update order paid status to paid
// @route   PUT /api/v1/orders/:id/pay
// @access  Protected/Admin-Manager
exports.updateOrderToPaid = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(
      new ApiError(
        `There is no such a order with this id:${req.params.id}`,
        404
      )
    );
  }

  // update order to paid
  order.isPaid = true;
  order.paidAt = Date.now();

  const updatedOrder = await order.save();

  res.status(200).json({ status: "success", data: updatedOrder });
});

// @desc    Update order delivered status
// @route   PUT /api/v1/orders/:id/deliver
// @access  Protected/Admin-Manager
exports.updateOrderToDelivered = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(
      new ApiError(
        `There is no such a order with this id:${req.params.id}`,
        404
      )
    );
  }

  // update order to paid
  order.isDelivered = true;
  order.deliveredAt = Date.now();

  const updatedOrder = await order.save();

  res.status(200).json({ status: "success", data: updatedOrder });
});

// @desc    Get checkout session from stripe and send it as response
// @route   GET /api/v1/orders/checkout-session/:cartId
// @access  Protected/User
// @desc    Get checkout session from stripe and send it as response
// @route   GET /api/v1/orders/checkout-session/:cartId
// @access  Protected/User
exports.checkoutSession = asyncHandler(async (req, res, next) => {
  // 1) Get cart depend on cartId
  const cart = await Cart.findById(req.params.cartId);
  if (!cart) {
    return next(
      new ApiError(`There is no such cart with id ${req.params.cartId}`, 404)
    );
  }

  // 2) Ensure that shipping method is provided
  if (!req.query.shippingMethod) {
    return next(new ApiError("Shipping method is required", 400));
  }

  // 3) Get order price depend on cart price "Check if coupon apply"
  const cartPrice = cart.totalPriceAfterDiscount
    ? cart.totalPriceAfterDiscount
    : cart.totalCartPrice;

  // 4) Calculate shipping price based on total cart price
  let shippingPrice = 0;
  if (req.query.shippingMethod === "Express") {
    shippingPrice = 30;
  } else if (req.query.shippingMethod === "Overnight") {
    shippingPrice = 15;
  } else if (req.query.shippingMethod === "Priority") {
    shippingPrice = cartPrice > 100 ? 0 : 5;
  }

  // Calculate tax price
  const taxPrice = (cartPrice * 6) / 100;

  // Calculate total order price
  const totalOrderPrice = cartPrice + taxPrice + shippingPrice;

  // 5) Create stripe checkout session
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: req.user.name,
          },
          unit_amount: totalOrderPrice * 100,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${req.protocol}://${req.get("host").slice(4)}/orders`,
    cancel_url: `${req.protocol}://${req.get("host").slice(4)}/cart`,
    customer_email: req.user.email,
    client_reference_id: req.params.cartId,
    metadata: {
      details: req.query.details || "",
      phone: req.query.phone || "",
      city: req.query.city || "",
      postalCode: req.query.postalCode || "",
      taxPrice: taxPrice.toString(),
      shippingPrice: shippingPrice.toString(),
    },
  });

  // 6) send session to response
  res.status(200).json({ status: "success", session });
});

const createCardOrder = async (session) => {
  const cartId = session.client_reference_id;
  const shippingAddress = session.metadata;
  const taxPrice = parseFloat(session.metadata.taxPrice);
  const shippingPrice = parseFloat(session.metadata.shippingPrice);
  const oderPrice = session.amount_total / 100;

  const cart = await Cart.findById(cartId);
  const user = await User.findOne({ email: session.customer_email });

  // 3) Create order with default paymentMethodType card
  const order = await Order.create({
    user: user._id,
    cartItems: cart.cartItems,
    shippingAddress,
    totalOrderPrice: oderPrice,
    taxPrice,
    shippingPrice,
    isPaid: true,
    paidAt: Date.now(),
    paymentMethodType: "card",
  });

  // 4) After creating order, decrement product quantity, increment product sold
  if (order) {
    const bulkOption = cart.cartItems.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantity: -item.quantity, sold: +item.quantity } },
      },
    }));
    await Product.bulkWrite(bulkOption, {});

    // 5) Clear cart depend on cartId
    await Cart.findByIdAndDelete(cartId);
  }
};

// @desc    This webhook will run when stripe payment success paid
// @route   POST /webhook-checkout
// @access  Protected/User
exports.webhookCheckout = asyncHandler(async (req, res, next) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === "checkout.session.completed") {
    //  Create order
    createCardOrder(event.data.object);
  }

  res.status(200).json({ received: true });
});
