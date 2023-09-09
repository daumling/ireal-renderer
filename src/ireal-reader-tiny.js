/**
 * The Playlist and Song instances are derivates from 
 * 
 * https://github.com/pianosnake/ireal-reader
 * 
 * The Song instance has been modified slightly, mostly to exclude the parsing
 * music into single notes. The constructor accepts the content of a iReal Pro
 * HTML file and fills its "songs" property with all songs found in that
 * playlist.
 */

class Playlist {
	constructor(data){
		let percentEncoded = /.*?irealb:\/\/([^"]*)/.exec(data);
		let percentDecoded = decodeURIComponent(percentEncoded[1]);
		let parts = percentDecoded.split("===");  //songs are separated by ===
		if (parts.length > 1) this.name = parts.pop();  //playlist name
		this.songs = parts.map(x => new Song(x));
	}
}

class Song {
	constructor(data) {
		this.cells = [];
		if (!data) {
			this.title = "";
			this.composer = "";
			this.style = "";
			this.key = "";
			this.transpose = 0;
			this.exStyle = "";
			this.bpm = 0;
			this.repeats = 0;
			this.music = "";
			return;
		}
		let parts = data.split("="); //split on one sign, remove the blanks
		let musicPrefix = "1r34LbKcu7";
		this.title = parts[0];
		const composerSplit = parts[1].split(" ");
		//fixes composer name order reversed for 2-word names    
		this.composer = composerSplit.length == 2 ? `${composerSplit[1]} ${composerSplit[0]}` : parts[1];
		this.style = parts[3];
		this.key = parts[4];
		this.transpose = +parts[5] || 0;
		this.exStyle = parts[7];
		this.bpm = +parts[8];
		this.repeats = +parts[9] || 3;
		parts = parts[6].split(musicPrefix);
		this.music = this.unscramble(parts[1]);
	}

	//unscrambling hints from https://github.com/ironss/accompaniser/blob/master/irealb_parser.lua
	//strings are broken up in 50 character segments. each segment undergoes character substitution addressed by obfusc50()
	//note that a final part of length 50 or 51 is not scrambled.
	//finally need to substitute for Kcl, LZ and XyQ.
	unscramble(s) {
		let r = '', p;

		while(s.length > 51){
			p = s.substring(0, 50);
			s = s.substring(50);
			r = r + this.obfusc50(p);
		}
		r = r + s;
		// now undo substitution obfuscation
		r =  r.replace(/Kcl/g, '| x').replace(/LZ/g, ' |').replace(/XyQ/g, '   ');
		return r;
	}

	obfusc50(s) {
		//the first 5 characters are switched with the last 5
		let newString = s.split('');
		for(let i = 0; i < 5; i++){
			newString[49 - i] = s[i];
			newString[i] = s[49 - i];
		}
		//characters 10-24 are also switched
		for(let i = 10; i < 24; i++){
			newString[49 - i] = s[i];
			newString[i] = s[49 - i];
		}
		return newString.join('');
	}
}

if (typeof module !== "undefined")
	module.exports = Playlist;
