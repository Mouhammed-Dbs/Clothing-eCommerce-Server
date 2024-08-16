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
} = require("../services/authService");

const router = express.Router();

router.post("/signup", signupValidator, signup);
router.post("/login", loginValidator, login);
router.get("/checkLogin", protect, isLogin);
router.post("/verifyEmail", verifyEmailValidator, verifyEmail);
router.post("/forgotPassword", forgotPassword);
router.post("/verifyResetCode", verifyPassResetCode);
router.put("/resetPassword", resetPassword);
router.post("/dashboard-login", loginValidator, dashboardLogin);

module.exports = router;
