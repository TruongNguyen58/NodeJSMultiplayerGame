/*  Copyright (c) 2013 TruongNGUYEN
    BH Licensed.
*/

var mongo;
if(process.env.VCAP_SERVICES){
    var env = JSON.parse(process.env.VCAP_SERVICES);
    mongo = env['mongodb-1.8'][0]['credentials'];
}
else{
    mongo = {
        "hostname":"ec2-54-224-112-94.compute-1.amazonaws.com",
        "port":27017,
        "username":"",
        "password":"",
        "name":"",
        "db":"mydb"
    }
}

var generate_mongo_url = function(obj){
    obj.hostname = (obj.hostname || 'ec2-54-224-112-94.compute-1.amazonaws.com');
    obj.port = (obj.port || 27017);
    obj.db = (obj.db || 'test');
    if(obj.username && obj.password){
        return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
    }
    else{
        return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
    }
}

    var mongourl = generate_mongo_url(mongo);
    var recordIntervals = {};
    var numberOfPlayerAnswer = {};
    var gameRounds = {};
    var clients = {};
    var socketsOfClients = {};
    var games = {};
    var currentGameOfPlayer = {};
    var
        game_server = module.exports,
        app_server = require('./app.js'),
        db = require('mongodb'),
        ObjectID = db.ObjectID,
        verbose     = true;

    game_server.setUser = function(sId, playerName) {
        console.log("begin set user with mongourl: " + mongourl);
        db.connect(mongourl, function(err, conn){
          conn.collection('player', function(err, coll){
            coll.save({_id: playerName, status: 1, socketId : sId}, function(err, saved) {
                if( err || !saved ) console.log("User not saved");
                else console.log("User saved");
                onUserConnect(sId, playerName);
             });
          });
        });
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
        db.connect(mongourl, function(err, conn){
          conn.collection('player' , function(err, coll){
            coll.find({status: 1} ,function(err, cursor){
              cursor.toArray(function (err, users) {

                if(users.length > 1) {
                  dataToSend.notice = "invite";
                  dataToSend.data = obj;
                  for(var i = 0;i<users.length;i++) {
                     var user = users[i];
                     if(user._id != obj.creatorId) {
                         console.log('found user: ' + JSON.stringify(user.socketId));
                         app_server.sendMsgToClient(user.socketId, dataToSend);
                         break;
                     }
                   }
                }
              });
          });  
        });
      }); 
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

    // db.game.remove();
     game_server.onStart = function(msg) {
        var obj = JSON.parse(msg);
        var gameToSave = JSON.parse(obj.game);
        var dataToSend = {};
        db.connect(mongourl, function(err, conn){
          conn.collection('game' , function(err, coll){
            coll.insert(gameToSave, function(err, saved) {
              if( err || !saved ) console.log("game not saved");
              else console.log("game saved with _id: "  + JSON.stringify(saved));
              obj.game = saved;
              dataToSend.notice = "startGame";
              dataToSend.data = obj;
               var playerIds = gameToSave.playerIds;
               var roundNum = gameToSave.roundNum;
               console.log(gameToSave +"---"+playerIds);
               // var sockets = new Array();
               try{
                var i=0;
                playerIds.forEach(function(playerId){
                  currentGameOfPlayer[playerId] = saved[0]._id;
                  app_server.sendMsgToClient(clients[playerId], dataToSend);
                });
               }
               catch(err) {
                 console.log("Err: " +JSON.stringify(err));
               }

               var _id = saved[0]._id;
               games[_id] = saved[0];
               console.log("Id after save: " + _id);
               // gameSockets[_id] = sockets;
               gameRounds[_id] = roundNum;
               console.log("GameRound: " + JSON.stringify(gameRounds));
               numberOfPlayerAnswer[_id] = 0;
               setTimeout(function() {
                 recordIntervals[_id] = startIntervalTimer(games[_id], 10,_id);
                }, 1*1000);
            });
          });
        });
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


