## Forgot Password / Reset Password Flow

### Overview
Add a complete password recovery flow: users can request a reset email from the login screen, click the link in their email, and set a new password on a dedicated page.

### Changes

#### 1. AuthContext — Add recovery methods
- Add `resetPassword(email)` → calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- Add `updatePassword(newPassword)` → calls `supabase.auth.updateUser({ password: newPassword })`

#### 2. AuthPage — Add "Forgot Password?" link
- Below the password field on the login form, add a small "Forgot password?" text link
- Clicking it switches the form to a "forgot password" mode (or navigates to `/forgot-password`)
- Shows an email input + "Send reset link" button
- On success, shows a confirmation toast/message

#### 3. New page: `src/pages/ResetPasswordPage.tsx`
- Public route at `/reset-password` (outside `ProtectedRoute`)
- On mount, checks the URL hash for `type=recovery` (Supabase recovery flow)
- If recovery token is present, shows a "Set new password" form with password + confirm password fields
- On submit, calls `updatePassword` and redirects to `/auth` for login
- If no recovery token, shows an error + link back to login

#### 4. App.tsx — Wire up routes
- Add `/reset-password` route outside `ProtectedRoute` (must be public)
- Keep `/auth` as the login/signup entry point

### UX Notes
- Both forgot-password and reset-password screens should match the existing AuthPage styling (rounded inputs, green theme, centered card layout)
- Clear success/error toasts on every action
- After password update, user is redirected to login

### Files modified
- `src/contexts/AuthContext.tsx`
- `src/pages/AuthPage.tsx`
- `src/App.tsx`

### Files created
- `src/pages/ResetPasswordPage.tsx`
