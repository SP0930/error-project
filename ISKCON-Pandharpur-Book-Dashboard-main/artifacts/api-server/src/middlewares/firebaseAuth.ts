import { Request, Response, NextFunction } from "express";
import { getFirebaseAuth, isFirebaseMockMode } from "../lib/firebase";
import { logger } from "../lib/logger";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  emailVerified?: boolean;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Firebase Authentication Middleware
 * 
 * Verifies Firebase ID tokens from Authorization header.
 * In mock mode (no Firebase credentials), accepts any token for development.
 * 
 * Usage:
 *   router.get('/protected', firebaseAuthMiddleware, handler);
 *   router.post('/api/books', firebaseAuthMiddleware, createBook);
 */
export async function firebaseAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Missing or invalid Authorization header. Expected: Bearer <token>",
      });
      return;
    }

    const idToken = authHeader.split("Bearer ")[1];

    if (!idToken) {
      res.status(401).json({
        error: "Unauthorized",
        message: "No token provided",
      });
      return;
    }

    // Mock mode: Accept any token for development
    if (isFirebaseMockMode()) {
      logger.warn("Firebase Auth in MOCK MODE - accepting token without verification");
      
      // Create a mock user for development
      req.user = {
        uid: "mock-user-" + Math.random().toString(36).substr(2, 9),
        email: "dev@iskcon-pandharpur.org",
        name: "Development User",
        emailVerified: true,
      };

      next();
      return;
    }

    // Production mode: Verify token with Firebase
    try {
      const decodedToken = await getFirebaseAuth().verifyIdToken(idToken);
      
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
        emailVerified: decodedToken.email_verified,
      };

      logger.info({ uid: req.user.uid, email: req.user.email }, "User authenticated");
      next();
    } catch (verifyError) {
      logger.error({ error: verifyError }, "Token verification failed");
      
      res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or expired token",
      });
      return;
    }
  } catch (error) {
    logger.error({ error }, "Authentication middleware error");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Authentication failed",
    });
  }
}

/**
 * Optional authentication middleware
 * Sets req.user if valid token is provided, but doesn't block request
 */
export async function optionalFirebaseAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      next();
      return;
    }

    const idToken = authHeader.split("Bearer ")[1];

    if (isFirebaseMockMode()) {
      req.user = {
        uid: "mock-user-optional",
        email: "dev@iskcon-pandharpur.org",
        name: "Development User",
        emailVerified: true,
      };
    } else {
      try {
        const decodedToken = await getFirebaseAuth().verifyIdToken(idToken);
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name,
          emailVerified: decodedToken.email_verified,
        };
      } catch (error) {
        // Token invalid, but don't block request
        logger.warn("Optional auth: invalid token provided");
      }
    }

    next();
  } catch (error) {
    logger.error({ error }, "Optional auth middleware error");
    next();
  }
}
