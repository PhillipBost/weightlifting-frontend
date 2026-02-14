const fs = require('fs');
const zlib = require('zlib');

const filePath = process.argv[2];

if (!filePath) {
    console.log('Please provide a file path');
    process.exit(1);
}

try {
    const fileBuffer = fs.readFileSync(filePath);
    zlib.gunzip(fileBuffer, (err, buffer) => {
        if (err) {
            console.error('Error unzipping:', err);
            return;
        }
        const data = JSON.parse(buffer.toString());

        if (Array.isArray(data)) {
            console.log('Is Array: true');
            console.log('Length:', data.length);
            console.log('First Item:', JSON.stringify(data[0], null, 2));
        } else {
            console.log('Is Array: false');
            const keys = Object.keys(data);
            console.log('Keys count:', keys.length);
            if (keys.length > 0) {
                console.log('First Key:', keys[0]);
                console.log('First Item:', JSON.stringify(data[keys[0]], null, 2));
            }
        }
    });
} catch (e) {
    console.error('Error reading file:', e);
}
