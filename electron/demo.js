const { Playlist, iRealRenderer } = require("ireal-renderer");
const $ = require("jquery");

$(document).ready(() => {
	
	var playlist;
	var options = {
		minor: "minus",
		transpose: 0,
		useH: false,
		hilite: true
	};
	
	function makePlaylist(text) {
		playlist = new Playlist(text);
		var lb = $("#songs");
		lb.empty();
		var chords = $("#chords");
		chords.empty();
		for (var i = 0; i < playlist.songs.length; i++) {
			lb.append(`<option value="${i}">${playlist.songs[i].title}</option>`);
			chords.append(`<div id="song-${i}"></div>`);
		}
	}
	
	/**
	* Render a song into the container "#song-index".
	* @param {int} index - the song index
	*/
	function renderSong(index) {
		var song = playlist.songs[index];
		var r = new iRealRenderer;
		r.parse(song);
		song = r.transpose(song, options);
		var container = $("#song-" + index);
		container.empty();
		container.append(`<h3>${song.title} (${song.key})</h3>`);
		r.render(song, container, options);			
	}
	
	function renderSelected() {
		var selected = $("#songs").val();
		selected = selected.map(val => +val);
		for (var i = 0; i < playlist.songs.length; i++) {
			if (selected.includes(i))
				renderSong(i);
			else
				$(`#song-${i}`).empty();
		}
	}

	$("#songs").on("change", () => renderSelected());
	
	$('[name="minor"]').on("click", function() {
		var mode = $(this).prop("id");
		options.minor = mode;
		renderSelected();
	});

	$("#ui-useh").on("click", function() {
		options.useH = $(this).is(":checked");
		renderSelected();
	});

	$("#ui-hilite").on("click", function() {
		options.hilite = $(this).is(":checked");
		renderSelected();
	});

	$("#ui-transpose").on("input change", function() {
		options.transpose = +$(this).val();
		renderSelected();
	});

	$("#ui-fontsize").on("input change", function() {
		$("#chords").css("font-size", $(this).val() + "pt");
	});

	$("#ui-file").on("change", function(e) {
		var f = e.target.files[0];
		var reader = new FileReader();
		reader.addEventListener("loadend", () => {
			if (reader.error)
				alert(`Cannot read file ${f.name}: ${reader.error}`);
			else
				makePlaylist(reader.result);
		});
		reader.readAsText(f, "utf-8");
	});

	$.get("DemoPlaylist.html", (text) => {
		makePlaylist(text);
	});
});
