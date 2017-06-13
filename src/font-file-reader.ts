import { ArrayBufferWalker } from 'png-pong';
import { FileChunk } from './file-chunks';
import { version } from './version';

// We don't load the file into memory, instead we just store the offsets,
// which we can use to read later.

export class PngPongFontReader {

    walker: ArrayBufferWalker;
    buffer: ArrayBuffer;

    private glyphOffset: number;
    private glyphLength: number;

    private kernOffset?: number;
    private kernLength?: number;

    private alphaOffset: number;
    private alphaLength: number;

    private offsetsOffset: number;
    private offsetsLength: number;

    spaceWidth: number;

    private imageWidth: number;
    yMin: number;
    yMax: number;
    fontSize: number;

    constructor(source: ArrayBuffer) {
        this.walker = new ArrayBufferWalker(source);
        this.buffer = source;
        this.readAllChunks();
    }

    private readAllChunks() {

        let chunkLength = this.walker.readUint32();
        let chunkName = this.walker.readString(4) as FileChunk;

        if (chunkName === "IHDR") {

            this.imageWidth = this.walker.readUint32();
            this.fontSize = this.walker.readUint16();
            this.yMin = this.walker.readUint32();
            this.yMax = this.walker.readUint32();
            this.spaceWidth = this.walker.readUint32();
            let fontVersion = this.walker.readUint8();
            if (fontVersion !== version) {
                throw new Error(`Font was generated with version ${fontVersion}, but this library is version ${version}. Please regenerate fonts.`)
            }
            this.walker.offset += 4; // skip CRC

        } else {

            if (chunkName === "GLPH") {
                this.glyphOffset = this.walker.offset;
                this.glyphLength = chunkLength;
            } else if (chunkName === "KERN") {
                this.kernOffset = this.walker.offset;
                this.kernLength = chunkLength;
            } else if (chunkName === "ALPH") {
                this.alphaOffset = this.walker.offset;
                this.alphaLength = chunkLength;
            } else if (chunkName === "OFFS") {
                this.offsetsOffset = this.walker.offset;
                this.offsetsLength = chunkLength;
            } else {
                throw new Error(`Unrecognised chunk ${chunkName}`);
            }

            // we aren't actually reading these chunks, just noting where they are
            // so let's adjust the offset to skip the actual data.
            this.walker.offset += chunkLength + 4; // skip CRC
        }


        if (this.walker.offset < this.buffer.byteLength) {
            // Keep looping until we've read the whole file
            this.readAllChunks();
        }

    }

    getIndexForGlyph(glyph: string) {

        // space isn't a normal glyph, instead we just store the width in the header. So...

        if (glyph === " ") {
            return -2;
        }

        this.walker.offset = this.glyphOffset;

        while (this.walker.offset < this.glyphOffset + this.glyphLength) {

            let thisGlyph = this.walker.readString(1);
            if (glyph === thisGlyph) {
                return this.walker.offset - this.glyphOffset - 1; // -1 because we've read past this index now
            }

        }

        throw new Error("Glyph not found");

    }

    getOffsetAtIndex(idx: number) {

        this.walker.offset = this.offsetsOffset;

        let offset = 0;

        for (let i = 0; i <= idx; i++) {
            offset += this.walker.readUint16();
        }



        // this.walker.offset = this.offsetsOffset + (idx * 2) // x2 because offsets as Uint16

        return offset;

    }

    getKerning(firstGlyphIndex: number, secondGlyphIndex: number) {

        if (!this.kernOffset) {
            throw new Error("File has no kerning information");
        }

        if (firstGlyphIndex === -2 || secondGlyphIndex === -2) {
            // space character
            return 0;
        }

        this.walker.offset = this.kernOffset;

        while (this.walker.offset < this.kernOffset + this.kernLength!) {

            let firstGlyph = this.walker.readUint8();
            let secondGlyph = this.walker.readUint8();

            if (firstGlyph === firstGlyphIndex && secondGlyph === secondGlyphIndex) {
                // we have a kerning value. Check whether it is positive or negative
                // then return
                let multiplier = this.walker.readUint8() === 1 ? 1 : -1;
                return this.walker.readUint16() * multiplier;
            } else {
                // this isn't a match, so skip reading the value;
                this.walker.skip(3);
            }

        }

        return 0;

    }

    getNextOffsetForIndex(idx: number) {
        if (idx === -2) {
            throw new Error("Should never reach this with a space character")
        }
        if (idx === this.glyphLength) {
            // If this is the last glyph in the file, we want to read until the end
            // of the current row
            return this.imageWidth;
        } else {
            // Otherwise we want to read until the start of the next glyph.
            return this.getOffsetAtIndex(idx + 1);
        }
    }


    getAllAlphasUsedByFont() {

        // Because PngPong tries to use streaming methods as much as possible, we want
        // to define our PNG palette before we draw the text itself. So we use this
        // to calculate what palette entries we'll need for each font.

        this.walker.offset = this.alphaOffset;
        let alphasUsed: number[] = [];

        while (this.walker.offset < this.alphaOffset + this.alphaLength) {

            let alphaVal = this.walker.readUint8();

            if (alphasUsed.indexOf(alphaVal) === -1) {
                alphasUsed.push(alphaVal);
            }

        }

        return alphasUsed;

    }

    getGlyphWidth(glyphIndex: number) {

        if (glyphIndex === -2) {
            // special case for space
            return this.spaceWidth;
        }

        // -2 because the font creator adds 2px of padding to every glyph it draws
        return this.getNextOffsetForIndex(glyphIndex) - this.getOffsetAtIndex(glyphIndex) - 2;
    }

    getGlyphAlpha(glyphIndex: number, row: number, column: number) {

        if (glyphIndex === -2) {
            // space character never draws anything.
            return 0;
        }

        let offset = this.getOffsetAtIndex(glyphIndex);

        let rowStart = (this.imageWidth * row);

        return this.walker.array[this.alphaOffset + rowStart + offset + column];

    }

}