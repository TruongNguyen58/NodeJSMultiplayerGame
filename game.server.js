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
var hasOwnProperty = Object.prototype.hasOwnProperty;

var recordIntervals = {};
var numberOfPlayerAnswer = {};
var clients = {};
var socketsOfClients = {};
var games = {};
var players = {};
var currentGameOfPlayer = {};
var groupTestTmp = {};
var groupTestKeys = {};
var queueDataToSend = {};

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

game_server.checkonline = function(req, res) {
	var userId = req.param("userid");
	log("UserId: " + userId);
	var status = 0;
	if (players.hasOwnProperty(userId)){
		status = players[userId].status;
	}
	res.send(status+"");
};

game_server.chat = function(obj) {
	log("begin chat with other user");
	var dataToSend = {};
	dataToSend.notice = TYPE_CHAT;
	dataToSend.data = obj;
	obj.players.forEach(function(player) {
		if (clients.hasOwnProperty(player)) {
			log("begin chat with user: " + player + " -- ID: "+ clients[player] + " -- dataToSend: "+ JSON.stringify(dataToSend));
			sendMessageToPlayer(clients[player], dataToSend)
		}
	});
};

game_server.setUser = function(sId, data) {
	log("begin set user");
	onUserConnect(sId, data);
	app_server.sendToClient(sId, TYPE_CONNECTED, {});
};

game_server.changeStatus = function(data) {
	log("begin change Status: " + JSON.stringify(data));
	if(players.hasOwnProperty(data.player)){
		players[data.player].status = data.status;
	}
};

function onUserConnect(sId, playerData) {
	var playerName = playerData.userName;
	var playerId = playerData.playerId;
	var i = 0;
	log("User: " + JSON.stringify(playerData) + " connected with socketID: " + sId);
	// Does not exist ... so, proceed
	clients[playerId] = sId;
	if (players.hasOwnProperty(playerId)) {
		log("players.hasOwnProperty(" + playerId + ")");
		try {
			if (currentGameOfPlayer.hasOwnProperty(playerId)) {
				var gameId = currentGameOfPlayer[playerId];
				if(games[gameId].gameRule == 1){
					var data = {};
					data.player = {"playerId" : playerId, "playerName" :playerName};
					endWhenPlayerQuitGame(gameId, "playerQuitGame", data);
				}
				else if(games[gameId].gameRule == 2){
					log("games[gameId].finishPlayers[playerId]: " + games[gameId].finishPlayers[playerId]);
					log("Object.size(games[gameId].clientPlayers): " + Object.size(games[gameId].clientPlayers));
					log("games[gameId].finish: " + games[gameId].finish);
					if(games[gameId].finishPlayers[playerId] != true){
						log("delete games[gameId].clientPlayers[playerId]: " + playerId);
						delete games[gameId].clientPlayers[playerId];
						log("Size remain: " + Object.size(games[gameId].clientPlayers));
					}
						
					if(Object.size(games[gameId].clientPlayers) <= 1 || games[gameId].finish >= Object.size(games[gameId].clientPlayers)) {
						endGroupTest(gameId);
					}
					if (currentGameOfPlayer.hasOwnProperty(playerId)) {
							delete currentGameOfPlayer[playerId];
					}
				}
			}
			if (groupTestKeys.hasOwnProperty(playerId)) {
				cancelGroupTest(playerId, groupTestKeys[playerId]);
			}
			if(groupTestTmp.hasOwnProperty(playerId)){
				var obj = {};
				obj.sender = groupTestTmp[playerId];
				obj.player = playerId;
				log("object: " + JSON.stringify(obj));
				onExitWaitingGame(sId, obj);
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
	log("Current player: " + JSON.stringify(players[playerId]));
	Object.keys(socketsOfClients).forEach(
			function(oldSocketId) {
				log("Key: " + oldSocketId + " Value: "+ socketsOfClients[oldSocketId] + " PlayerName: "+ playerId);
				if (socketsOfClients[oldSocketId] == 	playerId) {
					delete socketsOfClients[oldSocketId];
				}
			});

	socketsOfClients[sId] = playerId;
	log("clients: " + JSON.stringify(clients));
	log("socketsOfClients: " + JSON.stringify(socketsOfClients));
	if(queueDataToSend.hasOwnProperty(playerId)) {
		log("Found data not sent from last session: " + JSON.stringify(queueDataToSend[playerId]));
		sendMessageToPlayer(sId, queueDataToSend[playerId]);
		delete queueDataToSend[playerId];
	}
}



game_server.onUserDisconnect = function(sId) {

	try {
		var i = 0;
		//ad.hasOwnProperty(prop)
		if (socketsOfClients.hasOwnProperty(sId)) {
			log("Player: " + socketsOfClients[sId]+ " Disconnect game");
			log("currentGameOfPlayer: "+ JSON.stringify(currentGameOfPlayer));
			var playerId = socketsOfClients[sId];
			if (currentGameOfPlayer.hasOwnProperty(socketsOfClients[sId])) {
				var gameId = currentGameOfPlayer[socketsOfClients[sId]];
				var data = {};
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
					log("games[gameId].finishPlayers[playerId]: " + games[gameId].finishPlayers[playerId]);
					log("Object.size(games[gameId].clientPlayers): " + Object.size(games[gameId].clientPlayers));
					log("games[gameId].finish: " + games[gameId].finish);
					if(games[gameId].finishPlayers[playerId] != true){
						log("delete games[gameId].clientPlayers[playerId]: " + playerId);
						delete games[gameId].clientPlayers[playerId];
						log("Size remain: " + Object.size(games[gameId].clientPlayers));
					}
						
					if(Object.size(games[gameId].clientPlayers) <= 1 || games[gameId].finish >= Object.size(games[gameId].clientPlayers)) {
						endGroupTest(gameId);
					}
					if (currentGameOfPlayer.hasOwnProperty(playerId)) {
						delete currentGameOfPlayer[playerId];
					}
				}
					
			}
			log("groupTestTmp: " +JSON.stringify(groupTestTmp));
			if(groupTestTmp.hasOwnProperty(playerId)){
				var obj = {};
				obj.sender = groupTestTmp[playerId];
				obj.player = playerId;
				log("object: " + JSON.stringify(obj));
				onExitWaitingGame(sId, obj);
			}
			log("Grouptest keys: " + JSON.stringify(groupTestKeys));
			if (groupTestKeys.hasOwnProperty(playerId)) {
				log(playerId +  " Cancel group grest " + JSON.stringify( groupTestKeys[playerId]) );
				cancelGroupTest(playerId, groupTestKeys[playerId]);
			}
			delete players[socketsOfClients[sId]];
			delete clients[socketsOfClients[sId]];
			delete socketsOfClients[sId];
		}
	} catch (err) {
		log("ERORR onUserDisconnect: " + JSON.stringify(err));
	}
};

function cancelGroupTest (playerId, otherPlayers) {
	log("Player: " + playerId + " cancel GroupTest");
	var dataToSend = {};
	dataToSend.notice = "cancelGroupTest";
	dataToSend.data = {"player":playerId};
	for (var i=0;i<otherPlayers.length;i++){ 
		sendMessageToPlayer(socketsOfClients[otherPlayers[i]], dataToSend);
		//TODO 
		delete groupTestTmp[otherPlayers[i]];
	}
	delete groupTestKeys[playerId];
}


game_server.onUserQuitGame = function(sId) {
	log("Player: " + clients[socketsOfClients[sId]] + " Quit game");
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
					log("players[playerId]: " + JSON.stringify(players[playerId]));
					if (players[playerId].status == 2)
						players[playerId].status = 1;
					delete games[gameId].clientPlayers[playerId];
					log("games[gameId].clientPlayers: " + JSON.stringify(games[gameId].clientPlayers));
					if(Object.size(games[gameId].clientPlayers) <= 1 || games[gameId].finish >= Object.size(games[gameId].clientPlayers)) {
						endGroupTest(gameId);
					}
				}
			}
		}
	} catch (err) {
		log("ERORR onUserQuitGame: " + JSON.stringify(err));
	}
};

function removeFromObjectByKey(key) {
	  delete thisIsObject[key];
	}

game_server.getAvailablePlayers = function(sId, obj) {
	try {
		var availableUsers = new Array();
		log("online users: " + JSON.stringify(players));
		var i = 0;
		Object.keys(players).forEach(
				function(playerId) {
					log("PlayerId: " + playerId);
					// if ((obj.appName == 'superflashcard' || players[playerId].appName == obj.appName)
					// 		&& players[playerId].status == 1)
					if (players[playerId].status == 1)
						if (i <= 100) {
							availableUsers.push(players[playerId]);
						}
					i++;
				});
		log('Sending availableUsers to ' + sId);

		var dataToSend = {
			"notice" : TYPE_ONLINE_PLAYERS,
			"data" : {
				"availablePlayers" : availableUsers
			}
		};
		sendMessageToPlayer(sId, dataToSend);

	} catch (err) {
		log("Error when get getAvailablePlayers: "+ JSON.stringify(err));
	}
}; //game_server.getAvailablePlayers

game_server.findPlayer = function(obj) {
	log("findPlayer : " + JSON.stringify(obj));
	var dataToSend = {};
	dataToSend.notice = TYPE_FOUND_PLAYER;
	log('looking for player' + obj.player +' for user: ' + obj.sender);
	Object.keys(players).every(
				function(playerId) {
					try{
						if (playerId != null && players[playerId].playerName.toLowerCase() == obj.player.toLowerCase()){
							log('found user: ' + JSON.stringify(players[playerId]));
							dataToSend.data = {
								"player" : players[playerId],
								"available" : true
							};
							return false;
						}
						return true;
					}
					catch(err) {
						log("Player: " + playerId + JSON.stringify(players));
						return true;
					}						
				});
	log("dataToSend: " + JSON.stringify(dataToSend));
	if(typeof dataToSend.data === undefined) {
		dataToSend.data = {
			"player" :  {},
			"available" : false
		};
		log('player:' + JSON.stringify(playerName)+ " not available");
	}
	sendMessageToPlayer(clients[obj.sender], dataToSend);
}; //game_server.findPlayer

game_server.findGame = function(obj) {
	var dataToSend = {};
	log('looking for a game for user: ' + obj.data.sender);
	for ( var playerId in players) {
		log(JSON.stringify(playerId));
		if (playerId != obj.sender && players[playerId].status == 1) {
			dataToSend.notice = TYPE_INVITE;
			dataToSend.data = obj;
			log('found user: ' + JSON.stringify(playerId));
			sendMessageToPlayer(clients[playerId], dataToSend);
			break;
		}
	}
}; //game_server.findGame

game_server.inviteToGame = function(sId, obj) {
	var dataToSend = {};
	log('looking for a game for user: ' + obj.data.sender);
	obj.data.friends.forEach(function(playerId) {
		if (players[playerId].status == 1) {
			dataToSend.notice = TYPE_INVITE;
			dataToSend.data = obj.data;
			log('send invite to user: ' + JSON.stringify(playerId));
			sendMessageToPlayer(clients[playerId], dataToSend);
		} else {
			dataToSend.notice = TYPE_PLAYER_NOT_AVAILABLE;
			dataToSend.data = {
				"player" : players[playerId].playerName,
			};
			sendMessageToPlayer(sId, dataToSend);
		}
	});

}; //game_server.inviteToGame

game_server.confirmJoinGame = function(sId, obj) {
	log("Available user: " + JSON.stringify(clients));
	var dataToSend = {};
	log('send confirm to sender: ' + obj.sender);
	if(obj.gameRule == 2) {
		groupTestTmp[obj.player] = obj.sender;
		if(!groupTestKeys.hasOwnProperty(obj.sender)) {
			groupTestKeys[obj.sender] = new Array();
		}
		groupTestKeys[obj.sender].push(obj.player);
	}
	dataToSend.notice = "receiveConfirm"
	dataToSend.data = obj;
	sendMessageToPlayer(clients[obj.sender], dataToSend);
}; //game_server.confirmJoinGame

game_server.startGroupTest = function(gameId, obj) {
	log("JSON.stringify(obj.game) :        " + JSON.stringify(obj.game));
	var gameToSave = obj.game;
	var dataToSend = {};
	log("Game before save: " + JSON.stringify(gameToSave));
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
					sendMessageToPlayer(clients[playerId], dataToSend);
					delete groupTestTmp[playerId];
				});
	} catch (err) {
		log("Err: " + JSON.stringify(err));
	}
	if (recordIntervals.hasOwnProperty(gameId)) {
		try {
			clearTimer(recordIntervals[gameId]);
			delete recordIntervals[gameId];
		} catch (err) {
			log("Err: " + JSON.stringify(err));
		}
	}
	log("game saved with: " + JSON.stringify(games[gameId]));
	var timeToEndGame = games[gameId].roundNum * games[gameId].intervalTime;
	games[gameId].finish  = 0;
	games[gameId].finishPlayers = {};
	setTimeout(
			function() {
				recordIntervals[gameId] = startGroupTestTimer(gameId, timeToEndGame/2);
			}, 3 * 1000);
	//}
}; //game_server.startGroupTest

game_server.exitWaitingGame = function(sId, obj) {
	onExitWaitingGame(sId, obj);
}; //game_server.startGroupTest

function onExitWaitingGame (sId, obj) {
	log("On user exit waiting game: " + JSON.stringify(obj));
	try{
		var index = groupTestKeys[obj.sender].indexOf(obj.player);
		if (index > -1) {
			groupTestKeys[obj.sender].splice(index, 1);
			if(!games.hasOwnProperty(socketsOfClients[obj.sender])){
				var dataToSend = {};
				dataToSend.notice = "exitWaitingGame";
				dataToSend.data = {"player":obj.player};
				sendMessageToPlayer(clients[obj.sender], dataToSend);
			}
			else {
				var gameId = socketsOfClients[obj.sender];
				if(games[gameId].finishPlayers[obj.player] != true){
					log("delete games[gameId].clientPlayers[playerId]: " + obj.player);
					delete games[gameId].clientPlayers[obj.player];
					log("Size remain: " + Object.size(games[gameId].clientPlayers));
				}
					
				if(Object.size(games[gameId].clientPlayers) <= 1 || games[gameId].finish >= Object.size(games[gameId].clientPlayers)) {
					endGroupTest(gameId);
				}
				if (currentGameOfPlayer.hasOwnProperty(obj.player)) {
					delete currentGameOfPlayer[obj.player];
				}
			}
		}
		delete groupTestTmp[obj.player];
	}
	catch (err) {
	}
}

game_server.onPlayerFinishGroupTest = function(obj) {
	var gameId = obj.gameId;
	var finish = games[gameId].finish + 1;
	games[gameId].finish = finish;
	games[gameId].finishPlayers[obj.player] = true;
	log("Players remain: " + Object.size(games[gameId].clientPlayers) - finish);
	if(finish >= Object.size(games[gameId].clientPlayers)){
		endGroupTest(gameId);
	}
}; //game_server.startGroupTest

//TODO
function startGroupTestTimer(gameId, timeToEndGame) {
	log("End group test in " + timeToEndGame + " s");
		var start_time = new Date();
		var interval = setTimeout(function() {
			try {
				clearTimer(interval);
				log("End group test");
				endGroupTest(gameId);
			} catch (err) {
				
			}
		}, timeToEndGame * 1000);
		return interval;
}

function endGroupTest(gameId) {
	if (games.hasOwnProperty(gameId)) {
		log("end Group Test! zzzzzzzzzzzzzzzzz: "+ JSON.stringify(games[gameId]));
		clearTimer(recordIntervals[gameId]);
		var dataToSend = {};
		dataToSend.notice = "endGroupTest";
		dataToSend.data = {};
		setTimeout(function() {
			try {
				sendMessageToAll(games[gameId], dataToSend);
				delete recordIntervals[gameId];
				delete numberOfPlayerAnswer[gameId];
				log(JSON.stringify(games));
				Object.keys(games[gameId].clientPlayers).forEach(
						function(playerId) {
							if (currentGameOfPlayer.hasOwnProperty(playerId)) {
								delete currentGameOfPlayer[playerId];
							}
							if (players[playerId].status == 2)
								players[playerId].status = 1;
						});
				try{
					delete groupTestKeys[socketsOfClients[gameId]];
				}
				catch (err) {
				}
				delete games[gameId];
			} catch (err) {
				log("Error when delete data to endGame: "+ JSON.stringify(err));
			}
		}, 3 * 1000);
	}
}

game_server.startGame = function(gameId, obj) {
	log("JSON.stringify(obj.game) :        " + JSON.stringify(obj.game));
	var gameToSave = obj.game;
	var dataToSend = {};
	log("Game before save: " + JSON.stringify(gameToSave));
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
					sendMessageToPlayer(clients[playerId], dataToSend);
				});
	} catch (err) {
		log("Err: " + JSON.stringify(err));
	}
	numberOfPlayerAnswer[gameId] = 0;
	games[gameId].passedRound = {};
	if (recordIntervals.hasOwnProperty(gameId)) {
		try {
			clearTimer(recordIntervals[gameId]);
			delete recordIntervals[gameId];
		} catch (err) {
			log("Err: " + JSON.stringify(err));
		}
	}
	games[gameId].scores = new Array();
	Object.keys(games[gameId].clientPlayers).forEach(
			function(playerId) {
				var s = {};
				s[playerId] = 0;
				games[gameId].scores.push(s);
			});
	log("game saved with: " + JSON.stringify(games[gameId]));
	setTimeout(
			function() {
				recordIntervals[gameId] = startIntervalTimer(gameId,
						games[gameId].intervalTime);
			}, 500);
	//}
}; //game_server.startGame

game_server.onPlayerAnswer = function(obj) {
	var gameId = obj.gameId;
	onQuizAnswer(obj);

}; //game_server.onPlayerAnswer

function onQuizAnswer(obj) {
	var gameId = obj.gameId;
	var round = obj.round;
	if (games.hasOwnProperty(gameId) && (games[gameId].currRound == round)) {
		log("games.hasOwnProperty(gameId) && (games.currRound === round)");
		numberOfPlayerAnswer[gameId] = numberOfPlayerAnswer[gameId] + 1;
		if (games[gameId].passedRound[round] != true) // undefined or false
			games[gameId].passedRound[round] = false;
		try {
			for ( var i = 0; i < games[gameId].scores.length; i++) {
				var playerScore = games[gameId].scores[i];
				if (playerScore.hasOwnProperty(obj.playerAnswer)) {
					if (obj.result != 'false')
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
							sendMessageToPlayer(clients[playerId], dataToSend);
						}
					});
			log("Player length: " + Object.size(games[gameId].clientPlayers));
			if (games[gameId].passedRound[round] == false
					&& (obj.result != 'false' || numberOfPlayerAnswer[gameId] >= Object.size(games[gameId].clientPlayers))) {
				log("Type of recordIntervals[gameId]: " + typeof recordIntervals[gameId]);
				clearTimer(recordIntervals[gameId]);
				games[gameId].passedRound[round] = true;
				//gameRounds[gameId] = gameRounds[gameId] - 1;
				games[gameId].currRound = games[gameId].currRound + 1;
				numberOfPlayerAnswer[gameId] = 0;
				//log("Game round remain: " + gameRounds[gameId]);
				if (games[gameId].currRound < games[gameId].roundNum) {
					log("Request next round");
					setTimeout(function() {
						sendRequestNextRoundToAll(games[gameId]);
						if (recordIntervals.hasOwnProperty(gameId)) {
							delete recordIntervals[gameId];
						}
						try{
							recordIntervals[gameId] = startIntervalTimer(gameId,
								games[gameId].intervalTime);
						}
						catch(err){

						}
						
					}, 2 * 1000);
				} else {
					setTimeout(function() {
						endgame(gameId);
					}, 2 * 1000);

				}
			}
		} catch (err) {
			log("Error when process player answer: " + JSON.stringify(err));
		}
	} else {
		log(" nonnnnnnnnnnnnnnnn games.hasOwnProperty(gameId) && (games.currRound === round) ");
	}
}

function onMatchingAnswer(obj) {
	var gameId = obj.gameId;
	var round = obj.round;
	if (games.hasOwnProperty(gameId) && (games[gameId].currRound == round)) {
		log("Found game: " + JSON.stringify(games[gameId]));
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
							sendMessageToPlayer(clients[playerId], dataToSend);
						}
					});
			if (games[gameId].passedRound[round] == false) {
				//Next round
				clearTimer(recordIntervals[gameId]);
				games[gameId].passedRound[round] = true;
				games[gameId].currRound = games[gameId].currRound + 1;
				if (games[gameId].currRound < games[gameId].roundNum) {
					log("Request next round");
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
			log("Error when process player answer: "+ JSON.stringify(err));
		}
	} else {
		log(" nonnnnnnnnnnnnnnnn games.hasOwnProperty(gameId) && (games.currRound === round) ");
	}
}

game_server.onReceiveRqEndGame = function(obj) {
	var gameId = obj.gameId;
	log("Game with id: " + gameId + " receive request to end!");
	log("Current Games: " + JSON.stringify(games));
	if (games.hasOwnProperty(gameId)) {
		clearTimer(recordIntervals[gameId]);
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
		var interval = setTimeout(function() {
			try {
				games[gameId].currRound = games[gameId].currRound + 1;
				if (games[gameId].currRound < games[gameId].roundNum) {
					log("Tick xxxxxx yyyyyy zzzzzzz");
					numberOfPlayerAnswer[gameId] = 0;
					sendRequestNextRoundToAll(games[gameId]);
					if(typeof recordIntervals[gameId] != undefined){
						clearTimer(recordIntervals[gameId]);
						delete recordIntervals[gameId];
					}
					recordIntervals[gameId] = startIntervalTimer(gameId,
							timerInterval);
				} else {
					clearTimer(interval);
					endgame(gameId);
				}
			} catch (err) {
			}
		}, timerInterval * 1000);
		return interval;
	}
}

function endWhenPlayerQuitGame(gameId, notice, data) {
	clearTimer(recordIntervals[gameId]);
	if (games.hasOwnProperty(gameId)) {
		log("End game! zzzzzzzzzzzzzzzzz: "+ JSON.stringify(games[gameId]));
		var dataToSend = {};
		dataToSend.notice = notice;
		data.scores = games[gameId].scores;
		dataToSend.data = data;
		sendMessageToAll(games[gameId], dataToSend);
		try {
			delete recordIntervals[gameId];
			delete numberOfPlayerAnswer[gameId];
			//delete gameRounds[gameId];
			log(JSON.stringify(games));
			Object.keys(games[gameId].clientPlayers).forEach(
					function(playerId) {
						log("set status for user: " + playerId);
						players[playerId].status = 1;
						if (currentGameOfPlayer.hasOwnProperty(playerId)) {
							delete currentGameOfPlayer[playerId];
						}
					});
			delete games[gameId];
		} catch (err) {
			log("Error when delete data to endGame: "+ JSON.stringify(err));
		}
	}
}

function endgame(gameId) {
	if (games.hasOwnProperty(gameId)) {
		log("End game! zzzzzzzzzzzzzzzzz: "+ JSON.stringify(games[gameId]));
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
				log(JSON.stringify(games));
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
				log("Error when delete data to endGame: "+ JSON.stringify(err));
			}
		}, 3 * 1000);
	}
}

function sendRequestNextRoundToAll(game) {
	log("sendRequestNextRoundToAll");
	if (typeof game != undefined) {
		var dataToSend = {};
		dataToSend.notice = "nextRound";
		try{
			dataToSend.data = {
				"round" : game.currRound,
				"scores" : game.scores
			};
		}
		catch(err) {
			dataToSend.data = {};
		}
		
		sendMessageToAll(game, dataToSend);
		log("game saved: " + JSON.stringify(game));
	}
}

function sendMessageToAll(game, msg) {
	if (typeof game != undefined) {
		try {
			Object.keys(game.clientPlayers).forEach(
					function(playerId) {
						try{
							app_server.sendMsgToClient(clients[playerId], msg);
						}
						catch(err) {
							log("Error when send msg to client: " + sId);
							if(msg.notice == "endGroupTest")
								queueDataToSend[playerId] = msg;
						}
						
					});
		} catch (err) {
			log("Error when send msg to all");
		}
	}
}

function sendMessageToPlayer(sId, msg) {
	try {
		app_server.sendMsgToClient(sId, msg);
	} catch (err) {
		log("Error when send msg to client: " + sId);
	}
}

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

function clearTimer(timer) {
	try{
		log("Clear time out here: " + JSON.stringify(timer));
	}
	catch (err) {
		log("Clear timer " + typeof timer);
	}
	
	clearTimeout(timer);
}

function log(msg) {
	//log(msg);
} 
