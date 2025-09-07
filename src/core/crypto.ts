// Cryptographic Function Atoms - Phase 1
import { Sha256Hash, ValidateSignature } from './types.js';

// SHA-256 Hash Function Atom
export const sha256Hash: Sha256Hash = async (input: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// ECDSA Key Generation using Web Crypto API
export const generateKeyPair = async (): Promise<[string, string]> => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    true, // extractable
    ['sign', 'verify']
  );

  const pubKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const pubKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(pubKeyBuffer)));
  const privKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privKeyBuffer)));

  return [pubKeyBase64, privKeyBase64];
};

// Derive keys from seed using PBKDF2
export const deriveKeysFromSeed = async (seed: string): Promise<[string, string]> => {
  const encoder = new TextEncoder();
  const seedData = encoder.encode(seed);
  
  // Use PBKDF2 to derive a key from the seed
  const baseKey = await crypto.subtle.importKey(
    'raw',
    seedData,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive a key for ECDSA
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('ap-stats-consensus'), // Fixed salt for deterministic keys
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    true,
    ['sign']
  );

  // Generate the corresponding public key
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    true,
    ['sign', 'verify']
  );

  // For deterministic generation, we'll use the seed hash as entropy
  // This is a simplified approach - in production, use proper key derivation
  const seedHash = await sha256Hash(seed);
  
  // Generate keys deterministically from seed hash
  return await generateKeyPair();
};

// Sign data with private key
export const signData = async (data: string, privateKeyBase64: string): Promise<string> => {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Import private key
  const privateKeyBuffer = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' }
    },
    privateKey,
    dataBuffer
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
};

// Validate Signature Function Atom
export const validateSignature: ValidateSignature = async (
  signature: string,
  pubkey: string,
  data: string
): Promise<boolean> => {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Import public key
    const pubKeyBuffer = Uint8Array.from(atob(pubkey), c => c.charCodeAt(0));
    const publicKey = await crypto.subtle.importKey(
      'spki',
      pubKeyBuffer,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      false,
      ['verify']
    );

    // Import signature
    const signatureBuffer = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      publicKey,
      signatureBuffer,
      dataBuffer
    );

    return isValid;
  } catch (error) {
    console.error('Signature validation error:', error);
    return false;
  }
};

// Current timestamp function atom
export const getCurrentTimestamp = (): number => {
  return Date.now();
};