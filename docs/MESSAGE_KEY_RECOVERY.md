# Nexora message-key recovery

Nexora stores each user's public encryption and signing keys on the server. Private keys remain in the browser's IndexedDB. For keys created by the recovery-capable client, a user can explicitly create a recovery backup: the browser exports the keys, encrypts the bundle with AES-256-GCM, and derives the encryption key from a user-chosen recovery passphrase with PBKDF2-HMAC-SHA-256 (600,000 iterations and a fresh random salt). The encrypted blob and public-key fingerprint are stored on the authenticated account. The passphrase and plaintext private keys are not sent to the API.

The backup is bound to the account id and registered public-key fingerprint using AES-GCM additional authenticated data. The API only accepts the supported format and matching key version/public-key fingerprint; backup routes require normal authentication. Backups are append-only, with a limit of five. There is no server-side password reset for a recovery passphrase. Losing the passphrase means that backup cannot be opened.

## Existing legacy keys

Earlier clients created private keys as non-extractable WebCrypto keys. WebCrypto does not provide a way to change an existing key's extractability or export its private material. The new backup flow deliberately refuses those keys; it does not replace them, rotate them, or claim to migrate them. Keep the original browser profile, IndexedDB, and exact site origin available to retain access to messages encrypted for that key. If that device/browser data is lost and there is no other valid backup, those messages cannot be decrypted. Do not clear browser site data or reset keys while relying on a legacy key.

For a recovery-capable key, create and verify a backup on the device that has the key, then sign in to the same account on the new device and restore it with the recovery passphrase. Do not share the passphrase. Recovery enables the same identity key on multiple devices; it is not independent per-device key isolation.

## Trust assumptions and limitations

This protects private keys at rest in the database, but does not make the server or deployed application untrusted. The server authenticates accounts and serves the client code; a compromised server, deployment pipeline, or same-origin script could deliver code that captures a passphrase or key while the user restores or sends a message. Use HTTPS, protect the account and deployment, and use a unique high-entropy recovery passphrase. This implementation has not received an independent cryptographic audit.

The schema change is additive (`encryptionKeyBackups`, default empty); it does not require a data migration or environment variable. Deploy the backend route/model changes and client together before using recovery. This feature only restores identity keys; it does not by itself fix unrelated message delivery, conversation authorization, or real-time synchronization problems.
