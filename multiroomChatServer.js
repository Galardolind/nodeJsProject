
// We need to use the express framework: have a real web servler that knows how to send mime types etc.
var express=require('express');
var fs = require('fs');

// Init globals variables for each module required
var app = express()
  , http = require('http')
  , server = http.createServer(app)
//, io = require('socket.io').listen(server);
  , io = require('socket.io').listen(server, {log: false});


// launch the http server on given port
server.listen(8080);

// Indicate where static files are located. Without this, no external js file, no css...  
app.configure(function () {    
    app.use(express.static(__dirname + '/'));    
});

///////////////////////////////////////
//////////   REDIRECTION     //////////
///////////////////////////////////////

// routing with express, mapping for default page
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/dessin.html');
});

// Ne fonctionne pas :(
app.get("/multiroomChatServer.js", function(req, res){
  res.sendfile(__dirname + '/dessin.html');
});

// Ne fonctionne pas :(
app.get("/Admin/Admin", function(req, res){
  res.sendfile(__dirname + '/dessin.html');
});

///////////////////////////////////////
////////   VARIABLES/TOOLS    /////////
///////////////////////////////////////

// noms des joueurs connecté
var usernames = {};

/*
 * Fonction prise sur http://davidwalsh.name/javascript-clone
 * permet de cloner un élément JSON en profondeur.
 */
function clone(src) {
	function mixin(dest, source, copyFunc) {
		var name, s, i, empty = {};
		for(name in source){
			s = source[name];
			if(!(name in dest) || (dest[name] !== s && (!(name in empty) || empty[name] !== s))){
				dest[name] = copyFunc ? copyFunc(s) : s;
			}
		}
		return dest;
	}
	if(!src || typeof src != "object" || Object.prototype.toString.call(src) === "[object Function]"){
		return src;
	}
	if(src.nodeType && "cloneNode" in src){
		return src.cloneNode(true);
	}
	if(src instanceof Date){
		return new Date(src.getTime());
	}
	if(src instanceof RegExp){
		return new RegExp(src);
	}
	var r, i, l;
	if(src instanceof Array){
		r = [];
		for(i = 0, l = src.length; i < l; ++i){
			if(i in src){
				r.push(clone(src[i]));
			}
		}
	}else{
		r = src.constructor ? new src.constructor() : {};
	}
	return mixin(r, src, clone);
}

///////////////////////////////////////
/////////////   ROOM     //////////////
///////////////////////////////////////

/* 
 * Nombre de room dans le chat
 * Les room sont créé automatiquement est ajouté à la liste selon le nombre
 * passé en paramètre (au dessus de 4 l'affichage est moins bon mais c'est réglable
 * dans le css).
 */
var nbRoom = 4;
var rooms = new Array(nbRoom);

/*
 * Chaque room possède une liste des actions de dessins (un historique en gros)
 * cela permet de synchronisé le dessins quel que soit l'utilisateur meme si
 * il change de room alors son canvas s'efface et applique les actions.
 */
var actionList = new Array(nbRoom);

// générateur de room selon le nombre voulu (la dernière étant forcement pictionary)
function generateRooms(){
	for(var i = 0; i < rooms.length-1 ; i++) {
		rooms[i] = 'room'+(i+1);
		actionList[i] = new Array();
	}
	rooms[rooms.length-1] = "pictionary";
	actionList[rooms.length-1] = new Array();
}

// donne le numéro de la room à partir de son nom
function getIndexOfRoom(roomName){
	for(var i = 0; i < rooms.length; i++){
		if(rooms[i] == roomName){
			return i;
		}
	}
	return -1;
}

// génération des rooms
generateRooms();


///////////////////////////////////////
/////////////   FILE     //////////////
///////////////////////////////////////

// Execution de la fonction readFile à partir du path et de la fonction de callback
function readFile(path,treatment){
	fs.readFile(path, 'utf8', treatment);
}

// Execution de la fonction writeFile à partir du path et de la fonction de callback
function writeFile(path,data,treatment){
	fs.writeFile(path,data,treatment);
}

///////////////////////////////////////
///////////   DB/SQPARL     ///////////
///////////////////////////////////////

// Base de donnée chargée en mémoire
var DB = {};

/*
 * Fonction de callback des requêtes.
 * Utilisation de deux fonctions imbriquées pour pouvoir faire une gestion asynchrone de la réponse 
 * avec le socket passé en paramètre. La réponse est envoyé dans la partie administrateur.
 */
var callbackJson = function(socket) {
	return function(response){
		var str = '';
		response.on('data', function (chunk) {
			str += chunk;
		});
		response.on('end', function () {
			try {
				// Sécurisation anti injection html/javascript/php (car oui il y a du html dans certains éléments de dbpedia)
				str.replace(/&/g, " ") .replace(/</g, " ") .replace(/>/g, " ") .replace(/"/g, " ") .replace(/'/g, " ");
				DB = JSON.parse(str);
				socket.emit('requestRsp',str);
			} catch(e){
				socket.emit('requestRsp',"An error occurend while parsing DB in JSON : \n"+str);
			}
		});
	}
}

/*
 * Créer l'url de la requête à partir des éléments fournis par le client.
 */
function makeSparqlUrl(query,domainOption1,domainOption2){
	var query2 = encodeURIComponent(query);
	var url = domainOption1+ query2 + domainOption2;
	return url;
}

/*
 * Emet la requête à partir de l'url du domaine, de la fonction de callback, et de la socket
 * pour envoyer la réponse à l'utilisateur.
 */
function makeRequest(url,domain,callback,socket){
	var options = {
		host: domain,
		path: url
	};
	http.request(options, callback(socket)).end();
}

///////////////////////////////////////
///// SAVE/GET/UPDATE/DELETE  DB  /////
///////////////////////////////////////

/*
 * Fonction de callback de la sauvegarde du fichier de BD.
 * Si le fichier n'est pas sauvegardé correctement il envoie l'erreur au socket
 * passé en paramètre, sinon il envoie la confirmation de la sauvegarde dans la partie
 * admin correspondante.
 */
var DBsaver = function(socket){
	return function(err) {
		if(err) {
			 socket.emit("requestRsp",err);
		} else {
			socket.emit("requestRsp","The file was saved successfully !");
		}
	}
}

/*
 * Fonction qui va sauvegarder la BD dans le dossier DB à partir du fileName et du socket.
 */
function saveDB(fileName,socket){
	try{
		var dataStr = JSON.stringify(DB);
		writeFile("./DB/"+fileName,dataStr,DBsaver(socket));
		getDBList(socket);
	} catch(e){
		socket.emit("requestRsp", e+"");
	}
}

/*
 * Fonction de callback de la liste des json dans la Base de données.
 * Elle va générer une liste déroulante contenant les fichiers json dans le dossier
 * DB/ et intégrer leurs scripts associés.
 */
var DBgetter = function(socket){
	return function(err,files){
		if(err) {
			 socket.emit("requestRsp",err);
		} else {
			var button1 = "<select class='selectPaint' id='DBlists' size='1' >";
			var button2 = "<select class='selectPaint' id='DBlistsAdd' size='1' >";
			var list = "";
			for(var i = 0; i < files.length;i++){
				list += "<option value="+files[i]+">"+files[i]+"</option>";
			}
			list += "</select>";
			button1 += list;
			button1 += "&nbsp;&nbsp;<input class='adminButton' type='button' id='loadSelectedDB' value='Load selected DB' />";
			button1 += "<script>$('#loadSelectedDB').click(function(){socket.emit('adminZone', {cmd:'loadSelectedDB' , fileName: $('#DBlists').val(), replaceShit: $('#replaceShit').is(':checked')});$('#fileName').val($('#DBlists').val());$('#fileName2').val($('#DBlists').val());});</script>";
			button2 += list;
			button2 += "&nbsp;&nbsp;<input class='adminButton' type='button' id='addToSelectedDB' value='Add current Data to Selected DB' />";
			button2 += "<script>$('#addToSelectedDB').click(function(){socket.emit('adminZone', {cmd:'addToSelectedDB' , fileName: $('#DBlistsAdd').val(), replaceShit: $('#replaceShit').is(':checked')});$('#fileName').val($('#DBlistsAdd').val());$('#fileName2').val($('#DBlistsAdd').val());});</script>";
			socket.emit("DBList",button1);
			socket.emit("DBlistAdd",button2);
		}
	}
}

/*
 * Fonction qui va rendre la liste des fichiers dans le dossier DB et executer le callback avec le socket 
 * passé en paramètre.
 */
function getDBList(socket){
	fs.readdir("./DB/", DBgetter(socket));
}

/*
 * Fonction de callback de lcture d'un fichier.
 * Elle va parse le fichier lu en JSON et le mettre dans la variable DB (qui contient la DB courrante).
 * Puis, va envoyer a l'administrateur dans la partie qui fait office de console, ensuite elle va
 * essayer de transformer la DB en tableau html et envoyer celui-ci dans la partie affichage.
 * La variable replace est un boolean permetant de dire si lors de la génération du tableau, dans les lien des 
 * thumbnails la partie commons et remplacée par en (due au bug de dbpedia).
 */
var DBselectGetter = function(socket,replace){
	return function(err,data){
		if(err){
			socket.emit("requestRsp",err);
		} else {
			try {
				DB = JSON.parse(data);
				socket.emit('requestRsp',data);
				var toSend = generateTableFromDB(replace);
				socket.emit('ShowDb',toSend);
			} catch(e){
				socket.emit('requestRsp',"An error occurend while parsing DB in JSON : "+e);
			}
		}
	}
}

/*
 * Fonction qui va lire un fichier dans la DB à partir de son nom, de la socket du demandeur, et du boolean replace
 * qui est utilisé pour le bug commons/en ( voir commentaire DBselectGetter )
 */
function loadDBFile(fileName,socket,replace){
	readFile("./DB/"+fileName,DBselectGetter(socket,replace));
}

/*
 * Fonction qui va filtrer la DB par label pour que tout ceux qui ont le même label partagent leurs champs.
 * Si le champ existe pas dans une ligne de la DB alors, la fonction va faire une propagation de celui-ci pour que tous les éléments
 * partagent tous les même champs.
 */
function filterCurrentDB(object){
	if(object.length != 0){
		var newDB = {};
		var nb = object.length;
		for(var j = 0; j < nb-1; j++){
			var temp = object[j];
			label = temp["label"].value;
			newDB[j] = temp;
			var nwDBtemp = temp;
			for(var x = j+1; x < nb;x++){
				var temp2 = object[x];
				var label2 = temp2["label"].value;
				/* propagation des champs */
				// x->j
				for(var wkey in object[x]){
					if( typeof temp[wkey] == 'undefined'){
						temp[wkey] = clone(temp2[wkey]);
						temp[wkey].value = "";
					}
				}
				nwDBtemp = temp;
				// j->x 
				for(var wkey in object[j]){
					if( typeof temp2[wkey] == 'undefined'){
						temp2[wkey] = clone(temp[wkey]);
						temp2[wkey].value = "";
					}
				}
				nwDBtemp = temp;
				
				if(label == label2){
					for(var key in object[j]){
						if(temp[key].value != temp2[key].value){
							nwDBtemp[key].value = nwDBtemp[key].value +"<br />"+temp2[key].value;
						}
					}
					object.splice(x,1);
					nb--;
					x--;
				}
			}
			DB.results.bindings[j] = nwDBtemp;
		}
		var temp = object[nb-1];
		var temp2 = clone(object[0]);
		for(var i in temp2){
			if( typeof temp[i] == 'undefined'){
				temp[i] = temp2[i];
				temp[i].value = "";
			}
		}
		DB.results.bindings[nb-1] = temp;
	}
}

/*
 * Fonction qui va appeler la méthode de filtre et afficher si une erreur et survenue.
 */
function filterByLabel(){
	try{
		filterCurrentDB(DB.results.bindings);
	} catch(e){
		console.log("erreur \n"+e);
	}
}

/*
 * Fonction qui va ajouter à la DB courrante la DB passé en paramètre.
 */
function addDataToDB(toAdd){
	var nb = DB.results.bindings.length;
	for(var i = 0; i < toAdd.length;i++){
		DB.results.bindings[(nb+i)] = toAdd[i];
	}
}

/*
 * Fonction de callback de l'ajout d'une DB à celle courrante.
 * Elle va sauvegarder la DB courrante dans une variable, mettre le contenus du fichier
 * parsé en JSON dans la DB courrante, et pour finir concaténé les deux via la méthode addDataToDb.
 * Elle va ensuite distribué la DB sous forme de texte dans la console de l'administrateur et sous forme 
 * de Tableau dans la partie correspondante.
 * Si une erreur survient, celle-ci est envoyé dans la console de l'administrateur.
 */
var DBselectAdder = function(socket,replace){
	return function(err,data){
		if(err){
			socket.emit("requestRsp",err);
		} else {
			try {
				var DBtemp = DB.results.bindings;
				DB = JSON.parse(data);
				addDataToDB(DBtemp);
				var toSend = generateTableFromDB(replace);
				socket.emit('requestRsp',JSON.stringify(DB));
				socket.emit('ShowDb',toSend);
			} catch(e){
				socket.emit('requestRsp',"An error occurend while parsing DB in JSON : "+e);
			}
		}
	}
}

/*
 * Fonction d'ajout d'une DB à celle courrante à  partir du nom du fichier a charger dans la DB,
 * de la socket du demandeur, et du boolean replace qui va indiqué le remplacement du bug du commons.
 */
function addToSelectedDB(fileName,socket,replace){
	readFile("./DB/"+fileName,DBselectAdder(socket,replace));
}

///////////////////////////////////////
////   TABLE GENERATOR FROM DB     ////
///////////////////////////////////////

var currentPage = 0;

/*
 * Fonction de génération d'une partie du tableau à partir de object passé en paramètre (qui va être en réalité DB.results.bindings).
 * et de replace le boolean qui va changer le /commons en /en.
 * 
 * Cette fonction ne parcours pas la DB en profondeur car si on laisse libre l'affiche alors le tableau va donner quelque chose de
 * très moyen (niveau affichage).
 * Elle n'est aussi pas générique elle est faite pour les DB comme dbpedia les formes (obligatoire pour detecter les images etc...).
 * 
 * Elle retourne le tableau sous forme de String, ou "empty" si il n'y a pas d'éléments dans la DB.
 */
function makeTableFromJSONSparql(object,replace){
	if(object.length != 0){
		var start = 0;
		var end = 0;
		if(object.length < 500){
			end = object.length;
		} else {
			start = currentPage*500;
			end = (currentPage*500)+500;
			if(currentPage*500 > object.length){
				currentPage = 0;
				start = 0;
				end = 500;
			} else if(end > object.length){
				end = object.length;
			}
		}
		var text = "<table>";
		var keys = [];
		var n = 0;
		for (var key in object[0] ) {
			text += "<th>"+key+"</th>";
			keys[n] = key;
			n++;
		}
		text += "<th>Actions</th>";
		for(var j = start; j < end; j++){
			if(object[j] != null){
				text += "<tr>";
				for (var M = 0; M < keys.length ;M++) {
					var  i = keys[M];
					var temp = object[j];
					if (typeof(temp[i].value) == ("object")) {
						text += "<td>"+ lis(i,replace)+"</td>";
					} else {
						if(temp[i].type == "uri"){
							if(i == "thumbnail"){
								var tempoImg = temp[i].value;
								if(replace){
									tempoImg = tempoImg.replace(/commons/g, "en");
								}
								text += "<td style='width:150px;height:150px;' > <img src='" +tempoImg+ "' style='width:150px;height:150px;' ></td>";
							} else {
								text += "<td> <a href='" +temp[i].value + "'>external link</a></td>";
							}
						} else {
							if(temp[i].value.length > 400){
								text += "<td width='450px' >" +temp[i].value + "</td>";
							} else {
								text += "<td>" +temp[i].value + "</td>";
							}
						}
					}
				}
				text += "<td style='text-align:center;width:100px;'><a class='deleteBtn' onclick='clicDelete("+j+");'>Delete line</a></td>";
				text += "</tr>";
			}
		}
		text += "</table>";
		return (text);
	} else {
		return "empty";
	}
}

/*
 * Fonction qui va appeler la formation du tableau à partir de la DB courrante.
 * Si une erreur survient lors de la première formation (généralement une erreur à cause
 * des clés qui ne sont pas les mêmes partout) alors elle va appelé filterByLabel() ce qui va avoir
 * pour effet de propager les clés dans toutes les lignes et ensuite re essayer de créer le tableau
 * si l'erreur persiste alors celle-ci est renvoyée.
 */
function generateTableFromDB(replace){
	var tableau;
	try {
		tableau = makeTableFromJSONSparql(DB.results.bindings,replace);
	} catch(e){
		try {
			filterByLabel();
			tableau = makeTableFromJSONSparql(DB.results.bindings,replace);
		} catch(e){
			return e+"";
		}
	}
	return tableau;
}

/*
 * Supprime le numéro de la ligne passé en paramètre de la DB courrante.
 */
function deleteLineFromDB(nbLine){
	var object = DB.results.bindings;
	object.splice(nbLine,1);
}


///////////////////////////////////////
////////////    ADMIN     /////////////
///////////////////////////////////////

// Liste de pseudo des Admin
var adminNames = ["Gal"];

// password pour accéder a la zone admin
var pswd = "pwd";

/*
 * Verification du pseudo et du mot de passe administrateur.
 */
function verifyAdmin(userName,pwd){
	if(pwd == pswd){
		if(verifyAdminName(userName)){
			return true;
		} else {
			return false;
		}
	}
	return false;
}

/*
 * Verification du pseudo administrateur
 */
function verifyAdminName(name){
	for(var i = 0; i < adminNames.length;i++){
		if(name == adminNames[i]){
			return true;
		}
	}
	return false;
}

// Variable contenant la page administrateur.
var admPage;

/*
 * Fonction de callback de la récupération de la page Admin.
 * Une fois chargée elle va rester en mémoire jusqu'à extinction du serveur.
 * Si une erreur survient, elle s'affiche dans la console du serveur.
 */
var adminRecup = function (err,data) {
	if (err) {
		console.log(err);
		return;
	}
	admPage = data;
}

// appel de la lecture de la page Admin au démarage du serveur par sécuitée.
readFile('./Admin/AdminPage',adminRecup);

///////////////////////////////////////
//////////   PICTIONARY   /////////////
///////////////////////////////////////

// Variable contenant la BD du pictionary pour ne pas entrer en conflit avec la DB administrateur.
var pictDB = {};

// Nombre minimum de joueur pour commencer la partie
var nbMin = 4;

// Temps par round
var timePerRound = 60;

// Nomre de pictionarien
var nbPictionarians = 0;
// Nombre de pictionarien prêt à jouer
var nbReady = 0;

/*
 * Pour le serveur la liste des pictionariens et enregistré sous forme d'objet Pictionarian 
 * (conservant ainsi la socket et l'équipe de celui-ci) avec pour clé leurs username.
 */
var pictionarians = {};
/*
 * Pour les clients la liste des pictionariens est uniquement le nom pour clé et la couleur pour valeur,
 * la liste au dessus aurait pu être utilisée pour faire le même travail mais celle-ci a été faite pour alléger
 * le parcour de la liste des pictionarians pour les fonction simple. 
 */
var participants = {};

// Nombre de points de l'équipe bleu
var bluePoint = 0;
// Nombre de points de l'équipe rouge
var redPoint = 0;

// Variable contenant la couleur du prochain participant à rejoindre le pictionary
var colorTeam = true;
// Variable contenant la couleur de la prochaine équipe à jouer.
var whosePlay = true;

/*
 * Objet Pictionarian, il contient la socket et la couleur de celui-ci.
 */
function Pictionarian(socket,color){
	this.socket = socket;
	this.color = color;
}

/*
 * Fonction d'ajout d'un joueur dans le pictionary à partir de sa socket.
 */
function addPlayer(socket){
	nbPictionarians++;
	pictionarians[socket.username] = new Pictionarian(socket,colorTeam);
	participants[socket.username] = colorTeam;
	colorTeam = getNextColor();
}

/*
 * Fonction de suppression d'un joueur dans le pictionary à partir de sa socket.
 */
function removePlayer(socket){
	delete pictionarians[socket.username];
	delete participants[socket.username];
	nbPictionarians--;
	colorTeam = getNextColor();
}

/*
 * Fonction qui va retourner la couleur du prochain participant, elle va simplement
 * compter combien il y en a dans chaque team et donner la couleur adéquate pour faire 
 * des équipes équilibrées en nombre.
 */
function getNextColor(){
	var nb = 0;
	for(var i in participants){
		if(participants[i]){
			nb++;
		}
	}
	if(nb > nbPictionarians - nb){
		return false;
	} else {
		return true;
	}
}

/*
 * Fonction qui va choisir un joueur aléatoirement dans la liste à partir de la couleur passée en paramètre.
 * Elle va choisir et ensuite envoyer à celui-ci le message qui va activer l'interface du dessinateur.
 */
function setRandomPlayerInColor(color){
	var colorTeams = {};
	var nb = 0;
	for(var i in pictionarians){
		if(pictionarians[i].color == color){
			colorTeams[i] = pictionarians[i];
			nb++;
		}
	}
	var randomnumber =Math.floor(Math.random()*nb);
	var nb2 = 0;
	for(var i in colorTeams){
		if(nb2 == randomnumber){
			getPictionaryDBList(colorTeams[i].socket);
			colorTeams[i].socket.emit('updatechat', 'SERVER', '<b style="color:red;"> You have been chosen to draw ! </b>');
			colorTeams[i].socket.broadcast.to(colorTeams[i].socket.room).emit('updatechat', 'SERVER', ' The drawer is <b>'+colorTeams[i].socket.username+"</b>");
			break;
		}
		nb2++;
	}
	
	
}

/*
 * Fonction de callback qui va afficher la liste des Catégories disponible et l'envoie a la
 * socket passée en paramètre. (Normalement le dessinateur).
 * Injection du script permettant de récupérer un élément aléatoire dans la DB selectionnée.
 */
var pictionaryDBgetter = function(socket){
	return function(err,files){
		if(err) {
			 socket.emit("requestRsp",err);
		} else {
			var list = "<select class='selectPaint' id='pictDBList' size='1' >";
			for(var i = 0; i < files.length;i++){
				list += "<option value="+files[i]+">"+files[i]+"</option>";
			}
			list += "</select>";
			list += "&nbsp;&nbsp;<input class='adminButton' type='button' id='getRandom' value='Get one !' /><p></p><div id='randomPart' style='width:100%;max-height:400px;overflow:auto;'></div>";
			list += "<input class='adminButton' type='button' id='go' value=' GO !' onclick='go();'/>";
			list += "<script>$('#getRandom').click(function(){socket.emit('getRandom', {fileName: $('#pictDBList').val()});});";
			list += "socket.on('random',function(data){fillWithData(data);});</script>";
			socket.emit("beDrawer",list);
		}
	}
}

/*
 * Fonction qui va lire le nom des fichiers dans le dossier DB et l'envoyer à la socket passée en paramètre.
 */
function getPictionaryDBList(socket){
	fs.readdir("./DB/", pictionaryDBgetter(socket));
}

/*
 * Fonction de callback qui va renvoyer un élément aléatoire après avoir parsé la DB et enregistrer celle-ci
 * dans la variable pictDB.
 * Si une erreur survient alors une erreur s'affiche dans la console du serveur.
 */
var DBPictSelectGetter = function(socket,fileName){
	return function(err,data){
		if(err){
			console.log("error : "+err);
		} else {
			try {
				pictDB = JSON.parse(data);
				sendRandomObject(socket,fileName)
			} catch(e){
				console.log("error while parsing ! "+e);
			}
		}
	}
}

/*
 * Fonction qui appel la lecture du fichier passé en paramètre et envoie a la socket un élément aléatoire.
 */
function getRandomFromDbFile(fileName,socket){
	var path = "./DB/"+fileName;
	readFile(path,DBPictSelectGetter(socket,fileName));
}

/*
 * Fonction qui va selectionner un élément aléatoire dans la DB du pictionary et l'envoi au socket
 * sous la forme d'un tableau html dans la partie appropriée.
 */
function sendRandomObject(socket,fileName){
	var object = pictDB.results.bindings;
	var j =Math.floor(Math.random()*object.length);
	var text = "<table cellspacing='10' >"
	if(object[j] != null){
		for (var i in object[j]) {
			text += "<tr>";
			var temp = object[j];
			if(i == "label"){
				text += "<td ><b>" +temp[i].value + "</b></td>";
			} else if(temp[i].type == "uri"){
				if(i == "thumbnail"){
					var tempoImg = temp[i].value;
					if(fileName == "films.json" || 'Films.json' == fileName || "Film.json" == fileName || "film.json" == fileName){
						tempoImg = tempoImg.replace(/commons/g, "en");
					}
					text += "<td style='width:150px;height:150px;' > <img src='" +tempoImg+ "' style='width:150px;height:150px;' ></td>";
				} else {
					if(temp[i].value.length > 200){
						text += "<td width='220px'> <a href='" +temp[i].value + "'>external link</a></td>";
					} else {
						text += "<td> <a href='" +temp[i].value + "'>external link</a></td>";
					}
					
				}
			} else {
				if(temp[i].value.length > 200){
					text += "<td width='220px' >" +temp[i].value + "</td>";
				} else {
					text += "<td>" +temp[i].value + "</td>";
				}
			}
		}
		text += "</tr>";
	}
	text += "</table>"
	socket.emit("random",text);
}

///////////////////////////////////////
////////////   SOCKET     /////////////
///////////////////////////////////////

io.sockets.on('connection', function (socket) {
	
	/*
	 * Partie gérant l'ajout d'un utilisateur dans le serveur.
	 */
	socket.on('adduser', function(username){
		// Sécurisation anti php/javascript injection
		username = username.replace(/&/g, "&amp;") .replace(/</g, "&lt;") .replace(/>/g, "&gt;") .replace(/"/g, "&quot;") .replace(/'/g, "&#039;");
		if(username.length > 10){
			socket.emit("connect"," ");
		} else if(usernames[username] != username){
			socket.username = username;
			socket.room = 'room1';
			usernames[username] = username;
			
			socket.join('room1');
			socket.emit('updaterooms', rooms, 'room1');
			
			// Supprime la partie html permettant de recevoir la page admin si l'utilisateur n'est pas un admin
			if(!verifyAdminName(username)){
				socket.emit('deposit',"<script>$('#admin').remove();$('#admin1').remove();$('#admin').remove();$('#admin2').remove();$('#admin3').remove();</script>");
			} else {
				socket.emit('deposit',"<script>$('#admin').show('slow');</script>");
			}
			
			socket.emit('updatechat', 'SERVER', 'you have connected to room1');
			
			// Dessine le canvas de la premiere room dans le canvas de l'utilisateur.
			for(var i = 0; i < actionList[0].length;i++){
				socket.emit('draw',actionList[0][i]);
			}
			
			socket.broadcast.to('room1').emit('updatechat', 'SERVER', username + ' has connected to this room');
			
			var usersInRoom = io.sockets.clients('room1');
			var usersNameInRoom = {};
			
			// Update des utilosateurs dans la room.
			usersInRoom.forEach(function(client) {
				usersNameInRoom[client.username] =  client.username;
			});
			io.sockets.in(socket.room).emit('updateusers', usersNameInRoom);
		} else {
			socket.emit("connect"," ");
		}
		
	});
	
	///////////////////////
	// chat management   //
	///////////////////////
	
	/*
	 * Partie gérant le chat et son contenus.
	 */
	socket.on('sendchat', function (data) {
		// securisation anti php/javascript injection
		data = data.replace(/&/g, "&amp;") .replace(/</g, "&lt;") .replace(/>/g, "&gt;") .replace(/"/g, "&quot;") .replace(/'/g, "&#039;");
		// sécurisation anti remplissage abusif du chat.
		if(data.length > 69){
			socket.emit('deposit','<script>document.location = "https://www.google.fr/search?q=learn+to+hack&ie=utf-8&oe=utf-8&aq=t&rls=org.mozilla:fr:official&client=firefox-a&channel=sb&gfe_rd=cr&ei=PnpBU5PiG8PI8gfNj4GoCQ";</script>');
		} else {
			io.sockets.in(socket.room).emit('updatechat', socket.username, data);
		}
	});
	
	///////////////////////
	// admin management  //
	///////////////////////
	
	/*
	 * Verifie si l'utilisateur est un admin, si il ne l'est pas redirection sur learn2hack :)
	 */
	socket.on('admin', function (data){
		if(verifyAdmin(socket.username+"",data+"")){
			socket.emit('loadAdminIHM',admPage);
			// load DB list
			getDBList(socket);
		} else {
			socket.emit('deposit','<script>document.location = "https://www.google.fr/search?q=learn+to+hack&ie=utf-8&oe=utf-8&aq=t&rls=org.mozilla:fr:official&client=firefox-a&channel=sb&gfe_rd=cr&ei=PnpBU5PiG8PI8gfNj4GoCQ";</script>');
		}
	});
	
	/*
	 * Liste des commande possible par l'administrateur et des actions éxecutée selon la commande.
	 * J'aurai pu le faire sous forme de socket.on séparés mais il y a moins de syntaxte comme ceci.
	 */
	socket.on('adminZone', function (data){
		switch(data.cmd){
			case 'loadSelectedDB':
				loadDBFile(data.fileName,socket,data.replaceShit);
				break;
			case 'saveDB':
				saveDB(data.fileName,socket)
				break;
			case 'showDB':
				var toSend = generateTableFromDB(data.replaceShit);
				socket.emit('ShowDb',toSend);
				break;
			case 'query':
				var url = makeSparqlUrl(data.query,data.domainOption1,data.domainOption2);
				makeRequest(url,data.domainName,callbackJson,socket);
				break;
			case 'deleteLine':
				deleteLineFromDB(data.number);
				var toSend = generateTableFromDB(data.replaceShit);
				socket.emit('ShowDb',toSend);
				break;
			case 'filter':
				filterByLabel();
				var toSend = generateTableFromDB(data.replaceShit);
				socket.emit('ShowDb',toSend);
				break;
			case 'addToSelectedDB':
				addToSelectedDB(data.fileName,socket,data.replaceShit);
				break;
			case 'nextPage':
				currentPage++;
				var toSend = generateTableFromDB(data.replaceShit);
				socket.emit('ShowDb',toSend);
				break;
			case 'previousPage':
				if(currentPage != 0){
					currentPage--;
					var toSend = generateTableFromDB(data.replaceShit);
					socket.emit('ShowDb',toSend);
				}
				break;
			case 'setTime':
				if(isNaN(data.time)){
					socket.emit('deposit',"<script>alert('this is not a number');</script>");
				} else {
					if(data.time >= 10){
						timePerRound = data.time;
					} else {
						socket.emit('deposit',"<script>alert('time is to short');</script>");
					}
				}
				break;
			case 'nbPlayer':
				if(isNaN(data.nb)){
					socket.emit('deposit',"<script>alert('this is not a number');</script>");
				} else {
					if(data.nb >= 2){
						nbMin = data.nb;
					} else {
						socket.emit('deposit',"<script>alert('we need 2 player minimum');</script>");
					}
				}
				break;
			case 'addAdmin':
				adminNames[adminNames.length] = data.name;
				break;
			case 'chgPwd':
				pswd = data.pwd;
				break;
			default:
				break;
		}
	});
	
	///////////////////////
	// canvas management //
	///////////////////////
	
	/*
	 * Action d'envoie de l'action de dessinage sur le canvas aux autres utilisateurs.
	 * Note : un enregistrement est aussi fait dans la liste des actions de la room appropriée.
	 */
	socket.on('senddraw', function(data) {
		var nb  = getIndexOfRoom(socket.room);
		if(nb != -1){
			actionList[nb].push(data);
		}
		socket.broadcast.to(socket.room).emit('draw',data);
	});
	
	/*
	 * Action de clear le canvas vers les utilisateurs de la room.
	 * Cette action reinitialise la liste des actions de la room.
	 */
	socket.on('clearCanvas',function(data){
		var nb  = getIndexOfRoom(socket.room);
		if(nb != -1){
			actionList[nb] = new Array();
		}
		socket.broadcast.to(socket.room).emit('clear',"");
	});
	
	
	//////////////////////////
	//pictionary management //
	//////////////////////////
	
	/*
	 * Message reçus lors du clic sur Ready par l'utilisateur.
	 * Si tous les utilisateurs du pictionary sont pret alors le jeu demarre automatiquement 
	 * en selectionnant un Utilisateur dans une des équipes pour dessiner.
	 * Le nombre minimum actuel est 4 mais il suffit de changer la variable via les settings pour changer ce nombre.
	 */
	socket.on('readyToPlay',function(data){
		if(data.rdy){
			nbReady++;
		} else {
			nbReady--;
		}
		if(nbReady >= nbPictionarians && nbReady >= nbMin){
			io.sockets.in(socket.room).emit('updatechat', 'SERVER', ' evryone is ready ! An drawer will be choosen !');
			setRandomPlayerInColor(whosePlay);
			var nb  = getIndexOfRoom(socket.room);
			if(nb != -1){
				actionList[nb] = new Array();
			}
			io.sockets.in(socket.room).emit('clear',"");
		}
	});
	
	/*
	 * Message reçus lorsque l'utilisateur demande une entrée aléatoire dans la DB selectionné.
	 */
	socket.on('getRandom',function(data){
		getRandomFromDbFile(data.fileName,socket);
	});
	
	/* 
	 * Lorsque le dessinateur clic sur Go alors le timer est envoyé à toute la room.
	 * Le boolean drawer permet de faire envoyer un message automatiquement par le dessinateur si le temsp est écoulé.
	 */
	socket.on('go',function(data){
		socket.broadcast.to(socket.room).emit("timerOn",{time: timePerRound, drawer: false});
		socket.emit("timerOn",{time: timePerRound, drawer: true});
	});
	
	/*
	 * Lorsque le dessinateur clic sur le bouton Won ! Alors la team adverse à gagner un point c'est à l'autre team de jouer.
	 * Un message prévient tous les joueurs.
	 * L'interface se desactive pour tout le monde et le compteur de points est mis à jour sur tous les clients et
	 * va réinitialiser le bouton Im Ready chez tout les joueurs.
	 */
	socket.on('won',function(data){
		nbReady = 0;
		var collor;
		if(whosePlay){
			collor = "<b style='color:#9CF;'>blue</b>";
			bluePoint++;
		} else {
			collor = "<b style='color:#FF5050;'>red</b>";
			redPoint++;
		}
		whosePlay = !whosePlay;
		io.sockets.in(socket.room).emit("updatechat",'SERVER','<b style="color:#33842A;">Team '+collor+' win ! </b>');
		io.sockets.in(socket.room).emit("break"," ");
		io.sockets.in(socket.room).emit("point",{red: redPoint, blue: bluePoint});
	});
	
	/*
	 * Lorsque le temps est écoulé chez le dessinateur alors il envoie automatiquement ce message qui va réinitialiser 
	 * le bouton Im Ready chez tout les joueurs.
	 * Un message annonçant la honteuse défaite de l'équipe va aussi s'afficher.
	 */
	socket.on('loose',function(data){
		nbReady = 0;
		whosePlay = !whosePlay;
		var collor;
		if(whosePlay){
			collor = "<b style='color:#9CF;'>blue</b>";
		} else {
			collor = "<b style='color:#FF5050;'>red</b>";
		}
		io.sockets.in(socket.room).emit("updatechat",'SERVER','<b style="color:#FF5050;">Team '+collor+' loose ! </b>');
		io.sockets.in(socket.room).emit("break"," ");
	});
	
	/////////////////////
	// room management //
	/////////////////////
	
	/*
	 * Message reçus lorsque l'utilisateur change de room. Il y a toute une gestion due au pictionary.
	 * Lorsque un joueur quitte le pictionary le nombre de joueurs pret dans le pictionary est réinitialisé et leurs
	 * boutons Im ready aussi.
	 */
	socket.on('switchRoom', function(newroom){
		var oldRoom = socket.room;
		
		socket.leave(socket.room);
		socket.join(newroom);
		// sent message to OLD room
		socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', socket.username+' has left this room');
		
		// update socket session room title
		socket.room = newroom;
		socket.emit('updaterooms', rooms, newroom);
		socket.emit('updatechat', 'SERVER', 'you have connected to '+ newroom);
		socket.broadcast.to(newroom).emit('updatechat', 'SERVER', socket.username+' has joined this room');
		
		if(newroom == "pictionary"){
			socket.emit('deposit','<script>canDraw=false;</script>');
			addPlayer(socket);
			io.sockets.in(socket.room).emit('updatePictionarians', participants);
			io.sockets.in(socket.room).emit("point",{red: redPoint, blue: bluePoint});
		}else {
			socket.emit('deposit','<script>canDraw=true;</script>');
			// update new room
			var usersInRoom = io.sockets.clients(newroom);
			var usersNameInRoom = {};
			usersInRoom.forEach(function(client) {
				usersNameInRoom[client.username] =  client.username;
			});
			io.sockets.in(socket.room).emit('updateusers', usersNameInRoom);
		}
		
		if(oldRoom == "pictionary"){
			removePlayer(socket);
			if(nbPictionarians <= 0){
				redPoint = 0;
				bluePoint = 0;
			}
			socket.broadcast.to(oldRoom).emit('updatePictionarians', participants);
			socket.broadcast.to(oldRoom).emit('reinitReady', "");
			socket.emit('reinitReady', "");
			nbReady = 0;
		} else {
			// update old room users
			usersInRoom = io.sockets.clients(oldRoom);
			usersNameInRoom = {};
			usersInRoom.forEach(function(client) {
				usersNameInRoom[client.username] =  client.username;
			});
			socket.broadcast.to(oldRoom).emit('updateusers', usersNameInRoom);
		}
		
		socket.emit('clear',"");
		var nb  = getIndexOfRoom(socket.room);
		if(nb != -1){
			for(var i = 0; i < actionList[nb].length;i++){
				socket.emit('draw',actionList[nb][i]);
			}
		}
	});
	
	/*
	 * Lorsqu'une personne quitte le site alors un message est envoyé à tous les utilisateurs de sa room.
	 * Dans le cas ou il participait au pictionary alors ont réinitialise le bouton Im Ready et le nombre de gens prêt.
	 */
	socket.on('disconnect', function(){
		if(socket.room == "pictionary"){
			removePlayer(socket);
			if(nbPictionarians <= 0){
				redPoint = 0;
				bluePoint = 0;
				whosePlay = true;
				colorTeam = true;
			}
			socket.broadcast.to(socket.room).emit('updatePictionarians', participants);
			socket.broadcast.to(socket.room).emit('reinitReady', "");
			nbReady = 0;
		} else {
			var usersInRoom = io.sockets.clients(socket.room);
			var usersNameInRoom = {};
			usersInRoom.forEach(function(client) {
				if(client.username != socket.username)
					usersNameInRoom[client.username] =  client.username;
			});
			socket.broadcast.to(socket.room).emit('updateusers', usersNameInRoom);
		}
		// remove the username from global usernames list
		delete usernames[socket.username];
		// echo globally that this client has left
		socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected');
		socket.leave(socket.room);
	});
});
