const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) {
  const defaultPath = path.resolve(__dirname, '../serviceAccount.innsight-2025.json');
  if (fs.existsSync(defaultPath)) {
    admin.initializeApp({
      credential: admin.credential.cert(require(defaultPath)),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

(async () => {
  const snapshot = await db.collection('rooms').get();
  console.log(`Total docs: ${snapshot.size}`);
  snapshot.docs.slice(0, 5).forEach((doc, idx) => {
    console.log(idx + 1, doc.id, doc.data());
  });
})();
