const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

/**
 * Renderの永続ディスク（Persistent Disk）対応:
 * Mount Pathを /data に設定することを想定しています。
 * ローカル環境や未設定の場合は同ディレクトリの memos.json を使用します。
 */
const STORAGE_DIR = existsSync('/data') ? '/data' : __dirname;
const DATA_FILE = path.join(STORAGE_DIR, 'memos.json');
const BACKUP_FILE = path.join(STORAGE_DIR, 'memos_backup.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('./'));

// --- Backup System ---
async function createBackup() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        await fs.writeFile(BACKUP_FILE, data, 'utf8');
        console.log(`[Backup] Success at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error('[Backup] Failed:', err);
        }
    }
}

// 10分ごとに自動バックグラウンド・バックアップ
setInterval(createBackup, 10 * 60 * 1000);

// Helper to read data
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// Helper to write data
async function saveData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    // 保存のたびにバックアップも更新（安全のため）
    createBackup().catch(e => console.error(e));
}

// --- API Endpoints ---

// 1. Get all memos
app.get('/api/memos', async (req, res) => {
    try {
        const memos = await readData();
        res.json(memos);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// 2. Create a new memo
app.post('/api/memos', async (req, res) => {
    const { title, content, tags } = req.body;
    try {
        const memos = await readData();
        const newMemo = {
            id: Date.now().toString(),
            title,
            content,
            tags: tags || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        memos.unshift(newMemo);
        await saveData(memos);
        res.json(newMemo);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// 3. Update an existing memo
app.put('/api/memos/:id', async (req, res) => {
    const { id } = req.params;
    const { title, content, tags } = req.body;
    try {
        let memos = await readData();
        const index = memos.findIndex(m => m.id === id);
        if (index === -1) return res.status(404).json({ error: 'Memo not found' });

        memos[index] = {
            ...memos[index],
            title,
            content,
            tags: tags || [],
            updated_at: new Date().toISOString()
        };
        await saveData(memos);
        res.json(memos[index]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update data' });
    }
});

// 4. Delete a memo
app.delete('/api/memos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        let memos = await readData();
        const filtered = memos.filter(m => m.id !== id);
        if (memos.length === filtered.length) return res.status(404).json({ error: 'Memo not found' });

        await saveData(filtered);
        res.json({ message: 'Deleted', id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete data' });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`EchoMemo Persistent Server running at http://localhost:${port}`);
    console.log(`Data file: ${DATA_FILE}`);
});
