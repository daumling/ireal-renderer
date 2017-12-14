/* 
 * iRealRenderer
 * 
 * Render any iReal Pro song into a jQuery <div>. You should make use of 
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
	}

	/**
	 * The parser cracks up the music string at song.music into several objects, 
	 * one for each cell. iReal Pro works with rows of 16 cell each. The result
	 * is stored at song.cells.
	 * 
	 * Each object has the following properties:
	 * 
	 * chord: if non-null, a chord object with these properties:
	 *   note      - the base note (also blank, W = invisible root, p/x/r - pause/bar repeat/double-bar repeat)
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
						var repl = iRealRenderer.replacements[match];
						if (repl)
							arr = arr.concat(repl);
						else
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
		for (i = 0; i < arr.length; i++) {
			var token = arr[i];
			if (token instanceof Array) {
				obj.chord = this.parseChord(token);
				token = " ";
			}
			switch (token[0]) {
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
				case 'Y': obj.spacer++; token = null; break;
				case 'r':
				case 'x':
				case 'W':
					obj.chord = new iRealChord(token, "", null, null);
					break;
				case '<': 
					token = token.substr(1, token.length-2);
					token = token.replace(/XyQ/g, "   ");	// weird; needs to be done
					obj.comments.push(token); 
					token = null; break;
				default:
			}
			if (token) {
				if ("]}Z".indexOf(arr[i+1]) >= 0)
					obj.bars += arr[++i];
				if ("{[|".indexOf(token) >= 0) {
					obj.bars += token; token = null;
				}
			}
			if (token && i < arr.length-1) {
				obj.token = token;
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
			modifiers += comment.substr(1, comment.length-2).replace("XyQ", "   ");
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
	 * @param {Element} container - jQuery element of container to render into
	 * @param {Object} options - render annots, comments etc in red if hilite property is set
	 * @returns {undefined}
	 */
	render(song, container, options = {}) {
		if (!song.cells)
			return;
		var hilite = options.hilite || false;
		var table = $(`<irr-chords></irr-chords>`);
		if (hilite)
			table.attr("data-hilite", "true");
		container.append(table);
		this.cell = -1;
		this.small = false;
		this.hilite = hilite;
		
		for (var i = 0; i < song.cells.length; i++) {
			var cell = song.cells[i];
			if (this.cell < 0 || this.cell === 15 || cell.spacer)
				this.nextRow(table, cell.spacer);
			else
				this.cell++;
			var html = this.cellHtml(cell);
			if (cell.annots.length)
				html += this.annotHtml(cell.annots);
			if (cell.comments.length)
				html += this.commentHtml(cell.comments);
			var el = this.cells[this.cell];
			if (this.small)
				el.addClass("irr-small");
			else
				el.removeClass("irr-small");
			if (cell.comments.length)
				el.addClass("irr-comment");
			el.html(html);
		}
	}
	
	////////////////////////////////////////////////////////////////////////////
	
	// Private methods
	
	cellHtml(data) {
		var html = "";
		if (data.chord)
		  switch(data.chord.note) {
			case 'x':	// 1-bar repeat
				html = `<irr-char class="single-repeat">\ue021</irr-char>`; break;
				break;
			case 'r':	// 2-bar repeat
				html = `<irr-char class="double-repeat">\ue022</irr-char>`; break;
			case 'p':	// pause
				html = `<irr-char>\ue020</irr-char>`; break;
				break;
			case 'n':	// D.C.
				html = `<irr-char>\ue011</irr-char>`; break;
				break;
			default:
				html = this.chordHtml(data.chord);
		}
		for (var i = 0; i < data.bars.length; i++) {
			switch(data.bars[i]) {
				case '|': html = `<irr-lbar>\ue000</irr-lbar>` + html; break;
				case '[': html = `<irr-lbar>\ue001</irr-lbar>` + html; break;
				case '{': html = `<irr-lbar>\ue004</irr-lbar>` + html; break;
				case ']': html += `<irr-rbar>\ue001</irr-rbar>`; break;
				case '}': html += `<irr-rbar>\ue005</irr-rbar>`; break;
				case 'Z': html += `<irr-rbar>\ue003</irr-rbar>`; break;
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
			html += `<irr-chord>${this.chordHtml(alternate)}</irr-chord>`;
		return html;
	}
	
	baseChordHtml(chord) {
		var { note, modifiers } = chord;
		if (note === "W")
			note = `<irr-char class="irr-root">\uE017</irr-char>`;
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
					t += '<irr-repeat>' + annot[1] + '</irr-repeat>'; break;
				case 'f':	// fermata
					t += "<irr-annot>\ue012</irr-annot>"; break;
				case 'Q':	// coda
					t += "<irr-annot>\ue014</irr-annot>"; break;
				case 'S':	// segno
					t += "<irr-annot>\ue013</irr-annot>"; break;
					break;
				case 'T':	// measure: Txx, where T12 is 12/8
					var m1 = annot.charCodeAt(1) - 48;
					var m2 = annot.charCodeAt(2) - 48;
					if (m1 === 1 && m2 === 2)
						m1 = 12, m2 = 8;
					m1 = String.fromCharCode(m1 + 0xE030);
					m2 = String.fromCharCode(m2 + 0xE040);
					s = `<irr-measure>${m1}<br/>${m2}</irr-measure>`;
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
		var style = getComputedStyle(cell[0]);
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
		var i;

		// check if the last cell has a right border
		if (!spacer && this.cell >= 0) {
			var cell = this.cells[this.cell];
			if ($("irr-rbar", cell).length === 0)
				cell.append(`<irr-rbar>\ue000</irr-rbar>`);
		}
		// insert a spacer
		if (spacer)
			table.append(`<irr-spacer style="height:${spacer*10}px"></irr-spacer>`);
		
		this.cells = [];
		for (i = 0; i < 16; i++) {
			var cell  = $("<irr-cell/>");
			this.cells.push(cell);
			table.append(cell);
		}
		
		this.cell = 0;
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
iRealRenderer.chordRegex = /^([ A-GW][b#]?)((?:sus|[\+\-\^\dhob#])*)(\*.+?\*)*(\/[A-G][#b]?)?(\(.*?\))?/;

iRealRenderer.regExps = [
	/^\*[a-zA-Z]/,							// section
	/^T\d\d/,								// time measurement
	/^N./,									// repeat marker
	/^<.*?>/,								// comments
	/^ \(.*?\)/,							// blank and (note)
	iRealRenderer.chordRegex,				// chords
	/^LZ/,									// 1 cell + right bar
	/^XyQ/,									// 3 empty cells
	/^Kcl/									// repeat last bar
];

iRealRenderer.replacements = {
	"LZ": [" ", "|"],
	"XyQ": [" ", " ", " "],
	"Kcl": ["|", "x", " "]
};

iRealRenderer.cssPrefix = "";

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
	constructor(note, modifiers, over, alternate) {
		this.note = note;
		this.modifiers = modifiers;
		this.over = over;
		this.alternate = alternate;
	}
}