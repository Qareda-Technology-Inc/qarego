import { StatusCodes } from "http-status-codes";
import CustomAPIError from "./custom-api.js";

class BadRequestError extends CustomAPIError {
  /** `details` are extra fields sent with the message (e.g. a code the app acts on). */
  constructor(message, details = null) {
    super(message);
    this.statusCode = StatusCodes.BAD_REQUEST;
    this.details = details;
  }
}

export default BadRequestError;
