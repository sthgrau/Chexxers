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
        //Create controls div
        this.controls = document.createElement('div');
        this.controls.id = "myControls";
        this.controls.innerHTML = "<span class='control' title='go to beginning' onclick='control(-2);'>&#x23ea</<span>";
        this.controls.innerHTML += "<span class='control' title='go back one move' onclick='control(-1);'>&#x25c0</span>";
        this.controls.innerHTML += "<span class='control' title='refresh' onclick='control(0);'>&#x1f501</span>";
        this.controls.innerHTML += "<span class='control' title='go forward one move' onclick='control(1);'>&#x25b6</span>";
        this.controls.innerHTML += "<span class='control' title='go to end' onclick='control(2);'>&#x23e9</span>";
        this.controls.innerHTML += "<span class='control' title='switch view' onclick='control(99);'>&#x1f504</span>";
        document.body.appendChild(this.controls);
        this.br = document.createElement('br');
        this.controls.appendChild(this.br);
        this.rules = document.createElement('a');
        this.rules.href = "/rules.html";
        this.rules.target = "_blank";
        this.rules.innerHTML = "Rules";
        this.controls.appendChild(this.rules);
        this.br2 = document.createElement('br');
        this.controls.appendChild(this.br2);
        this.thisGame = document.createElement('a');
        this.thisGame.href = "/";
        this.thisGame.target = "_blank";
        this.thisGame.innerHTML = "This game (shareable link)";
        this.controls.appendChild(this.thisGame);
        //Create server messages div
        this.messages = document.createElement('div');
        this.messages.id = "myMessages";
        this.messages.innerHTML = "Welcome to Chexxers!";
        this.controls.appendChild(this.messages);
        //Create client messages 
        this.chat = document.createElement('div');
        this.chat.id = "myChat";
        this.chats = document.createElement('div');
        this.chats.id = "myChatBox";
        this.chats.className = "chatBox";
//        this.chatsp = document.createElement('pre');
//        this.chatsp.innerHTML = "";
//        this.chats.appendChild(this.chatsp);
        this.chat.appendChild(this.chats);
        this.chat.appendChild(document.createElement('br'));
        this.chati = document.createElement('input');
        this.chati.id = "myChatInput";
        this.chat.appendChild(this.chati);
        this.chatb = document.createElement('span');
        this.chatb.id = "myChatButton";
        this.chatb.innerHTML = "Submit";
        this.chatb.onclick = function() { control(98); };
        this.chati.onkeydown = function(e) { if (e.keyCode == 13 ) { control(98); } };
        this.chat.appendChild(this.chatb);
        this.controls.appendChild(this.chat);
        //Create Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = "myCanvas";
        document.body.appendChild(this.canvas);
        this.context = this.canvas.getContext('2d');
        //Create Board
        this.board = new Board(this.canvas);
        this.screenDraw();
        this.handle = "";
        if ( "WebSocket" in window) {
            if ( document.URL.search("https") == 0 ) {
                var wsProto = "wss://";
            }
            else {
                var wsProto = "ws://";
            }
            //set up websocket here, since this object uses it
            if ( typeof(ReconnectingWebSocket) == "undefined" ) {
                this.sock = new WebSocket(wsProto + document.URL.split("/")[2] + "/ws");
            }
            else {
                this.sock = new ReconnectingWebSocket(wsProto + document.URL.split("/")[2] + "/ws");
            }
    
            //set up event handler for incoming messages
            this.sock.onopen = function(e) {
                var that = myScreen
                var cmd = { "command": "register", "data": JSON.stringify({"handle": that.handle}), "gameid": that.board.gameid }
                console.log("opening websocket ", cmd);
                myScreen.sendJsonWS(JSON.stringify(cmd));
            }
            this.sock.onmessage = function(message) {
                var that = myScreen.board
                this.lastMessageData = JSON.parse(message.data);
                if ( this.lastMessageData.command ) {
                    //parse move data
                    if ( this.lastMessageData.command == "move" ) {
                        var msgData = JSON.parse(this.lastMessageData.data);
                        that.pieces = msgData.pieces;
                        console.log(this.lastMessageData);
                        myScreen.thisGame.href = "?gameid=" + this.lastMessageData.gameid;
                        that.moveIndex = msgData.moveindex;
                        that.playerTurn = ( that.moveIndex ) % 2;
                        var playerColor = ( that.playerTurn ) ? "white" : "black";
                        that.draw();
                        myScreen.tstyle.innerText = "span#p" + that.playerTurn + " { font-weight: bold; }";
                      //  myScreen.messages.innerHTML = "Player " + ( that.playerTurn + 1 ) + "'s turn (" + playerColor + ")";
                    }
                    else if ( this.lastMessageData.command == "msg" ) {
                        var msgData = this.lastMessageData.data;
                        var mymsg = "<span class='aMess' title='" + Date().split(" ")[4] + "'>" + msgData + "</span><BR>";
                      //  myScreen.chatsp.innerHTML += msgData + "\n";
                        myScreen.chats.innerHTML += mymsg;
                      //  myScreen.chats.scrollTop = myScreen.chats.scrollHeight;
                    }
                    else if ( this.lastMessageData.command == "players" ) {
                        var msgData = this.lastMessageData.data;
                        var playas = JSON.parse(msgData);
                        console.log("Player update: ", playas);
                        var p0d = "";
                        var p1d = "";
                        var player0 = playas.filter(function (el) {
                            return ( el.GamePlace === 0);
                        });
                        var player1 = playas.filter(function (el) {
                            return ( el.GamePlace === 1);
                        });
                        var oplayer0 = myScreen.board.players.filter(function (el) {
                            return ( el.GamePlace === 0);
                        });
                        var oplayer1 = myScreen.board.players.filter(function (el) {
                            return ( el.GamePlace === 1);
                        });
                        if ( player0.length > 0 ) {
                            p0d = player0[0].Handle; 
                            if ( player0[0].Handle == myScreen.handle ) {
                                p0d = player0[0].Handle + " (you)"
                                myScreen.board.reverse=1;
                                myScreen.board.iam=0;
                                myScreen.board.draw();
                            }
                            if ( oplayer0.length == 0 && player0[0].Handle != myScreen.handle ) {
                                var mymsg = "<span class='aMess' title='" + Date().split(" ")[4] + "'>" + player0[0].Handle + " has joined the game</span><BR>";
                                myScreen.chats.innerHTML += mymsg;
                            }
                        }
                        else if ( oplayer0.length > 0 ) {
                            var mymsg = "<span class='aMess' title='" + Date().split(" ")[4] + "'>" + oplayer0[0].Handle + " has left the game</span><BR>";
                            myScreen.chats.innerHTML += mymsg;
                        }
                        if ( player1.length > 0 ) {
                            p1d = player1[0].Handle;
                            if (player1[0].Handle == myScreen.handle ) {
                                myScreen.board.iam=1;
                                p1d += " (you)";
                            }
                            if ( oplayer1.length == 0 && player1[0].Handle != myScreen.handle ) {
                                var mymsg = "<span class='aMess' title='" + Date().split(" ")[4] + "'>" + player1[0].Handle + " has joined the game</span><BR>";
                                myScreen.chats.innerHTML += mymsg;
                            }
                        }
                        else if ( oplayer1.length > 0 ) {
                            var mymsg = "<span class='aMess' title='" + Date().split(" ")[4] + "'>" + oplayer1[0].Handle + " has left the game</span><BR>";
                            myScreen.chats.innerHTML += mymsg;
                        }
                        myScreen.messages.innerHTML = "<span id='p0'>Player 0 " + p0d + "</span><br><span id='p1'>Player 1 " + p1d + "</span>";
                        myScreen.board.players = playas;
                    }
                    else if ( this.lastMessageData.command == "register" ) {
                        var msgData = this.lastMessageData.data;
                        myScreen.handle = JSON.parse(msgData).Handle;
                        myScreen.board.gameid = this.lastMessageData.gameid;
                    }
                }
            }
/*
            this.sock.onclose = function() {
          //  this.sock.addEventListener("close", e => {
                if (this.readyState === 3) {
                  var url = "ws://" + document.URL.split("/")[2] + "/ws";
                  console.log("reconnecting websocket");
                  setTimeout(function(){start(url)}, 5000);
                }
           // });
            }
*/
        }
        else {
            this.messages.innerHTML = "This web browser does not support websockets. Multiplayer is not enabled";
            console.log("This web browser does not support websockets. Multiplayer is not enabled");
        }
    }

    sendJsonWS(json) {
        this.sock.send(json);
    }

    screenDraw() {
        //set some dimensions. Done after construction so resizing can be done
        this.screenW = window.innerWidth;
        this.screenH = window.innerHeight;
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
        this.squareSize = Math.floor(this.smallerDim / 8);
        this.BoardSize = this.squareSize * 8;
        this.style.textContent = ".chatBox { border-style: dotted; border-color: blue; border-width: 2px; border-radius: 3px; height: auto; max-height: 300px; width: 400px; overflow-y: auto; bottom: 0; resize: both;} ";
        //set the canvas size one column extra for stacking control
        if (this.orientation == "landscape") {
            this.canvas.width = this.squareSize * 9;
            this.canvas.height = this.squareSize * 8;
            //TODO: work out why this needed to be adjusted
            this.controlsSize = this.screenW - this.canvas.width - 40;
            this.board.setDimensions(this.BoardSize, this.BoardSize, this.squareSize, 0);
            this.style.textContent += "div#myControls { cursor: pointer; width: " + this.controlsSize + "px; " + 
                    "float: left; position: relative; z-index: 3} " + 
                "canvas#myCanvas {float: right; display: table-cell; z-index: 1; position: relative} " + 
                "span.control { font-size: " + Math.floor(this.controlsSize / 8 ) + "px; }";
        }
        else {
            this.canvas.width = this.squareSize * 8;
            this.canvas.height = this.squareSize * 9;
            this.controlsSize = this.screenH - this.canvas.height;
            this.board.setDimensions(this.BoardSize, this.BoardSize, 0, this.squareSize);
            this.style.textContent += "div#myControls { cursor: pointer; height: " + this.controlsSize + "px; " + 
                    "float: top; position: relative; z-index: 3} " + 
                "canvas#myCanvas {float: bottom; display: table-cell; z-index: 1; position: relative} " + 
                "span.control { font-size: " + Math.floor(this.controlsSize / 6 ) + "px; }";
        }

        // the following actually paints the board
        this.board.callPro()

        //some global variables
        this.clickPos;
        this.clickTime;
    }

    getBoard(){
        return this.board;
    }
}

class Board {
    constructor(canvas) {
        //initialize Board variables
        this.canvas = canvas;
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
            console.log("let p1's be p1's");
            this.pieceImg = new Image();
            this.pieceImg.src = "images/chexpieces.png";
            this.pieceImg.onload = function () {
                resolve(this);
            };
            this.boardImg = new Image();
            this.boardImg.src = "images/Chess_Board.png";
            this.boardImg.onload = function () {
                resolve(this);
            };
        })

        p1.then((value) => {
            console.log("apres p1");
            //after promise returns
            this.afterPro(value)
        }).catch((reason) => {
            console.log('Handle rejected promise (' + reason + ') here.');
        })
    }

    afterPro(value) {
        console.log("icons?");
        //load icon images and board image
        if ( ! this.icons ) { 
            console.log("icons");
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
        if ( ! this.board ) {
            this.board = document.createElement('canvas');
            this.board.height = this.boardImg.naturalHeight;
            this.board.width = this.boardImg.naturalWidth;

            this.board.id = "boardCanvas";
            this.board.display = "none";
            this.boardContext = this.board.getContext('2d');

            this.boardContext.drawImage(this.boardImg, 0, 0);
        }
        this.draw();
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
            myScreen.sendJsonWS(JSON.stringify(cmd));
            //clear the selection
            this.selectedX = -1;
            this.selectedY = -1;
            this.selectedZ = -1;
            this.playerTurn = ( this.moveIndex ) % 2;
            myScreen.tstyle.innerText = "span#p" + this.playerTurn + " { font-weight: bold; }";
           // var playerColor = ( this.playerTurn ) ? "blue" : "red";
          //  myScreen.messages.innerHTML = "Player " + ( this.playerTurn + 1 ) + "'s turn (" + playerColor + ")";
        }
        console.log("Selected a square ", action, ' ', this.selectedX, this.selectedY, this.selectedZ);
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
        myScreen.board.selectedZ = zcho;
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
    else {
        dir=dir + ""
        var cmd = { "command": "backForWard", "data": dir, "gameid": myScreen.board.gameid }
        myScreen.sendJsonWS(JSON.stringify(cmd));
    }
}

//do everything
var myScreen = new Screen();

//add even listeners for canvas mouse activities
myScreen.canvas.addEventListener('mousedown', function(evt) {
    this.clickPos = getMousePos( evt);
    this.clickTime = new Date()/1000;
})

myScreen.canvas.addEventListener('mouseup', function(evt) {
    var newClickPos = getMousePos(evt);
    var newClickTime = new Date()/1000;
    doMouseClick(myScreen,this.clickPos,newClickPos,this.clickTime,newClickTime);
})

//add event function to redraw the screen on resize
window.onresize=function() {myScreen.screenDraw();};

//add event function to redraw the screen on reorientation
screen.orientation.onchange=function() {
    myScreen.screenDraw();
};
