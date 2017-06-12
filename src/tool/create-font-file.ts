import * as opentype from 'opentype.js';
import { basic } from './character-sets';
import * as Canvas from 'canvas';
import { ArrayBufferWalker } from 'png-pong';

function getKerningPairs(font: opentype.Font, glyphs: opentype.Glyph[], fontSize: number) {

    type KerningPair = [number, number, number, number];

    // If the kerning between two characters is zero we don't record it, to save space.
    let nonZeroKerningSizes: KerningPair[] = [];

    for (let glyphIndex = 0; glyphIndex < glyphs.length; glyphIndex++) {

        // Loop through each character pair. We don't need to worry about reptition, duplication
        // because a glyph might have a kerning value with itself, and might have a different
        // kerning value if the glyph order is reversed.

        let glyphAtIndex = glyphs[glyphIndex];

        for (let iterate = 0; iterate < glyphs.length; iterate++) {

            let val = font.getKerningValue(glyphAtIndex, glyphs[iterate]);

            if (val !== 0) {

                // All kerning values are initially at 72pt
                let roundedVal = Math.floor((val / 100) * fontSize);

                nonZeroKerningSizes.push([glyphAtIndex.unicode, glyphs[iterate].unicode, val > 0 ? 1 : 0, Math.abs(roundedVal)]);

            }
        }


    }

    return nonZeroKerningSizes;

}

interface DrawSizes {
    yMin: number;
    yMax: number;
    width: number;
    offsets: number[];
}

function getCanvasSizeForPaths(paths: opentype.Path[]): DrawSizes {

    // We return an overall width, as well as a yMin and a yMax - we need to
    // separate these out so that we know where the text baseline is.

    interface BoundingBox { x1: number; x2: number; y1: number; y2: number };

    let size = paths.reduce((size, path) => {

        let bbox: BoundingBox = (path as any).getBoundingBox();

        let pathWidth = Math.ceil(bbox.x2) + 2; // add 2 for a buffer around anti-aliased pixels

        size.width += pathWidth;
        size.yMin = Math.min(size.yMin, bbox.y1);
        size.yMax = Math.max(size.yMax, bbox.y2);
        size.offsets.push(pathWidth);
        return size;

    }, { width: 0, yMin: 0, yMax: 0, offsets: [0] as number[] });

    // We need to render the image in full pixel size
    size.yMin = Math.ceil(size.yMin);
    size.width = Math.ceil(size.width);
    size.yMax = Math.ceil(size.yMax);

    return size;
}

function drawFontAtSize(font: opentype.Font, glyphsAsPaths: opentype.Path[], size: DrawSizes) {

    let height = Math.abs(size.yMin) + size.yMax;
    let canvas = new Canvas(size.width, height);
    let ctx = canvas.getContext("2d");
    ctx.translate(0, Math.abs(size.yMin));
    ctx.antialias = "subpixel";
    ctx.filter = "bilinear";
    ctx.patternQuality = "bilinear";

    glyphsAsPaths.forEach((p: any, idx) => {
        p.fill = "red";

        let bbox = p.getBoundingBox();
        if (idx === 0) {
            p.draw(ctx);
        } else {
            ctx.translate(size.offsets[idx], 0);
            p.draw(ctx);
        }
    })

    // The raw buffer is an array of RGBA values. For drawing text, we only want
    // the alpha value, so we go through the buffer and pluck out those numbers.
    let rgba = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // We want to limit the number of alpha entries we use, so we round out our
    // alpha values to multiples of 10. The final result is not noticable.

    for (let i = 3; i < rgba.data.length; i = i + 4) {

        rgba.data[i] = Math.round(rgba.data[i] / 30) * 30;

        if (rgba.data[1] > 255) {
            rgba.data[1] = 255;
        }

        // rgba.data[i] -= rgba.data[i] % 10;
    }



    let alphaArray = new Uint8Array(size.width * height);

    for (let i = 0; i < alphaArray.length; i++) {

        let alpha = rgba.data[(i * 4) + 3];

        if (alpha > 255 || alpha < 0) {
            throw new Error(`Do not understand alpha value of ${alpha}`)
        }

        alphaArray[i] = alpha;
    }

    // let unique = alphaArray.filter((val, idx, arr) => {
    //     return arr.indexOf(val) === idx
    // }).sort();

    // console.log("?", unique.length)

    ctx.putImageData(rgba, 0, 0);


    let b = new Buffer(alphaArray);

    require('fs').writeFileSync('/tmp/text.png', canvas.toBuffer("png"))
    require('fs').writeFileSync('/tmp/buf.buf', b)

    return alphaArray;

    // console.log(alphaArray)
    // // new Uint8Array()



}

export function generateFontFile(sourceFont: string, size: number) {

    let font = opentype.loadSync(sourceFont);

    // Convert our strings to glyphs. This isn't necessarily a 1:1 conversion, but
    // with the kind of basic conversions we're doing, it probably is.
    let basicAsGlyphs = font.stringToGlyphs(basic);

    // We need to get the actual drawable paths from these glyphs
    let glyphsAsPaths = basicAsGlyphs.map((g) => g.getPath(0, 0, size));

    // Then measure out the offsets for each glyph, as well as calculate the overall
    // image size
    let sizes = getCanvasSizeForPaths(glyphsAsPaths);

    // The space character is special, because it has no path it has no width. But
    // we still want to know how much space we should reserve. This is my best attempt
    // at working out how to do that.

    let [space] = font.stringToGlyphs(" ");
    let ratioOfWidthToSize = sizes.offsets[1] / basicAsGlyphs[0].advanceWidth;
    let spaceSize = Math.round(space.advanceWidth * ratioOfWidthToSize);

    // Calculate the kerning pairs for this font. We need to know how many there are
    // to create our initial buffer.
    let kerningPairs = getKerningPairs(font, basicAsGlyphs, size);

    // Now we draw the characters onto a canvas and extract the alpha values.
    let alphaArray = drawFontAtSize(font, glyphsAsPaths, sizes);

    let headerLength = 4    // image width
        + 2                 // font size
        + 4                 // ymin
        + 4                 // ymax
        + 4                 // space size

    let offsetLength = (2 * sizes.offsets.length) // Store offsets as UInt16

    let kerningChunkSize = 5 * kerningPairs.length; // UInt8 glyph identifier + UInt16 offset 

    let overallLength = headerLength + basic.length + kerningChunkSize + alphaArray.length + offsetLength + ((
        4 + // Length
        4 + // Chunk name
        4   // CRC
    ) * 5);

    let finalBuffer = new ArrayBuffer(overallLength);

    let walker = new ArrayBufferWalker(finalBuffer);

    walker.writeUint32(headerLength);
    walker.startCRC();
    walker.writeString("IHDR");
    walker.writeUint32(sizes.width);
    walker.writeUint16(size);
    walker.writeUint32(sizes.yMin);
    walker.writeUint32(sizes.yMax);
    walker.writeUint32(spaceSize);
    walker.writeCRC();

    walker.writeUint32(basic.length);
    walker.startCRC();
    walker.writeString("GLPH");
    walker.writeString(basic);
    walker.writeCRC();

    walker.writeUint32(offsetLength);
    walker.startCRC();
    walker.writeString("OFFS");
    sizes.offsets.forEach((o) => walker.writeUint16(o));

    walker.writeCRC();

    walker.writeUint32(kerningChunkSize);
    walker.startCRC();
    walker.writeString("KERN");

    kerningPairs.forEach((k) => {
        walker.writeUint8(k[0]);
        walker.writeUint8(k[1]);
        walker.writeUint8(k[2])
        walker.writeUint16(k[3]);
    });

    walker.writeCRC();

    walker.writeUint32(alphaArray.length);
    walker.startCRC();
    walker.writeString("ALPH");

    alphaArray.forEach((a) => walker.writeUint8(a));

    walker.writeCRC();

    return finalBuffer;

}