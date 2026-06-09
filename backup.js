const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 確保你專案目錄下有這個私鑰檔案
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function backupFirestore() {
    try {
        const collections = await db.listCollections();
        const backupData = {};

        for (const collection of collections) {
            const snapshot = await collection.get();
            backupData[collection.id] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        }

        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        // 這裡直接寫死你的目標路徑
        const targetFolder = 'D:\\射箭系統備份';
        
        if (!fs.existsSync(targetFolder)){
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        const fileName = path.join(targetFolder, `backup_${timestamp}.json`);
        
        fs.writeFileSync(fileName, JSON.stringify(backupData, null, 2));
        console.log(`✅ 備份完成：${fileName}`);
    } catch (error) {
        console.error("❌ 備份失敗:", error);
    }
}

backupFirestore();