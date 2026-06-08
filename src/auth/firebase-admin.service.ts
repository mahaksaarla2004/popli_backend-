import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  onModuleInit() {
    const envPath = process.env.FIREBASE_CREDENTIALS;
    const serviceAccountPath = envPath ? envPath : path.resolve(process.cwd(), 'firebase-admin-key.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      try {
        const serviceAccount = require(serviceAccountPath);
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
        }
        console.log('Firebase Admin initialized successfully.');
      } catch (error) {
        console.error('Failed to initialize Firebase Admin with serviceAccountKey.json', error);
      }
    } else {
      console.warn('⚠️ Firebase Admin `serviceAccountKey.json` NOT FOUND. Firebase Auth will fail.');
    }
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    if (!admin.apps.length) {
      throw new UnauthorizedException('Firebase Admin is not configured. Missing firebase-admin-key.json');
    }

    try {
      return await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired Firebase ID token');
    }
  }
}
