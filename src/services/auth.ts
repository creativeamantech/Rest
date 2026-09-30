import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive'
];

const provider = new GoogleAuthProvider();
SCOPES.forEach(scope => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account'
});

const STORAGE_KEY_TOKEN = 'case_alloc_google_access_token';
const STORAGE_KEY_TOKEN_EXPIRY = 'case_alloc_google_access_token_expiry';

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize cached token from storage if still valid
try {
  const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
  const expiry = localStorage.getItem(STORAGE_KEY_TOKEN_EXPIRY);
  if (savedToken && expiry && Date.now() < Number(expiry)) {
    cachedAccessToken = savedToken;
  }
} catch {
  cachedAccessToken = null;
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Explicit Google Sign-In with popup.
 * MUST only be invoked when user intentionally clicks "Connect Google" button.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google Auth से टोकन प्राप्त नहीं हो सका।');
    }

    cachedAccessToken = credential.accessToken;
    // Save to storage with 50 minutes lifetime (tokens usually last 60 minutes)
    try {
      localStorage.setItem(STORAGE_KEY_TOKEN, cachedAccessToken);
      localStorage.setItem(STORAGE_KEY_TOKEN_EXPIRY, String(Date.now() + 50 * 60 * 1000));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    console.error('Google Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Returns access token if available without prompting.
 * Returns null if not signed in to Google. Never opens a popup.
 */
export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) {
    // Check expiry
    const expiry = localStorage.getItem(STORAGE_KEY_TOKEN_EXPIRY);
    if (expiry && Date.now() > Number(expiry)) {
      cachedAccessToken = null;
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_TOKEN_EXPIRY);
      return null;
    }
    return cachedAccessToken;
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY_TOKEN);
    const expiry = localStorage.getItem(STORAGE_KEY_TOKEN_EXPIRY);
    if (saved && expiry && Date.now() < Number(expiry)) {
      cachedAccessToken = saved;
      return cachedAccessToken;
    }
  } catch {
    // ignore
  }

  return null;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    try {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.setItem(STORAGE_KEY_TOKEN_EXPIRY, String(Date.now() + 50 * 60 * 1000));
    } catch {}
  } else {
    try {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_TOKEN_EXPIRY);
    } catch {}
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch {}
  cachedAccessToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_TOKEN_EXPIRY);
  } catch {}
};
