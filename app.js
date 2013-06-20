
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

 // io.set('origins', 'http://localhost:8888/:*');
io.configure('development', function(){
  io.set('transports', ['xhr-polling']);
  io.set("polling duration", 10); 
   io.set('close timeout', 10); // 24h time out
});

var clients = {};
 
var socketsOfClients = {};

function onUserConnect(socket, userName) {
 
      // Does not exist ... so, proceed
      clients[userName] = socket.id;
      socketsOfClients[socket.id] = userName;
  
}

io.sockets.on('connection', function(socket) {
  console.log("CLIENT:" + socket.id  + " CONNECTED TO SERVER");
  socket.on('setusername', function(playerName) {
    // Is this an existing user name?
    onUserConnect(socket,playerName);
    // userJoined(playerName);
    game_server.setUser(socket.id, playerName);
  });

  socket.on('request', function(msg) {
    var obj = JSON.parse(msg);
    console.log("Receive request from cilent: " +msg);
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
      game_server.getAvailablePlayers(socket.id);
    }
    else if(obj.type == "invite") {
      game_server.inviteToGame(msg);
    }
    // Is this an existing user name?
    
  });
  socket.on('disconnect', function() {
    game_server.onUserDisconnect(socket.id);
    // userLeft(socketsOfClients[socket.id]);
  });
});
 
function userJoined(uName) {
    Object.keys(socketsOfClients).forEach(function(sId) {
      if(io.sockets.sockets[sId]) {
        console.log("User: " + uName + " connect to channel +xxxxxxxxxxxxxxxxxxxxxxxxxxxx " + JSON.stringify(uName));
      io.sockets.sockets[sId].emit('userJoined', { "userName": uName });
      }
       
    })
}
 
function userLeft(uName) {
  try{
    console.log("User: " + uName + " disconnect to channel +xxxxxxxxxxxxxxxxxxxxxxxxxxxx " + JSON.stringify(uName));
    io.sockets.emit('userLeft', { "userName": uName });
    // delete socketsOfClients[clients[uName]];
    // delete clients[uName];
  }
  catch (err){
    console.log("Error when user left: " + JSON.stringify(err));
  }    
}

app_server.sendMsgToClient = function(sId, msg) {
  try{
    console.log("sendMsgToClient: " + sId + " with msg: " + JSON.stringify(msg));
     io.sockets.sockets[sId].emit('message', msg);
  }
  catch(err) {
    console.log("Error: " + JSON.stringify(err));
  }
 
};

var hasOwnProperty = Object.prototype.hasOwnProperty;


