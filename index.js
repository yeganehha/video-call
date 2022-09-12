// create Agora client
var client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

// BLOCK CONSOLE OPEN
// var obj = Object.defineProperties(new Error,  {
//   message: {
//     get() {
//       alert('sss');
//     }
//   },
//   toString: { value() { (new Error).stack.includes('toString@')&&console.log('Safari')} }
// });
// console.log(obj);


var localTracks = {
  videoTrack: null,
  audioTrack: null
};
var remoteUsers = {};
// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
};

// the demo can auto join channel with params in url
$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  if (options.appid && options.channel) {
    $("#appid").val(options.appid);
    $("#token").val(options.token);
    $("#channel").val(options.channel);
    $("#join-form").submit();
  }
})

$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  try {
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    options.channel = $("#channel").val();
    await join();
    if(options.token) {
      $("#success-alert-with-token").css("display", "block");
    } else {
      $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
      $("#success-alert").css("display", "block");
    }
  } catch (error) {
    console.error(error);
  } finally {
    $("#leave").attr("disabled", false);
  }
})

$("#leave").click(function (e) {
  leave();
})

async function join() {

  // add event listener to play remote tracks when remote user publishs.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [ options.uid, localTracks.audioTrack, localTracks.videoTrack ] = await Promise.all([
    // join the channel
    client.join(options.appid, options.channel, options.token || null),
    // create local tracks, using microphone and camera
    AgoraRTC.createMicrophoneAudioTrack(),
    AgoraRTC.createCameraVideoTrack()
  ]);
  
  // play local video track
  localTracks.videoTrack.play("local-player");
  $("#local-player-name").text(`localVideo(${options.uid})`);
  $("#local-player-name").append(`
    <span id="mute-local" class="btn btn-danger btn-sm">Mute</span>
    <span id="no-camera-local" class="btn btn-danger btn-sm">NoCamera</span>
  `);
  
  $('#mute-local').click(function() {
    if ($('#mute-local').text() === 'Mute') {
      localTracks.audioTrack.setMuted(false)
      $('#mute-local').text('UnMute')
    } else {
      localTracks.audioTrack.setMuted(true)
      $('#mute-local').text('Mute')
    }
  });
  $('#no-camera-local').click(function() {
    if ($('#no-camera-local').text() === 'NoCamera') {
      localTracks.videoTrack.setMuted(true)
      $('#no-camera-local').text('EnableCamera')
    } else {
      localTracks.videoTrack.setMuted(false)
      $('#no-camera-local').text('NoCamera')
    }
  });
  

  // publish local tracks to channel
  await client.publish(Object.values(localTracks));
  console.log("publish success");
}

async function leave() {
  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if(track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  // remove remote users and player views
  remoteUsers = {};
  $("#remote-playerlist").html("");

  // leave the channel
  await client.leave();

  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  console.log("client leaves channel success");
}

async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {
    const player = $(`
      <div id="player-wrapper-${uid}">
        <p class="player-name">remoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
      </div>
    `);
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`);
    $(`#player-wrapper-${uid} .player-name`).append(`
      <span id="mute-player-${uid}" class="btn btn-danger btn-sm">Mute</span>
      <span id="no-camera-player-${uid}" class="btn btn-danger btn-sm">NoCamera</span>
    `);
    
    
  $(`#no-camera-player-${uid}`).click(function() {
    if ($(`#no-camera-player-${uid}`).text() === 'NoCamera') {
      user.videoTrack.setEnabled(false)
      $(`#no-camera-player-${uid}`).text('EnableCamera')
    } else {
      user.videoTrack.setEnabled(true)
      $(`#no-camera-player-${uid}`).text('NoCamera')
    }
  });
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
}

function handleUserPublished(user, mediaType) {
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

function handleUserUnpublished(user) {
  const id = user.uid;
  delete remoteUsers[id];
  $(`#player-wrapper-${id}`).remove();
}