	var socket = io.connect();
	var currentRoom = 1;
	var myName = "";
	var couleurName = "blue";
	var oldName = "";
	var firstTime = true;
	var first = false;
	
	/*
	 * Fonction qui va lancer un prompt dans la tête du client :)
	 */
	function verifyUsername(){
		return prompt("What's your name? (max 10 char)");
	}

	// on connection to server, ask for user's name with an anonymous callback
	socket.on('connect', function(){
		if(first) alert("Name already taken ! ");
		myName = "";		
		first = true;
		while(myName == "" || myName == null || myName.length > 10){
			myName = verifyUsername();
		}
		
		// call the server-side function 'adduser' and send one parameter (value of prompt)
		socket.emit('adduser', myName );
	});

	// listener, whenever the server emits 'updatechat', this updates the chat body
	socket.on('updatechat', function (username, data) {
		// affiche heure + nom en couleur selon le cas (mon message = rouge/message server = orange/autres = bleu ou vert)
		var date = new Date();
		if(username == myName){
			couleurName = "red";
		} else if(username == "SERVER") {
			couleurName = "orange";
			oldName = username;
		} else if(oldName != username){
				if(couleurName == "blue"){
					couleurName = "green";
				} else {
					couleurName = "blue";
				}
				oldName = username;
		} else {
			oldName = username;
		}
		$('.content-'+currentRoom).append('<b>'+date.getHours()+"h"+date.getMinutes()+"m"+date.getSeconds()+"s  <font color=\""+couleurName+"\">"+username + '</font> :</b> ' + data + '<br>');
		// une valeur assez elevee pour eviter les problemes (element.height // scrollHeight ne fonctionne pas bien)
		$('.content-'+currentRoom).scrollTop(50000);
	});

	/*
	 * Fonction de mise a jour de la liste des utilisateurs
	 */
	socket.on('updateusers', function(data) {
		console.log("test");
		$('#users').empty();
		$.each(data, function(key, value) {
			if(key == myName){
				$('#users').append('<div><b>'+key+'</b></div>');
			} else {
				$('#users').append('<div>'+key+'</div>');
			}
					
		});	
	});
	
	/*
	 * Fonction qui va mettre à jour la liste des utilisateurs du pictionary
	 */
	socket.on('updatePictionarians', function(data) {
		$('#teamBlue').empty();
		$('#teamRed').empty();
		$.each(data, function(key, value) {
			if(value){
					if(key == myName){
					$('#teamBlue').append('<div><b>'+key+'</b></div>');
				} else {
					$('#teamBlue').append('<div>'+key+'</div>');
				}
			} else {
					if(key == myName){
					$('#teamRed').append('<div><b>'+key+'</b></div>');
				} else {
					$('#teamRed').append('<div>'+key+'</div>');
				}
			}
		});	
	});

	// listener, whenever the server emits 'updaterooms', this updates the room the client is in
	/*
	 * Fonction qui va mettre a jour la liste des rooms et généré le code html nécessaire pour afficher les rooms et leurs chats correspondant.
	 */
	socket.on('updaterooms', function(rooms, current_room) {
		if(firstTime){
			$('#rooms').empty();
			$('#rooms').append('<section class="tabs"></section>');
			var i = 1;
			$.each(rooms, function(key, value) {
				if(value == current_room){
					currentRoom = i;
					$('.tabs').append('<input id="tab-'+i+'" type="radio" name="radio-set" class="tab-selector-'+i+'" checked="checked" onclick="switchRoom(\''+value+'\')" />');
				} else {
					$('.tabs').append('<input id="tab-'+i+'" type="radio" name="radio-set" class="tab-selector-'+i+'" onclick="switchRoom(\''+value+'\')" />');
				}
				if(value == "pictionary") {
					$('.tabs').append('<label id="pictLabel" for="tab-'+i+'" class="tab-label-'+i+'" style="background:#99CCFF;" >'+value+'</label>');
				} else {
					$('.tabs').append('<label for="tab-'+i+'" class="tab-label-'+i+'">'+value+'</label>');
				}
				i = i + 1;
			});
			$('.tabs').append('<div class="clear-shadow"></div>');
			$('.tabs').append('<div class="content"></div>');
			i = 1;
			$.each(rooms, function(key, value) {
				$('.content').append('<div class="content-'+i+'" style="height:350px;width:675px;overflow:auto;"></div>');
				i = i + 1;
			});
			firstTime = false;
		}  else {
			var i = 1;
			$.each(rooms, function(key, value) {
				if(value == current_room){
					if(value == "pictionary") {
						$("#pictLabel").css('background',"white");
					} else {
						$("#pictLabel").css('background',"#99CCFF");
					}
					currentRoom = i;
					$('.tab-'+i).attr('checked');
				} else {
					$('.tab-'+i).removeAttr('checked');
				}
				i = i + 1;
			});
		}
	});

	/*
	 * Fonction qui va afficher la room que l'utilisateur a choisis, si il s'agit
	 * de la room du pictionary alors il va modifier l'interface en conséquence.
	 */
	function switchRoom(room){
		if(room == "pictionary"){
			if(PictionIhmVisible){
				loadPictionaryIhm();
				socket.emit('switchRoom', room);
			}
		}else if(room.substring(4) != currentRoom){
			if(!PictionIhmVisible){
				loadPictionaryIhm();
			}
			socket.emit('switchRoom', room);
		}
	}
	
	/*
	 * Fonction récupérant l'IHM de la partie admin et l'affiche au bon endroit.
	 */
	socket.on('loadAdminIHM', function(data) {
		$('#adminPage').empty();
		$('#adminPage').append(data);
	});

	// on load of page
	$(function(){
		// when the client clicks SEND
		$('#datasend').click( function() {
			var message = $('#data').val();
			if(message.length != 0){
				$('#data').val('');
				// tell server to execute 'sendchat' and send along one parameter
				socket.emit('sendchat', message);
				
			}
			$('#data').focus();
		});

		// when the client hits ENTER on their keyboard
		$('#data').keypress(function(e) {
			if(e.which == 13) {
				$(this).blur();
				$('#datasend').focus().click();
			}
		});
		
		// when the client want to be an admin
		$('#adminButton').click( function() {
			var message = prompt("PassWord please ? (max 10 char)");
			if(message.length != 0){
				socket.emit('admin', message);
			}
		});
	});
	
	/*
	 * Partie permettant de faire des injection javascript depuis le serveur de façon temporaire
	 */
	socket.on("deposit", function(data){
		$("#deposit").append(data);
		$("#deposit").empty();
	});
