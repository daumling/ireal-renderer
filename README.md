# ireal-renderer

Render an iReal Pro playlist in an HTML page.

Features:

- Renders (hopefully) any iReal Pro song into a jQuery container
- Scales nicely by changing the container's font size
- Transpose songs and set rendering options
- Uses a custom font to display musical symbols
- Almost no graphics included, except for a fake background for sections to make printers print the background
- Runs on almost any modern browser (IE excluded)
- Runs both in a Web and a node.js environment
- Print ready
- Demos for the Web and [Electron](http://electron.atom.io) included

Requirements:

- jQuery
- HTML 5 plus CSS grids
- Ecmascript 2015 (ES6)

### Modules

The package comes with two modules.

- `ireal-ready-tiny` - this module is a stripped down version of [Florin's (aka pianosnake) ireal-reader](https://github.com/pianosnake/ireal-reader).
It does not extract the music notes, and the peoperties of the Song object is a little different.

- `ireal-renderer` - the renderer does all the rendegin work; all it needs is a Song object, a jQuery container, and a few obtions.

### Install

#### npm

Install the module with `npm install ireal-renderer`. 

If you want to run the Electron demo, go to the `electron` folder anr run `npm install`,
then `electron .`, or `npm start`. The demo assumes that you have installed Electron
globally.

This snippet loads the demo playlist and renders the first song. The `renderSong()`
function is documented below.

``` javascript
const fs = require('fs');
const { Playlist, iRealRenderer } = require('ireal-renderer');

fs.readFile("ireal-playlist.html", "utf8", function(err, data) {
    if (err) throw err;
    const playlist = new Playlist(data);
    // see below
    renderSong(playlist, 0, $("#cong-container"));
});
```

### Web

Download the `ireal-renderer` directory, and include the contents:

``` html
<head>
    <link rel="stylesheet" href="/ireal-renderer/css/ireal-renderer.css">

    <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.js"></script>
    <script src="/ireal-renderer/ireal-reader-tiny.js"></script>
    <script src="/ireal-renderer/ireal-renderer.js"></script>
</head>
```
 
### Usage

The reader is straight forward to use. Its constructor accepts the iReal Pro playlist, which
is a HTML file with a special `ireal:` link protocol. It fills its `songs` array with Song
instances, which contain all necessary information about a song.

The rendering process is a three-step process. First, the iReal Pro music is parsed into cell
tokens. iReal Pro uses rows of 16 cells each, and each cell can have vertical bars, chords,
alternate chords, annotations, and more. The second step transposes the tokens and applies the
rendering options. The third and final pass does the actual rendering. This three-step approach
lets you apply your own changes to the cell tokens, by e.g. removing or altering comments.

Here is a generic function to render a song:

``` javascript
function renderSong(playlist, index, container) {
    // transposing options
    var options = {
        minor: "minus",     // how to render minor chords
        transpose: 0,       // number of half tones to transpose
        useH: false,        // use "H" instead of "B"
        hilite: true        // usge hiliting
    };
    var song = playlist.songs[index];
    var r = new iRealRenderer;
    r.parse(song);
    song = r.transpose(song, options);
    container.empty();
    container.append(`<h3>${song.title} (${song.key})</h3>`);
    r.render(song, container, options);
}
```

### Bugs

The package is most likely not bug-free at all,. It is simply impossible to think
of any possible way to render an iReal Pro song. Please feel free to contact me
with any songs that do not render correctly. Also, feel free to fork or submit 
pull requests. Use the demo to test the renderer.

## APIs

### ireal-reader-tiny

#### Playlist

`new Playlist(html)`

Constructs a new playlist using the text, which should contain an `ireal:` link.
The songs are available in its `songs` member.

#### Song

The Song class encapsulates an iReal Pro song. It has the following members:

- `title` - the title
- `key` - the key
- `composer` - the composer
- `transpose` - the number of half keys to transpose the song (as set in iReal Pro)
- `style` - the style, e.g. "Medium Swing"
- `exStyle` - extended style (the style set with the dwop-down in the lower left within iReal Pro)
- `bpm` - the beats per minute if set explicitly
- `repeats` - the number of repeats if set explicitly
- `music` - the contents of the song that the iRealReader class renders
- `cells` - an array of cell tokens, filled in after a call to `iRealRenderer.parse()`.

### ireal-renderer

#### iRealRenderer

`new iRealReader()`

The constructor does not take any arguments.

`parse(song)`

Parse the music string into cell tokens, and store an array of iRealToken instances
into the song's `cells` array. Each token is an object with the contents of a single #
cell. iReal Pro works with rows of 16 cells each.

`transpose(song, options)`

Apply the transposing options to the given song, and return a modified copy of the
song. The options have the following properties:

- `transpose` - the number of half tones to transpose the song. Note that this value
is added to the songs transpose value.
- `minor` - the way minor chords are rendered. "minus" display s minus sign as in "Bb-",
"m" displays a small "m" as in "Bbm", and "small" displays the note in small letters as
in "bb".
- `useH` - some countries prefer the letter "H" instead of the letter "B" for the note B.
Set this property to true to achieve this behavior.
- `hilite` - this option is for the renderer. If set to true, the renderer renders
annotations, sections, comments, over notes, alternate chords and measures in red.

`render(song, container, options)`

Render the song into the given jQuery container using the supplied options. Currently,
only the `hilite` option is supported (see above). Set the container's font size to 
scale the output.

#### iRealToken

The iRealToken class encapsulates a cell token. It contains these properties:

- `chord` - if non-null, a iRealChord object containing the main chord
- `comments` - an array of comment strings; these strings may begin with "*nn",
where "nn" is a displacement value of approximately 1/20em per unit.
- `annots` - a string of annotations:
  - "*x"  - section, like *v, *I, *A, *B etc
  - "Nx"  - repeat signs (N1, N2 etc)
  - "Q"   - coda
  - "S"   - segno
  - "Txx" - measure (T44 = 4/4 etc, but T12 = 12/8)
  - "U"   - END
  - "f"   - fermata
  - "l"   - (letter l) normal font width
  - "s"   - condensed font width
- `bars`- a string describing the bars:
  - "|" - single vertical bar, left
  - "[" - double bar, left
  - "]" - double bar, right
  - "{" - repeat bar, left
  - "}" - repeat bar, right
  - "Z" - end bar, right
- `spacer` - a number indicating the number of vertical spacers above this cell

#### iRealChord

This class wraps a chord speficier with these members:

- `note` - the base note; this can also be one of the following:
  - "W" - invisible root
  - "p" - pause
  - "x" - single repeat
  - "r" - double repeat
- `modifiers` - a string with the chord modifiers, like 7, +, -, o etc
- `over` - if non-null, an iRealChord object containing the over note
- `alternate` - if non-null, a iRealChord object for the alternate chord 

## License

[MIT (Public Domain)](LICENSE.md)

## Acknowledgments

The irealb schema was originally cracked by Stephen Irons' 
[Accompaniser](https://github.com/ironss/accompaniser). 

The Playlist class is a stripped down version of 
[Florin's (aka pianosnake) ireal-reader](https://github.com/pianosnake/ireal-reader).

The iRealFont is a modified extract from [Steinberg's public domain Bravura font](https://github.com/steinbergmedia/bravura).
