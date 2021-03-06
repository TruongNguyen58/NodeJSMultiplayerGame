/**
 * Module dependencies.
 */

var express = require('express'),
socketio = require('socket.io'), 
http = require('http'), 
app_server = module.exports, 
game_server = require('./game.server.js'), 
path = require('path'),
https = require('https'),
fs = require('fs');

var sslOptions = {
  key: fs.readFileSync('ssl.key'),
  cert: fs.readFileSync('ssl.crt'),
  ca: fs.readFileSync('sub.class1.server.ca.pem'),
  // requestCert: true,
  // rejectUnauthorized: false
};

var app = express();

var allowCrossDomain = function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
	res.header('Access-Control-Allow-Headers',
			'Content-Type, Authorization, Content-Length, X-Requested-With');

	// intercept OPTIONS method
	if ('OPTIONS' == req.method) {
		res.send(200);
	} else {
		next();
	}
};

app.configure(function() {
	app.use(allowCrossDomain);
	app.set('port', 3003);
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function() {
	app.use(express.errorHandler());
});

app.get('/users', function(req, res) {
	game_server.users(req, res);
});
app.get('/ping', function(req, res) {
	res.send('pong');
});
app.get('/checkonline', function(req, res) {
	game_server.checkonline(req, res);
});

var server = app.listen(app.get('port'), function() {
	log("Express server listening on port " + app.get('port'));
});

// var server = https.createServer(sslOptions,app).listen(app.get('port'), function(){
//   log("Secure Express server listening on port " + app.get('port'));
// });  

var io = socketio.listen(server, {
	origins : '*:*'
});
io.set('origins', '*:*');

io.configure('development', function() {
	io.set('transports', [ 'xhr-polling' ]);
	io.set("polling duration", 15);
	io.set('close timeout', 15); // 24h time out
});

io.sockets.on('connection', function(socket) {
	socket.on('setusername', function(data) {
		log("CLIENT:" + socket.id + " CONNECTED TO SERVER");
		game_server.setUser(socket.id, data);
	});

	socket.on('request', function(msg) {
		var obj = JSON.parse(msg);
		// log("Receive request from cilent: " +msg);
		try {
			if (obj.type == "chat") {
				game_server.chat(obj);
			} else if (obj.type == "findGame") {
				game_server.findGame(obj);
			} else if (obj.type == "changeStatus") {
				game_server.changeStatus(obj);
			}else if (obj.type == "findPlayer") {
				game_server.findPlayer(obj);
			} else if (obj.type == "confirmJoinGame") {
				game_server.confirmJoinGame(socket.id, obj);
			} else if (obj.type == "startGame") {
				game_server.startGame(socket.id, obj);
			}else if (obj.type == "exitWaitingGame") {
				game_server.exitWaitingGame(socket.id, obj);
			} else if (obj.type == "startGroupTest") {
				game_server.startGroupTest(socket.id, obj);
			} else if (obj.type == "finishGroupTest") {
				game_server.onPlayerFinishGroupTest(obj);
			} else if (obj.type == "playerAnswer") {
				game_server.onPlayerAnswer(obj);
			} else if (obj.type == "onlinePlayers") {
				game_server.getAvailablePlayers(socket.id, obj);
			} else if (obj.type == "invite") {
				game_server.inviteToGame(socket.id, obj);
			} else if (obj.type == "requestEndGame") {
				game_server.onReceiveRqEndGame(obj);
			} else if (obj.type == "playerQuitGame") {
				game_server.onUserQuitGame(socket.id);
			} else if (obj.type == "playerLogOut") {
				socket.onDisconnect();
			}
		} catch (err) {
			log("Errororororororororororor");
		}

	});
	socket.on('disconnect', function() {
		game_server.onUserDisconnect(socket.id);
	});
});

app_server.sendMsgToClient = function(sId, msg) {
	io.sockets.sockets[sId].emit('message', msg);
};

app_server.sendToClient = function(sId, notice, msg) {
	try {
		// log("sendMsgToClient: " + sId + " with msg: " + JSON.stringify(msg));
		io.sockets.sockets[sId].emit(notice, msg);
	} catch (err) {
		log("Error: " + JSON.stringify(err));
	}

};

var hasOwnProperty = Object.prototype.hasOwnProperty;
function log(msg) {
	//log(msg);
} 
