import admin from "firebase-admin";
import { logger } from "./logger";

/**
 * Initialize Firebase Admin SDK
 * 
 * In production, this will use a service account JSON file or environment variables.
 * For now, we initialize without credentials for development/testing.
 * 
 * Production setup will require:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY
 * Or a FIREBASE_SERVICE_ACCOUNT_JSON path
 */

let firebaseInitialized = false;

export function initializeFirebase() {
  if (firebaseInitialized) {
    logger.info("Firebase Admin already initialized");
    return admin.app();
  }

  try {
    // Check if service account credentials are provided
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (projectId && clientEmail && privateKey) {
      // Production mode: Initialize with service account
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      logger.info("Firebase Admin initialized with service account credentials");
    } else {
      // Development mode: Initialize without credentials (mock mode)
      // This allows the app to run without Firebase but won't verify real tokens
      logger.warn(
        "Firebase Admin initialized in MOCK MODE - token verification disabled. " +
        "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY for production."
      );
      
      // Initialize with minimal config for development
      admin.initializeApp({
        projectId: "mock-project-dev",
      });
    }

    firebaseInitialized = true;
    return admin.app();
  } catch (error) {
    logger.error({ error }, "Failed to initialize Firebase Admin");
    throw error;
  }
}

export function getFirebaseAuth() {
  if (!firebaseInitialized) {
    initializeFirebase();
  }
  return admin.auth();
}

export function isFirebaseMockMode(): boolean {
  return !process.env.FIREBASE_PROJECT_ID || 
         !process.env.FIREBASE_CLIENT_EMAIL || 
         !process.env.FIREBASE_PRIVATE_KEY;
}

// Initialize on module load
initializeFirebase();
