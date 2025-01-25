const messageBlockSize = 10; //how many messages to include in conversation

const path = require('path');
const fs = require('fs');
const express = require('express');
const WebSocket = require('ws');
const { MongoClient } = require('mongodb');  // Import MongoDB driver
const Database = require('./Database'); // Import the Database class


function logRequest(req, res, next){
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

const host = 'localhost';
const port = 3000;
const clientApp = path.join(__dirname, 'client');

// express app
let app = express();

app.use(express.json()) 						// to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest);							// logging for debug

// assuming cpen322-tester.js is in the same directory as server.js
const cpen322 = require('./cpen322-tester.js');

// serve static files (client-side)
app.use('/', express.static(clientApp, { extensions: ['html'] }));
app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});
//database
const db = Database('mongodb://localhost:27017', "cpen322-messenger");
//defult chatrooms 
//to be updated once rooms are added

//associative array that stores message data for each room id
var messages = {};
db.getRooms().then((result) => {
	result.forEach((room) => {
		messages[room._id] = [];
	})
})
.catch(err => {
    console.error("Failed to get room from Database", err);
});

//handler for httprequest send to /chat
app.route('/chat')
.get((req, res) => {
    console.log('GET request received');

    db.getRooms()
	.then( (rooms)=>{
		rooms.forEach((room)=>{
			room.messages = messages[room._id];
			// console.log(room);
		});
		res.status(200).json(rooms);
	})
	.catch(err => {
		console.error("Failed to retrieve chat rooms:", err);
		res.status(500).send(err);
	});
})
.post((req, res)=>{
	db.addRoom(req.body).then((result) => {
		messages[result._id] = [];
		res.status(200).send(JSON.stringify(result));
	},
	(err) => {
		res.status(400).send(err);
	});
});

app.route('/chat/:room_id')
.get((req, res) => {
    console.log('GET request received');
	db.getRoom(req.params.room_id)
	.then((room) => {
			if (room != null) {
				res.send(room);	
			} else {
				res.status(404).send(`Room ${req.params.room_id} was not found`);
			}
		}
	);
});

app.route('/chat/:room_id/messages')
.get((req, res) => {
	console.log('GET request received for messages');
	db.getLastConversation(req.params.room_id, req.query.before)
	.then((conversation) => {
		if (conversation != null) {
			res.send(conversation);	
		} 
	})
});

const spawner = require('child_process').spawn;


	

//websocket server setup
const broker = new WebSocket.Server({port: 8000});

//conection between client and server
broker.on('connection', function connection(ws) {
	console.log('A new client has connected');

	ws.on('message', function incoming(message) {
		const parsedMessage = JSON.parse(message);
		const roomId = parsedMessage.roomId;
		const msg = {
			username: parsedMessage.username,
			text: parsedMessage.text
		};

		if (!messages[roomId]) {
			messages[roomId] = [];
		}

		messages[roomId].push(msg);

		if(messages[roomId].length == messageBlockSize){
			const convo = {
				room_id: roomId,
				timestamp: Date.now(),
				messages: messages[roomId]
			};
			
			db.addConversation(convo)
				.then(() => {
					messages[roomId] = [];
				})
				.catch((error) => {
					console.error("Failed to add conversation:", error);
				});
		}

		//sending message to the python server
		//the code is refered from youtube video https://www.youtube.com/watch?v=lSAFVMaaH-w&list=LL&index=2&t=1s
		let python_process = spawner('python3', ['main.py', msg.text]);
		
		python_process.stdout.on('data', (data) => {
			let data_to_pass_back = JSON.parse(data);
			parsedMessage.suggestion = data_to_pass_back.suggestion;
			parsedMessage.analysis = data_to_pass_back.analysis;
			
			broker.clients.forEach(client => {
				if (client.readyState === WebSocket.OPEN && client !== ws) {
					client.send(JSON.stringify(parsedMessage));
				}
			});
		});
	});
});








// at the very end of server.js
cpen322.connect('http://3.98.223.41/cpen322/test-a4-server.js');
cpen322.export(__filename, { app });
cpen322.export(__filename, { messages });
cpen322.export(__filename, { broker });
cpen322.export(__filename, { app });
cpen322.export(__filename, { db });
cpen322.export(__filename, { messages });
cpen322.export(__filename, { messageBlockSize });
