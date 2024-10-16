const twilio = require("twilio");

const sendSMS = async (options) => {
  // Initialize Twilio client
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  // Send SMS
  const message = await client.messages.create({
    body: options.message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: options.phone,
  });

  return message;
};

module.exports = sendSMS;
