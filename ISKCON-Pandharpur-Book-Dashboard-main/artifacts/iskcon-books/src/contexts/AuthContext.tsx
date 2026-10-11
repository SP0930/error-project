/**
 * Authentication Context
 * 
 * Provides Firebase authentication state and methods throughout the app.
 * In development mode (no Firebase config), provides a mock authenticated user.
 */

import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  type ReactNode 
} from "react";
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth, isAuthEnabled } from "../lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If Firebase auth is enabled, listen to auth state changes
    if (isAuthEnabled && auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      // Development mode: Start with no user (require login)
      setUser(null);
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isAuthEnabled || !auth) {
      // Development mode: Mock sign in
      console.log("Mock sign in:", email);
      const mockUser = {
        uid: "dev-user-" + Date.now(),
        email,
        displayName: email.split("@")[0],
        emailVerified: true,
      } as User;
      setUser(mockUser);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Sign in error:", error);
      throw new Error(error.message || "Failed to sign in");
    }
  };

  const signUp = async (email: string, password: string) => {
    if (!isAuthEnabled || !auth) {
      // Development mode: Mock sign up
      console.log("Mock sign up:", email);
      const mockUser = {
        uid: "dev-user-" + Date.now(),
        email,
        displayName: email.split("@")[0],
        emailVerified: true,
      } as User;
      setUser(mockUser);
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Sign up error:", error);
      throw new Error(error.message || "Failed to create account");
    }
  };

  const signOut = async () => {
    if (!isAuthEnabled || !auth) {
      // Development mode: Mock sign out
      console.log("Mock sign out");
      setUser(null);
      return;
    }

    try {
      await firebaseSignOut(auth);
    } catch (error: any) {
      console.error("Sign out error:", error);
      throw new Error(error.message || "Failed to sign out");
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!isAuthEnabled || !user) {
      // Development mode: Return a mock token
      return "mock-token-" + Date.now();
    }

    try {
      return await user.getIdToken();
    } catch (error) {
      console.error("Failed to get ID token:", error);
      return null;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: user !== null,
    signIn,
    signUp,
    signOut,
    getIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
