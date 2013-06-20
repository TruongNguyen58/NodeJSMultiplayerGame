/*  Copyright (c) 2013 TruongNGUYEN
    BH Licensed.
*/
    var recordIntervals = {};
    var numberOfPlayerAnswer = {};
    var gameRounds = {};
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
        players[playerName] = {status: 1, socketId : sId};
        onUserConnect(sId, playerName);
    };

    function onUserConnect(sId, playerName) {
      var i =0;
      console.log("User: " +playerName  + " connected with socketID: " + sId);
      // Does not exist ... so, proceed
      clients[playerName] = sId;
      socketsOfClients[sId] = playerName;
      console.log("clients: " +JSON.stringify(clients));
      console.log("socketsOfClients: " +JSON.stringify(socketsOfClients));
      if(currentGameOfPlayer[playerName] != undefined) {
        try{
          var dataToSend = {};
          dataToSend.notice = "playerReconnect"
          var data = {};
            data.player = playerName;
            dataToSend.data = data;
          games[currentGameOfPlayer[playerName]]. playerIds.forEach(function(playerId){
           if(playerId != playerName) {
            app_server.sendMsgToClient(clients[playerId], dataToSend);
            }
          });
          recordIntervals[currentGameOfPlayer[playerName]] = startIntervalTimer(games[currentGameOfPlayer[playerName]], 10,currentGameOfPlayer[playerName]);
        }
        catch (err) {
          console.log("ERORR: " + JSON.stringify(err));
        }
      }
    }

    game_server.onUserDisconnect = function(sId) {
       console.log("begin onUserDisconnect");
      try{
        if(socketsOfClients[sId] != undefined) {
          if(currentGameOfPlayer[socketsOfClients[sId]] != undefined) {
            var gameId = currentGameOfPlayer[socketsOfClients[sId]];
            var dataToSend = {};
            dataToSend.notice = "playerDisconnect"
            var data = {};
            data.player = socketsOfClients[sId];
            dataToSend.data = data;
            games[gameId]. playerIds.forEach(function(playerId){
              if(playerId != socketsOfClients[sId]) {
                app_server.sendMsgToClient(clients[playerId], dataToSend);
              }
            });
            clearInterval(recordIntervals[gameId]);
            }
          }
          delete socketsOfClients[sId];
          console.log("socketsOfClients: " +JSON.stringify(socketsOfClients));
        }
      catch (err) {
        console.log("ERORR onUserDisconnect: " + JSON.stringify(err));
      }
    };

    game_server.findGame = function(msg) {
        var obj = JSON.parse(msg);
        var dataToSend = {};
        console.log('looking for a game for user: ' + obj.creatorId);
        for (var playerName in players) {
           if (players.hasOwnProperty(playerName)) {
             if(playerName != obj.creatorId && playerName.status ==1) {
                dataToSend.notice = "invite";
                dataToSend.data = obj;
                console.log('found user: ' + JSON.stringify(user.socketId));
                app_server.sendMsgToClient(players[playerName].socketId, dataToSend);
                break;
             }
           }
        }
    }; //game_server.findGame

    game_server.confirmJoinGame = function(msg) {
        console.log("Available user: " + JSON.stringify(clients));
        var obj = JSON.parse(msg);
        var dataToSend = {};
        console.log('send confirm to creatorId: ' + obj.creatorId);
        dataToSend.notice = "receiveConfirm"
        dataToSend.data = obj;
        app_server.sendMsgToClient(clients[obj.creatorId], dataToSend);
    }; //game_server.confirmJoinGame

     game_server.onStart = function(_id, msg) {
        var obj = JSON.parse(msg);
        var gameToSave = JSON.parse(obj.game);
        var dataToSend = {};
        console.log("Id after save: " + _id);
        games[_id] = gameToSave;
        console.log("game saved with: "  + JSON.stringify(gameToSave));
        dataToSend.notice = "startGame";
        dataToSend.data = obj;
         var playerIds = gameToSave.playerIds;
         var roundNum = gameToSave.roundNum;
         console.log(gameToSave +"---"+playerIds);
         // var sockets = new Array();
         try{
          var i=0;
          playerIds.forEach(function(playerId){
            currentGameOfPlayer[playerId] = _id;
            app_server.sendMsgToClient(clients[playerId], dataToSend);
          });
         }
         catch(err) {
           console.log("Err: " +JSON.stringify(err));
         }
        
         // gameSockets[_id] = sockets;
         gameRounds[_id] = roundNum;
         console.log("GameRound: " + JSON.stringify(gameRounds));
         numberOfPlayerAnswer[_id] = 0;
         setTimeout(function() {
           recordIntervals[_id] = startIntervalTimer(games[_id], 10,_id);
          }, 1*1000);
    }; //game_server.confirmJoinGame

    game_server.onPlayerAnswer = function(msg) {
      console.log(msg);
      var obj = JSON.parse(msg);
      var _id = obj.gameId;
      var dataToSend = {};
      numberOfPlayerAnswer[_id] = numberOfPlayerAnswer[_id]+1;
      console.log(_id + " --- " + obj.cardId +" ----- " + obj.result + " \\\\\ " + JSON.stringify(numberOfPlayerAnswer));
      var o_id = new ObjectID(_id);
      console.log("Found game: " +JSON.stringify(games[_id]));
      games[_id].playerIds.forEach(function(playerId){
        if(playerId != obj.playerAnswer){
          var dataToSend = {};
          dataToSend.notice = obj.type;
          dataToSend.data = obj;
          sendMessageToAPlayer(playerId, dataToSend);
        }
      });
      if(obj.result == 'true' || numberOfPlayerAnswer[_id]>= games[_id].playerIds.length) {
      
        gameRounds[_id] = gameRounds[_id] - 1;
        numberOfPlayerAnswer[_id]= 0;
        clearInterval(recordIntervals[_id]);
        console.log("Game round remain: " + gameRounds[_id]);
        if(gameRounds[_id] > 0){
          console.log("Request next round");
          sendRequestNextRoundToAll(games[_id]);
          recordIntervals[_id] = startIntervalTimer(games[_id], 10, _id);
        } 
        else {
          endgame(games[_id], _id);
        }
        // games[_id].currRound = games[_id].currRound+1;
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
        var start_time = new Date();
        console.log("Starting " + timerInterval+ " second interval, stopperd after " + gameRounds[_id]+ " th tick");
        var count = 1;
        var interval = setInterval(function(){
           gameRounds[_id] = gameRounds[_id] - 1;
            if(gameRounds[_id] > 0){
              var end_time = new Date();
              var dif = end_time.getTime() - start_time.getTime();
              console.log("Tick no. " + count + " after " + Math.round(dif/1000) + " seconds");
              sendRequestNextRoundToAll(game);
              count++;
            }
            else{
              endgame(games[_id], _id);
            }
        }, timerInterval*1000);
        return interval;
    }

    function endgame(game, _id) {
      clearInterval(recordIntervals[_id]);
      console.log("End game! zzzzzzzzzzzzzzzzz");
      var dataToSend = {};
      dataToSend.notice = "endGame";
      dataToSend.data = {};
      sendMessageToAll(game,dataToSend);
      setTimeout(function() {
        delete recordIntervals[_id];
        delete numberOfPlayerAnswer[_id];
        delete gameRounds[_id];
        games[_id].playerIds.forEach(function(playerId){
          delete currentGameOfPlayer[playerId];
        });
        delete games[_id];
      }, 1000); 
    }

    function sendRequestNextRoundToAll(game) {
      var dataToSend = {};
      dataToSend.notice = "nextRound";
      dataToSend.data = {};
      sendMessageToAll(game,dataToSend);
      game.currRound = game.currRound+1;
      console.log("game saved: "  + JSON.stringify(game));
    }

    function sendMessageToAll(game, msg) {
      setTimeout(function() {
        game.playerIds.forEach(function(playerId){
          sendMessageToAPlayer(playerId, msg);
        });
      }, 500);  
    }

    function sendMessageToAPlayer(playerId, msg) {
        app_server.sendMsgToClient(clients[playerId], msg)
    }


