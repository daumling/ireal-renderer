/* 
 * iRealRenderer
 * 
 * Render any iReal Pro song into an HTML container element.
 */

class iRealRenderer {
	constructor() {
		this.transposeFlat = [
			"C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
			"C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"
		];
		this.transposeSharp = [
			"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
			"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
		];
		this.cells = [];
		// This is set to true if the renderer is to render as a web component.
		// It inhibits the creation of a <irr-chords>tag because the tag is
		// already created as a web component. For now, just ignore the setting.
		this.isComponent = false;
	}

	/**
	 * The parser cracks up the music string at song.music into several objects, 
	 * one for each cell. iReal Pro works with rows of 16 cell each. The result
	 * is stored at song.cells.
	 * 
	 * Each object has the following properties:
	 * 
	 * chord: if non-null, a chord object with these properties:
	 *   note      - the base note (also blank, W = invisible root, p/x/r - pause/bar repeat/double-bar repeat, n - no chord)
	 *   modifiers - the modifiers, like 7, + o etc (string)
	 *   over      - if non-null, another chord object for the under-note
	 *   alternate - if non-null another chord object for the alternate chord 
	 * annots: annotations, a string of:
	 *  *x  - section, like *v, *I, *A, *B etc
	 *  Nx  - repeat bots (N1, N2 etc)
	 *  Q   - coda
	 *  S   - segno
	 *  Txx - measure (T44 = 4/4 etc, but T12 = 12/8)
	 *  U   - END
	 *  f   - fermata
	 *  l   - (letter l) normal notes
	 *  s   - small notes
	 * comments: an array of comment strings
	 * bars: bar specifiers, a string of:
	 *  | - single vertical bar, left
	 *  [ - double bar, left
	 *  ] - double bar, right
	 *  { - repeat bar, left
	 *  } - repeat bar, right
	 *  Z - end bar, right
	 * spacer - a number indicating the number of vertical spacers above this cell
	 * 
	 * @param {Song} song
	 * @returns {undefined}
	 */
	parse(song) {
		var text = song.music;
		var arr = [], headers = [], comments = [];
		var i;
		text = text.trimRight();
		while(text) {
			var found = false;
			for (i = 0; i < iRealRenderer.regExps.length; i++) {
				var match = iRealRenderer.regExps[i].exec(text);
				if (match) {
					found = true;
					if (match.length <= 2) {
						match = match[0];
						arr.push(match);
						text = text.substr(match.length);
					}
					else {
						// a chord
						arr.push(match);
						text = text.substr(match[0].length);
					}
					break;
				}
			}
			if (!found) {
				// ignore the comma separator
				if (text[0] !== ',')
					arr.push(text[0]);
				text = text.substr(1);
			}
		}
//		console.log(arr);
		// pass 2: extract prefixes, suffixes, annotations and comments
		var out = [];
		var obj = this.newToken(out);
		var prevobj = null;
		for (i = 0; i < arr.length; i++) {
			var token = arr[i];
			if (token instanceof Array) {
				obj.chord = this.parseChord(token);
				token = " ";
			}
			switch (token[0]) {
				case '{':	// open repeat
				case '[':	// open double bar
					obj.bars = token; token = null; break;
				case '|':	// single bar - close previous and open this
					if (prevobj) { prevobj.bars += ')'; prevobj = null; }
					obj.bars = '('; token = null; break;
				case ']':	// close double bar
				case '}':	// close repeat
				case 'Z':	// ending double bar
					if (prevobj) { prevobj.bars += token; prevobj = null; }
					token = null; break;
				case 'n':	// N.C.
					obj.chord = new iRealChord(token[0]);
					break;
				case ',':	token = null; break; // separator
				case 'S':	// segno
				case 'T':	// time measurement
				case 'Q':	// coda
				case 'N':	// repeat
				case 'U':	// END
				case 's':	// small
				case 'l':	// normal
				case 'f':	// fermata
				case '*': obj.annots.push(token); token = null; break;
				case 'Y': obj.spacer++; token = null; prevobj = null; break;
				case 'r':
				case 'x':
				case 'W':
					obj.chord = new iRealChord(token);
					break;
				case '<': 
					token = token.substr(1, token.length-2);
					obj.comments.push(token); 
					token = null; break;
				default:
			}
			if (token && i < arr.length-1) {
				prevobj = obj;		// so we can add any closing barline later
				obj = this.newToken(out);
			}
		}
//		console.log(out);
		song.cells = out;
	}
	
	parseChord(match) {
		var note = match[1] || " ";
		var modifiers = match[2] || "";
		var comment = match[3] || "";
		if (comment)
			modifiers += comment.substr(1, comment.length-2);
		var over = match[4] || "";
		if (over[0] === '/')
			over = over.substr(1);
		var alternate = match[5] || null;
		if (alternate) {
			match = iRealRenderer.chordRegex.exec(alternate.substr(1, alternate.length-2));
			if (!match)
				alternate = null;
			else
				alternate = this.parseChord(match);			
		}
		// empty cell?
		if (note === " " && !alternate && !over)
			return null;
		if (over) {
			var offset = (over[1] === '#' || over[1] === 'b') ? 2 : 1;
			over = new iRealChord(over.substr(0, offset), over.substr(offset), null, null);
		}
		else
			over = null;
		modifiers = modifiers.replace(/b/g, "\u266d").replace(/#/g, "\u266f");	// convert to proper flat and sharp
		return new iRealChord(note, modifiers, over, alternate);
	}
	
	newToken(arr) {
		var obj = new iRealToken;
		arr.push(obj);
		return obj;
	}
	
	////////////////////////////////////////////////////////////////////////////

	/**
	 * Transpose a song. Use the following options:
	 * 
	 * transpose: 
	 *   a value between -6 and 15 as halftones
	 * minor:
	 *   small - convert Bb- to bb
	 *   m     - convert Bb- to Bbm
	 * useH:
	 *   use H for B chords
	 * @param {type} song
	 * @param {type} options
	 * @returns {undefined}
	 */
	transpose(song, options) {
		song = Object.assign({}, song);
		if (song.cells)
			song.cells = song.cells.slice(0);
		var chord = { note: song.key, modifiers:"", over: null, alternate: null };
		if (chord.note.endsWith("-")) {
			chord.note = song.key.substr(0, song.key.length-1);
			chord.modifiers = "-";
		}
		options.transpose += song.transpose;
		this.transposeChord(chord, options);
		song.key = chord.note + chord.modifiers;
		if (song.cells)
			song.cells = song.cells.map(el => {
				if (el.chord)
					this.transposeChord(el.chord, options);
				return el;
			});
		options.transpose -= song.transpose;
		return song;
	}
		
	/**
	 * Transpose the given chord; use the given options.
	 * @param {Object} chord
	 * @param {Object} options
	 * @returns {String}
	 */
	transposeChord(chord, options) {
		var arr = this.transposeFlat;
		var i = arr.indexOf(chord.note);
		if (i < 0) {
			arr = this.transposeSharp;
			i = arr.indexOf(chord.note);
		}
		if (i >= 0) {
			i += (options.transpose % 12);
			if (i < 0)
				i += 12;
			chord.note = arr[i];
			if (options.useH && chord.note === "B")
				chord.note = "H";
		}
		if (chord.modifiers.includes("-")) {
			switch (options.minor) {
				case "small":
					var note = chord.note[0].toLowerCase();
					if (chord.note[1])
						note += chord.note[1];
					chord.note = note;
					chord.modifiers = chord.modifiers.replace("-", "");
					break;
				case "m":
					chord.modifiers = chord.modifiers.replace("-", "m");
					break;
			}
		}
		if (chord.alternate)
			this.transposeChord(chord.alternate, options);
		if (chord.over)
			this.transposeChord(chord.over, options);
	}
	
	////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Render the parsed array.
	 * @param {Song} song - with attached cells property
	 * @param {Element} container - HTML container element to render into (appends)
	 * @param {Object} options - render annots, comments etc in red if hilite property is set
	 * @returns {undefined}
	 */
	render(song, container, options = {}) {
		if (!song.cells)
			return;
		var hilite = options.hilite || false;
		if (!this.isComponent) {
			var table = document.createElement("irr-chords");
			if (hilite)
				table.setAttribute("hilite", "");
			container.appendChild(table);
		}
		else
			table = container;
		this.cell = -1;
		this.closebar = false;
		this.small = false;
		this.hilite = hilite;
		
		for (var i = 0; i < song.cells.length; i++) {
			var cell = song.cells[i];
			if (this.cell < 0 || this.cell === 15)
				this.nextRow(table, cell.spacer);
			else
				this.cell++;
			var html = "";
			if (cell.annots.length)
				html += this.annotHtml(cell.annots);
			if (cell.comments.length)
				html += this.commentHtml(cell.comments);
			html += this.cellHtml(cell);
			var el = this.cells[this.cell];
			var cls = "";
			if (this.small)
				cls += "small";
			if (cell.comments.length)
				cls += " irr-comment";
			if (cls)
				el.setAttribute("class", cls.trim());
			el.innerHTML = html;
			this.closebar = cell.bars.indexOf(')') >= 0;
		}
	}
	
	////////////////////////////////////////////////////////////////////////////
	
	// Private methods
	
	cellHtml(data) {
		let html = "";
		if (data.chord) html = this.chordHtml(data.chord);
		for (var i = 0; i < data.bars.length; i++) {
			let c = data.bars[i];
			let cls = iRealRenderer.classes[c];
			switch(c) {
				case '(':
				case '[':
				case '{':
					html = `<irr-lbar class="${cls}"></irr-lbar>` + html; break;
				//case ')':	// not handled here, only at end of line below
				case ']':
				case '}':
				case 'Z':
					html = `<irr-rbar class="${cls}"></irr-rbar>` + html; break;
			}
		}
		if (!html)
			return html;
		return `<irr-chord>${html}</irr-chord>`;
	}
		
	chordHtml(chord) {
		if (typeof chord === "string") {
			chord = iRealRenderer.chordRegex.exec(chord);
			if (!chord)
				return;
		}
		var html = this.baseChordHtml(chord);
		var { alternate, over } = chord;
		if (over)
			html += `<irr-over>${this.baseChordHtml(over)}</irr-over>`;
		if (alternate) 
			html = `<irr-chord>${this.chordHtml(alternate)}</irr-chord>` + html;
		return html;
	}
	
	baseChordHtml(chord) {
		var { note, modifiers } = chord;
		if (note === "W")
			note = `<irr-char class="irr-root Root"></irr-char>`;
		if (note === "p")
			note = `<irr-char class="Repeated-Figure1"></irr-char>`;
		if (["x", "r", "n"].includes(note)) {
			// 1-bar repeat, 2-bar repeat, and no-chord
			note = `<irr-char class="${iRealRenderer.classes[note]}"></irr-char>`;
		}
		var sup = "";
		switch(note[1]) {
			case 'b': sup = "<sup>\u266d</sup>"; note = note[0]; break;
			case '#': sup = "<sup>\u266f</sup>"; note = note[0]; break;
		}
		if (modifiers)
			modifiers = `<sub>${modifiers.replace("^", "\u25B3").replace("h", "\u00D8")}</sub>`;
		return `${note}${sup}${modifiers}`;
	}
	
	/**
	 * Render an annotation.
	 * @param {type} annots
	 * @returns {undefined}
	 */
	annotHtml(annots) {
		var t = "";
		for (var i = 0; i < annots.length; i++) {
			var annot = annots[i];
			var s;
			switch(annot[0]) {
				case '*':	// section
					s = annot[1];
					switch(s) {
						case "i": s = "In"; break;
					}
					t += `<irr-section>${s}</irr-section>`;
					break;
				case 'N':	// repeat bracket
					t += `<irr-repeat>${annot[1]}</irr-repeat>`; break;
				case 'f':	// fermata
				case 'Q':	// coda
				case 'S':	// segno
					t += `<irr-annot class="${iRealRenderer.classes[annot[0]]}"></irr-annot>`; break;
					break;
				case 'T':	// measure: Txx, where T12 is 12/8
					var m1 = annot.charCodeAt(1) - 48;
					var m2 = annot.charCodeAt(2) - 48;
					if (m1 === 1 && m2 === 2)
						m1 = 12, m2 = 8;
					s = `<irr-measure><span class="Measure-${m1}-Low"></span><br/><span class="Measure-${m2}-High"></span></irr-measure>`;
					t = s + t;
					break;
				case 's':
					this.small = true; break;
				case 'l':
					this.small = false; break;
			}
		}
		return t;
	}
	
	commentHtml(comments) {
		var cell = this.cells[this.cell];
		var style = getComputedStyle(cell);
		var top = parseInt(style.height) + parseInt(style["margin-top"]);
		var html = "";
		for (var i = 0; i < comments.length; i++) {
			var c = comments[i];
			var offset = 0;
			if (c[0] === '*') {
				offset = (c.charCodeAt(1) - 48) * 10 + (c.charCodeAt(2) - 48);
				c = c.substr(3);
			}
			// assume that 1 unit is = 1/20 em
			offset /= 20;
			html += `<irr-comment style="margin-top:${-offset}em">${c}</irr-comment>`;
		}
		return html;
	}
	
	nextRow(table, spacer) {
		this.checkIfNeedsLastBar();
		// insert a spacer
		if (spacer) {
			var spc = document.createElement("irr-spacer");
			spc.setAttribute("style", `height:${spacer*10}px`);
			table.appendChild(spc);
		}
		this.cells = [];
		for (let i = 0; i < 16; i++) {
			var cell  = document.createElement("irr-cell");
			this.cells.push(cell);
			table.appendChild(cell);
		}
		
		this.cell = 0;
	}

	/**
	 * Check if the current cell is the last cell of a row, and if it
	 * needs a closing bar. This is true if there has been an opening
	 * bar in the last 4 cells.
	 */
	checkIfNeedsLastBar() {
		if (this.cell !== 15)
			return;
		if (!this.closebar)
			return;
		let curCell = this.cells[this.cell];
		var bar = document.createElement("irr-rbar");
		bar.classList.add("Single-Barline");
		curCell.insertBefore(bar, curCell.firstChild);	// must insert, not append, for correct positioning
	}
}

/**
 * The RegExp for a complete chord. The match array contains:
 * 1 - the base note
 * 2 - the modifiers (+-ohd0123456789 and su for sus)
 * 3 - any comments (may be e.g. add, sub, or private stuff)
 * 4 - the "over" part starting with a slash
 * 5 - the top chord as (chord)
 * @type RegExp
 */
iRealRenderer.chordRegex = /^([A-Gxnr][b#]?)((?:sus|alt|add|[\+\-\^\dhob#])*)(\*.+?\*)*(\/[A-G][#b]?)?(\(.*?\))?/;
iRealRenderer.chordRegex2 = /^([ Wp])()()(\/[A-G][#b]?)?(\(.*?\))?/;	// need the empty captures to match chordRegex

iRealRenderer.regExps = [
	/^\*[a-zA-Z]/,							// section
	/^T\d\d/,								// time measurement
	/^N./,									// repeat marker
	/^<.*?>/,								// comments
	iRealRenderer.chordRegex,				// chords
	iRealRenderer.chordRegex2,				// space, W and p (with optional alt chord)
];

iRealRenderer.cssPrefix = "";

iRealRenderer.classes = {
	'(': "Single-Barline",
	')': "Single-Barline",
	'[': "Double-Barline",
	']': "Double-Barline",
	"?Z0": "Final-Barline",
	'Z': "Reverse-Final-Barline",
	'{': "Left-Repeat-Sign",
	'}': "Right-Repeat-Sign",
	"?DS": "Dal-Segno",
	"?DC": "Da-Capo",
	n: "No-Chord",
	f: "Fermata",
	S: "Segno",
	Q: "Coda",
	"?Q": "Codetta",
	W: "Root",
	"?W": "Root-Filled",
	p: "Repeated-Figure1",
	x: "Repeated-Figure2",
	r: "Repeated-Figure3",
	"?r4": "Repeated-Figure4",
	"0L": "Measure-0-Low",
	"1L": "Measure-1-Low",
	"2L": "Measure-2-Low",
	"3L": "Measure-3-Low",
	"4L": "Measure-4-Low",
	"5L": "Measure-5-Low",
	"6L": "Measure-6-Low",
	"7L": "Measure-7-Low",
	"8L": "Measure-8-Low",
	"9L": "Measure-9-Low",
	"10L": "Measure-10-Low",
	"11L": "Measure-11-Low",
	"12L": "Measure-12-Low",
	"0H": "Measure-0-High",
	"1H": "Measure-1-High",
	"2H": "Measure-2-High",
	"3H": "Measure-3-High",
	"4H": "Measure-4-High",
	"5H": "Measure-5-High",
	"6H": "Measure-6-High",
	"7H": "Measure-7-High",
	"8H": "Measure-8-High",
	"9H": "Measure-9-High",
	"10H": "Measure-10-High",
	"11H": "Measure-11-High",
	"12H": "Measure-12-High"
};

if (typeof module !== "undefined")
	module.exports = { iRealRenderer, Playlist: require("./ireal-reader-tiny.js") };


class iRealToken {
	constructor() {
		this.annots = [];
		this.comments = [];
		this.bars = "";
		this.spacer = 0;
		this.chord = null;
	}
}

class iRealChord {
	constructor(note, modifiers = "", over = null, alternate = null) {
		this.note = note;
		this.modifiers = modifiers;
		this.over = over;
		this.alternate = alternate;
	}
}
