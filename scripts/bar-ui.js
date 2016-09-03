/*jslint plusplus: true, white: true, nomen: true */
/*global console, document, navigator, soundManager, window */
var createBarUI = function (window, mediafileURL, mediafileName) {

	/**
	 * SoundManager 2: "Bar UI" player
	 * Copyright (c) 2014, Scott Schiller. All rights reserved.
	 * http://www.schillmania.com/projects/soundmanager2/
	 * Code provided under BSD license.
	 * http://schillmania.com/projects/soundmanager2/license.txt
	 */

	"use strict";
	var id = 0;
	var Player,
		players = [],
		// CSS selector that will get us the top-level DOM node for the player UI.
		playerSelector = '.sm2-bar-ui',
		playerOptions,
		utils;

	/**
	 * Slightly hackish: event callbacks.
	 * Override globally by setting window.sm2BarPlayers.on = {}, or individually by window.sm2BarPlayers[0].on = {} etc.
	 */

	players.on = {
		play: function (player) {
			console.log('playing', player);
		},
		finish: function (player) {
			// each sound
			console.log('finish', player);
		},
		pause: function (player) {
			console.log('pause', player);
		},
		error: function (player) {
			console.log('error', player);
		},
		end: function (player) {
			// end of playlist
			console.log('end', player);
		}
	};
	playerOptions = {
		// useful when multiple players are in use, or other SM2 sounds are active etc.
		stopOtherSounds: true,
		// CSS class to let the browser load the URL directly e.g., <a href="foo.mp3" class="sm2-exclude">download foo.mp3</a>
		excludeClass: 'sm2-exclude'
	};
	/**
	 * player bits
	 */

	Player = function (playerNode) {

		var css, dom, extras, soundObject, actions, actionData, defaultVolume, firstOpen, exports;

		css = {
			disabled: 'disabled',
			selected: 'selected',
			active: 'active',
			legacy: 'legacy',
			noVolume: 'no-volume',
			playlistOpen: 'playlist-open'
		};

		dom = {
			o: null,
			playlist: null,
			playlistTarget: null,
			time: null,
			player: null,
			progress: null,
			progressTrack: null,
			progressBar: null,
			duration: null,
			volume: null
		};

		// prepended to tracks when a sound fails to load/play
		extras = {
			loadFailedCharacter: '<span title="Failed to load/play." class="load-error">✖</span>'
		};

		function stopOtherSounds() {

			if (playerOptions.stopOtherSounds) {
				soundManager.stopAll();
			}

		}

		function callback(method) {
			if (method) {
				// fire callback, passing current turntable object
				if (exports.on && exports.on[method]) {
					exports.on[method](exports);
				} else if (players.on[method]) {
					players.on[method](exports);
				}
			}
		}

		function getTime(msec, useString) {

			// convert milliseconds to hh:mm:ss, return as object literal or string

			var nSec = Math.floor(msec / 1000),
				hh = Math.floor(nSec / 3600),
				min = Math.floor(nSec / 60) - Math.floor(hh * 60),
				sec = Math.floor(nSec - (hh * 3600) - (min * 60));

			// if (min === 0 && sec === 0) return null; // return 0:00 as null

			return (useString ? ((hh ? hh + ':' : '') + (hh && min < 10 ? '0' + min : min) + ':' + (sec < 10 ? '0' + sec : sec)) : {
				'min': min,
				'sec': sec
			});

		}

		function setTitle() {

			// given a link, update the "now playing" UI.

			// if this is an <li> with an inner link, grab and use the text from that.
			var title = mediafileName;

			// remove any failed character sequence, also
			//dom.playlistTarget.innerHTML = '<ul class="sm2-playlist-bd"><li>' + extras.loadFailedCharacter + '</li></ul>';

			dom.playlistTarget.innerHTML = '<ul class="sm2-playlist-bd"><li><marquee>' + title + '</marquee></li></ul>';

		}

		function makeSound(url) {
			console.log(id);
			var sound = soundManager.createSound({
				id: id,
				url: url,

				volume: defaultVolume,

				whileplaying: function () {

					var progressMaxLeft = 100,
						left,
						width;

					left = Math.min(progressMaxLeft, Math.max(0, (progressMaxLeft * (this.position / this.durationEstimate)))) + '%';
					width = Math.min(100, Math.max(0, (100 * this.position / this.durationEstimate))) + '%';

					if (this.duration) {

						dom.progress.style.left = left;
						dom.progressBar.style.width = width;

						// TODO: only write changes
						dom.time.innerHTML = getTime(this.position, true);

					}

				},

				onbufferchange: function (isBuffering) {

					if (isBuffering) {
						utils.css.add(dom.o, 'buffering');
					} else {
						utils.css.remove(dom.o, 'buffering');
					}

				},

				onplay: function () {
					utils.css.swap(dom.o, 'paused', 'playing');
					callback('play');
				},

				onpause: function () {
					utils.css.swap(dom.o, 'playing', 'paused');
					callback('pause');
				},

				onresume: function () {
					utils.css.swap(dom.o, 'paused', 'playing');
				},

				whileloading: function () {

					if (!this.isHTML5) {
						dom.duration.innerHTML = getTime(this.durationEstimate, true);
					}

				},

				onload: function (ok) {

					if (ok) {

						dom.duration.innerHTML = getTime(this.duration, true);

					} else if (this._iO && this._iO.onerror) {

						this._iO.onerror();

					}

				},

				onerror: function () {

					callback('error');

				},

				onstop: function () {

					utils.css.remove(dom.o, 'playing');

				},

				onfinish: function () {
					callback('finish');
				}

			});

			return sound;

		}




		function isRightClick(e) {

			// only pay attention to left clicks. old IE differs where there's no e.which, but e.button is 1 on left click.
			if (e && ((e.which && e.which === 2) || (e.which === undefined && e.button !== 1))) {
				// http://www.quirksmode.org/js/events_properties.html#button
				return true;
			}

		}

		function getActionData(target) {

			// DOM measurements for volume slider

			if (!target) {
				return false;
			}

			actionData.volume.x = utils.position.getOffX(target);
			actionData.volume.y = utils.position.getOffY(target);

			actionData.volume.width = target.offsetWidth;
			actionData.volume.height = target.offsetHeight;

			// potentially dangerous: this should, but may not be a percentage-based value.
			actionData.volume.backgroundSize = parseInt(utils.style.get(target, 'background-size'), 10);

			// IE gives pixels even if background-size specified as % in CSS. Boourns.
			if (window.navigator.userAgent.match(/msie|trident/i)) {
				actionData.volume.backgroundSize = (actionData.volume.backgroundSize / actionData.volume.width) * 100;
			}

		}

		function handleMouseDown(e) {

			var links,
				target;

			target = e.target || e.srcElement;

			if (isRightClick(e)) {
				return true;
			}


			if (utils.css.has(target, 'sm2-volume-control')) {

				// drag case for volume

				getActionData(target);

				utils.events.add(document, 'mousemove', actions.adjustVolume);
				utils.events.add(document, 'mouseup', actions.releaseVolume);

				// and apply right away
				return actions.adjustVolume(e);

			}

		}

		function handleClick(e) {

			var evt,
				target,
				offset,
				targetNodeName,
				methodName,
				href,
				handled;

			evt = (e || window.event);

			target = evt.target || evt.srcElement;

			if (target && target.nodeName) {

				targetNodeName = target.nodeName.toLowerCase();

				if (targetNodeName !== 'a') {

					// old IE (IE 8) might return nested elements inside the <a>, eg., <b> etc. Try to find the parent <a>.

					if (target.parentNode) {

						do {
							target = target.parentNode;
							targetNodeName = target.nodeName.toLowerCase();
						} while (targetNodeName !== 'a' && target.parentNode);

						if (!target) {
							// something went wrong. bail.
							return false;
						}

					}

				}

				if (targetNodeName === 'a') {

					// yep, it's a link.

					href = target.href;

					if (soundManager.canPlayURL(href)) {


					} else {

						// is this one of the action buttons, eg., play/pause, volume, etc.?

						if (target.id) {

							methodName = target.id;

							if (methodName && actions[methodName]) {
								handled = true;
								actions[methodName](e);
							}

						}

					}

					// fall-through case

					if (handled) {
						// prevent browser fall-through
						return utils.events.preventDefault(evt);
					}

				}

			}

		}

		function handleMouse(e) {

			var target, barX, barWidth, x, newPosition, sound;

			target = dom.progressTrack;

			barX = utils.position.getOffX(target);
			barWidth = target.offsetWidth;

			x = (e.clientX - barX);

			newPosition = (x / barWidth);

			if (soundObject && soundObject.duration) {

				soundObject.setPosition(soundObject.duration * newPosition);

				// a little hackish: ensure UI updates immediately with current position, even if audio is buffering and hasn't moved there yet.
				if (soundObject._iO && soundObject._iO.whileplaying) {
					soundObject._iO.whileplaying.apply(soundObject);
				}

			}

			if (e.preventDefault) {
				e.preventDefault();
			}

			return false;

		}

		function releaseMouse(e) {

			utils.events.remove(document, 'mousemove', handleMouse);

			utils.css.remove(dom.o, 'grabbing');

			utils.events.remove(document, 'mouseup', releaseMouse);

			utils.events.preventDefault(e);

			return false;

		}

		function init() {

			// init DOM?

			if (!playerNode) {
				console.warn('init(): No playerNode element?');
			}

			dom.o = playerNode;

			// are we dealing with a crap browser? apply legacy CSS if so.
			if (window.navigator.userAgent.match(/msie [678]/i)) {
				utils.css.add(dom.o, css.legacy);
			}

			if (window.navigator.userAgent.match(/mobile/i)) {
				// majority of mobile devices don't let HTML5 audio set volume.
				utils.css.add(dom.o, css.noVolume);
			}

			dom.playlistTarget = utils.dom.get(dom.o, '.sm2-playlist-target');

			dom.progress = utils.dom.get(dom.o, '.sm2-progress-ball');

			dom.progressTrack = utils.dom.get(dom.o, '.sm2-progress-track');

			dom.progressBar = utils.dom.get(dom.o, '.sm2-progress-bar');

			dom.volume = utils.dom.get(dom.o, 'a.sm2-volume-control');

			// measure volume control dimensions
			if (dom.volume) {
				getActionData(dom.volume);
			}

			dom.duration = utils.dom.get(dom.o, '.sm2-inline-duration');

			dom.time = utils.dom.get(dom.o, '.sm2-inline-time');

			utils.events.add(dom.o, 'mousedown', handleMouseDown);

			utils.events.add(dom.o, 'click', handleClick);

			utils.events.add(dom.progressTrack, 'mousedown', function (e) {

				if (isRightClick(e)) {
					return true;
				}

				utils.css.add(dom.o, 'grabbing');
				utils.events.add(document, 'mousemove', handleMouse);
				utils.events.add(document, 'mouseup', releaseMouse);

				return handleMouse(e);

			});

		}

		// ---

		actionData = {

			volume: {
				x: 0,
				y: 0,
				width: 0,
				height: 0,
				backgroundSize: 0
			}

		};

		actions = {

			play: function (offsetOrEvent) {
				console.log(soundObject);
				if (!soundObject) {
					soundObject = makeSound(mediafileURL);
				}

				// edge case: if the current sound is not playing, stop all others.
				if (!soundObject.playState) {
					stopOtherSounds();
				}

				// TODO: if user pauses + unpauses a sound that had an error, try to play next?
				soundObject.togglePause();

			},

			pause: function () {

				if (soundObject && soundObject.readyState) {
					soundObject.pause();
				}

			},

			resume: function () {
				if (soundObject && soundObject.readyState) {
					soundObject.resume();
				}

			},

			stop: function () {

				// just an alias for pause, really.
				// don't actually stop because that will mess up some UI state, i.e., dragging the slider.
				return actions.pause();

			},

			next: function ( /* e */ ) {
				soundObject.setPosition(Math.min(soundObject.position + 5000, soundObject.duration - 1));
			},

			prev: function ( /* e */ ) {
				soundObject.setPosition(Math.max(soundObject.position - 5000, 0));
			},

			shuffle: function (e) {

			},

			reset: function (e) {
				if (!soundObject.playState)
						soundObject.play();
				else
						soundObject.setPosition(0);
			},

			adjustVolume: function (e) {

				/**
				 * NOTE: this is the mousemove() event handler version.
				 * Use setVolume(50), etc., to assign volume directly.
				 */

				var backgroundMargin,
					pixelMargin,
					target,
					value,
					volume;

				value = 0;

				target = dom.volume;

				// safety net
				if (e === undefined) {
					return false;
				}

				if (!e || e.clientX === undefined) {
					// called directly or with a non-mouseEvent object, etc.
					// proxy to the proper method.
					if (arguments.length && window.console && window.console.warn) {
						console.warn('Bar UI: call setVolume(' + e + ') instead of adjustVolume(' + e + ').');
					}
					return actions.setVolume.apply(this, arguments);
				}

				// based on getStyle() result
				// figure out spacing around background image based on background size, eg. 60% background size.
				// 60% wide means 20% margin on each side.
				backgroundMargin = (100 - actionData.volume.backgroundSize) / 2;

				// relative position of mouse over element
				value = Math.max(0, Math.min(1, (e.clientX - actionData.volume.x) / actionData.volume.width));

				target.style.clip = 'rect(0px, ' + (actionData.volume.width * value) + 'px, ' + actionData.volume.height + 'px, ' + (actionData.volume.width * (backgroundMargin / 100)) + 'px)';

				// determine logical volume, including background margin
				pixelMargin = ((backgroundMargin / 100) * actionData.volume.width);

				volume = Math.max(0, Math.min(1, ((e.clientX - actionData.volume.x) - pixelMargin) / (actionData.volume.width - (pixelMargin * 2)))) * 100;

				// set volume
				if (soundObject) {
					soundObject.setVolume(volume);
				}

				defaultVolume = volume;

				return utils.events.preventDefault(e);

			},

			releaseVolume: function ( /* e */ ) {

				utils.events.remove(document, 'mousemove', actions.adjustVolume);
				utils.events.remove(document, 'mouseup', actions.releaseVolume);

			},

			setVolume: function (volume) {

				// set volume (0-100) and update volume slider UI.

				var backgroundSize,
					backgroundMargin,
					backgroundOffset,
					target,
					from,
					to;

				if (volume === undefined || isNaN(volume)) {
					return;
				}

				if (dom.volume) {

					target = dom.volume;

					// based on getStyle() result
					backgroundSize = actionData.volume.backgroundSize;

					// figure out spacing around background image based on background size, eg. 60% background size.
					// 60% wide means 20% margin on each side.
					backgroundMargin = (100 - backgroundSize) / 2;

					// margin as pixel value relative to width
					backgroundOffset = actionData.volume.width * (backgroundMargin / 100);

					from = backgroundOffset;
					to = from + ((actionData.volume.width - (backgroundOffset * 2)) * (volume / 100));

					target.style.clip = 'rect(0px, ' + to + 'px, ' + actionData.volume.height + 'px, ' + from + 'px)';

				}

				// apply volume to sound, as applicable
				if (soundObject) {
					soundObject.setVolume(volume);
				}

				defaultVolume = volume;

			},

			addNew: function (_mediafileURL, _mediafileName, _id) {
				mediafileURL = _mediafileURL;
				mediafileName = _mediafileName;
				id = _id;
				setTitle();
				soundObject = makeSound(mediafileURL);
				console.log(soundObject);
			}

		};

		init();
		setTitle();
		// TODO: mixin actions -> exports

		exports = {
			// Per-instance events: window.sm2BarPlayers[0].on = { ... } etc. See global players.on example above for reference.
			on: null,
			actions: actions,
			dom: dom
		};

		return exports;

	};

	// barebones utilities for logic, CSS, DOM, events etc.

	utils = {


		css: (function () {

			function hasClass(o, cStr) {

				return (o.className !== undefined ? new RegExp('(^|\\s)' + cStr + '(\\s|$)').test(o.className) : false);

			}

			function addClass(o, cStr) {

				if (!o || !cStr || hasClass(o, cStr)) {
					return false; // safety net
				}
				o.className = (o.className ? o.className + ' ' : '') + cStr;

			}

			function removeClass(o, cStr) {

				if (!o || !cStr || !hasClass(o, cStr)) {
					return false;
				}
				o.className = o.className.replace(new RegExp('( ' + cStr + ')|(' + cStr + ')', 'g'), '');

			}

			function swapClass(o, cStr1, cStr2) {

				var tmpClass = {
					className: o.className
				};

				removeClass(tmpClass, cStr1);
				addClass(tmpClass, cStr2);

				o.className = tmpClass.className;

			}

			function toggleClass(o, cStr) {

				var found,
					method;

				found = hasClass(o, cStr);

				method = (found ? removeClass : addClass);

				method(o, cStr);

				// indicate the new state...
				return !found;

			}

			return {
				has: hasClass,
				add: addClass,
				remove: removeClass,
				swap: swapClass,
				toggle: toggleClass
			};

		}()),

		dom: (function () {

			function getAll(param1, param2) {

				var node,
					selector,
					results;

				if (arguments.length === 1) {

					// .selector case
					node = document.documentElement;
					// first param is actually the selector
					selector = param1;

				} else {

					// node, .selector
					node = param1;
					selector = param2;

				}

				// sorry, IE 7 users; IE 8+ required.
				if (node && node.querySelectorAll) {

					results = node.querySelectorAll(selector);

				}

				return results;

			}

			function get( /* parentNode, selector */ ) {

				var results = getAll.apply(this, arguments);

				// hackish: if an array, return the last item.
				if (results && results.length) {
					return results[results.length - 1];
				}

				// handle "not found" case
				return results && results.length === 0 ? null : results;

			}

			function ancestor(nodeName, element, checkCurrent) {

				var result;

				if (!element || !nodeName) {
					return element;
				}

				nodeName = nodeName.toUpperCase();

				// return if current node matches.
				if (checkCurrent && element && element.nodeName === nodeName) {
					return element;
				}

				while (element && element.nodeName !== nodeName && element.parentNode) {
					element = element.parentNode;
				}

				return (element && element.nodeName === nodeName ? element : null);

			}

			return {
				ancestor: ancestor,
				get: get,
				getAll: getAll
			};

		}()),

		position: (function () {

			function getOffX(o) {

				// http://www.xs4all.nl/~ppk/js/findpos.html
				var curleft = 0;

				if (o.offsetParent) {

					while (o.offsetParent) {

						curleft += o.offsetLeft;

						o = o.offsetParent;

					}

				} else if (o.x) {

					curleft += o.x;

				}

				return curleft;

			}

			function getOffY(o) {

				// http://www.xs4all.nl/~ppk/js/findpos.html
				var curtop = 0;

				if (o.offsetParent) {

					while (o.offsetParent) {

						curtop += o.offsetTop;

						o = o.offsetParent;

					}

				} else if (o.y) {

					curtop += o.y;

				}

				return curtop;

			}

			return {
				getOffX: getOffX,
				getOffY: getOffY
			};

		}()),

		style: (function () {

			function get(node, styleProp) {

				// http://www.quirksmode.org/dom/getstyles.html
				var value;

				if (node.currentStyle) {

					value = node.currentStyle[styleProp];

				} else if (window.getComputedStyle) {

					value = document.defaultView.getComputedStyle(node, null).getPropertyValue(styleProp);

				}

				return value;

			}

			return {
				get: get
			};

		}()),

		events: (function () {

			var add, remove, preventDefault;

			add = function (o, evtName, evtHandler) {
				// return an object with a convenient detach method.
				var eventObject = {
					detach: function () {
						return remove(o, evtName, evtHandler);
					}
				};
				if (window.addEventListener) {
					o.addEventListener(evtName, evtHandler, false);
				} else {
					o.attachEvent('on' + evtName, evtHandler);
				}
				return eventObject;
			};

			remove = (window.removeEventListener !== undefined ? function (o, evtName, evtHandler) {
				return o.removeEventListener(evtName, evtHandler, false);
			} : function (o, evtName, evtHandler) {
				return o.detachEvent('on' + evtName, evtHandler);
			});

			preventDefault = function (e) {
				if (e.preventDefault) {
					e.preventDefault();
				} else {
					e.returnValue = false;
					e.cancelBubble = true;
				}
				return false;
			};

			return {
				add: add,
				preventDefault: preventDefault,
				remove: remove
			};

		}()),

		features: (function () {

			var getAnimationFrame,
				localAnimationFrame,
				localFeatures,
				prop,
				styles,
				testDiv,
				transform;

			testDiv = document.createElement('div');

			/**
			 * hat tip: paul irish
			 * http://paulirish.com/2011/requestanimationframe-for-smart-animating/
			 * https://gist.github.com/838785
			 */

			localAnimationFrame = (window.requestAnimationFrame ||
				window.webkitRequestAnimationFrame ||
				window.mozRequestAnimationFrame ||
				window.oRequestAnimationFrame ||
				window.msRequestAnimationFrame ||
				null);

			// apply to window, avoid "illegal invocation" errors in Chrome
			getAnimationFrame = localAnimationFrame ? function () {
				return localAnimationFrame.apply(window, arguments);
			} : null;

			function has(prop) {

				// test for feature support
				var result = testDiv.style[prop];

				return (result !== undefined ? prop : null);

			}

			// note local scope.
			localFeatures = {

				transform: {
					ie: has('-ms-transform'),
					moz: has('MozTransform'),
					opera: has('OTransform'),
					webkit: has('webkitTransform'),
					w3: has('transform'),
					prop: null // the normalized property value
				},

				rotate: {
					has3D: false,
					prop: null
				},

				getAnimationFrame: getAnimationFrame

			};

			localFeatures.transform.prop = (
				localFeatures.transform.w3 ||
				localFeatures.transform.moz ||
				localFeatures.transform.webkit ||
				localFeatures.transform.ie ||
				localFeatures.transform.opera
			);

			function attempt(style) {

				try {
					testDiv.style[transform] = style;
				} catch (e) {
					// that *definitely* didn't work.
					return false;
				}
				// if we can read back the style, it should be cool.
				return !!testDiv.style[transform];

			}

			if (localFeatures.transform.prop) {

				// try to derive the rotate/3D support.
				transform = localFeatures.transform.prop;
				styles = {
					css_2d: 'rotate(0deg)',
					css_3d: 'rotate3d(0,0,0,0deg)'
				};

				if (attempt(styles.css_3d)) {
					localFeatures.rotate.has3D = true;
					prop = 'rotate3d';
				} else if (attempt(styles.css_2d)) {
					prop = 'rotate';
				}

				localFeatures.rotate.prop = prop;

			}

			testDiv = null;

			return localFeatures;

		}())

	};

	// ---
	// expose to global
	console.log(players);
	var nodes = utils.dom.getAll(playerSelector);
	if (nodes && nodes.length) {
		players.push(new Player(nodes[0]));
	}
	window.sm2BarPlayers = players;
	window.sm2BarPlayerOptions = playerOptions;
	window.SM2BarPlayer = Player;
	console.log(1);
}
