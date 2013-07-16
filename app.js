
/**
 * Module dependencies.
 */



var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , chat = require('./routes/chat')
  , socketio = require('socket.io')
  , http = require('http')
  , app_server = module.exports
  , game_server = require('./game.server.js')
  , path = require('path');

var app = express();

var allowCrossDomain = function(req, res, next) {
   res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
};

app.configure(function(){
  app.use(allowCrossDomain);
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/chat', chat.main);
app.get('/users', user.list);
app.get('/ping', function(req, res) {
    res.send('pong');
});

var server = app.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
var io = socketio.listen(server, {origins: '*:*'});
io.set('origins', '*:*');

io.configure('development', function(){
  io.set('transports', ['xhr-polling']);
  io.set("polling duration", 10); 
   io.set('close timeout', 10); // 24h time out
});

io.sockets.on('connection', function(socket) {
  socket.on('setusername', function(data) {
    console.log("CLIENT:" + socket.id  + " CONNECTED TO SERVER");
    game_server.setUser(socket.id, data);
  });

  socket.on('request', function(msg) {
    var obj = JSON.parse(msg);
   // console.log("Receive request from cilent: " +msg);
   try{
	   if(obj.type == "findGame") {
		  game_server.findGame(msg);
		}
		else if(obj.type == "confirmJoinGame") {
		  game_server.confirmJoinGame(msg);
		}
		else if(obj.type == "startGame") {
		  game_server.startGame(socket.id, msg);
		}
		 else if(obj.type == "playerAnswer") {
		  game_server.onPlayerAnswer(msg);
		}
		 else if(obj.type == "onlinePlayers") {
		  game_server.getAvailablePlayers(socket.id, obj);
		}
		else if(obj.type == "invite") {
		  game_server.inviteToGame(socket.id, msg);
		}
		 else if(obj.type == "requestEndGame") {
		  game_server.onReceiveRqEndGame(msg);
		}
		else if(obj.type == "playerQuitGame") {
		  game_server.onUserQuitGame(socket.id);
		}
		else if(obj.type == "playerLogOut") {
		  socket.onDisconnect();
		  //socket.server.close();
		}
   }
   catch (err) {
   }
    
  });
  socket.on('disconnect', function() {
    game_server.onUserDisconnect(socket.id);
  });
});

app_server.sendMsgToClient = function(sId, msg) {
  try{
   // console.log("sendMsgToClient: " + sId + " with msg: " + JSON.stringify(msg));
     io.sockets.sockets[sId].emit('message', msg);
  }
  catch(err) {
    console.log("Error: " + JSON.stringify(err));
  }
 
};

app_server.sendToClient = function(sId, notice, msg) {
  try{
   // console.log("sendMsgToClient: " + sId + " with msg: " + JSON.stringify(msg));
     io.sockets.sockets[sId].emit(notice, msg);
  }
  catch(err) {
    console.log("Error: " + JSON.stringify(err));
  }
 
};

var hasOwnProperty = Object.prototype.hasOwnProperty;


