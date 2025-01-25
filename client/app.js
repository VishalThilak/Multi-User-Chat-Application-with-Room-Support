//helper functions

// Removes the contents of the given DOM element (equivalent to elem.innerHTML = '' but faster)
function emptyDOM (elem){
  while (elem.firstChild) elem.removeChild(elem.firstChild);
}

// Creates a DOM element from the given HTML string
function createDOM (htmlString){
  let template = document.createElement('template');
  template.innerHTML = htmlString.trim();
  return template.content.firstChild;
}

function sanatize(text){
	return text.replace(/</g, "").replace(/>/g, "");
}

// example usage
// var messageBox = createDOM(
//     `<div>
//         <span>Alice</span>
//         <span>Hello World</span>
//     </div>`
//     );

window.addEventListener('load', main);

var profile = { username: "Alice" }; //current user name

function main(){
  let username = prompt("Please enter your username:");
  while (!username || username.trim() === '') {
    username = prompt("Username cannot be empty. Please enter your username:");
  }
  profile.username = username;
  console.log("im in main");

  Service.getProfile()
    .then(data =>{
      profile.username = data.username;
      console.log("profile:", profile.username);
    })
    .catch(err => {
      console.error(err);
    });

  const socket = new WebSocket('ws://localhost:8000'); //test 3.98.223.41:8000
  var lobby = new Lobby();
  var lobbyView = new LobbyView(lobby);
  var chatView = new ChatView(socket);
  var profileView = new ProfileView();



  function renderRoute(){
      const hash = window.location.hash.substring(1).substring(1);
      console.log(hash);

      const pg_view = document.getElementById('page-view');
  
      // //get first part of path
  
      if(hash == "" || hash =="index"){
          emptyDOM(pg_view);
          pg_view.appendChild(lobbyView.elem);
      } else if(hash.includes('chat')){
          emptyDOM(pg_view);
          var room_id = hash.split('/')[1];
          var room = lobby.getRoom(room_id);
          pg_view.appendChild(chatView.elem);
          chatView.setRoom(room);
      } else if(hash== "profile"){
          emptyDOM(pg_view);
          pg_view.appendChild(profileView.elem);
      }
  }

  function refreshLobby(){
    Service.getAllRooms()
      .then(rooms => {
        console.log(rooms);
        rooms.forEach(room => {
          if (lobby.rooms[room._id] !== undefined) {
            lobby.rooms[room._id].name = room.name;
            lobby.rooms[room._id].image = room.image;
          } else {
            lobby.addRoom(room._id, room.name, room.image, room.messages);
          }
        });

      }, (err)=>{console.error(err)})
      .catch(err => {
        console.error(err);
      });
  }
  refreshLobby();
  renderRoute();

  setInterval(refreshLobby, 5000);
  window.addEventListener('popstate', renderRoute);

  socket.addEventListener('message', function (event) {
    var parse_message = JSON.parse(event.data);
    var room = lobby.getRoom(parse_message.roomId);
    console.log("parse_message: ", parse_message);
    room.addMessage(parse_message.username, parse_message.text, parse_message.analysis, parse_message.suggestion);
  })

  cpen322.export(arguments.callee, { renderRoute, lobbyView });
  cpen322.export(arguments.callee, { renderRoute, chatView});
  cpen322.export(arguments.callee, { renderRoute, profileView });
  cpen322.export(arguments.callee, { renderRoute, lobby });

  cpen322.export(arguments.callee, { refreshLobby, lobby });
  cpen322.export(arguments.callee, { socket });

}

class LobbyView{
constructor(lobby){
  this.elem = createDOM(
    `<div class="content"> 
        <ul class = "room-list">
        </ul>
        <div class="page-control">
            <input type="text" name="Room Title" placeholder="Room Title"/>
            <button type="button">Create Room</button>
        </div>
    </div>`
  );
  this.lobby = lobby;
  this.listElem = this.elem.querySelector('ul.room-list');
  this.inputElem = this.elem.querySelector('input');
  this.buttonElem = this.elem.querySelector('button');
  
  this.redrawList();

  this.buttonElem.addEventListener("click", ()=>{
    const room_name = this.inputElem.value;
    if(room_name.trim() == ''){
      return;
    }
    console.log('new room is about to be created');

    Service.addRoom({name:room_name, image:'assets/profile-icon.png'})
    .then((response)=> {
      
      console.log('scuccessful adding room in lobbyview' + JSON.stringify(response));

      this.lobby.addRoom(response._id, response.name, response.image, response.messages);
      this.inputElem.value = '';
    })
    .catch((err)=> console.log('unsuccseful in adding room'));
    
  })
  

  this.lobby.onNewRoom = (room)=>{
    var content = createDOM(`
      <li>
        <a href="#/chat/${room.id}">
          <img src="${room.image}" alt="Room Icon">
          ${room.name}
        </a>
      </li>
    `);
    this.listElem.appendChild(content);
  }
}

redrawList(){
  emptyDOM(this.listElem);

  for(let roomId in this.lobby.rooms){
      var room = this.lobby.rooms[roomId];
      var content = createDOM(`
        <li>
          <a href="#/chat/${room.id}">
            <img src="${room.image}" alt="Room Icon">
            ${room.name}
          </a>
        </li>
      `)
      this.listElem.appendChild(content);
  }
}

}

class ChatView{
constructor(socket){
  this.socket = socket;
  this.elem = createDOM(
    `<div class="content">
        <h4 class="room-name">Everyone in CPEN400A</h4>
        <div class="message-list">
            <div class="message">
                <span class="message-user">Alice</span>
                <span class="message-text">Hi guys!</span>
            </div>
            <div class="message my-message">
                <span class="message-user">Bob</span>
                <span class="message-text">How is everyone doing today?</span>
            </div>
        </div>

        <div id="message-control" class="page-control">
          <div id="suggestion">
            <p>Pending...</p>
          </div>
          <div id="message-input">
            <textarea name="message_bar" ></textarea>
            <button type="button">Send</button>
          </div>
        </div>
    </div>`
  );
  this.titleElem = this.elem.querySelector('h4');
  this.chatElem = this.elem.querySelector('div.message-list');
  this.inputElem = this.elem.querySelector('textarea');
  this.buttonElem = this.elem.querySelector('button');
  this.room = null;

  this.buttonElem.addEventListener('click', ()=>{
    this.sendMessage();
  });

  this.inputElem.addEventListener('keyup', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      this.sendMessage();
    }
  });

  
  this.chatElem.addEventListener('wheel', (event) => {
    console.log("wheel event");
    console.log(this.chatElem.scrollTop); 
    console.log(event.deltaY);
    if (this.chatElem.scrollTop ==0 && event.deltaY < 0 && this.room.canLoadConversation) {
        this.room.getLastConversation.next();
    }
  });
}

sendMessage(){
  const inputValue = this.inputElem.value;
  this.room.addMessage(profile.username, inputValue);
  this.inputElem.value = ''; //clear text in <input>

  var message = {
    roomId: this.room.id,
    username: profile.username,
    text: inputValue
  };

  console.log("sending message to server:", message);
  this.socket.send(JSON.stringify(message));
}

setRoom(room){
  console.log("setting room in chatview");
  this.room = room;
  this.titleElem.textContent = this.room.name;


  console.log(this.titleElem);
  emptyDOM(this.chatElem);
  for(let num in room.messages){
    var messages= room.messages[num];
    var content;
    if(messages.username == profile.username){
      content = createDOM(`
        <div class="message my-message">
              <span class="message-user">${messages.username}</span>
              <span class="message-text">${messages.text}</span>
        </div>
      `);
    }else{
      content = createDOM(`
        <div class="message">
              <span class="message-user">${messages.username}</span>
              <span class="message-text">${messages.text}</span>
        </div>
      `);
    }
    this.chatElem.appendChild(content);
  }

  this.room.onNewMessage = (messages) => {  
    var content;
    var emoji ={"neutral": "😐", "positive": "😊", "negative": "😔"};
    var show_emoji;
    console.log("messages.analysis: ", messages.analysis);
    if(messages.analysis == "neutral"){
      show_emoji = emoji["neutral"];
    }else if(messages.analysis == "positive"){
      show_emoji = emoji["positive"];
    }else if(messages.analysis == "negative"){
      show_emoji = emoji["negative"];
    }
    if(messages.username == profile.username){
      content = createDOM(`
        <div class="message my-message">
              <span class="message-user">${sanatize(messages.username)}</span>
              <span class="message-text">${sanatize(messages.text)}</span>
        </div>
      `);
      const suggestionElem = this.elem.querySelector('#suggestion p');
      suggestionElem.textContent = `Pending...`;
    }else{
      content = createDOM(`
        <div class="message">
              <span class="message-user">${sanatize(messages.username)}</span>
              <span class="message-text">${sanatize(messages.text)}</span>
              <span class="message-emoji">${show_emoji}: ${messages.analysis}</span>
        </div>
      `);
      // Update suggestion text
      const suggestionElem = this.elem.querySelector('#suggestion p');
      console.log("message.suggestion: ", messages.suggestion);
      if (messages.suggestion) {
        suggestionElem.textContent = `Suggestion: ${messages.suggestion}`;
      }
    }
    this.chatElem.appendChild(content);


  }

  this.room.onFetchConversation = conversation => {
    let scrollHeightInitial  = this.chatElem.scrollHeight;
    console.log(scrollHeightInitial);
    console.log("I am here");
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      let message = conversation.messages[i]
      let msg = `
      <div class="message">
        <span class="message-user">${message.username}</span>
        <span class="message-text">${message.text}</span>
      </div>`
      let msgDOM = createDOM(msg)
      if (message.username === profile.username) {
        msgDOM.classList.add('my-message')
      }
      this.chatElem.prepend(msgDOM)
      
    }
    let scrollHeightFinal = this.chatElem.scrollHeight;
    this.chatElem.scrollTop = scrollHeightFinal - scrollHeightInitial;
  };  
}

}

class ProfileView{
constructor(){
  this.elem = createDOM(
    `<div class="content">
        <div class="profile-form">
            <div class="form-field">
                <label for="name">Username</label>
                <input type="text">
            </div>
            <div class="form-field">
                <label for="password">Password</label>
                <input type="text">
            </div>
            <div class="form-field">
                <label for="myfile">Avatar Image</label>
                <img src="/assets/profile-icon.png" alt="profile-pic">
                <input type="file" id="myfile" name="myfile">
            </div>
            <div class="form-field" id="about_input">
                <label for="name">About</label>
                <textarea name="about" rows="10" cols="37" ></textarea>
            </div>
        </div>
        <div class="page-control">
            <button type="button" >Save</button>
        </div>
    </div>`
  ); 
}
  
}

class Room{

constructor(id, name, image = 'asset/minecraft.jpg', messages =[]){
  this.id = id;
  this.name = name;
  this.image = image;
  this.messages = messages; 
  this.canLoadConversation = true;
  this.getLastConversation = makeConversationLoader(this);
  this.time = Date.now();

}

addMessage(username, text, analysis, suggestion){
  if(text.trim().length === 0){
    return;
  }
  const obj = {username: username, text: text, analysis: analysis, suggestion: suggestion};
  this.messages.push(obj);
  if(typeof this.onNewMessage === 'function'){
    this.onNewMessage(obj);
  }else{
    console.log('onNewMessage function is not defined');
  }
}

addConversation(conversation){
  this.messages = conversation.messages.concat(this.messages);
  if(this.messages.length > 1){
    this.messages.sort((a, b) => a.timestamp - b.timestamp);
  }
 

  if(this.onFetchConversation){
    this.onFetchConversation(conversation);
  } else{
    console.log('onFetchConversation function is not defined');
  }
}


}

function* makeConversationLoader(room) {
var lastTime = room.time; 

room.canLoadConversation = true;

while (room.canLoadConversation) {
  room.canLoadConversation = false; 
  yield new Promise((resolve, reject) => {
    Service.getLastConversation(room.id, lastTime).then((result) => {
      if(result){
        lastTime = result.timestamp;
        room.canLoadConversation = true;
        room.addConversation(result);
        resolve(result);
      }else{
        room.canLoadConversation = false;
        resolve(null);
      }
    })
  })
}
}


class Lobby{
constructor(){
  this.rooms = {};
}

getRoom(roomId){
  if(this.rooms[roomId]){
    return this.rooms[roomId];
  }
}

addRoom(id, name, image, messages){
  var room = new Room(id, name, image, messages);
  this.rooms[id] = room;

  console.log("from on addroom in lobby " + JSON.stringify(room));

  if (typeof this.onNewRoom === 'function') {
    this.onNewRoom(room);
  } else {
    console.log('onNewRoom function is not defined');
  }
}

}

const Service = {
origin: window.location.origin,

getLastConversation: function(roomId, before){
  return new Promise((resolve, reject) => {
    //fetch url
    fetch(`${this.origin}/chat/${roomId}/messages?before=${before}`)
    .then(response => {
      //check http request status
      if (response.status === 200) {
        //sucessful http post request
        return response.json();
      } else {
        //failed http request
        return response.text()
          .then(err => {
            reject(new Error(err));
          });
       }
    })
    .then(data => resolve(data)) //data recived from preveous .then() and resolve that data
    .catch(err => reject(err)); //catch any error occured while ajax request -> reject it
  });
},

getAllRooms: function () {
  return new Promise((resolve, reject) => {
    //fetch url
    fetch(`${this.origin}/chat`)
      .then(response => {
        //check the status of http request
          if (response.status === 200) {
            //get request successful
            return response.json();
          } else {
            //http requeset failed -> status is not 200-> reject with Error
            return response.text()
              .then(err => {
                reject(new Error(err));
              });
          }
      })
      .then(data => resolve(data))//on resolve from preveous .then()
      .catch(err => reject(err));//catch any error occured while ajax request -> reject it
  }); 
},

addRoom: function (data) {
  return new Promise((resolve, reject) => {
    //fetch url
    fetch(`${this.origin}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => {
      //check http request status
      if (response.status === 200) {
        //sucessful http post request
        return response.json();
      } else {
        //failed http request
        return response.text()
          .then(err => {
            reject(new Error(err));
          });
       }
    })
    .then(data => resolve(data)) //data recived from preveous .then() and resolve that data
    .catch(err => reject(err)); //catch any error occured while ajax request -> reject it
  });
},

getProfile: function(){
  return new Promise((resolve, reject) => {
    //fetch url
    fetch(`${this.origin}/profile`)
      .then(response => {
        //check the status of http request
          if (response.status === 200) {
            //get request successful
            return response.json();
          } else {
            //http requeset failed -> status is not 200-> reject with Error
            return response.text()
              .then(err => {
                reject(new Error(err));
              });
          }
      })
      .then(data => resolve(data))//on resolve from preveous .then()
      .catch(err => reject(err));//catch any error occured while ajax request -> reject it
  }); 
}


};