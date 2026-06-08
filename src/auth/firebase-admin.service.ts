import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  onModuleInit() {
    const envVal = process.env.FIREBASE_CREDENTIALS;
    let serviceAccount: any = null;

    if (envVal && envVal.trim().startsWith('{')) {
      // It's a raw JSON string
      try {
        serviceAccount = JSON.parse(envVal);
      } catch (e) {
        console.error('Failed to parse FIREBASE_CREDENTIALS JSON from env', e);
      }
    } else {
      // It's a file path (or default path)
      const serviceAccountPath = envVal && fs.existsSync(envVal) ? envVal : path.resolve(process.cwd(), 'firebase-admin-key.json');
      if (fs.existsSync(serviceAccountPath)) {
        try {
          serviceAccount = require(serviceAccountPath);
        } catch (error) {
          console.error('Failed to load Firebase Admin credential from file', error);
        }
      }
    }

    if (serviceAccount) {
      try {
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
        }
        console.log('Firebase Admin initialized successfully.');
      } catch (error) {
        console.error('Failed to initialize Firebase Admin with credential', error);
      }
    } else {
      console.warn('⚠️ Firebase Admin credential NOT FOUND. Firebase Auth will fail.');
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
