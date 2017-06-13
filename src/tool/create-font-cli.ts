import { generateFontFile } from './create-font-file';
import * as yargs from 'yargs';
import * as path from 'path';
import * as fs from 'fs';
import { version } from '../version';
import "colors";

const argv = yargs
    .option("i", {
        demandOption: true,
        alias: "input",
        describe: "The OTF/TTF file you want to convert into a PngPong font",
        type: "string"
    })
    .option("o", {
        demandOption: false,
        alias: "output",
        describe: "The output path to write to.",
        type: "string"
    })
    .option("s", {
        demandOption: true,
        alias: 'size',
        describe: "The pixel size you want to render the font in",
        type: "number"
    })
    .argv


let fullInputPath = path.join(process.cwd(), argv.input);
let size = parseInt(argv.size, 10);
let infoStream = argv.output ? process.stdout : process.stderr;

infoStream.write((`PngPong Font Creator, file format v${version}\r\n`).green);

if (isNaN(size)) {
    process.stderr.write("Size could not be recognised as an integer, exiting...\r\n".red);
    process.exit(1);
}

try {
    fs.statSync(fullInputPath);
} catch (err) {
    process.stderr.write("Input file not found, exiting...\r\n".red);
    process.exit(1);
}

let file = generateFontFile(fullInputPath, size);

if (argv.output) {
    let fullOutputPath = path.join(process.cwd(), argv.output);
    fs.writeFileSync(fullOutputPath, new Buffer(file));
    infoStream.write(`Successfully PngPong font file to: ${fullOutputPath}\r\n`)
} else {
    process.stdout.write(new Buffer(file));
}