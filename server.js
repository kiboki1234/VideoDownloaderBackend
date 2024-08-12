// backend/server.js

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 5000;

// Define paths
const ytDlpPath = '/tmp/yt-dlp';
const filePath = path.resolve('/tmp', 'video.mp4');

// Ensure yt-dlp is available
if (!fs.existsSync(ytDlpPath)) {
    try {
        execSync(`curl -L https://yt-dlp.org/downloads/latest/yt-dlp -o ${ytDlpPath}`);
        fs.chmodSync(ytDlpPath, '755');
    } catch (error) {
        console.error('Failed to download yt-dlp:', error);
        process.exit(1); // Exit if yt-dlp cannot be downloaded
    }
}

app.use(cors());
app.use(express.json());

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// WebSocket server for progress updates
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected for progress updates');
});

app.post('/api/download', (req, res) => {
    const { url } = req.body;

    // Use the full path to yt-dlp
    const downloadProcess = exec(`"${ytDlpPath}" --newline -f best -o "${filePath}" "${url}"`);

    downloadProcess.stdout.on('data', (data) => {
        const progress = parseProgress(data);
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ progress }));
            }
        });
    });

    downloadProcess.on('close', (code) => {
        if (code !== 0) {
            console.error('Error downloading the video');
            res.status(500).send('Error downloading the video');
            return;
        }

        // Set headers and send the file to the client
        res.setHeader('Content-Type', 'video/mp4');
        res.download(filePath, 'video.mp4', (err) => {
            if (err) {
                console.error('Error sending the file:', err);
                res.status(500).send('Error sending the file');
            } else {
                fs.unlinkSync(filePath); // Delete the file after sending it
            }
        });
    });
});

function parseProgress(data) {
    const match = data.match(/(\d+\.\d+)%/);
    if (match) {
        return parseFloat(match[1]);
    }
    return null;
}
