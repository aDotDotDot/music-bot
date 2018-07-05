var Discord = require('discord.io');
var logger = require('winston');
var fs = require('fs');
var auth = require('./auth.json');
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
//reverse sound
//ffmpeg -i input.mp4 -af areverse reversed.mp3

var currentScores;
var loadScores = function(){
    fs.readFile('./scores.json', 'utf8', function (err, data) {
    if (err){
        saveScores({});
        currentScores = {};
    }else{
        if(data)
            currentScores = JSON.parse(data);
        else
            currentScores = {};
    }
    
    });
};
loadScores();
var saveScores = function(dataScore){
    var json = JSON.stringify(dataScore);
    fs.writeFile('./scores.json', json, 'utf8', function(err){
        if (err) throw err;
    });
};



/* Finds the voice channels in every server the bot is connected to */
var findSuitableChannels = function(client){
    var channels = client.channels;
    var servers = Object.keys(client.servers);
    var suitableChans = {};
    for(var s in servers){
        suitableChans[servers[s]] = [];
    }
    for(var i in channels){
        if(channels[i].type == 2){
            suitableChans[channels[i].guild_id].push({id: channels[i].id, name:channels[i].name, permission_length:Object.keys(channels[i].permissions.role).length});
        }
    }
    return suitableChans;
};
var suitableChannels;
var chanMusicId;//the channel wehere we will play music samples

/*Compute the levenshtein distance between 2 strings
i.e. the minimum number of single-character edits (insertions, deletions or substitutions) required to change one word into the other*/
var levenshtein = function(str,str2) {
     var cost = new Array(),
         str1 = str,
         n = str1.length,
         m = str2.length,
         i, j;
     if(n == 0) {
         return m;  
     } 
     if(m == 0) {
         return n;  
     }
     for(var i=0;i<=n;i++) {
         cost[i] = new Array();
     }
     for(i=0;i<=n;i++) {
         cost[i][0] = i;
     }
     for(j=0;j<=m;j++) {
         cost[0][j] = j;
     }
     for(i=1;i<=n;i++) {
         var x = str1.charAt(i-1);
         for(j=1;j<=m;j++) {
             var y = str2.charAt(j-1);
             if(x == y) {
                cost[i][j] = cost[i-1][j-1]; 
             } else {
                cost[i][j] = 1 + Math.min(cost[i-1][j-1], cost[i][j-1], cost[i-1][j]);
             } 
         }
     }
 return cost[n][m];  
};

/*Capitalize the first letter of each word*/
var toTitleCase = function(str) {
    return str.replace(/\w\S*/g, function(txt){
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
};


/* Initialization of stuff */
var allLyrics = [];
var allLyricsBadTr = [];
var allSound = [];
var lyrics = function(){
    fs.readdir('./lyrics', function (err, files) {
        if(err) console.log(err);
      allLyrics = files.filter(function(e){if(e!="README.md") return e;}).map(function(e) { 
            var splitted = e.replace(".txt","").replace(".mp3","").split("__");
            return [splitted[0], splitted[1]];
      });
    });
};
lyrics();
var sounds = function(){
    fs.readdir('./samples', function (err, files) {
        if(err) console.log(err);
      allSound = files.filter(function(e){if(e!="README.md") return e;}).map(function(e) { 
            var splitted = e.replace(".txt","").replace(".mp3","").split("__");
            return [splitted[0], splitted[1]];
      });
    });
};
sounds();
var lyricsBadTr = function(){
    fs.readdir('./badtr', function (err, files) {
        if(err) console.log(err);
      allLyricsBadTr = files.filter(function(e){if(e!="README.md") return e;}).map(function(e) { 
            var splitted = e.replace(".txt","").replace(".mp3","").split("__");
            return [splitted[0], splitted[1]];
      });
    });
};
lyricsBadTr();



/* Variables used globally by the bot */
var lyricsRunning;
var isRunning = false;
var currentFile = "";
var clearLine = false;
var currentChan = "";
var currentStream;
var currentGameType = "";
/*And now the functions used to (dis)play*/

/*Display line after line of a string, every second*/
var lineToLine = function(client, channelID, lyrics){
    if(clearLine){
        lyrics = [];
        clearLine = false;
        return;
    }
    isRunning=true;
    if(lyrics.length == 0){
        isRunning=false;
        return;
    }
    lyricsRunning = setTimeout(function(){
        fl = lyrics.shift();
        client.sendMessage({
                        to: channelID,
                        message: fl
                    });
        lineToLine(client, channelID, lyrics);
    }, 1000);
};

/* Randomize the file to use, and then call the previous function to display the lyrics*/
var blindTest = function(client, channelID, typeGame){
    currentChan = channelID;
    if(typeGame == 'badtr'){
        currentGameType = "badtr";
        currentFile = allLyricsBadTr[Math.floor(allLyricsBadTr.length*Math.random())];
        path = './badtr/'+currentFile[0]+"__"+currentFile[1]+".txt";
    }
    else{
        currentGameType = "lyrics";
        currentFile = allLyrics[Math.floor(allLyrics.length*Math.random())];
        path = './lyrics/'+currentFile[0]+"__"+currentFile[1]+".txt";
    }
    fs.readFile(path, 'utf8', function (err,data) {
      if (err) {
        return console.log(err);
      }
      lineToLine(client, channelID, data.split("\n"));
    });
    client.sendMessage({
                        to: channelID,
                        message: 'Let\'s go!'
                    });
}


/*Play a random sound sample in the chanMusicId, then quit the channel*/
var audioTest = function(client, channelID){
    isRunning = true;
    currentChan = channelID;
    currentGameType = "audio";
    chanMusicId = suitableChannels[client.channels[channelID].guild_id][0].id;//using the first one, maybe try/catch to get the rigth one
    client.joinVoiceChannel(chanMusicId, function(error, events) {
    //Check to see if any errors happen while joining.
        if (error) return console.error(error);
        //Then get the audio context
        client.getAudioContext(chanMusicId, function(error, stream) {
            currentStream = stream;//we will use this globally to stop the stream when someone has the correct answer
        //Once again, check to see if any errors exist
            if (error) return console.error(error);
            currentFile = allSound[Math.floor(allSound.length*Math.random())];
            //Create a stream to the file and pipe it to the stream
            //Without {end: false}, it would close up the stream
            fs.createReadStream('./samples/'+currentFile[0]+"__"+currentFile[1]+'.mp3').pipe(stream, {end: false});
            //stream.emit('done');
            //The stream fires `done` when it's got nothing else to send to Discord.
            stream.on('done', function() {
            //Handle the event, the game is not running anymore, no stream is available anymore
                client.leaveVoiceChannel(chanMusicId, function(err){
                    isRunning = false;
                    currentStream = null;
                });
            });
          });
    });
};

/*Handles the display of the scores*/
var displayScores = function(serverID, channelID, client){
    if(!currentScores[serverID] || Object.keys(currentScores[serverID]).length < 1){
        client.sendMessage({
            to: channelID,
            message: "Personne n'a de point"
        });
    }else{
        embedStr = {color: 0x00ff00,
                    footer: {
                        text: ""
                    },
                    fields: [],
                    title: '',
                    url: ''
                };
        for( var i in currentScores[serverID]){
            var field = {
                        name: "**__"+client.users[i].username+"__**",
                        value: "Score : **"+currentScores[serverID][i].score+"** (Audio : "+currentScores[serverID][i].scoreSound+", Paroles : "+currentScores[serverID][i].scoreLyrics+", Mauvaise traduction : "+currentScores[serverID][i].scoreBadTr+")",
                        score: currentScores[serverID][i].score
                    }
            embedStr.fields.push(field);
        }
        embedStr.fields = embedStr.fields.sort(function(x, y) {
            return y.score - x.score;
        });
        embedStr.fields = embedStr.fields.filter(function(e){
            return {name: e.name, value:e.value};
        });
        client.sendMessage({
            to: channelID,
            message: embedStr.fields[0].name+" est en tête",
            embed: embedStr
        });
    }
};

/* Clear the global variables, and announce the winner*/
var winner = function(user, userID, message, channelID, evt, client){
    //console.log(user, userID, message, channelID, evt);
    var server_id = client.channels[channelID].guild_id;
    //computing scores
    if(!currentScores[server_id])
        currentScores[server_id] = {};
    if(!currentScores[server_id][userID])
        currentScores[server_id][userID] = {score: 0, scoreSound: 0, scoreLyrics: 0, scoreBadTr: 0};
    currentScores[server_id][userID].score++;
    if(currentGameType == "badtr")
        currentScores[server_id][userID].scoreBadTr++;
    if(currentGameType == "lyrics")
        currentScores[server_id][userID].scoreLyrics++;
    if(currentGameType == "audio")
        currentScores[server_id][userID].scoreSound++;
    saveScores(currentScores);
    /*stopping everything*/
    if(currentStream)
        currentStream.stop();
    if(lyricsRunning){
        clearTimeout(lyricsRunning);        
        clearLine = true;
        lineToLine(client, channelID, []);
    }
    currentGameType = "";
    isRunning = false;
    currentChan = null;
    //we can now congratulate the winner
    client.sendMessage({
                        to: channelID,
                        message: "Bravo **"+user+"**\nC'était bien **"+toTitleCase(currentFile[0].replace(/_/g," "))+"** - **"+toTitleCase(currentFile[1].replace(/_/g," "))+"**"
                    });
    currentFile = null;
};


/* Bot stuff, creating ready and disconnect events*/
bot.on('ready', function (evt) {
    suitableChannels = findSuitableChannels(bot);
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});
bot.on('disconnect', function(erMsg, code) {
    logger.info('----- Bot disconnected from Discord with code', code, 'for reason:', erMsg, '-----');
    bot.connect();
});


bot.on('message', function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    var prefix = "$";
    if(userID == bot.id)
        return;
    if (message.substring(0, 1) == prefix) {
        var args = message.substring(1).split(' ');
        var cmd = args[0];
        args = args.splice(1);
        switch(cmd) {
            case 'play':
                if(!isRunning)
                    audioTest(bot, channelID);
            break;
            case 'lyrics':
                if(!isRunning)
                    blindTest(bot, channelID, 'normal');
            break;
            case 'badtr':
                if(!isRunning)
                    blindTest(bot, channelID, 'badtr');
            break;
            case 'stop':
                if(lyricsRunning){
                        clearTimeout(lyricsRunning);        
                        clearLine = true;
                        lineToLine(bot, channelID, []);
                    }
                if(currentStream)
                    currentStream.stop();
                isRunning = false;
            break;
            case 'list':
                var embedStr = {
                                color: 6826080,
                                footer: {
                                    text: ""
                                },
                                fields: [{
                                    name: "**__Paroles originales__**",
                                    value: "\`\`\`"+allLyrics.map(function(e) { 
                                              return toTitleCase(e[0].replace(/_/g," "))+" - "+toTitleCase(e[1].replace(/_/g," ").replace(".txt","").replace(".mp3",""));
                                            }).join("\n")+"\`\`\`"
                                },
                                {
                                    name: "**__Paroles mal traduites en français__**",
                                    value: "\`\`\`"+allLyricsBadTr.map(function(e) { 
                                              return toTitleCase(e[0].replace(/_/g," "))+" - "+toTitleCase(e[1].replace(/_/g," ").replace(".txt","").replace(".mp3",""));
                                            }).join("\n")+"\`\`\`"
                                },
                                {
                                    name: "**__Extraits__**",
                                    value: "\`\`\`"+allSound.map(function(e) { 
                                              return toTitleCase(e[0].replace(/_/g," "))+" - "+toTitleCase(e[1].replace(/_/g," ").replace(".txt","").replace(".mp3",""));
                                            }).join("\n")+"\`\`\`"
                                }
                                ],
                                title: '',
                                url: ''
                            };
                bot.sendMessage({
                        to: channelID,
                        message: "Je peux vous demander tout ça",
                        embed: embedStr
                    });
            break;
            case 'update-songs':
                lyrics();
                sounds();
                lyricsBadTr();
            break;
            case 'help':
                bot.sendMessage({
                        to: channelID,
                        message: "Je suis un bot qui fait des blind-tests et vous pouvez me demander :\n\`$play\` : joue un extrait musical dans le channel audio dédié, vous avez 30 secondes pour trouver le **nom de la chanson**\n\`$lyrics\` : écrit les paroles d'une chanson ligne par ligne, vous devez trouver le **nom de la chanson** avant la fin des paroles\n\`$badtr\` : fait la même chose que \`$lyrics\`, mais avec des paroles traduites directement par Google Translate\n\`$list\` : affiche la liste des morceaux disponibles\n\`$stop\` : arrête la partie en cours\n"
                    });
            break;
            case 'scores':
                displayScores(bot.channels[channelID].guild_id, channelID, bot);
            break;
         }
     }else{//no command was recognized, but we have to figure if it's a good answer 
         if(isRunning && channelID == currentChan){
             /*
            WHITE HEAVY CHECK MARK => 9989 => 
            NEGATIVE SQUARED CROSS MARK => 10062
            */
                distance = levenshtein(message.toLowerCase(), currentFile[1].replace(/_/g," ").replace(".txt","").replace(".mp3","").toLowerCase());
                if(distance <= 3){//close enough from the original string (maybe be tweaked later)
                    bot.addReaction({channelID:channelID, messageID: evt.d.id, reaction:"\u2705"});
                    winner(user, userID, message, channelID, evt, bot);
                }else{
                    bot.addReaction({channelID:channelID, messageID: evt.d.id, reaction:"\u274E"});
                }
         }
     }
});
