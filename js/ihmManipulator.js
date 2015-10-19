var PictionIhmVisible = true;
var rdy = false;
var push = false;

/* 
 * Fonction de switch de la visibilité de l'interface de dessin.
 */
function loadPictionaryIhm(){
	// l'interface de dessin est visible
	if(PictionIhmVisible){
		$("#formSelector").hide("slow");
		$("#colorChooserPanel").hide("slow");
		$("#userTab").hide("slow");
		$("#teamTab").show("slow");
		$( ".tabs" ).animate({ "width": "-=150px"}, "slow" );
		$("#data").attr("maxlength",54);
		$(".content").children().css( "width", "-=150px" );
		PictionIhmVisible = false;
	// l'interface de dessin n'est pas visible
	} else {
		$("#formSelector").show("slow");
		$("#colorChooserPanel").show("slow");
		$("#teamTab").hide("slow");
		$("#userTab").show("slow");
		$('#drawInformations').hide("slow");
		$( ".tabs" ).animate({ "width": "+=150px"}, "slow" );
		$("#data").attr("maxlength",69);
		$(".content").children().css( "width", "+=150px" );
		PictionIhmVisible = true;
	}
}

/*
 * Fonction de switch du bouton ready.
 */
function readyToPlay(){
	rdy = !rdy;
	if(rdy){
		$('#readyToPlay').hide();
		$('#notToPlay').show("fast");
	} else {
		$('#notToPlay').hide();
		$('#readyToPlay').show("fast");
	}
	socket.emit("readyToPlay", {rdy: rdy});
}

/*
 * Fonction qui envoie le message won au serveur.
 */
function won(){
	if(push){
		socket.emit("won",'next');
		push = false;
	}
}

/*
 * Lorsque l'utilisateur devient le dessinateur il reçoit la liste des catégories et la partie d'ihm associée.
 */
socket.on('beDrawer', function(data) {
	push = true;
	$('#drawInformations').empty();
	$('#drawInformations').append(data);
	$('#drawInformations').show("slow");
});

/*
 * Fonction qui va remplire la partie contenant l'élément aléatoire tiré par l'utilisateur.
 */
function fillWithData(data){
	$("#randomPart").empty();
	$("#randomPart").append(data);
}

/*
 * Fonction qui envoie le message go au serveur et cache l'interface d'informations pour 
 * laisser apparaitre l'interface de dessin.
 */
function go(){
	$('#drawInformations').hide('slow');
	$('#drawInformations').empty();
	canDraw = true;
	$("#formSelector").show("slow");
	$("#colorChooserPanel").show("slow");
	$("#wonButton").show("slow");
	socket.emit("go","");
}

var initTime;

/*
 * Partie qui va initialisé le timer chez le client
 */
socket.on('timerOn', function(data) {
	initTime = data.time;
	$('#timer').empty();
	$('#timer').append('<div class="timerVis" data-timer="'+data.time+'" style="width: 250px; height: 125px;" ></div>');
	$(".timerVis").TimeCircles();
	if(data.drawer){
		showTimerDrawer(data.time);
	} else {
		showTimer(data.time);
	}
});

/*
 * Fonction qui va reinitialisé l'interface et les variables lors de la reception du message
 * break.
 */
socket.on("break",function(data){
	canDraw = false;
	clearTimer();
	rdy = false;
	$('#timer').empty();
	$('#timer').append('<div class="timerVis" data-timer="0" style="width: 250px; height: 125px;" ></div>');
	$(".timerVis").TimeCircles();
	$('#notToPlay').hide();
	$('#readyToPlay').show("fast");
	$("#wonButton").hide("fast");
	$("#formSelector").hide("fast");
	$("#colorChooserPanel").hide("fast");
});

/* 
 * Fonction qui va reinitialisé le bouton Im Ready.
 */
socket.on("reinitReady",function(data){
	rdy = false;
	$('#notToPlay').hide();
	$('#readyToPlay').show("fast");
});

var timerf;

/*
 * Fonction qui va couper le timer.
 */
function clearTimer(){
	clearInterval(timerf);
}

/*
 * Fonction executer par le timer et qui va l'afficher pour le client.
 */
function myTimer(){
	if(initTime <= 0){
		clearTimer();
	} else {
		initTime--;
	}
}

/*
 * Fonction executer par le timer du dessinateur et qui va l'afficher pour celui-ci et
 * envoyer un message au serveur si le timer atteint 0.
 */
function myTimerDrawer(){
	if(initTime <= 0){
		clearTimer();
		socket.emit("loose","");
	} else {
		initTime--;
	}
}

/*
 * Fonction qui va initialiser le timer pour le dessinateur.
 */
function showTimerDrawer(time){
	timerf = setInterval(function(){myTimerDrawer()},1000);
}

/*
 * Fonction qui va initialiser le timer pour le client normal.
 */
function showTimer(time){
	timerf = setInterval(function(){myTimer()},1000);
}

/*
 * Fonction qui va afficher les points de chaque équipe.
 */
socket.on("point",function(data){
	$("#bluePoint").empty();
	$("#redPoint").empty();
	$("#bluePoint").append(data.blue);
	$("#redPoint").append(data.red);
});







