# Secure System Development: Security Implementation Report
## for SkillsCatch: Career AI Roadmap Generator (Web-Based)

---

**In Partial Fulfillment of the Requirements for the Course**
**INTE 302 - Information Assurance and Security 1**

---

**Course Instructor:** Mr. Cristian O. Balatbat, MIT
**Submitted By:** Mark Paulo Carillo
**Date Submitted:** June 13, 2026

---

## 1. System Overview

### 1.1 System Description

SkillsCatch is a web-based Career AI Roadmap Generator that helps IT students and professionals identify their skills, discover career paths, and generate personalized learning roadmaps using artificial intelligence. Users upload their resume, the system extracts skills using AI, and generates a week-by-week roadmap with curated learning resources for their target IT role.

### 1.2 Target Users

- **Regular Users (Students/Professionals)** — Upload resumes, receive AI-generated career roadmaps, track progress, browse real-time job listings and industry news.
- **Administrators** — Manage user accounts, view audit logs, promote/demote user roles, and monitor system security events.

### 1.3 Basic Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   CLIENT (React + Vite)                   │
│                                                           │
│  LoginPage ──→ ProtectedRoute ──→ Dashboard              │
│       │              │                │                   │
│  Email/Password  JWT Session     AdminRoute ──→ Admin    │
│  OAuth (Google)  Validation      Role Check              │
│  MFA (TOTP)     Auth Listener                            │
│       │                                                   │
│  Input Sanitization ──→ aiService.js ──→ Edge Function   │
└───────────────────────────┬───────────────────────────────┘
                            │ HTTPS (TLS 1.3)
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   SUPABASE BACKEND                        │
│                                                           │
│  Auth Service ──→ bcrypt password hashing                │
│                   JWT token issuance                      │
│                   MFA (TOTP) verification                 │
│                   Rate limiting (429)                     │
│                                                           │
│  PostgreSQL DB ──→ Row Level Security (RLS) policies     │
│                   profiles (id, role, target_role)        │
│                   audit_logs (user_id, action, timestamp) │
│                   roadmaps, task_progress                 │
│                                                           │
│  Edge Functions ──→ OpenAI API (server-side secrets)     │
│                    Input validation                       │
│                    CORS headers                           │
│                                                           │
│  Storage ──→ avatars bucket (RLS protected, 2MB limit)   │
│  Backups ──→ Automated daily point-in-time recovery      │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Threat & Vulnerability Identification

Before development, the following threats and vulnerabilities were identified:

| Threat | Possible Vulnerability | Impact on System |
|--------|----------------------|------------------|
| **Unauthorized Access** | Weak password authentication, no multi-factor verification | Data breach — attackers can access user accounts, view personal career data, and impersonate users |
| **Cross-Site Scripting (XSS)** | No input validation/sanitization on user-submitted text (resume content, job titles) | Malicious scripts injected into the system can steal session tokens, redirect users, or deface the application |
| **Privilege Escalation** | No role-based restrictions, all users have equal access | Regular users could access admin functions, delete other users' data, or modify system configurations |
| **Brute Force Attack** | No login attempt limiting, no account lockout mechanism | Attackers can repeatedly guess passwords until they gain access to user accounts |
| **Data Leakage via Error Messages** | Verbose error messages exposing database structure, API keys, or internal logic | Attackers gain knowledge of system architecture to plan targeted attacks |
| **Session Hijacking** | Improper session management, tokens that never expire | Stolen tokens grant indefinite access; no mechanism to detect or revoke compromised sessions |

**Potential Attackers:**
- External attackers attempting credential stuffing or brute force
- Malicious registered users attempting privilege escalation
- Automated bots targeting the authentication system

---

## 3. Security Implementation

### 3.1 Security Control #1: Password Hashing & Strength Enforcement

**Name of Control:** Password Hashing with bcrypt + Real-Time Strength Validation

**Threat Addressed:** Unauthorized Access, Brute Force Attack

**CIA Principle Supported:** Confidentiality

**Implementation Description:**
Passwords are never stored in plain text. When a user signs up, the password is sent over HTTPS to Supabase Auth, which hashes it using bcrypt (with salt rounds). The raw password is immediately discarded from memory. Additionally, the signup form enforces 5 password strength rules in real-time, preventing weak passwords from being created.

**Code Snippet — Password Strength Validation (LoginPage.jsx):**

```javascript
// SECURITY: Track failed attempts for UI feedback
const [failedAttempts, setFailedAttempts] = useState(0);
const MAX_ATTEMPTS = 5; // Standard lockout threshold

// --- REAL-TIME PASSWORD CHECKER ---
useEffect(() => {
  if (isLogin) return;

  const rules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  };
  
  setValidations(rules);

  const passedCount = Object.values(rules).filter(Boolean).length;
  if (password.length === 0) {
    setStrength({ label: '', color: 'bg-gray-200' });
  } else if (passedCount <= 2) {
    setStrength({ label: 'Weak', color: 'bg-red-500' });
  } else if (passedCount <= 4) {
    setStrength({ label: 'Moderate', color: 'bg-yellow-500' });
  } else {
    setStrength({ label: 'Strong', color: 'bg-green-500' });
  }
}, [password, isLogin]);
```

**Code Snippet — Secure Authentication (LoginPage.jsx):**

```javascript
// --- SIGN IN FLOW ---
const { error } = await supabase.auth.signInWithPassword({ email, password });
// Password is sent over HTTPS → Supabase hashes with bcrypt → never stored as plain text

// --- SIGN UP FLOW ---
const isFullySecure = Object.values(validations).every(Boolean);
if (!isFullySecure) {
  setMessage({ type: 'error', text: 'Please ensure your password meets all security requirements.' });
  return;
}
const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
```

---

### 3.2 Security Control #2: Input Validation & XSS Prevention

**Name of Control:** Multi-Layer Input Sanitization

**Threat Addressed:** Cross-Site Scripting (XSS), SQL Injection

**CIA Principle Supported:** Integrity

**Implementation Description:**
All user inputs are sanitized at two layers: (1) Client-side sanitization strips HTML tags and restricts characters before data is sent to the backend, preventing XSS attacks. (2) Server-side validation in the Edge Function checks data types, required fields, and rejects malformed requests, preventing injection attacks.

**Code Snippet — Client-Side Sanitization (aiService.js):**

```javascript
// SECURITY: Input Sanitization function
const sanitizeInput = (text) => {
  if (!text) return "";
  return text
    .replace(/<[^>]*>?/gm, '') // Strips out HTML tags (XSS prevention)
    .replace(/[^\w\s,.?!\-+#&]/gi, '') // Keeps alphanumeric + basic punctuation/IT symbols
    .trim();
};

export const analyzeResumeWithAI = async (textData, mode = "SKILLS_ONLY", targetJob = "") => {
  // SECURITY: Sanitize inputs before sending to backend
  const cleanTextData = sanitizeInput(textData);
  const cleanTargetJob = sanitizeInput(targetJob);

  const { data, error } = await supabase.functions.invoke('generate-roadmap', {
    body: { textData: cleanTextData, mode: mode, targetJob: cleanTargetJob }
  });
};
```

**Code Snippet — Server-Side Validation (generate-roadmap/index.ts):**

```typescript
// 1b. Input validation
if (!textData || typeof textData !== 'string' || textData.trim().length === 0) {
  return new Response(JSON.stringify({ error: 'INVALID_INPUT', message: 'Resume text data is required.' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 400,
  })
}

if (mode !== 'SKILLS_ONLY' && (!targetJob || typeof targetJob !== 'string' || targetJob.trim().length === 0)) {
  return new Response(JSON.stringify({ error: 'INVALID_INPUT', message: 'Target job title is required.' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 400,
  })
}
```

---

### 3.3 Security Control #3: Role-Based Access Control (RBAC)

**Name of Control:** Role-Based Access Control with Row Level Security

**Threat Addressed:** Privilege Escalation, Unauthorized Data Modification

**CIA Principle Supported:** Confidentiality & Integrity

**Implementation Description:**
Users are assigned roles ("user" or "admin") stored in the database. The system enforces access at three levels: (1) Frontend routing blocks non-admins from accessing the admin panel, (2) PostgreSQL Row Level Security policies ensure users can only read/write their own data, and (3) A security-definer function safely checks admin status without recursive policy evaluation.

**Code Snippet — Admin Route Protection (AdminRoute.jsx):**

```javascript
export default function AdminRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      setIsAdmin(profile?.role === 'admin');
      setLoading(false);
    };
    checkAdmin();
  }, []);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}
```

**Code Snippet — Database Row Level Security (admin-setup.sql):**

```sql
-- Helper function (SECURITY DEFINER bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Users can ONLY read their own profile
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can read ALL profiles
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());
```

---

### 3.4 Security Control #4: Login Lockout & Rate Limiting

**Name of Control:** Progressive Login Lockout System

**Threat Addressed:** Brute Force Attack

**CIA Principle Supported:** Availability & Confidentiality

**Implementation Description:**
The system implements a client-side lockout after 5 failed login attempts, disabling the login form entirely and showing a warning message. Additionally, Supabase enforces server-side rate limiting (HTTP 429), blocking excessive requests at the infrastructure level. This two-layer approach protects against both automated and manual brute force attacks.

**Code Snippet — Lockout Logic (LoginPage.jsx):**

```javascript
const MAX_ATTEMPTS = 5; // Standard lockout threshold

// On each failed login:
if (isLogin) {
  const newAttempts = failedAttempts + 1;
  setFailedAttempts(newAttempts);
  setPassword(''); // Clear password field

  if (error.status === 429 || error.message.toLowerCase().includes("rate limit")) {
    friendlyMessage = "Account temporarily locked due to too many invalid attempts. Please try again in 30 minutes.";
  } else if (error.message.includes("Invalid login credentials")) {
    const attemptsLeft = MAX_ATTEMPTS - newAttempts;
    if (attemptsLeft > 0) {
      friendlyMessage = `Incorrect email or password. You have ${attemptsLeft} attempts remaining before lockout.`;
    } else {
      friendlyMessage = "Maximum attempts reached. Account locked. Please try again later.";
    }
  }
}

// Form inputs disabled when locked out:
<input disabled={loading || (isLogin && failedAttempts >= MAX_ATTEMPTS)} />
<button disabled={loading || (isLogin && failedAttempts >= MAX_ATTEMPTS)} />
```

---

### 3.5 Security Control #5: Audit Logging & Activity Monitoring

**Name of Control:** Security Event Audit Trail

**Threat Addressed:** Unauthorized Access (detection), Data Leakage (forensics)

**CIA Principle Supported:** Integrity & Availability

**Implementation Description:**
Every security-relevant action is logged to an `audit_logs` table in the database, creating an immutable trail for forensic investigation. Logged events include: login success, login failure, logout, account signup, password reset requests, data exports, account deletions, and admin actions. The admin dashboard provides a filterable view of all audit events.

**Code Snippet — Audit Logger (logger.js):**

```javascript
import { supabase } from './supabaseClient';

export const logActivity = async (action, metadata = {}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: action,
      metadata: metadata
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
};

// For login events where session may not be fully set yet
export const logActivityForUser = async (userId, action, metadata = {}) => {
  try {
    if (!userId) return;
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: action,
      metadata: metadata
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
};
```

**Code Snippet — Usage Examples:**

```javascript
// Login success (LoginPage.jsx)
logActivityForUser(loggedInUser?.id, 'Login Success', { method: 'email' });

// Logout (Dashboard.jsx)
logActivity('Logout');

// Data export (SettingsPage.jsx)
logActivity('Data Export', { format: 'json' });

// Admin action (AdminDashboard.jsx)
logActivity(`Admin deleted user: ${userEmail}`);
```

---

### 3.6 Security Control #6: Session Management & Protected Routes

**Name of Control:** JWT Session Management with Real-Time Monitoring

**Threat Addressed:** Session Hijacking

**CIA Principle Supported:** Confidentiality & Availability

**Implementation Description:**
The system uses JWT (JSON Web Tokens) for session management. Access tokens are short-lived (~1 hour) and automatically refreshed. A real-time authentication listener detects when a session is invalidated (logout from another tab, token expiry) and immediately redirects the user to the login page, preventing unauthorized access with stale tokens.

**Code Snippet — Protected Route with Session Listener (ProtectedRoute.jsx):**

```javascript
const ProtectedRoute = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Initial session check
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthenticated(!!session);
    };
    checkUser();

    // Real-time session listener — handles token expiry, sign out from another tab
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setAuthenticated(false);
        navigate('/', { replace: true }); // Immediate redirect
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!authenticated) return <Navigate to="/" replace />;
  return children;
};
```

---

### 3.7 Security Control #7: Error Message Sanitization

**Name of Control:** Generic Error Responses (Information Hiding)

**Threat Addressed:** Data Leakage via Error Messages

**CIA Principle Supported:** Confidentiality

**Implementation Description:**
All user-facing error messages are generic and do not expose internal system details (database names, API keys, architecture information, or policy names). Detailed error information is only logged to the browser console for developer debugging, never shown to end users. The password reset flow uses anti-enumeration messaging — showing the same success message regardless of whether the email exists.

**Code Snippet — Anti-Enumeration on Password Reset (LoginPage.jsx):**

```javascript
// SECURITY: Anti-Enumeration Message
// Shows same message whether email exists or not — prevents attackers from discovering valid emails
try {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/update-password`,
  });
  if (error) throw error;
  setMessage({ type: 'success', text: 'If an account exists, a reset link has been sent.' });
} catch (error) {
  // Even on error, show the SAME message to confuse attackers
  setMessage({ type: 'success', text: 'If an account exists, a reset link has been sent.' });
}
```

**Code Snippet — Generic Error Messages (SettingsPage.jsx):**

```javascript
} catch (err) {
  console.error(err); // Detailed error only in console (not visible to users)
  if (err?.status === 500) {
    alert('Email service temporarily unavailable. Please try again in a few minutes.');
  } else if (err?.status === 429) {
    alert('Too many requests. Please wait a few minutes before trying again.');
  } else {
    alert('Failed to send reset link. Please try again later.');
  }
}
```

---

## 4. CIA Triad Application

### 4.1 Confidentiality
*How is data protected from unauthorized access?*

- **Password Hashing:** All passwords are hashed with bcrypt (with salt) server-side. Plain text passwords are never stored or logged anywhere in the system.
- **Role-Based Access Control:** Users can only access their own data. Admin features are protected at both the frontend (route guards) and backend (RLS policies) levels.
- **Row Level Security (RLS):** PostgreSQL policies enforce that database queries only return rows belonging to the authenticated user, regardless of what the frontend requests.
- **Environment Variable Isolation:** Sensitive API keys (OpenAI) are stored exclusively in server-side Edge Function environment variables, never exposed to the client browser.
- **JWT Tokens:** Short-lived access tokens (1 hour) minimize the window of exploitation if a token is compromised.
- **MFA (TOTP):** Optional two-factor authentication via Google Authenticator adds a second verification layer beyond passwords.
- **Anti-Enumeration:** Password reset responses do not reveal whether an email exists in the system.

### 4.2 Integrity
*How do you ensure data is not modified improperly?*

- **Input Sanitization:** All user inputs are sanitized client-side (HTML stripping, character whitelisting) and validated server-side (type checking, required field enforcement) before processing.
- **Server-Side Validation:** The Edge Function rejects malformed requests with structured error codes, preventing corrupted data from entering the system.
- **RLS Write Policies:** Users can only INSERT or UPDATE their own rows. Cross-user data modification is impossible at the database level.
- **Audit Logging:** An immutable audit trail records all security-relevant actions, enabling detection of unauthorized modifications.
- **Password Strength Enforcement:** The system enforces 5 validation rules on signup, ensuring users cannot create weak credentials that compromise account integrity.

### 4.3 Availability
*How do you ensure the system remains accessible?*

- **Automated Database Backups:** Supabase provides daily automated backups with point-in-time recovery, ensuring data can be restored after any incident.
- **Client-Side Caching:** Industry news (15-minute cache) and job listings (5-minute cache) reduce dependency on external APIs, keeping the application functional even when third-party services are slow.
- **Rate Limiting:** Both client-side lockout (5 attempts) and server-side rate limiting (HTTP 429) protect against brute force and denial-of-service attacks that could overwhelm the system.
- **Graceful Error Handling:** All API calls include try/catch blocks with user-friendly error messages and retry guidance, ensuring the application never crashes from unhandled errors.
- **Real-Time Session Refresh:** JWT tokens are automatically refreshed before expiry, preventing users from being unexpectedly logged out during active use.

---

## 5. Conclusion

### What I Learned

This project taught me that **security must be designed into a system from the beginning, not bolted on after development.** By identifying threats before writing code, I was able to implement layered defenses that work together:

- Password hashing protects stored credentials (Confidentiality)
- Input sanitization prevents injection attacks (Integrity)
- Role-based access stops unauthorized actions (Confidentiality + Integrity)
- Login lockout prevents brute force (Availability + Confidentiality)
- Audit logging enables forensic investigation (Integrity)
- Session management prevents token misuse (Confidentiality)
- Error sanitization prevents information leakage (Confidentiality)

The most important lesson from Information Assurance and Security is that **no single control is sufficient** — the CIA Triad requires multiple overlapping layers of protection. A hashed password means nothing if an attacker can escalate privileges through an unprotected admin route, and role-based access means nothing if error messages reveal the system's internal architecture.

### What I Would Improve in the Future

- **Server-side login attempt tracking:** Currently, the lockout counter resets on page refresh. A production system should track failed attempts in the database tied to the IP address.
- **Content Security Policy (CSP) headers:** Adding strict CSP headers would further prevent XSS by restricting which scripts can execute.
- **Automated security testing:** Integrating tools like OWASP ZAP for automated vulnerability scanning during development.
- **IP-based rate limiting:** Adding per-IP throttling at the infrastructure level (e.g., Cloudflare) for defense-in-depth against DDoS.
- **Data encryption at rest:** Encrypting sensitive fields (target roles, career preferences) in the database for additional confidentiality.

---

*End of Report*
