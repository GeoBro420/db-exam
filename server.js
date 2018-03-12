'use strict';   
    
var admin = require('firebase-admin');
var nodemailer = require('nodemailer');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http); 
var serverStartTime = Math.floor(new Date() / 1);

var mailTemplates = require('./mail-templates.json');

/*
 * USE EITHER SendGrid OR GMAIL for Notifications NOT BOTH
 *
 * SendGrid is set-up as default. 
 * If you are going to use GMAIL, comment out lines 
 * 22,23 and uncomment lines 27-35 , 37-43
*/
// using SendGrid's v3 Node.js Library 
// https://github.com/sendgrid/sendgrid-nodejs
const mail = require('@sendgrid/mail');
mail.setApiKey(process.env.SENDGRID_API_KEY);

// Configure the email transport using the default SMTP transport and a GMail account.
// See: https://nodemailer.com/
// var mail = nodemailer.createTransport({
//         host: 'smtp.gmail.com',
//         port: 465,
//         secure: true, // true for 465, false for other ports
//         auth: {
//             user: process.env.GMAIL_ADDRESS,
//             pass: process.env.GMAIL_PASSWORD
//         }
//     });     
// verify connection configuration  
// mail.verify(function(error, success) {
//    if (error) {
//         console.log(error);
//    } else {
//         console.log('Server is ready to take our messages');
//    }     
// });


// Tell Socket.io to start accepting connections
// 1 - Keep a dictionary of all the players as key/value 
var players = {};
io.on('connection', function(socket){
    console.log("New player has connected with socket id:",socket.id);
    socket.on('new-player',function(state_data){ // Listen for new-player event on this client 
      console.log("New player has state:",state_data);
      // 2 - Add the new player to the dict
      players[socket.id] = state_data;
      // Send an update event
      io.emit('update-players',players);
    })
    
    socket.on('sendFBData',function(data){
      socket.uid = data.uid;
      socket.email = data.email;
      console.log(`Received player's Google Firebase UID of ${data.uid}`);
      console.log(`Received player's email of ${data.email}`);  
    });  
  
    // socket.on('addItem',function(data){
    //   let items={};
    //   items[data.item] = true;
    //   console.log(`Adding ${data.item} to user items.`);
    //   updateUserData(socket.uid,'data/items',items);
    // });
  
    socket.on('tq',function(data){
      sendThankYouEmail(socket.email,'thankyou');
    });
  
    socket.on('disconnect',function(){
      // 3- Delete from dict on disconnect
      delete players[socket.id];
      // Send an update event 
      io.emit('update-players',players);
    })
  // Multi-player data throughput
    socket.on('send-update',function(data){
      if(players[socket.id] == null) return;
      players[socket.id].x = data.x; 
      players[socket.id].y = data.y; 
      players[socket.id].angle = data.angle; 
      players[socket.id].currAnim = data.currAnim;
      players[socket.id].text = data.text;
      io.emit('update-players',players);
    })
  
})

// [START initialize Firebase]
// Initialize the app with a service account, granting admin privileges       
admin.initializeApp({
  credential: admin.credential.cert({
    "projectId": process.env.PROJECT_ID,
    "clientEmail": process.env.CLIENT_EMAIL,
    "privateKey": process.env.PRIVATE_KEY.replace(/\\n/g, '\n')
  }), 
  databaseURL: 'https://'+process.env.PROJECT_ID+'.firebaseio.com'
});
// [END initialize Firebase]
    
// Set our simple Express server to serve up our front-end files
// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));
// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/public/index.html');
});

// This function is not used. It remains as an example for Timestamp and multiple updates at once.
function updateLastActiveUser(uid){
  var update = {};
  update['/users/' + uid + '/data/lastActive'] = admin.database.ServerValue.TIMESTAMP;
  update['/users/lastActive'] = uid;
  admin.database().ref().update(update);
}
/**
 * Update user data on Firebase
 */
// [START single_value_read]
function updateUserData(uid,path,value) {
  var userRef = admin.database().ref('/users/' + uid + '/' + path);
  console.log(`Firebase user reference obtained for ${uid}`);
  userRef.update(value).catch(function(error) {
    console.log('Failed to update user Firebase:', error);
  });
}   
// [END single_value_read]
/**
 * Send mail to user
 */  
function sendThankYouEmail(email,type) {
  console.log(`Attempting email to ${email}`);
  var mailOptions = mailTemplates[type];
  mailOptions.to = email;
  //console.log(mailOptions);
  return mail.send(mailOptions).then(function() {
    console.log('New thank you email sent to: ' + email);
  }).catch(function(e){
    console.log(e);
  });
}
/**
 * Illustrates firebase-admin access to all of database.
 * Note: grabbing the entire database state should not
 * be done routinely. Database references should be made as
 * narrow as possible.
 */ 
// var rootRef = admin.database().ref('/');
// rootRef.once('value').then(function(d){
//   console.log(d.val());
// })
// .catch(function(e){console.log(e)});
// Listen for http requests
app.set('port', (process.env.PORT || 5000));
http.listen(app.get('port'), function(){
  console.log('listening on port',app.get('port'));
});