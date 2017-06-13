# PngPongFont

A text writing transformer for [PngPong](https://github.com/gdnmobilelab/png-pong).

## What is it?

PngPong lets you draw shapes and copy sections of images. PngPongFont lets you
write text. Much like PngPong, there are some major restrictions - primarily that
it requires you to use a bespoke file format for font definitions, and that file
can only contain one font size.

This is because PngPongFont basically does the same thing PngPong does when copying
an image, directly copying pixels from source to destination. So it doesn't try to
deal with scaling, anti-aliasing, etc. etc. - that is all contained in the source
file.

## The PngPongFont file format

PngPongFont uses a special file format, which uses the same basic structure as a
PNG file - chunks, with headers and CRC checks. It has four blocks:

- **IHDR**: a header with basic info like the font size, line height, width of the 
bitmap font image, and file format version.
- **GLPH**: an index describing which glyphs match up to which numeric indexes in 
the next block.
- **OFFS**: pixel offsets for each font glyph in the actual source image.
- **KERN**: an optional block describing the kerning pairs between each glyph. 
*NOTE:* this is not currently used in rendering (but will be!)
- **ALPH**: a long data block containing the alpha values for each glyph. Each 
glyph is written next to each other in one long horizontal line. A combination of 
the bitmap width, glyph index and glyph offset allow us to 'slice' out the 
appropriate glyph when drawing.

Much like our PngPong source PNGs, the font files are not compressed at all, so
it's strongly recommended you GZIP them when serving to users.

## Making a font file

The NPM package has a CLI tool to create font files. First run:

    npm install -g png-pong-font

then you can run:

    create-pngpong-font --input my-font-file.ttf --output font.pngpongfont --size 20

to generate a file. Run `create-pngpng-font --help` to get a list of all arguments.

Right now the tool only outputs a basic character set (as defined in 
`character-sets.ts`) - more options will be available eventually. The input file
must be parsable by [opentype.js](https://opentype.js.org/), and your computer
must have meet all of the dependency requirements for [node-canvas](https://github.com/Automattic/node-canvas).

## Using the font file with PngPong.

There are two main components to the client side of PngPongFont - 
`PngPongFontReader` and `PngPongTextWriter`. Use them like so:

    import { PngPongFontReader, PngPongTextWriter } from 'png-pong-font';

    fetch("./font.pngpongfont")
    .then((res) => res.arrayBuffer())
    .then((ab) => {

        let font = new PngPongFontReader(ab);
        let writer = new PngPongTextWriter(pngPongInstance);

        // Draw "Hello!" in red, on a white background, at 10px from the top
        // and 20px from the left.

        writer.draw("Hello!", font, [255, 0, 0], [255, 255, 255], 20, 10);

        pngPongInstance.run();

    })

You can use more than one font with a writer.

## Next steps

Right now the library does not use kerning pairs when rendering text. opentype.js
returns them as an absolute value, and I can't work out how to make that relative
to font size (and didn't have time to work it out).