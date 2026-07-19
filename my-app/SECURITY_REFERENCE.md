# SkillsCatch — Information Security Reference
**Prepared for InfoSec Presentation | May 2026**

---

## 1. Password Hashing

### How It Works
SkillsCatch uses **Supabase Auth** which implements **bcrypt** hashing server-side. The application **never sees, stores, or processes raw passwords**.

### Flow Diagram
```
User types password
        ↓
Client sends over HTTPS (TLS 1.3)
        ↓
Supabase Auth Server receives password
        ↓
bcrypt.hash(password, salt_rounds=10)
        ↓
Hashed value stored in auth.users table
        ↓
Raw password discarded from memory
```

### Code Snippet — Client Side (LoginPage.jsx)
```javascript
// The client ONLY sends credentials over HTTPS — never hashes locally
const { error } = await supabase.auth.signInWithPassword({ email, password });
// Supabase handles bcrypt hashing on its server
// The password never exists in client state beyond this call
```

### Why bcrypt?
- **Adaptive**: Cost factor can be increased as hardware improves
- **Salted**: Each hash includes a unique random salt — no rainbow table attacks
- **Slow by design**: ~100ms per hash vs nanoseconds for MD5/SHA — brute force infeasible

---

## 2. Security Patterns Used

### A. Input Sanitization (XSS Prevention)
**File**: `src/lib/aiService.js`
```javascript
const sanitizeInput = (text) => {
  if (!text) return "";
  return text
    .replace(/<[^>]*>?/gm, '')           // Strip HTML tags
    .replace(/[^\w\s,.?!\-+#&]/gi, '')   // Allow only safe characters
    .trim();
};
```
All user input is sanitized before being sent to the AI Edge Function.

### B. Row Level Security (RLS)
**Supabase PostgreSQL policies** ensure users can only access their own data:
```sql
-- Users can only read their own profile
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can read ALL profiles
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

### C. Environment Variable Isolation
```
.env.local (NEVER committed to git)
├── VITE_SUPABASE_URL        → Public Supabase endpoint (safe, RLS-enforced)
├── VITE_SUPABASE_ANON_KEY   → Public anonymous key (safe, RLS-enforced)
└── VITE_RAPIDAPI_KEY        → Job search API key
```
- `VITE_` prefix = exposed to client (by Vite design) — but **RLS makes the anon key safe**
- Server-side secrets (OpenAI key) live in **Supabase Edge Function environment**, never in client code

### D. CORS Configuration
**File**: `supabase/functions/generate-roadmap/index.ts`
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```
Edge functions validate the `authorization` header (JWT) on every request.

### E. Anti-Enumeration (Password Reset)
**File**: `src/LoginPage.jsx`
```javascript
// SECURITY: Show same message whether email exists or not
setMessage({
  type: 'success',
  text: 'If an account exists, a reset link has been sent to your registered email.'
});
```
Prevents attackers from discovering valid email addresses.

### F. Protected Routes + Role-Based Access Control (RBAC)
```
/              → Public (LoginPage)
/dashboard     → ProtectedRoute (requires auth session)
/admin         → ProtectedRoute + AdminRoute (requires auth + role='admin')
/update-password → Public (magic link landing)
```

---

## 3. OTP / Password Reset Flow

### Complete Flow
```
1. User clicks "Forgot Password" or "Send Reset Link" (Settings)
        ↓
2. Client calls: supabase.auth.resetPasswordForEmail(email, { redirectTo })
        ↓
3. Supabase sends email via configured SMTP (Resend)
   - Email contains a one-time magic link with encrypted token
        ↓
4. User clicks link → Redirected to /update-password with token in URL hash
        ↓
5. Supabase JS client automatically picks up the token
        ↓
6. User enters new password → Client calls: supabase.auth.updateUser({ password })
        ↓
7. Supabase validates token, bcrypt-hashes new password, updates auth.users
        ↓
8. Old sessions remain valid (user can optionally sign out everywhere)
```

### Security Properties
- **Token is one-time use** — cannot be replayed
- **Token expires** after configured duration (default: 1 hour)
- **HTTPS only** — token never transmitted in plaintext
- **Anti-enumeration** — same response whether email exists or not

---

## 4. Security Controls

### A. Session Management (JWT)
- Supabase uses **JSON Web Tokens (JWT)** for session management
- Access token: short-lived (~1 hour), auto-refreshed by Supabase JS client
- Refresh token: longer-lived, stored in `localStorage` by Supabase SDK
- `ProtectedRoute.jsx` listens for `SIGNED_OUT` events in real-time

```javascript
// Real-time session listener
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    navigate('/', { replace: true }); // Immediate redirect
  }
});
```

### B. Authentication Methods
| Method | Implementation |
|--------|---------------|
| Email/Password | `supabase.auth.signInWithPassword()` + bcrypt |
| Google OAuth | `supabase.auth.signInWithOAuth({ provider: 'google' })` |
| GitHub OAuth | `supabase.auth.signInWithOAuth({ provider: 'github' })` |
| MFA (TOTP) | `supabase.auth.mfa.enroll()` + `mfa.challenge()` + `mfa.verify()` |

### C. Multi-Factor Authentication (MFA/Google Authenticator)
**Files**: `src/MfaEnrollModal.jsx`, `src/MfaVerifyModal.jsx`

**Enrollment Flow**:
```javascript
// 1. Generate TOTP secret + QR code
const { data } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
// data.totp.qr_code → displayed to user
// data.totp.secret → manual entry backup

// 2. User scans QR with authenticator app

// 3. Verify with 6-digit code
await supabase.auth.mfa.challenge({ factorId });
await supabase.auth.mfa.verify({ factorId, challengeId, code });
```

**Login with MFA**:
```javascript
// After password login, check if MFA is required
const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
if (aalData.nextLevel === 'aal2') {
  // Show MFA code input modal
}
```

### D. Activity / Audit Logging
**Table**: `audit_logs` (user_id, action, metadata, created_at)

| Event | Where Logged |
|-------|-------------|
| Login Success | `LoginPage.jsx` |
| Login Failure | `LoginPage.jsx` (console) |
| Account Signup | `LoginPage.jsx` |
| Logout | `Dashboard.jsx` |
| Roadmap Generated | `Dashboard.jsx` |
| MFA Enrollment | `Dashboard.jsx` |
| Password Reset Request | `SettingsPage.jsx` |
| Data Export | `SettingsPage.jsx` |
| Account Deletion | `SettingsPage.jsx` |
| Admin Actions | `AdminDashboard.jsx` |

### E. Login Lockout System
**File**: `src/LoginPage.jsx`
```javascript
const MAX_ATTEMPTS = 5;

// On each failed login:
const newAttempts = failedAttempts + 1;
setFailedAttempts(newAttempts);

// Progressive warnings:
if (attemptsLeft > 0) {
  `You have ${attemptsLeft} attempts remaining before lockout.`
} else {
  "Maximum attempts reached. Account locked."
}

// Form inputs disabled when maxed out:
disabled={loading || (isLogin && failedAttempts >= MAX_ATTEMPTS)}
```

Additionally, Supabase enforces **server-side rate limiting** (HTTP 429) after excessive requests.

---

## 5. CIA Triad — Mapped to SkillsCatch

### Confidentiality 🔒
*Ensuring data is only accessible to authorized parties*

| Control | Implementation |
|---------|---------------|
| Password Hashing | bcrypt with salting (Supabase Auth) |
| Transport Security | HTTPS/TLS for all API calls |
| Environment Variables | API keys in `.env.local`, not in source code |
| Row Level Security | PostgreSQL RLS — users only see their own data |
| JWT Tokens | Short-lived access tokens, auto-refresh |
| Role-Based Access | Admin-only routes and RLS policies |
| MFA | TOTP-based second factor via authenticator apps |

### Integrity ✅
*Ensuring data is accurate and unmodified*

| Control | Implementation |
|---------|---------------|
| Input Sanitization | HTML stripping + character whitelist before AI calls |
| Server-Side Validation | Edge Function validates all inputs before processing |
| RLS Write Policies | Users can only insert/update their own rows |
| Audit Logging | Immutable `audit_logs` table tracks all security events |
| Password Validation | Client-side strength meter + 5-rule enforcement on signup |

### Availability ⚡
*Ensuring systems are accessible when needed*

| Control | Implementation |
|---------|---------------|
| Managed Infrastructure | Supabase handles DB, Auth, Storage availability |
| Client-Side Caching | News (15min), Jobs (5min) cached to reduce API calls |
| Error Handling | Retry mechanisms, graceful degradation, skeleton loaders |
| Rate Limiting | Supabase built-in rate limits protect against abuse |
| Login Lockout | Prevents brute-force from consuming server resources |

---

## 6. Demo Talking Points

### User Management
- Show **Admin Dashboard** (`/admin`): users table, audit logs, role management
- Demonstrate that non-admin users are **redirected away** from `/admin`
- Show RLS in action: admin sees all rows, regular user sees only their own

### Database Security
- Open Supabase Dashboard → Authentication → show users list
- Show `profiles` table with `role` column
- Show `audit_logs` table with logged events
- Demonstrate RLS policies in SQL editor

### Sensitive Data Handling
- **Passwords**: Never stored client-side, bcrypt hashed server-side
- **JWT Tokens**: Managed by Supabase SDK, auto-refreshed, stored in localStorage
- **Anon Key**: Publicly visible but safe — RLS enforces all access control
- **Server Secrets**: OpenAI API key lives only in Edge Function environment, never in client bundle

### Forgot Password Demo
1. Click "Forgot Password" on login page
2. Enter email → show anti-enumeration message
3. Check email → click magic link
4. Redirected to `/update-password` → enter new password
5. Password bcrypt-hashed and saved

### MFA Demo
1. Go to Settings → My Profile → "Enable Two-Factor Auth"
2. QR code generated → scan with Google Authenticator
3. Enter 6-digit code → MFA verified and enabled
4. Log out → Log back in → MFA challenge screen appears
5. Enter code from authenticator app → access granted

### Admin Panel Demo
1. Show sidebar "Admin Panel" link (only visible to admin users)
2. Navigate to `/admin` → Users tab shows all registered users
3. Audit Logs tab → show all security events with timestamps
4. Demonstrate role toggle (promote/demote user)
5. Show that deleting a user logs the admin action

---

## 7. Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (React)                     │
│                                                       │
│  LoginPage ──→ ProtectedRoute ──→ Dashboard          │
│       │              │                │               │
│  Email/Password  Session Check   AdminRoute ──→ Admin │
│  OAuth (Google)  JWT Validation  Role Check           │
│  MFA Challenge   Auth Listener                        │
│       │                                               │
│  Input Sanitization ──→ aiService.js                 │
└──────────────────┬────────────────────────────────────┘
                   │ HTTPS (TLS 1.3)
                   ▼
┌─────────────────────────────────────────────────────┐
│               SUPABASE BACKEND                       │
│                                                       │
│  Auth Service ──→ bcrypt hashing                     │
│       │          JWT issuance                         │
│       │          MFA (TOTP)                           │
│       │          Rate limiting                        │
│       │                                               │
│  PostgreSQL ──→ RLS Policies                         │
│       │        profiles (role, avatar_url)            │
│       │        audit_logs (user_id, action)           │
│       │        roadmaps, task_progress               │
│       │                                               │
│  Edge Functions ──→ OpenAI API (server-side only)    │
│       │            Input validation                   │
│       │            CORS headers                       │
│       │                                               │
│  Storage ──→ avatars bucket (RLS protected)          │
│              2MB limit per file                       │
└─────────────────────────────────────────────────────┘
```
