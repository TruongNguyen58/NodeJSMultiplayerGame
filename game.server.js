/*  Copyright (c) 2013 TruongNGUYEN
    BH Licensed.
 */

var TYPE_INVITE = "invite";
var TYPE_FOUND_PLAYER = "foundPlayer";
var TYPE_PLAYER_NOT_AVAILABLE = "playerNotAvailable";
var TYPE_WELLCOME = "wellcome";
var TYPE_RECEIVE_CONFIRM = "receiveConfirm";
var TYPE_START_GAME = "startGame";
var TYPE_NEXT_ROUND = "nextRound";
var TYPE_PLAYER_ANSWER = "playerAnswer";
var TYPE_END_GAME = "endGame";
var TYPE_PLAYER_DISCONNECT = "playerDisconnect";
var TYPE_PLAYER_RECONNECTED = "playerReconnect";
var TYPE_ONLINE_PLAYERS = "onlinePlayers";
var TYPE_CONNECTED = "userJoined";
var TYPE_CHAT = "chat";
// var intervalTime = 15;
var hasOwnProperty = Object.prototype.hasOwnProperty;

var recordIntervals = {};
var numberOfPlayerAnswer = {};
var clients = {};
var socketsOfClients = {};
var games = {};
var players = {};
var currentGameOfPlayer = {};
var groupTestTmp = {};

var game_server = module.exports, app_server = require('./app.js'), verbose = true;

game_server.users = function(req, res) {
	var str = "";
	var i = 0;
	Object.keys(players).forEach(
			function(userName) {
				str += (i++) + " .Player: " + userName + "   .Channel: "
						+ players[userName].appName + ".           \n";
			});
	res.send(str);
};

game_server.chat = function(obj) {
	console.log("begin chat with other user");
	var dataToSend = {};
	dataToSend.notice = TYPE_CHAT;
	dataToSend.data = obj;
	obj.players.forEach(function(player) {
		if (clients.hasOwnProperty(player)) {
			console.log("begin chat with user: " + player + " -- ID: "
					+ clients[player] + " -- dataToSend: "
					+ JSON.stringify(dataToSend));
			app_server.sendMsgToClient(clients[player], dataToSend);
		}
	});
};

game_server.setUser = function(sId, data) {
	console.log("begin set user");
	onUserConnect(sId, data);
	app_server.sendToClient(sId, TYPE_CONNECTED, {});
};

game_server.changeStatus = function(data) {
	console.log("begin change Status: " + JSON.stringify(data));
	if(players.hasOwnProperty(data.player)){
		players[data.player].status = data.status;
	}
};

function onUserConnect(sId, playerData) {
	var playerName = playerData.userName;
	var playerId = playerData.playerId;
	var i = 0;
	console.log("User: " + JSON.stringify(playerData) + " connected with socketID: " + sId);
	// Does not exist ... so, proceed
	clients[playerId] = sId;
	if (players.hasOwnProperty(playerId)) {
		console.log("players.hasOwnProperty(" + playerId + ")");
		try {
			if (currentGameOfPlayer.hasOwnProperty(playerId)) {
				var gameId = currentGameOfPlayer[playerId];
				var data = {};
				data.player = {"playerId" : playerId, "playerName" :playerName};
				endWhenPlayerQuitGame(gameId, "playerQuitGame", data);
			}
		} catch (err) {
		}
		delete players[playerId];
	}
	players[playerId] = {
		"playerId": playerId,
		"playerName" : playerName,	
		"status" : playerData.status,
		"socketId" : sId,
		"appName" : playerData.appName
	};
	console.log("Current player: " + JSON.stringify(players[playerId]));
	Object.keys(socketsOfClients).forEach(
			function(oldSocketId) {
				console.log("Key: " + oldSocketId + " Value: "
						+ socketsOfClients[oldSocketId] + " PlayerName: "
						+ playerId);
				if (socketsOfClients[oldSocketId] == 	playerId) {
					delete socketsOfClients[oldSocketId];
				}
			});

	socketsOfClients[sId] = playerId;
	console.log("clients: " + JSON.stringify(clients));
	console.log("socketsOfClients: " + JSON.stringify(socketsOfClients));
}



game_server.onUserDisconnect = function(sId) {

	try {
		var i = 0;
		//ad.hasOwnProperty(prop)
		if (socketsOfClients.hasOwnProperty(sId)) {
			console
					.log("Player: " + socketsOfClients[sId]
							+ " Disconnect game");
			console.log("currentGameOfPlayer: "
					+ JSON.stringify(currentGameOfPlayer));
			if (currentGameOfPlayer.hasOwnProperty(socketsOfClients[sId])) {
				var gameId = currentGameOfPlayer[socketsOfClients[sId]];
				var data = {};
				var playerId = socketsOfClients[sId];
				data.player =  {"playerId" : playerId, "playerName" :players[playerId].playerName};
				if(games[gameId].gameRule == 1){
					for ( var i = 0; i < games[gameId].scores.length; i++) {
						var playerScore = games[gameId].scores[i];
						if (playerScore.hasOwnProperty(playerId)) {
							playerScore[playerId] = -1000;
							break;
						}
					}
					endWhenPlayerQuitGame(gameId, "playerQuitGame", data)
				}
				else {
					if(games[gameId].finishPlayers[playerId] != true){
						console.log("delete games[gameId].clientPlayers[playerId]: " + playerId);
						delete games[gameId].clientPlayers[playerId];
						console.log("Size remain: " + Object.size(games[gameId].clientPlayers));
					}
						
					if(Object.size(games[gameId].clientPlayers) <= 1 || games[gameId].finish <= Object.size(games[gameId].clientPlayers)) {
						endGroupTest(gameId);
					}
				}
					
			}
			console.log("groupTestTmp: " +JSON.stringify(groupTestTmp));
			if(groupTestTmp.hasOwnProperty(sId)){
				var obj = {};
				obj.sender = groupTestTmp[sId];
				obj.player = socketsOfClients[sId];
				console.log("object: " + JSON.stringify(obj));
				onExitWaitingGame(obj);
			}
			delete players[socketsOfClients[sId]];
			delete clients[socketsOfClients[sId]];
			delete socketsOfClients[sId];
		}
	} catch (err) {
		console.log("ERORR onUserDisconnect: " + JSON.stringify(err));
	}
};

game_server.onUserQuitGame = function(sId) {
	console.log("Player: " + clients[socketsOfClients[sId]] + " Quit game");
	try {
		if (socketsOfClients.hasOwnProperty(sId)) {
			if (currentGameOfPlayer.hasOwnProperty(socketsOfClients[sId])) {
				var gameId = currentGameOfPlayer[socketsOfClients[sId]];
				var data = {};
				var playerId = socketsOfClients[sId];
				data.player =  players[playerId].playerName;
				players[playerId].status = 1;
				if(games[gameId].gameRule == 1){
					for ( var i = 0; i < games[gameId].scores.length; i++) {
						var playerScore = games[gameId].scores[i];
						if (playerScore.hasOwnProperty(playerId)) {
							playerScore[playerId] = -1000;
							break;
						}
					}
					endWhenPlayerQuitGame(gameId, "playerQuitGame", data)
				}
				else {
					if (players[playerId].status == 2)
						players[playerId].status = 1;
					delete games[gameId].clientPlayers[playerId];
					if(Object.size(games[gameId].clientPlayers) <= 1) {
						endGroupTest(gameId);
					}
				}
			}
		}
	} catch (err) {
		console.log("ERORR onUserQuitGame: " + JSON.stringify(err));
	}
};

function removeFromObjectByKey(key) {
	  delete thisIsObject[key];
	}

game_server.getAvailablePlayers = function(sId, obj) {
	try {
		var availableUsers = new Array();
		console.log("online users: " + JSON.stringify(players));
		var i = 0;
		Object.keys(players).forEach(
				function(playerId) {
					console.log("PlayerId: " + playerId);
					if (players[playerId].appName == obj.appName
							&& players[playerId].status == 1)
						if (i <= 20) {
							availableUsers.push(players[playerId]);
						}
					i++;
				});
		console.log('Sending availableUsers to ' + sId);

		var dataToSend = {
			"notice" : TYPE_ONLINE_PLAYERS,
			"data" : {
				"availablePlayers" : availableUsers
			}
		};
		app_server.sendMsgToClient(sId, dataToSend);

	} catch (err) {
		console.log("Error when get getAvailablePlayers: "
				+ JSON.stringify(err));
	}
}; //game_server.getAvailablePlayers

game_server.findPlayer = function(obj) {
	console.log("findPlayer : " + JSON.stringify(obj));
	var dataToSend = {};
	dataToSend.notice = TYPE_FOUND_PLAYER;
	console.log('looking for a player for user: ' + obj.sender);
	var playerId = obj.player;
	if (players.hasOwnProperty(playerId)) {
		if (playerId != obj.sender && players[playerId].status == 1) {
			dataToSend.data = {
				"player" : players[playerId],
				"available" : true
			};
			console.log('found user: ' + JSON.stringify(playerName));
		} else {
			dataToSend.data = {
				"player" :  players[playerId],
				"available" : false
			};
			console.log('player:' + JSON.stringify(playerName)
					+ " not available");
		}
	} else {
		dataToSend.data = {
			"player" :  {"playerId" : playerId, "playerName" :""},
			"available" : false
		};
		console.log('not found user: ' + JSON.stringify(playerName));
	}
	app_server.sendMsgToClient(clients[obj.sender], dataToSend);
}; //game_server.findPlayer

game_server.findGame = function(obj) {
	var dataToSend = {};
	console.log('looking for a game for user: ' + obj.data.sender);
	for ( var playerId in players) {
		console.log(JSON.stringify(playerId));
		if (playerId != obj.sender && players[playerId].status == 1) {
			dataToSend.notice = TYPE_INVITE;
			dataToSend.data = obj;
			console.log('found user: ' + JSON.stringify(playerId));
			app_server.sendMsgToClient(clients[playerId], dataToSend);
			break;
		}
	}
}; //game_server.findGame

game_server.inviteToGame = function(sId, obj) {
	var dataToSend = {};
	console.log('looking for a game for user: ' + obj.data.sender);
	obj.data.friends.forEach(function(playerId) {
		if (players[playerId].status == 1) {
			dataToSend.notice = TYPE_INVITE;
			dataToSend.data = obj.data;
			console.log('send invite to user: ' + JSON.stringify(playerId));
			app_server.sendMsgToClient(clients[playerId], dataToSend);
		} else {
			dataToSend.notice = TYPE_PLAYER_NOT_AVAILABLE;
			dataToSend.data = {
				"player" : players[playerId].playerName,
			};
			app_server.sendMsgToClient(sId, dataToSend);
		}
	});

}; //game_server.inviteToGame

game_server.confirmJoinGame = function(sId, obj) {
	console.log("Available user: " + JSON.stringify(clients));
	var dataToSend = {};
	console.log('send confirm to sender: ' + obj.sender);
	groupTestTmp[sId] = obj.sender;
	dataToSend.notice = "receiveConfirm"
	dataToSend.data = obj;
	app_server.sendMsgToClient(clients[obj.sender], dataToSend);
}; //game_server.confirmJoinGame

game_server.startGroupTest = function(gameId, obj) {
	console.log("JSON.stringify(obj.game) :        " + JSON.stringify(obj.game));
	var gameToSave = obj.game;
	var dataToSend = {};
	console.log("Game before save: " + JSON.stringify(gameToSave));
	games[gameId] = gameToSave;
	gameToSave.gameId = gameId;
	obj.game = gameToSave;
	dataToSend.notice = "startGroupTest";
	dataToSend.data = obj;
	try {
		Object.keys(gameToSave.clientPlayers).forEach(
				function(playerId) {
					players[playerId].status = 2;
					currentGameOfPlayer[playerId] = gameId;
					app_server.sendMsgToClient(clients[playerId], dataToSend);
					delete groupTestTmp[clients[playerId]];
				});
	} catch (err) {
		console.log("Err: " + JSON.stringify(err));
	}
	if (recordIntervals.hasOwnProperty(gameId)) {
		try {
			clearTimeout(recordIntervals[gameId]);
			delete recordIntervals[gameId];
		} catch (err) {
			console.log("Err: " + JSON.stringify(err));
		}
	}
	console.log("game saved with: " + JSON.stringify(games[gameId]));
	var timeToEndGame = games[gameId].roundNum * games[gameId].intervalTime;
	games[gameId].finish  = 0;
	games[gameId].finishPlayers = {};
	setTimeout(
			function() {
				recordIntervals[gameId] = startGroupTestTimer(gameId, timeToEndGame);
			}, 3 * 1000);
	//}
}; //game_server.startGroupTest

game_server.exitWaitingGame = function(obj) {
	onExitWaitingGame(obj);
}; //game_server.startGroupTest

function onExitWaitingGame (obj) {
	console.log("On user exit waiting game: " + JSON.stringify(obj));
	var dataToSend = {};
	dataToSend.notice = "exitWaitingGame";
	dataToSend.data = {"player":obj.player};
	app_server.sendMsgToClient(clients[obj.sender], dataToSend);
	delete groupTestTmp[clients[obj.player]];
}

game_server.onPlayerFinishGroupTest = function(obj) {
	var gameId = obj.gameId;
	var finish = games[gameId].finish + 1;
	games[gameId].finish = finish;
	games[gameId].finishPlayers[obj.player] = true;
	console.log("Players remain: " + Object.size(games[gameId].clientPlayers) - finish);
	if(finish >= Object.size(games[gameId].clientPlayers)){
		endGroupTest(gameId);
	}
}; //game_server.startGroupTest

//TODO
function startGroupTestTimer(gameId, timeToEndGame) {
	console.log("End group test in " + timeToEndGame + " s");
		var start_time = new Date();
		var interval = setTimeout(function() {
			try {
				clearTimeout(interval);
				console.log("End group test");
				endGroupTest(gameId);
			} catch (err) {
				
			}
		}, timeToEndGame * 1000);
		return interval;
}

function endGroupTest(gameId) {
	if (games.hasOwnProperty(gameId)) {
		console.log("end Group Test! zzzzzzzzzzzzzzzzz: "
				+ JSON.stringify(games[gameId]));
		clearTimeout(recordIntervals[gameId]);
		var dataToSend = {};
		dataToSend.notice = "endGroupTest";
		dataToSend.data = {};
		
		sendMessageToAll(games[gameId], dataToSend);
		setTimeout(function() {
			try {
				delete recordIntervals[gameId];
				delete numberOfPlayerAnswer[gameId];
				console.log(JSON.stringify(games));
				Object.keys(games[gameId].clientPlayers).forEach(
						function(playerId) {
							if (currentGameOfPlayer.hasOwnProperty(playerId)) {
								delete currentGameOfPlayer[playerId];
							}
							if (players[playerId].status == 2)
								players[playerId].status = 1;
						});
				delete games[gameId];
			} catch (err) {
				console.log("Error when delete data to endGame: "
						+ JSON.stringify(err));
			}
		}, 3 * 1000);
	}
}

game_server.startGame = function(gameId, obj) {
	console.log("JSON.stringify(obj.game) :        " + JSON.stringify(obj.game));
	var gameToSave = obj.game;
	var dataToSend = {};
	console.log("Game before save: " + JSON.stringify(gameToSave));
	games[gameId] = gameToSave;
	gameToSave.gameId = gameId;
	obj.game = gameToSave;
	dataToSend.notice = "startGame";
	dataToSend.data = obj;
	try {
		Object.keys(gameToSave.clientPlayers).forEach(
				function(playerId) {
					players[playerId].status = 2;
					currentGameOfPlayer[playerId] = gameId;
					app_server.sendMsgToClient(clients[playerId], dataToSend);
				});
	} catch (err) {
		console.log("Err: " + JSON.stringify(err));
	}
	numberOfPlayerAnswer[gameId] = 0;
	games[gameId].passedRound = {};
	if (recordIntervals.hasOwnProperty(gameId)) {
		try {
			clearTimeout(recordIntervals[gameId]);
			delete recordIntervals[gameId];
		} catch (err) {
			console.log("Err: " + JSON.stringify(err));
		}
	}
	games[gameId].scores = new Array();
	Object.keys(games[gameId].clientPlayers).forEach(
			function(playerId) {
				var s = {};
				s[playerId] = 0;
				games[gameId].scores.push(s);
			});
	console.log("game saved with: " + JSON.stringify(games[gameId]));
	setTimeout(
			function() {
				recordIntervals[gameId] = startIntervalTimer(gameId,
						games[gameId].intervalTime);
			}, 3 * 1000);
	//}
}; //game_server.startGame

game_server.onPlayerAnswer = function(obj) {
	var gameId = obj.gameId;
	if (games.hasOwnProperty(gameId)) {
		if (games[gameId].gameType == 4 || games[gameId].gameType == 5) {
			onQuizAnswer(obj);
		} else if (games[gameId].gameType == 2 || games[gameId].gameType == 3) {
			onMatchingAnswer(obj);
		}
	}

}; //game_server.onPlayerAnswer

function onQuizAnswer(obj) {
	var gameId = obj.gameId;
	var round = obj.round;
	if (games.hasOwnProperty(gameId) && (games[gameId].currRound == round)) {
		console.log("games.hasOwnProperty(gameId) && (games.currRound === round)");
		//var dataToSend = {};
		numberOfPlayerAnswer[gameId] = numberOfPlayerAnswer[gameId] + 1;
		console.log(gameId + " --- " + obj.questionId + " ----- " + obj.result
				+ " \\\\\ " + JSON.stringify(numberOfPlayerAnswer));
		console.log("Found game: " + JSON.stringify(games[gameId]));
		if (games[gameId].passedRound[round] != true) // undefined or false
			games[gameId].passedRound[round] = false;
		try {
			for ( var i = 0; i < games[gameId].scores.length; i++) {
				var playerScore = games[gameId].scores[i];
				if (playerScore.hasOwnProperty(obj.playerAnswer)) {
					if (obj.result == 'true')
						playerScore[obj.playerAnswer] = playerScore[obj.playerAnswer] + 1;
					else
						playerScore[obj.playerAnswer] = playerScore[obj.playerAnswer] - 1;
				}
			}
			Object.keys(games[gameId].clientPlayers).forEach(
					function(playerId) {
						if (playerId != obj.playerAnswer) {
							var dataToSend = {};
							dataToSend.notice = obj.type;
							dataToSend.data = obj;
							sendMessageToAPlayer(playerId, dataToSend);
						}
					});
			console.log("Player length: " + Object.size(games[gameId].clientPlayers));
			if (games[gameId].passedRound[round] == false
					&& (obj.result == 'true' || numberOfPlayerAnswer[gameId] >= Object.size(games[gameId].clientPlayers))) {
				clearTimeout(recordIntervals[gameId]);
				games[gameId].passedRound[round] = true;
				//gameRounds[gameId] = gameRounds[gameId] - 1;
				games[gameId].currRound = games[gameId].currRound + 1;
				numberOfPlayerAnswer[gameId] = 0;
				//console.log("Game round remain: " + gameRounds[gameId]);
				if (games[gameId].currRound < games[gameId].roundNum) {
					console.log("Request next round");
					setTimeout(function() {
						sendRequestNextRoundToAll(games[gameId]);
						if (recordIntervals.hasOwnProperty(gameId)) {
							delete recordIntervals[gameId];
						}
						recordIntervals[gameId] = startIntervalTimer(gameId,
								games[gameId].intervalTime);
					}, 2 * 1000);
				} else {
					setTimeout(function() {
						endgame(gameId);
					}, 2 * 1000);

				}
			}
		} catch (err) {
			conso
			le.log("Error when process player answer: " + JSON.stringify(err));
		}
	} else {
		console
				.log(" nonnnnnnnnnnnnnnnn games.hasOwnProperty(gameId) && (games.currRound === round) ");
	}
}

function onMatchingAnswer(obj) {
	var gameId = obj.gameId;
	var round = obj.round;
	if (games.hasOwnProperty(gameId) && (games[gameId].currRound == round)) {
		console.log("Found game: " + JSON.stringify(games[gameId]));
		if (games[gameId].passedRound[round] != true) // undefined or false
			games[gameId].passedRound[round] = false;
		try {
			for ( var i = 0; i < games[gameId].scores.length; i++) {
				var playerScore = games[gameId].scores[i];
				if (playerScore.hasOwnProperty(obj.playerAnswer)) {
					playerScore[obj.playerAnswer] = playerScore[obj.playerAnswer] + 1;
				}
			}
			Object.keys(games[gameId].clientPlayers).forEach(
					function(playerId) {
						if (playerId != obj.playerAnswer) {
							var dataToSend = {};
							dataToSend.notice = obj.type;
							dataToSend.data = obj;
							sendMessageToAPlayer(playerId, dataToSend);
						}
					});
			if (games[gameId].passedRound[round] == false) {
				//Next round
				clearTimeout(recordIntervals[gameId]);
				games[gameId].passedRound[round] = true;
				games[gameId].currRound = games[gameId].currRound + 1;
				if (games[gameId].currRound < games[gameId].roundNum) {
					console.log("Request next round");
					setTimeout(function() {
						sendRequestNextRoundToAll(games[gameId]);
						if (recordIntervals.hasOwnProperty(gameId)) {
							delete recordIntervals[gameId];
						}
						recordIntervals[gameId] = startIntervalTimer(gameId,
								games[gameId].intervalTime);
					}, 2 * 1000);
				} else {
					setTimeout(function() {
						endgame(gameId);
					}, 2 * 1000);

				}
			}
		} catch (err) {
			console.log("Error when process player answer: "
					+ JSON.stringify(err));
		}
	} else {
		console
				.log(" nonnnnnnnnnnnnnnnn games.hasOwnProperty(gameId) && (games.currRound === round) ");
	}
}

game_server.onReceiveRqEndGame = function(obj) {
	var gameId = obj.gameId;
	console.log("Game with id: " + gameId + " receive request to end!");
	console.log("Current Games: " + JSON.stringify(games));
	if (games.hasOwnProperty(gameId)) {
		clearTimeout(recordIntervals[gameId]);
		endgame(gameId);
	}
}; //game_server.onPlayerAnswer

function is_empty(obj) {
	// null and undefined are empty
	if (obj == null)
		return true;
	// Assume if it has a length property with a non-zero value
	// that that property is correct.
	if (obj.length && obj.length > 0)
		return false;
	if (obj.length === 0)
		return true;
	for ( var key in obj) {
		if (hasOwnProperty.call(obj, key))
			return false;
	}

	return true;
}

function startIntervalTimer(gameId, timerInterval) {
	if (games.hasOwnProperty(gameId)) {
		var start_time = new Date();
		var count = 1;
		var interval = setTimeout(function() {
			try {
				games[gameId].currRound = games[gameId].currRound + 1;
				if (games[gameId].currRound < games[gameId].roundNum) {
					var end_time = new Date();
					var dif = end_time.getTime() - start_time.getTime();
					console.log("Tick no. " + count + " after "
							+ Math.round(dif / 1000) + " seconds");
					numberOfPlayerAnswer[gameId] = 0;
					sendRequestNextRoundToAll(games[gameId]);
					count++;
					delete recordIntervals[gameId];
					recordIntervals[gameId] = startIntervalTimer(gameId,
							timerInterval);
				} else {
					clearTimeout(interval);
					endgame(gameId);
				}
			} catch (err) {
			}
		}, timerInterval * 1000);
		return interval;
	}
}

function endWhenPlayerQuitGame(gameId, notice, data) {
	clearTimeout(recordIntervals[gameId]);
	if (games.hasOwnProperty(gameId)) {
		console.log("End game! zzzzzzzzzzzzzzzzz: "
				+ JSON.stringify(games[gameId]));
		var dataToSend = {};
		dataToSend.notice = notice;
		data.scores = games[gameId].scores;
		dataToSend.data = data;
		sendMessageToAll(games[gameId], dataToSend);
		try {
			delete recordIntervals[gameId];
			delete numberOfPlayerAnswer[gameId];
			//delete gameRounds[gameId];
			console.log(JSON.stringify(games));
			Object.keys(games[gameId].clientPlayers).forEach(
					function(playerId) {
						console.log("set status for user: " + playerId);
						players[playerId].status = 1;
						if (currentGameOfPlayer.hasOwnProperty(playerId)) {
							delete currentGameOfPlayer[playerId];
						}
					});
			delete games[gameId];
		} catch (err) {
			console.log("Error when delete data to endGame: "
					+ JSON.stringify(err));
		}
	}
}

function endgame(gameId) {
	if (games.hasOwnProperty(gameId)) {
		console.log("End game! zzzzzzzzzzzzzzzzz: "
				+ JSON.stringify(games[gameId]));
		var dataToSend = {};
		dataToSend.notice = "endGame";
		dataToSend.data = {
			"scores" : games[gameId].scores
		};
		sendMessageToAll(games[gameId], dataToSend);
		setTimeout(function() {
			try {
				delete recordIntervals[gameId];
				delete numberOfPlayerAnswer[gameId];
				console.log(JSON.stringify(games));
				Object.keys(games[gameId].clientPlayers).forEach(
						function(playerId) {
							if (currentGameOfPlayer.hasOwnProperty(playerId)) {
								delete currentGameOfPlayer[playerId];
							}
							if (players[playerId].status == 2)
								players[playerId].status = 1;
						});
				delete games[gameId];
			} catch (err) {
				console.log("Error when delete data to endGame: "
						+ JSON.stringify(err));
			}
		}, 3 * 1000);
	}
}

function sendRequestNextRoundToAll(game) {
	console.log("sendRequestNextRoundToAll");
	if (typeof game != undefined) {
		var dataToSend = {};
		dataToSend.notice = "nextRound";
		dataToSend.data = {
			"round" : game.currRound,
			"scores" : game.scores
		};
		sendMessageToAll(game, dataToSend);
		console.log("game saved: " + JSON.stringify(game));
	}
}

function sendMessageToAll(game, msg) {
	if (typeof game != undefined) {
		try {
			Object.keys(game.clientPlayers).forEach(
					function(playerId) {
						sendMessageToAPlayer(playerId, msg);
					});
		} catch (err) {
			console.log("Error when send msg to all");
		}
	}
}

function sendMessageToAPlayer(playerId, msg) {
	try {
		app_server.sendMsgToClient(clients[playerId], msg);
	} catch (err) {
		console.log("Error when sendMessageToAPlayer " + JSON.stringify(err));
	}
}

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};
