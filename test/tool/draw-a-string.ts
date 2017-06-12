import * as path from 'path';
import { generateFontFile } from '../../src/tool/create-font-file';
import { PngPongFontReader } from '../../src/font-file-reader';
import { createBlankPNG } from 'png-pong/lib/test/util/blank-png';
import { PngPong, Palette, PngPongShapeTransformer } from 'png-pong';
import { PngPongTextWriter } from '../../src/text-draw';

describe("Draw a string", () => {

    it("should work I guess 1", () => {

        let fontPath = path.join(__dirname, '..', '..', '..', 'test-sources', 'Roboto-Regular.ttf');

        let resultBuffer = generateFontFile(fontPath, 20);

        let reader = new PngPongFontReader(resultBuffer);

        let stringToWrite = "(Helloasdasdasdasdasdasdadsdfsdfsdfsdfsdfsdfsdfads?)";

        let blankPng = createBlankPNG(622, 400, [255, 255, 255, 255], 254);

        let transformer = new PngPong(blankPng);

        let writer = new PngPongTextWriter(transformer);

        let shape = new PngPongShapeTransformer(transformer);

        shape.drawRect(0, 20, 200, 1, [0, 0, 0]);


        writer.draw(stringToWrite, reader, [255, 0, 0], [255, 255, 255], 0, 330);

        transformer.run();


    })

    it("should work I guess", () => {
        let fontPath = path.join(__dirname, '..', '..', '..', 'test-sources', 'Roboto-Regular.ttf');

        let resultBuffer = generateFontFile(fontPath, 20);

        let reader = new PngPongFontReader(resultBuffer);

        let stringToWrite = "Hello?";

        let blankPng = createBlankPNG(200, 100, [255, 255, 255, 255], 254);

        let transformer = new PngPong(blankPng);

        function alphaBlend(color1: number[], color2: number[], alpha: number): [number, number, number] {

            let alphaMultiply = alpha / 255;

            let redDiff = color1[0] - color2[0];
            let greenDiff = color1[1] - color2[1];
            let blueDiff = color1[2] - color2[2];

            let newColor = [
                color1[0] - (redDiff * alphaMultiply),
                color1[1] - (greenDiff * alphaMultiply),
                color1[2] - (blueDiff * alphaMultiply)
            ]

            return newColor as [number, number, number]

        }

        let pal: Palette;
        transformer.onPalette((palette) => {

            pal = palette;

            palette.addColor([255, 0, 0, 255]);

            let textColor = [255, 0, 0];

            let allAlphas = reader.getAllAlphasUsedByFont();
            allAlphas.forEach((a) => {

                let color = alphaBlend([255, 255, 255], [255, 0, 0], a);

                if (palette.getColorIndex(color) === -1) {
                    palette.addColor(color);
                }
            })

        });

        let letters = ["a", ",", "c"];

        interface DrawInstruction {
            glyphIndex: number;
            x: number;
            width: number;
        }

        let currentX = 0;

        let letterIndexes = letters.map((l) => reader.getIndexForGlyph(l));

        let drawInstructions: DrawInstruction[] = letterIndexes.map((letterIndex, idx) => {

            let width = reader.getGlyphWidth(letterIndex);

            let instruction = {
                glyphIndex: letterIndex,
                x: currentX,
                width: width
            }

            currentX += width;

            if (idx < letters.length - 1) {
                // If there is a next letter, we check the kerning values

                let kern = reader.getKerning(letterIndex, letterIndexes[idx + 1]);
                currentX += kern;


            }

            return instruction;

        });

        transformer.onData((array, readOffset, dataOffset, length) => {

            let x = dataOffset % 200;
            let y = (dataOffset - x) / 200;

            // console.log(x, y, length)

            for (let i = 0; i < length; i++) {

                if (y > 20) {
                    return;
                }

                drawInstructions.forEach((d) => {

                    let xRelativeToLetter = x - d.x;

                    if (xRelativeToLetter < 0 || xRelativeToLetter > d.width) {
                        return;
                    }

                    let alpha = reader.getGlyphAlpha(d.glyphIndex, y, xRelativeToLetter);

                    let colorToGet = alphaBlend([255, 255, 255], [255, 0, 0], alpha);

                    let paletteIdx = pal.getColorIndex(colorToGet);
                    array[readOffset + i] = paletteIdx;
                })


                // if (x < width && y < 20) {
                //     let alpha = reader.getGlyphAlpha(letter, y, x);

                //     let colorToGet = alphaBlend([255, 255, 255], [255, 0, 0], alpha);

                //     let paletteIdx = pal.getColorIndex(colorToGet);
                //     array[readOffset + i] = paletteIdx;
                // }

                x++;
                // array[readOffset + i] = 2;
            }

        })

        transformer.run();

        let b = new Buffer(blankPng);

        require('fs').writeFileSync('/tmp/text2.png', b)

    })

})