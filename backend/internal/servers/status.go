package servers

import (
	"net"
	"strconv"
	"sync"
	"time"
)

type OnlineStatus string

const (
	StatusOnline  OnlineStatus = "online"
	StatusOffline OnlineStatus = "offline"
)

func ProbeAll(list []Server) map[string]OnlineStatus {
	out := make(map[string]OnlineStatus, len(list))
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, server := range list {
		wg.Add(1)
		go func(server Server) {
			defer wg.Done()
			status := StatusOffline
			if probeTCP(server.Host, server.Port, 2*time.Second) {
				status = StatusOnline
			}
			mu.Lock()
			out[server.ID] = status
			mu.Unlock()
		}(server)
	}
	wg.Wait()
	return out
}

func probeTCP(host string, port int, timeout time.Duration) bool {
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	conn, err := net.DialTimeout("tcp", addr, timeout)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}
