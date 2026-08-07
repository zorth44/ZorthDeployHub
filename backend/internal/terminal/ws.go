package terminal

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"sync/atomic"

	"github.com/gorilla/websocket"

	"github.com/zorth44/zorth-deploy-hub/backend/internal/auth"
)

type WSHandler struct {
	auth     *auth.Service
	manager  *Manager
	upgrader websocket.Upgrader
	seq      atomic.Uint64
}

func NewWSHandler(authService *auth.Service, manager *Manager) *WSHandler {
	return &WSHandler{
		auth:    authService,
		manager: manager,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

type inboundMessage struct {
	Type     string          `json:"type"`
	ServerID string          `json:"serverId,omitempty"`
	Cols     int             `json:"cols,omitempty"`
	Rows     int             `json:"rows,omitempty"`
	Data     string          `json:"data,omitempty"`
	Payload  json.RawMessage `json:"payload,omitempty"`
}

type outboundMessage struct {
	Type     string `json:"type"`
	ServerID string `json:"serverId,omitempty"`
	Name     string `json:"name,omitempty"`
	Host     string `json:"host,omitempty"`
	Username string `json:"username,omitempty"`
	Data     string `json:"data,omitempty"`
	Message  string `json:"message,omitempty"`
}

func (h *WSHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if _, err := h.auth.SessionFromRequest(r); err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	connID := formatConnID(h.seq.Add(1))
	defer h.manager.Close(connID)

	var writeMu sync.Mutex
	writeJSON := func(msg outboundMessage) {
		writeMu.Lock()
		defer writeMu.Unlock()
		if err := conn.WriteJSON(msg); err != nil {
			log.Printf("websocket write failed: %v", err)
		}
	}

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			return
		}

		var msg inboundMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			writeJSON(outboundMessage{Type: "terminal:error", Message: "invalid message"})
			continue
		}

		switch msg.Type {
		case "terminal:open":
			cols := clamp(msg.Cols, 20, 500, 80)
			rows := clamp(msg.Rows, 10, 200, 24)
			if msg.ServerID == "" {
				writeJSON(outboundMessage{Type: "terminal:error", Message: "serverId is required"})
				continue
			}
			server, err := h.manager.Open(connID, msg.ServerID, cols, rows, SessionCallbacks{
				OnData: func(data string) {
					writeJSON(outboundMessage{Type: "terminal:output", Data: data})
				},
				OnClose: func() {
					writeJSON(outboundMessage{Type: "terminal:close"})
				},
				OnError: func(message string) {
					writeJSON(outboundMessage{Type: "terminal:error", Message: message})
				},
			})
			if err != nil {
				writeJSON(outboundMessage{Type: "terminal:error", Message: err.Error()})
				continue
			}
			writeJSON(outboundMessage{
				Type:     "terminal:ready",
				ServerID: server.ID,
				Name:     server.Name,
				Host:     server.Host,
				Username: server.Username,
			})

		case "terminal:input":
			h.manager.Write(connID, msg.Data)

		case "terminal:resize":
			cols := clamp(msg.Cols, 20, 500, 80)
			rows := clamp(msg.Rows, 10, 200, 24)
			h.manager.Resize(connID, cols, rows)
		}
	}
}

func clamp(value, min, max, fallback int) int {
	if value == 0 {
		return fallback
	}
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func formatConnID(n uint64) string {
	return "ws-" + itoa(n)
}

func itoa(n uint64) string {
	const digits = "0123456789"
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = digits[n%10]
		n /= 10
	}
	return string(buf[i:])
}
