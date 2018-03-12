'use strict';
// Just to remove error indicators in Glitch editor
var firebase = window.firebase;
var io = window.io;
// Shortcuts to DOM Elements.
var signInButton = document.getElementById('sign-in-button');
var signOutButton = document.getElementById('sign-out-button');
var userInfo = document.getElementById('user-ids');
var splashPage = document.getElementById('page-splash');
var gamePage = document.getElementById('page-game');
var listeningFirebaseRefs = [];
/**
 * Starts listening for changes to database references
 */
// [START adding db listeners]
function startDatabaseQueries() {
  // certain database references will require uid in path
  var myUserId = firebase.auth().currentUser.uid;
  // Email may also be accessed this way if needed
  //var myEmail = firebase.auth().currentUser.email;
  // Listen for changes to share node in database
  //var shareRef = firebase.database().ref('share/')
  //shareRef.on('value', function(snapshot) {
    //doSomethingWithNewValue(snapshot.val());
  //});
  // Keep track of all Firebase ref(s) we are listening to.
  // listeningFirebaseRefs.push(shareRef);
}
// [END adding db listeners]
/**
 * Writes the user's data to the database.
 */
// [START basic_write]
function writeUserData(userId, name, email, imageUrl) {
  firebase.database().ref('users/' + userId + '/profile').set({
    username: name,
    email: email,
    profile_picture : imageUrl
  });
}
// [END basic_write]

/**
 * Cleanups the UI and removes all Firebase listeners.
 */
function cleanupUi() {
  userInfo.innerHTML = '';
  listeningFirebaseRefs.forEach(function(ref) {
    ref.off();
  });
  listeningFirebaseRefs = [];
}

function userExistsCallback(user, exists) {
  if (exists) {
    
  } else {
    writeUserData(user.uid, user.displayName, user.email, user.photoURL);
    socket.emit('tq');
  }
}

function checkIfUserExists(user) {
  var usersRef = firebase.database().ref('users/' + user.uid + '/profile');
  usersRef.once('value', function(snapshot) {
    var exists = (snapshot.val() !== null);
    userExistsCallback(user, exists);
  });
}

/**
 * The ID of the currently signed-in User. We keep track of this to detect Auth state change events that are just
 * programmatic token refresh but not a User status change.
 */
var currentUID;
var socket;
/**
 * Triggers every time there is a change in the Firebase auth state (i.e. user signed-in or user signed out).
 */
function onAuthStateChanged(user) {
  // We ignore token refresh events.
  if (user && currentUID === user.uid || !user && currentUID === null) {
    return;
  }
  currentUID = user ? user.uid : null;

  cleanupUi();
  if (user) {
    splashPage.style.display = 'none';
    checkIfUserExists(user);
    startDatabaseQueries();
    userInfo.innerHTML += `<h3>Your Google Firebase UID is ${user.uid}</h3>`;
    socket = io();
    socket.on('connect',function(){
      userInfo.innerHTML += `<h3>Your SocketIO ID is ${socket.id}</h3>`;
      socket.emit('sendFBData',{uid:user.uid,email:user.email});
    });
  } else {
    // Display the splash page where you can sign-in.
    splashPage.style.display = '';
  }
}

// Bindings on load.
window.addEventListener('load', function() {
  // Bind Sign in button.
  signInButton.addEventListener('click', function() {
    var provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);
  });

  // Bind Sign out button.
  signOutButton.addEventListener('click', function() {
    firebase.auth().signOut();
    socket.close();
  });

  // Listen for auth state changes
  firebase.auth().onAuthStateChanged(onAuthStateChanged);

}, false);