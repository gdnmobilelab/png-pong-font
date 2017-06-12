import * as path from 'path';
import { generateFontFile } from '../../src/tool/create-font-file';
import { PngPongFontReader } from '../../src/font-file-reader';
import * as opentype from 'opentype.js';
const expect = require('expect.js');

describe("Font file creator", () => {
    it("should record kerning values", () => {

        let fontPath = path.join(__dirname, '..', '..', '..', 'test-sources', 'Roboto-Regular.ttf');

        let resultBuffer = generateFontFile(fontPath, 20);

        let reader = new PngPongFontReader(resultBuffer);

        expect(reader.getIndexForGlyph("b")).to.equal(1);
        expect(reader.getIndexForGlyph(" ")).to.equal(-2);
        expect(reader.getGlyphWidth(-2)).to.equal(5);

        try {
            reader.getIndexForGlyph("∫");
            throw new Error("DIDNOTFAIL")
        } catch (err) {
            expect(err.message).to.equal("Glyph not found");
        }



    })
})