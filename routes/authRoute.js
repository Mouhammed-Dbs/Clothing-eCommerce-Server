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
  protect,
  isLogin,
  dashboardLogin,
  resendVerificationCode,
} = require("../services/authService");

const router = express.Router();

router.post("/signup", signupValidator, signup);
router.post("/login", loginValidator, login);
router.get("/checkLogin", protect, isLogin);
router.post("/verifyEmail", verifyEmailValidator, verifyEmail);
router.post("/resendVerificationCode", resendVerificationCode);
router.post("/forgotPassword", forgotPassword);
router.post("/verifyPassResetCode", verifyPassResetCode);
router.put("/resetPassword", resetPassword);
router.post("/dashboard-login", loginValidator, dashboardLogin);

module.exports = router;
