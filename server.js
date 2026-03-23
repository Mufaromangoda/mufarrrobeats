const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json());

const dataFile = path.join(__dirname, 'data', 'beats.json');

// Ensure directories exist
['uploads', 'data', 'uploads/audio', 'uploads/covers'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([]));
}

// Multer storage for handling both audio and cover image files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'audio') {
            cb(null, 'uploads/audio/');
        } else if (file.fieldname === 'cover') {
            cb(null, 'uploads/covers/');
        } else {
            cb(null, 'uploads/');
        }
    },
    filename: function (req, file, cb) {
        // Safe filename handling
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});
const upload = multer({ storage: storage });

// API Route: Get all beats
app.get('/api/beats', (req, res) => {
    const beats = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    res.json(beats);
});

// API Route: Upload a new beat
app.post('/api/upload', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), (req, res) => {
    try {
        const title = req.body.title;
        const producer = req.body.producer || 'Unknown Producer';
        
        const audioFile = req.files['audio'][0];
        const coverFile = req.files['cover'][0];

        const newBeat = {
            id: Date.now().toString(),
            title: title,
            producer: producer,
            audioUrl: '/uploads/audio/' + audioFile.filename,
            coverUrl: '/uploads/covers/' + coverFile.filename,
            originalAudioName: audioFile.originalname
        };

        const beats = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        beats.unshift(newBeat); // Add the newest beat to the top
        fs.writeFileSync(dataFile, JSON.stringify(beats, null, 2));

        res.json({ success: true, beat: newBeat });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ success: false, message: 'Upload failed' });
    }
});

// API Route: Update a beat
app.put('/api/beats/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { title, producer } = req.body;
        const beats = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        const beatIndex = beats.findIndex(b => b.id === id);
        
        if (beatIndex === -1) {
            return res.status(404).json({ success: false, message: 'Beat not found' });
        }
        
        beats[beatIndex].title = title || beats[beatIndex].title;
        beats[beatIndex].producer = producer || beats[beatIndex].producer;
        
        fs.writeFileSync(dataFile, JSON.stringify(beats, null, 2));
        res.json({ success: true, beat: beats[beatIndex] });
    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({ success: false, message: 'Update failed' });
    }
});

// API Route: Delete a beat
app.delete('/api/beats/:id', (req, res) => {
    try {
        const { id } = req.params;
        let beats = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        const beatIndex = beats.findIndex(b => b.id === id);
        
        if (beatIndex === -1) {
            return res.status(404).json({ success: false, message: 'Beat not found' });
        }

        const beat = beats[beatIndex];
        
        // Remove files if they exist
        if (beat.audioUrl) {
            const audioPath = path.join(__dirname, beat.audioUrl);
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        }
        if (beat.coverUrl) {
            const coverPath = path.join(__dirname, beat.coverUrl);
            if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
        }

        beats.splice(beatIndex, 1);
        fs.writeFileSync(dataFile, JSON.stringify(beats, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({ success: false, message: 'Delete failed' });
    }
});

// API Route: Handle Email Submission for Download
app.post('/api/subscribe', (req, res) => {
    const { email, beatId } = req.body;
    console.log(`Email collected: ${email} for beat ${beatId}`);
    // In a real production application, you would connect to the Mailchimp/MailerLite API here.
    res.json({ success: true });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n==============================================`);
    console.log(`🎵 TYPE BEAT SERVER RUNNING`);
    console.log(`🌐 Application: http://localhost:${PORT}`);
    console.log(`⚙️  Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`==============================================\n`);
});
