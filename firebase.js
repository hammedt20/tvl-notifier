// firebase.js
const admin = require("firebase-admin");

let serviceAccount;

if (process.env.FIREBASE_KEY_JSON) {
  // Production: key from environment variable (Render)
  serviceAccount = JSON.parse(process.env.FIREBASE_KEY_JSON);
} else {
  // Local: key from file
  serviceAccount = require("./firebase-key.json");
}


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = db;
