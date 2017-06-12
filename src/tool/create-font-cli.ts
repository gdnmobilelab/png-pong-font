import { generateFontFile } from './create-font-file';

let fontPath = process.argv[2];
let size = parseInt(process.argv[3]);

let file = generateFontFile(fontPath, size);

process.stdout.write(new Buffer(file));