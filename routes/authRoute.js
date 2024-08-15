const express = require("express");
const {
  signupValidator,
  loginValidator,
  verifyEmailValidator,
} = require("../utils/validators/authValidator");

const {
  signup,
  login,
  forgotPassword,
  verifyPassResetCode,
  resetPassword,
  verifyEmail,
} = require("../services/authService");

const router = express.Router();

router.post("/signup", signupValidator, signup);
router.post("/login", loginValidator, login);
router.post("/verifyEmail", verifyEmailValidator, verifyEmail);
router.post("/forgotPassword", forgotPassword);
router.post("/verifyResetCode", verifyPassResetCode);
router.put("/resetPassword", resetPassword);

module.exports = router;
