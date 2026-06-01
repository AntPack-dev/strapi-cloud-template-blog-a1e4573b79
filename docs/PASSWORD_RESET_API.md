# Password Reset API

## Endpoint

```
POST /api/password/forgot
```

## Request Body

```json
{
  "email": "user@example.com",
  "lang": "es"
}
```

### Parameters

- **email** (required): User's email address
- **lang** (optional): Language for email template (`"en"` or `"es"`, defaults to `"en"`)

## Response

```json
{
  "ok": true
}
```

## Examples

### Spanish Email

```bash
curl -X POST http://localhost:1337/api/password/forgot \
  -H "Content-Type: application/json" \
  -d '{"email": "usuario@ejemplo.com", "lang": "es"}'
```

### English Email

```bash
curl -X POST http://localhost:1337/api/password/forgot \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "lang": "en"}'
```

## Environment Variables

```bash
REDIRECT_URL_FORGOT_PASSWORD=http://localhost:3000/reset-password
RESEND_EMAIL_SENDER=info@latilde.co
RESEND_API_KEY=your_resend_api_key
```

## Reset Password Endpoint

```
POST /api/password/reset
```

### Request Body

```json
{
  "token": "abc123...",
  "password": "newPassword123",
  "confirmPassword": "newPassword123"
}
```

### Response

```json
{
  "ok": true,
  "message": "Password reset successfully"
}
```

### Example

```bash
curl -X POST http://localhost:1337/api/password/reset \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123...",
    "password": "newPassword123",
    "confirmPassword": "newPassword123"
  }'
```

## Reset URL Format

The email will contain a link in this format:

```
{REDIRECT_URL_FORGOT_PASSWORD}/{lang}?token={resetPasswordToken}
```

Examples:
- Spanish: `http://localhost:3000/reset-password/es?token=abc123...`
- English: `http://localhost:3000/reset-password/en?token=abc123...`

## Complete Flow

1. User requests password reset: `POST /api/password/forgot`
2. User receives email with reset link containing token
3. User visits reset page and enters new password
4. Frontend calls: `POST /api/password/reset` with token and new password
5. Password is updated and token is cleared
