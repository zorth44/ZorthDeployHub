package terminal

import (
	"fmt"
	"io"
	"os"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"

	"github.com/zorth44/zorth-deploy-hub/backend/internal/servers"
)

type SessionCallbacks struct {
	OnData  func(data string)
	OnClose func()
	OnError func(message string)
}

type session struct {
	client  *ssh.Client
	session *ssh.Session
	stdin   io.WriteCloser
	once    sync.Once
}

type Manager struct {
	store         *servers.Store
	privateKeyPath string
	mu            sync.Mutex
	sessions      map[string]*session
}

func NewManager(store *servers.Store, privateKeyPath string) *Manager {
	return &Manager{
		store:          store,
		privateKeyPath: privateKeyPath,
		sessions:       make(map[string]*session),
	}
}

func (m *Manager) Open(connID, serverID string, cols, rows int, cb SessionCallbacks) (servers.Server, error) {
	m.Close(connID)

	server, err := m.store.Get(serverID)
	if err != nil {
		return servers.Server{}, err
	}

	keyBytes, err := os.ReadFile(m.privateKeyPath)
	if err != nil {
		return servers.Server{}, fmt.Errorf("read SSH private key: %w", err)
	}
	signer, err := ssh.ParsePrivateKey(keyBytes)
	if err != nil {
		return servers.Server{}, fmt.Errorf("parse SSH private key: %w", err)
	}

	config := &ssh.ClientConfig{
		User: server.Username,
		Auth: []ssh.AuthMethod{
			ssh.PublicKeys(signer),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), //nolint:gosec // MVP matches current Node behavior
		Timeout:         20 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", server.Host, server.Port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return servers.Server{}, fmt.Errorf("SSH connect failed: %w", err)
	}

	sshSession, err := client.NewSession()
	if err != nil {
		_ = client.Close()
		return servers.Server{}, fmt.Errorf("SSH session failed: %w", err)
	}

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := sshSession.RequestPty("xterm-256color", rows, cols, modes); err != nil {
		_ = sshSession.Close()
		_ = client.Close()
		return servers.Server{}, fmt.Errorf("PTY request failed: %w", err)
	}

	stdin, err := sshSession.StdinPipe()
	if err != nil {
		_ = sshSession.Close()
		_ = client.Close()
		return servers.Server{}, err
	}
	stdout, err := sshSession.StdoutPipe()
	if err != nil {
		_ = sshSession.Close()
		_ = client.Close()
		return servers.Server{}, err
	}
	stderr, err := sshSession.StderrPipe()
	if err != nil {
		_ = sshSession.Close()
		_ = client.Close()
		return servers.Server{}, err
	}

	if err := sshSession.Shell(); err != nil {
		_ = sshSession.Close()
		_ = client.Close()
		return servers.Server{}, fmt.Errorf("shell failed: %w", err)
	}

	sess := &session{
		client:  client,
		session: sshSession,
		stdin:   stdin,
	}

	m.mu.Lock()
	m.sessions[connID] = sess
	m.mu.Unlock()

	copyOutput := func(r io.Reader) {
		buf := make([]byte, 32*1024)
		for {
			n, readErr := r.Read(buf)
			if n > 0 && cb.OnData != nil {
				cb.OnData(string(buf[:n]))
			}
			if readErr != nil {
				return
			}
		}
	}

	go copyOutput(stdout)
	go copyOutput(stderr)
	go func() {
		_ = sshSession.Wait()
		m.Close(connID)
		if cb.OnClose != nil {
			cb.OnClose()
		}
	}()

	return server, nil
}

func (m *Manager) Write(connID, data string) {
	m.mu.Lock()
	sess := m.sessions[connID]
	m.mu.Unlock()
	if sess == nil || sess.stdin == nil {
		return
	}
	_, _ = io.WriteString(sess.stdin, data)
}

func (m *Manager) Resize(connID string, cols, rows int) {
	m.mu.Lock()
	sess := m.sessions[connID]
	m.mu.Unlock()
	if sess == nil || sess.session == nil {
		return
	}
	_ = sess.session.WindowChange(rows, cols)
}

func (m *Manager) Close(connID string) {
	m.mu.Lock()
	sess := m.sessions[connID]
	delete(m.sessions, connID)
	m.mu.Unlock()
	if sess == nil {
		return
	}
	sess.once.Do(func() {
		if sess.stdin != nil {
			_ = sess.stdin.Close()
		}
		if sess.session != nil {
			_ = sess.session.Close()
		}
		if sess.client != nil {
			_ = sess.client.Close()
		}
	})
}
