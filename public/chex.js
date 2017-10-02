//The screen contains a canvas, upon which the board is drawn, and a set of controls
class Screen {
    constructor() {
        //Create stylesheet for canvas, controls
        this.tstyle = document.createElement('style');
        this.tstyle.type = "text/css";
        this.tstyle.id = "turnStyle";
        document.head.appendChild(this.tstyle);
        this.style = document.createElement('style');
        this.style.type = "text/css";
        this.style.id = "myStyle";
        document.head.appendChild(this.style);

        this.mc = document.getElementById("myControls");
        this.mc.onclick = function(e) { if ( document.getElementById("myDropdown").classList.contains('show') && e.target.id !== 'atbtn' && e.target.id !== 'gameIdEntry' && e.target.parentElement.id !== 'myDropdown' ) {
                                    console.log("hiding ",e);
                                    document.getElementById("myDropdown").classList.toggle("show");
                                }};
        this.ogamesc = document.getElementById("myDropdown");
        this.ngame = document.getElementById("gameIdEntry");
        this.chats = document.getElementById("myChatBox");
        this.messages = document.getElementById("myMessages");
        //Create Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = "myCanvas";
        document.getElementById("allDiv").appendChild(this.canvas);
        this.context = this.canvas.getContext('2d');
        //Create Board
        this.handle = "";
        this.beeped = 0;
        this.board = new Board(this);
        this.screenDraw();
    }
    doWebSocket() {
        var self=this;
        if ( self.sock === undefined && "WebSocket" in window) {
            var wsUrl="";
            if ( document.URL.search("https") == 0 ) {
                var wsProto = "wss://";
            }
            else {
                var wsProto = "ws://";
            }
            if ( checkUrl(wsProto + document.URL.split("/")[2] + "/ws") ) {
                wsUrl = wsProto + document.URL.split("/")[2] + "/ws";
            }
            else {
                wsUrl = wsProto + "chex.2id.us/ws";
            }
            console.log(wsUrl);
            //set up websocket here, since this object uses it
            if ( typeof(ReconnectingWebSocket) == "undefined" ) {
                this.sock = new WebSocket(wsUrl);
            }
            else {
                this.sock = new ReconnectingWebSocket(wsUrl);
            }
    
            //set up event handler for incoming messages
            this.sock.onopen = function(e) {
                var cmd = { "command": "register", "data": JSON.stringify({"handle": self.handle}), "gameid": self.board.gameid }
                consolelog("opening websocket ", cmd);
                self.sendJsonWS(JSON.stringify(cmd));
            }
            this.sock.onmessage = function(message) {
                this.lastMessageData = JSON.parse(message.data);
                if ( this.lastMessageData.command ) {
                    //parse move data
                    if ( this.lastMessageData.command == "move" ) {
                        var msgData = JSON.parse(this.lastMessageData.data);
                        self.board.pieces = msgData.pieces;
                        consolelog("this.lastMessageData=",this.lastMessageData);
                        self.board.moveIndex = msgData.moveindex;
                        self.board.playerTurn = ( self.board.moveIndex ) % 2;
                        var playerColor = ( self.board.playerTurn ) ? "white" : "black";
                        self.board.draw();
                        self.tstyle.innerText = "span#p" + self.board.playerTurn + " { font-weight: bold; }";
                        consolelog("your turn?", self.board.iam, self.board.playerTurn);
                        if ( self.board.iam == self.board.playerTurn && ! self.beeped ) {
                            consolelog("your turn ", self.beeped);
                          //  document.getElementById("beep").play();
                            //document.getElementById("beepButton").click();
                            playAudio();
                            //play("sound/beep.mp3").then(function() { consolelog("Done!"); });
                            self.beeped = 1;
                        }
                        else {
                            self.beeped = 0;
                        }
                      //  self.messages.innerHTML = "Player " + ( self.board.playerTurn + 1 ) + "'s turn (" + playerColor + ")";
                    }
                    else if ( this.lastMessageData.command == "msg" ) {
                        var msgData = this.lastMessageData.data;
                        console.log(msgData);
                        var mymsg = document.createElement("span");
                        mymsg.classList.add("aMess");
                        mymsg.title=Date().split(" ")[4];
                        mymsg.innerHTML=msgData;
                        //var mymsg = "<span class='aMess' title='" + Date().split(" ")[4] + "'>" + msgData + "</span><BR>";
                        console.log("mymsg = ",mymsg);
                        if ( msgData.search(self.handle) == 0 ) {
                            mymsg.classList.add("myComment");
                        }
                      //  self.chatsp.innerHTML += msgData + "\n";
                        self.chats.appendChild(mymsg);
                        self.chats.innerHTML += "<BR>";
                        self.chats.scrollTop = self.chats.scrollHeight;
                    }
                    else if ( this.lastMessageData.command == "players" ) {
                        var msgData = this.lastMessageData.data;
                        var playas = JSON.parse(msgData);
                        consolelog("Player update: ", playas);
                        var p0d = "";
                        var p1d = "";
                        var player0 = playas.filter(function (el) {
                            return ( el.GamePlace === 0);
                        });
                        var player1 = playas.filter(function (el) {
                            return ( el.GamePlace === 1);
                        });
                        var oplayer0 = self.board.players.filter(function (el) {
                            return ( el.GamePlace === 0);
                        });
                        var oplayer1 = self.board.players.filter(function (el) {
                            return ( el.GamePlace === 1);
                        });
                        if ( player0.length > 0 ) {
                            p0d = player0[0].Handle; 
                            if ( player0[0].Handle == self.handle ) {
                                p0d = player0[0].Handle + " (you)"
                                self.board.reverse=1;
                                self.board.iam=0;
                                self.board.draw();
                            }
                            if ( oplayer0.length == 0 && player0[0].Handle != self.handle ) {
                                var mymsg = "<span class='aMess' title='" + Date().split(" ")[4] + "'>" + player0[0].Handle + " has joined the game</span><BR>";
                                self.chats.innerHTML += mymsg;
                            }
                        }
                        else if ( oplayer0.length > 0 ) {
                            var mymsg = "<span class='aMess' title='" + Date().split(" ")[4] + "'>" + oplayer0[0].Handle + " has left the game</span><BR>";
                            self.chats.innerHTML += mymsg;
                        }
                        if ( player1.length > 0 ) {
                            p1d = player1[0].Handle;
                            if (player1[0].Handle == self.handle ) {
                                self.board.reverse=0;
                                self.board.iam=1;
                                p1d += " (you)";
                                self.board.draw();
                            }
                            if ( oplayer1.length == 0 && player1[0].Handle != self.handle ) {
                                var mymsg = "<span class='aMess' title='" + Date().split(" ")[4] + "'>" + player1[0].Handle + " has joined the game</span><BR>";
                                self.chats.innerHTML += mymsg;
                            }
                        }
                        else if ( oplayer1.length > 0 ) {
                            var mymsg = "<span class='aMess' title='" + Date().split(" ")[4] + "'>" + oplayer1[0].Handle + " has left the game</span><BR>";
                            self.chats.innerHTML += mymsg;
                        }
                        document.getElementById('p0').innerHTML = "Player 0 " + p0d;
                        document.getElementById('p1').innerHTML = "Player 1 " + p1d;
                       // self.messages.innerHTML = "<span id='p0'>Player 0 " + p0d + "</span><br><span id='p1'>Player 1 " + p1d + "</span>";
                        self.board.players = playas;
                    }
                    else if ( this.lastMessageData.command == "register" ) {
                        var msgData = this.lastMessageData.data;
                        consolelog(this.lastMessageData);
                        consolelog(msgData);
                        self.handle = JSON.parse(msgData).Handle;
                        self.board.iam = JSON.parse(msgData).GamePlace;
                        self.ngame.value = this.lastMessageData.gameid;
                        self.board.gameid = this.lastMessageData.gameid;
                    }
                    else if ( this.lastMessageData.command == "games" ) {
                        var msgData = this.lastMessageData.data;
                        consolelog(msgData);
                        var ogames = JSON.parse(msgData);
                        consolelog(ogames);
                        var gamesList = self.ogamesc;
                        for ( var g=gamesList.children.length - 1; g >= 0; g-- ) {
                            if ( gamesList.children[g].tagName === "A" ) {
                                gamesList.children[g].remove();
                            }
                        }
                        for ( var i=0; i < ogames.length; i++ ) {
                            if ( ogames[i].gameid != "" && ogames[i].gameid != self.board.gameid ) {
                                var link = document.createElement("a");
                                link.href="#";
                                link.id=ogames[i].gameid;
                                link.onclick= function(e) { self.board.gameid = e.target.id;
                                    var cmd = { "command": "register", "data": JSON.stringify({"handle": self.handle}), "gameid": self.board.gameid }
                                    self.sendJsonWS(JSON.stringify(cmd));
                                    e.target.parentNode.classList.toggle("show");
                                }
                                link.innerText = ogames[i].gameid + " players:" + ogames[i].playercount + " moves:" + ogames[i].currmoveindex;
                                gamesList.appendChild(link);
                            }
                        }
                    }
                    else {
                        var msgData = this.lastMessageData.data;
                        consolelog(msgData);
                    }
                }
            }
/*
            this.sock.onclose = function() {
          //  this.sock.addEventListener("close", e => {
                if (this.readyState === 3) {
                  var url = "ws://" + document.URL.split("/")[2] + "/ws";
                  consolelog("reconnecting websocket");
                  setTimeout(function(){start(url)}, 5000);
                }
           // });
            }
*/
        }
        else {
            this.messages.innerHTML = "This web browser does not support websockets. Multiplayer is not enabled";
            consolelog("This web browser does not support websockets. Multiplayer is not enabled");
        }
    }

    sendJsonWS(json) {
        console.log("sending ",json);
        this.sock.send(json);
    }

    screenDraw() {
        //set some dimensions. Done after construction so resizing can be done
        this.screenW = window.innerWidth;
        this.screenH = window.innerHeight;
        consolelog("w=",this.screenW, " h=",this.screenH);
        if (this.screenH > this.screenW) {
            this.orientation = "portrait";
            this.longestDim = this.screenH;
            this.smallerDim = this.screenW;
        }
        else {
            this.orientation = "landscape";
            this.smallerDim = this.screenH;
            this.longestDim = this.screenW;
        }
        document.getElementById('allDiv').height=this.screenH;
        document.getElementById('allDiv').width=this.screenW;
        consolelog("o=",this.orientation);
        consolelog("s=",screen.orientation);
        this.squareSize = Math.floor(this.smallerDim / 8);
        this.BoardSize = this.squareSize * 8;
        //set the canvas size one column extra for stacking control
        if (this.orientation == "landscape") {
            this.canvas.width = this.squareSize * 9;
            this.canvas.height = this.squareSize * 8;
            //TODO: work out why this needed to be adjusted
            this.controlsSize = this.screenW - this.canvas.width - 40;
            var chatHeight = Math.floor(this.screenH * .65 );
            console.log("chatHeight == ",chatHeight);
            this.style.textContent = "div#myChatBox { max-height: " + chatHeight + "px; width: " + this.controlsSize + "px; } ";
            this.board.setDimensions(this.BoardSize, this.BoardSize, this.squareSize, 0);
            this.style.textContent += "div#myControls { cursor: pointer; width: " + this.controlsSize + "px; height: 100%; " + 
                    "float: left; position: relative; z-index: 3} " + 
                "canvas#myCanvas {float: right; display: table-cell; z-index: 1; position: relative} " + 
                "div#allDiv { height: " + this.screenH + "px; } " + 
                "span.control { font-size: " + Math.floor(this.controlsSize / 8 ) + "px; }";
        }
        else {
            this.canvas.width = this.squareSize * 8;
            this.canvas.height = this.squareSize * 9;
            this.controlsSize = this.screenH - this.canvas.height;
            var chatHeight = Math.floor(this.controlsSize / 2.5 );
            console.log("chatHeight == ",chatHeight);
            this.style.textContent = "div#myChatBox { max-height: " + chatHeight + "px; width: " + ( this.screenW - 50 ) + "px; } ";
            this.board.setDimensions(this.BoardSize, this.BoardSize, 0, this.squareSize);
            this.style.textContent += "div#myControls { cursor: pointer; height: " + this.controlsSize + "px; " + 
                    "float: top; position: relative; z-index: 3} " + 
                "canvas#myCanvas {float: bottom; display: table-cell; z-index: 1; position: relative} " + 
                "div#allDiv { width: " + this.screenW + "px; } " + 
                "span.control { font-size: " + Math.floor(this.controlsSize / 6 ) + "px; }";
        }

        // the following actually paints the board
        if ( this.sock === undefined ) {
            this.board.callPro()
        }
        else {
            this.board.draw();
        }

        //some global variables
        this.clickPos;
        this.clickTime;
    }

    getBoard(){
        return this.board;
    }
}

class Board {
    constructor(screen) {
        consolelog("board is ");
        consolelog(this);
        //initialize Board variables
        this.screen = screen;
        this.canvas = screen.canvas;
        if ( this.canvas.width > this.canvas.height ) {
            this.orientation = "landscape";
        }
        else {
            this.orientation = "portrait";
        }
        this.pieces = new Array(32);
        
        this.selectedX = -1;
        this.selectedY = -1;
        this.selectedZ = -1;
        this.playerTurn = 0;
        this.moveIndex = 0;
        this.iam = -1;
        this.reverse = 0;
        this.players = [];

        this.gameid = "";
        //allow user to specify gameid
        if ( document.URL.search("gameid") >= 0 ) {
            this.gameid = document.URL.split("gameid=")[1].split("&")[0];
        }
        //allow user to specify reversing the board, for playing second position
        if ( document.URL.search("reverse") >= 0 ) {
            this.reverse = document.URL.split("reverse=")[1].split("&")[0];
        }
    }

    callPro() {
        //load images, wait for them to load, then kick off function to use them
        let p1 = new Promise((resolve, reject) => {
            consolelog("let p1's be p1's");
            this.pieceImg = new Image();
            this.pieceImg.src = "images/chexpieces.png";
            this.pieceImg.onload = function () {
                resolve(this);
            };
        })
        let p2 = new Promise((resolve, reject) => {
            this.boardImg = new Image();
            this.boardImg.src = "images/Chess_Board.png";
            this.boardImg.onload = function () {
                resolve(this);
            };
        })

        Promise.all([p1,p2]).then((value) => {
            consolelog("apres p1");
            //after promise returns
            this.afterPro(value)
        }).catch((reason) => {
            consolelog('Handle rejected promise (' + reason + ') here.');
        })
    }

    afterPro(value) {
        consolelog("icons?");
        //load icon images and board image
        if ( ! this.icons ) { 
            consolelog("icons");
            this.icons = document.createElement('canvas');
            this.icons.height = this.pieceImg.naturalHeight;
            this.icons.width = this.pieceImg.naturalWidth;

            this.icons.id = "iconCanvas";
            this.icons.display = "none";
            this.iconsContext = this.icons.getContext('2d');

            //draw two copies, one for each player
            this.iconsContext.drawImage(this.pieceImg, 0, 0);
           // this.iconsContext.drawImage(this.pieceImg, 0, 400);
           // this.paintPlayer(this.iconsContext, 0);
           // this.paintPlayer(this.iconsContext, 1);
        }
        if ( ! this.boardImg ) {
            this.boardImg = document.createElement('canvas');
            this.boardImg.height = this.boardImg.naturalHeight;
            this.boardImg.width = this.boardImg.naturalWidth;

            this.boardImg.id = "boardCanvas";
            this.boardImg.display = "none";
            this.boardContext = this.boardImg.getContext('2d');

            this.boardContext.drawImage(this.boardImg, 0, 0);
        }
        this.draw();
        this.screen.doWebSocket();
    }

    selectSquare(x, y, z) {
        //called when the canvas is clicked
        //called from doMouseClick
        var action = "none";
        var player = this.playerTurn;
        var selX = this.selectedX;
        var selY = this.selectedY;
        var selZ = this.selectedZ;
        var iam = this.iam;

        //if nothing is currently selected
        if (this.selectedX == -1) {
            var soloGame = 0;
            var player01 = this.players.filter(function (el) {
                return ( el.GamePlace === 0 || el.GamePlace == 1 );
            });
            if ( player01.length == 1 ) {
                soloGame = 1;
            }
            //just check if any of their own pieces exist on that square
            if ( soloGame ) {
                var squarePieces = this.pieces.filter(function (el) {
                    return ( el.x === x && el.y === y && el.player === player );
                });
            }
            else {
                var squarePieces = this.pieces.filter(function (el) {
                    return ( el.x === x && el.y === y && el.player === player && el.player == iam );
                });
            }
            if (squarePieces.length > 0) {
                this.selectedX = x;
                this.selectedY = y;
                this.selectedZ = z;
                action = "new square";
            }
            else {
                action = "misclick";
            }
        }
        //if re-clicking the same square that is selected, deselect it
        else if (this.selectedX == x && this.selectedY == y ) {
            this.selectedX = -1;
            this.selectedY = -1;
            this.selectedZ = -1;
            action = "unselect square";
        }
        //a move is being attempted
        else {
            //get list of pieces from the source, sorted by Z ascending (1 : -1)
            var fromSquare = this.pieces.filter(function (el) {
                return ( el.x === selX && el.y === selY && el.z >= selZ );
            }).sort(function (a, b) {
                return ( a.z > b.z ) ? 1 : -1;
            });
            //get list of pieces for the destination
            var toSquare = this.pieces.filter(function (el) {
                return ( el.x === x && el.y === y );
            }).sort(function (a, b) {
                return ( a.z > b.z ) ? 1 : -1;
            });

            //if destination has pieces
            if ( toSquare.length > 0 ) {
                //if both squares are owned by the same, combine pieces
                if ( toSquare[0].player == fromSquare[0].player ) {
                    action = "add";
                    //get the largest
                    var maxZ = toSquare[toSquare.length - 1].z;

                    //castling
                    if ( fromSquare[fromSquare.length - 1].royal > 0 && y == selY && ( selY == 0 || selY == 7 ) 
                            && ( ( selX == 3 && x == 1 ) || ( selX == 4 && x == 6 ) ) ) {
                        if ( selX == 3 && x == 1 ) {
                            //get a list of all pieces on the left side
                            //if none have moved, then castling is allowed
                            //sort descending (-1 : 1) by x, so the can be stacked to the right
                            var castL = this.pieces.filter(function (el) {
                                return ( el.x <= 3  && el.y === y && el.Moved == 0 );
                            }).sort(function (a, b) {
                                return ( a.x > b.x ) ? -1 : 1;
                            });
                            if ( castL.length == 4 )  {
                                //move the other pieces besides the source, which will be moved later
                                this.pieces.forEach(function (el) {
                                    if ( el.x < 3  && el.y === y && el.Moved == 0 ) {
                                        //the pieces to the right are at the bottom
                                        //all three non-royal pieces end up in x=2
                                        el.z=2-el.x;
                                        el.x=2;
                                    }
                                });
                                //need to adjust maxZ, as the destination piece was just moved
                                maxZ -= 1;
                            }
                        }
                        if ( selX == 4 && x == 6 ) {
                            //get a list of all pieces on the left side
                            //if none have moved, then castling is allowed
                            //sort ascending (1 : -1) by x, so the can be stacked to the left
                            var castR = this.pieces.filter(function (el) {
                                return ( el.x >= 4  && el.y === y && el.Moved == 0 );
                            }).sort(function (a, b) {
                                return ( a.x > b.x ) ? 1 : -1;
                            });
                            if ( castR.length == 4 )  {
                                //move the other pieces besides the source, which will be moved later
                                this.pieces.forEach(function (el) {
                                    if ( el.x > 4  && el.y === y && el.Moved == 0 ) {
                                        //the pieces to the left are at the bottom
                                        //all three non-royal pieces end up in x=5
                                        el.z=el.x-5;
                                        el.x=5;
                                    }
                                });
                                //need to adjust maxZ, as the destination piece was just moved
                                maxZ -= 1;
                            }
                        }
                    }

                    //move each piece from source to destination
                    //choose z pieces above the selected value (ie from the top)
                    this.pieces.forEach(function (el) {
                        if ( el.x === selX && el.y === selY && el.z >= selZ ) {
                            el.x = x;
                            el.y = y;
                            //add above destination pieces
                            el.z = maxZ + el.z + 1;
                            el.Moved = 1;
                        }
                    });
                }
                //source and destination are not owned the by the same player, hence a capture
                else {
                    action = "take";
                    //remove the destination pieces from the board
                    this.pieces.forEach(function (el) {
                        if ( el.x === x && el.y === y ) {
                            el.x = -1;
                            el.y = -1;
                            el.z = -1;
                            el.Moved = 1;
                        }
                    });
                    //move the source pieces to the destination
                    //move z pieces above the selected value (ie from the top)
                    this.pieces.forEach(function (el) {
                        if ( el.x === selX && el.y === selY && el.z >= selZ ) {
                            el.x = x;
                            el.y = y;
                            //rezero the z for a split stack
                            el.z = el.z - selZ;
                            el.Moved = 1;
                        }
                    });
                }
            }
            //moving from source to empty destination
            else {
                action = "move";
                //move the source pieces to the destination
                //move z pieces above the selected value (ie from the top)
                this.pieces.forEach(function (el) {
                    if ( el.x === selX && el.y === selY && el.z >= selZ ) {
                        el.x = x;
                        el.y = y;
                        //rezero the z for a split stack
                        el.z = el.z - selZ;
                        el.Moved = 1;
                    }
                });
            }
            //increment moveIndex and update the server with the move
            //other players will receive the move from the server
            this.moveIndex += 1
            var cmd = { "command": "move", "data": JSON.stringify({ "moveindex": this.moveIndex, "pieces": this.pieces }), "gameid": this.gameid }
            this.screen.sendJsonWS(JSON.stringify(cmd));
            //clear the selection
            this.selectedX = -1;
            this.selectedY = -1;
            this.selectedZ = -1;
            this.playerTurn = ( this.moveIndex ) % 2;
            this.screen.tstyle.innerText = "span#p" + this.playerTurn + " { font-weight: bold; }";
           // var playerColor = ( this.playerTurn ) ? "blue" : "red";
          //  this.screen.messages.innerHTML = "Player " + ( this.playerTurn + 1 ) + "'s turn (" + playerColor + ")";
        }
        consolelog("Selected a square ", action, ' ', this.selectedX, this.selectedY, this.selectedZ);
    }

    setDimensions(h, w, x, y) {
        //called from Board.Draw()
        this.x = x;
        this.y = y;
        this.swidth = Math.floor(w / 8);
        this.sheight = Math.floor(h / 8);
        this.height = this.sheight * 8;
        this.width = this.swidth * 8;
        ;
    }

    paintPlayer(ctx, player) {
        //take the colorless icons and paint two different ways to distinguish player pieces
        var iconsData = ctx.getImageData(0, player * 400, ctx.canvas.width, ctx.canvas.height / 2);
        var iconsDataArray = iconsData.data;
        for (var i = 0; i < iconsDataArray.length; i += 4) {
            if (iconsDataArray[i + 3] == 255) {
                if (player % 2) {
                    iconsDataArray[i] = Math.round(iconsDataArray[i] * .8);
                    iconsDataArray[i + 1] = Math.round(iconsDataArray[i + 1] * .8);
                }
                else {
                    iconsDataArray[i + 1] = Math.round(iconsDataArray[i + 1] * .8);
                    iconsDataArray[i + 2] = Math.round(iconsDataArray[i + 2] * .8);
                }
            }
        }
        ctx.putImageData(iconsData, 0, player * 400);
    }

    draw() {
        //draw the board and the pieces
        if ( this.canvas.width > this.canvas.height ) {
            this.orientation = "landscape";
        }
        else {
            this.orientation = "portrait";
        }
        var myContext = this.canvas.getContext('2d');

        myContext.fillStyle = 'white';
        myContext.fillRect(0,0,this.canvas.width,this.canvas.height);

        myContext.drawImage(this.boardImg, this.x, this.y, this.width, this.height);

        //draw the stack selector
        myContext.fillStyle = 'blue';
        myContext.strokeStyle = 'blue';
        myContext.lineWidth = 4;
        if ( this.orientation == "landscape") {
            myContext.strokeRect(this.x - this.swidth,this.y,this.swidth,this.sheight * 8);
        }
        else {
            myContext.strokeRect(this.x,this.y - this.sheight,this.swidth * 8,this.sheight);
        }

        // filter out "dead" pieces (defined by x coordinate not on the board) 
        // sort ascending by z (1: -1), so iterating will paint them first
        var livePieces = this.pieces.filter(function (el) {
            return el.x >= 0;
        }).sort(function (a, b) {
            return ( a.z > b.z ) ? 1 : -1;
        });

        for (var p = 0; p < livePieces.length; p++) {
            var myp = livePieces[p];
            //get icon index
            //depending on the headedness, can be one of two pawns, and depending on which is on top, two difference pawn+1
            var pIndex = ( myp.z >= 3 ) ? 6 : ( myp.z == 2 ) ? myp.z + 3 : ( myp.z == 0 ) ? 2 : ( myp.z + myp.head + 2);

            //figure out the x,y coordinates to draw piece
            //if the board is displayed reversed, need to reorient the numbers
            if ( this.reverse ) {
                var topX = Math.round(this.x + ( 7 * this.swidth - (myp.x) * this.swidth));
                var topY = Math.round(this.y + ( 7 * this.sheight - myp.y * this.sheight));
            }
            else {
                var topX = Math.round(this.x + (myp.x) * this.swidth);
                var topY = Math.round(this.y + myp.y * this.sheight);
            }
            //draw image from icons image to canvas
            myContext.drawImage(this.icons, myp.head * 400, myp.player * 400, 400, 400, topX, topY, this.swidth, this.sheight);
            myContext.drawImage(this.icons, pIndex * 400, myp.player * 400, 400, 400, topX, topY, this.swidth, this.sheight);

            //if any piece in the stack is royal, draw a gold circle around it
            var hasRoyalty = this.pieces.filter(function (el) {
                return ( el.x == myp.x && el.y == myp.y && el.royal > 0 );
            });
            if (hasRoyalty.length > 0) {
                myContext.strokeStyle = 'gold';
                myContext.lineWidth = 5;
                myContext.beginPath();
                myContext.arc(Math.round(topX + this.swidth / 2), Math.round(topY + this.swidth / 2), Math.round(this.swidth * .45), 0, 2 * Math.PI);
                myContext.stroke();
            }
            //if a square is currently selected, draw a green square around it
            if (this.selectedX == myp.x && this.selectedY == myp.y) {
                myContext.beginPath();
                myContext.strokeStyle = 'LawnGreen';
                myContext.lineWidth = 4;
                myContext.rect(topX, topY, this.swidth, this.sheight);
                myContext.stroke();
            }
        }
        //if something is selected, draw the piece stack, for possible slicing
        if ( this.selectedX != -1 ) {
            var selX=this.selectedX;
            var selY=this.selectedY;

            //get the selected pieces
            //sort by z descending (-1 : 1)
            var selectedPieces = this.pieces.filter(function (el) {
                return ( el.x == selX && el.y == selY );
            }).sort(function (a, b) {
                return ( a.z > b.z ) ? -1 : 1;
            });

            var maxZ = selectedPieces[0].z;
            var topHead = selectedPieces[0].head;
            for (var p = 0; p < selectedPieces.length; p++) {
                var myp = selectedPieces[p];
                //for display purposes, we want to get what would be displayed if this piece were the topmost selected
                var dz = maxZ - myp.z;
                //get icon index
                //depending on the headedness, can be one of two pawns, and depending on which is on top, two difference pawn+1
                var pIndex = ( dz >= 3 ) ? 6 : ( dz == 2 ) ? dz + 3 : ( dz == 0 ) ? 2 : ( dz + topHead + 2);
                var xc = 0;
                var yc = 0;
                if ( this.orientation == "landscape") {
                    yc = p * this.sheight;
                }
                else {
                    xc = p * this.swidth;
                }
                //draw image from icons image to canvas
                myContext.drawImage(this.icons, myp.head * 400, myp.player * 400, 400, 400, xc, yc, this.swidth, this.sheight);
                myContext.drawImage(this.icons, pIndex * 400, myp.player * 400, 400, 400, xc, yc, this.swidth, this.sheight);
                myContext.font = "bold 16px Arial";
                myContext.fillText((myp.head) ? "k" : "b", xc + 15 , yc + 15 );

                //if this particular piece is a royal piece, draw a gold circle around it
                var isRoyalty = this.pieces.filter(function (el) {
                    return ( el.x == myp.x && el.y == myp.y && el.z == myp.z && el.royal > 0 );
                });
                if ( isRoyalty.length > 0 ) {
                    myContext.strokeStyle = 'gold';
                    myContext.lineWidth = 5;
                    myContext.beginPath();
                    myContext.arc(Math.round(xc + this.swidth / 2), Math.round(yc + this.swidth / 2), Math.round(this.swidth * .45), 0, 2 * Math.PI);
                    myContext.stroke();
                }
            }
            //draw a green square around the stack members to be moved
            myContext.beginPath();
            myContext.strokeStyle = 'LawnGreen';
            myContext.lineWidth = 4;
            if ( this.orientation == "landscape") {
                myContext.rect(0, 0, this.swidth, this.sheight * ( 1 + maxZ - this.selectedZ));
            }
            else {
                myContext.rect(0, 0, this.swidth * ( 1 + maxZ - this.selectedZ ), this.sheight);
            }
            myContext.stroke();
        }
    }
}

//unused right now, as the server is initializing the board
//saving because I can see a reason to change that behavior
class Piece {
    constructor(index) {
        this.player = ( index < 16 ) ? 0 : 1;
        this.x = index  % 8;
        this.y = Math.floor(index / 8) + this.player * 4;
        this.z = 0;
        this.royal = 0;
        this.Moved = 0;
        this.square = this.y * 8 + this.x;
        //hackish way of getting the right pattern of proto-knights and proto-bishops
        this.head = (index < 16 ) ? (this.x + this.y) % 2 : (this.x + this.y + 1) % 2;
    }
}

//utility function to return x and y from a click event
function getMousePos(evt) {
    var canvas = evt.target;
    var rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

function doMouseClick(thisObj,startPos,endPos,startTime,endTime) {
    //called from a mouse event listener on the canvas
    var thisBoard = thisObj.getBoard();
    //figure out if it is a board click, as opposed to a stack list click
    var startInsideBoard = ( startPos.x >= thisBoard.x && startPos.y >= thisBoard.y ) ? 1 : 0;
    var endInsideBoard = ( endPos.x >= thisBoard.x && endPos.y >= thisBoard.y ) ? 1 : 0;
    if ( startInsideBoard  && endInsideBoard ) {
        //get coordinates for start and end clicks (end would be useful for dragging
        var startXSquare = Math.floor((startPos.x - thisBoard.x ) / thisBoard.swidth );
        var startYSquare = Math.floor((startPos.y - thisBoard.y ) / thisBoard.swidth );
        var endXSquare = Math.floor((endPos.x - thisBoard.x ) / thisBoard.swidth ) ;
        var endYSquare = Math.floor((endPos.y - thisBoard.y ) / thisBoard.swidth );
        //adjust for reversed view
        if ( thisBoard.reverse ) {
            startXSquare = 7 - startXSquare;
            endXSquare = 7 - endXSquare;
            startYSquare = 7 - startYSquare;
            endYSquare = 7 - endYSquare;
        }
        thisBoard.selectSquare(startXSquare, startYSquare,0);
    }
    //else must have been the stack selector
    else {
        //get x,y and max z for x,y
        var selX = thisBoard.selectedX;
        var selY = thisBoard.selectedY;
        var maxZ = thisBoard.pieces.filter(function (el) {
            return ( el.x === selX && el.y === selY );
        }).sort(function (a, b) {
            return ( a.z > b.z ) ? 1 : -1;
        }).pop().z;
 
        //figure out selected z
        var zcho = 0;
        if ( thisBoard.orientation == "landscape") {
            zcho = maxZ - Math.floor(startPos.y / thisBoard.sheight );
        }
        else {
            zcho = maxZ - Math.floor(startPos.x / thisBoard.swidth );
        }
        thisBoard.selectedZ = zcho;
    }
    if ( ( endTime - startTime ) > 1 ) {
        //long click
    }
    //just draw the thing
    thisBoard.draw();
   // thisObj.screenDraw();
}

//general controls callback, either reverses the screen 
//or calls the server to go backwards/forwards
function control(dir) {
    if ( dir == 99 ) {
        myScreen.board.reverse = (myScreen.board.reverse == 0 ) ? 1 : 0;
        myScreen.board.draw()
    }
    else if ( dir == 98 ) {
        var msga = document.getElementById('myChatInput');
        var cmd = { "command": "msg", "data": msga.value, "gameid": myScreen.board.gameid }
        myScreen.sendJsonWS(JSON.stringify(cmd));
        msga.value = "";
    }
    else if ( dir == 97 ) {
        cmd = { "command": "register", "data": JSON.stringify({"handle": myScreen.handle}), "gameid": myScreen.board.gameid }
        myScreen.sendJsonWS(JSON.stringify(cmd));
    }
    else {
        dir=dir + ""
        var cmd = { "command": "backForWard", "data": dir, "gameid": myScreen.board.gameid }
        myScreen.sendJsonWS(JSON.stringify(cmd));
    }
}

function play(url) {
  return new Promise(function(resolve, reject) { // return a promise
    var audio = new Audio();                     // create audio wo/ src
    audio.preload = "auto";                      // intend to play through
    audio.autoplay = true;                       // autoplay when loaded
    audio.onerror = reject;                      // on error, reject
    audio.onended = resolve;                     // when done, resolve

    audio.src = url
  });
}

function checkUrl(url) {
        var request = false;
        if (window.XMLHttpRequest) {
                request = new XMLHttpRequest;
        } else if (window.ActiveXObject) {
                request = new ActiveXObject("Microsoft.XMLHttp");
        }

        if (request) {
                request.open("GET", url);
                if (request.status == 200) { return true; }
        }

        return false;
}

function consolelog() {
    var myts = Date().split(" ")[4] + " " + Date().split(" ")[2] + " " + Date().split(" ")[1];
    console.log(myts, arguments);
}

//do everything
var myScreen = new Screen();

//add even listeners for canvas mouse activities
myScreen.canvas.addEventListener('mousedown', function(evt) {
    if ( document.getElementById("myDropdown").classList.contains('show') ) {
        document.getElementById("myDropdown").classList.toggle("show");
    };
    this.clickPos = getMousePos( evt);
    this.clickTime = new Date()/1000;
})

myScreen.canvas.addEventListener('mouseup', function(evt) {
    var newClickPos = getMousePos(evt);
    var newClickTime = new Date()/1000;
    doMouseClick(myScreen,this.clickPos,newClickPos,this.clickTime,newClickTime);
})

//add event function to redraw the screen on resize
if ( window.orientation === undefined ) {
    window.onresize=function() {myScreen.screenDraw();};
}
/*
else {
    window.onresize=function() { consolelog("mobile resize"); if ( screen.orientation.type.search(myScreen.orientation) >= 0 ) { consolelog("mobile non-keyboard resize"); myScreen.screenDraw();}; };
}
*/

function orientationChanged() {
  const timeout = 120;
  return new window.Promise(function(resolve) {
    const go = (i, height0) => {
      window.innerHeight != height0 || i >= timeout ?
        resolve() :
        window.requestAnimationFrame(() => go(i + 1, height0));
    };
    go(0, window.innerHeight);
  });
}

//add event function to redraw the screen on reorientation
screen.orientation.onchange=function() {
    consolelog("turnt");
    orientationChanged().then( function () { 
        myScreen.screenDraw();
    });
};
