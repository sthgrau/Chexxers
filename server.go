package main

import (
	"github.com/pborman/uuid"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"log"
	"time"
	"strings"
	"sort"
	"io/ioutil"
	"strconv"
	"net/http"
	"math/rand"
	"encoding/json"
	"gopkg.in/mgo.v2"
	"gopkg.in/mgo.v2/bson"
)

var (
    HandleLists Handles
    session *mgo.Session
)

type Player struct {
	Id        string
	GameId    string
	Handle    string
	GamePlace int
	Socket    *websocket.Conn
}

type Cmd struct {
    Command string `json:"command"`
    Data    string `json:"data"`
    GameId  string `json:"gameid"`
}

type Piece struct {
        Y       int `json:"y"`
        X       int `json:"x"`
        Z       int `json:"z"`
        Head    int `json:"head"`
        Player  int `json:"player"`
        Royal   int `json:"royal"`
        Moved   int `json:"Moved"`
        Square  int `json:"square"`
}

type Move struct {
    MoveIndex  int     `json:"moveindex"`
    Pieces     []Piece `json:"pieces"`
}

type Game struct {
    Moves          []Move    `json:"moves"`
    Players        []Player  `json:"players"`
    GameId         string    `json:"gameid"`
    CurrMoveIndex  int       `json:"currmoveindex"`
}

type JsonHandle struct {
    Handle string `json:"handle"`
}

type Handles struct {
    Atoms []HandleType `json:"atoms"`
}
type HandleType struct {
    Type string        `json:"name"`
    Words []string     `json:"values"`
}
func readHandleWords() Handles {
    raw, err := ioutil.ReadFile("./words.json")
    if err != nil {
      log.Println(err.Error())
    }
  
    var types Handles
    json.Unmarshal(raw, &types)
    return types
}
func getHandle() string {
    var Adjectives []string
    var Animals []string
    var Colors []string
    if len(HandleLists.Atoms) < 1 {
        HandleLists = readHandleWords();
    }
    Adjectives=HandleLists.Atoms[0].Words
    Animals=HandleLists.Atoms[1].Words
    Colors=HandleLists.Atoms[2].Words
  
    var MyHandle string
    r := rand.New(rand.NewSource(time.Now().UnixNano()))
    MyHandle += strings.Title(Adjectives[r.Intn(len(Adjectives))] )
    MyHandle += strings.Title(Colors[r.Intn(len(Colors))] )
    MyHandle += strings.Title(Animals[r.Intn(len(Animals))])
    log.Printf("My new name is %s\n", MyHandle)
    return MyHandle
}
//HandleLists = readHandleWords();



func NewGame(GameId string) Game {
    var startPos Move
    var startPoss []Move
    var playas []Player
    startPos.MoveIndex = 0
    for i := 0; i < 32; i++ {
        var tp Piece
        tp.X = i % 8
        tp.Y = int(i / 8)
        tp.Z = 0
        tp.Head = ( i + tp.Y ) % 2
        tp.Royal = 0
        tp.Moved = 0
        tp.Square = i
        tp.Player = 0

        if i >= 16 {
            tp.Y += 4
            tp.Player = 1
            tp.Head = ( tp.Head + 1 ) % 2
        }
        if ( tp.Y == 7 || tp.Y == 0 ) && ( tp.X == 3 || tp.X == 4 ) {
            tp.Royal = 1
        }
        startPos.Pieces = append(startPos.Pieces, tp)
    }
    startPoss = append(startPoss, startPos)
    return Game{startPoss, playas, GameId, 0}
}
/*
func (p *Player) position(new bool) Message {
        return Message{X: p.X, Y: p.Y, Id: p.Id, New: new, Online: true}
}

func (cmd *Cmd) getStuff(ttype string) string (
    if ttype == "move" {
        err = json.Unmarshal([]byte(cmd.Data), &move)
    }
    if err != nil {
        log.Printf("ERROR: could not unmarshall data in move command")
        return "";
    } else {
        return ;
    }
}
*/

var Games = make([]*Game, 0)

var Players = make([]*Player, 0)

func remoteHandler(res http.ResponseWriter, req *http.Request) {
	var err error
        c := session.DB("games").C("chexxers")

	//when someone requires a ws connection we create a new player and store a
	// pointer to the connection inside player.Socket
	ws, err := websocket.Upgrade(res, req, nil, 1024, 1024)
	if _, ok := err.(websocket.HandshakeError); ok {
		http.Error(res, "Not a websocket handshake", 400)
		return
	} else if err != nil {
		log.Println(err)
		return
	}

	log.Printf("got websocket conn from %v\n", ws.RemoteAddr())
	player := new(Player)
	player.Id = uuid.New()
	player.GamePlace = -1
	player.Socket = ws
        Players = append(Players, player)
        
        var cmd Cmd
        var rcmd *Cmd
        var xxx []byte
        var thisGame Game

	// we broadcast the position of the new player to alredy connected
	// players (if any) and viceversa, we tell the player where to spawn already
	// existing players
        //player.Socket.WriteJSON(player)
        for {
            //read message from client, if errors out, remove from list of Players
            xx, message, err := player.Socket.ReadMessage()
            if err != nil {
		log.Println(err)
                for i, p := range Players {
                        if p.Socket.RemoteAddr() == player.Socket.RemoteAddr() {
                                err = c.Find(bson.M{"gameid": player.GameId}).One(&thisGame)
                                if err != nil {
                                    log.Printf("db find error: %s",err.Error)
                                } else {
                                    for j, gp := range thisGame.Players {
                                        if gp.Id == player.Id {
                                            thisGame.Players = append(thisGame.Players[:j], thisGame.Players[j+1:]...)
                                        }
                                    }
                                    err = c.Update(bson.M{"gameid": player.GameId}, &thisGame)
                                    if err != nil {
                                        log.Printf("ERROR: could not update game in db")
                                    }
                                    //send appropriate player information to all remaining clients
                                    rcmd = new(Cmd)
                                    rcmd.Command = "players"
                                    rcmd.GameId = player.GameId
                                    xxx,_= json.Marshal(thisGame.Players)
                                    rcmd.Data = string(xxx)
                                    for _, gp := range thisGame.Players {
                                        for _, p := range Players {
                                            if p.Id == gp.Id {
                                                p.Socket.WriteJSON(rcmd)
                                            }
                                        }
                                    }
                                }
                                Players = append(Players[:i], Players[i+1:]...)
                        }
                }
                break

            }
            err = json.Unmarshal(message, &cmd)
            if err != nil {
		log.Println(err)
                break
            }
            //first message we get from a client
            if cmd.Command == "register" {
                //if we don't have handle data for this connection
                if player.Handle == "" {
                    //see if handle was provided by client
                    hand := JsonHandle{}
                    err = json.Unmarshal([]byte(cmd.Data), &hand)
                    if err == nil {
                        if hand.Handle != "" {
                            player.Handle = hand.Handle;
                        } else {
                            //otherwise create a new handle
                            player.Handle = getHandle();
                        }
                    } else {
                        player.Handle = getHandle();
                    }
                }
                //if gameid was not provided by client
                //try to find provided handle in existing players, then remove the old player
                if cmd.GameId == "" {
                    for j, p := range Players {
                        if p.Handle == player.Handle {
                            player.GameId = p.GameId
                            if p.Id != p.Id {
                                Players = append(Players[:j], Players[j+1:]...)
                            }
                        }
                    }
                } else {
                    player.GameId = cmd.GameId
                }
                //if gameId was not found, just use player.id, a guid
                if player.GameId == "" {
                    player.GameId = player.Id
                }
                //see if game exists in database
                err = c.Find(bson.M{"gameid": cmd.GameId}).One(&thisGame)
                if err != nil {
                    log.Printf("db find error: %s",err.Error)
                }
                //if it was found
                var placesFound []int
                if len(thisGame.GameId) > 0 {
                    //  Remove non-existent players from game
                    var nPlayers []Player
                    var myPlace int
                    myPlace = -1
                    for i, gp := range thisGame.Players {
                        for _, p := range Players {
                            if p.Id == gp.Id {
                                if gp.GamePlace >= 0 {
                                    placesFound = append(placesFound, gp.GamePlace)
                                }
                                nPlayers = append(nPlayers, thisGame.Players[i])
                            }
                        }
                        if gp.Id == player.Id && player.GamePlace >= 0 {
                            myPlace = player.GamePlace
                        }
                    }
                    sort.Sort(sort.IntSlice(placesFound))
                    if myPlace == -1 {
                        for p := 0; p < len(placesFound); p++ {
                            if placesFound[p] != p {
                                myPlace = 0
                            }
                        }
                        if myPlace == -1 {
                            myPlace = len(placesFound)
                        }
                        player.GamePlace = myPlace
                    }
                    
                    thisGame.Players = nPlayers
                    //add current player and update in database
                    thisGame.Players = append(thisGame.Players, *player)
                    err = c.Update(bson.M{"gameid": cmd.GameId}, &thisGame)
                    if err != nil {
                        log.Printf("ERROR: could not update game in db")
                    }
                } else {
                    // create new game, add player and insert into database
                    thisGame = NewGame(cmd.GameId)
                    player.GamePlace = 0
                    thisGame.Players = append(thisGame.Players, *player)
                    err = c.Insert(&thisGame)
                    if err != nil {
                        log.Printf("ERROR: could not add game in db")
                    }
                }
                //send updated info back to client
                rcmd = new(Cmd)
                rcmd.Command="register"
                rcmd.GameId=player.GameId
                xxx,_=json.Marshal(player)
                rcmd.Data=string(xxx)
                player.Socket.WriteJSON(rcmd)

                //send appropriate piece information to client
                rcmd = new(Cmd)
                rcmd.Command = "move"
                rcmd.GameId = player.GameId
                xxx,_= json.Marshal(thisGame.Moves[thisGame.CurrMoveIndex])
                rcmd.Data = string(xxx)
                player.Socket.WriteJSON(rcmd)

                //send appropriate player information to all client
                rcmd = new(Cmd)
                rcmd.Command = "players"
                rcmd.GameId = player.GameId
                xxx,_= json.Marshal(thisGame.Players)
                rcmd.Data = string(xxx)
                for _, gp := range thisGame.Players {
                    for _, p := range Players {
                        if p.Id == gp.Id {
                            p.Socket.WriteJSON(rcmd)
                        }
                    }
                }
             //   player.Socket.WriteJSON(player)
            } else if cmd.Command == "backForWard" {
                err = c.Find(bson.M{"gameid": cmd.GameId}).One(&thisGame)
                if err != nil {
                    log.Println(err)
                }
                if len(thisGame.GameId) > 0 {
                    reqIndex, _ := strconv.Atoi(cmd.Data)
                    if reqIndex == -2 {
                        thisGame.CurrMoveIndex = 0
                    } else if reqIndex == -1 && thisGame.CurrMoveIndex > 0 {
                        thisGame.CurrMoveIndex -= 1
                    } else if reqIndex == 1 && thisGame.CurrMoveIndex < (len(thisGame.Moves) - 1) {
                        thisGame.CurrMoveIndex += 1
                    } else if reqIndex == 2 {
                        thisGame.CurrMoveIndex = len(thisGame.Moves) - 1
                    }
                    err = c.Update(bson.M{"gameid": thisGame.GameId}, &thisGame)
                    if err != nil {
                        log.Printf("ERROR: could not update game in db")
                    }
                    _ = c.Find(bson.M{"gameid": cmd.GameId}).One(&thisGame)
                    var xxx []byte
                    xxx,_=json.Marshal(thisGame.Moves[thisGame.CurrMoveIndex])
                    rcmd := new(Cmd)
                    rcmd.Command="move"
                    rcmd.GameId=cmd.GameId
                    rcmd.Data=string(xxx)
                    for _, gp := range thisGame.Players {
                        for _, p := range Players {
                            if p.Id == gp.Id {
                                p.Socket.WriteJSON(rcmd)
                            }
                        }
                    }
                }
            } else if cmd.Command == "msg" {
                err = c.Find(bson.M{"gameid": cmd.GameId}).One(&thisGame)
                if err != nil {
                    log.Printf("ERROR: could not find game in db")
                }
                rcmd := new(Cmd)
                rcmd.Command="msg"
                rcmd.GameId=cmd.GameId
                rcmd.Data=string(player.Handle + " said: " + cmd.Data)
                for _, gp := range thisGame.Players {
                    for _, p := range Players {
                        if p.Id == gp.Id {
                            p.Socket.WriteJSON(rcmd)
                        }
                    }
                }
            } else if cmd.Command == "move" {
                move := Move{}
                err = json.Unmarshal([]byte(cmd.Data), &move)
                if err != nil {
                    log.Printf("ERROR: could not unmarshall data in move command")
                }
                err = c.Find(bson.M{"gameid": cmd.GameId}).One(&thisGame)
                if err != nil {
                    log.Printf("ERROR: could not find game in db")
                }
                thisGame.CurrMoveIndex = move.MoveIndex
                thisGame.Moves = thisGame.Moves[:move.MoveIndex]
                thisGame.Moves = append(thisGame.Moves, move)
                err = c.Update(bson.M{"gameid": thisGame.GameId}, &thisGame)
                if err != nil {
                    log.Printf("ERROR: could not update game in db")
                }
                rcmd := new(Cmd)
                rcmd.Command="move"
                rcmd.GameId=cmd.GameId
                var xxx []byte
                xxx,_=json.Marshal(move)
                rcmd.Data=string(xxx)
    
                for _, gp := range thisGame.Players {
                    for _, p := range Players {
                        if p.Id != gp.Id {
                            p.Socket.WriteJSON(rcmd)
                        }
                    }
                }
            } else if cmd.Command == "hello" {
                strB, _ := json.Marshal("hello back")
                _ = player.Socket.WriteMessage(xx, strB)
            }
        }

}

func main() {
        var err error
        session, err = mgo.Dial("localhost")
        if err != nil {
                panic(err)
        }
        defer session.Close()

	r := mux.NewRouter()
	r.HandleFunc("/ws", remoteHandler)

	r.PathPrefix("/").Handler(http.FileServer(http.Dir("./public/")))
	http.ListenAndServe(":3333", r)
}
