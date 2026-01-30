
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

const currentYear = new Date().getFullYear();
const filePath = path.join(process.cwd(), 'public', 'data', `usaw-rankings-${currentYear}.json.gz`);

try {
    const fileBuffer = fs.readFileSync(filePath);
    const decompressed = zlib.gunzipSync(fileBuffer);
    const data = JSON.parse(decompressed.toString());

    console.log(`Inspecting ${filePath}`);
    console.log(`Total records: ${data.length}`);

    const sample = data.filter((r: any) => r.gamx_total != null).slice(0, 5);
    console.log('Sample records with GAMX Total:');
    sample.forEach((r: any) => {
        console.log(`ID: ${r.lifter_id}, Name: ${r.lifter_name}, GAMX Total: ${r.gamx_total}, GAMX U: ${r.gamx_u}`);
    });

    if (sample.length === 0) {
        console.log("No records found with GAMX Total populated.");
    }

} catch (err) {
    console.error("Error inspecting file:", err);
}
