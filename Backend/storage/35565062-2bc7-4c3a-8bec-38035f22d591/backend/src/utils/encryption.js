import crypto from "crypto"
import fs from "fs"
import path from "path"
const ENCRYPTED_DIR = "storage/encrypted";

if (!fs.existsSync(ENCRYPTED_DIR)) {
  fs.mkdirSync(ENCRYPTED_DIR, { recursive: true });
}
export const unlockAESKey = (lockedKey, userPrivateKey, userPassword) => {
  const privateKeyHandle = crypto.createPrivateKey({
    key: userPrivateKey,
    format: "pem",
    passphrase: userPassword,
  });

  return crypto.privateDecrypt(
    {
      key: privateKeyHandle,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(lockedKey, "hex")
  );
};
export const encryptCapsule = (content, userPublicKey) => {
    // 1. Generate a random AES key (Symmetric)
    const aesKey = crypto.randomBytes(32); 
    const iv = crypto.randomBytes(16);

    // 2. Encrypt the content with AES-256-GCM
    // encryption engine generate
    const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
    // encryption starts here
    let encryptedData = cipher.update(content, "utf8", "hex");
    // left part of blocks to add in encrypted data 
    encryptedData += cipher.final("hex");
    // a type of digital signature , while decrypting same auth tag should be generated
    const authTag = cipher.getAuthTag().toString("hex");

    // 3. Lock the AES Key with User's RSA Public Key
    // Taki sirf user ki private key hi ise unlock kar sake
    const encryptedRandomKey = crypto.publicEncrypt(
        {
            key: userPublicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        },
        aesKey
    ).toString("hex");

    return {
        lockedData: encryptedData,
        iv: iv.toString("hex"),
        authTag,
        lockedRandomKey: encryptedRandomKey, // As per your notes
    };
};
export const encryptText = (content, userPublicKey) => {
    // 1. Generate a random AES key (Symmetric)
    const aesKey = crypto.randomBytes(32); 
    const iv = crypto.randomBytes(16);

    // 2. Encrypt the content with AES-256-GCM
    // encryption engine generate
    const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
    // encryption starts here
    let encryptedData = cipher.update(content, "utf8", "hex");
    // left part of blocks to add in encrypted data 
    encryptedData += cipher.final("hex");
    // a type of digital signature , while decrypting same auth tag should be generated
    const authTag = cipher.getAuthTag().toString("hex");

    // 3. Lock the AES Key with User's RSA Public Key
    // Taki sirf user ki private key hi ise unlock kar sake
    const encryptedRandomKey = crypto.publicEncrypt(
        {
            key: userPublicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        },
        aesKey
    ).toString("hex");

    return {
        encryptedData,
        iv: iv.toString("hex"),
        authTag,
        lockedKey: encryptedRandomKey, // As per your notes
    };
};

export const encryptFile = (tempFilePath, userPublicKey) => {
  return new Promise((resolve, reject) => {
    try {
      const aesKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);

      // Output encrypted file path
      const encryptedFileName =
        path.basename(tempFilePath) + ".enc";
      const encryptedFilePath = path.join(
        ENCRYPTED_DIR,
        encryptedFileName
      );

      // Create streams
      const inputStream = fs.createReadStream(tempFilePath);
      const outputStream = fs.createWriteStream(encryptedFilePath);

      // Pipe: read → encrypt → write
      inputStream.pipe(cipher).pipe(outputStream);

      outputStream.on("finish", () => {
        const authTag = cipher.getAuthTag();

        // Encrypt AES key using RSA public key
        const lockedKey = crypto.publicEncrypt(
          {
            key: userPublicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
          },
          aesKey
        ).toString("hex");

        resolve({
          encryptedFilePath,
          iv: iv.toString("hex"),
          authTag: authTag.toString("hex"),
          lockedKey,
        });
      });

      outputStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
};

export const decryptText = (
  encryptedData,
  iv,
  authTag,
  lockedKey,
  userPrivateKey,
  userPassword
) => {
  const aesKey = unlockAESKey(
    lockedKey,
    userPrivateKey,
    userPassword
  );

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    aesKey,
    Buffer.from(iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};
// decrypted readable stream
export const decryptFileStream = (
  encryptedFilePath,
  iv,
  authTag,
  lockedKey,
  userPrivateKey,
  userPassword
) => {
  const aesKey = unlockAESKey(
    lockedKey,
    userPrivateKey,
    userPassword
  );

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    aesKey,
    Buffer.from(iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  const readStream = fs.createReadStream(encryptedFilePath);

  return readStream.pipe(decipher);
};

export const decryptCapsule = (encryptedData, iv, authTag, lockedRandomKey, userPrivateKey, userPassword) => {
    // 1. Private Key ko user password se unlock karo
    // Note: Humein 'passphrase' wahi dena hai jo registration ke waqt tha
    const privateKeyHandle = crypto.createPrivateKey({
        key: userPrivateKey,
        format: 'pem',
        passphrase: userPassword, 
    });

    // 2. RSA Decrypt: Private key se AES key nikaalna
    const aesKey = crypto.privateDecrypt(
        {
            key: privateKeyHandle,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        },
        Buffer.from(lockedRandomKey, "hex")
    );

    // 3. AES Decryption Engine Setup
    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        aesKey,
        Buffer.from(iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(authTag, "hex"));

    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
};