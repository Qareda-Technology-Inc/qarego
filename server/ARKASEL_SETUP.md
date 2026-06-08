# Arkasel SMS Integration Setup

This guide will help you configure Arkasel SMS for OTP notifications in QareGO.

## Prerequisites

1. An Arkasel account (sign up at https://arkasel.com)
2. API credentials from your Arkasel dashboard
3. A verified sender ID (usually your business name)

## Configuration Steps

### 1. Get Your Arkasel Credentials

1. Log in to your Arkasel dashboard
2. Navigate to **API Settings** or **Developer** section
3. Copy your:
   - **API Key** (or API Username)
   - **API Secret** (or API Password)
   - **Sender ID** (your approved sender name)

### 2. Configure Environment Variables

Add the following to your `.env` file in the `server` directory:

```env
# Arkasel SMS Configuration
ARKASEL_API_KEY=your_api_key_here
ARKASEL_API_SECRET=your_api_secret_here
ARKASEL_SENDER_ID=QareGO
ARKASEL_API_URL=https://api.arkasel.com/api/v1/sms/send
```

**Note:** The API URL might vary based on your Arkasel account type. Check your Arkasel dashboard for the correct endpoint.

### 3. Verify API Endpoint Format

Arkasel may use different API formats. The current implementation supports:

- **POST with JSON body** (default)
- **Basic Authentication** (apiKey:apiSecret)
- **API Key in headers**

If your Arkasel account uses a different format, you may need to modify `server/utils/smsService.js`.

### 4. Test the Integration

1. Start your server:
   ```bash
   cd server
   npm start
   ```

2. Request an OTP via SMS from your app
3. Check the server logs for SMS sending status
4. Verify you receive the SMS on your phone

## API Format Variations

If the default format doesn't work, check your Arkasel documentation and update `server/utils/smsService.js`:

### Format 1: POST with Basic Auth (Current)
```javascript
headers: {
  "Authorization": `Basic ${base64(apiKey:apiSecret)}`
}
body: {
  sender: "QareGO",
  message: "...",
  recipients: ["233501234567"]
}
```

### Format 2: GET with Query Parameters
```javascript
GET /api/v1/sms/send?api_key=xxx&api_secret=yyy&to=233501234567&message=...&from=QareGO
```

### Format 3: POST with API Key Header
```javascript
headers: {
  "api-key": "your_api_key",
  "api-secret": "your_api_secret"
}
body: {
  to: "233501234567",
  message: "...",
  from: "QareGO"
}
```

## Troubleshooting

### SMS Not Sending

1. **Check credentials**: Verify your API key and secret are correct
2. **Check sender ID**: Ensure your sender ID is approved by Arkasel
3. **Check phone format**: Phone numbers should be in international format without `+` (e.g., `233501234567`)
4. **Check API endpoint**: Verify the API URL matches your Arkasel account type
5. **Check logs**: Review server console for error messages

### Development Mode

In development mode (`NODE_ENV=development`), if Arkasel credentials are not configured, the system will:
- Log the SMS message to console
- Continue without failing
- Allow OTP verification to work (OTP is still generated and stored)

### Production Mode

In production mode, ensure:
- All environment variables are set
- Sender ID is approved
- Account has sufficient credits
- Error handling is properly configured

## Testing

To test without sending actual SMS (development):

1. Leave `ARKASEL_API_KEY` empty or unset
2. The system will log SMS messages to console
3. OTP will still be generated and can be verified

## Support

- Arkasel Documentation: https://arkesel.com/developer-api/
- Arkasel Support: Contact through your dashboard

## Next Steps

After successful integration:
1. Test OTP sending and receiving
2. Monitor SMS delivery rates
3. Set up error alerts for failed SMS
4. Consider implementing SMS delivery callbacks/webhooks
5. Add rate limiting for OTP requests
