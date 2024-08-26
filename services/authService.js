const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");
const sendEmail = require("../utils/sendEmail");
const createToken = require("../utils/createToken");
const User = require("../models/userModel");

// @desc    Signup
// @route   POST /api/v1/auth/signup
// @access  Public
exports.signup = asyncHandler(async (req, res, next) => {
  // 1- Create user
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
  });

  // 2- Generate 6-digit email verification code
  const verificationCode = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

  // Hash the verification code before saving to the database
  user.emailVerificationCode = crypto
    .createHash("sha256")
    .update(verificationCode)
    .digest("hex");
  user.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiration

  await user.save({ validateBeforeSave: false });

  // 3- Send verification code via email
  const message = `Hello ${user.name},\n\nYour email verification code is ${verificationCode}.\n\nThis code will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.`;

  const htmlMessage = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
    <h2 style="color: #333; text-align: center;">Welcome to Saramoda, ${user.name}!</h2>
    <p style="color: #666; font-size: 16px;">Thank you for signing up. Please verify your email address by using the following code:</p>
    <div style="text-align: center; margin: 20px 0;">
      <span style="display: inline-block; background-color: #ff5a5f; color: #fff; padding: 10px 20px; border-radius: 5px; font-size: 20px; letter-spacing: 2px;">${verificationCode}</span>
    </div>
    <p style="color: #666; font-size: 16px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
    <p style="color: #666; font-size: 16px;">Thank you,<br>The Saramoda Team</p>
  </div>
`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Email Verification Code",
      message,
      htmlMessage,
    });

    // 4- Create a JWT token
    const token = createToken(user._id);

    delete user._doc.password;

    // 5- Send response with user data and token
    res.status(200).json({
      status: "Success",
      message: "User created successfully. Please verify your email.",
      user: user,
      token,
    });
  } catch (err) {
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new ApiError(
        "There was an error sending the email. Try again later!",
        500
      )
    );
  }
});

// @desc    Login
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email }).select(
    "+password"
  );

  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return next(new ApiError("Incorrect email or password", 401));
  }
  const token = createToken(user._id);

  delete user._doc.password;

  res.status(200).json({ user: user, token });
});

exports.isLogin = asyncHandler(async (req, res) => {
  delete req.user._doc.password;
  res.status(200).json({
    status: "Success",
    message: "User is logged in",
    user: req.user,
  });
});

// @desc    Verify Email using 6-digit code
// @route   POST /api/v1/auth/verifyEmail
// @access  Public
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  // 1) Get the user by email
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ApiError("User not found", 404));
  }

  // Check if the email is already verified
  if (user.emailVerified) {
    return next(new ApiError("Email is already verified.", 400));
  }

  // 2) Check the provided code
  const hashedCode = crypto
    .createHash("sha256")
    .update(req.body.code)
    .digest("hex");

  if (
    user.emailVerificationCode !== hashedCode ||
    user.emailVerificationExpires < Date.now()
  ) {
    return next(
      new ApiError("Verification code is invalid or has expired", 400)
    );
  }

  // 3) If code is valid, mark email as verified
  user.emailVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  // 4) Send a success response
  res.status(200).json({
    status: "Success",
    message: "Email verified successfully",
  });
});

// @desc    Resend Email Verification Code
// @route   POST /api/v1/auth/resendVerificationCode
// @access  Public
exports.resendVerificationCode = asyncHandler(async (req, res, next) => {
  // 1) Get the user by email
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ApiError("User not found", 404));
  }

  // Check if the email is already verified
  if (user.emailVerified) {
    return next(new ApiError("Email is already verified.", 400));
  }

  // 2) Check if the current verification code has expired
  if (user.emailVerificationExpires > Date.now()) {
    return next(
      new ApiError("The current verification code is still valid", 400)
    );
  }

  // 3) Generate a new 6-digit email verification code
  const verificationCode = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

  // Hash the new verification code before saving to the database
  user.emailVerificationCode = crypto
    .createHash("sha256")
    .update(verificationCode)
    .digest("hex");
  user.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiration

  await user.save({ validateBeforeSave: false });

  // 4) Send the new verification code via email
  const message = `Hello ${user.name},\n\nYour new email verification code is ${verificationCode}.\n\nThis code will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.`;

  const htmlMessage = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
    <h2 style="color: #333; text-align: center;">New Verification Code</h2>
    <p style="color: #666; font-size: 16px;">Hello ${user.name},</p>
    <p style="color: #666; font-size: 16px;">Here is your new verification code:</p>
    <div style="text-align: center; margin: 20px 0;">
      <span style="display: inline-block; background-color: #ff5a5f; color: #fff; padding: 10px 20px; border-radius: 5px; font-size: 20px; letter-spacing: 2px;">${verificationCode}</span>
    </div>
    <p style="color: #666; font-size: 16px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
    <p style="color: #666; font-size: 16px;">Best regards,<br>The Saramoda Team</p>
  </div>
`;

  try {
    await sendEmail({
      email: user.email,
      subject: "New Email Verification Code",
      message,
      htmlMessage,
    });

    res.status(200).json({
      status: "Success",
      message: "New verification code sent to email.",
    });
  } catch (err) {
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new ApiError(
        "There was an error sending the email. Try again later!",
        500
      )
    );
  }
});

// @desc   make sure the user is logged in
exports.protect = asyncHandler(async (req, res, next) => {
  // 1) Check if token exists, if exists get it
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return next(
      new ApiError("You are not logged in. Please log in to get access.", 401)
    );
  }

  // 2) Verify token (if no change happens, expired token)
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

  // 3) Check if user exists
  const currentUser = await User.findById(decoded.userId);
  if (!currentUser) {
    return next(
      new ApiError("The user belonging to this token no longer exists.", 401)
    );
  }

  // 4) Check if user has changed password after token was issued
  if (currentUser.passwordChangedAt) {
    const passChangedTimestamp = parseInt(
      currentUser.passwordChangedAt.getTime() / 1000,
      10
    );
    if (passChangedTimestamp > decoded.iat) {
      return next(
        new ApiError(
          "User recently changed password. Please log in again.",
          401
        )
      );
    }
  }

  // 5) Check if email is verified
  // if (!currentUser.emailVerified) {
  //   return next(
  //     new ApiError(
  //       "Your email is not verified. Please verify your email to access this route.",
  //       403
  //     )
  //   );
  // }

  req.user = currentUser;
  next();
});

// @desc    Authorization (User Permissions)
// ["admin", "manager"]
exports.allowedTo = (...roles) =>
  asyncHandler(async (req, res, next) => {
    // 1) access roles
    // 2) access registered user (req.user.role)
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError("You are not allowed to access this route", 403)
      );
    }
    next();
  });

// @desc    Forgot password
// @route   POST /api/v1/auth/forgotPassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  // 1) Get user by email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new ApiError(`There is no user with that email ${req.body.email}`, 404)
    );
  }

  // 2) Check if a reset code already exists and is still valid
  if (
    user.passwordResetCode &&
    user.passwordResetExpires > Date.now() &&
    !user.passwordResetVerified
  ) {
    return res.status(200).json({
      status: "Success",
      message: "A reset code has already been sent. Please check your email.",
    });
  }

  // 3) If no valid reset code exists, generate a new one
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedResetCode = crypto
    .createHash("sha256")
    .update(resetCode)
    .digest("hex");

  // Save hashed password reset code into db
  user.passwordResetCode = hashedResetCode;
  // Add expiration time for password reset code (10 min)
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  user.passwordResetVerified = false;

  await user.save();

  // 4) Send the reset code via email
  const message = `Hi ${user.name},\n We received a request to reset the password on your Saramoda Account. \n ${resetCode} \n Enter this code to complete the reset. \n Thanks for helping us keep your account secure.\n The Saramoda Team`;

  const htmlMessage = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
    <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
    <p style="color: #666; font-size: 16px;">Hi ${user.name},</p>
    <p style="color: #666; font-size: 16px;">We received a request to reset your password. Use the following code to reset your password:</p>
    <div style="text-align: center; margin: 20px 0;">
      <span style="display: inline-block; background-color: #ff5a5f; color: #fff; padding: 10px 20px; border-radius: 5px; font-size: 20px; letter-spacing: 2px;">${resetCode}</span>
    </div>
    <p style="color: #666; font-size: 16px;">If you did not request this, please ignore this email.</p>
    <p style="color: #666; font-size: 16px;">Thanks for helping us keep your account secure.</p>
    <p style="color: #666; font-size: 16px;">Best regards,<br>The Saramoda Team</p>
  </div>
`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Your password reset code (valid for 10 min)",
      message,
      htmlMessage,
    });
  } catch (err) {
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    user.passwordResetVerified = undefined;
    await user.save();
    return next(new ApiError("There is an error in sending email", 500));
  }

  res
    .status(200)
    .json({ status: "Success", message: "Reset code sent to email" });
});

// @desc    Verify password reset code
// @route   POST /api/v1/auth/verifyResetCode
// @access  Public
exports.verifyPassResetCode = asyncHandler(async (req, res, next) => {
  // 1) Get user based on reset code
  const hashedResetCode = crypto
    .createHash("sha256")
    .update(req.body.resetCode)
    .digest("hex");

  const user = await User.findOne({
    passwordResetCode: hashedResetCode,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next(new ApiError("Reset code invalid or expired"));
  }

  // 2) Reset code valid
  user.passwordResetVerified = true;
  await user.save();

  res.status(200).json({
    status: "Success",
  });
});

// @desc    Reset password
// @route   POST /api/v1/auth/resetPassword
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  // 1) Get user based on email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new ApiError(`There is no user with email ${req.body.email}`, 404)
    );
  }

  // 2) Check if reset code verified
  if (!user.passwordResetVerified) {
    return next(new ApiError("Reset code not verified", 400));
  }

  // 3) Update user's password and reset related fields
  user.password = req.body.newPassword;
  user.passwordResetCode = undefined;
  user.passwordResetExpires = undefined;
  user.passwordResetVerified = undefined;

  await user.save();

  // 4) Generate JWT token
  const token = createToken(user._id);

  // 5) Prepare email content
  const subject = "Your Password Has Been Reset Successfully";

  const htmlMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #ffffff;">
      <h2 style="color: #d23669; text-align: center;">Password Reset Successful</h2>
      <p style="color: #333333; font-size: 16px;">Hi ${user.name},</p>
      <p style="color: #333333; font-size: 16px;">Your password has been successfully reset. You can now log in with your new password.</p>
      <p style="color: #333333; font-size: 16px;">If you did not request this change, please contact our support team immediately.</p>
      <p style="color: #333333; font-size: 16px;">Best regards,<br>The Saramoda Team</p>
    </div>
  `;

  const textMessage = `
    Hi ${user.name},

    Your password has been successfully reset. You can now log in with your new password.

    If you did not request this change, please contact our support team immediately.

    Best regards,
    The Saramoda Team
  `;

  // 6) Send confirmation email
  try {
    await sendEmail({
      email: user.email,
      subject,
      message: textMessage,
      htmlMessage,
    });

    // 7) Send success response
    res.status(200).json({
      status: "Success",
      message: "Password has been reset successfully",
      token,
    });
  } catch (err) {
    console.error(`Error sending email: ${err.message}`);

    // Even if email fails, we can still send a success response
    res.status(200).json({
      status: "Success",
      message:
        "Password has been reset successfully, but we couldn't send the confirmation email.",
      token,
    });
  }
});

// @desc    Admin/Manager Dashboard Login
// @route   POST /api/v1/auth/dashboard-login
// @access  Public
exports.dashboardLogin = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email }).select(
    "+password"
  );

  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return next(new ApiError("Incorrect email or password", 401));
  }

  if (!user.emailVerified) {
    return next(
      new ApiError(
        "Your email is not verified. Please verify your email to login.",
        401
      )
    );
  }

  // Check if the user role is admin or manager
  if (user.role !== "admin" && user.role !== "manager") {
    return next(
      new ApiError(
        "Access denied. You are not allowed to access the dashboard.",
        403
      )
    );
  }

  const token = createToken(user._id);

  delete user._doc.password;

  res.status(200).json({ data: user, token });
});
