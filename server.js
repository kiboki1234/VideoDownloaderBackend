const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

export default function handler(req, res) {
    const { url } = req.body;

    const filePath = path.resolve('/tmp', 'video.mp4');
    const downloadProcess = exec(`yt-dlp --newline -f best -o "${filePath}" "${url}"`);

    downloadProcess.stdout.on('data', (data) => {
        const progress = parseProgress(data);
        res.status(200).json({ progress });
    });

    downloadProcess.on('close', (code) => {
        if (code !== 0) {
            res.status(500).json({ error: 'Error downloading the video' });
        } else {
            res.setHeader('Content-Type', 'video/mp4');
            res.download(filePath, 'video.mp4', (err) => {
                if (err) {
                    res.status(500).json({ error: 'Error sending the file' });
                } else {
                    fs.unlinkSync(filePath);
                }
            });
        }
    });

    function parseProgress(data) {
        const match = data.match(/(\d+\.\d+)%/);
        return match ? parseFloat(match[1]) : null;
    }
}
