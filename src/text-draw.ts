import { PngPong, Palette, IHDROptions } from 'png-pong';
import { PngPongFontReader } from './font-file-reader';

interface TextDrawOperation {
    glyphIndex: number;
    font: PngPongFontReader;
    color: RGBColor;
    backgroundColor: RGBColor;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}

export type RGBColor = [number, number, number];

function alphaBlend(color1: RGBColor, color2: RGBColor, alpha: number) {

    let alphaMultiply = alpha / 255;

    let redDiff = color1[0] - color2[0];
    let greenDiff = color1[1] - color2[1];
    let blueDiff = color1[2] - color2[2];

    let newColor = [
        color1[0] - Math.round(redDiff * alphaMultiply),
        color1[1] - Math.round(greenDiff * alphaMultiply),
        color1[2] - Math.round(blueDiff * alphaMultiply)
    ]

    return newColor as [number, number, number]

}

function colorsEqual(color1: RGBColor, color2: RGBColor) {
    return color1[0] === color2[0]
        && color1[1] === color2[1]
        && color1[2] === color2[2];
}

export class PngPongTextWriter {

    private operations: TextDrawOperation[] = [];
    private imageWidth: number;
    private palette: Palette;

    constructor(private transformer: PngPong) {
        transformer.onPalette(this.onPalette.bind(this));
        transformer.onData(this.onData.bind(this));
        transformer.onHeader(this.onHeader.bind(this));
    }

    onHeader(header: IHDROptions) {
        this.imageWidth = header.width;
    }

    onPalette(palette: Palette) {

        this.palette = palette;

        interface FontColorPair {
            font: PngPongFontReader;
            color: RGBColor;
            backgroundColor: RGBColor;
        }

        let fontColorPairs: FontColorPair[] = [];

        // We need to add our palette entries before we draw. Given that each operation
        // might be a different font and/or colour, we make unique pairs first.

        this.operations.forEach((operation) => {

            let existing = fontColorPairs.some((pair) => {
                return pair[0] === operation.font
                    && colorsEqual(operation.color, pair.color) === true
                    && colorsEqual(operation.backgroundColor, pair.backgroundColor) === true
            });

            if (!existing) {
                fontColorPairs.push(operation);
            }


        })

        fontColorPairs.forEach((operation) => {

            let allAlphas = operation.font.getAllAlphasUsedByFont();

            allAlphas.forEach((a) => {

                let color = alphaBlend(operation.backgroundColor, operation.color, a);

                if (palette.getColorIndex(color) === -1) {
                    palette.addColor(color);
                }
            })


        });
    }

    onData(array: Uint8Array, readOffset: number, x: number, y: number, length: number) {

        for (let idx = 0; idx < this.operations.length; idx++) {
            let op = this.operations[idx];

            if (!(op.yMin <= y && op.yMax > y
                && (op.xMin > x || (op.xMax > x) && op.xMax < x + length))) {
                continue;
            }

            for (let i = Math.max(op.xMin, x); i < Math.min(op.xMax, x + length); i++) {

                let row = y - op.yMin;
                let column = i - op.xMin;

                let alpha = op.font.getGlyphAlpha(op.glyphIndex, row, column);

                if (alpha === 0) {
                    continue;
                }

                let colorToGet = alphaBlend(op.backgroundColor, op.color, alpha);

                let paletteIdx = this.palette.getColorIndex(colorToGet);

                if (paletteIdx === -1) {
                    throw new Error("Requested color is not in palette:" + colorToGet.join(","));
                }

                array[readOffset - x + i] = paletteIdx;

            }

        }




        // operationsThatApply.forEach((op) => {

        //     let row = y - op.yMin;

        //     for (let i = 0; i < (op.xMax - op.xMin); i++) {

        //         if (op.xMin + i > length) {
        //             break;
        //         }

        //         let alpha = op.font.getGlyphAlpha(op.glyphIndex, row, i);

        //         if (alpha === 0) {
        //             continue;
        //         }

        //         let colorToGet = alphaBlend(op.backgroundColor, op.color, alpha);

        //         let paletteIdx = this.palette.getColorIndex(colorToGet);

        //         if (paletteIdx === -1) {
        //             console.error(op.backgroundColor, op.color, alpha, row, i)
        //             throw new Error("Requested color is not in palette:" + colorToGet.join(","));
        //         }

        //         array[readOffset + op.xMin + i] = paletteIdx;

        //     }



        // })



        // for (let i = 0; i < length; i++) {

        //     operationsThatApply.forEach((op) => {

        //         if (y < op.yMin || y >= op.yMax || x < op.xMin || x >= op.xMax) {
        //             return;
        //         }

        //         let row = y - op.yMin;
        //         let column = x - op.xMin;

        //         let alpha = op.font.getGlyphAlpha(op.glyphIndex, row, column);

        //         if (alpha === 0) {
        //             return;
        //         }

        //         let colorToGet = alphaBlend(op.backgroundColor, op.color, alpha);

        //         let paletteIdx = this.palette.getColorIndex(colorToGet);

        //         if (paletteIdx === -1) {
        //             console.error(op.backgroundColor, op.color, alpha, row, column)
        //             throw new Error("Requested color is not in palette:" + colorToGet.join(","));
        //         }

        //         array[readOffset + i] = paletteIdx;

        //     })


        //     x++;
        //     if (x > this.imageWidth) {
        //         y++;
        //         x = 0;
        //     }
        // }


    }

    draw(text: string, font: PngPongFontReader, color: RGBColor, backgroundColor: RGBColor, x: number, y: number) {

        let startingX = x;
        for (let i = 0; i < text.length; i++) {

            let glyphIndex = font.getIndexForGlyph(text[i]);

            let yMin = y + font.yMin;
            let yMax = y + font.yMax;
            let xMax = x + font.getGlyphWidth(glyphIndex);

            this.operations.push({
                glyphIndex,
                font,
                color,
                backgroundColor,
                xMin: x,
                xMax,
                yMin,
                yMax
            });

            x += font.getGlyphWidth(glyphIndex);


        }

        return x - startingX;

    }

}