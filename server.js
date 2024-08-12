const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 5000;

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

    // Define a unique filename for the video
    const filePath = path.resolve('/tmp', 'video.mp4');

    // Use the full path to yt-dlp
    const downloadProcess = exec(`/usr/local/bin/yt-dlp --newline -f best -o "${filePath}" "${url}"`);

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
