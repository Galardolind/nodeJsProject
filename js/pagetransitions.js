/*
 * La majeure partie du code ci-dessous vient du prototype fournis
 * sur le site : http://tympanus.net/codrops/2013/05/07/a-collection-of-page-transitions/
 * 
 * Il permet de faire des transitions de différente manière sur une même page
 * sans chargement.
 */

var PageTransitions = (function() {

	var $main = $( '#pt-main' ),
		$pages = $main.children( 'div.pt-page' ),
		$admin = $('.goAdmin'),
		$pictionary = $('.goPictionary'),
		$dbTable = $('.goDB'),
		$psettings = $('.goSettings'),
		animcursor = 1,
		pagesCount = $pages.length,
		current = 0,
		isAnimating = false,
		endCurrPage = false,
		endNextPage = false,
		ft = true,
		animEndEventNames = {
			'WebkitAnimation' : 'webkitAnimationEnd',
			'OAnimation' : 'oAnimationEnd',
			'msAnimation' : 'MSAnimationEnd',
			'animation' : 'animationend'
		},
		// animation end event name
		animEndEventName = animEndEventNames[ Modernizr.prefixed( 'animation' ) ],
		// support css animations
		support = Modernizr.cssanimations;
	
	function init() {

		$pages.each( function() {
			var $page = $( this );
			$page.data( 'originalClassList', $page.attr( 'class' ) );
		} );

		$pages.eq( current ).addClass( 'pt-page-current' );

		$( '#dl-menu' ).dlmenu( {
			animationClasses : { in : 'dl-animate-in-2', out : 'dl-animate-out-2' },
			onLinkClick : function( el, ev ) {
				ev.preventDefault();
				nextPage( el.data( 'animation' ) );
			}
		} );
		
		////////////////////////////////////////////
		////////	pages principales	////////////
		////////////////////////////////////////////
		
		$pictionary.on( 'click', function() {
			if( isAnimating ) {
				return false;
			}
			if(verify(0)){
				return false;
			}
			nextPage(2,0);
		} );
		
		$admin.on( 'click', function() {
			if( isAnimating ) {
				return false;
			}
			if(verify(1)){
				return false;
			}
			if(current >= 2){
				nextPage( 2,1);
			} else {
				nextPage( 1,1);
			}
			
			
			
		} );
		
		$dbTable.on( 'click', function() {
			if( isAnimating ) {
				return false;
			}
			if(verify(2)){
				return false;
			}
			nextPage( 1,2);
			
			
		} );
		
		$psettings.on( 'click', function() {
			if( isAnimating ) {
				return false;
			}
			if(verify(3)){
				return false;
			}
			nextPage( 1,3);
			
			
		} );
	}	
	
	function verify(pageSuivante){
		 return current == pageSuivante;
	}

	function nextPage( animation , pageSuivante) {

		if( isAnimating ) {
			return false;
		}

		isAnimating = true;
		
		var $currPage = $pages.eq( current );
		current = pageSuivante;
		var $nextPage = $pages.eq( current ).addClass( 'pt-page-current' ),
			outClass = '', inClass = '';
		
		///////////////////////////////////
		//// liste animations	///////////
		///////////////////////////////////
		
		switch( animation ) {

			case 1:
				outClass = 'pt-page-moveToLeft';
				inClass = 'pt-page-moveFromRight';
				break;
			case 2:
				outClass = 'pt-page-moveToRight';
				inClass = 'pt-page-moveFromLeft';
				break;
			default:
			    outClass = 'pt-page-moveToLeft';
				inClass = 'pt-page-moveFromRight';
				break;

		}

		$currPage.addClass( outClass ).on( animEndEventName, function() {
			$currPage.off( animEndEventName );
			endCurrPage = true;
			if( endNextPage ) {
				onEndAnimation( $currPage, $nextPage );
			}
		} );

		$nextPage.addClass( inClass ).on( animEndEventName, function() {
			$nextPage.off( animEndEventName );
			endNextPage = true;
			if( endCurrPage ) {
				onEndAnimation( $currPage, $nextPage );
			}
		} );

		if( !support ) {
			onEndAnimation( $currPage, $nextPage );
		}

	}

	function onEndAnimation( $outpage, $inpage ) {
		endCurrPage = false;
		endNextPage = false;
		resetPage( $outpage, $inpage );
		isAnimating = false;
	}

	function resetPage( $outpage, $inpage ) {
		$outpage.attr( 'class', $outpage.data( 'originalClassList' ) );
		$inpage.attr( 'class', $inpage.data( 'originalClassList' ) + ' pt-page-current' );
	}
	
	init();
	
	return { init : init };

})();