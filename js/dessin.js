var mouseIsDown = false;
	
var choix = "line";

var canDraw = true;

$(window).mousedown(function(){
	mouseIsDown = true;
});

$(window).mouseup(function(){
	mouseIsDown = false;
});

////////////// CHAT ////////////////////

/*
 * Fonction qui écrit un message sur le canvas.
 */
function writeMessage(canvas, message) {
    var context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '10pt Calibri';
    context.fillStyle = 'black';
    context.fillText(message, 10, 25);
}

/*
 * Fonction qui focus la barre du chat.
 */
function setChatFocus(){
	$("#data").focus();
	$("#data").val("");
}

////////////// CANVAS //////////////////

////////////// CONFIGURATION ///////////

var selValue = 0.5;

$("#Epaisseur").val("0.5");
choixEpaisseur();
var colorhex="#FF0000"

/*
 * Fonction qui va set l'Epaisseur dans la variable associée.
 */
function choixEpaisseur(){
	selValue = $("#Epaisseur").val();
}

/*
 * Fonction qui va afficher la couleur que la souris survole.
 */
function mouseOverColor(hex){
	$("#divpreview").css("background-color",hex);
	$("#divpreviewtxt").html(hex);
	document.body.style.cursor="pointer";
}

/*
 * Fonction qui va afficher le cursor normalement une fois sortis de la map.
 * et reinitialisé la couleur à celle selectionnée.
 */
function mouseOutMap(){
	$("#divpreview").css("background-color",colorhex);
	$("#divpreviewtxt").html(colorhex);
	document.body.style.cursor="";
}

/*
 * Fonction qui va à partir d'une valeur de la map sortir la couleur et l'afficher ou il faut lors du clic.
 */
function clickColor(hex,seltop,selleft){
	var xhttp,c
	if (hex==0){
		c=$("colorhex").val();
	} else {
		c=hex;
	}
	if (c.substr(0,1)=="#"){
		c=c.substr(1);
	}
	colorhex="#"+c;
	colorhex=colorhex.substr(0,10);
	$("#colorhex").html(colorhex).val(colorhex);
	$("#colorhexbgd").css("background-color",colorhex);
	if (seltop>-1 && selleft>-1){
	} else {
		$("#divpreview").css("background-color",colorhex);
		$("#divpreviewtxt").html(colorhex);
	}
}


/////////////  FORMES /////////////////

// les 4 prochaines fonctions sont assez explicite.
function choisirLigne(){
	choix = "line";
}
function choisirCarre(){
	choix = "carre";
}
function choisirCercle(){
	choix = "cercle";
}
function choisirRectangle(){
	choix = "rectangle";
}

/*
 * Fonction qui retourne la position de la souris sous forme de tableau json.
 */
function getMousePos(canvas, evt) {
    // get canvas position
    var obj = canvas;
    var top = 0;
    var left = 0;
    while (obj && obj.tagName != 'BODY') {
        top += obj.offsetTop;
        left += obj.offsetLeft;
        obj = obj.offsetParent;
    }

    // return relative mouse position
    var mouseX = evt.clientX - left + window.pageXOffset;
    var mouseY = evt.clientY - top + window.pageYOffset;
    return {
        x:mouseX,
        y:mouseY
    };
}

////////////// DRAW /////////////// (pris sur www.w3schools.com/tags/ref_colorpicker.asp )

/*
 * Fonction qui contient l'évément de dessin.
 */
window.onload = function () {
    var canvas = document.getElementById('myCanvas');
    var context = canvas.getContext('2d');
    var started = false, previousMousePos;

    canvas.addEventListener('mouseup', function (evt){
		if(canDraw){
			var mousePos = getMousePos(canvas, evt);
			context.lineWidth = selValue;
			context.strokeStyle = $('#colorhex').val();
			switch( choix ) {
				case "line":
					userDrawLine(context,previousMousePos,mousePos);
					break;
				case "carre":
					userDrawCarre(context,previousMousePos,mousePos);
					break;
				case "cercle":
					userDrawCircle(context,previousMousePos,mousePos);
					break;
				case "rectangle":
					userDrawRect(context,previousMousePos,mousePos);
					break;
				default:
					userDrawLine(context,previousMousePos,mousePos);
					break;
			}
		}
    },false);

    canvas.addEventListener('mousemove', function (evt) {
    var mousePos = getMousePos(canvas, evt);
    var message = "Mouse position: " + mousePos.x + "," + mousePos.y;

   //writeMessage(canvas, message);
   // Let's draw some lines that follow the mouse pos
   if (!started) {
	previousMousePos = mousePos;
	started = true;
   } else {
	if(canDraw){
		if(mouseIsDown){
			context.lineWidth = selValue;
			context.strokeStyle = $('#colorhex').val();
			switch( choix ) {
				case "line":
					userDrawLine(context,previousMousePos,mousePos);
					break;
				default:
					break;
			}
						
		}
		previousMousePos = mousePos;
	   }
   }
}, false);
};

/* 
 * Fonction qui va dire si on remplis ou pas les formes.
 */
function fillPaint(context){
	if($("#Fill").is(":checked")){
		context.fillStyle = $('#colorhex').val();
	    	context.fill();
		context.strokeStyle = '#003300';
	}
}

/*
 * Les 4 fonctions suivantes set juste les variables proprement pour 
 * ensuite dessiner, et les envoyer au serveur.
 */
function userDrawLine(context,previousMousePos,mousePos){
	context.beginPath();
	context.moveTo(previousMousePos.x, previousMousePos.y);
	context.lineTo(mousePos.x, mousePos.y);
	context.stroke();
	sendToServer("line",previousMousePos,mousePos);
}

function userDrawCircle(context,previousMousePos,mousePos){
	context.beginPath();
	context.arc(mousePos.x, mousePos.y, 70, 0, 2 * Math.PI, false);
	fillPaint(context);
	context.stroke();
	mouseIsDown = false;
	sendToServer("cercle",previousMousePos,mousePos);
}

function userDrawRect(context,previousMousePos,mousePos){
	context.beginPath();
	context.rect(mousePos.x-75,mousePos.y-50,150,100);
	fillPaint(context);
	context.stroke();
	mouseIsDown = false;
	sendToServer("rectangle",previousMousePos,mousePos);
}

function userDrawCarre(context,previousMousePos,mousePos){
	context.beginPath();
	context.rect(mousePos.x-50,mousePos.y-50,100,100);
	fillPaint(context);
	context.stroke();
	mouseIsDown = false;
	sendToServer("carre",previousMousePos,mousePos);
}

/*
 * Fonction qui va nettoyer le canvas et envoyer le message au serveur de nettoyage du canvas pour la room.
 */
function clearCanvas(){
	var canvas = document.getElementById('myCanvas');
	var context = canvas.getContext('2d');
	context.clearRect(0, 0, canvas.width, canvas.height);
	socket.emit('clearCanvas',"");
}

/*
 * Fonction qui va envoyer au serveur la forme dessinée sous forme d'objet jason.
 */
function sendToServer(forme,previousMousePos,mousePos){
	socket.emit('senddraw', {form:forme,pmx: previousMousePos.x, pmy: previousMousePos.y, mx: mousePos.x,my: mousePos.y,chk:$("#Fill").is(":checked"),color:$('#colorhex').val(),sel:selValue});
}

/*
 * Fonction qui va dessiner la forme que le serveur envoie.
 */
socket.on('draw', function(data){
	var canvas = document.getElementById('myCanvas');
    	var context = canvas.getContext('2d');
	var previousMousePos = {x:data.pmx,y:data.pmy};
	var mousePos = {x:data.mx,y:data.my};
	context.lineWidth = data.sel;
	context.strokeStyle = data.color;
	switch( data.form ) {
		case "line":
			userDrawLineMulti(context,previousMousePos,mousePos,data.color,data.chk);
			break;
		case "carre":
			userDrawCarreMulti(context,previousMousePos,mousePos,data.color,data.chk);
			break;
		case "cercle":
			userDrawCircleMulti(context,previousMousePos,mousePos,data.color,data.chk);
			break;
		case "rectangle":
			userDrawRectMulti(context,previousMousePos,mousePos,data.color,data.chk);
			break;
		default:
			userDrawLineMulti(context,previousMousePos,mousePos,data.color,data.chk);
			break;
	}
	context.lineWidth = selValue;
	context.strokeStyle = $('#colorhex').val();
});

/*
 * Fonction qui va clear le canvas lorsque le serveur le demande.
 */
socket.on('clear',function(data){
	clearCanvasMulti();
});

/*
 * Les 5 fonctions après font la meme chose que les fonctions plus haute à la différence prêt qu'elles ont
 * des arguments spéciaux pour dire l'Epaisseur, si la forme est remplie etc.. 
 */
function fillPaintMulti(context,color,chk){
	if(chk){
		context.fillStyle = color;
	    	context.fill();
		context.strokeStyle = '#003300';
	}
}

function userDrawLineMulti(context,previousMousePos,mousePos,color,chk){
	context.beginPath();
	context.moveTo(previousMousePos.x, previousMousePos.y);
	context.lineTo(mousePos.x, mousePos.y);
	context.stroke();
}

function userDrawCircleMulti(context,previousMousePos,mousePos,color,chk){
	context.beginPath();
	context.arc(mousePos.x, mousePos.y, 70, 0, 2 * Math.PI, false);
	fillPaintMulti(context,color,chk);
	context.stroke();
}

function userDrawRectMulti(context,previousMousePos,mousePos,color,chk){
	context.beginPath();
	context.rect(mousePos.x-75,mousePos.y-50,150,100);
	fillPaintMulti(context,color,chk);
	context.stroke();
}

function userDrawCarreMulti(context,previousMousePos,mousePos,color,chk){
	context.beginPath();
	context.rect(mousePos.x-50,mousePos.y-50,100,100);
	fillPaintMulti(context,color,chk);
	context.stroke();
}

function clearCanvasMulti(){
	var canvas = document.getElementById('myCanvas');
	var context = canvas.getContext('2d');
	context.clearRect(0, 0, canvas.width, canvas.height);
}
	
