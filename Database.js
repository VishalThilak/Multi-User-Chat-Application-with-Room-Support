const { MongoClient, ObjectId } = require('mongodb');	// require the mongodb driver

/**
 * Uses mongodb v6.3 - [API Documentation](http://mongodb.github.io/node-mongodb-native/6.3/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen322 app.
 */
function Database(mongoUrl, dbName){
	if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
	this.connected = new Promise((resolve, reject) => {
		const client = new MongoClient(mongoUrl);

		client.connect()
		.then(() => {
			console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
			resolve(client.db(dbName));
		}, reject);
	});
	this.status = () => this.connected.then(
		db => ({ error: null, url: mongoUrl, db: dbName }),
		err => ({ error: err })
	);
}

Database.prototype.getRooms = function(){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			db.collection('chatrooms').find().toArray()
				.then(chatrooms => resolve(chatrooms))
				.catch(err => reject(new Error('Failed to get rooms: ' + err.message)));
		})
	)
}

Database.prototype.getRoom = function(room_id){
	return this.connected.then(db =>
		new Promise(async (resolve, reject) => {
			try {
				let target;
				
				if (typeof room_id === 'string') {
					try {
						//try with object id
						target = await db.collection("chatrooms").findOne({_id: new ObjectId(room_id)});
					} catch (e) {
						//try with string
						target = await db.collection("chatrooms").findOne({_id: room_id});
					}
				} else {
					//room_id is already an object id
					target = await db.collection("chatrooms").findOne({_id: room_id});
				}
				resolve(target);
				
			} catch (err) {
				reject(new Error(`Failed to get room: ${err.message}`));
			}
		})
	);
}

Database.prototype.addRoom = function(room){
	return this.connected.then(db => 
		new Promise((resolve, reject) => {
			if (!room.name || room.name.trim() === '') {
				reject(new Error("Room name is required"));
				return;
			}
			
			if (!room._id) {
				db.collection("chatrooms").countDocuments()
					.then(count => {
						room._id = `room-${count + 1}`; 
						return db.collection("chatrooms").insertOne(room);
					})
					.then(() => resolve(room))  
					.catch(err => reject(new Error("Failed to add room: " + err.message)));
			} else {
				db.collection("chatrooms").insertOne(room)
					.then(() => resolve(room))  
					.catch(err => reject(new Error("Failed to add room: " + err.message)));
			}
			
		})
	)
}

Database.prototype.getLastConversation = function(room_id, before){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			if (before == undefined) {
				before = Date.now();
			}

			db.collection("conversations")
				.find({room_id: room_id})
				.toArray()
				.then(result => {
					var closest = before;
					var target;

					result.forEach(conversation => {
						if (conversation.timestamp < before) {
							if((Math.abs(conversation.timestamp - before)) < closest){
								closest = Math.abs(conversation.timestamp - before);
								target = conversation;
							}
						}
					});
					resolve(target);
				})
				.catch(err => reject(new Error("Failed to get last conversation: " + err.message)));
		})
	)
}

Database.prototype.addConversation = function(conversation){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			if(!conversation.room_id || !conversation.timestamp || !conversation.messages){
				return reject(new Error("Missing some field(s)"));
			}
			
			//insert document into conversation collection
			db.collection('conversations').insertOne(conversation)
				.then(() => resolve(conversation))
				.catch(err => reject(new Error("Failed to add conversation: " + err.message)));
		})
	)
}

module.exports = Database;