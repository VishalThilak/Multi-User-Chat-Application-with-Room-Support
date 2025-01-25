const crypto = require('crypto');

class SessionError extends Error {};

function SessionManager (){
	// default session length - you might want to
	// set this to something small during development
	const CookieMaxAgeMs = 600000;

	// keeping the session data inside a closure to keep them protected
	const sessions = {};

	// might be worth thinking about why we create these functions
	// as anonymous functions (per each instance) and not as prototype methods
	this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
		/* To be implemented */
		const randomToken = crypto.randomBytes(32).toString('hex');
		const obj= {
			username: username,
			time: Date.now(),
			expiere: Date.now()+CookieMaxAgeMs
		}
		sessions[randomToken] = obj;

		response.cookie('cpen322-session', randomToken, {maxAge: maxAge,});

		setTimeout(() => {
			delete sessions[randomToken]; 
		}, maxAge);

	};

	this.deleteSession = (request) => {
		/* To be implemented */
		//delete username and session
		

		const token = request.session;
		if(sessions[token] && token){
			delete request.username;
			delete request.session;
			delete sessions[token];
		}
	};

	this.middleware = (request, response, next) => {
		/* To be implemented */
		var cookie = request.headers.cookie;
		if (cookie == null) {
			next(new SessionError("cookie header not found"));
			return;
		}else{
			//how cookieobj is created is referenced from chatgpt
			var pairs = cookie.split("; ");
			var cookieObj = Object.fromEntries(pairs.map(cookie => {
				const [key, value] = cookie.split("=");
				return [decodeURIComponent(key.trim()), decodeURIComponent(value.trim())];
			}));

			if (cookieObj['cpen322-session'] in sessions) {
				//session token found in seesions object

				request.username = sessions[cookieObj['cpen322-session']].username; // Retrieve the username associated with the session
				request.session = cookieObj['cpen322-session']; // Store the session token in the request object
				next();
			} else {
				next(new SessionError("session not found")); // session toekn  not found
				return;
			}
		}

	};
	//this function returns the session based on the token and null if nothing, referenced gpt
	this.returnSessions = (token) => {return sessions[token] || null};
	// this function is used by the test script.
	// you can use it if you want.
	this.getUsername = (token) => ((token in sessions) ? sessions[token].username : null);
};

// SessionError class is available to other modules as "SessionManager.Error"
SessionManager.Error = SessionError;

module.exports = SessionManager;