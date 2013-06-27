/*  Copyright (c) 2013 TruongNGUYEN
    BH Licensed.
*/

  var TYPE_INVITE = "invite";
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

    var recordIntervals = {};
    var numberOfPlayerAnswer = {};
    var clients = {};
    var socketsOfClients = {};
    var games = {};
    var players = {};
    var currentGameOfPlayer = {};
    var
        game_server = module.exports,
        app_server = require('./app.js'),
        verbose     = true;

    game_server.setUser = function(sId, playerName) {
        console.log("begin set user");
        onUserConnect(sId, playerName);
    };

    function onUserConnect(sId, playerName) {
      var i =0;
      console.log("User: " +playerName  + " connected with socketID: " + sId);
      // Does not exist ... so, proceed
      clients[playerName] = sId;
      if(typeof players[playerName] != undefined) {
        delete players[playerName];
      }
      players[playerName] = {"status": 1, "socketId" : sId};
      console.log("Current player: " + JSON.stringify(players[playerName]));
      Object.keys(socketsOfClients).forEach(function(oldSocketId){
         console.log("Key: " +oldSocketId + " Value: " + socketsOfClients[oldSocketId] + " PlayerName: " + playerName);
        if (socketsOfClients[oldSocketId] == playerName){
          delete socketsOfClients[oldSocketId];
        }
      });
    
      socketsOfClients[sId] = playerName;
      console.log("clients: " +JSON.stringify(clients));
      console.log("socketsOfClients: " +JSON.stringify(socketsOfClients));
    }

    game_server.onUserDisconnect = function(sId) {
      
      try{
        if(socketsOfClients[sId] != undefined) {
          console.log("Player: " + clients[socketsOfClients[sId]]+ " playerDisconnect game");
          if(currentGameOfPlayer[socketsOfClients[sId]] != undefined) {
            var gameId = currentGameOfPlayer[socketsOfClients[sId]];
            var data = {"player" : socketsOfClients[sId]};
            endWhenPlayerQuitGame(games[gameId], gameId, "playerQuitGame", data)
          }
          delete clients[socketsOfClients[sId]];
          delete socketsOfClients[sId];
		  delete players[playerId];
        }
      }
      catch (err) {
        console.log("ERORR onUserDisconnect: " + JSON.stringify(err));
      }
    };

    game_server.onUserQuitGame = function(sId) {
       console.log("Player: " + clients[socketsOfClients[sId]]+ " Quit game");
      try{
        if(socketsOfClients[sId] != undefined) {
          if(currentGameOfPlayer[socketsOfClients[sId]] != undefined) {
            var gameId = currentGameOfPlayer[socketsOfClients[sId]];
            var data = {"player" : socketsOfClients[sId]};
            endWhenPlayerQuitGame(games[gameId], gameId, "playerQuitGame", data)
          }
        }
      }
      catch (err) {
        console.log("ERORR onUserQuitGame: " + JSON.stringify(err));
      }
    };


    game_server.getAvailablePlayers = function(sId) {
        setTimeout(function() {
        try{
          var availableUsers = new Array();
          console.log("online users: " + JSON.stringify(players));
          Object.keys(players).forEach(function(userName){
          if (players[userName].status == 1)
            availableUsers.push(userName);
          });
          console.log('Sending availableUsers to ' + sId);

          var dataToSend  = {"notice": TYPE_ONLINE_PLAYERS, "data":{"availablePlayers":availableUsers}};
          app_server.sendMsgToClient(sId, dataToSend);
           
        }
         catch(err) {
             console.log("Error when delete data to endGame: " + JSON.stringify(err));
        }
       
      }, 1*1000); 
      
    }; //game_server.getAvailablePlayers

    game_server.findGame = function(msg) {
        var obj = JSON.parse(msg);
        var dataToSend = {};
        console.log('looking for a game for user: ' + obj.data.sender);
        for (var playerName in players) {
          console.log(JSON.stringify(playerName));
           if (players.hasOwnProperty(playerName)) {
             if(playerName != obj.sender && players[playerName].status ==1) {
                dataToSend.notice = TYPE_INVITE;
                dataToSend.data = obj;
                console.log('found user: ' + JSON.stringify(playerName));
                app_server.sendMsgToClient(clients[playerName], dataToSend);
                break;
             }
           }
        }
    }; //game_server.findGame

    game_server.inviteToGame = function(sId, msg) {
        var obj = JSON.parse(msg);
        var dataToSend = {};
        console.log('looking for a game for user: ' + obj.data.sender);
        obj.data.friends.forEach(function(playerId){
          if(players[playerId].status == 1) {
            dataToSend.notice = TYPE_INVITE;
             dataToSend.data = obj.data;
             console.log('send invite to user: ' + JSON.stringify(playerId));
             app_server.sendMsgToClient(clients[playerId], dataToSend);
          }
          else {
            dataToSend.notice = TYPE_PLAYER_NOT_AVAILABLE;
            dataToSend.data = {"friends" : playerId};
            app_server.sendMsgToClient(sId, dataToSend);
          }
        
        });
       
    }; //game_server.inviteToGame

    game_server.confirmJoinGame = function(msg) {
        console.log("Available user: " + JSON.stringify(clients));
        var obj = JSON.parse(msg);
        var dataToSend = {};
        console.log('send confirm to sender: ' + obj.sender);
        dataToSend.notice = "receiveConfirm"
        dataToSend.data = obj;
        app_server.sendMsgToClient(clients[obj.sender], dataToSend);
    }; //game_server.confirmJoinGame

     game_server.startGame = function(_id, msg) {
        var obj = JSON.parse(msg);
        var gameToSave = JSON.parse(obj.game);
        var dataToSend = {};
        console.log("Game before save: " + JSON.stringify(gameToSave));
        games[_id] = gameToSave;
        gameToSave.gameId = _id;
        obj.game = gameToSave;
        console.log("game saved with: "  + JSON.stringify(gameToSave));
        dataToSend.notice = "startGame";
        dataToSend.data = obj;
         //var playerIds = gameToSave.playerIds;
        // var roundNum = gameToSave.roundNum;
        // console.log(gameToSave +"---"+playerIds);
         // var sockets = new Array();
         try{
          gameToSave.playerIds.forEach(function(playerId){
            players[playerId].status = 2;
            currentGameOfPlayer[playerId] = _id;
            app_server.sendMsgToClient(clients[playerId], dataToSend);
          });
         }
         catch(err) {
           console.log("Err: " +JSON.stringify(err));
         }
        
         // gameSockets[_id] = sockets;
        // gameRounds[_id] = roundNum;
        // console.log("GameRound: " + JSON.stringify(gameRounds));
         numberOfPlayerAnswer[_id] = 0;
		 games[_id].passedRound = new Array();
         setTimeout(function() {
           recordIntervals[_id] = startIntervalTimer(games[_id], 10,_id);
          }, 3*1000);
    }; //game_server.confirmJoinGame

    game_server.onPlayerAnswer = function(msg) {
      console.log(msg);
      var obj = JSON.parse(msg);
      var _id = obj.gameId;
      if(typeof games[_id] != undefined) {
         var dataToSend = {};
         numberOfPlayerAnswer[_id] = numberOfPlayerAnswer[_id]+1;
        // console.log(_id + " --- " + obj.questionId +" ----- " + obj.result + " \\\\\ " + JSON.stringify(numberOfPlayerAnswer));
         console.log("Found game: " +JSON.stringify(games[_id]));
		  console.log("typeof games[_id].passedRound[games[_id].currRound]" +JSON.stringify(games[_id].passedRound[games[_id].currRound]);
		 if(typeof games[_id].passedRound[games[_id].currRound] == undefined){
		  games[_id].passedRound.splice(games[_id].currRound, 0, false);
			//games[_id].passedRound[games[_id].currRound] = false;
		 }
			
         try{
          games[_id].playerIds.forEach(function(playerId){
            if(playerId != obj.playerAnswer){
               var dataToSend = {};
               dataToSend.notice = obj.type;
               dataToSend.data = obj;
               sendMessageToAPlayer(playerId, dataToSend);
            }
          });
          if(games[_id].passedRound[games[_id].currRound] == false && (obj.result == 'true' || numberOfPlayerAnswer[_id]>= games[_id].playerIds.length)) {
			//games[_id].passedRound[games[_id].currRound] = true;
            //gameRounds[_id] = gameRounds[_id] - 1;
			games[_id].passedRound.splice(games[_id].currRound, 0, true);
			games[_id].currRound = games[_id].currRound+1;
            numberOfPlayerAnswer[_id]= 0;
            clearInterval(recordIntervals[_id]);
            //console.log("Game round remain: " + gameRounds[_id]);
            if(games[_id].currRound < games[_id].roundNum){
              console.log("Request next round");
              sendRequestNextRoundToAll(games[_id]);
			  if(typeof recordIntervals[_id] != undefined){
				 delete recordIntervals[_id];
			  }
              recordIntervals[_id] = startIntervalTimer(games[_id], 10, _id);
			} 
			else {
				endgame(games[_id], _id);
			}
          // 
        }
      }
      catch (err) {
         console.log("Error when process player answer: " + JSON.stringify(err));
      }
      }
     
      
    }; //game_server.onPlayerAnswer


    game_server.onReceiveRqEndGame = function(msg) {
      console.log(msg);
      var obj = JSON.parse(msg);
      var _id = obj.gameId;
      console.log("Game with id: " + _id + " receive request to end!");
      console.log("Current Games: " + JSON.stringify(games) );
      if(typeof games[_id] != undefined) {
        endgame(games[_id],_id);
      }
    }; //game_server.onPlayerAnswer

    function is_empty(obj) {
    // null and undefined are empty
        if (obj == null) return true;
        // Assume if it has a length property with a non-zero value
        // that that property is correct.
        if (obj.length && obj.length > 0)    return false;
        if (obj.length === 0)  return true;
        for (var key in obj) {
            if (hasOwnProperty.call(obj, key))    return false;
        }

        return true;
    }

    function startIntervalTimer(game, timerInterval, _id) {
      if(typeof game != undefined){
         var start_time = new Date();
        //console.log("Starting " + timerInterval+ " second interval, stopperd after " + gameRounds[_id]+ " th tick");
        var count = 1;
        var interval = setInterval(function(){
           //gameRounds[_id] = gameRounds[_id] - 1;
		   if(typeof games[_id] != undefined){
		    games[_id].currRound = games[_id].currRound+1;
            if(games[_id].currRound < games[_id].roundNum){
              var end_time = new Date();
              var dif = end_time.getTime() - start_time.getTime();
              console.log("Tick no. " + count + " after " + Math.round(dif/1000) + " seconds");
              sendRequestNextRoundToAll(game);
              count++;
            }
            else{
              clearInterval(this);
              endgame(games[_id], _id);
            }
		   }
        }, timerInterval*1000);
        return interval;
      } 
    }

    function endWhenPlayerQuitGame(game, _id, notice, data) {
      clearInterval(recordIntervals[_id]);
      console.log("End game! zzzzzzzzzzzzzzzzz: " +JSON.stringify(game));
      var dataToSend = {};
      dataToSend.notice = notice;
      dataToSend.data = data;
      sendMessageToAll(game,dataToSend);
      setTimeout(function() {
        try{
           delete recordIntervals[_id];
            delete numberOfPlayerAnswer[_id];
            //delete gameRounds[_id];
            console.log(JSON.stringify(games));
            games[_id].playerIds.forEach(function(playerId){
              players[playerId].status = 1;
              if(typeof currentGameOfPlayer[playerId] != undefined)
                delete currentGameOfPlayer[playerId];
            });
            delete games[_id];
        }
         catch(err) {
             console.log("Error when delete data to endGame: " + JSON.stringify(err));
        }
       
      }, 3*1000); 
    }

    function endgame(game, _id) {
     // endgame(game, _id, "endGame", {});
      clearInterval(recordIntervals[_id]);
      console.log("End game! zzzzzzzzzzzzzzzzz: " +JSON.stringify(game));
      var dataToSend = {};
      dataToSend.notice = "endGame";
      dataToSend.data = {};
      sendMessageToAll(game,dataToSend);
      setTimeout(function() {
        try{
           delete recordIntervals[_id];
            delete numberOfPlayerAnswer[_id];
          //  delete gameRounds[_id];
            console.log(JSON.stringify(games));
            games[_id].playerIds.forEach(function(playerId){
              if(typeof currentGameOfPlayer[playerId] != undefined)
                delete currentGameOfPlayer[playerId];
              if(players[playerId].status  == 2 )
               players[playerId].status = 1;
            });
            delete games[_id];
        }
         catch(err) {
             console.log("Error when delete data to endGame: " + JSON.stringify(err));
        }
       
      }, 3*1000); 
    }

    function sendRequestNextRoundToAll(game) {
     if(typeof game != undefined) {
    //  game.currRound = game.currRound+1;
        var dataToSend = {};
        dataToSend.notice = "nextRound";
        dataToSend.data = {"round" : game.currRound};
        sendMessageToAll(game,dataToSend);
        console.log("game saved: "  + JSON.stringify(game));
     }
    }

    function sendMessageToAll(game, msg) {
      console.log(JSON.stringify(game));
      if(typeof game != undefined) {
        try{
          game.playerIds.forEach(function(playerId){
            sendMessageToAPlayer(playerId, msg);
          });
        }
        catch (err) {
        }
      } 
    }

    function sendMessageToAPlayer(playerId, msg) {
      try{
         app_server.sendMsgToClient(clients[playerId], msg);
      }
      catch (err) {
         console.log("Error when sendMessageToAPlayer " + JSON.stringify(err));
      }
       
    }


