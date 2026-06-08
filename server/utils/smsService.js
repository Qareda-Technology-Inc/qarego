import axios from "axios";

/**
 * Arkasel SMS Service
 * Sends SMS messages via Arkasel API
 * Documentation: https://arkesel.com/developer-api/
 */

/**
 * Send SMS via Arkasel
 * @param {string} phone - Phone number in international format (e.g., +233501234567)
 * @param {string} message - Message content
 * @returns {Promise<Object>} - Response from Arkasel API
 */
export const sendSMS = async (phone, message) => {
  try {
    // Get Arkasel credentials from environment variables
    const apiKey = process.env.ARKASEL_API_KEY;
    const apiSecret = process.env.ARKASEL_API_SECRET;
    const senderId = process.env.ARKASEL_SENDER_ID || "QareGO";
    const apiUrl = process.env.ARKASEL_API_URL || "https://api.arkasel.com/api/v1/sms/send";

    if (!apiKey) {
      console.error("Arkasel API key not configured. Please set ARKASEL_API_KEY in .env");
      
      // In development, log but don't fail
      if (process.env.NODE_ENV === "development") {
        console.log(`[DEV MODE] SMS would be sent to ${phone}: ${message}`);
        return {
          success: true,
          development: true,
          message: "SMS not sent (development mode - credentials not configured)",
        };
      }
      
      throw new Error("SMS service not configured");
    }

    // Format phone number (remove + if present, ensure it starts with country code)
    const formattedPhone = phone.replace(/^\+/, "");

    // Arkasel API typically uses one of these formats:
    // Format 1: POST with API key in headers
    // Format 2: POST with Basic auth (apiKey:apiSecret)
    // Format 3: GET with query parameters

    // Using Format 1 (most common for modern APIs)
    const payload = {
      sender: senderId,
      message: message,
      recipients: [formattedPhone], // Array format
      // Alternative single recipient format:
      // to: formattedPhone,
      // from: senderId,
    };

    const headers = {
      "Content-Type": "application/json",
    };

    // Add authentication based on Arkasel's requirements
    if (apiSecret) {
      // Basic auth: apiKey:apiSecret
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    } else {
      // API key in header
      headers["api-key"] = apiKey;
      // Or: headers["X-API-Key"] = apiKey;
      // Or: headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await axios.post(apiUrl, payload, { headers });

    console.log(`SMS sent successfully to ${phone} via Arkasel:`, response.data);
    
    return {
      success: true,
      messageId: response.data?.data?.messageId || response.data?.messageId || response.data?.id,
      data: response.data,
    };
  } catch (error) {
    console.error("Error sending SMS via Arkasel:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    
    // If in development, log the error but don't fail
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV MODE] SMS failed but continuing: ${error.message}`);
      return {
        success: false,
        error: error.message,
        development: true,
      };
    }

    throw new Error(
      `Failed to send SMS: ${error.response?.data?.message || error.message}`
    );
  }
};

/**
 * Send OTP SMS via Arkasel
 * @param {string} phone - Phone number in international format
 * @param {string} otp - 4-digit OTP code
 * @returns {Promise<Object>} - Response from Arkasel API
 */
export const sendOtpSMS = async (phone, otp) => {
  const message = `Your QareGO verification code is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;
  
  return await sendSMS(phone, message);
};

/**
 * Alternative Arkasel integration using GET with query parameters
 * Uncomment and use if your Arkasel account requires this format
 */
/*
export const sendSMSGet = async (phone, message) => {
  try {
    const apiKey = process.env.ARKASEL_API_KEY;
    const apiSecret = process.env.ARKASEL_API_SECRET;
    const senderId = process.env.ARKASEL_SENDER_ID || "QareGO";
    const apiUrl = process.env.ARKASEL_API_URL || "https://api.arkasel.com/api/v1/sms/send";

    const formattedPhone = phone.replace(/^\+/, "");

    // Using GET with query parameters
    const response = await axios.get(apiUrl, {
      params: {
        api_key: apiKey,
        api_secret: apiSecret,
        to: formattedPhone,
        message: message,
        from: senderId,
      },
    });

    console.log(`SMS sent successfully to ${phone}:`, response.data);
    return {
      success: true,
      messageId: response.data?.messageId || response.data?.id,
      data: response.data,
    };
  } catch (error) {
    console.error("Error sending SMS via Arkasel:", error.response?.data || error.message);
    throw new Error(`Failed to send SMS: ${error.response?.data?.message || error.message}`);
  }
};
*/
