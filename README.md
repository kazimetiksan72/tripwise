# FişGaranti

FişGaranti is a Vercel-ready React frontend and Node.js serverless API for receipt analysis and account management.

## Local web development

1. Use Node.js 22 and run `npm install`.
2. Copy `.env.example` to `.env.local`. Add the MongoDB connection string and the Apple credentials described below. `.env.local` is ignored by Git.
3. Run `npm run dev` and open the Vite URL. Vite serves the React frontend; run API functions on Vercel or with `vercel dev` for full Apple/MongoDB integration.
4. `npm run build` creates the Vercel static frontend in `dist`.

The supplied MongoDB URI has been written to the ignored local `.env.local`; configure the same `MONGODB_URI` in Vercel Project Settings → Environment Variables before deployment. The default database name is `fisgaranti`.

## Vercel setup

Import the project into Vercel. The repository root is the project root; `vercel.json` selects Vite, runs `npm run build`, publishes `dist`, and routes `/api/*` to serverless functions. Select Node.js 22.

Set these Environment Variables in Vercel (Production and Preview as needed):

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string (secret). |
| `MONGODB_DB` | Optional database name; defaults to `fisgaranti`. |
| `APPLE_CLIENT_ID` | Apple Services ID for the website. |
| `VITE_APPLE_CLIENT_ID` | Same Services ID; embedded in the public frontend to start Apple JS. |
| `VITE_APPLE_REDIRECT_URI` | Same redirect URL as `APPLE_REDIRECT_URI`; defaults to the deployment origin. |
| `APPLE_TEAM_ID` | Apple Developer Team ID. |
| `APPLE_KEY_ID` | Sign in with Apple key ID. |
| `APPLE_PRIVATE_KEY_BASE64` | Base64-encoded `.p8` private key; keep secret. |
| `APPLE_REDIRECT_URI` | Optional redirect URL, which must exactly match the Apple Services ID configuration. |
| `SESSION_SECRET` | Random secret with at least 32 characters for signed sessions. |
| `ADMIN_EMAILS` | Comma-separated, verified Apple emails allowed to view the user list. |
| `ADMIN_APPLE_SUBJECTS` | Optional comma-separated Apple subject IDs allowed to view the user list. |
| `OPENAI_API_KEY` | OpenAI API key. Kept server-side in Vercel, never included in the browser bundle. |
| `OPENAI_MODEL` | Optional model override; defaults to `gpt-6-luna`. |

Apple Developer setup is required before login works: enable Sign in with Apple for an App ID, create a Services ID, associate it with the primary App ID, add the Vercel deployment domain and exact return URL, and create a Sign in with Apple key. Configure the same Services ID as `APPLE_CLIENT_ID` and `VITE_APPLE_CLIENT_ID`; configure `APPLE_REDIRECT_URI` and `VITE_APPLE_REDIRECT_URI` to the same return URL. To make your verified Apple email an admin, add it to `ADMIN_EMAILS`; alternatively add the Apple `sub` from the MongoDB `users` collection to `ADMIN_APPLE_SUBJECTS`. Rebuild after changing `VITE_*` values because Vite embeds them in the frontend.

Encode the downloaded Apple `.p8` key for the Vercel variable without committing the file: `base64 < AuthKey_KEYID.p8 | tr -d '\n'`.

## Authentication and stored data

The browser receives an Apple authorization code. The Node API exchanges it with Apple, verifies the Apple-signed identity token, checks its audience, issuer and nonce, then upserts the user in MongoDB and issues a seven-day HttpOnly, Secure, SameSite=Lax session cookie. User records contain Apple subject, verified email flags, optional first-login name, creation time, and last-login time. Apple tokens, passwords, receipt images, and OCR data are not stored in the user collection. The admin list is paginated and checks the server-side allow-list on every request.

API routes:

- `POST /api/auth/apple` — exchange Apple authorization code, verify identity, upsert user, create session.
- `GET /api/auth/me` — current signed-in profile.
- `POST /api/auth/logout` — clear the session cookie.
- `GET /api/admin/users?page=1` — administrator-only, paginated user list.
- `POST /api/analyze-receipt` — signed-in receipt analysis using the Vercel `OPENAI_API_KEY`.

Receipt analysis is a separate, explicit user action. Images are resized in the browser, sent to the Node API, and forwarded to OpenAI with `store: false`; this setting is not a zero-retention guarantee. The user collection itself contains no receipt documents. OpenAI API usage is billed to the API account. Vercel serverless request-size limits apply; the UI caps images and payload size accordingly.
