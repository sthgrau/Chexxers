package main

import (
	"github.com/pborman/uuid"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"fmt"
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
    MoveIndex  int       `json:"moveindex"`
    Pieces     []Piece   `json:"pieces"`
    MoveTime   time.Time `json:"movetime"`
}

type Game struct {
    Moves          []Move    `json:"moves"`
    PlayerCount    int       `json:"playercount"`
    Players        []Player  `json:"players"`
    GameId         string    `json:"gameid"`
    CurrMoveIndex  int       `json:"currmoveindex"`
    LastMoveTime   time.Time `json:"lastmovetime"`
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
    for MyHandle == "" {
        r := rand.New(rand.NewSource(time.Now().UnixNano()))
        MyHandle += strings.Title(Adjectives[r.Intn(len(Adjectives))] )
        MyHandle += strings.Title(Colors[r.Intn(len(Colors))] )
        MyHandle += strings.Title(Animals[r.Intn(len(Animals))])
        for _, p := range Players {
            if p.Handle == MyHandle {
                MyHandle = ""
                log.Println("That's numberwang!")
            }
        }
    }
    log.Printf("My new name is %s\n", MyHandle)
    return MyHandle
}
//HandleLists = readHandleWords();



func NewGame(GameId string) Game {
    var startPos Move
    var startPoss []Move
    var playas []Player
    var LastMoveTime time.Time
    LastMoveTime = time.Now()
    startPos.MoveIndex = 0
    startPos.MoveTime = LastMoveTime
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
    return Game{startPoss, len(playas), playas, GameId, 0, LastMoveTime }
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

func NewCmd(Command string, Data string, GameId string) Cmd {
    return Cmd{Command, Data, GameId }
}

func sendMessage(grp1 []Player, grp2 []*Player, msg Cmd, exclude int ) {
    for _, gp := range grp1 {
        for _, p := range grp2 {
            if exclude == 0 && p.Id == gp.Id {
                p.Socket.WriteJSON(msg)
            } else if exclude == 1 && p.Id != gp.Id {
                p.Socket.WriteJSON(msg)
            }
        }
    }
}

func stringifyJsonMarshal(blob interface{}) string {
    jso, err := json.Marshal(blob)
    if err != nil {
        log.Printf("ERROR[sjm]: could not marshall %s",blob)
        return ""
    } else {
        return string(jso)
    }
}

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
        var rcmd Cmd
        var thisGame Game

	// we broadcast the position of the new player to alredy connected
	// players (if any) and viceversa, we tell the player where to spawn already
	// existing players
        for {
            //read message from client
            xx, message, err := player.Socket.ReadMessage()

            //if errors out, remove from list of Players
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
                                            if j < len(thisGame.Players) {
                                                thisGame.Players = append(thisGame.Players[:j], thisGame.Players[j+1:]...)
                                            } else {
                                                thisGame.Players = thisGame.Players[:j]
                                            }
                                        }
                                    }
                                    //would be nice if I could count all slice elements with a field less than 2
                                    thisGame.PlayerCount = 0
                                    for _, gp := range thisGame.Players {
                                        if gp.GamePlace <= 1 {
                                            thisGame.PlayerCount += 1
                                        }
                                    }
                                    err = c.Update(bson.M{"gameid": player.GameId}, &thisGame)
                                    if err != nil {
                                        log.Printf("ERROR: could not update game in db")
                                    }
                                    //send appropriate player information to all remaining clients
                                    rcmd = NewCmd("players", stringifyJsonMarshal(thisGame.Players), player.GameId)
                                    sendMessage(thisGame.Players, Players, rcmd, 0)
/*
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
*/
                                }
                                if i < len(Players) {
                                    Players = append(Players[:i], Players[i+1:]...)
                                } else {
                                    Players = Players[:i]
                                }
                        }
                }
                break

            }
            //unmarshal client message
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
                //remove from old game
                if player.GameId != "" && player.GameId != cmd.GameId {
                    err = c.Find(bson.M{"gameid": player.GameId}).One(&thisGame)
                    if err != nil {
                        log.Printf("db find error: %s",err.Error)
                    } else {
                        for j, gp := range thisGame.Players {
                            if gp.Id == player.Id {
                                if j < len(thisGame.Players) {
                                    thisGame.Players = append(thisGame.Players[:j], thisGame.Players[j+1:]...)
                                } else {
                                    thisGame.Players = thisGame.Players[:j]
                                }
                            }
                        }
                        thisGame.PlayerCount = 0
                        for _, gp := range thisGame.Players {
                            if gp.GamePlace <= 1 {
                                thisGame.PlayerCount += 1
                            }
                        }
                        err = c.Update(bson.M{"gameid": player.GameId}, &thisGame)
                        if err != nil {
                            log.Printf("ERROR [register]: could not update game in db when removing")
                        }

                        //this player has left the game, send update to other players
                        rcmd = NewCmd("players", stringifyJsonMarshal(thisGame.Players), player.GameId)
                        sendMessage(thisGame.Players, Players, rcmd, 0)
                    }
                }
                //if gameid was not provided by client
                //try to find provided handle in existing players, then remove the old player
                //mainly useful for possible future cookie
                if cmd.GameId == "" {
                    for j, p := range Players {
                        if p.Handle == player.Handle {
                            player.GameId = p.GameId
                            if p.Id != p.Id {
                                if j < len(Players) {
                                    Players = append(Players[:j], Players[j+1:]...)
                                } else {
                                    Players = Players[:j]
                                }
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
                thisGame.GameId=""
                err = c.Find(bson.M{"gameid": cmd.GameId}).One(&thisGame)
                if err != nil {
                    fmt.Printf("db find error: %s %s\n",err,len(thisGame.GameId))
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
                        if gp.Handle == player.Handle && player.GamePlace >= 0 {
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
                    thisGame.LastMoveTime = time.Now()
                    thisGame.PlayerCount = 0
                    for _, gp := range thisGame.Players {
                        if gp.GamePlace <= 1 {
                            thisGame.PlayerCount += 1
                        }
                    }
                    err = c.Update(bson.M{"gameid": cmd.GameId}, &thisGame)
                    if err != nil {
                        log.Printf("ERROR [register]: could not update game in db with updated players")
                    }
                } else {
                    // create new game, add player and insert into database
                    thisGame = NewGame(player.GameId)
                    player.GamePlace = 0
                    thisGame.Players = append(thisGame.Players, *player)
                    thisGame.PlayerCount = 0
                    for _, gp := range thisGame.Players {
                        if gp.GamePlace <= 1 {
                            thisGame.PlayerCount += 1
                        }
                    }
                    err = c.Insert(&thisGame)
                    if err != nil {
                        fmt.Printf("ERROR: could not add game in db: %s\n",err)
                    }
                }
                //send updated info back to client
                rcmd = NewCmd("register", stringifyJsonMarshal(player), player.GameId)
/*
                rcmd = new(Cmd)
                rcmd.Command="register"
                rcmd.GameId=player.GameId
                xxx,_=json.Marshal(player)
                rcmd.Data=string(xxx)
*/
                player.Socket.WriteJSON(rcmd)

                //send appropriate piece information to client
                rcmd = NewCmd("move", stringifyJsonMarshal(thisGame.Moves[thisGame.CurrMoveIndex]), player.GameId)
/*
                rcmd = new(Cmd)
                rcmd.Command = "move"
                rcmd.GameId = player.GameId
                xxx,_= json.Marshal(thisGame.Moves[thisGame.CurrMoveIndex])
                rcmd.Data = string(xxx)
*/
                player.Socket.WriteJSON(rcmd)

                //send appropriate player information to all client
                rcmd = NewCmd("players", stringifyJsonMarshal(thisGame.Players), player.GameId)
                sendMessage(thisGame.Players, Players, rcmd, 0)
/*
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
*/

                //send information about other games to client
                var ahs []interface{}
                err = c.Find(bson.M{ "playercount": bson.M{"$gt": 0}}).Sort("-lastmovetime").Limit(5).Select(bson.M{"gameid": 1, "playercount": 1, "currmoveindex": 1}).All(&ahs)
              //  err = c.Find(bson.M{ "gameid": bson.M{"$ne": thisGame.GameId}}).Sort("-lastmovetime").Limit(5).Select(bson.M{"gameid": 1, "playercount": 1, "currmoveindex": 1}).All(&ahs)
                rcmd = NewCmd("games", stringifyJsonMarshal(ahs),"")
                sendMessage(thisGame.Players, Players, rcmd, 0)
/*
                var xxx []byte
                xxx,_=json.Marshal(ahs)
                rcmd = new(Cmd)
                rcmd.Command="games"
                rcmd.GameId=""
                rcmd.Data=string(xxx)
                for _, gp := range thisGame.Players {
                    for _, p := range Players {
                        if p.Id == gp.Id {
                            p.Socket.WriteJSON(rcmd)
                        }
                    }
                }
*/
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
                    thisGame.LastMoveTime = time.Now()
                    err = c.Update(bson.M{"gameid": thisGame.GameId}, &thisGame)
                    if err != nil {
                        log.Printf("ERROR: could not update game in db")
                    }
                    _ = c.Find(bson.M{"gameid": cmd.GameId}).One(&thisGame)
                    rcmd = NewCmd("move", stringifyJsonMarshal(thisGame.Moves[thisGame.CurrMoveIndex]), cmd.GameId)
                    sendMessage(thisGame.Players, Players, rcmd, 0)
/*
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
*/
                }
            } else if cmd.Command == "games" {
                var ahs []interface{}
               // err = c.Find(bson.M{ "gameid": bson.M{"$ne": thisGame.GameId}}).Sort("-lastmovetime").Limit(5).Select(bson.M{"gameid": 1, "playercount": 1, "currmoveindex": 1}).All(&ahs)
                err = c.Find(bson.M{ "playercount": bson.M{"$gt": 0}}).Sort("-lastmovetime").Limit(5).Select(bson.M{"gameid": 1, "playercount": 1, "currmoveindex": 1}).All(&ahs)
                if err != nil {
                    log.Printf("ERROR: could not find other games in db")
                }
                rcmd = NewCmd("games", stringifyJsonMarshal(ahs), "")
/*
                var xxx []byte
                xxx,_=json.Marshal(ahs)
                rcmd := new(Cmd)
                rcmd.Command="games"
                rcmd.GameId=""
                rcmd.Data=string(xxx)
*/
                player.Socket.WriteJSON(rcmd)
            } else if cmd.Command == "msg" {
                err = c.Find(bson.M{"gameid": cmd.GameId}).One(&thisGame)
                if err != nil {
                    log.Printf("ERROR: could not find game in db")
                }
                rcmd = NewCmd("msg", string(player.Handle + " said: " + cmd.Data), cmd.GameId)
                sendMessage(thisGame.Players, Players, rcmd, 0)
/*
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
*/
            } else if cmd.Command == "move" {
                move := Move{}
                err = json.Unmarshal([]byte(cmd.Data), &move)
                if err != nil {
                    log.Printf("ERROR[move]: could not unmarshall data in move command")
                }
                move.MoveTime = time.Now()
                err = c.Find(bson.M{"gameid": cmd.GameId}).One(&thisGame)
                if err != nil {
                    log.Printf("ERROR[move]: could not find game in db")
                }
                thisGame.CurrMoveIndex = move.MoveIndex
                thisGame.Moves = thisGame.Moves[:move.MoveIndex]
                thisGame.Moves = append(thisGame.Moves, move)
                thisGame.LastMoveTime = move.MoveTime
                err = c.Update(bson.M{"gameid": thisGame.GameId}, &thisGame)
                if err != nil {
                    log.Printf("ERROR: could not update game in db")
                }
                rcmd = NewCmd("move", stringifyJsonMarshal(move), cmd.GameId)
                sendMessage(thisGame.Players, Players, rcmd, 0)
/*
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
*/
                //send information about other games to client
                var ahs []interface{}
                err = c.Find(bson.M{ "playercount": bson.M{"$gt": 0}}).Sort("-lastmovetime").Limit(5).Select(bson.M{"gameid": 1, "playercount": 1, "currmoveindex": 1}).All(&ahs)
              //  err = c.Find(bson.M{ "gameid": bson.M{"$ne": thisGame.GameId}}).Sort("-lastmovetime").Limit(5).Select(bson.M{"gameid": 1, "playercount": 1, "currmoveindex": 1}).All(&ahs)
              //  var xxx []byte
                rcmd = NewCmd("games", stringifyJsonMarshal(ahs), "")
                sendMessage(thisGame.Players, Players, rcmd, 0)
/*
                xxx,_=json.Marshal(ahs)
                rcmd = new(Cmd)
                rcmd.Command="games"
                rcmd.GameId=""
                rcmd.Data=string(xxx)
                for _, gp := range thisGame.Players {
                    for _, p := range Players {
                        if p.Id == gp.Id {
                            p.Socket.WriteJSON(rcmd)
                        }
                    }
                }
*/
                //send information about other games to client
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
